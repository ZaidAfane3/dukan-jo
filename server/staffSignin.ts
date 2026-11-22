import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { secureCookies } from "./auth";
import { emailKey, seal } from "./crypto";
import { db } from "./db";
import { emailOn, sendEmailSoon } from "./email";
import { CODE_MINUTES, maskEmail, sendCodeEmail, type SendResult } from "./emailVerify";
import { staffEmailApproveEmail, staffEmailChangedEmail, staffEmailCodeEmail, staffSigninCodeEmail, wordsIn } from "./emailWords";

/* Diwan's 2-step sign-in, by emailed code (since 2026-11-22; the authenticator app is gone for staff, its columns stay
   unread). The codes themselves are the merchants' (server/emailVerify.ts: 10 minutes, 5 tries each, one use, a new
   one ends the ones before it, locks per sign-in and per address and visitor, caps on sending), with their own kinds
   ("staff-login", "staff-change": their own allowances, server/email.ts CODE_LIMITS) and Diwan's words
   (server/emailWords.ts), in the member's saved language (staff.lang) or both while none is saved.

   1. app/api/diwan/auth/login: the right password makes a waiting sign-in (staff_signins), NOT a staff session: its
      browser gets only the dukkan-diwan-wait cookie, sent to /api/diwan/auth/* alone, and a code goes to the member's
      email on file. The address is never typed or changed at sign-in, so whoever saw a temporary password can't send
      the code to a mailbox of his own.
   2. app/api/diwan/auth/code: the right code ends the waiting sign-in (once) and starts the staff session, verified,
      with the dukkan-diwan cookie (server/staff.ts startStaffSession). A temporary password is replaced in the same
      step. Typing the code also confirms the email (staff.email_confirmed_at).
   A waiting sign-in lasts 15 minutes and finishes only while the account still has the password it was made with
   and is active.
   3. A browser where the code was typed is remembered (below): there, later, the right password alone signs in.

   A staff member's own new email (app/api/diwan/account/email), in two steps as a merchant's with 2-step on: first a code
   to the CURRENT address approves the change to that one new address (ref "sco:<staff id>", purpose "staff-change-old":
   its row names the address it approves), so someone holding a session and the password but not the mailbox can't move
   the sign-in codes away; then a code to the new address proves it (ref "sc:<staff id>"); then a notice to the old one. */

export const WAIT_COOKIE = "dukkan-diwan-wait";
const WAIT_MINUTES = 15;
const WAIT_PATH = "/api/diwan/auth";
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
const signinRef = (hash: string) => `sl:${hash}`;
export const emailChangeRef = (staffId: string) => `sc:${staffId}`;
export const emailApproveRef = (staffId: string) => `sco:${staffId}`;

/** True when a code can go out: an email provider (RESEND_API_KEY and EMAIL_FROM), or the local dev server, where the
    code is written to its console. Without it nobody can sign in to Diwan on the live server. */
export const staffCodesOn = (): boolean => emailOn() || process.env.NODE_ENV === "development";

export type WaitingSignin = {
  staffId: string;
  email: string;
  lang: unknown;
  mustChange: boolean;
  confirmed: boolean;
  passwordHash: string;
  tokenHash: string;
  ref: string;
};

/** Makes the waiting sign-in after a right password and gives its browser the wait cookie. Made only while the account
    still has `passwordHash` and is active (as startStaffSession). Its code ref, or null when it wasn't made. */
