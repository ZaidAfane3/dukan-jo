import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "./db";

/* Passwords, sessions and the checks every account request goes through (docs/security-checklist.md, section 5). */

export type PublicAccount = { email: string; name: string; phone: string };

/* ---------------- passwords ---------------- */

/* scrypt, built into Node: slow on purpose, with its own random salt per password. Saved as scrypt$N$r$p$salt$hash. */
const N = 2 ** 15, R = 8, P = 1, LEN = 64;
const MAXMEM = 128 * N * R * 2;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, LEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password: string, saved: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = saved.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ---------------- sessions ---------------- */

/* The browser holds a random token in an http-only cookie; the database keeps only its SHA-256, so a leaked
   database can't be used to sign in. A session lasts 60 days and is renewed while it is used. */
const COOKIE = "dukkan-session";
const DAYS = 60;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

const isHttps = (req: NextRequest) => (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")) === "https";
const cookieOptions = (req: NextRequest, maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: isHttps(req), path: "/", maxAge });

/* opts.minutes: a shorter session (waiting for a 2-step code); opts.pendingTotp: the password was right, the code is
   still to come */
export async function startSession(
  res: NextResponse,
  req: NextRequest,
  accountId: string,
  opts: { minutes?: number; pendingTotp?: boolean } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  const minutes = opts.minutes ?? DAYS * 1440;
  await pool.query(
    `INSERT INTO sessions (token_hash, account_id, expires_at, pending_totp) VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
    [tokenHash(token), accountId, minutes, !!opts.pendingTotp],
  );
  /* now and then, clear out the sessions that have run out */
  if (Math.random() < 0.05) pool.query(`DELETE FROM sessions WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(COOKIE, token, cookieOptions(req, minutes * 60));
}

export async function endSession(res: NextResponse, req: NextRequest): Promise<void> {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) await (await db()).query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash(token)]);
  res.cookies.set(COOKIE, "", cookieOptions(req, 0));
}

/* suspended: never true any more, since a merchant's own session of a suspended shop counts as none (it was only true in
   a staff member's "log in as merchant" session, removed on 2026-11-16). */
export type SessionAccount = PublicAccount & { id: string; totpOn: boolean; suspended: boolean };

/* The session behind the cookie, whatever its state. A merchant session of a suspended shop counts as none, and so does
   a session left from a staff member's "log in as merchant" (removed on 2026-11-16), so one of those can never act as
   the merchant's own. */
async function sessionRow(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.phone, a.totp_on, s.pending_totp,
            s.expires_at < now() + make_interval(days => $2) AS stale,
            COALESCE(sh.status = 'suspended', false) AS suspended
       FROM sessions s JOIN accounts a ON a.id = s.account_id
       LEFT JOIN shops sh ON sh.account_id = a.id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.impersonation_id IS NULL`,
    [tokenHash(token), DAYS - 1],
  );
  const a = rows[0];
  if (!a) return null;
  if (a.suspended) return null;
  return { a, token, pool };
}

/** The account signed in on this request (its id and what the pages may show), or null. A session still waiting for
    its 2-step code is not signed in yet. */
export async function currentAccount(req: NextRequest): Promise<SessionAccount | null> {
  const r = await sessionRow(req);
  if (!r || r.a.pending_totp) return null;
  const { a, token, pool } = r;
  /* used again: the session runs for another 60 days, and so does the cookie (see renewCookie) */
  if (a.stale) pool.query(`UPDATE sessions SET expires_at = now() + make_interval(days => $2) WHERE token_hash = $1`, [tokenHash(token), DAYS]).catch(() => {});
  return {
    id: String(a.id),
    email: a.email,
    name: a.name,
    phone: a.phone,
    totpOn: a.totp_on,
    suspended: a.suspended,
  };
}

/** What a suspended store is told: the reason staff wrote in Diwan and since when. Only ever given to someone who proved
    they own the account (the right password, or a session they signed in with). */
export const suspendedReply = (reason: string | null, at: Date | string | null) => ({
  result: "suspended" as const,
  reason: reason ?? "",
  since: at ? new Date(at).toISOString() : null,
});

/** For a merchant whose store was suspended while they were signed in: the suspension behind this browser's session,
    or null. Suspending keeps the merchant's own sessions (they count as signed out, see sessionRow) so an open tab can
    still be told why; reactivating deletes them, so the merchant signs in again. Never a session still waiting for its
    2-step code (nor one left from the removed "log in as merchant"). */
export async function sessionSuspension(req: NextRequest): Promise<ReturnType<typeof suspendedReply> | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { rows } = await (await db()).query(
    `SELECT sh.suspend_reason, sh.suspended_at
       FROM sessions s JOIN shops sh ON sh.account_id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.impersonation_id IS NULL AND NOT s.pending_totp AND sh.status = 'suspended'`,
    [tokenHash(token)],
  );
  return rows[0] ? suspendedReply(rows[0].suspend_reason, rows[0].suspended_at) : null;
}

/** The account whose password was right and whose session waits for the 2-step code, or null */
export async function pendingAccount(req: NextRequest): Promise<{ id: string; email: string; name: string; phone: string; secret: string } | null> {
  const r = await sessionRow(req);
  if (!r || !r.a.pending_totp) return null;
  const { rows } = await r.pool.query(`SELECT totp_secret FROM accounts WHERE id = $1 AND totp_on`, [r.a.id]);
  if (!rows[0]?.totp_secret) return null;
  return { id: String(r.a.id), email: r.a.email, name: r.a.name, phone: r.a.phone, secret: rows[0].totp_secret };
}

/** The code was right: the waiting session becomes a full one (60 days), and the cookie with it */
export async function finishPendingSession(res: NextResponse, req: NextRequest): Promise<void> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return;
  await (await db()).query(`UPDATE sessions SET pending_totp = false, expires_at = now() + make_interval(days => $2) WHERE token_hash = $1`, [tokenHash(token), DAYS]);
  res.cookies.set(COOKIE, token, cookieOptions(req, DAYS * 86400));
}

/** Notes a full sign-in (for Diwan: when, and how many times) */
export async function noteLogin(accountId: string): Promise<void> {
  await (await db()).query(`UPDATE accounts SET last_login_at = now(), login_count = login_count + 1 WHERE id = $1`, [accountId]);
}

/** Gives the session cookie another 60 days, to match the database */
export function renewCookie(res: NextResponse, req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) res.cookies.set(COOKIE, token, cookieOptions(req, DAYS * 86400));
}

/* ---------------- request checks ---------------- */

/** Requests that change something must come from Dukkan's own pages (against cross-site requests, CSRF) */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* A simple limit per visitor: at most `max` tries in `minutes`. Kept in memory, which is enough for one server. */
const tries = new Map<string, { n: number; until: number }>();
export function tooMany(req: NextRequest, what: string, max: number, minutes: number): boolean {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${what}:${ip}`;
  const now = Date.now();
  if (tries.size > 10_000) tries.forEach((v, k) => v.until < now && tries.delete(k));
  const t = tries.get(key);
  if (!t || t.until < now) {
    tries.set(key, { n: 1, until: now + minutes * 60_000 });
    return false;
  }
  t.n++;
  return t.n > max;
}

/** Reads a JSON object body of at most `max` characters, or null */
export async function readJson(req: NextRequest, max: number): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  const text = await req.text();
  if (text.length > max) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export const answer = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Wraps a route so a database that is down gives a clear 503 instead of a crash */
export function guarded(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      return await fn(req);
    } catch (e) {
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return answer({ result: "error" }, 503);
    }
  };
}
