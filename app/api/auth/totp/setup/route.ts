import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { newTotpSecret, totpLink, totpOk } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turning on 2-step codes (optional for merchants). GET: whether they are on. POST {}: a new secret to put in the
   authenticator app (the link as text and the secret in groups of 4 to type in); nothing changes until it is
   confirmed. POST { code }: the first code from the app; when it matches, 2-step codes are on. Never in a session
   opened by Dukkan staff. */

const grouped = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  return answer({ result: "ok", on: a.totpOn });
});

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (a.impersonation) return answer({ result: "view-only" }, 403);
  if (a.totpOn) return answer({ result: "already-on" }, 409);
  const body = await readJson(req, 500);
  const pool = await db();

  if (typeof body?.code !== "string") {
    const secret = newTotpSecret();
    await pool.query(`UPDATE accounts SET totp_secret = $2 WHERE id = $1 AND NOT totp_on`, [a.id, seal(secret)]);
    return answer({ result: "ok", secret, grouped: grouped(secret), link: totpLink(secret, a.email, "Dukkan") });
  }
  if (tooMany(req, "totp-setup", 10, 15)) return answer({ result: "slow-down" }, 429);
  const { rows } = await pool.query(`SELECT totp_secret FROM accounts WHERE id = $1`, [a.id]);
  const secret = rows[0]?.totp_secret;
  if (!secret) return answer({ result: "start-again" }, 400);
  if (!totpOk(secret, body.code)) return answer({ result: "wrong" }, 400);
  await pool.query(`UPDATE accounts SET totp_on = true WHERE id = $1`, [a.id]);
  return answer({ result: "ok", on: true });
});