export async function startSignin(res: NextResponse, req: NextRequest, staffId: string, passwordHash: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  const r = await pool.query(
    `INSERT INTO staff_signins (token_hash, staff_id, password_hash, expires_at)
     SELECT $1, id, $3, now() + make_interval(mins => $4) FROM staff WHERE id = $2 AND password_hash = $3 AND active FOR SHARE`,
    [tokenHash(token), staffId, passwordHash, WAIT_MINUTES],
  );
  if (!r.rowCount) return null;
  if (Math.random() < 0.1) pool.query(`DELETE FROM staff_signins WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(WAIT_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: secureCookies(req), path: WAIT_PATH, maxAge: WAIT_MINUTES * 60 });
  return signinRef(tokenHash(token));
}

/** The sign-in this browser is waiting to finish, or null (none, ran out, the password changed, access taken away) */
export async function waitingSignin(req: NextRequest): Promise<WaitingSignin | null> {
  const token = req.cookies.get(WAIT_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { rows } = await (await db()).query(
    `SELECT w.staff_id, w.password_hash, s.email, s.lang, s.must_change_password, s.email_confirmed_at IS NOT NULL AS confirmed
       FROM staff_signins w JOIN staff s ON s.id = w.staff_id
      WHERE w.token_hash = $1 AND w.expires_at > now() AND s.active AND s.password_hash = w.password_hash`,
    [tokenHash(token)],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    staffId: String(r.staff_id),
    email: String(r.email),
    lang: r.lang,
    mustChange: !!r.must_change_password,
    confirmed: !!r.confirmed,
    passwordHash: String(r.password_hash),
    tokenHash: tokenHash(token),
    ref: signinRef(tokenHash(token)),
  };
}

/** Ends the waiting sign-in (a code finishes it once: true only for the request that ended it) and clears its cookie */
export async function endSignin(res: NextResponse, req: NextRequest, hash: string): Promise<boolean> {
  const r = await (await db()).query(`DELETE FROM staff_signins WHERE token_hash = $1`, [hash]);
  res.cookies.set(WAIT_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: secureCookies(req), path: WAIT_PATH, maxAge: 0 });
  return r.rowCount === 1;
}

/** Sends (or sends again) the sign-in code to the member's email on file, in their language */
export function sendSigninCode(req: NextRequest, ref: string, email: string, lang: unknown): Promise<SendResult> {
  const w = wordsIn(lang, (l) => staffSigninCodeEmail(l, CODE_MINUTES));
  return sendCodeEmail(req, "staff-login", ref, email, w.lang, "", w.words);
}

/** Sends the code that approves a change to `newEmail`, to the member's CURRENT address. The new address is written on the
    code's row and is part of the code (server/emailVerify.ts sendCodeEmail): it approves that one address only, and
    asking for another one ends it. */
export function sendEmailApproveCode(req: NextRequest, staffId: string, current: string, newEmail: string, lang: unknown): Promise<SendResult> {
  const w = wordsIn(lang, (l) => staffEmailApproveEmail(l, CODE_MINUTES, maskEmail(newEmail)));
  return sendCodeEmail(req, "staff-change-old", emailApproveRef(staffId), current, w.lang, newEmail, w.words);
}

/** The new email waiting for the current address's approval (the last day, not approved or given up yet), or null;
    `live`: its code still works now */
export async function pendingStaffApproval(staffId: string): Promise<{ email: string; live: boolean } | null> {
  const { rows } = await (await db()).query(
    `SELECT new_email, confirmed_at, cancelled_at, (used_at IS NULL AND expires_at > now()) AS live FROM email_codes
      WHERE ref = $1 AND purpose = 'staff-change-old' AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 1`,
    [emailApproveRef(staffId)],
  );
  const r = rows[0];
  return r && !r.confirmed_at && !r.cancelled_at && r.new_email ? { email: String(r.new_email), live: !!r.live } : null;
}

/** True when the current address approved a change to `newEmail` in the last day (the newest approval, its code typed).
    The new address's code is sent and taken only then, so a code to a new address can never stand without it (one
    asked for before the approval step existed included). */
export async function approvedFor(staffId: string, newEmail: string): Promise<boolean> {
  const { rows } = await (await db()).query(
    `SELECT new_email, confirmed_at FROM email_codes WHERE ref = $1 AND purpose = 'staff-change-old' AND created_at > now() - interval '1 day'
      ORDER BY id DESC LIMIT 1`,
    [emailApproveRef(staffId)],
  );
  const r = rows[0];
  return !!r?.confirmed_at && !!r.new_email && emailKey(String(r.new_email)) === emailKey(newEmail);
}

/** Sends the code that confirms a staff member's new email, to that new address (after the current one approved it) */
export function sendEmailChangeCode(req: NextRequest, staffId: string, newEmail: string, lang: unknown): Promise<SendResult> {
  const w = wordsIn(lang, (l) => staffEmailCodeEmail(l, CODE_MINUTES));
  return sendCodeEmail(req, "staff-change", emailChangeRef(staffId), newEmail, w.lang, "", w.words);
}

/** The new email a staff member asked for and hasn't confirmed or given up yet (the last day), or null; `live`: its code
    still works now */
export async function pendingStaffEmail(staffId: string): Promise<{ email: string; live: boolean } | null> {
  const { rows } = await (await db()).query(
    `SELECT new_email, confirmed_at, cancelled_at, (used_at IS NULL AND expires_at > now()) AS live FROM email_codes
      WHERE ref = $1 AND purpose = 'staff-change' AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 1`,
    [emailChangeRef(staffId)],
  );
  const r = rows[0];
  return r && !r.confirmed_at && !r.cancelled_at && r.new_email ? { email: String(r.new_email), live: !!r.live } : null;
}

/** Another staff member has this email */
export async function staffEmailTaken(email: string, staffId: string): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT 1 FROM staff WHERE email_hash = $1 AND id <> $2`, [emailKey(email), staffId]);
  return rows.length > 0;
}

