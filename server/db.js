import pg from "pg";
const { Pool } = pg;

// Return DATE columns as plain "YYYY-MM-DD" strings (avoids timezone shifts in JS Date).
pg.types.setTypeParser(1082, v => v);

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

// An idle client error must never crash the whole process.
pool.on("error", err => console.error("[DB POOL ERROR]", err.message));

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
    CREATE INDEX IF NOT EXISTS entries_user_kind_date ON entries(user_id, kind, entry_date DESC);
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS push_reminders_sent (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reminder_date DATE NOT NULL,
      reminder_time TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(user_id, reminder_date, reminder_time)
    );
  `);
}
