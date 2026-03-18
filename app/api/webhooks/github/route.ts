import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const webhookSchema = z.object({
  action: z.string(),
  pull_request: z
    .object({
      number: z.number(),
      title: z.string(),
      body: z.string().nullable(),
      html_url: z.string(),
      diff_url: z.string(),
      state: z.string(),
      user: z.object({ login: z.string() }),
      base: z.object({
        repo: z.object({ full_name: z.string(), id: z.number() }),
      }),
    })
    .optional(),
  repository: z.object({ id: z.number(), full_name: z.string() }).optional(),
});

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const digest = Buffer.from("sha256=" + hmac.digest("hex"), "utf8");
  const sig = Buffer.from(signature, "utf8");

  if (digest.length !== sig.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, sig);
}

async function analyzeWithClaude(pr: {
  title: string;
  body: string | null;
  diff: string;
}): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this pull request and provide a concise code review summary:

Title: ${pr.title}
Description: ${pr.body || "No description provided"}

Diff:
${pr.diff.slice(0, 8000)}

Please provide:
1. A brief summary of the changes
2. Potential issues or concerns
3. Suggestions for improvement`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }
  return content.text;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "pull_request") {
    return NextResponse.json({ message: "Event ignored" }, { status: 200 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (
    !data.pull_request ||
    !["opened", "synchronize", "reopened"].includes(data.action)
  ) {
    return NextResponse.json({ message: "Action ignored" }, { status: 200 });
  }

  const pr = data.pull_request;
  const repoGithubId = pr.base.repo.id;

  const client = await pool.connect();
  try {
    const repoResult = await client.query(
      "SELECT id, webhook_secret FROM repositories WHERE github_id = $1",
      [repoGithubId],
    );

    if (repoResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    const repository = repoResult.rows[0];

    let diff = "";
    try {
      const diffResponse = await fetch(pr.diff_url, {
        headers: { Accept: "application/vnd.github.v3.diff" },
      });
      if (diffResponse.ok) {
        diff = await diffResponse.text();
      }
    } catch {
      diff = "Diff unavailable";
    }

    const analysis = await analyzeWithClaude({
      title: pr.title,
      body: pr.body,
      diff,
    });

    await client.query(
      `INSERT INTO pr_analyses (repository_id, pr_number, pr_title, pr_url, pr_author, analysis, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (repository_id, pr_number) DO UPDATE
       SET analysis = EXCLUDED.analysis, pr_title = EXCLUDED.pr_title, created_at = NOW()`,
      [
        repository.id,
        pr.number,
        pr.title,
        pr.html_url,
        pr.user.login,
        analysis,
      ],
    );

    return NextResponse.json(
      { message: "PR analyzed successfully" },
      { status: 200 },
    );
  } finally {
    client.release();
  }
}
