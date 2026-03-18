import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createRepositorySchema = z.object({
  fullName: z
    .string()
    .min(1, "Repository full name is required")
    .regex(
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
      "Invalid repository format. Expected owner/repo",
    ),
  scoreThreshold: z
    .number()
    .min(0, "Score threshold must be at least 0")
    .max(100, "Score threshold must be at most 100")
    .default(70),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [session.user.email],
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userId = userResult.rows[0].id;

      const repositoriesResult = await client.query(
        `SELECT 
          id,
          full_name,
          score_threshold,
          webhook_secret,
          created_at,
          updated_at
        FROM repositories 
        WHERE user_id = $1 
        ORDER BY created_at DESC`,
        [userId],
      );

      const repositories = repositoriesResult.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        scoreThreshold: row.score_threshold,
        webhookSecret: row.webhook_secret,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return NextResponse.json({ repositories }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const validationResult = createRepositorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    const { fullName, scoreThreshold } = validationResult.data;

    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const client = await pool.connect();
    try {
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [session.user.email],
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userId = userResult.rows[0].id;

      const existingRepo = await client.query(
        "SELECT id FROM repositories WHERE user_id = $1 AND full_name = $2",
        [userId, fullName],
      );

      if (existingRepo.rows.length > 0) {
        return NextResponse.json(
          { error: "Repository already exists for this user" },
          { status: 409 },
        );
      }

      const insertResult = await client.query(
        `INSERT INTO repositories (user_id, full_name, score_threshold, webhook_secret, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, full_name, score_threshold, webhook_secret, created_at, updated_at`,
        [userId, fullName, scoreThreshold, webhookSecret],
      );

      const newRepository = insertResult.rows[0];

      const [owner, repo] = fullName.split("/");
      const appBaseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.APP_URL ||
        "https://your-app.com";
      const webhookUrl = `${appBaseUrl}/api/webhooks/github`;

      const repository = {
        id: newRepository.id,
        fullName: newRepository.full_name,
        scoreThreshold: newRepository.score_threshold,
        webhookSecret: newRepository.webhook_secret,
        createdAt: newRepository.created_at,
        updatedAt: newRepository.updated_at,
      };

      const webhookInstructions = {
        url: webhookUrl,
        secret: webhookSecret,
        contentType: "application/json",
        events: ["pull_request", "pull_request_review"],
        steps: [
          `Go to https://github.com/${owner}/${repo}/settings/hooks`,
          'Click "Add webhook"',
          `Set Payload URL to: ${webhookUrl}`,
          "Set Content type to: application/json",
          `Set Secret to: ${webhookSecret}`,
          'Select "Let me select individual events"',
          'Check "Pull requests" and "Pull request reviews"',
          'Click "Add webhook"',
        ],
      };

      return NextResponse.json(
        {
          repository,
          webhookInstructions,
        },
        { status: 201 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating repository:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
