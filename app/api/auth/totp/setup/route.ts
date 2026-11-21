import type { NextRequest } from "next/server";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { emailOn } from "@/server/email";
import { newRecoveryCodes, recoveryLeft } from "@/server/recovery";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

/* Turning on 2-step sign-in (optional for merchants): after the password, every sign-in asks for a 6-digit code sent to
   the account's email (server/emailVerify.ts). WhatsApp is to come (the settings page shows it as soon).
   GET: { on, method, recoveryLeft, available } (available: Dukkan can send email now).
   POST { password, method: "email" }: the account's password (a session someone else got hold of can't turn it on and
   lock the owner out). No emailed code: the email was confirmed with a code when the account was made (or when it was
   changed), so it is known to work. Right: on, and the answer carries 10 recovery codes, shown this once (for when the
   mailbox can't be reached). Answers "wrong-password", "slow-down", "already-on", "unavailable". Turning it off asks
   for an emailed code (app/api/auth/totp/disable), so a code never does both. */

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const available = emailOn() || process.env.NODE_ENV === "development";
  return answer({ result: "ok", on: a.totpOn, method: a.totpOn ? "email" : null, recoveryLeft: a.totpOn ? await recoveryLeft(a.id) : 0, available });
});

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.totpOn) return answer({ result: "already-on" }, 409);
  const body = await readJson(req, 500);
  /* the codes come by email: without a way to send email, 2-step can't be turned on (nobody could sign in) */
  if (!(emailOn() || process.env.NODE_ENV === "development")) return answer({ result: "unavailable" }, 503);
  if ((body?.method ?? "email") !== "email") return answer({ result: "unavailable" }, 400);
  if (tooMany(req, "totp-setup", 10, 15) || tooManyFor(`account-password:${a.id}`, 10, 15)) return answer({ result: "slow-down" }, 429);
  const pool = await db();
  const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE id = $1`, [a.id]);
  const password = typeof body?.password === "string" && body.password.length <= 128 ? body.password : "";
  if (!password || !rows[0] || !(await checkPassword(password, rows[0].password_hash))) return answer({ result: "wrong-password" }, 400);
  const { codes, hashes } = newRecoveryCodes();
  await pool.query(`UPDATE accounts SET totp_on = true, two_step_method = 'email', totp_secret = NULL, totp_recovery = $2 WHERE id = $1`, [a.id, hashes]);
  logMerchant(a.id, "twostep.on", { method: "email" });
  return answer({ result: "ok", on: true, method: "email", recoveryCodes: codes });
});
