import { randomInt, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { blind, emailKey } from "./crypto";
import { db } from "./db";
import { codeMailLimited, emailOn, sendEmailSoon } from "./email";

/* A merchant's email, confirmed by a one-time code (app/api/auth/verify-email). A new account starts unconfirmed while
   Dukkan can send email (server/email.ts emailOn) and gets a code at once; so does a change of the email in settings.
   Every account from before this (and every account made while email is off) counts as confirmed, so nobody is held
   back by something Dukkan can't send. While it is not confirmed, the store can't go live (app/api/store PUT
   "not-ready" with "email"); a store already live is never taken offline for it.

   As for a forgotten password (server/passwordReset.ts): a 6-digit code, kept only as an HMAC with the server's key
   (crypto.ts blind) of the account, the address it went to and the code; it lives 10 minutes, takes at most 5 tries and
   works once. Unlike there, the merchant is signed in, so nobody else can ask for his codes: a new code ends the ones
   before it. Wrong tries are also counted for the account across all its codes (ACCOUNT_TRIES in an hour), so asking
   for new codes doesn't give new tries. A code confirms only the address it was sent to: once the email changes, the
   codes sent before confirm nothing. */

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
/* tries per account in an hour, across all its codes */
export const ACCOUNT_TRIES = 10;
/* asking for a code: per account, and per address */
export const SEND_PER_ACCOUNT = { max: 3, minutes: 15 };
export const SEND_PER_IP = { max: 10, minutes: 60 };

export type VerifyLang = "ar" | "en";

/** The language of the email: what the page asked for, else the browser's own language, else Arabic */
export function verifyLang(req: NextRequest, asked?: unknown): VerifyLang {
  if (asked === "en" || asked === "ar") return asked;
  const first = (req.headers.get("accept-language") ?? "").trim().slice(0, 2).toLowerCase();
  return first === "en" ? "en" : "ar";
}

/** A new or changed email starts unconfirmed, whether email is on or not: nothing proved it. While email is off this
    holds nobody back (emailUnconfirmed is false then); once it is on, that address is asked to confirm before it gets
    reset codes or notices, and before the store goes live. Accounts from before confirmation existed stay confirmed. */
export const startsVerified = (): boolean => false;

/** Whether this account still has to confirm its email: never while email is off (nothing could confirm it) */
export async function emailUnconfirmed(accountId: string): Promise<boolean> {
  if (!emailOn()) return false;
  const { rows } = await (await db()).query(`SELECT email_verified FROM accounts WHERE id = $1`, [accountId]);
  return rows[0] ? rows[0].email_verified === false : false;
}

/** The words of the email. `changed`: the account's email was just changed (not a new account). */
export function verifyWords(lang: VerifyLang, changed = false) {
  return lang === "ar"
    ? {
        subject: "أكّد بريدك في دكّان",
        heading: "تأكيد البريد الإلكتروني",
        text: `${changed ? "هذا رمز تأكيد بريدك الإلكتروني الجديد في دكّان." : "أهلًا بك في دكّان! هذا رمز تأكيد بريدك الإلكتروني."}\nاكتبه في لوحة التحكم، وينتهي خلال ${CODE_MINUTES} دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.`,
      }
    : {
        subject: "Confirm your Dukkan email",
        heading: "Confirm your email",
        text: `${changed ? "Here is the code to confirm your new Dukkan email address." : "Welcome to Dukkan! Here is the code to confirm your email address."}\nType it on your dashboard. It expires in ${CODE_MINUTES} minutes.\nIf you didn't ask for it, you can ignore this email.`,
      };
}

const codeHash = (accountId: string, emailHash: string, code: string) => blind(`verify-code:${accountId}:${emailHash}:${code}`);
const sameHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Makes a new code for the account's email (ending the codes before it) and sends it, without waiting for the send:
    a slow provider never slows the answer, and its failure is logged without the code (server/email.ts). Does nothing
    while email is off. */
export async function sendVerifyCode(accountId: string, email: string, lang: VerifyLang, changed = false): Promise<"sent" | "slow-down" | "off"> {
  if (!emailOn()) return "off";
  /* past the cap for this address nothing changes: the code already sent keeps working, and the caller says "slow-down" */
  if (codeMailLimited(email)) return "slow-down";
  const pool = await db();
  const key = emailKey(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE email_verifications SET used_at = now() WHERE account_id = $1 AND used_at IS NULL`, [accountId]);
    await client.query(
      `INSERT INTO email_verifications (account_id, email_hash, code_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [accountId, key, codeHash(accountId, key, code), CODE_MINUTES],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  /* now and then, clear out what ran out more than a day ago */
  if (Math.random() < 0.05) pool.query(`DELETE FROM email_verifications WHERE expires_at < now() - interval '1 day'`).catch(() => {});
  const w = verifyWords(lang, changed);
  sendEmailSoon({ to: email, subject: w.subject, heading: w.heading, text: w.text, lang, code }, "the email confirmation code");
  return "sent";
}

export type VerifyResult = "ok" | "wrong" | "expired" | "too-many";

/* the account's code still good for its email now: one at most (a new code ends the ones before it) */
const LIVE = `account_id = $1 AND email_hash = $2 AND used_at IS NULL AND expires_at > now()`;

/** Checks a code typed by the signed-in account against the code sent to its email now. "ok" also when the email was
    already confirmed. */
export async function checkVerifyCode(accountId: string, email: string, code: string): Promise<VerifyResult> {
  const pool = await db();
  const key = emailKey(email);
  const { rows: acct } = await pool.query(`SELECT email_verified FROM accounts WHERE id = $1`, [accountId]);
  if (acct[0]?.email_verified) return "ok";
  /* one try more, counted before the code is compared, so tries sent at the same moment can't go past the limit; and not
     at all once the account had ACCOUNT_TRIES tries in the last hour, whatever codes they were on */
  const { rows } = await pool.query(
    `UPDATE email_verifications SET attempts = attempts + 1
      WHERE id = (SELECT id FROM email_verifications WHERE ${LIVE} ORDER BY id DESC LIMIT 1) AND attempts < $3
        AND (SELECT COALESCE(sum(q.attempts), 0) FROM email_verifications q
              WHERE q.account_id = $1 AND q.created_at > now() - interval '1 hour') < $4
      RETURNING id, code_hash, attempts`,
    [accountId, key, CODE_TRIES, ACCOUNT_TRIES],
  );
  const r = rows[0] as { id: string; code_hash: string; attempts: number } | undefined;
  if (!r) {
    /* the tries are used up (this code's, or the account's for the hour), or there is no good code (never sent, ran out,
       used, or sent to the email before) */
    const { rows: live } = await pool.query(`SELECT 1 FROM email_verifications WHERE ${LIVE} LIMIT 1`, [accountId, key]);
    return live.length ? "too-many" : "expired";
  }
  if (!sameHex(codeHash(accountId, key, code), r.code_hash)) return r.attempts >= CODE_TRIES ? "too-many" : "wrong";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const used = await client.query(`UPDATE email_verifications SET used_at = now() WHERE id = $1 AND used_at IS NULL`, [r.id]);
    /* only while the account still has the email the code went to */
    const set = used.rowCount === 1 ? await client.query(`UPDATE accounts SET email_verified = true WHERE id = $1 AND email_hash = $2`, [accountId, key]) : null;
    if (!set || set.rowCount !== 1) {
      await client.query("ROLLBACK");
      return "expired";
    }
    await client.query(`UPDATE email_verifications SET used_at = now() WHERE account_id = $1 AND used_at IS NULL`, [accountId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return "ok";
}
