import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { checkCodeFor, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { useRecoveryCode } from "@/server/recovery";
import { logMerchant } from "@/server/merchantLog";
import { useTotpCode } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turns 2-step sign-in off.
   POST { send: true, lang? }: a code to the account's email.
   POST { password, code }: both must be right; the code is the emailed one, or one of the recovery codes (the mailbox
   can't be reached). Answers "ok", "wrong-password", "wrong-code", "too-many", "locked", "slow-down", "send-failed". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 1_000);
  const ref = `t:${a.id}`;
  if (body?.send === true) {
    if (!a.totpOn) return answer({ result: "ok", on: false });
    const sent = await sendCodeEmail(req, "twostep", ref, a.email, verifyLang(req, body.lang));
    if (sent === "sent") return answer({ result: "ok", sent: true });
    return answer({ result: sent === "failed" ? "send-failed" : sent === "locked" ? "locked" : "slow-down" }, sent === "failed" ? 502 : 429);
  }
  if (tooMany(req, "totp-disable", 10, 15) || tooManyFor(`account-password:${a.id}`, 10, 15)) return answer({ result: "slow-down" }, 429);
  const password = typeof body?.password === "string" && body.password.length <= 128 ? body.password : "";
  const typed = typeof body?.code === "string" ? latin(body.code).trim() : "";
  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash, totp_on, totp_secret FROM accounts WHERE id = $1`, [a.id]);
  const r = rows[0];
  if (!r?.totp_on) return answer({ result: "ok", on: false });
  if (!password || !(await checkPassword(password, r.password_hash))) return answer({ result: "wrong-password" }, 400);
  const six = typed.replace(/\s+/g, "");
  /* an account that used an authenticator app before: the app's code works here too (app/api/auth/totp) */
  if (/^\d{6}$/.test(six) && r.totp_secret && (await useTotpCode("accounts", a.id, r.totp_secret, six))) {
    /* the app's code */
  } else if (/^\d{6}$/.test(six)) {
    const c = await checkCodeFor(ref, six);
    if (c.result !== "ok") return answer({ result: c.result === "wrong" ? "wrong-code" : c.result }, 400);
  } else if (!(await useRecoveryCode(a.id, typed))) return answer({ result: "wrong-code" }, 400);
  await pool.query(`UPDATE accounts SET totp_on = false, two_step_method = NULL, totp_secret = NULL, totp_recovery = '{}' WHERE id = $1`, [a.id]);
  logMerchant(a.id, "twostep.off");
  return answer({ result: "ok", on: false });
});
