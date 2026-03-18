import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createRepoSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const userResult = await client.query(
      "SELECT id, org_id FROM users WHERE email = $1",
      [session.user.email],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const orgId = user.org_id;

    if (!orgId) {
      return NextResponse.json({ repos: [] });
    }

    const reposResult = await client.query(
      "SELECT id, owner, name, webhook_id, created_at, updated_at FROM repos WHERE org_id = $1 ORDER BY created_at DESC",
      [orgId],
    );

    return NextResponse.json({ repos: reposResult.rows });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = createRepoSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { owner, name } = parseResult.data;

  const client = await pool.connect();
  try {
    const userResult = await client.query(
      "SELECT id, org_id FROM users WHERE email = $1",
      [session.user.email],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const orgId = user.org_id;

    if (!orgId) {
      return NextResponse.json(
        { error: "User does not belong to an organization" },
        { status: 400 },
      );
    }

    const existingRepo = await client.query(
      "SELECT id FROM repos WHERE owner = $1 AND name = $2 AND org_id = $3",
      [owner, name, orgId],
    );

    if (existingRepo.rows.length > 0) {
      return NextResponse.json(
        { error: "Repository already exists for this organization" },
        { status: 409 },
      );
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: "GitHub token not configured" },
        { status: 500 },
      );
    }

    const webhookUrl =
      process.env.WEBHOOK_URL ||
      `${process.env.NEXTAUTH_URL}/api/webhooks/github`;

    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${name}/hooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["push", "pull_request"],
          config: {
            url: webhookUrl,
            content_type: "json",
            insecure_ssl: "0",
            secret: process.env.GITHUB_WEBHOOK_SECRET || "",
          },
        }),
      },
    );

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json().catch(() => ({}));
      console.error("GitHub API error:", githubResponse.status, errorData);
      return NextResponse.json(
        {
          error: "Failed to create GitHub webhook",
          details: errorData,
        },
        { status: githubResponse.status },
      );
    }

    const webhookData = await githubResponse.json();
    const webhookId = webhookData.id;

    const insertResult = await client.query(
      `INSERT INTO repos (owner, name, webhook_id, org_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, owner, name, webhook_id, org_id, created_at, updated_at`,
      [owner, name, webhookId, orgId],
    );

    const newRepo = insertResult.rows[0];

    return NextResponse.json({ repo: newRepo }, { status: 201 });
  } catch (error) {
    console.error("Error creating repo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
