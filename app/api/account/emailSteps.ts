import type { NextRequest } from "next/server";
import { emailKey } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmailSoon } from "@/server/email";
import { type CodeLang, maskEmail, sendCodeEmail, type SendResult } from "@/server/emailVerify";

/* A new email asked for in Settings, in its steps (app/api/account PUT starts it, app/api/account/email goes on):
   - "old" (only while 2-step sign-in is on): the change is first approved with a code sent to the CURRENT email (ref
     "co:<account id>"), or with a recovery code. Someone who has the password and an open session, but not the mailbox,
     can then never move the account (and its sign-in codes) to an address of his own.
   - "new": a code to the new email proves it is typed right and belongs to him (ref "c:<account id>"); typing it moves
     the account there (app/api/account/email).
   The "old" step's code row carries the new email it approves (email_codes.new_email, sealed), so a reload, another
   device or the next step all know which address is waiting, and nothing is kept in the server's memory. It is written
   when the code is made and never changed: the code approves that address only. */

export const oldRef = (accountId: string) => `co:${accountId}`;
export const newRef = (accountId: string) => `c:${accountId}`;

/** The new email waiting for the current email's approval (the last day, not approved or given up yet), or null; `live`:
    a code for it is still good now (false: it could not be sent, or it ran out: only a new code helps) */
export async function pendingOldStep(accountId: string): Promise<{ email: string; live: boolean } | null> {
  const { rows } = await (await db()).query(
    `SELECT new_email, confirmed_at, cancelled_at, (used_at IS NULL AND expires_at > now()) AS live FROM email_codes
      WHERE ref = $1 AND purpose = 'change-old' AND created_at > now() - interval '1 day' ORDER BY id DESC LIMIT 1`,
    [oldRef(accountId)],
  );
  const r = rows[0];
  return r && !r.confirmed_at && !r.cancelled_at && r.new_email ? { email: String(r.new_email), live: !!r.live } : null;
}

/** Sends the approval code to the account's current email for a change to `newEmail`. The new email is written on the
    code's row when it is made and never changed after, and is part of the code (server/emailVerify.ts sendCodeEmail): a
    code approves that one address only, and asking for another address ends it and sends a new one. */
export async function sendOldStep(req: NextRequest, accountId: string, current: string, newEmail: string, lang: CodeLang): Promise<SendResult> {
  return sendCodeEmail(req, "change-old", oldRef(accountId), current, lang, newEmail);
}

/** The waiting approval was given with a recovery code instead of the emailed one: its row is marked approved, so it is
    no longer waiting and its code can't be used any more. Only while it still approves `newEmail` (the address the page
    showed): the new email it approved, or null when another address is waiting by now (nothing is approved). */
export async function approveOldStep(accountId: string, newEmail: string): Promise<string | null> {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, new_email FROM email_codes WHERE ref = $1 ORDER BY id DESC LIMIT 1`,
    [oldRef(accountId)],
  );
  const r = rows[0];
  if (!r?.new_email || emailKey(String(r.new_email)) !== emailKey(newEmail)) return null;
  const done = await pool.query(
    `UPDATE email_codes SET used_at = COALESCE(used_at, now()), confirmed_at = now()
      WHERE id = $2 AND ref = $1 AND confirmed_at IS NULL AND cancelled_at IS NULL
        AND id = (SELECT id FROM email_codes WHERE ref = $1 ORDER BY id DESC LIMIT 1)`,
    [oldRef(accountId), r.id],
  );
  return done.rowCount === 1 ? String(r.new_email) : null;
}

/** Another account has this email (checked before any code is sent, and again before each step) */
export async function emailTaken(email: string, accountId: string): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT 1 FROM accounts WHERE email_hash = $1 AND id <> $2`, [emailKey(email), accountId]);
  return rows.length > 0;
}

/** What the page is told about a code it asked for: sent, could not be sent (a new one can be asked for), or refused for
    now ("slow-down", "locked"). `waiting`: a code is really waiting to be typed, or can be sent again from the page
    (only then does the page show the box asking for it). */
export function sentState(sent: SendResult, stillWaiting: boolean): { sent: "sent" | "failed" | "slow-down" | "locked"; waiting: boolean } {
  const s = sent === "sent" ? "sent" : sent === "failed" ? "failed" : sent === "locked" ? "locked" : "slow-down";
  return { sent: s, waiting: s === "sent" || s === "failed" || (s === "slow-down" && stillWaiting) };
}

/* FSI … PDI: an address keeps its own left-to-right order inside an Arabic sentence */
const isolate = (s: string) => `⁨${s}⁩`;

/** After the email changed: a notice to the OLD address, in the language of the page, so the owner hears of a change he
    did not make (the new address is partly hidden: whoever reads the old mailbox only needs to know it moved) */
export function noticeOldEmail(oldEmail: string, newEmail: string, lang: CodeLang): void {
  if (!oldEmail.includes("@")) return;
  const masked = maskEmail(newEmail);
  const e =
    lang === "ar"
      ? {
          subject: "تغيّر البريد الإلكتروني لحسابك في دكان",
          heading: "تغيّر بريد حسابك",
          text: `تغيّر البريد الإلكتروني لحسابك في دكان إلى ${isolate(masked)}.
من الآن تصل رسائل دكان ورموز تسجيل الدخول إلى البريد الجديد، لا إلى هذا البريد.
إذا لم تكن أنت من غيّره، فغيّر كلمة المرور فورًا وتواصل مع دعم دكان.`,
        }
      : {
          subject: "Your Dukkan email was changed",
          heading: "Your account's email was changed",
          text: `The email of your Dukkan account was changed to ${masked}.
From now on, Dukkan's emails and sign-in codes go to the new address, not to this one.
If it wasn't you, change your password right away and contact Dukkan support.`,
        };
  sendEmailSoon({ to: oldEmail, ...e, lang }, "the email-changed notice");
}
