import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { answer, guarded, sameOrigin } from "./auth";
import { db } from "./db";

/* Diwan's staff: their sign-in, roles, 2-step codes and the activity log. Staff accounts are separate from merchant
   accounts: their own table, their own cookie (dukkan-diwan, SameSite=Strict), 12 hours at most and 60 minutes idle.
   A session only counts once the 2-step code was given (verified). Every Diwan route goes through staffRoute(). */

import { can, type Perm, type Role } from "@/components/diwan/perms";
export { can, type Perm, type Role };
export type Staff = { id: string; email: string; name: string; role: Role; totpOn: boolean };

export const STAFF_COOKIE = "dukkan-diwan";
const HOURS = 12;
const IDLE_MIN = 60;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
export const ipOf = (req: NextRequest) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
const isHttps = (req: NextRequest) => (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")) === "https";

/* ---------------- sessions ---------------- */

/** Starts a staff session (not verified until the 2-step code is given) and sets the cookie */
export async function startStaffSession(res: NextResponse, req: NextRequest, staffId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  await pool.query(
    `INSERT INTO staff_sessions (token_hash, staff_id, ip, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [tokenHash(token), staffId, ipOf(req), HOURS],
  );
  if (Math.random() < 0.1) pool.query(`DELETE FROM staff_sessions WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(STAFF_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: isHttps(req), path: "/", maxAge: HOURS * 3600 });
}

export async function endStaffSession(res: NextResponse, req: NextRequest): Promise<void> {
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (token) await (await db()).query(`DELETE FROM staff_sessions WHERE token_hash = $1`, [tokenHash(token)]);
  res.cookies.set(STAFF_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: isHttps(req), path: "/", maxAge: 0 });
}

/** Marks the current session as past the 2-step code */
export async function verifyStaffSession(req: NextRequest): Promise<void> {
  const token = req.cookies.get(STAFF_COOKIE)?.value;
  if (token) await (await db()).query(`UPDATE staff_sessions SET verified = true WHERE token_hash = $1`, [tokenHash(token)]);
}

/** The staff member behind a cookie token, and whether the 2-step code was given. Also usable from server components. */
export async function staffFromToken(token: string | undefined): Promise<(Staff & { verified: boolean }) | null> {
  if (!token || token.length > 100) return null;
  const pool = await db();
  const { rows } = await pool.query(
    `UPDATE staff_sessions ss SET last_used_at = now()
       FROM staff s
      WHERE ss.token_hash = $1 AND s.id = ss.staff_id AND s.active
        AND ss.expires_at > now() AND ss.last_used_at > now() - make_interval(mins => $2)
  RETURNING s.id, s.email, s.name, s.role, s.totp_on, ss.verified`,
    [tokenHash(token), IDLE_MIN],
  );
  const s = rows[0];
  if (!s) return null;
  return { id: String(s.id), email: s.email, name: s.name, role: s.role, totpOn: s.totp_on, verified: s.verified };
}

export const currentStaff = (req: NextRequest) => staffFromToken(req.cookies.get(STAFF_COOKIE)?.value);

/* ---------------- routes ---------------- */

/** Wraps a Diwan API route: signed-in staff who passed the 2-step code, with the permission, and (for changes) from
    Dukkan's own pages. Database errors become a 503 like the other routes. */
export function staffRoute(perm: Perm | null, fn: (req: NextRequest, staff: Staff, ctx: { params: Record<string, string> }) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: { params: Record<string, string> } = { params: {} }) =>
    guarded(async (r: NextRequest) => {
      if (r.method !== "GET" && r.method !== "HEAD" && !sameOrigin(r)) return answer({ result: "forbidden" }, 403);
      const s = await currentStaff(r);
      if (!s || !s.verified) return answer({ result: "signed-out" }, 401);
      if (perm && !can(s, perm)) return answer({ result: "not-allowed" }, 403);
      return fn(r, s, ctx);
    })(req);
}

/* ---------------- activity log ---------------- */

/** Writes one line to the activity log. Views count too: call it when staff open a shop or a ticket. */
export async function audit(
  req: NextRequest,
  staffId: string | null,
  action: string,
  target?: { type: string; id: string | number },
  reason?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await (await db()).query(
    `INSERT INTO audit_log (staff_id, action, target_type, target_id, reason, ip, meta) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [staffId, action, target?.type ?? null, target ? String(target.id) : null, reason ?? null, ipOf(req), meta ? JSON.stringify(meta) : null],
  );
}

/* ---------------- 2-step codes (TOTP, RFC 6238: 30 seconds, 6 digits, SHA-1, as authenticator apps expect) ---------------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  bytes.forEach((b) => (bits += b.toString(2).padStart(8, "0")));
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

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

/** True when the code matches now, or one step either side (clock drift) */
export function totpOk(secret: string, code: string): boolean {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(c)));
}

/** The link authenticator apps read (also shown as text to type in). issuer: the name the app shows ("Dukkan" for merchants). */
export const totpLink = (secret: string, email: string, issuer = "Diwan") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
