import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createRepositorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  url: z.string().url(),
  isPrivate: z.boolean().default(false),
});

const updateRepositorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  isPrivate: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      let query: string;
      let params: (string | number)[];

      if (search) {
        query = `
          SELECT id, name, description, url, is_private, created_at, updated_at
          FROM repositories
          WHERE user_id = $1 AND (name ILIKE $2 OR description ILIKE $2)
          ORDER BY created_at DESC
          LIMIT $3 OFFSET $4
        `;
        params = [userId, `%${search}%`, limit, offset];
      } else {
        query = `
          SELECT id, name, description, url, is_private, created_at, updated_at
          FROM repositories
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [userId, limit, offset];
      }

      const result = await client.query(query, params);

      let countQuery: string;
      let countParams: (string | number)[];

      if (search) {
        countQuery = `
          SELECT COUNT(*) FROM repositories
          WHERE user_id = $1 AND (name ILIKE $2 OR description ILIKE $2)
        `;
        countParams = [userId, `%${search}%`];
      } else {
        countQuery = `
          SELECT COUNT(*) FROM repositories
          WHERE user_id = $1
        `;
        countParams = [userId];
      }

      const countResult = await client.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      const repositories = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        url: row.url,
        isPrivate: row.is_private,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return NextResponse.json({
        repositories,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const body = await request.json();
    const validationResult = createRepositorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.errors },
        { status: 400 },
      );
    }

    const { name, description, url, isPrivate } = validationResult.data;

    const client = await pool.connect();
    try {
      const existingRepo = await client.query(
        "SELECT id FROM repositories WHERE user_id = $1 AND name = $2",
        [userId, name],
      );

      if (existingRepo.rows.length > 0) {
        return NextResponse.json(
          { error: "Repository with this name already exists" },
          { status: 409 },
        );
      }

      const result = await client.query(
        `INSERT INTO repositories (user_id, name, description, url, is_private, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, name, description, url, is_private, created_at, updated_at`,
        [userId, name, description || null, url, isPrivate],
      );

      const repository = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        url: result.rows[0].url,
        isPrivate: result.rows[0].is_private,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      return NextResponse.json({ repository }, { status: 201 });
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const body = await request.json();
    const validationResult = updateRepositorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.errors },
        { status: 400 },
      );
    }

    const { id, name, description, url, isPrivate } = validationResult.data;

    const client = await pool.connect();
    try {
      const existingRepo = await client.query(
        "SELECT id FROM repositories WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      if (existingRepo.rows.length === 0) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      if (name) {
        const duplicateRepo = await client.query(
          "SELECT id FROM repositories WHERE user_id = $1 AND name = $2 AND id != $3",
          [userId, name, id],
        );

        if (duplicateRepo.rows.length > 0) {
          return NextResponse.json(
            { error: "Repository with this name already exists" },
            { status: 409 },
          );
        }
      }

      const updates: string[] = [];
      const params: (string | number | boolean | null)[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(description);
      }
      if (url !== undefined) {
        updates.push(`url = $${paramIndex++}`);
        params.push(url);
      }
      if (isPrivate !== undefined) {
        updates.push(`is_private = $${paramIndex++}`);
        params.push(isPrivate);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 },
        );
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);
      params.push(userId);

      const result = await client.query(
        `UPDATE repositories
         SET ${updates.join(", ")}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING id, name, description, url, is_private, created_at, updated_at`,
        params,
      );

      const repository = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        url: result.rows[0].url,
        isPrivate: result.rows[0].is_private,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      return NextResponse.json({ repository });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating repository:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json(
        { error: "Repository ID is required" },
        { status: 400 },
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      const existingRepo = await client.query(
        "SELECT id FROM repositories WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      if (existingRepo.rows.length === 0) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 },
        );
      }

      await client.query(
        "DELETE FROM repositories WHERE id = $1 AND user_id = $2",
        [id, userId],
      );

      return NextResponse.json({ message: "Repository deleted successfully" });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error deleting repository:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
