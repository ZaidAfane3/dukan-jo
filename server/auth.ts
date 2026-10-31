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

export async function startSession(res: NextResponse, req: NextRequest, accountId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  await pool.query(`INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [tokenHash(token), accountId, DAYS]);
  /* now and then, clear out the sessions that have run out */
  if (Math.random() < 0.05) pool.query(`DELETE FROM sessions WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(COOKIE, token, cookieOptions(req, DAYS * 86400));
}

export async function endSession(res: NextResponse, req: NextRequest): Promise<void> {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) await (await db()).query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash(token)]);
  res.cookies.set(COOKIE, "", cookieOptions(req, 0));
}

/** The account signed in on this request (its id and what the pages may show), or null */
export async function currentAccount(req: NextRequest): Promise<(PublicAccount & { id: string }) | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.phone, s.expires_at < now() + make_interval(days => $2) AS stale
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token), DAYS - 1],
  );
  const a = rows[0];
  if (!a) return null;
  /* used again: the session runs for another 60 days, and so does the cookie (see renewCookie) */
  if (a.stale) pool.query(`UPDATE sessions SET expires_at = now() + make_interval(days => $2) WHERE token_hash = $1`, [tokenHash(token), DAYS]).catch(() => {});
  return { id: String(a.id), email: a.email, name: a.name, phone: a.phone };
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
