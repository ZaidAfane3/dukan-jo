import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanLine, emailOf, passwordProblem, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { emailKey, phoneKey } from "@/server/crypto";
import { db } from "@/server/db";
import { emailOn } from "@/server/email";
import { endCodes, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { makeAccount, signInMade, startPending } from "@/server/signup";

export const dynamic = "force-dynamic";

/* Signing up, step 1. The same rules as the sign-up form (SignupForm.tsx), checked again here because anything in the
   browser can be skipped. Answers "taken" (the email has an account), "taken-phone" (the mobile has one), "invalid",
   "slow-down" (too many sign-ups from here).
   While Dukkan can send email (server/email.ts emailOn; on the dev server the code is shown in its console) nothing is
   made yet: the sign-up waits (server/signup.ts) and a 6-digit code goes to the email (in `lang`, else the page's
   language). Answers "code" with the address; step 2 is app/api/auth/signup/code. "email-slow-down": too many codes
   went to this address lately; "send-failed": the email could not be sent (often a mistyped address); "locked": too
   many wrong codes from this visitor in the last hour, so no code is sent (server/emailVerify.ts). All three leave
   nothing waiting.
   On a live server without email the account is made at once and signed in ("ok"), since nothing could confirm it. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "signup", 10, 60)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 4_000);
  const email = emailOf(body?.email);
  /* a name longer than the limit is refused, never cut (the page says so while it is typed) */
  const nameTooLong = cleanLine(body?.name, 100_000).length > ACCOUNT_LIMITS.name;
  const name = cleanLine(body?.name, ACCOUNT_LIMITS.name);
  const phone = typeof body?.phone === "string" && isJordanMobile(body.phone) ? savedMobile(body.phone) : "";
  const password = body?.password;
  if (!email || nameTooLong || visibleLength(name) < 2 || !phone || typeof password !== "string" || passwordProblem(password)) {
    return answer({ result: "invalid" }, 400);
  }

  const pool = await db();
  const emailHash = emailKey(email);
  const phoneHash = phoneKey(phone) ?? "";
  /* told before any code is sent, as before: the form shows it under the field */
  const { rows: taken } = await pool.query(`SELECT email_hash = $1 AS email FROM accounts WHERE email_hash = $1 OR phone_hash = $2 LIMIT 1`, [emailHash, phoneHash]);
  if (taken[0]) return answer({ result: taken[0].email ? "taken" : "taken-phone" }, 409);
  const fields = { email, emailHash, name, phone, phoneHash, passwordHash: await hashPassword(password) };

  if (!emailOn() && process.env.NODE_ENV !== "development") {
    const made = await makeAccount({
      id: "0", ref: "", email, email_hash: emailHash, name, phone, phone_hash: phoneHash, password_hash: fields.passwordHash,
      name_keys: null, name_keys_v: 0, account_id: null,
    });
    if (made.result !== "ok") return answer({ result: made.result }, 409);
    const res = answer({ result: "ok", account: { email, name, phone }, totpOn: false });
    await signInMade(res, req, made.id);
    return res;
  }

  const res = answer({ result: "code", email });
  const { id, ref } = await startPending(res, req, fields);
  const sent = await sendCodeEmail(req, "signup", ref, email, verifyLang(req, body?.lang));
  if (sent === "sent") return res;
  /* nothing was sent: nothing stays waiting */
  await pool.query(`DELETE FROM signup_pending WHERE id = $1`, [id]);
  await endCodes(ref);
  return answer({ result: sent === "failed" ? "send-failed" : sent === "locked" ? "locked" : "email-slow-down" }, sent === "failed" ? 502 : 429);
});
