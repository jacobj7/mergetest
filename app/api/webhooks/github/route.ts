import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const GitHubWebhookPayloadSchema = z.object({
  action: z.string().optional(),
  repository: z
    .object({
      id: z.number(),
      name: z.string(),
      full_name: z.string(),
      private: z.boolean(),
      html_url: z.string(),
      description: z.string().nullable().optional(),
      owner: z.object({
        login: z.string(),
        id: z.number(),
      }),
    })
    .optional(),
  sender: z
    .object({
      login: z.string(),
      id: z.number(),
    })
    .optional(),
  installation: z
    .object({
      id: z.number(),
      account: z.object({
        login: z.string(),
        id: z.number(),
      }),
    })
    .optional(),
  ref: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        timestamp: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string(),
        }),
        added: z.array(z.string()).optional(),
        removed: z.array(z.string()).optional(),
        modified: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  pull_request: z
    .object({
      id: z.number(),
      number: z.number(),
      title: z.string(),
      state: z.string(),
      body: z.string().nullable().optional(),
      html_url: z.string(),
      user: z.object({
        login: z.string(),
        id: z.number(),
      }),
      head: z.object({
        ref: z.string(),
        sha: z.string(),
      }),
      base: z.object({
        ref: z.string(),
        sha: z.string(),
      }),
      merged: z.boolean().optional(),
      merged_at: z.string().nullable().optional(),
    })
    .optional(),
  issue: z
    .object({
      id: z.number(),
      number: z.number(),
      title: z.string(),
      state: z.string(),
      body: z.string().nullable().optional(),
      html_url: z.string(),
      user: z.object({
        login: z.string(),
        id: z.number(),
      }),
    })
    .optional(),
});

type GitHubWebhookPayload = z.infer<typeof GitHubWebhookPayloadSchema>;

function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

async function ensureWebhookEventsTable(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS github_webhook_events (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(255) NOT NULL,
      delivery_id VARCHAR(255),
      repository_full_name VARCHAR(255),
      sender_login VARCHAR(255),
      action VARCHAR(255),
      payload JSONB NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function storeWebhookEvent(
  eventType: string,
  deliveryId: string | null,
  payload: GitHubWebhookPayload,
  rawPayload: string,
): Promise<number> {
  const client = await pool.connect();
  try {
    await ensureWebhookEventsTable(client);

    const result = await client.query(
      `INSERT INTO github_webhook_events 
        (event_type, delivery_id, repository_full_name, sender_login, action, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        eventType,
        deliveryId,
        payload.repository?.full_name ?? null,
        payload.sender?.login ?? null,
        payload.action ?? null,
        rawPayload,
      ],
    );

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

async function handlePushEvent(payload: GitHubWebhookPayload): Promise<void> {
  if (!payload.repository || !payload.commits) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_push_events (
        id SERIAL PRIMARY KEY,
        repository_full_name VARCHAR(255) NOT NULL,
        ref VARCHAR(255),
        before_sha VARCHAR(255),
        after_sha VARCHAR(255),
        commit_count INTEGER,
        pusher_login VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO github_push_events 
        (repository_full_name, ref, before_sha, after_sha, commit_count, pusher_login)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        payload.repository.full_name,
        payload.ref ?? null,
        payload.before ?? null,
        payload.after ?? null,
        payload.commits.length,
        payload.sender?.login ?? null,
      ],
    );
  } finally {
    client.release();
  }
}

async function handlePullRequestEvent(
  payload: GitHubWebhookPayload,
): Promise<void> {
  if (!payload.repository || !payload.pull_request) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_pull_request_events (
        id SERIAL PRIMARY KEY,
        repository_full_name VARCHAR(255) NOT NULL,
        pr_number INTEGER NOT NULL,
        pr_title TEXT,
        pr_state VARCHAR(50),
        action VARCHAR(255),
        author_login VARCHAR(255),
        head_ref VARCHAR(255),
        base_ref VARCHAR(255),
        merged BOOLEAN,
        merged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO github_pull_request_events 
        (repository_full_name, pr_number, pr_title, pr_state, action, author_login, head_ref, base_ref, merged, merged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        payload.repository.full_name,
        payload.pull_request.number,
        payload.pull_request.title,
        payload.pull_request.state,
        payload.action ?? null,
        payload.pull_request.user.login,
        payload.pull_request.head.ref,
        payload.pull_request.base.ref,
        payload.pull_request.merged ?? false,
        payload.pull_request.merged_at ?? null,
      ],
    );
  } finally {
    client.release();
  }
}

async function handleIssueEvent(payload: GitHubWebhookPayload): Promise<void> {
  if (!payload.repository || !payload.issue) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_issue_events (
        id SERIAL PRIMARY KEY,
        repository_full_name VARCHAR(255) NOT NULL,
        issue_number INTEGER NOT NULL,
        issue_title TEXT,
        issue_state VARCHAR(50),
        action VARCHAR(255),
        author_login VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO github_issue_events 
        (repository_full_name, issue_number, issue_title, issue_state, action, author_login)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        payload.repository.full_name,
        payload.issue.number,
        payload.issue.title,
        payload.issue.state,
        payload.action ?? null,
        payload.issue.user.login,
      ],
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 },
    );
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (webhookSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    const isValid = verifyGitHubSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }
  }

  const eventType = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");

  if (!eventType) {
    return NextResponse.json(
      { error: "Missing x-github-event header" },
      { status: 400 },
    );
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const validationResult = GitHubWebhookPayloadSchema.safeParse(parsedPayload);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid payload schema",
        details: validationResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = validationResult.data;

  let eventId: number;
  try {
    eventId = await storeWebhookEvent(eventType, deliveryId, payload, rawBody);
  } catch (error) {
    console.error("Failed to store webhook event:", error);
    return NextResponse.json(
      { error: "Failed to store webhook event" },
      { status: 500 },
    );
  }

  try {
    switch (eventType) {
      case "push":
        await handlePushEvent(payload);
        break;
      case "pull_request":
        await handlePullRequestEvent(payload);
        break;
      case "issues":
        await handleIssueEvent(payload);
        break;
      case "ping":
        break;
      default:
        console.log(`Unhandled GitHub event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`Failed to handle ${eventType} event:`, error);
  }

  return NextResponse.json(
    {
      success: true,
      eventId,
      eventType,
      deliveryId,
      message: `Successfully processed ${eventType} event`,
    },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: "GitHub webhook endpoint is active" },
    { status: 200 },
  );
}
