import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_HOST } from "@/components/siteAddress";
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
   database can't be used to sign in. A session lasts 60 days and is renewed while it is used.
   ONE DEVICE AT A TIME: a merchant's account is signed in on one browser only, like a bank's site. A full sign-in
   (the password, and the 2-step code when it is on) takes the place of every other session of the account
   (onlyThisSession): the newest sign-in wins, so a merchant is never locked out by a device he no longer has. The
   other device is signed out at its next request, its saves are refused (401) so it can't write an older copy over
   newer work, and it is told why (sessionReplaced, /api/auth/me "elsewhere"). The tabs of one browser share the
   session; among them only one works at a time (components/oneTab.ts). */
const COOKIE = "dukkan-session";
const DAYS = 60;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Whether the session cookies are sent only over https (Secure). Always on the live server (the production build): it
    is reached by https only (http is sent on to https), so a request header, which a client could set, never decides
    it. Locally (next dev) only when the page itself is on https, so signing in over http://localhost still works. */
export const secureCookies = (req: NextRequest) => process.env.NODE_ENV === "production" || req.nextUrl.protocol === "https:";
const cookieOptions = (req: NextRequest, maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: secureCookies(req), path: "/", maxAge });

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
  /* a full sign-in is the account's only session from now on (a session still waiting for its code replaces nothing) */
  if (!opts.pendingTotp) await onlyThisSession(accountId, tokenHash(token));
  /* now and then, clear out the sessions that have run out, and those replaced more than a day ago */
  if (Math.random() < 0.05) pool.query(`DELETE FROM sessions WHERE expires_at < now() OR replaced_at < now() - interval '1 day'`).catch(() => {});
  res.cookies.set(COOKIE, token, cookieOptions(req, minutes * 60));
}

/* Every other session of the account ends: it is kept for a day, marked, so its browser can be told that the account
   was opened on another device (sessionReplaced), and counts as no session at all (sessionRow). */
async function onlyThisSession(accountId: string, keepHash: string): Promise<void> {
  await (await db()).query(`UPDATE sessions SET replaced_at = now() WHERE account_id = $1 AND token_hash <> $2 AND replaced_at IS NULL`, [accountId, keepHash]);
}

/** True when this browser's session ended because the account was signed in on another device since */
export async function sessionReplaced(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token.length > 100) return false;
  const { rows } = await (await db()).query(`SELECT 1 FROM sessions WHERE token_hash = $1 AND replaced_at IS NOT NULL`, [tokenHash(token)]);
  return rows.length > 0;
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
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.impersonation_id IS NULL AND s.replaced_at IS NULL`,
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
      WHERE s.token_hash = $1 AND s.expires_at > now() AND s.impersonation_id IS NULL AND NOT s.pending_totp AND s.replaced_at IS NULL AND sh.status = 'suspended'`,
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
  const { rows } = await (await db()).query(
    `UPDATE sessions SET pending_totp = false, expires_at = now() + make_interval(days => $2) WHERE token_hash = $1 AND replaced_at IS NULL RETURNING account_id`,
    [tokenHash(token), DAYS],
  );
  /* the sign-in is complete now: it is the account's only session (see ONE DEVICE AT A TIME) */
  if (rows[0]) await onlyThisSession(String(rows[0].account_id), tokenHash(token));
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

/** The header the dashboard sends with what it saves or loads for the store, naming the account it was signed in as
    (its email, URI-encoded; components/serverSync.ts ACCOUNT_HEADER). The cookie is the browser's, shared by its tabs,
    so a tab still open on the account signed in before could otherwise save that account's data under the new one. */
export const ACCOUNT_HEADER = "x-dukkan-account";

/** True when the request names another account than the session's (answer 409 { result: "other-account" }). Without
    the header (a tab opened before it existed) it is not refused. */
export function otherAccount(req: NextRequest, a: { id: string; email: string }): boolean {
  const h = req.headers.get(ACCOUNT_HEADER);
  if (h === null) return false;
  let named: string;
  try {
    named = decodeURIComponent(h).trim().toLowerCase();
  } catch {
    return true;
  }
  return named !== a.email.trim().toLowerCase() && named !== a.id;
}

/* a copy running on this computer */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Requests that change something must come from Dukkan's own pages (against cross-site requests, CSRF). The page's
    address (Origin, set by the browser) is compared with the site's own configured address (components/siteAddress.ts
    SITE_HOST, on https), never with the Host or X-Forwarded-Host headers, which a request can carry made up.
    Also accepted: a copy on this computer (a localhost page talking to a server reached at localhost, as in local
    development and a local production build), and, on the dev server only, any page on the same address as the server
    (a phone on the same network trying the dev server). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let page: URL;
  try {
    page = new URL(origin);
  } catch {
    return false;
  }
  if (page.protocol === "https:" && page.host === SITE_HOST) return true;
  const host = req.headers.get("host");
  if (LOCAL_HOST.test(page.host) && host && LOCAL_HOST.test(host)) return page.host === host;
  return process.env.NODE_ENV === "development" && !!host && page.host === host;
}

