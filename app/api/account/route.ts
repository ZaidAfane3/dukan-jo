import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanDate, cleanLine, emailOf, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS, DOB_MIN } from "@/components/safeAccount";
import { answer, checkPassword, clearFailures, currentAccount, failedTooOften, guarded, noteFailure, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, NAME_KEYS_VERSION, nameKeys, phoneKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { emailOn } from "@/server/email";
import { endCodes, pendingEmailChange, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { logMerchant } from "@/server/merchantLog";
import { emailTaken, newRef, oldRef, pendingOldStep, sendOldStep, sentState } from "./emailSteps";

export const dynamic = "force-dynamic";

/* The merchant's own profile from the settings page: name, email and mobile (the same rules as signing up), and the
   optional date of birth, gender and city. An email or mobile another account has is refused: "taken" (email) or
   "taken-phone". Changing the email or the mobile (what the account signs in with) also needs the account's password,
   sent as `password`: without it "password-needed", with a wrong one "wrong-password" (403), so someone at an unlocked
   screen can't quietly make the account his. A new email takes effect only once its code is typed
   (app/api/account/email; `lang`, optional, is the language of the emails): until then the account keeps its old email,
   and the answer says so in emailChange { step, email, sent, waiting }:
   - step "old" (2-step sign-in is on): a code went to the CURRENT email first, to approve the change (emailSteps.ts);
   - step "new": the code went to the new email;
   - sent: "sent", "failed" (a new one can be asked for), "slow-down" or "locked" (refused for now: no code);
   - waiting: a code is waiting to be typed (or can be sent again): only then does the page ask for it.
   `check: true` only checks (the password, an email or mobile another account has) and keeps nothing: the page asks it
   before changing the password in the same save, so a refused email never leaves a changed password behind.
   Answers "ok" with the profile, "invalid", "none" (signed out). */

/* all stored encrypted (server/crypto.ts) and opened by db(); dob is kept as "YYYY-MM-DD" text */
const PROFILE = `name, email, phone, city, gender, COALESCE(dob, '') AS dob`;
const shape = (r: Record<string, string>) => ({ name: r.name, email: r.email, phone: r.phone, dob: r.dob, gender: r.gender, city: r.city });

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const { rows } = await (await db()).query(`SELECT ${PROFILE} FROM accounts WHERE id = $1`, [a.id]);
  return answer({ result: "ok", profile: shape(rows[0]) });
});

