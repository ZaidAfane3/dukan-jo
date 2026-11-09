import type { NextRequest } from "next/server";
import { savedMobile } from "@/components/phone";
import { answer, checkPassword, guarded, noteLogin, readJson, sameOrigin, startSession, suspendedReply, tooMany } from "@/server/auth";
import { emailKey, phoneKey } from "@/server/crypto";
import { db } from "@/server/db";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/* Signs in with an email or the mobile number the account signed up with. Answers: "ok", "none" (no such account),
   "wrong" (the password does not match), as the sign-in form expects; "suspended" (Dukkan suspended the store: no
   sign-in until it is back; with the reason staff wrote and since when, so the merchant knows why); "code" (the account has 2-step codes on: the session waits for the code, given to
   /api/auth/totp within 10 minutes). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "login", 20, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const id = typeof body?.id === "string" ? body.id.trim().toLowerCase() : "";
  const password = body?.password;
  if (!id || typeof password !== "string" || password.length > 128) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.phone, a.password_hash, a.totp_on, COALESCE(s.status = 'suspended', false) AS suspended,
            s.suspend_reason, s.suspended_at
       FROM accounts a LEFT JOIN shops s ON s.account_id = a.id
      WHERE a.email_hash = $1 OR a.phone_hash = $2 LIMIT 1`,
    /* found by fingerprints: the email and mobile themselves are stored encrypted */
    [emailKey(id), phoneKey(savedMobile(id)) ?? ""],
  );
  const a = rows[0];
  if (!a) return answer({ result: "none" }, 401);
  if (!(await checkPassword(password, a.password_hash))) return answer({ result: "wrong" }, 401);
  /* told only to someone who knows the password, and the reason only then */
  if (a.suspended) return answer(suspendedReply(a.suspend_reason, a.suspended_at), 403);

  if (a.totp_on) {
    const res = answer({ result: "code" });
    await startSession(res, req, String(a.id), { minutes: 10, pendingTotp: true });
    return res;
  }
  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone }, totpOn: false });
  await startSession(res, req, String(a.id));
  await noteLogin(String(a.id));
  touchShop(a.id);
  return res;
});
