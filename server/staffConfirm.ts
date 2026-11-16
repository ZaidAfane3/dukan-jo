import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { checkPassword, tooMany, tooManyFor } from "./auth";
import { db } from "./db";
import { STAFF_COOKIE, type Staff } from "./staff";

/* A staff member types his own password again before a change that reaches every new store (today: the legal pages new
   stores start with). The password is checked here, on the server, with the same scrypt check as the sign-in
   (server/auth.ts checkPassword) and the same kind of limit on tries. A right password is remembered on this sign-in's
   own session row (staff_sessions.password_confirmed_at), never in the browser, for CONFIRM_MINUTES; the save route asks
   staffConfirmed() and refuses without it, and forgets it once the save is done (forgetConfirmation), so each change
   needs the password again. The password itself is never kept or logged.

   An account without a real password (the local dev owner's password_hash is 'none') can't confirm: there is no
   exception for the dev server. */

export const CONFIRM_MINUTES = 10;
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
const tokenOf = (req: NextRequest) => {
  const t = req.cookies.get(STAFF_COOKIE)?.value;
  return t && t.length <= 100 ? t : null;
};

/** Whether this staff account has a password it could type (false for the local dev owner) */
export async function hasRealPassword(staffId: string): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT password_hash FROM staff WHERE id = $1 AND active`, [staffId]);
  return typeof rows[0]?.password_hash === "string" && rows[0].password_hash.startsWith("scrypt$");
}

export type ConfirmResult = "ok" | "wrong" | "no-password" | "slow-down" | "no-session";

/** Checks the signed-in staff member's own password and, when it is right, remembers that on this session for
    CONFIRM_MINUTES. Ten tries per address and five per staff member in 15 minutes, like the sign-in's limit. */
export async function confirmPassword(req: NextRequest, me: Staff, password: unknown): Promise<ConfirmResult> {
  if (tooMany(req, "diwan-confirm", 10, 15) || tooManyFor(`diwan-confirm:${me.id}`, 5, 15)) return "slow-down";
  if (typeof password !== "string" || !password || password.length > 128) return "wrong";
  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash FROM staff WHERE id = $1 AND active`, [me.id]);
  const hash: unknown = rows[0]?.password_hash;
  if (typeof hash !== "string" || !hash.startsWith("scrypt$")) return "no-password";
  if (!(await checkPassword(password, hash))) return "wrong";
  const token = tokenOf(req);
  if (!token) return "no-session";
  /* only on a session that passed the 2-step code, and only while the password is still the one just checked */
  const r = await pool.query(
    `UPDATE staff_sessions ss SET password_confirmed_at = now() FROM staff s
      WHERE ss.token_hash = $1 AND ss.staff_id = $2 AND ss.verified AND s.id = ss.staff_id AND s.password_hash = $3 AND s.active`,
    [tokenHash(token), me.id, hash],
  );
  return r.rowCount ? "ok" : "no-session";
}

/** True when this staff member confirmed his password on this session in the last CONFIRM_MINUTES */
export async function staffConfirmed(req: NextRequest, me: Staff): Promise<boolean> {
  const token = tokenOf(req);
  if (!token) return false;
  const { rowCount } = await (await db()).query(
    `SELECT 1 FROM staff_sessions WHERE token_hash = $1 AND staff_id = $2 AND verified
        AND password_confirmed_at > now() - make_interval(mins => $3)`,
    [tokenHash(token), me.id, CONFIRM_MINUTES],
  );
  return !!rowCount;
}

/** Forgets a confirmation (after the save it allowed, or when the page is left): the next change asks again */
export async function forgetConfirmation(req: NextRequest): Promise<void> {
  const token = tokenOf(req);
  if (token) await (await db()).query(`UPDATE staff_sessions SET password_confirmed_at = NULL WHERE token_hash = $1`, [tokenHash(token)]);
}
