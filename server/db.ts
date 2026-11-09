import { Pool, type PoolClient } from "pg";
import { isSealed, open } from "./crypto";
import { encryptOldRows } from "./encryptData";
import { DIWAN_SCHEMA } from "./schema";

/* The database. Accounts, their sign-in sessions and every store's saved data live here, so a merchant can close the
   site, come back days later (on any device) and carry on. The tables are made on the first request, so a new server
   needs nothing but DATABASE_URL and DUKKAN_DATA_KEY (docker-compose.yml passes both). Every query passes user input as
   parameters ($1, $2), never joined into the SQL (docs/security-checklist.md).

   Private values are stored encrypted (server/crypto.ts): the code that writes them seals them, and every answer that
   comes back from the database is opened here, in one place, so no page can forget to. Emails and mobiles are found
   and kept unique by their fingerprints (email_hash, phone_hash), never by the value itself. */

const SCHEMA = `
  SELECT pg_advisory_xact_lock(71001);
  CREATE TABLE IF NOT EXISTS accounts (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
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

/* ---------------- opening encrypted values on the way out ---------------- */

/* Walks an answer (rows, and the JSON in them) and opens every sealed text */
function openDeep(v: unknown, depth = 0): unknown {
  if (depth > 8 || v == null) return v;
  if (typeof v === "string") return isSealed(v) ? open(v) : v;
  if (typeof v !== "object" || v instanceof Date || Buffer.isBuffer(v)) return v;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) v[i] = openDeep(v[i], depth + 1);
    return v;
  }
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) o[k] = openDeep(o[k], depth + 1);
  return v;
}

type Queryable = { query: (...args: any[]) => any; __opened?: boolean };

/* query() answers come back with their private values opened (promise style, the only style this app uses) */
function openAnswers(q: Queryable) {
  if (q.__opened) return;
  q.__opened = true;
  const raw = q.query.bind(q);
  q.query = ((...args: any[]) => {
    const r = raw(...args);
    return r && typeof r.then === "function" ? r.then((res: { rows?: unknown[] }) => (res && Array.isArray(res.rows) && openDeep(res.rows), res)) : r;
  }) as Queryable["query"];
}

/* one pool for the whole server (kept on globalThis so the dev server's reloads don't open new ones) */
const g = globalThis as unknown as { dukkanPool?: Pool; dukkanReady?: Promise<void> };
const pool = (g.dukkanPool ??= (() => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  openAnswers(p as unknown as Queryable);
  /* clients taken for a transaction open their answers too (pg itself calls connect with a callback) */
  const connect = p.connect.bind(p) as (cb?: (err: Error | undefined, c: PoolClient | undefined, done: unknown) => void) => Promise<PoolClient> | void;
  (p as unknown as { connect: unknown }).connect = (cb?: (err: Error | undefined, c: PoolClient | undefined, done: unknown) => void) => {
    if (typeof cb === "function")
      return connect((err, c, done) => {
        if (c) openAnswers(c as unknown as Queryable);
        cb(err, c, done);
      });
    return (connect() as Promise<PoolClient>).then((c) => (openAnswers(c as unknown as Queryable), c));
  };
  return p;
})());

/** The pool, once the tables exist and older plain rows are encrypted */
export async function db(): Promise<Pool> {
  g.dukkanReady ??= pool.query(SCHEMA).then(() => encryptOldRows(pool));
  try {
    await g.dukkanReady;
  } catch (e) {
    /* the database was not reachable (or the key is missing): try again on the next request */
    g.dukkanReady = undefined;
    throw e;
  }
  return pool;
}
