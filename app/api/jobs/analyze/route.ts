import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { z } from "zod";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AnalyzeJobSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string().min(1),
  jobDescription: z.string().min(1),
  resumeText: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = AnalyzeJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { jobId, jobTitle, jobDescription, resumeText } =
      validationResult.data;

    const client = await pool.connect();

    try {
      const jobCheck = await client.query(
        "SELECT id, user_id FROM jobs WHERE id = $1",
        [jobId],
      );

      if (jobCheck.rows.length === 0) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      const job = jobCheck.rows[0];

      if (job.user_id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await client.query(
        "UPDATE jobs SET analysis_status = $1, updated_at = NOW() WHERE id = $2",
        ["processing", jobId],
      );

      const prompt = `You are an expert career coach and resume analyst. Analyze the following job description and resume, then provide a comprehensive analysis.

Job Title: ${jobTitle}

Job Description:
${jobDescription}

Resume:
${resumeText}

Please provide a detailed analysis including:
1. Match Score (0-100): How well does the resume match the job requirements?
2. Key Strengths: What aspects of the resume align well with the job?
3. Gaps and Missing Skills: What important requirements from the job description are missing or weak in the resume?
4. Recommendations: Specific actionable suggestions to improve the resume for this job.
5. Keywords to Add: Important keywords from the job description that should be incorporated into the resume.
6. Overall Assessment: A brief summary of the candidate's fit for this role.

Format your response as a structured JSON object with the following fields:
{
  "matchScore": number,
  "strengths": string[],
  "gaps": string[],
  "recommendations": string[],
  "keywordsToAdd": string[],
  "overallAssessment": string
}`;

      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      let analysisData;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch {
        analysisData = {
          matchScore: 0,
          strengths: [],
          gaps: [],
          recommendations: ["Unable to parse analysis. Please try again."],
          keywordsToAdd: [],
          overallAssessment: responseText,
        };
      }

      const AnalysisSchema = z.object({
        matchScore: z.number().min(0).max(100),
        strengths: z.array(z.string()),
        gaps: z.array(z.string()),
        recommendations: z.array(z.string()),
        keywordsToAdd: z.array(z.string()),
        overallAssessment: z.string(),
      });

      const analysisValidation = AnalysisSchema.safeParse(analysisData);
      const validatedAnalysis = analysisValidation.success
        ? analysisValidation.data
        : {
            matchScore: 0,
            strengths: [],
            gaps: [],
            recommendations: ["Analysis validation failed. Please try again."],
            keywordsToAdd: [],
            overallAssessment: "Unable to validate analysis results.",
          };

      await client.query(
        `UPDATE jobs 
         SET analysis_status = $1, 
             analysis_result = $2, 
             match_score = $3,
             updated_at = NOW() 
         WHERE id = $4`,
        [
          "completed",
          JSON.stringify(validatedAnalysis),
          validatedAnalysis.matchScore,
          jobId,
        ],
      );

      return NextResponse.json({
        success: true,
        jobId,
        analysis: validatedAnalysis,
      });
    } catch (dbError) {
      await client.query(
        "UPDATE jobs SET analysis_status = $1, updated_at = NOW() WHERE id = $2",
        ["failed", jobId],
      );
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Job analysis error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const uuidSchema = z.string().uuid();
    const uuidValidation = uuidSchema.safeParse(jobId);

    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: "Invalid job ID format" },
        { status: 400 },
      );
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT id, job_title, analysis_status, analysis_result, match_score, created_at, updated_at 
         FROM jobs 
         WHERE id = $1 AND user_id = $2`,
        [jobId, session.user.id],
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      const job = result.rows[0];

      return NextResponse.json({
        jobId: job.id,
        jobTitle: job.job_title,
        analysisStatus: job.analysis_status,
        analysis: job.analysis_result,
        matchScore: job.match_score,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Get job analysis error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
