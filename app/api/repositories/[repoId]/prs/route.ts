import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { pool } from "@/lib/db";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoId = parseInt(params.repoId, 10);
  if (isNaN(repoId)) {
    return NextResponse.json(
      { error: "Invalid repository ID" },
      { status: 400 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const queryResult = querySchema.safeParse({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    status: searchParams.get("status"),
  });

  if (!queryResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: queryResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { page, limit, status } = queryResult.data;
  const offset = (page - 1) * limit;

  const client = await pool.connect();
  try {
    const repoCheck = await client.query(
      "SELECT id FROM repositories WHERE id = $1 AND user_id = $2",
      [repoId, session.user.id],
    );

    if (repoCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 },
      );
    }

    let countQuery =
      "SELECT COUNT(*) FROM pull_request_analyses WHERE repository_id = $1";
    let dataQuery =
      "SELECT id, pr_number, pr_title, status, created_at, updated_at FROM pull_request_analyses WHERE repository_id = $1";
    const queryParams: (string | number)[] = [repoId];

    if (status) {
      queryParams.push(status);
      const statusParam = `$${queryParams.length}`;
      countQuery += ` AND status = ${statusParam}`;
      dataQuery += ` AND status = ${statusParam}`;
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;

    const [countResult, dataResult] = await Promise.all([
      client.query(countQuery, queryParams),
      client.query(dataQuery, [...queryParams, limit, offset]),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching PR analyses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
