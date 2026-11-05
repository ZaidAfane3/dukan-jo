import type { NextRequest } from "next/server";
import { emailOf } from "@/components/safe";
import { answer, checkPassword, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { audit, newTotpSecret, startStaffSession, totpLink } from "@/server/staff";

export const dynamic = "force-dynamic";

/* A wrong email takes as long as a wrong password, so the answer doesn't tell which emails are staff */
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword("diwan-no-such-staff"));

/* The first step of a staff sign-in: email and password. It starts a session that opens nothing until the 2-step code is
   given (POST /api/diwan/auth/totp). Answers: "ok" with step "code" (the app already gives codes) or "enroll" (first
   sign-in: the secret to add to an authenticator app), and mustChange when the password was a temporary one. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "diwan-login", 10, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const email = emailOf(body?.email);
  const password = body?.password;
  if (!email || typeof password !== "string" || !password || password.length > 128) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, password_hash, active, totp_on, totp_secret, must_change_password FROM staff WHERE email = $1`,
    [email],
  );
  const s = rows[0];
  const ok = await checkPassword(password, s?.password_hash ?? (await dummyHash()));
  if (!s || !s.active || !ok) {
    await audit(req, s ? String(s.id) : null, "staff.login_failed", s ? { type: "staff", id: s.id } : undefined, null, s ? (s.active ? undefined : { inactive: true }) : { email });
    return answer({ result: "wrong" }, 401);
  }

  const id = String(s.id);
  let secret: string | null = s.totp_secret;
  /* first sign-in (or after an owner reset the code): a secret to add to the app; kept until it is confirmed */
  if (!s.totp_on && !secret) {
    secret = newTotpSecret();
    await pool.query(`UPDATE staff SET totp_secret = $2 WHERE id = $1 AND NOT totp_on`, [id, secret]);
  }
  const res = answer({
    result: "ok",
    step: s.totp_on ? "code" : "enroll",
    mustChange: !!s.must_change_password,
    ...(s.totp_on ? {} : { secret, link: totpLink(secret!, email) }),
  });
  await startStaffSession(res, req, id);
  await audit(req, id, "staff.password_ok", { type: "staff", id });
  return res;
});
