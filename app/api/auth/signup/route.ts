import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanLine, emailOf, passwordProblem, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, guarded, hashPassword, noteLogin, readJson, sameOrigin, startSession, tooMany, tooManyFor } from "@/server/auth";
import { emailKey, NAME_KEYS_VERSION, nameKeys, phoneKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { SEND_PER_ACCOUNT, SEND_PER_IP, sendVerifyCode, startsVerified, verifyLang } from "@/server/emailVerify";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Makes an account and signs in to it. The same rules as the sign-up form (SignupForm.tsx), checked again here because
   anything in the browser can be skipped. Answers: "ok", "taken" (the email has an account), "taken-phone" (the
   mobile has one), "invalid". The new shop gets its row in shops (for Diwan); Dukkan has no plans or free trial, so nothing
   else is started for it. While Dukkan can send email (server/email.ts emailOn) the account starts with its email not
   confirmed and the code goes out at once, without being waited for (server/emailVerify.ts); with email off it starts
   confirmed, since nothing could confirm it. `lang` ("ar" / "en", optional): the language of that email (else the
   browser's language). */
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
  const verified = startsVerified();
  let id: string;
  try {
    /* email, name and mobile are stored encrypted; their fingerprints keep them unique (server/crypto.ts), and the
       fingerprints of the name's words let Diwan find the owner by name */
    const { rows } = await pool.query(
      `INSERT INTO accounts (email, name, phone, email_hash, phone_hash, password_hash, name_keys, name_keys_v, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [seal(email), seal(name), seal(phone), emailKey(email), phoneKey(phone), await hashPassword(password), nameKeys(name), NAME_KEYS_VERSION, verified],
    );
    id = String(rows[0].id);
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") return answer({ result: err.constraint === "accounts_phone_hash" ? "taken-phone" : "taken" }, 409);
    throw e;
  }
  await pool.query(`INSERT INTO shops (account_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  /* not waited for: the account is made either way, and the dashboard's banner can ask for a new code. Counted as the
     first of the account's sends (app/api/auth/verify-email). */
  if (!verified) {
    tooManyFor(`verify-email-send:${id}`, SEND_PER_ACCOUNT.max, SEND_PER_ACCOUNT.minutes);
    if (!tooMany(req, "verify-email-send", SEND_PER_IP.max, SEND_PER_IP.minutes))
      void sendVerifyCode(id, email, verifyLang(req, body?.lang)).catch((e) => console.error("[signup] the email code could not be made:", (e as Error)?.message ?? e));
  }
  const res = answer({ result: "ok", account: { email, name, phone }, emailVerified: verified, totpOn: false });
  await startSession(res, req, id);
  await noteLogin(id, req);
  touchShop(id);
  return res;
});