/** Moves the member to the confirmed new email. "taken": another member got it meanwhile. */
export async function saveStaffEmail(staffId: string, email: string): Promise<"ok" | "taken"> {
  try {
    await (await db()).query(`UPDATE staff SET email = $2, email_hash = $3, email_confirmed_at = now() WHERE id = $1`, [staffId, seal(email), emailKey(email)]);
    /* the remembered browsers were tied to the old email: each asks for a code to the new one next time */
    await forgetDevices(staffId);
    return "ok";
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return "taken";
    throw e;
  }
}

/** After the email changed: a notice to the OLD address, so a change the member didn't make is found out at once */
export function noticeOldStaffEmail(oldEmail: string, newEmail: string, lang: unknown): void {
  if (!oldEmail.includes("@")) return;
  const w = wordsIn(lang, (l) => staffEmailChangedEmail(l, maskEmail(newEmail)));
  sendEmailSoon({ to: oldEmail, lang: w.lang, ...w.words }, "the staff email-changed notice");
}

/* ---------------- remembered browsers (owner decision, 2026-11-22) ----------------
   Once the member typed the emailed code on a browser, that browser is remembered: a random token in the
   dukkan-diwan-device cookie (httpOnly, SameSite=Strict, sent to /api/diwan/auth/* only, 365 days), its hash in
   staff_devices. At a later sign-in there (app/api/diwan/auth/login), the right password alone starts the session, but
   only for the member it was made for, before it runs out, while the account still has the password and the email it
   had then, and not with a temporary password. The password is always asked. A password change, an email change and
   taking access away forget all the member's browsers (forgetDevices); signing out does not. At most 10 a member: the
   one used longest ago goes first. */

export const DEVICE_COOKIE = "dukkan-diwan-device";
const DEVICE_DAYS = 365;
const DEVICE_MAX = 10;
const deviceHash = (req: NextRequest): string | null => {
  const t = req.cookies.get(DEVICE_COOKIE)?.value;
  return t && t.length <= 100 ? tokenHash(t) : null;
};

/** Remembers this browser for the member, after the right code. Kept only while the account still has `passwordHash`
    and is active; the email it is tied to is the account's own at that moment. */
export async function rememberDevice(res: NextResponse, req: NextRequest, staffId: string, passwordHash: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  /* the token this browser held before (another member's too: a browser holds one) is of no use any more */
  const old = deviceHash(req);
  if (old) await pool.query(`DELETE FROM staff_devices WHERE token_hash = $1`, [old]);
  const r = await pool.query(
    `INSERT INTO staff_devices (token_hash, staff_id, password_hash, email_hash, expires_at)
     SELECT $1, id, password_hash, email_hash, now() + make_interval(days => $4) FROM staff WHERE id = $2 AND password_hash = $3 AND active FOR SHARE`,
    [tokenHash(token), staffId, passwordHash, DEVICE_DAYS],
  );
  if (!r.rowCount) return;
  await pool.query(
    `DELETE FROM staff_devices WHERE token_hash IN (
       SELECT token_hash FROM staff_devices WHERE staff_id = $1 ORDER BY last_used_at DESC, created_at DESC OFFSET $2)`,
    [staffId, DEVICE_MAX],
  );
  if (Math.random() < 0.1) pool.query(`DELETE FROM staff_devices WHERE expires_at < now()`).catch(() => {});
  res.cookies.set(DEVICE_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: secureCookies(req), path: WAIT_PATH, maxAge: DEVICE_DAYS * 86400 });
}

/** True when this browser is remembered for this member, whose password was just checked against `passwordHash`: not run
    out, made with the account's current password and email, the account active and not on a temporary password. Its
    last use is written. */
export async function deviceRemembered(req: NextRequest, staffId: string, passwordHash: string): Promise<boolean> {
  const hash = deviceHash(req);
  if (!hash) return false;
  const r = await (await db()).query(
    `UPDATE staff_devices d SET last_used_at = now() FROM staff s
      WHERE d.token_hash = $1 AND d.staff_id = $2 AND s.id = d.staff_id AND d.expires_at > now()
        AND s.password_hash = $3 AND d.password_hash = s.password_hash AND d.email_hash = s.email_hash
        AND s.active AND NOT s.must_change_password`,
    [hash, staffId, passwordHash],
  );
  return r.rowCount === 1;
}

/** Forgets the member's remembered browsers (all, or all but this one). `q`: a transaction's client, else the pool.
    The number forgotten. */
export async function forgetDevices(
  staffId: string,
  { q, keep }: { q?: { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number | null }> }; keep?: NextRequest } = {},
): Promise<number> {
  const runner = q ?? (await db());
  const r = await runner.query(`DELETE FROM staff_devices WHERE staff_id = $1 AND token_hash <> $2`, [staffId, (keep && deviceHash(keep)) ?? ""]);
  return r.rowCount ?? 0;
}
