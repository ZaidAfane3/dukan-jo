import type { NextRequest } from "next/server";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { useRecoveryCode } from "@/server/recovery";
import { useTotpCode } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turns 2-step codes off: { password, code }, both must be right; the code may be one of the recovery codes (the phone
   was lost). Answers "ok", "wrong-password", "wrong-code", "slow-down". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (tooMany(req, "totp-disable", 10, 15) || tooManyFor(`account-password:${a.id}`, 10, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  const password = typeof body?.password === "string" && body.password.length <= 128 ? body.password : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash, totp_secret, totp_on FROM accounts WHERE id = $1`, [a.id]);
  const r = rows[0];
  if (!r?.totp_on) return answer({ result: "ok", on: false });
  if (!password || !(await checkPassword(password, r.password_hash))) return answer({ result: "wrong-password" }, 400);
  /* a code works once (as at sign-in): one already used, even inside its 90 seconds, counts as wrong */
  if (!r.totp_secret || !((await useTotpCode("accounts", a.id, r.totp_secret, code)) || (await useRecoveryCode(a.id, code)))) return answer({ result: "wrong-code" }, 400);
  await pool.query(`UPDATE accounts SET totp_on = false, totp_secret = NULL, totp_recovery = '{}' WHERE id = $1`, [a.id]);
  return answer({ result: "ok", on: false });
});
