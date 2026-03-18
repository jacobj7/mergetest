import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Pool } from "pg";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const paramsSchema = z.object({
  repoId: z.string().regex(/^\d+$/).transform(Number),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = paramsSchema.safeParse({ repoId: params.repoId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid repository ID", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repoId } = parsed.data;

    const userId = (session.user as { id?: string | number }).id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 },
      );
    }

    const ownerCheck = await pool.query(
      `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
      [repoId, userId],
    );

    if (ownerCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "Repository not found or access denied" },
        { status: 404 },
      );
    }

    const result = await pool.query(
      `
      SELECT
        DATE(analyzed_at) AS date,
        ROUND(AVG(score)::numeric, 2) AS average_score,
        COUNT(*) AS pr_count
      FROM pr_analyses
      WHERE
        repository_id = $1
        AND analyzed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(analyzed_at)
      ORDER BY DATE(analyzed_at) ASC
      `,
      [repoId],
    );

    const stats = result.rows.map((row) => ({
      date:
        row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : String(row.date),
      averageScore: parseFloat(row.average_score),
      prCount: parseInt(row.pr_count, 10),
    }));

    const allDates: {
      date: string;
      averageScore: number | null;
      prCount: number;
    }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = stats.find((s) => s.date === dateStr);
      allDates.push(
        found ? found : { date: dateStr, averageScore: null, prCount: 0 },
      );
    }

    return NextResponse.json({
      repositoryId: repoId,
      period: "30d",
      data: allDates,
    });
  } catch (error) {
    console.error("Error fetching repository stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
