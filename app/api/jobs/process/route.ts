import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const { rows: pendingJobs } = await client.query(
      `SELECT j.*, r.owner, r.name as repo_name
       FROM jobs j
       JOIN repos r ON j.repo_id = r.id
       WHERE j.status = 'pending'
       ORDER BY j.created_at ASC
       LIMIT 10`,
    );

    if (pendingJobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs", processed: 0 });
    }

    const results = [];

    for (const job of pendingJobs) {
      try {
        await client.query(
          `UPDATE jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
          [job.id],
        );

        const { rows: prRows } = await client.query(
          `SELECT * FROM pull_requests WHERE job_id = $1`,
          [job.id],
        );

        let analysisContent = `Analyzing repository ${job.owner}/${job.repo_name}`;
        if (prRows.length > 0) {
          analysisContent += `\n\nPull Requests:\n${prRows
            .map((pr: any) => `- PR #${pr.number}: ${pr.title}`)
            .join("\n")}`;
        }

        const message = await anthropic.messages.create({
          model: "claude-opus-4-5",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Please analyze the following repository activity and provide insights:\n\n${analysisContent}`,
            },
          ],
        });

        const analysisResult =
          message.content[0].type === "text" ? message.content[0].text : "";

        await client.query(
          `UPDATE jobs 
           SET status = 'completed', 
               result = $1, 
               updated_at = NOW() 
           WHERE id = $2`,
          [analysisResult, job.id],
        );

        results.push({ jobId: job.id, status: "completed" });
      } catch (jobError) {
        console.error(`Error processing job ${job.id}:`, jobError);

        await client.query(
          `UPDATE jobs 
           SET status = 'failed', 
               error = $1, 
               updated_at = NOW() 
           WHERE id = $2`,
          [
            jobError instanceof Error ? jobError.message : "Unknown error",
            job.id,
          ],
        );

        results.push({ jobId: job.id, status: "failed" });
      }
    }

    return NextResponse.json({
      message: "Job processing complete",
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in job processing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
