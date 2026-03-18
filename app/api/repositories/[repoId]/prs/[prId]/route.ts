import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const paramsSchema = z.object({
  repoId: z.string().min(1),
  prId: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string; prId: string } },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { repoId, prId } = parsed.data;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
          pa.id,
          pa.repository_id,
          pa.pr_number,
          pa.pr_title,
          pa.pr_url,
          pa.author,
          pa.base_branch,
          pa.head_branch,
          pa.status,
          pa.merge_score,
          pa.untested_paths,
          pa.test_suggestions,
          pa.summary,
          pa.files_changed,
          pa.additions,
          pa.deletions,
          pa.created_at,
          pa.updated_at
        FROM pr_analysis pa
        INNER JOIN repositories r ON r.id = pa.repository_id
        WHERE pa.id = $1
          AND pa.repository_id = $2
          AND r.owner_email = $3`,
        [prId, repoId, session.user.email],
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "PR analysis not found" },
          { status: 404 },
        );
      }

      const prAnalysis = result.rows[0];

      return NextResponse.json({
        data: {
          id: prAnalysis.id,
          repositoryId: prAnalysis.repository_id,
          prNumber: prAnalysis.pr_number,
          prTitle: prAnalysis.pr_title,
          prUrl: prAnalysis.pr_url,
          author: prAnalysis.author,
          baseBranch: prAnalysis.base_branch,
          headBranch: prAnalysis.head_branch,
          status: prAnalysis.status,
          mergeScore: prAnalysis.merge_score,
          untestedPaths: prAnalysis.untested_paths,
          testSuggestions: prAnalysis.test_suggestions,
          summary: prAnalysis.summary,
          filesChanged: prAnalysis.files_changed,
          additions: prAnalysis.additions,
          deletions: prAnalysis.deletions,
          createdAt: prAnalysis.created_at,
          updatedAt: prAnalysis.updated_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching PR analysis:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
