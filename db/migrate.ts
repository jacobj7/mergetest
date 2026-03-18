import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        github_org_id BIGINT NOT NULL UNIQUE,
        login VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        github_user_id BIGINT NOT NULL UNIQUE,
        login VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        email VARCHAR(255),
        avatar_url TEXT,
        org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        access_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS repos (
        id SERIAL PRIMARY KEY,
        github_repo_id BIGINT NOT NULL UNIQUE,
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        full_name VARCHAR(511) NOT NULL UNIQUE,
        webhook_id BIGINT,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pull_requests (
        id SERIAL PRIMARY KEY,
        github_pr_id BIGINT NOT NULL,
        repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        author VARCHAR(255) NOT NULL,
        base_branch VARCHAR(255) NOT NULL,
        head_branch VARCHAR(255) NOT NULL,
        head_sha VARCHAR(255) NOT NULL,
        diff_url TEXT,
        state VARCHAR(50) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(repo_id, number)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pr_analyses (
        id SERIAL PRIMARY KEY,
        pr_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
        risk_score NUMERIC(5, 2),
        risk_level VARCHAR(50),
        summary TEXT,
        findings JSONB,
        recommendations JSONB,
        raw_response TEXT,
        analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id SERIAL PRIMARY KEY,
        pr_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolling back:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
