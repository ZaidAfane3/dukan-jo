import type { NextRequest } from "next/server";
import { savedMobile } from "@/components/phone";
import { answer, checkPassword, guarded, hashPassword, noteLogin, readJson, sameOrigin, signInTries, startSession, suspendedReply, tooMany } from "@/server/auth";
import { emailKey, phoneKey } from "@/server/crypto";
import { db } from "@/server/db";
import { dataKeyWorks } from "@/server/dataKey";
import { maskEmail, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { touchShop } from "@/server/shops";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

/* Signs in with an email or the mobile number the account signed up with. Answers: "ok"; "wrong" (no such account, or
   the password does not match: the same answer, after the same wait, so nobody can test which emails and mobiles have an
   account); "slow-down" (too many tries from this address, or too many wrong ones on this email or mobile from this
   address: wait 15 minutes. Wrong tries on the account from everywhere together only make each try wait longer, so
   nobody can keep the owner out: server/auth.ts signInTries); "suspended" (Dukkan suspended the store: no sign-in until it is back; with the reason staff wrote and since
   when, told only after the right password); "code" (the account has 2-step sign-in on: a code went to its email, and the
   session waits for it, given to /api/auth/totp within 15 minutes). */

/* an unknown email or mobile is checked against this, so it takes as long as a wrong password */
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword("dukkan-no-such-account"));

/* wrong tries on one email or mobile from one address */
const ACCOUNT_TRIES = 10;
const ACCOUNT_WAIT = 15;

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "login", 20, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 2_000);
  const id = typeof body?.id === "string" ? body.id.trim().toLowerCase() : "";
  const password = body?.password;
  if (!id || typeof password !== "string" || password.length > 128) return answer({ result: "invalid" }, 400);

  const pool = await db();
  /* the server's data key is missing or wrong: no account could be found, so this is not "wrong" (and not counted as a
     wrong try), it is the server's problem (server/dataKey.ts). The page says to try again later. */
  if (!(await dataKeyWorks(pool))) return answer({ result: "error" }, 503);
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.name, a.phone, a.password_hash, a.totp_on, COALESCE(s.status = 'suspended', false) AS suspended,
            s.suspend_reason, s.suspended_at
       FROM accounts a LEFT JOIN shops s ON s.account_id = a.id
      WHERE a.email_hash = $1 OR a.phone_hash = $2 LIMIT 1`,
    /* found by fingerprints: the email and mobile themselves are stored encrypted */
    [emailKey(id), phoneKey(savedMobile(id)) ?? ""],
  );
  const a = rows[0];
  /* wrong tries are counted per account (its email and its mobile together), and for an email or mobile nobody has by
     what was typed, so it waits the same way as a real one */
  const mobile = savedMobile(id);
  const who = a ? `login:account:${a.id}` : `login:${mobile ? phoneKey(mobile) : emailKey(id)}`;
  const gate = signInTries(req, who, ACCOUNT_TRIES, ACCOUNT_WAIT);
  if (gate.blocked()) return answer({ result: "slow-down" }, 429);
  /* the try is counted before the password is checked, in the same step as the look above: tries sent all at once
     can't all pass the look while the first ones are still being checked. The right password forgets them again. */
  gate.failed();
  await gate.slowDown();
  if (!(await checkPassword(password, a?.password_hash ?? (await dummyHash()))) || !a) return answer({ result: "wrong" }, 401);
  gate.passed();
  /* told only to someone who knows the password, and the reason only then */
  if (a.suspended) return answer(suspendedReply(a.suspend_reason, a.suspended_at), 403);

  /* 2-step on: the session waits for the code, sent by email now (server/emailVerify.ts), and given to /api/auth/totp.
     `to`: the address it went to, partly hidden (the sign-in may have used the mobile). `sent`: false when it could not
     be sent this time, with `why`: "slow-down" (too many codes lately) or "failed" (the email failed): the code page can
     ask for a new one; "locked": 10 wrong codes in the last hour on this account from this visitor, over its earlier
     sign-ins too, so signing in again doesn't start fresh (server/emailVerify.ts). */
  if (a.totp_on) {
    const res = answer({ result: "code", method: "email", to: maskEmail(a.email), sent: true });
    const ref = await startSession(res, req, String(a.id), { minutes: 15, pendingTotp: true });
    const sent = await sendCodeEmail(req, "login", ref, a.email, verifyLang(req, body?.lang));
    if (sent === "sent") return res;
    const late = answer({ result: "code", method: "email", to: maskEmail(a.email), sent: false, why: sent });
    res.cookies.getAll().forEach((c) => late.cookies.set(c));
    return late;
  }
  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone }, totpOn: false });
  await startSession(res, req, String(a.id));
  await noteLogin(String(a.id), req);
  logMerchant(a.id, "signin", { twoStep: false });
  touchShop(a.id);
  return res;
});
