import { codeMailLimited, emailOn } from "./email";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { savedMobile } from "@/components/phone";
import { emailOf } from "@/components/safe";
import { clearFailures, hashPassword, visitorIp } from "./auth";
import { blind, emailKey, phoneKey } from "./crypto";
import { db } from "./db";
import { canSendCode, phoneCodesByEmail, sendCode, type CodeChannel, type CodeLang } from "./sendCode";

/* A forgotten password, by a one-time code (app/api/auth/reset/...). The merchant types the email or mobile of his
   account, gets a 6-digit code there (server/sendCode.ts), types it, and picks a new password.

   - Nobody can learn from it which emails and mobiles have an account: asking for a code always answers the same, after
     about the same wait, and a row is written either way (for an unknown email or mobile its code can never match), so
     checking a code answers "wrong", "expired" and "too-many" the same way too.
   - The code is kept only as an HMAC with the server's key (crypto.ts blind), lives 10 minutes, takes at most 5 tries
     and works once. Asking again does not end a code that is still good (someone who only knows the email must not be
     able to cancel the owner's code by asking for new ones): every good code of that email or mobile works, until one
     of them is used. Wrong tries are also counted for the account across all its codes (and for an email or mobile
     nobody has, across that one's codes): ACCOUNT_CODE_TRIES in an hour, then no code is checked until the hour has
     passed, so asking for new codes doesn't give new tries.
   - A right code gives a reset token (32 random bytes; only its SHA-256 is kept) good for one password change within 15
     minutes. Changing the password ends every session of the account (on every device), and the sign-in that follows
     still asks for the 2-step code when the account has it on: nothing here signs anyone in. */

export const CODE_MINUTES = 10;
export const TOKEN_MINUTES = 15;
export const CODE_TRIES = 5;
/* tries per account (or per unknown email or mobile) in an hour, across all its codes */
export const ACCOUNT_CODE_TRIES = 10;

/* asking for a code: per email or mobile, and per address */
export const SEND_PER_CONTACT = { max: 3, minutes: 15 };
export const SEND_PER_IP = { max: 10, minutes: 60 };

export type Contact = { channel: CodeChannel; saved: string; key: string };

/** What was typed, as an email (lower case) or a Jordan mobile in its saved form (+9627XXXXXXXX), with its fingerprint;
    null when it is neither */
export function contactOf(v: unknown): Contact | null {
  if (typeof v !== "string" || v.length > 254) return null;
  const mobile = savedMobile(v);
  if (mobile) return { channel: "phone", saved: mobile, key: phoneKey(mobile) as string };
  const email = emailOf(v);
  return email ? { channel: "email", saved: email, key: emailKey(email) } : null;
}

/** The language the code's message is written in: Arabic unless English was asked for */
export const codeLang = (v: unknown): CodeLang => (v === "en" ? "en" : "ar");

/* the address the request came from (as tooMany in server/auth.ts reads it), kept only as a keyed fingerprint */
const ipOf = (req: NextRequest) => visitorIp(req);
const ipHash = (req: NextRequest) => blind(`reset-ip:${ipOf(req)}`);

const codeHash = (contactKey: string, code: string) => blind(`reset-code:${contactKey}:${code}`);
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");
const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const canSendTo = (c: Contact) => canSendCode(c.channel);

/** Makes a new code for this email or mobile and sends it when an account has it. Gives nothing back on purpose: the
    route answers the same either way. */
