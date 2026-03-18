import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { fetchPRDiff, postStatusCheck } from "@/lib/github";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const RequestSchema = z.object({
  repositoryId: z.number().int().positive(),
  prNumber: z.number().int().positive(),
  sha: z.string().min(1),
});

const AnthropicResponseSchema = z.object({
  merge_score: z.number().min(0).max(100),
  untested_paths: z.array(z.string()),
  test_suggestions: z.array(z.string()),
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repositoryId, prNumber, sha } = parsed.data;

    // Fetch repository including owner token and score_threshold
    const repoResult = await client.query(
      `SELECT r.id, r.full_name, r.score_threshold, u.github_token as owner_token
       FROM repositories r
       JOIN users u ON u.id = r.owner_id
       WHERE r.id = $1`,
      [repositoryId],
    );

    if (repoResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    const repository = repoResult.rows[0];
    const { full_name, score_threshold, owner_token } = repository;

    // Update analysis_jobs status to processing
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'processing', updated_at = NOW()
       WHERE repository_id = $1 AND pr_number = $2 AND sha = $3`,
      [repositoryId, prNumber, sha],
    );

    // Fetch PR diff from GitHub
    let diff: string;
    try {
      diff = await fetchPRDiff({
        repoFullName: full_name,
        prNumber,
        token: owner_token,
      });
    } catch (err) {
      await markJobFailed(client, repositoryId, prNumber, sha);
      return NextResponse.json(
        { error: "Failed to fetch PR diff", details: String(err) },
        { status: 502 },
      );
    }

    // Send diff to Anthropic Claude for analysis
    let analysisResult: z.infer<typeof AnthropicResponseSchema>;
    try {
      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a code review assistant specializing in test coverage analysis. Analyze the following PR diff and provide a JSON response with:
1. merge_score: A score from 0-100 indicating how well-tested the changes are (100 = fully tested, 0 = no tests)
2. untested_paths: An array of file paths or code paths that lack test coverage
3. test_suggestions: An array of specific suggestions for improving test coverage

Respond ONLY with valid JSON in this exact format:
{
  "merge_score": <number 0-100>,
  "untested_paths": ["path1", "path2", ...],
  "test_suggestions": ["suggestion1", "suggestion2", ...]
}

PR Diff:
\`\`\`
${diff}
\`\`\``,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Claude response");
      }

      const rawJson = JSON.parse(jsonMatch[0]);
      const validatedResponse = AnthropicResponseSchema.safeParse(rawJson);

      if (!validatedResponse.success) {
        throw new Error(
          `Invalid response structure: ${validatedResponse.error.message}`,
        );
      }

      analysisResult = validatedResponse.data;
    } catch (err) {
      await markJobFailed(client, repositoryId, prNumber, sha);
      return NextResponse.json(
        { error: "Failed to analyze PR with Claude", details: String(err) },
        { status: 502 },
      );
    }

    const { merge_score, untested_paths, test_suggestions } = analysisResult;

    // Store result in pr_analyses table
    const analysisInsert = await client.query(
      `INSERT INTO pr_analyses (repository_id, pr_number, sha, merge_score, untested_paths, test_suggestions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (repository_id, pr_number, sha)
       DO UPDATE SET
         merge_score = EXCLUDED.merge_score,
         untested_paths = EXCLUDED.untested_paths,
         test_suggestions = EXCLUDED.test_suggestions,
         updated_at = NOW()
       RETURNING *`,
      [
        repositoryId,
        prNumber,
        sha,
        merge_score,
        JSON.stringify(untested_paths),
        JSON.stringify(test_suggestions),
      ],
    );

    const storedAnalysis = analysisInsert.rows[0];

    // Determine GitHub status check state based on score_threshold
    const passed = merge_score >= (score_threshold ?? 70);
    const statusState = passed ? "success" : "failure";
    const statusDescription = passed
      ? `Test coverage score: ${merge_score}/100 — meets threshold`
      : `Test coverage score: ${merge_score}/100 — below threshold of ${score_threshold ?? 70}`;

    // Post GitHub status check
    try {
      await postStatusCheck({
        repoFullName: full_name,
        sha,
        state: statusState,
        description: statusDescription,
        context: "test-coverage-analyzer",
        token: owner_token,
      });
    } catch (err) {
      console.error("Failed to post GitHub status check:", err);
      // Don't fail the whole request if status check posting fails
    }

    // Update analysis_jobs status to completed
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'completed', updated_at = NOW()
       WHERE repository_id = $1 AND pr_number = $2 AND sha = $3`,
      [repositoryId, prNumber, sha],
    );

    return NextResponse.json(
      {
        success: true,
        analysis: {
          id: storedAnalysis.id,
          repositoryId,
          prNumber,
          sha,
          merge_score,
          untested_paths,
          test_suggestions,
          passed,
          score_threshold: score_threshold ?? 70,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Unexpected error in PR analysis job processor:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

async function markJobFailed(
  client: Awaited<ReturnType<typeof pool.connect>>,
  repositoryId: number,
  prNumber: number,
  sha: string,
) {
  try {
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'failed', updated_at = NOW()
       WHERE repository_id = $1 AND pr_number = $2 AND sha = $3`,
      [repositoryId, prNumber, sha],
    );
  } catch (err) {
    console.error("Failed to mark job as failed:", err);
  }
}
