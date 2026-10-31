import type { NextRequest } from "next/server";
import { savedMobile } from "@/components/phone";
import { answer, checkPassword, guarded, readJson, sameOrigin, startSession, tooMany } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* Signs in with an email or the mobile number the account signed up with. Answers: "ok", "none" (no such account),
   "wrong" (the password does not match), as the sign-in form expects. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "login", 20, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const id = typeof body?.id === "string" ? body.id.trim().toLowerCase() : "";
  const password = body?.password;
  if (!id || typeof password !== "string" || password.length > 128) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(`SELECT id, email, name, phone, password_hash FROM accounts WHERE email = $1 OR (phone <> '' AND phone = $2) LIMIT 1`, [
    id,
    savedMobile(id),
  ]);
  const a = rows[0];
  if (!a) return answer({ result: "none" }, 401);
  if (!(await checkPassword(password, a.password_hash))) return answer({ result: "wrong" }, 401);

  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone } });
  await startSession(res, req, String(a.id));
  return res;
});