export async function requestCode(req: NextRequest, c: Contact, lang: CodeLang): Promise<void> {
  const pool = await db();
  const col = c.channel === "phone" ? "phone_hash" : "email_hash";
  const { rows } = await pool.query(`SELECT id, email, phone, email_verified FROM accounts WHERE ${col} = $1 LIMIT 1`, [c.key]);
  const a = rows[0] as { id: string; email: string; phone: string; email_verified: boolean } | undefined;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  /* nobody has it: a code nobody knows, so this row can never be used, but it answers like a real one */
  const hash = a ? codeHash(c.key, code) : codeHash(c.key, randomBytes(16).toString("hex"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    /* the older codes stay good until they run out or one is used (see the top of this file) */
    await client.query(
      `INSERT INTO password_resets (account_id, contact_hash, code_hash, channel, expires_at, ip_hash)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5), $6)`,
      [a ? a.id : null, c.key, hash, c.channel, CODE_MINUTES, ipHash(req)],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  /* now and then, clear out what ran out more than a day ago */
  if (Math.random() < 0.05)
    pool.query(`DELETE FROM password_resets WHERE expires_at < now() - interval '1 day' AND (token_expires_at IS NULL OR token_expires_at < now() - interval '1 day')`).catch(() => {});
  if (!a) return;
  /* sent to what the account has (the same as what was typed, in its saved form). Not waited for: a slow provider must
     not make a real account answer later than an unknown one. Its failure is logged without the code. */
  const byEmail = c.channel === "phone" && phoneCodesByEmail();
  /* a code by email goes only to a confirmed address: an email changed to a mistyped one (someone else's) must not let
     that person reset the password and take the account. The answer stays "sent" either way (nothing is told); the
     owner of an unconfirmed address asks Dukkan support. */
  if ((c.channel === "email" || byEmail) && emailOn() && (!a.email_verified || codeMailLimited(a.email))) return;
  const to = c.channel === "phone" && !byEmail ? a.phone : a.email;
  void sendCode(byEmail ? "email" : c.channel, to, code, lang).catch((e) => console.error("[reset] the code could not be sent:", (e as Error)?.message ?? e));
}

export type CheckResult = { result: "ok"; token: string } | { result: "wrong" | "expired" | "too-many" };

/* the codes still good for this email or mobile (asked for in the last CODE_MINUTES, so a few at most), newest first */
const LIVE = `contact_hash = $1 AND used_at IS NULL AND verified_at IS NULL AND expires_at > now()`;

/** Checks a code typed for this email or mobile against its codes that are still good */
export async function checkCode(c: Contact, code: string): Promise<CheckResult> {
  const pool = await db();
  /* one try more, counted on the newest good code before the code is compared, so tries sent at the same moment can't go
     past its limit; and not at all once the account (its email and its mobile together) or this email or mobile had
     ACCOUNT_CODE_TRIES tries in the last hour, whatever codes they were on */
  const { rows } = await pool.query(
    `UPDATE password_resets p SET attempts = attempts + 1
      WHERE id = (SELECT id FROM password_resets WHERE ${LIVE} ORDER BY id DESC LIMIT 1) AND attempts < $2
        AND (SELECT COALESCE(sum(q.attempts), 0) FROM password_resets q
              WHERE (q.contact_hash = $1 OR (p.account_id IS NOT NULL AND q.account_id = p.account_id))
                AND q.created_at > now() - interval '1 hour') < $3
      RETURNING id, account_id, attempts`,
    [c.key, CODE_TRIES, ACCOUNT_CODE_TRIES],
  );
  const r = rows[0] as { id: string; account_id: string | null; attempts: number } | undefined;
  if (!r) {
    /* why not: the tries are used up (this code's, or the account's for the hour), or there is no good code (never
       asked, ran out, used) */
    const { rows: last } = await pool.query(`SELECT 1 FROM password_resets WHERE ${LIVE} LIMIT 1`, [c.key]);
    return { result: last.length ? "too-many" : "expired" };
  }
  const { rows: live } = await pool.query(`SELECT id, code_hash FROM password_resets WHERE ${LIVE} ORDER BY id DESC LIMIT 10`, [c.key]);
  const typed = codeHash(c.key, code);
  /* every good code is compared, whichever matches, so the time taken says nothing about which one */
  let match: string | null = null;
  for (const l of live as { id: string; code_hash: string }[]) if (sameHex(typed, l.code_hash) && match === null) match = String(l.id);
  if (!match || !r.account_id) {
    return { result: r.attempts >= CODE_TRIES ? "too-many" : "wrong" };
  }
  const token = randomBytes(32).toString("base64url");
  const done = await pool.query(
    `UPDATE password_resets SET verified_at = now(), token_hash = $2, token_expires_at = now() + make_interval(mins => $3)
      WHERE id = $1 AND verified_at IS NULL AND used_at IS NULL`,
    [match, tokenHash(token), TOKEN_MINUTES],
  );
  if (done.rowCount !== 1) return { result: "expired" };
  /* one code was used: the others of this email or mobile end with it */
  await pool.query(`UPDATE password_resets SET used_at = now() WHERE ${LIVE} AND id <> $2`, [c.key, match]);
  return { result: "ok", token };
}

/** Sets the new password with a reset token, once. Ends every session of the account. "expired": the token is not
    good (wrong, more than 15 minutes old, or already used). */
export async function setNewPassword(token: string, password: string): Promise<"ok" | "expired"> {
  const pool = await db();
  /* the slow part first, outside the transaction */
  const hash = await hashPassword(password);
  const client = await pool.connect();
  let accountId: string;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, account_id FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND token_expires_at > now() AND account_id IS NOT NULL FOR UPDATE`,
      [tokenHash(token)],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return "expired";
    }
    accountId = String(rows[0].account_id);
    await client.query(`UPDATE accounts SET password_hash = $2 WHERE id = $1`, [accountId, hash]);
    await client.query(`UPDATE password_resets SET used_at = now() WHERE account_id = $1 AND used_at IS NULL`, [accountId]);
    /* signed out everywhere, as a password change in settings signs out the other devices (this browser has no session
       of the account to keep: he signs in next, with the new password and, if it is on, his 2-step code) */
    await client.query(`DELETE FROM sessions WHERE account_id = $1`, [accountId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  /* wrong passwords typed before (by him, or by someone trying) no longer hold back his sign-in with the new one
     (app/api/auth/login counts them under this key) */
  clearFailures(`login:account:${accountId}`);
  return "ok";
}
