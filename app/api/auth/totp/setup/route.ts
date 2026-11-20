import type { NextRequest } from "next/server";
import { answer, checkPassword, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { newRecoveryCodes, recoveryLeft } from "@/server/recovery";
import { newTotpSecret, totpLink, useTotpCode } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turning on 2-step codes (optional for merchants). GET: whether they are on. POST {}: a new secret to put in the
   authenticator app (the link as text and the secret in groups of 4 to type in); nothing changes until it is
   confirmed. POST { code, password }: the first code from the app and the account's password (a session someone else
   got hold of can't turn codes on and lock the owner out); when both are right, 2-step codes are on, and the answer
   carries 10 recovery codes, shown this once (server/recovery.ts). GET also says how many recovery codes are left. */

const grouped = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  return answer({ result: "ok", on: a.totpOn, recoveryLeft: a.totpOn ? await recoveryLeft(a.id) : 0 });
});

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.totpOn) return answer({ result: "already-on" }, 409);
  const body = await readJson(req, 500);
  const pool = await db();

  if (typeof body?.code !== "string") {
    if (tooManyFor(`totp-secret:${a.id}`, 10, 15)) return answer({ result: "slow-down" }, 429);
    const secret = newTotpSecret();
    await pool.query(`UPDATE accounts SET totp_secret = $2, totp_last_step = NULL WHERE id = $1 AND NOT totp_on`, [a.id, seal(secret)]);
    return answer({ result: "ok", secret, grouped: grouped(secret), link: totpLink(secret, a.email, "Dukkan") });
  }
  if (tooMany(req, "totp-setup", 10, 15) || tooManyFor(`account-password:${a.id}`, 10, 15)) return answer({ result: "slow-down" }, 429);
  const { rows } = await pool.query(`SELECT totp_secret, password_hash FROM accounts WHERE id = $1`, [a.id]);
  const secret = rows[0]?.totp_secret;
  if (!secret) return answer({ result: "start-again" }, 400);
  const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
  if (!password || !(await checkPassword(password, rows[0].password_hash))) return answer({ result: "wrong-password" }, 400);
  /* used up like a sign-in code, so the code that turned 2-step on can't also sign someone in */
  if (!(await useTotpCode("accounts", a.id, secret, body.code))) return answer({ result: "wrong" }, 400);
  const { codes, hashes } = newRecoveryCodes();
  await pool.query(`UPDATE accounts SET totp_on = true, totp_recovery = $2 WHERE id = $1`, [a.id, hashes]);
  return answer({ result: "ok", on: true, recoveryCodes: codes });
});
