import pg from "pg";
const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Brak DATABASE_URL. Skonfiguruj PostgreSQL w Coolify i ustaw DATABASE_URL na adres bazy (host kontenera/usługi, nie localhost), np. postgresql://fitness:HASLO@postgres:5432/fitness."
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS entries (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('weight','waist','water','food','workout','note')),
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS entries_user_date_idx ON entries(user_id, entry_date DESC);
  `);
}