export const PUT = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "account-profile", 30, 15)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 4_000);
  const email = emailOf(body?.email);
  /* a name longer than the limit is refused, never cut (the page says so while it is typed) */
  const nameTooLong = cleanLine(body?.name, 100_000).length > ACCOUNT_LIMITS.name;
  const name = cleanLine(body?.name, ACCOUNT_LIMITS.name);
  const phone = typeof body?.phone === "string" && isJordanMobile(body.phone) ? savedMobile(body.phone) : "";
  const today = new Date().toISOString().slice(0, 10);
  const dobIn = body?.dob ?? "";
  const dob = cleanDate(dobIn, DOB_MIN, today);
  const gender = body?.gender === "male" || body?.gender === "female" ? body.gender : body?.gender === "" || body?.gender == null ? "" : null;
  const city = cleanLine(body?.city ?? "", ACCOUNT_LIMITS.city);
  if (!email || nameTooLong || visibleLength(name) < 2 || !phone || (dobIn !== "" && !dob) || gender === null) return answer({ result: "invalid" }, 400);

  /* a new email or mobile: the password again first (a few wrong tries, then a wait, like signing in) */
  const pool = await db();
  const cur = await pool.query(`SELECT email, email_hash, phone_hash, password_hash, name, dob, gender, city FROM accounts WHERE id = $1`, [a.id]);
  if (!cur.rows[0]) return answer({ result: "none" }, 401);
  if (cur.rows[0].email_hash !== emailKey(email) || cur.rows[0].phone_hash !== phoneKey(phone)) {
    const who = `account-identity:${a.id}`;
    if (failedTooOften(who, 5)) return answer({ result: "slow-down" }, 429);
    const password = body?.password;
    if (typeof password !== "string" || !password) return answer({ result: "password-needed" }, 403);
    /* counted before the check (as signing in does), so tries sent all at once can't all get past the limit */
    noteFailure(who, 15);
    if (password.length > 128 || !(await checkPassword(password, cur.rows[0].password_hash))) return answer({ result: "wrong-password" }, 403);
    clearFailures(who);
  }

  const newEmail = cur.rows[0].email_hash !== emailKey(email);
  /* a new email waits for its code while Dukkan can send one (on the dev server the code is in its console); without
     email it takes effect at once, since nothing could confirm it */
  const byCode = newEmail && (emailOn() || process.env.NODE_ENV === "development");
  if (newEmail && (await emailTaken(email, a.id))) return answer({ result: "taken" }, 409);
  if (body?.check === true) {
    const { rows: other } = await pool.query(`SELECT 1 FROM accounts WHERE phone_hash = $1 AND id <> $2`, [phoneKey(phone), a.id]);
    return other.length ? answer({ result: "taken-phone" }, 409) : answer({ result: "ok", check: true });
  }
  const newPhone = cur.rows[0].phone_hash !== phoneKey(phone);
  /* the email is written only when it changes here and now (no code to wait for): a save that keeps it never writes
     the email it read back, which could undo a new email confirmed meanwhile (app/api/account/email) */
  const setEmail = newEmail && !byCode;
  try {
    const { rows } = await pool.query(
      `UPDATE accounts SET name = $2, phone = $3, dob = $4, gender = $5, city = $6, phone_hash = $7, name_keys = $8, name_keys_v = $9
              ${setEmail ? ", email = $10, email_hash = $11" : ""}
        WHERE id = $1 RETURNING ${PROFILE}`,
      [
        a.id, seal(name), seal(phone), seal(dob || null), seal(gender), seal(city), phoneKey(phone), nameKeys(name), NAME_KEYS_VERSION,
        ...(setEmail ? [seal(email), emailKey(email)] : []),
      ],
    );
    /* a password reset asked for at the old email or mobile no longer works: whoever still has that mailbox can't use it
       (for an email waiting for its code this happens when it takes effect: app/api/account/email) */
    if ((newEmail && !byCode) || newPhone) await pool.query(`UPDATE password_resets SET used_at = now() WHERE account_id = $1 AND used_at IS NULL`, [a.id]);
    /* the code(s) for a new email (see the top): with 2-step on, the current email approves it first, unless that was
       done already for this same address (its code to the new email is what waits now) */
    let change: { step: "old" | "new"; email: string; to?: string; sent: string; waiting: boolean } | null = null;
    if (byCode) {
      const lang = verifyLang(req, body?.lang);
      const current = String(cur.rows[0].email);
      const approved = (await pendingEmailChange(a.id)) === email;
      if (a.totpOn && !approved) {
        const sent = await sendOldStep(req, a.id, current, email, lang);
        const st = sentState(sent, (await pendingOldStep(a.id))?.email === email);
        /* a new ask replaces a change to another address still waiting for its own code */
        if (st.waiting) await endCodes(newRef(a.id), true);
        change = { step: "old", email, to: current, ...st };
      } else {
        const sent = await sendCodeEmail(req, "change", newRef(a.id), email, lang);
        const st = sentState(sent, (await pendingEmailChange(a.id)) === email);
        if (st.waiting) await endCodes(oldRef(a.id), true);
        change = { step: "new", email, ...st };
      }
    }
    /* the merchant log: what changed, by name only (his new email once it is confirmed: app/api/account/email) */
    const was = cur.rows[0];
    if (newEmail && change) logMerchant(a.id, "email.change-asked", { to: email, sent: change.sent === "sent", step: change.step });
    else if (newEmail) logMerchant(a.id, "email.change", { from: String(was.email ?? ""), to: email });
    if (newPhone) logMerchant(a.id, "phone.change");
    const fields = [
      ["name", String(was.name ?? ""), name],
      ["birthday", String(was.dob ?? ""), dob || ""],
      ["gender", String(was.gender ?? ""), gender],
      ["city", String(was.city ?? ""), city],
    ].filter(([, from, to]) => from !== to).map(([k]) => k);
    if (fields.length) logMerchant(a.id, "profile.change", { fields: fields.join(",") });
    return answer({
      result: "ok",
      profile: shape(rows[0]),
      ...(change ? { emailChange: change } : {}),
    });
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") return answer({ result: err.constraint === "accounts_phone_hash" ? "taken-phone" : "taken" }, 409);
    throw e;
  }
});
