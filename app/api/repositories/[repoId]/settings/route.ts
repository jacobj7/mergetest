import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { pool } from "@/lib/db";

const settingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isPrivate: z.boolean().optional(),
  defaultBranch: z.string().min(1).max(255).optional(),
  allowForking: z.boolean().optional(),
  allowIssues: z.boolean().optional(),
  allowWiki: z.boolean().optional(),
  allowProjects: z.boolean().optional(),
  allowMergeCommit: z.boolean().optional(),
  allowSquashMerge: z.boolean().optional(),
  allowRebaseMerge: z.boolean().optional(),
  deleteBranchOnMerge: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repoId = params.repoId;

    if (!repoId || isNaN(parseInt(repoId))) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 },
      );
    }

    const repoIdNum = parseInt(repoId);

    const body = await request.json();
    const validationResult = settingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const repoCheck = await client.query(
        `SELECT r.id, r.owner_id, r.org_id, r.name, r.archived
         FROM repositories r
         WHERE r.id = $1`,
        [repoIdNum],
      );

      if (repoCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      const repo = repoCheck.rows[0];

      let hasPermission = false;

      if (repo.owner_id === session.user.id) {
        hasPermission = true;
      } else if (repo.org_id) {
        const orgMemberCheck = await client.query(
          `SELECT om.role
           FROM organization_members om
           WHERE om.org_id = $1 AND om.user_id = $2 AND om.role IN ('owner', 'admin')`,
          [repo.org_id, session.user.id],
        );

        if (orgMemberCheck.rows.length > 0) {
          hasPermission = true;
        }
      }

      if (!hasPermission) {
        const collaboratorCheck = await client.query(
          `SELECT rc.permission
           FROM repository_collaborators rc
           WHERE rc.repo_id = $1 AND rc.user_id = $2 AND rc.permission = 'admin'`,
          [repoIdNum, session.user.id],
        );

        if (collaboratorCheck.rows.length > 0) {
          hasPermission = true;
        }
      }

      if (!hasPermission) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 },
        );
      }

      const setClauses: string[] = [];
      const values: (string | boolean | number)[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        const nameCheck = await client.query(
          `SELECT id FROM repositories
           WHERE name = $1 AND owner_id = $2 AND id != $3`,
          [data.name, repo.owner_id, repoIdNum],
        );

        if (nameCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Repository name already exists for this owner" },
            { status: 409 },
          );
        }

        setClauses.push(`name = $${paramIndex}`);
        values.push(data.name);
        paramIndex++;
      }

      if (data.description !== undefined) {
        setClauses.push(`description = $${paramIndex}`);
        values.push(data.description);
        paramIndex++;
      }

      if (data.isPrivate !== undefined) {
        setClauses.push(`is_private = $${paramIndex}`);
        values.push(data.isPrivate);
        paramIndex++;
      }

      if (data.defaultBranch !== undefined) {
        setClauses.push(`default_branch = $${paramIndex}`);
        values.push(data.defaultBranch);
        paramIndex++;
      }

      if (data.allowForking !== undefined) {
        setClauses.push(`allow_forking = $${paramIndex}`);
        values.push(data.allowForking);
        paramIndex++;
      }

      if (data.allowIssues !== undefined) {
        setClauses.push(`allow_issues = $${paramIndex}`);
        values.push(data.allowIssues);
        paramIndex++;
      }

      if (data.allowWiki !== undefined) {
        setClauses.push(`allow_wiki = $${paramIndex}`);
        values.push(data.allowWiki);
        paramIndex++;
      }

      if (data.allowProjects !== undefined) {
        setClauses.push(`allow_projects = $${paramIndex}`);
        values.push(data.allowProjects);
        paramIndex++;
      }

      if (data.allowMergeCommit !== undefined) {
        setClauses.push(`allow_merge_commit = $${paramIndex}`);
        values.push(data.allowMergeCommit);
        paramIndex++;
      }

      if (data.allowSquashMerge !== undefined) {
        setClauses.push(`allow_squash_merge = $${paramIndex}`);
        values.push(data.allowSquashMerge);
        paramIndex++;
      }

      if (data.allowRebaseMerge !== undefined) {
        setClauses.push(`allow_rebase_merge = $${paramIndex}`);
        values.push(data.allowRebaseMerge);
        paramIndex++;
      }

      if (data.deleteBranchOnMerge !== undefined) {
        setClauses.push(`delete_branch_on_merge = $${paramIndex}`);
        values.push(data.deleteBranchOnMerge);
        paramIndex++;
      }

      if (data.archived !== undefined) {
        setClauses.push(`archived = $${paramIndex}`);
        values.push(data.archived);
        paramIndex++;
      }

      setClauses.push(`updated_at = NOW()`);

      values.push(repoIdNum);

      const updateQuery = `
        UPDATE repositories
        SET ${setClauses.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING
          id,
          name,
          description,
          is_private,
          default_branch,
          allow_forking,
          allow_issues,
          allow_wiki,
          allow_projects,
          allow_merge_commit,
          allow_squash_merge,
          allow_rebase_merge,
          delete_branch_on_merge,
          archived,
          owner_id,
          org_id,
          created_at,
          updated_at
      `;

      const updateResult = await client.query(updateQuery, values);

      if (updateResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Failed to update repository" },
          { status: 500 },
        );
      }

      await client.query("COMMIT");

      const updatedRepo = updateResult.rows[0];

      return NextResponse.json({
        id: updatedRepo.id,
        name: updatedRepo.name,
        description: updatedRepo.description,
        isPrivate: updatedRepo.is_private,
        defaultBranch: updatedRepo.default_branch,
        allowForking: updatedRepo.allow_forking,
        allowIssues: updatedRepo.allow_issues,
        allowWiki: updatedRepo.allow_wiki,
        allowProjects: updatedRepo.allow_projects,
        allowMergeCommit: updatedRepo.allow_merge_commit,
        allowSquashMerge: updatedRepo.allow_squash_merge,
        allowRebaseMerge: updatedRepo.allow_rebase_merge,
        deleteBranchOnMerge: updatedRepo.delete_branch_on_merge,
        archived: updatedRepo.archived,
        ownerId: updatedRepo.owner_id,
        orgId: updatedRepo.org_id,
        createdAt: updatedRepo.created_at,
        updatedAt: updatedRepo.updated_at,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
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

export async function GET(
  request: NextRequest,
  { params }: { params: { repoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repoId = params.repoId;

    if (!repoId || isNaN(parseInt(repoId))) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 },
      );
    }

    const repoIdNum = parseInt(repoId);

    const client = await pool.connect();

    try {
      const repoResult = await client.query(
        `SELECT
          r.id,
          r.name,
          r.description,
          r.is_private,
          r.default_branch,
          r.allow_forking,
          r.allow_issues,
          r.allow_wiki,
          r.allow_projects,
          r.allow_merge_commit,
          r.allow_squash_merge,
          r.allow_rebase_merge,
          r.delete_branch_on_merge,
          r.archived,
          r.owner_id,
          r.org_id,
          r.created_at,
          r.updated_at
         FROM repositories r
         WHERE r.id = $1`,
        [repoIdNum],
      );

      if (repoResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      const repo = repoResult.rows[0];

      let hasAccess = false;

      if (repo.owner_id === session.user.id) {
        hasAccess = true;
      } else if (!repo.is_private) {
        hasAccess = true;
      } else if (repo.org_id) {
        const orgMemberCheck = await client.query(
          `SELECT om.role
           FROM organization_members om
           WHERE om.org_id = $1 AND om.user_id = $2`,
          [repo.org_id, session.user.id],
        );

        if (orgMemberCheck.rows.length > 0) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        const collaboratorCheck = await client.query(
          `SELECT rc.permission
           FROM repository_collaborators rc
           WHERE rc.repo_id = $1 AND rc.user_id = $2`,
          [repoIdNum, session.user.id],
        );

        if (collaboratorCheck.rows.length > 0) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden: insufficient permissions" },
          { status: 403 },
        );
      }

      return NextResponse.json({
        id: repo.id,
        name: repo.name,
        description: repo.description,
        isPrivate: repo.is_private,
        defaultBranch: repo.default_branch,
        allowForking: repo.allow_forking,
        allowIssues: repo.allow_issues,
        allowWiki: repo.allow_wiki,
        allowProjects: repo.allow_projects,
        allowMergeCommit: repo.allow_merge_commit,
        allowSquashMerge: repo.allow_squash_merge,
        allowRebaseMerge: repo.allow_rebase_merge,
        deleteBranchOnMerge: repo.delete_branch_on_merge,
        archived: repo.archived,
        ownerId: repo.owner_id,
        orgId: repo.org_id,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching repository settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
