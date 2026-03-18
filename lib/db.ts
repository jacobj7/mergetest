import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === "development") {
      console.log("Executed query", {
        text,
        duration,
        rowCount: result.rowCount,
      });
    }
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
