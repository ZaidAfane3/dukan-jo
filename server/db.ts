import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { isSealed, open, OPEN_DEPTH } from "./crypto";
import { ENCRYPT_PLAN, encryptOldRows } from "./encryptData";
import { cleanOldFiles, moveOldPictures } from "./media";
import { repairOrderItems } from "./orderItemsRepair";
import { DIWAN_SCHEMA } from "./schema";
import { recordSavedThemes } from "./themeOwnership";

/* The database. Accounts, their sign-in sessions and every store's saved data live here, so a merchant can close the
   site, come back days later (on any device) and carry on. The tables are made on the first request, so a new server
   needs nothing but DATABASE_URL and DUKKAN_DATA_KEY (docker-compose.yml passes both). Every query passes user input as
   parameters ($1, $2), never joined into the SQL (docs/security-checklist.md).

   Private values are stored encrypted (server/crypto.ts): the code that writes them seals them, and every answer that
   comes back from the database is opened here, in one place, so no page can forget to. Emails and mobiles are found
   and kept unique by their fingerprints (email_hash, phone_hash), never by the value itself. */

/* sent as one message, so it runs as one transaction: SET LOCAL lifts the pool's 30 s query limit for it only (a big
   database's first start can take longer) */
const SCHEMA = `
  SET LOCAL statement_timeout = 0;
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
  if (depth > OPEN_DEPTH || v == null) return v;
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

/* a query slower than this is written to the server log with the first words of its SQL (never its values: they are
   always parameters), so a slow page can be traced to its query */
const SLOW_QUERY_MS = 500;
const sqlOf = (a: unknown) => String(typeof a === "string" ? a : (a as { text?: unknown } | null)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 160);

/* query() answers come back with their private values opened (promise style, the only style this app uses) */
function openAnswers(q: Queryable) {
  if (q.__opened) return;
  q.__opened = true;
  const raw = q.query.bind(q);
  q.query = ((...args: any[]) => {
    const started = Date.now();
    const r = raw(...args);
    return r && typeof r.then === "function"
      ? r.then((res: { rows?: unknown[] }) => {
          const ms = Date.now() - started;
          if (ms > SLOW_QUERY_MS) console.warn(`[db] slow query ${ms}ms: ${sqlOf(args[0])}`);
          return res && Array.isArray(res.rows) && openDeep(res.rows), res;
        })
      : r;
  }) as Queryable["query"];
}

/* one pool for the whole server (kept on globalThis so the dev server's reloads don't open new ones). Nothing waits
   forever: a request that finds all 10 connections busy gives up after 10 s (the page says it can't load, rather than
   hanging), a query is stopped after 30 s, and a connection left inside a transaction is closed after 60 s so its
   locks are freed. The start-up setup below is the one thing allowed longer. */
const g = globalThis as unknown as { dukkanPool?: Pool; dukkanReady?: Promise<void> };
const pool = (g.dukkanPool ??= (() => {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
  });
  /* a connection waiting in the pool that the database drops (Postgres restarting, the network) must not crash the
     server: without a listener Node treats it as an uncaught error. The pool opens a new one when next asked. */
  p.on("error", (e) => console.error("[db] idle connection lost", e.message));
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

/* The tables and the sealing of older plain rows take locks and read whole tables, so they are done only when this
   database has not yet run this exact setup to the end: its fingerprint (the SQL above and what encryptData.ts seals) is
   kept in start_seeds once both succeeded. Any change to either runs them again, as before, on the next start. */
const SETUP_KEY = `setup:${createHash("sha256").update(SCHEMA).update(ENCRYPT_PLAN).digest("hex").slice(0, 32)}`;
async function setUp(): Promise<void> {
  /* a new database has no start_seeds table yet: that counts as "not done" */
  const done = await pool.query(`SELECT 1 FROM start_seeds WHERE key = $1`, [SETUP_KEY]).then((r: { rows: unknown[] }) => r.rows.length > 0, () => false);
  if (done) return;
  await pool.query(SCHEMA);
  await encryptOldRows(pool);
  await pool.query(`DELETE FROM start_seeds WHERE key LIKE 'setup:%' AND key <> $1`, [SETUP_KEY]);
  await pool.query(`INSERT INTO start_seeds (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [SETUP_KEY]);
}

/** The pool, once the tables exist and older plain rows are encrypted */
export async function db(): Promise<Pool> {
  g.dukkanReady ??= setUp()
    /* themes stores already hold get their purchase recorded, once (server/themeOwnership.ts): waited for, so no save
       is checked against the purchases before they are there. If it fails the site still starts, nothing about themes is
       held back meanwhile, and it runs again on the next start. */
    .then(() => recordSavedThemes(pool).then(() => undefined, (e) => console.error("[themes] recording saved themes", e)))
    /* pictures saved inside the stores' data before files existed become files (server/media.ts). In the background:
       requests don't wait for it, and a failure only means it runs again on the next start. */
    .then(() => void moveOldPictures(pool).catch((e) => console.error("[media] moving old pictures", e)))
    .then(() => void cleanOldFiles(pool).catch((e) => console.error("[media] cleaning old files", e)))
    /* store orders whose lines an undone cancel kept unprotected get them sealed, once (server/orderItemsRepair.ts). In
       the background too: a failure only means it runs again on the next start. */
    .then(() => void repairOrderItems(pool).catch((e) => console.error("[orders] repairing order lines", e)));
  try {
    await g.dukkanReady;
  } catch (e) {
    /* the database was not reachable (or the key is missing): try again on the next request */
    g.dukkanReady = undefined;
    throw e;
  }
  return pool;
}
