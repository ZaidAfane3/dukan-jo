import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanLine, emailOf, passwordProblem, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, guarded, hashPassword, noteLogin, readJson, sameOrigin, startSession, tooMany } from "@/server/auth";
import { emailKey, NAME_KEYS_VERSION, nameKeys, phoneKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Makes an account and signs in to it. The same rules as the sign-up form (SignupForm.tsx), checked again here because
   anything in the browser can be skipped. Answers: "ok", "taken" (the email has an account), "taken-phone" (the
   mobile has one), "invalid". The new shop gets its row in shops (for Diwan); Dukkan has no plans or free trial, so nothing
   else is started for it. */
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
  let id: string;
  try {
    /* email, name and mobile are stored encrypted; their fingerprints keep them unique (server/crypto.ts), and the
       fingerprints of the name's words let Diwan find the owner by name */
    const { rows } = await pool.query(
      `INSERT INTO accounts (email, name, phone, email_hash, phone_hash, password_hash, name_keys, name_keys_v) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [seal(email), seal(name), seal(phone), emailKey(email), phoneKey(phone), await hashPassword(password), nameKeys(name), NAME_KEYS_VERSION],
    );
    id = String(rows[0].id);
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") return answer({ result: err.constraint === "accounts_phone_hash" ? "taken-phone" : "taken" }, 409);
    throw e;
  }
  await pool.query(`INSERT INTO shops (account_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  const res = answer({ result: "ok", account: { email, name, phone }, totpOn: false });
  await startSession(res, req, id);
  await noteLogin(id);
  touchShop(id);
  return res;
});
