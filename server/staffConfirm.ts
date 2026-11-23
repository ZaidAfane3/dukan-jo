import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { answer, checkPassword, clearFailures, failedTooOften, noteFailure, tooMany, tooManyFor, visitorIp } from "./auth";
import { db } from "./db";
import { audit, STAFF_COOKIE, type Staff } from "./staff";

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

/* ---------------- the password again, with the change itself ---------------- */

/* Changes that could let one staff member act as another, or that reach a merchant or every merchant's contacts, need the
   acting staff member's own password typed again with them, sent in the same request as { myPassword }: resetting
   another member's password or 2-step code, taking a member's access away or giving it back, adding a member, suspending or reactivating
   a store, recording a payment, turning a merchant's 2-step code off and exporting the store list or the payments. Nothing is kept on
   the session (unlike the legal pages' unlock above): each change asks again. Five wrong passwords per staff member
   (or ten per address) and that member waits 15 minutes before the next try; a right one forgets them, so a staff member
   doing many of these changes in a row is never slowed down. */

/** Null when `password` is the signed-in staff member's own (go on with the change), else the answer to give:
    403 { result: "password", why: "wrong" | "missing" | "no-password" }, or 429 { result: "slow-down" }. `what` names the
    change for the activity log's line about a wrong password (never the password itself). */
export async function passwordAgain(req: NextRequest, me: Staff, password: unknown, what: string) {
  if (typeof password !== "string" || !password) return answer({ result: "password", why: "missing" }, 403);
  const who = `diwan-again:${me.id}`;
  const here = `diwan-again-ip:${visitorIp(req)}`;
  if (failedTooOften(who, 5) || failedTooOften(here, 10)) return answer({ result: "slow-down" }, 429);
  const { rows } = await (await db()).query(`SELECT password_hash FROM staff WHERE id = $1 AND active`, [me.id]);
  const hash: unknown = rows[0]?.password_hash;
  /* the local dev owner has no password: no exception for the dev server, as with the legal pages */
  if (typeof hash !== "string" || !hash.startsWith("scrypt$")) return answer({ result: "password", why: "no-password" }, 403);
  /* counted before the check, so tries sent all at once can't all get past the limit; the right password forgets them */
  noteFailure(who, 15);
  noteFailure(here, 15);
  if (password.length > 128 || !(await checkPassword(password, hash))) {
    await audit(req, me.id, "staff.password_again_failed", { type: "staff", id: me.id }, null, { for: what });
    return answer({ result: "password", why: "wrong" }, 403);
  }
  clearFailures(who);
  clearFailures(here);
  return null;
}
