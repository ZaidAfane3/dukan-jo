import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { SITE_HOST } from "@/components/siteAddress";
import { blind } from "./crypto";
import { db } from "./db";
import { cookieLang } from "./lang";

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
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const minutes = opts.minutes ?? DAYS * 1440;
  /* the session this browser held before (whatever account it was): its cookie is replaced now, so it ends too, and a
     token the browser brought never lives on beside the new one */
  const brought = req.cookies.get(COOKIE)?.value;
  await underAccountLock(accountId, async (c) => {
    if (brought && brought.length <= 100) await c.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash(brought)]);
    await c.query(
      `INSERT INTO sessions (token_hash, account_id, expires_at, pending_totp) VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [tokenHash(token), accountId, minutes, !!opts.pendingTotp],
    );
    /* a full sign-in is the account's only session from now on (a session still waiting for its code replaces nothing) */
    if (!opts.pendingTotp) await onlyThisSession(c, accountId, tokenHash(token));
  });
  /* now and then, clear out the sessions that have run out, and those replaced more than a day ago */
  if (Math.random() < 0.05) (await db()).query(`DELETE FROM sessions WHERE expires_at < now() OR replaced_at < now() - interval '1 day'`).catch(() => {});
  res.cookies.set(COOKIE, token, cookieOptions(req, minutes * 60));
  /* what a code for this session is kept under (server/emailVerify.ts "l:" refs) */
  return `l:${tokenHash(token)}`;
}

/* Making a session and ending the account's others happen one sign-in at a time per account, in one transaction.
   Without it two devices signing in at the same moment could each add their session and then each mark the other's
   replaced, so both were told "signed in" and both cookies were refused. Under the lock the later sign-in always
   sees the earlier one's session and replaces it: the newest still wins, and exactly one stays. */
async function underAccountLock(accountId: string, work: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    await c.query(`SELECT pg_advisory_xact_lock(71005, ($1::bigint % 2147483647)::int)`, [accountId]);
    await work(c);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* Every other session of the account ends: it is kept for a day, marked, so its browser can be told that the account
   was opened on another device (sessionReplaced), and counts as no session at all (sessionRow). Only ever called
   inside underAccountLock. */
async function onlyThisSession(c: PoolClient, accountId: string, keepHash: string): Promise<void> {
  await c.query(`UPDATE sessions SET replaced_at = now() WHERE account_id = $1 AND token_hash <> $2 AND replaced_at IS NULL`, [accountId, keepHash]);
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

/** The account whose password was right and whose session waits for the 2-step code, or null. ref: what that
    session's email codes are kept under (server/emailVerify.ts). */
export async function pendingAccount(req: NextRequest): Promise<{ id: string; email: string; name: string; phone: string; ref: string } | null> {
  const r = await sessionRow(req);
  if (!r || !r.a.pending_totp || !r.a.totp_on) return null;
  return { id: String(r.a.id), email: r.a.email, name: r.a.name, phone: r.a.phone, ref: `l:${tokenHash(r.token)}` };
}

/** The code was right: the waiting session ends and a full one (60 days) starts in its place, with a brand-new token
    and cookie. The waiting session's token is never made the signed-in one: a token the browser brought (which someone
    else could have planted there, or seen while it waited) never becomes a signed-in session. */
export async function finishPendingSession(res: NextResponse, req: NextRequest): Promise<boolean> {
  const old = req.cookies.get(COOKIE)?.value;
  if (!old) return false;
  /* whose session it is, to take that account's sign-in lock (see underAccountLock) */
  const { rows: owner } = await (await db()).query(`SELECT account_id FROM sessions WHERE token_hash = $1`, [tokenHash(old)]);
  if (!owner[0]) return false;
  const token = randomBytes(32).toString("base64url");
  let made = false;
  await underAccountLock(String(owner[0].account_id), async (c) => {
    const { rows } = await c.query(
      `DELETE FROM sessions WHERE token_hash = $1 AND pending_totp AND replaced_at IS NULL AND expires_at > now() RETURNING account_id`,
      [tokenHash(old)],
    );
    if (!rows[0]) return;
    const accountId = String(rows[0].account_id);
    await c.query(
      `INSERT INTO sessions (token_hash, account_id, expires_at, pending_totp) VALUES ($1, $2, now() + make_interval(days => $3), false)`,
      [tokenHash(token), accountId, DAYS],
    );
    /* the sign-in is complete now: it is the account's only session (see ONE DEVICE AT A TIME) */
    await onlyThisSession(c, accountId, tokenHash(token));
    made = true;
  });
  if (made) res.cookies.set(COOKIE, token, cookieOptions(req, DAYS * 86400));
  return made;
}

/** Notes a full sign-in (for Diwan: when, and how many times), and the language the page is in (server/lang.ts) */
export async function noteLogin(accountId: string, req: NextRequest): Promise<void> {
  await (await db()).query(
    `UPDATE accounts SET last_login_at = now(), login_count = login_count + 1, lang = COALESCE($2, lang) WHERE id = $1`,
    [accountId, cookieLang(req)],
  );
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

/** The header every save of the dashboard sends since 2026-11-19 (components/serverSync.ts CLIENT_HEADER). Such a page
    always names its account as well, so a request with this one and without the account is refused like another
    account's: it can only be a save left over from an account that is no longer signed in there. */
export const CLIENT_HEADER = "x-dukkan-client";

/** True when the request names another account than the session's (answer 409 { result: "other-account" }), or names
    none although it comes from a page that always names one (CLIENT_HEADER). Without either header (a tab opened before
    they existed) it is not refused, so a tab left open from before keeps saving. */
export function otherAccount(req: NextRequest, a: { id: string; email: string }): boolean {
  const h = req.headers.get(ACCOUNT_HEADER);
  if (h === null) return req.headers.get(CLIENT_HEADER) !== null;
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

/* ---------------- limits on tries ---------------- */

/** The visitor's address, as the limits and the activity log count it. Cloudflare's own header first (the tunnel sets
    it); an x-forwarded-for comes second. An IPv6 address counts by its /64: one machine is usually given a whole /64,
    so counting each address apart would give it endless tries. */
export function visitorIp(req: NextRequest): string {
  const raw = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64);
  if (!raw) return "local";
  return raw.includes(":") ? ipv6Block(raw) : raw;
}

/** The first 4 groups (the /64) of an IPv6 address, written out in full */
function ipv6Block(ip: string): string {
  const a = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  /* an IPv4 address written as IPv6 (::ffff:1.2.3.4) is that IPv4 address */
  const v4 = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return v4[1];
  const [head, tail] = a.includes("::") ? a.split("::", 2) : [a, null];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = tail === null ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":") + "::/64";
}

/* Counts tries per key in memory (enough for one server; they start again after a deploy). The window slides: the
   last window's count still weighs in as it ages, so nobody gets twice the limit by trying at the edge of a window.
   Each kind of limit (a key's name up to its first ":") keeps its own list, in order of last use, of at most MAX_KEYS
   keys (the oldest go first), and expired keys are swept at most once a minute, so random keys can't make it grow or
   slow every request down. Lists apart: a flood of new keys of one kind (one try each from very many addresses, say)
   only pushes out older keys of that same kind, never another limit's count, such as a store's orders, one mailbox's
   codes or a staff member's wrong passwords. A limit per visitor (tooMany) is a kind of its own, apart from a limit
   for one account or store with the same name. Only a try that counts makes a key: a look (limitReached) makes none. */
type Window = { start: number; n: number; prev: number; ms: number };
const tries = new Map<string, Map<string, Window>>();
const MAX_KEYS = 50_000;
let swept = 0;

/** A key's kind: its name up to the first ":" */
const kindOf = (key: string) => {
  const i = key.indexOf(":");
  return i < 0 ? key : key.slice(0, i);
};
function listOf<T>(lists: Map<string, Map<string, T>>, key: string): Map<string, T> {
  const kind = kindOf(key);
  let m = lists.get(kind);
  if (!m) lists.set(kind, (m = new Map()));
  return m;
}

function windowOf(key: string, minutes: number, now: number): Window {
  const ms = minutes * 60_000;
  const list = listOf(tries, key);
  let w = list.get(key);
  if (w) list.delete(key);
  if (!w || w.ms !== ms) w = { start: now, n: 0, prev: 0, ms };
  else if (now - w.start >= ms) {
    const passed = Math.floor((now - w.start) / ms);
    w.prev = passed === 1 ? w.n : 0;
    w.start += passed * ms;
    w.n = 0;
  }
  list.set(key, w);
  if (now - swept > 60_000) {
    swept = now;
    tries.forEach((m, kind) => {
      m.forEach((v, k) => now - v.start >= 2 * v.ms && m.delete(k));
      if (!m.size) tries.delete(kind);
    });
  }
  if (list.size > MAX_KEYS) {
    /* the least recently used of this kind first (the list keeps them in that order) */
    const drop = list.size - Math.floor(MAX_KEYS * 0.9);
    Array.from(list.keys()).slice(0, drop).forEach((k) => list.delete(k));
  }
  return w;
}

const used = (w: Window, now: number) => w.prev * (1 - (now - w.start) / w.ms) + w.n;

/** What is used of this key's limit now, without making or moving its key (the same sums as windowOf, read only) */
function usedNow(key: string, minutes: number, now: number): number {
  const ms = minutes * 60_000;
  const w = tries.get(kindOf(key))?.get(key);
  if (!w || w.ms !== ms) return 0;
  const passed = Math.floor((now - w.start) / ms);
  if (passed <= 0) return used(w, now);
  /* the window ran out since: its count weighs in as the last window's, as windowOf would roll it */
  return passed === 1 ? w.n * (1 - (now - w.start - ms) / ms) : 0;
}

/** A limit per visitor: this try counts, and true when it is over `max` tries in `minutes` */
export function tooMany(req: NextRequest, what: string, max: number, minutes: number): boolean {
  return tooManyFor(`${what}@visitor:${visitorIp(req)}`, max, minutes);
}

/** The same limit for anything else than a visitor, such as one account from any address, or one store for all its
    visitors together: this try counts, and true when it is over `max` tries for this key in `minutes` */
export function tooManyFor(key: string, max: number, minutes: number): boolean {
  const now = Date.now();
  const w = windowOf(key, minutes, now);
  w.n++;
  return used(w, now) > max;
}

/** Whether `max` tries for this key in `minutes` are already used, without counting one: for limits that count only
    what went through (countTry), such as orders a store really got, so failed tries by a stranger can't use them up */
export function limitReached(key: string, max: number, minutes: number): boolean {
  return usedNow(key, minutes, Date.now()) >= max;
}

/** Counts one try for this key, for limitReached */
export function countTry(key: string, minutes: number): void {
  windowOf(key, minutes, Date.now()).n++;
}

/** limitReached and countTry in one step, for a limit that counts only what went through when that is known only after
    a wait (the database): null when `max` tries are used already, else one try is counted at once, before anything is
    waited for, so tries sent at the same moment can't all pass the look while the first ones are still waiting. Call
    the function it gives when the try turned out not to count: the try is given back (and a key left with nothing
    counted is dropped, so failed tries leave no keys behind). */
export function reserveTry(key: string, max: number, minutes: number): (() => void) | null {
  const now = Date.now();
  if (usedNow(key, minutes, now) >= max) return null;
  const w = windowOf(key, minutes, now);
  w.n++;
  const start = w.start;
  let back = false;
  return () => {
    if (back) return;
    back = true;
    const list = tries.get(kindOf(key));
    if (!list || list.get(key) !== w) return;
    /* counted in this window, or in the one before if the window moved on meanwhile */
    if (w.start === start) w.n = Math.max(0, w.n - 1);
    else if (w.start === start + w.ms) w.prev = Math.max(0, w.prev - 1);
    if (!w.n && !w.prev) list.delete(key);
  };
}

/* Requests running right now, per key (in memory, like the counts above): for the heaviest ones, a limit on how many of
   one account's run at the same time, not only on how many it sends in a while. Holds a key only while a request runs. */
const running = new Map<string, number>();

/** Starts one request under this key when fewer than `max` of its kind are running, and gives the function to call when
    it is done (in a finally); null when `max` already run: the request is answered at once instead of waiting */
export function startRunning(key: string, max: number): (() => void) | null {
  const n = running.get(key) ?? 0;
  if (n >= max) return null;
  running.set(key, n + 1);
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const left = (running.get(key) ?? 1) - 1;
    if (left > 0) running.set(key, left);
    else running.delete(key);
  };
}

/** Forgets what was counted for this key */
export function forgetTries(key: string): void {
  tries.get(kindOf(key))?.delete(key);
}

/* Wrong tries counted per account (or per anything else named by `key`), whatever address they come from: after `max`
   wrong tries in `minutes` the key waits. Only wrong tries count, and a right one clears them, so someone who knows the
   password is never slowed down by their own sign-ins. Kept in memory, like the limit above, in a list per kind of key
   too, so wrong sign-ins with endless made-up emails can't push out a staff member's lock on wrong passwords. */
const fails = new Map<string, Map<string, { n: number; until: number }>>();
const failOf = (key: string) => fails.get(kindOf(key))?.get(key);
/** True while this key has had too many wrong tries */
export function failedTooOften(key: string, max: number): boolean {
  const f = failOf(key);
  return !!f && f.until > Date.now() && f.n >= max;
}
/** Notes one wrong try for this key */
export function noteFailure(key: string, minutes: number): void {
  const now = Date.now();
  const list = listOf(fails, key);
  if (list.size > 10_000) list.forEach((v, k) => v.until < now && list.delete(k));
  /* still full (random keys that haven't expired): the oldest of this kind go */
  if (list.size > MAX_KEYS) Array.from(list.keys()).slice(0, list.size - Math.floor(MAX_KEYS * 0.9)).forEach((k) => list.delete(k));
  const f = list.get(key);
  if (!f || f.until < now) list.set(key, { n: 1, until: now + minutes * 60_000 });
  else f.n++;
}
/** Forgets the wrong tries of this key (the right password was given), and those counted for it per address
    (signInTries) */
export function clearFailures(key: string): void {
  const list = fails.get(kindOf(key));
  if (!list) return;
  list.delete(key);
  list.forEach((_v, k) => k.startsWith(`${key}|`) && list.delete(k));
}

/* Wrong passwords (or 2-step codes) at a sign-in. Someone who only knows a merchant's or a staff member's email or mobile
   must not be able to keep the real owner out by typing wrong passwords. So the wrong tries are counted twice:
   - per account AND address: after `max` of them in `minutes`, that address waits ("slow-down") for this account. The
     owner, on his own address, is not held back by tries from somewhere else.
   - per account, from every address together: a wait before the password is checked that grows with the wrong tries
     (slowDown), so guessing from many addresses gets slow. The wait comes before the check, for a right and a wrong
     password alike, so it gives nothing away. And a ceiling (security audit N05): once ACCOUNT_CAP wrong tries came from
     everywhere together within `minutes`, the account's sign-in is held for HOLD_MINUTES (held): no password is
     checked, the answer is "slow-down", and each wrong try after the hold, while the count still stands, holds it
     again. Many addresses together then get about ACCOUNT_CAP guesses in `minutes`, not 10 each. The sign-in routes
     let through, while held, only an address that signed in to the account before (knownSigninPlace) or, for staff, a
     remembered browser: a stranger can hold the account for minutes at a time, but never keeps the owner out where he
     usually signs in.
   A try is counted (failed) right after the look (blocked) and before the password is checked, so tries sent all at
   once can't all pass the look while the first ones are still being checked, and the right password forgets them again (passed). A new password set by a reset
   forgets them from every address (clearFailures). `key` names the account, or
   for an email nobody has what was typed, so an unknown account waits the same way as a real one. */
export const ACCOUNT_CAP = 50;
export const HOLD_MINUTES = 5;
/* until when each account's sign-in is held (only accounts that reached ACCOUNT_CAP have one) */
const holds = new Map<string, number>();
export function signInTries(req: NextRequest, key: string, max: number, minutes: number) {
  const here = `${key}|${visitorIp(req)}`;
  return {
    /** True while this address has had too many wrong tries for this account */
    blocked: () => failedTooOften(here, max),
    /** True while the account's sign-in is held, after ACCOUNT_CAP wrong tries from everywhere together (see above) */
    held: () => (holds.get(key) ?? 0) > Date.now(),
    /** The growing wait, after `failed`: none for the first five tries on the account since its last right one, then
        0.5 s, doubling, at most 8 s */
    slowDown: async () => {
      const f = failOf(key);
      const n = f && f.until > Date.now() ? f.n : 0;
      if (n > 5) await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (n - 6), 8_000)));
    },
    /** Counts one try as wrong, for the account and for this address; at ACCOUNT_CAP the account's sign-in is held */
    failed: () => {
      noteFailure(key, minutes);
      noteFailure(here, minutes);
      const f = failOf(key);
      if (f && f.n >= ACCOUNT_CAP) {
        const now = Date.now();
        if (holds.size > 10_000) holds.forEach((until, k) => until < now && holds.delete(k));
        holds.set(key, now + HOLD_MINUTES * 60_000);
      }
    },
    /** The right password (or code): the account's wrong tries are forgotten, and this address's. Another address
        that was guessing stays held back, and a hold runs to its end (the owner's own places pass it anyway). */
    passed: () => {
      fails.get(kindOf(key))?.delete(key);
      fails.get(kindOf(here))?.delete(here);
    },
  };
}

/* ---------------- where an account signed in before ----------------
   Kept for the sign-in hold above: a keyed fingerprint (server/crypto.ts blind) of each address an account fully signed
   in from (never the address itself), in signin_places, for PLACE_DAYS, at most PLACE_MAX per account (the newest).
   `who`: "m:<account id>" for a merchant, "s:<staff id>" for staff. */
const PLACE_DAYS = 90;
const PLACE_MAX = 20;
const placeOf = (req: NextRequest) => blind(`signin-place:${visitorIp(req)}`);

/** Notes that `who` fully signed in from this request's address. Never holds up or breaks the sign-in. */
export async function noteSigninPlace(req: NextRequest, who: string): Promise<void> {
  try {
    const pool = await db();
    await pool.query(
      `INSERT INTO signin_places (who, place) VALUES ($1, $2) ON CONFLICT (who, place) DO UPDATE SET last_at = now()`,
      [who, placeOf(req)],
    );
    await pool.query(
      `DELETE FROM signin_places WHERE who = $1 AND (last_at < now() - make_interval(days => $2)
         OR place IN (SELECT place FROM signin_places WHERE who = $1 ORDER BY last_at DESC OFFSET $3))`,
      [who, PLACE_DAYS, PLACE_MAX],
    );
    if (Math.random() < 0.02) pool.query(`DELETE FROM signin_places WHERE last_at < now() - make_interval(days => $1)`, [PLACE_DAYS]).catch(() => {});
  } catch (e) {
    console.error("[sign-in] noting the address", (e as Error)?.message ?? e);
  }
}

/** True when `who` fully signed in from this request's address within PLACE_DAYS */
export async function knownSigninPlace(req: NextRequest, who: string): Promise<boolean> {
  const { rows } = await (await db()).query(
    `SELECT 1 FROM signin_places WHERE who = $1 AND place = $2 AND last_at > now() - make_interval(days => $3)`,
    [who, placeOf(req), PLACE_DAYS],
  );
  return rows.length > 0;
}

/** Reads a JSON object body of at most `max` bytes, or null. The body is read piece by piece and dropped as soon as it
    is longer than `max`, so a huge body (sent without a Content-Length, or with a false one) is never held in memory. */
export async function readJson(req: NextRequest, max: number): Promise<Record<string, unknown> | null> {
  const r = await readJsonOr(req, max);
  return "body" in r ? r.body : null;
}

/** readJson, telling a body over the limit ("too-big") from one that is not a JSON object ("invalid"), so a route can
    answer each for what it is (a broken body was answered "too-big", testing round NF-2) */
export async function readJsonOr(req: NextRequest, max: number): Promise<{ body: Record<string, unknown> } | { why: "too-big" | "invalid" }> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return { why: "too-big" };
  const reader = req.body?.getReader();
  if (!reader) return { why: "invalid" };
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return { why: "too-big" };
    }
    parts.push(value);
  }
  const text = Buffer.concat(parts).toString("utf8");
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? { body: v } : { why: "invalid" };
  } catch {
    return { why: "invalid" };
  }
}

/** The answer for a body readJsonOr could not take: 413 "too-big" or 400 "invalid" */
export const unreadable = (why: "too-big" | "invalid") => answer({ result: why }, why === "too-big" ? 413 : 400);

export const answer = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Wraps a route so a database that is down gives a clear 503 instead of a crash */
export function guarded(fn: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const started = Date.now();
    try {
      return await fn(req);
    } catch (e) {
      /* text the database can't keep (a null character, broken Unicode) or an address that can't be read: the
         request is wrong, the server is fine */
      const code = (e as { code?: string })?.code;
      if (code === "22021" || code === "22P05" || e instanceof URIError) return answer({ result: "invalid" }, 400);
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return answer({ result: "error" }, 503);
    } finally {
      /* a slow answer goes to the log (the method and path only, never what was sent) */
      const ms = Date.now() - started;
      if (ms > 500) console.warn("[slow]", req.method, req.nextUrl.pathname, `${ms} ms`);
    }
  };
}
