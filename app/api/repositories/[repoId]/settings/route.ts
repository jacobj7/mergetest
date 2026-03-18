import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const settingsSchema = z.object({
  scoreThreshold: z.number().min(0).max(100),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  try {
    const session = await getServerSession();

    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repoId = params.repoId;

    if (!repoId) {
      return NextResponse.json(
        { error: "Repository ID is required" },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = settingsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const { scoreThreshold } = parseResult.data;

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

      const repoCheckResult = await client.query(
        "SELECT id, user_id FROM repositories WHERE id = $1",
        [repoId],
      );

      if (repoCheckResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      const repository = repoCheckResult.rows[0];

      if (repository.user_id !== userId) {
        return NextResponse.json(
          { error: "Forbidden: You do not own this repository" },
          { status: 403 },
        );
      }

      const updateResult = await client.query(
        `UPDATE repositories
         SET score_threshold = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, user_id, name, full_name, score_threshold, created_at, updated_at`,
        [scoreThreshold, repoId],
      );

      if (updateResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Failed to update repository" },
          { status: 500 },
        );
      }

      const updatedRepository = updateResult.rows[0];

      return NextResponse.json(
        { repository: updatedRepository },
        { status: 200 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating repository settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
