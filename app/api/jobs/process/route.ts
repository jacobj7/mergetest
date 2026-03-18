import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Pool } from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AnalysisResultSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(["info", "low", "medium", "high", "critical"]),
      file: z.string().optional(),
      line: z.number().optional(),
    }),
  ),
  recommendations: z.array(z.string()),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3.diff",
        "User-Agent": "PR-Risk-Analyzer",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch PR diff: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

async function fetchPRDetails(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string,
): Promise<{ title: string; body: string; head_sha: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "PR-Risk-Analyzer",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch PR details: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return {
    title: data.title,
    body: data.body || "",
    head_sha: data.head.sha,
  };
}

async function analyzeWithClaude(
  diff: string,
  prTitle: string,
  prBody: string,
): Promise<AnalysisResult> {
  const prompt = `You are a senior security and code quality engineer. Analyze the following GitHub Pull Request diff and provide a comprehensive risk assessment.

PR Title: ${prTitle}
PR Description: ${prBody}

Diff:
\`\`\`diff
${diff.slice(0, 50000)}
\`\`\`

Analyze this PR for:
1. Security vulnerabilities (SQL injection, XSS, authentication issues, secrets/credentials exposure, etc.)
2. Code quality issues (complexity, maintainability, performance)
3. Breaking changes or backward compatibility issues
4. Missing error handling or edge cases
5. Dependency risks

Respond with a JSON object in exactly this format:
{
  "risk_score": <number 0-100, where 0 is no risk and 100 is critical risk>,
  "risk_level": <"low" | "medium" | "high" | "critical">,
  "summary": <brief overall summary of the PR and its risks>,
  "findings": [
    {
      "title": <finding title>,
      "description": <detailed description>,
      "severity": <"info" | "low" | "medium" | "high" | "critical">,
      "file": <optional: affected file path>,
      "line": <optional: affected line number>
    }
  ],
  "recommendations": [<actionable recommendation strings>]
}

Risk score guidelines:
- 0-20: Low risk, minor issues or clean code
- 21-40: Medium-low risk, some concerns but manageable
- 41-60: Medium risk, notable issues requiring attention
- 61-80: High risk, significant issues that should be addressed before merge
- 81-100: Critical risk, severe issues that must be fixed

Return ONLY the JSON object, no additional text.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let jsonText = content.text.trim();
  // Remove markdown code fences if present
  jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  const parsed = JSON.parse(jsonText);
  return AnalysisResultSchema.parse(parsed);
}

async function postGitHubStatusCheck(
  owner: string,
  repo: string,
  sha: string,
  riskLevel: string,
  riskScore: number,
  githubToken: string,
): Promise<void> {
  const state =
    riskLevel === "critical" || riskLevel === "high" ? "failure" : "success";
  const description = `Risk Score: ${riskScore}/100 (${riskLevel.toUpperCase()})`;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "PR-Risk-Analyzer",
      },
      body: JSON.stringify({
        state,
        description,
        context: "PR Risk Analyzer",
        target_url: process.env.NEXTAUTH_URL || "",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to post status check: ${response.status} ${errorText}`,
    );
  }
}

async function postGitHubPRComment(
  owner: string,
  repo: string,
  prNumber: number,
  analysis: AnalysisResult,
  githubToken: string,
): Promise<void> {
  const riskEmoji =
    {
      low: "🟢",
      medium: "🟡",
      high: "🟠",
      critical: "🔴",
    }[analysis.risk_level] || "⚪";

  const findingsText =
    analysis.findings.length > 0
      ? analysis.findings
          .map(
            (f) =>
              `### ${f.severity.toUpperCase()}: ${f.title}\n${f.description}${f.file ? `\n**File:** \`${f.file}\`` : ""}${f.line ? ` (line ${f.line})` : ""}`,
          )
          .join("\n\n")
      : "_No specific findings._";

  const recommendationsText =
    analysis.recommendations.length > 0
      ? analysis.recommendations.map((r) => `- ${r}`).join("\n")
      : "_No specific recommendations._";

  const comment = `## ${riskEmoji} PR Risk Analysis

**Risk Score:** ${analysis.risk_score}/100  
**Risk Level:** ${analysis.risk_level.toUpperCase()}

### Summary
${analysis.summary}

### Findings
${findingsText}

### Recommendations
${recommendationsText}

---
_Analyzed by PR Risk Analyzer powered by Claude AI_`;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "PR-Risk-Analyzer",
      },
      body: JSON.stringify({ body: comment }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to post PR comment: ${response.status} ${errorText}`);
  }
}

