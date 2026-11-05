import type { NextRequest } from "next/server";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { totpOk } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turns 2-step codes off: { password, code }, both must be right. Answers "ok", "wrong-password", "wrong-code". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.impersonation) return answer({ result: "view-only" }, 403);
  if (tooMany(req, "totp-disable", 10, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  const password = typeof body?.password === "string" && body.password.length <= 128 ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash, totp_secret, totp_on FROM accounts WHERE id = $1`, [a.id]);
  const r = rows[0];
  if (!r?.totp_on) return answer({ result: "ok", on: false });
  if (!password || !(await checkPassword(password, r.password_hash))) return answer({ result: "wrong-password" }, 400);
  if (!r.totp_secret || !totpOk(r.totp_secret, code)) return answer({ result: "wrong-code" }, 400);
  await pool.query(`UPDATE accounts SET totp_on = false, totp_secret = NULL WHERE id = $1`, [a.id]);
  return answer({ result: "ok", on: false });
});