/* A simple limit per visitor: at most `max` tries in `minutes`. Kept in memory, which is enough for one server. */
const tries = new Map<string, { n: number; until: number }>();
/** The visitor's address, as the limits count it */
export const visitorIp = (req: NextRequest) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
export function tooMany(req: NextRequest, what: string, max: number, minutes: number): boolean {
  return tooManyFor(`${what}:${visitorIp(req)}`, max, minutes);
}

/** The same limit for anything else than a visitor, such as one store for all its visitors together: at most `max`
    tries for this key in `minutes` */
export function tooManyFor(key: string, max: number, minutes: number): boolean {
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

/* Wrong tries counted per account (or per anything else named by `key`), whatever address they come from: after `max`
   wrong tries in `minutes` the key waits. Only wrong tries count, and a right one clears them, so someone who knows the
   password is never slowed down by their own sign-ins. Kept in memory, like the limit above. */
const fails = new Map<string, { n: number; until: number }>();
/** True while this key has had too many wrong tries */
export function failedTooOften(key: string, max: number): boolean {
  const f = fails.get(key);
  return !!f && f.until > Date.now() && f.n >= max;
}
/** Notes one wrong try for this key */
export function noteFailure(key: string, minutes: number): void {
  const now = Date.now();
  if (fails.size > 10_000) fails.forEach((v, k) => v.until < now && fails.delete(k));
  const f = fails.get(key);
  if (!f || f.until < now) fails.set(key, { n: 1, until: now + minutes * 60_000 });
  else f.n++;
}
/** Forgets the wrong tries of this key (the right password was given), and those counted for it per address
    (signInTries) */
export function clearFailures(key: string): void {
  fails.delete(key);
  fails.forEach((_v, k) => k.startsWith(`${key}|`) && fails.delete(k));
}

/* Wrong passwords (or 2-step codes) at a sign-in. Someone who only knows a merchant's or a staff member's email or mobile
   must not be able to keep the real owner out by typing wrong passwords. So the wrong tries are counted twice:
   - per account AND address: after `max` of them in `minutes`, that address waits ("slow-down") for this account. The
     owner, on his own address, is not held back by tries from somewhere else.
   - per account, from every address together: never a refusal, only a wait before the password is checked that grows
     with the wrong tries (slowDown), so guessing from many addresses gets slow while the right password still always gets
     in. The wait comes before the check, for a right and a wrong password alike, so it gives nothing away.
   A try is counted (failed) right after the look (blocked) and before the password is checked, so tries sent all at
   once can't all pass the look while the first ones are still being checked, and the right password forgets them again (passed). A new password set by a reset
   forgets them from every address (clearFailures). `key` names the account, or
   for an email nobody has what was typed, so an unknown account waits the same way as a real one. */
export function signInTries(req: NextRequest, key: string, max: number, minutes: number) {
  const here = `${key}|${visitorIp(req)}`;
  return {
    /** True while this address has had too many wrong tries for this account */
    blocked: () => failedTooOften(here, max),
    /** The growing wait, after `failed`: none for the first five tries on the account since its last right one, then
        0.5 s, doubling, at most 8 s */
    slowDown: async () => {
      const f = fails.get(key);
      const n = f && f.until > Date.now() ? f.n : 0;
      if (n > 5) await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (n - 6), 8_000)));
    },
    /** Counts one try as wrong, for the account and for this address */
    failed: () => {
      noteFailure(key, minutes);
      noteFailure(here, minutes);
    },
    /** The right password (or code): the account's wrong tries are forgotten, and this address's. Another address
        that was guessing stays held back. */
    passed: () => {
      fails.delete(key);
      fails.delete(here);
    },
  };
}

/** Reads a JSON object body of at most `max` bytes, or null. The body is read piece by piece and dropped as soon as it
    is longer than `max`, so a huge body (sent without a Content-Length, or with a false one) is never held in memory. */
export async function readJson(req: NextRequest, max: number): Promise<Record<string, unknown> | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const text = Buffer.concat(parts).toString("utf8");
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
      /* text the database can't keep (a null character, broken Unicode) or an address that can't be read: the
         request is wrong, the server is fine */
      const code = (e as { code?: string })?.code;
      if (code === "22021" || code === "22P05" || e instanceof URIError) return answer({ result: "invalid" }, 400);
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return answer({ result: "error" }, 503);
    }
  };
}
