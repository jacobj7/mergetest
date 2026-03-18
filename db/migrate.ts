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
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        github_user_id BIGINT NOT NULL UNIQUE,
        email VARCHAR(255),
        name VARCHAR(255),
        avatar_url TEXT,
        access_token TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        owner_github_user_id BIGINT,
        github_repo_id BIGINT NOT NULL UNIQUE,
        full_name VARCHAR(512) NOT NULL,
        name VARCHAR(255) NOT NULL,
        score_threshold NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
        webhook_secret TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pr_analyses (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        pr_number INTEGER NOT NULL,
        pr_title TEXT,
        sha VARCHAR(40) NOT NULL,
        merge_score NUMERIC(5, 2),
        untested_paths JSONB,
        test_suggestions TEXT,
        raw_llm_response TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pr_analyses_repository_id ON pr_analyses(repository_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pr_analyses_repository_pr ON pr_analyses(repository_id, pr_number)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        pr_number INTEGER NOT NULL,
        sha VARCHAR(40) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_id ON analysis_jobs(repository_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status)
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_pr_analyses_updated_at ON pr_analyses
    `);

    await client.query(`
      CREATE TRIGGER update_pr_analyses_updated_at
        BEFORE UPDATE ON pr_analyses
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_analysis_jobs_updated_at ON analysis_jobs
    `);

    await client.query(`
      CREATE TRIGGER update_analysis_jobs_updated_at
        BEFORE UPDATE ON analysis_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolling back:", error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error("Unhandled migration error:", error);
  process.exit(1);
});
