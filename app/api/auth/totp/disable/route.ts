import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { checkCodeFor, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { useRecoveryCode } from "@/server/recovery";
import { logMerchant } from "@/server/merchantLog";
import { notify } from "@/server/notify";

export const dynamic = "force-dynamic";

/* Turns 2-step sign-in off, in two steps (components/TwoStepSettings.tsx: "Turn off" sends the code at once):
   POST { send: true, lang? }: a code to the account's email (ref "t:<account id>"; its own 10 minutes, 5 tries, one use,
   locks and caps on sending: server/emailVerify.ts). Pressed again within a minute it sends nothing new: the code just
   sent still works. A new code ends the ones before it, so only the newest email's code turns it off.
   POST { password, code }: both must be right; the code is that emailed one, or one of the recovery codes (the mailbox
   can't be reached). An authenticator app's code (accounts from before codes came by email) is not taken here: turning
   off asks for the email or a recovery code. Once off, the owner is told in the bell and by email (notify "twoStepOff",
   by "self"), so one who never asked for it knows at once.
   Answers "ok", "wrong-password", "wrong-code", "expired", "too-many", "locked", "slow-down", "send-failed". */
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
  const { rows } = await pool.query(`SELECT password_hash, totp_on FROM accounts WHERE id = $1`, [a.id]);
  const r = rows[0];
  if (!r?.totp_on) return answer({ result: "ok", on: false });
  if (!password || !(await checkPassword(password, r.password_hash))) return answer({ result: "wrong-password" }, 400);
  const six = typed.replace(/\s+/g, "");
  /* 6 digits: the code emailed for this (never a sign-in code: those have their own ref); else a recovery code */
  if (/^\d{6}$/.test(six)) {
    const c = await checkCodeFor(ref, six);
    if (c.result !== "ok") return answer({ result: c.result === "wrong" ? "wrong-code" : c.result }, 400);
  } else if (!(await useRecoveryCode(a.id, typed))) return answer({ result: "wrong-code" }, 400);
  /* only while still on: two requests at once turn it off (and tell the owner) once */
  const { rowCount } = await pool.query(`UPDATE accounts SET totp_on = false, two_step_method = NULL, totp_secret = NULL, totp_recovery = '{}' WHERE id = $1 AND totp_on`, [a.id]);
  if (!rowCount) return answer({ result: "ok", on: false });
  logMerchant(a.id, "twostep.off");
  await notify(a.id, "twoStepOff", { by: "self" });
  return answer({ result: "ok", on: false });
});
