import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { answer, guarded, sameOrigin, secureCookies, tooManyFor, visitorIp } from "./auth";
import { db } from "./db";
import { cookieLang } from "./lang";

/* Diwan's staff: their sign-in, roles and the activity log. Staff accounts are separate from merchant accounts: their
   own table, their own cookie (dukkan-diwan, SameSite=Strict), 12 hours at most and 60 minutes idle. A session is made
   only once the emailed 2-step code was given (server/staffSignin.ts), always verified. Sessions left unverified from
   before (the authenticator app, retired on 2026-11-22) never open anything and can't become verified any more. Every
   Diwan route goes through staffRoute(). */

import { can, type Perm, type Role } from "@/components/diwan/perms";
export { can, type Perm, type Role };
export type Staff = { id: string; email: string; name: string; role: Role };

export const STAFF_COOKIE = "dukkan-diwan";
const HOURS = 12;
const IDLE_MIN = 60;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
export const ipOf = (req: NextRequest) => visitorIp(req);

/* ---------------- sessions ---------------- */

/** Starts a staff session and sets the cookie, after the emailed code (app/api/diwan/auth/code). passwordHash is the hash the
    password was checked against: the session is made only while the account still has it and is active, so a password
    replaced (an owner's reset, the setup key) or an account turned off during the check can't leave a session behind.
    False when it wasn't made. */
export async function startStaffSession(res: NextResponse, req: NextRequest, staffId: string, passwordHash: string, verified = false): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  /* FOR SHARE waits for a change to this account in progress (it locks the row, and then deletes its sessions), and then
     sees the new password; a change that starts after waits for this session, and so deletes it. */
  const r = await pool.query(
    `INSERT INTO staff_sessions (token_hash, staff_id, ip, verified, expires_at)
     SELECT $1, id, $3, $4, now() + make_interval(hours => $5) FROM staff WHERE id = $2 AND password_hash = $6 AND active FOR SHARE`,
    [tokenHash(token), staffId, ipOf(req), verified, HOURS, passwordHash],
  );
  if (!r.rowCount) return false;
  /* the language the sign-in page is in, for the staff emails (server/lang.ts) */
  const lang = cookieLang(req);
  if (lang) await pool.query(`UPDATE staff SET lang = $2 WHERE id = $1 AND lang IS DISTINCT FROM $2`, [staffId, lang]);
  if (Math.random() < 0.1) pool.query(`DELETE FROM staff_sessions WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(STAFF_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: secureCookies(req), path: "/", maxAge: HOURS * 3600 });
  return true;
}

export async function endStaffSession(res: NextResponse, req: NextRequest): Promise<void> {
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (token) await (await db()).query(`DELETE FROM staff_sessions WHERE token_hash = $1`, [tokenHash(token)]);
  res.cookies.set(STAFF_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: secureCookies(req), path: "/", maxAge: 0 });
}

/** The staff member behind a cookie token, and whether the 2-step code was given. Also usable from server components.
    `touch: false` for a page's own background load (a ticket looked at again every few seconds): it is answered, but
    it is not counted as use, so a page left open still ends the session after IDLE_MIN with nothing done. */
export async function staffFromToken(token: string | undefined, { touch = true }: { touch?: boolean } = {}): Promise<(Staff & { verified: boolean }) | null> {
  if (!token || token.length > 100) return LOCAL_DEV ? devOwner() : null;
  const pool = await db();
  /* read first; the last use is written only when it is more than a minute old, so a console page's many requests
     don't each rewrite the session row */
  const { rows } = await pool.query(
    `SELECT s.id, s.email, s.name, s.role, ss.verified, ss.last_used_at < now() - interval '1 minute' AS stale
       FROM staff_sessions ss JOIN staff s ON s.id = ss.staff_id
      WHERE ss.token_hash = $1 AND s.active
        AND ss.expires_at > now() AND ss.last_used_at > now() - make_interval(mins => $2)`,
    [tokenHash(token), IDLE_MIN],
  );
  if (touch && rows[0]?.stale) await pool.query(`UPDATE staff_sessions SET last_used_at = now() WHERE token_hash = $1`, [tokenHash(token)]);
  const s = rows[0];
  /* locally, a sign-in left halfway (no code given yet) doesn't stop the dev owner either */
  if (!s || (LOCAL_DEV && !s.verified)) return LOCAL_DEV ? devOwner() : null;
  /* no roles any more (components/diwan/perms.ts): everyone is an owner, whatever an old row still says */
  return { id: String(s.id), email: s.email, name: s.name, role: "owner" as Role, verified: s.verified };
}

/* ---------------- local development: no sign-in ---------------- */

/* On the local dev server only (`next dev`, NODE_ENV=development; `npm run dev` serves it on 127.0.0.1 only, so nobody
   else on the network can reach it), Diwan opens without signing in, as an owner called
   "Local dev". The live server runs the production build (NODE_ENV=production), where this is always off. To try the
   real sign-in locally anyway, start the dev server with DIWAN_DEV_LOGIN=off. Someone who did sign in stays themselves. */
const LOCAL_DEV = process.env.NODE_ENV === "development" && process.env.DIWAN_DEV_LOGIN !== "off";
/** The local dev owner's email. First-owner setup (app/api/diwan/setup) doesn't count that row as staff, so turning
    DIWAN_DEV_LOGIN=off on a database that only has it still lets the real first owner be made. */
export const DEV_EMAIL = "local-dev@diwan.local";
const gDev = globalThis as unknown as { diwanDevOwner?: Promise<Staff & { verified: boolean }> };

/** The local dev owner (a real staff row, so the activity log can name it; it has no password, so it can't sign in) */
function devOwner(): Promise<Staff & { verified: boolean }> {
  gDev.diwanDevOwner ??= (async () => {
    const { emailKey, seal } = await import("./crypto");
    const { rows } = await (await db()).query(
      `INSERT INTO staff (email, email_hash, name, role, password_hash) VALUES ($1, $2, 'Local dev', 'owner', 'none')
       ON CONFLICT (email_hash) DO UPDATE SET role = 'owner', active = true RETURNING id`,
      [seal(DEV_EMAIL), emailKey(DEV_EMAIL)],
    );
    return { id: String(rows[0].id), email: DEV_EMAIL, name: "Local dev", role: "owner" as Role, verified: true };
  })().catch((e) => {
    gDev.diwanDevOwner = undefined;
    throw e;
  });
  return gDev.diwanDevOwner;
}

/* a load the page made by itself sends X-Diwan-Background: 1 (components/diwan/signInAgain.tsx BACKGROUND) */
export const currentStaff = (req: NextRequest) =>
  staffFromToken(req.cookies.get(STAFF_COOKIE)?.value, { touch: req.headers.get("x-diwan-background") !== "1" });

/* ---------------- routes ---------------- */

/** Wraps a Diwan API route: signed-in staff who passed the 2-step code, with the permission, and (for changes) from
    Dukkan's own pages. Database errors become a 503 like the other routes. */
export function staffRoute(perm: Perm | null, fn: (req: NextRequest, staff: Staff, ctx: { params: Record<string, string> }) => Promise<NextResponse>) {
  /* Next 16 hands a route its URL parts as a promise; the routes inside get them already read */
  return async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) =>
    guarded(async (r: NextRequest) => {
      if (r.method !== "GET" && r.method !== "HEAD" && !sameOrigin(r)) return answer({ result: "forbidden" }, 403);
      const s = await currentStaff(r);
      if (!s || !s.verified) return answer({ result: "signed-out" }, 401);
      if (perm && !can(s, perm)) return answer({ result: "not-allowed" }, 403);
      /* a ceiling per staff member for every console route, far above what the pages ask for */
      if (tooManyFor(`diwan:${s.id}`, 900, 10)) return answer({ result: "slow-down" }, 429);
      return fn(r, s, { params: (await ctx?.params) ?? {} });
    })(req);
}

/* ---------------- activity log ---------------- */

/** Writes one line to the activity log: sign-ins and changes only, never what staff merely opened or read */
export async function audit(
  req: NextRequest,
  staffId: string | null,
  action: string,
  target?: { type: string; id: string | number },
  reason?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  /* the reason, the address and the details' texts are private (notes, emails, reasons...): sealed like the tables they
     come from (server/crypto.ts), opened again when read */
  const { seal, sealDeep } = await import("./crypto");
  await (await db()).query(
    `INSERT INTO audit_log (staff_id, action, target_type, target_id, reason, ip, meta) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [staffId, action, target?.type ?? null, target ? String(target.id) : null, seal(reason ?? null), seal(ipOf(req)), meta ? JSON.stringify(sealDeep(meta)) : null],
  );
}

