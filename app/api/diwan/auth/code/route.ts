import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, checkPassword, guarded, hashPassword, noteSigninPlace, readJson, sameOrigin, signInTries, tooMany, tooManyFor } from "@/server/auth";
import { emailKey } from "@/server/crypto";
import { db } from "@/server/db";
import { freshCodeMail } from "@/server/email";
import { checkCodeFor } from "@/server/emailVerify";
import { audit, startStaffSession } from "@/server/staff";
import { endSignin, forgetDevices, rememberDevice, sendSigninCode, staffCodesOn, waitingSignin } from "@/server/staffSignin";

export const dynamic = "force-dynamic";

/* The second step of a staff sign-in (after app/api/diwan/auth/login answered step "code"): the 6-digit code emailed to
   the member (server/staffSignin.ts). Only the browser holding the waiting sign-in's cookie gets here.
   - POST { code, newPassword? }: right: the staff session starts (signed in), the email counts as confirmed and this
     browser is remembered (server/staffSignin.ts rememberDevice: next time here, the password alone). With a
     temporary password, the member's own new password comes with the code (checked first, so a typo in it costs no code
     try). Answers "ok", "wrong", "expired" (send a new code / use the newest email), "too-many" (this code's 5 tries:
     send a new one), "locked" (too many wrong codes this hour), "weak" / "same" (the new password), "gone" (no sign-in
     waiting: sign in again), "slow-down", "invalid".
   - POST { resend: true }: a new code to the same address: "ok", "send-failed", "slow-down", "locked", "gone". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "diwan-code", 30, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const w = await waitingSignin(req);
  if (!w) return answer({ result: "gone" }, 401);

  if (body?.resend === true) {
    const sent = staffCodesOn() ? await sendSigninCode(req, w.ref, w.email, w.lang) : "off";
    if (sent === "sent") return answer({ result: "ok" });
    if (sent === "failed" || sent === "off") return answer({ result: "send-failed" }, 502);
    return answer({ result: sent }, 429);
  }

  const code = typeof body?.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);

  /* the new password is checked before the code, so a typo in it does not use up a code try */
  let newHash: string | null = null;
  if (w.mustChange) {
    const pw = body?.newPassword;
    const problem = staffPasswordProblem(pw);
    if (problem) return answer({ result: "weak", problem }, 400);
    if (await checkPassword(pw as string, w.passwordHash)) return answer({ result: "same" }, 400);
    newHash = await hashPassword(pw as string);
  }

  /* per staff member, whoever tries: a ceiling on every code try. Wrong codes, as wrong passwords (server/auth.ts
     signInTries): six from one address and that address waits; from everywhere they only make each try wait longer.
     The codes have their own limits too (server/emailVerify.ts: 5 tries a code, 10 wrong an hour per sign-in and per
     address and visitor). */
  if (tooManyFor(`diwan-code-tries:${w.staffId}`, 12, 15)) return answer({ result: "slow-down" }, 429);
  const gate = signInTries(req, `diwan-code:${w.staffId}`, 6, 15);
  if (gate.blocked()) return answer({ result: "slow-down" }, 429);
  gate.failed();
  await gate.slowDown();
  const r = await checkCodeFor(w.ref, code);
  /* a code that went to an address the member no longer has (their email changed since) counts as run out */
  if (r.result !== "ok" || r.emailHash !== emailKey(w.email)) {
    const result = r.result === "ok" ? "expired" : r.result;
    if (result === "wrong" || result === "too-many") await audit(req, w.staffId, "staff.code_failed", { type: "staff", id: w.staffId });
    return answer({ result }, result === "wrong" ? 401 : result === "expired" ? 410 : 429);
  }
  gate.passed();

  const res = answer({ result: "ok" });
  const gone = () => answer({ result: "gone" }, 401);
  /* the waiting sign-in ends here, once: the same code sent twice signs in once */
  if (!(await endSignin(res, req, w.tokenHash))) return gone();
  const pool = await db();
  let hash = w.passwordHash;
  if (newHash) {
    const u = await pool.query(
      `UPDATE staff SET password_hash = $2, must_change_password = false WHERE id = $1 AND password_hash = $3 AND active`,
      [w.staffId, newHash, w.passwordHash],
    );
    if (!u.rowCount) return gone();
    hash = newHash;
    /* the temporary password is dead now: every session and waiting sign-in made with it ends, so whoever else saw it
       keeps nothing (none of them was ever signed in: a temporary password never opened Diwan without this step) */
    await pool.query(`DELETE FROM staff_sessions WHERE staff_id = $1`, [w.staffId]);
    await pool.query(`DELETE FROM staff_signins WHERE staff_id = $1`, [w.staffId]);
    await forgetDevices(w.staffId);
    /* and the code emails asked for with the temporary password no longer count against the member's own sign-ins */
    freshCodeMail(w.email, "staff-login");
  }
  if (!(await startStaffSession(res, req, w.staffId, hash, true))) return gone();
  await rememberDevice(res, req, w.staffId, hash);
  await pool.query(`UPDATE staff SET last_login_at = now() WHERE id = $1`, [w.staffId]);
  await noteSigninPlace(req, `s:${w.staffId}`);
  /* the code reached this address: it is confirmed now (an owner typed it when adding the member) */
  const confirmed = await pool.query(
    `UPDATE staff SET email_confirmed_at = now() WHERE id = $1 AND email_confirmed_at IS NULL AND email_hash = $2`,
    [w.staffId, emailKey(w.email)],
  );
  if (confirmed.rowCount) await audit(req, w.staffId, "staff.email_confirmed", { type: "staff", id: w.staffId });
  if (newHash) await audit(req, w.staffId, "staff.password_changed", { type: "staff", id: w.staffId });
  await audit(req, w.staffId, "staff.login", { type: "staff", id: w.staffId }, null, { twoStep: "email" });
  return res;
});
