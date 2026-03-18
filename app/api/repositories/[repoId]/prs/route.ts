import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repoId = params.repoId;
    if (!repoId) {
      return NextResponse.json(
        { error: "Repository ID is required" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = querySchema.safeParse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryParams.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { page, limit } = queryParams.data;
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      const repoCheck = await client.query(
        "SELECT id FROM repositories WHERE id = $1",
        [repoId],
      );

      if (repoCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      const countResult = await client.query(
        "SELECT COUNT(*) as total FROM pr_analyses WHERE repository_id = $1",
        [repoId],
      );

      const total = parseInt(countResult.rows[0].total, 10);

      const result = await client.query(
        `SELECT
          id,
          merge_score,
          pr_number,
          pr_title,
          status,
          created_at
        FROM pr_analyses
        WHERE repository_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [repoId, limit, offset],
      );

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching PR analyses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
