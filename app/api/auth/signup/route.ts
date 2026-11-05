import type { NextRequest } from "next/server";
import { isJordanMobile, savedMobile } from "@/components/phone";
import { cleanLine, emailOf, passwordProblem, visibleLength } from "@/components/safe";
import { ACCOUNT_LIMITS } from "@/components/safeAccount";
import { answer, guarded, hashPassword, noteLogin, readJson, sameOrigin, startSession, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { startTrial, touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Makes an account and signs in to it. The same rules as the sign-up form (SignupForm.tsx), checked again here because
   anything in the browser can be skipped. Answers: "ok", "taken" (the email has an account), "taken-phone" (the
   mobile has one), "invalid". The new shop gets its row in shops (for Diwan) and its free trial. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "signup", 10, 60)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 4_000);
  const email = emailOf(body?.email);
  const name = cleanLine(body?.name, ACCOUNT_LIMITS.name);
  const phone = typeof body?.phone === "string" && isJordanMobile(body.phone) ? savedMobile(body.phone) : "";
  const password = body?.password;
  if (!email || visibleLength(name) < 2 || !phone || typeof password !== "string" || passwordProblem(password)) {
    return answer({ result: "invalid" }, 400);
  }

  const pool = await db();
  let id: string;
  try {
    const { rows } = await pool.query(`INSERT INTO accounts (email, name, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`, [
      email,
      name,
      phone,
      await hashPassword(password),
    ]);
    id = String(rows[0].id);
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") return answer({ result: err.constraint === "accounts_phone" ? "taken-phone" : "taken" }, 409);
    throw e;
  }
  await pool.query(`INSERT INTO shops (account_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
  await startTrial(id, pool);
  const res = answer({ result: "ok", account: { email, name, phone }, totpOn: false });
  await startSession(res, req, id);
  await noteLogin(id);
  touchShop(id);
  return res;
});
