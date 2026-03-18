import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

const createRepoSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  webhook_id: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userResult = await query("SELECT org_id FROM users WHERE id = $1", [
      session.user.id,
    ]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const orgId = userResult.rows[0].org_id;

    const reposResult = await query(
      "SELECT * FROM repos WHERE org_id = $1 ORDER BY created_at DESC",
      [orgId],
    );

    return NextResponse.json({ repos: reposResult.rows });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRepoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { owner, name, webhook_id } = parsed.data;

  try {
    const userResult = await query("SELECT org_id FROM users WHERE id = $1", [
      session.user.id,
    ]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const orgId = userResult.rows[0].org_id;

    // Fetch repository details from GitHub API to obtain github_repo_id
    const githubToken = session.user.githubAccessToken;
    const githubApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

    const githubHeaders: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (githubToken) {
      githubHeaders["Authorization"] = `Bearer ${githubToken}`;
    }

    const githubResponse = await fetch(githubApiUrl, {
      headers: githubHeaders,
    });

    if (!githubResponse.ok) {
      if (githubResponse.status === 404) {
        return NextResponse.json(
          { error: "Repository not found on GitHub" },
          { status: 404 },
        );
      }
      if (githubResponse.status === 403 || githubResponse.status === 401) {
        return NextResponse.json(
          { error: "GitHub API access denied" },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch repository details from GitHub" },
        { status: 502 },
      );
    }

    const githubRepo = await githubResponse.json();
    const githubRepoId: number = githubRepo.id;

    if (!githubRepoId) {
      return NextResponse.json(
        { error: "Could not retrieve github_repo_id from GitHub API" },
        { status: 502 },
      );
    }

    // Check for duplicate
    const existingRepo = await query(
      "SELECT id FROM repos WHERE github_repo_id = $1",
      [githubRepoId],
    );

    if (existingRepo.rows.length > 0) {
      return NextResponse.json(
        { error: "Repository already exists" },
        { status: 409 },
      );
    }

    const insertResult = await query(
      `INSERT INTO repos (owner, name, github_repo_id, webhook_id, org_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [owner, name, githubRepoId, webhook_id ?? null, orgId],
    );

    return NextResponse.json({ repo: insertResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating repo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
