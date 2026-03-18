import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    state: z.string(),
    html_url: z.string(),
    diff_url: z.string(),
    patch_url: z.string(),
    head: z.object({
      sha: z.string(),
      ref: z.string(),
      repo: z.object({
        id: z.number(),
        full_name: z.string(),
      }),
    }),
    base: z.object({
      sha: z.string(),
      ref: z.string(),
      repo: z.object({
        id: z.number(),
        full_name: z.string(),
      }),
    }),
    user: z.object({
      id: z.number(),
      login: z.string(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: z.object({
    id: z.number(),
    full_name: z.string(),
    name: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number(),
    }),
  }),
  sender: z.object({
    id: z.number(),
    login: z.string(),
  }),
});

async function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");

  const isValid = await verifySignature(rawBody, signature, webhookSecret);

  if (!isValid) {
    console.warn(`Invalid webhook signature for delivery: ${deliveryId}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event !== "pull_request") {
    return NextResponse.json(
      { message: `Event '${event}' ignored` },
      { status: 200 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const parseResult = PullRequestEventSchema.safeParse(payload);

  if (!parseResult.success) {
    console.error("Invalid pull_request payload:", parseResult.error.flatten());
    return NextResponse.json(
      {
        error: "Invalid payload structure",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const data = parseResult.data;
  const { action, pull_request: pr, repository } = data;

  if (action !== "opened" && action !== "synchronize") {
    return NextResponse.json(
      { message: `Action '${action}' ignored` },
      { status: 200 },
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO pull_requests (
        github_pr_id,
        number,
        title,
        body,
        state,
        html_url,
        diff_url,
        patch_url,
        head_sha,
        head_ref,
        base_sha,
        base_ref,
        repository_id,
        repository_full_name,
        author_id,
        author_login,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (github_pr_id) DO UPDATE SET
        number = EXCLUDED.number,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        state = EXCLUDED.state,
        html_url = EXCLUDED.html_url,
        diff_url = EXCLUDED.diff_url,
        patch_url = EXCLUDED.patch_url,
        head_sha = EXCLUDED.head_sha,
        head_ref = EXCLUDED.head_ref,
        base_sha = EXCLUDED.base_sha,
        base_ref = EXCLUDED.base_ref,
        repository_id = EXCLUDED.repository_id,
        repository_full_name = EXCLUDED.repository_full_name,
        author_id = EXCLUDED.author_id,
        author_login = EXCLUDED.author_login,
        updated_at = EXCLUDED.updated_at
      RETURNING id
      `,
      [
        pr.id,
        pr.number,
        pr.title,
        pr.body ?? null,
        pr.state,
        pr.html_url,
        pr.diff_url,
        pr.patch_url,
        pr.head.sha,
        pr.head.ref,
        pr.base.sha,
        pr.base.ref,
        repository.id,
        repository.full_name,
        pr.user.id,
        pr.user.login,
        pr.created_at,
        pr.updated_at,
      ],
    );

    const prSelectResult = await client.query(
      `SELECT id FROM pull_requests WHERE github_pr_id = $1`,
      [pr.id],
    );

    const pullRequestDbId: string = prSelectResult.rows[0].id;

    await client.query(
      `
      INSERT INTO analysis_jobs (
        pull_request_id,
        status,
        head_sha,
        action,
        delivery_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )
      `,
      [pullRequestDbId, "pending", pr.head.sha, action, deliveryId ?? null],
    );

    await client.query("COMMIT");

    console.log(
      `Processed pull_request.${action} event for PR #${pr.number} in ${repository.full_name}`,
    );

    return NextResponse.json(
      {
        message: "Webhook processed successfully",
        pull_request_id: pullRequestDbId,
        action,
      },
      { status: 200 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
