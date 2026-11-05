import { Pool } from "pg";
import { DIWAN_SCHEMA } from "./schema";

/* The database. Accounts, their sign-in sessions and every store's saved data live here, so a merchant can close the
   site, come back days later (on any device) and carry on. The tables are made on the first request, so a new server
   needs nothing but DATABASE_URL (docker-compose.yml sets it). Every query passes user input as parameters ($1, $2),
   never joined into the SQL (docs/security-checklist.md). */

const SCHEMA = `
  SELECT pg_advisory_xact_lock(71001);
  CREATE TABLE IF NOT EXISTS accounts (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone ON accounts (phone) WHERE phone <> '';
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);
  CREATE TABLE IF NOT EXISTS store_data (
    account_id BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, key)
  );
` + DIWAN_SCHEMA;

/* one pool for the whole server (kept on globalThis so the dev server's reloads don't open new ones) */
const g = globalThis as unknown as { dukkanPool?: Pool; dukkanReady?: Promise<void> };
const pool = (g.dukkanPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));

/** The pool, once the tables exist */
export async function db(): Promise<Pool> {
  g.dukkanReady ??= pool.query(SCHEMA).then(() => undefined);
  try {
    await g.dukkanReady;
  } catch (e) {
    /* the database was not reachable: try again on the next request */
    g.dukkanReady = undefined;
    throw e;
  }
  return pool;
}
