import type { NextRequest } from "next/server";
import { emailOf } from "@/components/safe";
import { answer, checkPassword, guarded, hashPassword, readJson, sameOrigin, signInTries, tooMany } from "@/server/auth";
import { emailKey } from "@/server/crypto";
import { db } from "@/server/db";
import { maskEmail } from "@/server/emailVerify";
import { audit } from "@/server/staff";
import { sendSigninCode, staffCodesOn, startSignin } from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* A wrong email takes as long as a wrong password, so the answer doesn't tell which emails are staff */
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword("diwan-no-such-staff"));

/* The first step of a staff sign-in: email and password. A right password starts a sign-in that waits for the 6-digit
   code emailed to the member's address on file (server/staffSignin.ts): no staff session exists until the code is given
   to POST /api/diwan/auth/code. Answers:
   - "ok" with step "code": `to` (the address, partly hidden), `mustChange` (a temporary password, replaced with the code),
     `sent` (false when the code could not go out this time, with `why`: "failed" the email failed, "slow-down" too many
     codes lately, "locked" too many wrong codes this hour: the code page says so and can ask for a new one);
   - "no-email" (503): Diwan can't send email at all (no RESEND_API_KEY / EMAIL_FROM on the server), so nobody can sign
     in; told only after the right password;
   - "wrong", "invalid", "slow-down", "forbidden". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "diwan-login", 10, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const email = emailOf(body?.email);
  const password = body?.password;
  if (!email || typeof password !== "string" || !password || password.length > 128) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, email, lang, password_hash, active, must_change_password FROM staff WHERE email_hash = $1`,
    [emailKey(email)],
  );
  const s = rows[0];
  /* as a merchant's sign-in (server/auth.ts signInTries): five wrong passwords on this email from one address and that
     address waits 15 minutes; wrong ones from everywhere together only make each try wait longer, so nobody can keep a
     staff member out. Counted by the email typed, so an email that is not staff waits the same way. */
  const gate = signInTries(req, `diwan-login:${emailKey(email)}`, 5, 15);
  if (gate.blocked()) return answer({ result: "slow-down" }, 429);
  gate.failed();
  await gate.slowDown();
  const ok = await checkPassword(password, s?.password_hash ?? (await dummyHash()));
  if (!s || !s.active || !ok) {
    await audit(req, s ? String(s.id) : null, "staff.login_failed", s ? { type: "staff", id: s.id } : undefined, null, s ? (s.active ? undefined : { inactive: true }) : undefined);
    return answer({ result: "wrong" }, 401);
  }
  gate.passed();

  const id = String(s.id);
  /* no way to send the code (the live server without an email provider): nobody gets in without one */
  if (!staffCodesOn()) {
    await audit(req, id, "staff.login_failed", { type: "staff", id }, null, { noEmail: true });
    return answer({ result: "no-email" }, 503);
  }
  const to = maskEmail(String(s.email));
  const mustChange = !!s.must_change_password;
  const res = answer({ result: "ok", step: "code", to, mustChange, sent: true });
  const ref = await startSignin(res, req, id, s.password_hash);
  /* the password was replaced or the account turned off while it was being checked: as a wrong password */
  if (!ref) {
    await audit(req, id, "staff.login_failed", { type: "staff", id }, null, { changedDuringCheck: true });
    return answer({ result: "wrong" }, 401);
  }
  await audit(req, id, "staff.password_ok", { type: "staff", id });
  /* always to the address on file, in the member's saved language (both while none is saved) */
  const sent = await sendSigninCode(req, ref, String(s.email), s.lang);
  if (sent === "sent") return res;
  const late = answer({ result: "ok", step: "code", to, mustChange, sent: false, why: sent === "off" ? "failed" : sent });
  res.cookies.getAll().forEach((c) => late.cookies.set(c));
  return late;
});