async function processJob(jobId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch and lock the job
    const jobResult = await client.query(
      `SELECT j.*, r.owner, r.name as repo_name, r.github_token
       FROM analysis_jobs j
       JOIN repositories r ON j.repository_id = r.id
       WHERE j.id = $1 AND j.status = 'pending'
       FOR UPDATE SKIP LOCKED`,
      [jobId],
    );

    if (jobResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    const job = jobResult.rows[0];

    // Mark job as processing
    await client.query(
      `UPDATE analysis_jobs SET status = 'processing', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId],
    );

    await client.query("COMMIT");

    // Fetch PR details and diff
    const githubToken = job.github_token || process.env.GITHUB_TOKEN || "";
    const prDetails = await fetchPRDetails(
      job.owner,
      job.repo_name,
      job.pr_number,
      githubToken,
    );
    const diff = await fetchPRDiff(
      job.owner,
      job.repo_name,
      job.pr_number,
      githubToken,
    );

    // Analyze with Claude
    const analysis = await analyzeWithClaude(
      diff,
      prDetails.title,
      prDetails.body,
    );

    // Persist analysis result
    await client.query("BEGIN");

    const analysisResult = await client.query(
      `INSERT INTO pr_analyses (
        job_id,
        repository_id,
        pr_number,
        pr_title,
        commit_sha,
        risk_score,
        risk_level,
        summary,
        findings,
        recommendations,
        diff_size,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (job_id) DO UPDATE SET
        risk_score = EXCLUDED.risk_score,
        risk_level = EXCLUDED.risk_level,
        summary = EXCLUDED.summary,
        findings = EXCLUDED.findings,
        recommendations = EXCLUDED.recommendations,
        updated_at = NOW()
      RETURNING id`,
      [
        jobId,
        job.repository_id,
        job.pr_number,
        prDetails.title,
        prDetails.head_sha,
        analysis.risk_score,
        analysis.risk_level,
        analysis.summary,
        JSON.stringify(analysis.findings),
        JSON.stringify(analysis.recommendations),
        diff.length,
      ],
    );

    // Mark job as complete
    await client.query(
      `UPDATE analysis_jobs 
       SET status = 'completed', 
           completed_at = NOW(), 
           updated_at = NOW(),
           analysis_id = $2
       WHERE id = $1`,
      [jobId, analysisResult.rows[0].id],
    );

    await client.query("COMMIT");

    // Post GitHub status check and comment (outside transaction)
    await postGitHubStatusCheck(
      job.owner,
      job.repo_name,
      prDetails.head_sha,
      analysis.risk_level,
      analysis.risk_score,
      githubToken,
    );

    await postGitHubPRComment(
      job.owner,
      job.repo_name,
      job.pr_number,
      analysis,
      githubToken,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    // Mark job as failed
    try {
      await client.query(
        `UPDATE analysis_jobs 
         SET status = 'failed', 
             error_message = $2, 
             updated_at = NOW()
         WHERE id = $1`,
        [jobId, error instanceof Error ? error.message : "Unknown error"],
      );
    } catch (updateError) {
      console.error("Failed to mark job as failed:", updateError);
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = await pool.connect();
    let pendingJobs: Array<{ id: string }> = [];

    try {
      // Fetch pending jobs
      const result = await client.query(
        `SELECT id FROM analysis_jobs 
         WHERE status = 'pending' 
         ORDER BY created_at ASC 
         LIMIT 5`,
      );
      pendingJobs = result.rows;
    } finally {
      client.release();
    }

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        message: "No pending jobs found",
        processed: 0,
      });
    }

    const results = await Promise.allSettled(
      pendingJobs.map((job) => processJob(job.id)),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason?.message || "Unknown error");

    return NextResponse.json({
      message: `Processed ${pendingJobs.length} jobs`,
      processed: pendingJobs.length,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error processing jobs:", error);
    return NextResponse.json(
      {
        error: "Failed to process jobs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