/* ---------------- authenticator app codes (TOTP, RFC 6238: 30 seconds, 6 digits, SHA-1) ----------------
   Only for merchants who set up an app before their codes came by email (app/api/auth/totp). Staff no longer use
   them (their codes come by email since 2026-11-22, server/staffSignin.ts); their old secrets are left unread. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Bytes(s: string): Buffer {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Bytes(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** The 30-second step a code belongs to (now, or one step either side for clock drift), or null when it matches none */
export function totpStep(secret: string, code: string): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(Date.now() / 30_000);
  let found: number | null = null;
  /* every step is compared, whichever matches, so the time taken says nothing */
  for (const d of [-1, 0, 1]) if (timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(c)) && found === null) found = step + d;
  return found;
}

/** True when the code matches now, or one step either side (clock drift) */
export const totpOk = (secret: string, code: string): boolean => totpStep(secret, code) !== null;

/** Checks a sign-in code and uses it up: a code (and any older one) is accepted once, so a code that was seen or caught
    on its way can't be given again in the 90 seconds it stays right. `table`: whose code it is. False for a wrong code
    and for one already used. The step is kept on the account (totp_last_step), so two tries at once can't both pass. */
export async function useTotpCode(table: "accounts" | "staff", id: string, secret: string, code: string): Promise<boolean> {
  const step = totpStep(secret, code);
  if (step === null) return false;
  const r = await (await db()).query(`UPDATE ${table} SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`, [id, step]);
  return !!r.rowCount;
}
