import type { NextRequest } from "next/server";
import { STAFF_2FA_REQUIRED, staffPasswordProblem } from "@/components/diwan/staffRules";
import { answer, checkPassword, guarded, hashPassword, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { audit, currentStaff, totpOk, verifyStaffSession } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The second step of a staff sign-in: the 6-digit code from the authenticator app. On the first sign-in it also turns the
   2-step code on (the app was set up right). A staff member with a temporary password sends their own new one with the
   code. Answers: "ok", "wrong" (the code), "weak" / "same" (the new password), "slow-down", "signed-out".
   While 2-step codes are not required (STAFF_2FA_REQUIRED, see its TODO), someone without one only sends the new password. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const s = await currentStaff(req);
  if (!s) return answer({ result: "signed-out" }, 401);
  if (s.verified) return answer({ result: "ok" });
  /* per staff member and per visitor: a few tries, then wait */
  if (tooMany(req, `diwan-totp-${s.id}`, 6, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const code = typeof body?.code === "string" ? body.code : "";

  const pool = await db();
  const { rows } = await pool.query(`SELECT totp_secret, totp_on, must_change_password, password_hash FROM staff WHERE id = $1`, [s.id]);
  const row = rows[0];
  /* TODO(2FA): `noCode` goes once STAFF_2FA_REQUIRED is on */
  const noCode = !STAFF_2FA_REQUIRED && !!row && !row.totp_on;
  if (!row || (!noCode && !row.totp_secret)) return answer({ result: "signed-out" }, 401);

  /* the new password is checked before the code, so a typo in it does not use up a code try */
  let newHash: string | null = null;
  if (row.must_change_password) {
    const pw = body?.newPassword;
    const problem = staffPasswordProblem(pw);
    if (problem) return answer({ result: "weak", problem }, 400);
    if (await checkPassword(pw as string, row.password_hash)) return answer({ result: "same" }, 400);
    newHash = await hashPassword(pw as string);
  }

  if (!noCode && !totpOk(row.totp_secret, code)) {
    await audit(req, s.id, "staff.code_failed", { type: "staff", id: s.id });
    return answer({ result: "wrong" }, 401);
  }

  await pool.query(
    `UPDATE staff SET totp_on = (totp_on OR NOT $3::boolean), last_login_at = now(),
            password_hash = COALESCE($2, password_hash), must_change_password = CASE WHEN $2::text IS NULL THEN must_change_password ELSE false END
      WHERE id = $1`,
    [s.id, newHash, noCode],
  );
  await verifyStaffSession(req);
  if (!row.totp_on && !noCode) await audit(req, s.id, "staff.2step_on", { type: "staff", id: s.id });
  if (newHash) await audit(req, s.id, "staff.password_changed", { type: "staff", id: s.id });
  await audit(req, s.id, "staff.login", { type: "staff", id: s.id });
  return answer({ result: "ok" });
});
