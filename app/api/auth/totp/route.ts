import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { latin } from "@/components/digits";
import { answer, finishPendingSession, guarded, noteLogin, noteSigninPlace, pendingAccount, readJson, sameOrigin, tooMany, visitorIp } from "@/server/auth";
import { checkCodeFor, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { useRecoveryCode } from "@/server/recovery";
import { touchShop } from "@/server/shops";
import { logMerchant } from "@/server/merchantLog";
import { db } from "@/server/db";
import { useTotpCode } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Wrong recovery codes, kept in memory. Counted per person trying (the account and the visitor's address): 5 in 15
   minutes and that visitor waits, so someone else's wrong guesses never block the owner's own recovery code. Across all
   addresses an account takes 30 wrong ones an hour, against guessing from many places (a recovery code is 8 letters
   and digits: 30 guesses an hour can't find one). (The emailed codes have their own limits: server/emailVerify.ts.) */
const wrong = new Map<string, { n: number; until: number }>();
const LIMITS = { visitor: { max: 5, minutes: 15 }, account: { max: 30, minutes: 60 } };
const over = (key: string, max: number) => {
  const w = wrong.get(key);
  return !!w && w.until > Date.now() && w.n >= max;
};
const bump = (key: string, minutes: number) => {
  const now = Date.now();
  if (wrong.size > 10_000) wrong.forEach((v, k) => v.until < now && wrong.delete(k));
  const w = wrong.get(key);
  if (!w || w.until < now) wrong.set(key, { n: 1, until: now + minutes * 60_000 });
  else w.n++;
};
const visitorKey = (id: string, req: NextRequest) => `${id}|${visitorIp(req)}`;
const blocked = (id: string, req: NextRequest) => over(visitorKey(id, req), LIMITS.visitor.max) || over(id, LIMITS.account.max);
const noteWrong = (id: string, req: NextRequest) => {
  bump(visitorKey(id, req), LIMITS.visitor.minutes);
  bump(id, LIMITS.account.minutes);
};

/* The second step of signing in, for accounts with 2-step sign-in on, after the password (/api/auth/login answered
   "code" and emailed the code):
   - POST { code }: the 6-digit code from the email, or one of the account's recovery codes (XXXX-XXXX, each works once:
     server/recovery.ts). Answers "ok" with the account, "wrong", "too-many" (this code's 5 tries: send a new one),
     "locked" (10 wrong emailed codes in an hour on this account from this visitor, across its sign-ins: wait),
     "expired" (no good code, or one from an earlier email: send a new one / use the newest), "recovery-wait" (too many
     wrong recovery codes: wait 15 minutes; nothing to do with sending codes), "gone" (no sign-in waiting: sign in
     again) or "slow-down" (too many requests from this address).
   - POST { resend: true, lang? }: a new code to the account's email: "ok", "slow-down", "send-failed", "locked". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "totp", 30, 15)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 500);
  const a = await pendingAccount(req);
  /* no sign-in waiting (it ran out after 15 minutes): sign in again */
  if (!a) return answer({ result: "gone" }, 401);

  if (body?.resend === true) {
    const sent = await sendCodeEmail(req, "login", a.ref, a.email, verifyLang(req, body.lang));
    if (sent === "sent") return answer({ result: "ok" });
    return answer({ result: sent === "failed" ? "send-failed" : sent === "locked" ? "locked" : "slow-down" }, sent === "failed" ? 502 : 429);
  }

  const typed = typeof body?.code === "string" ? latin(body.code).trim() : "";
  const six = typed.replace(/\s+/g, "");
  if (/^\d{6}$/.test(six)) {
    /* an account that used an authenticator app before codes came by email: the app's code still works too, so it can
       always sign in, even while email can't be sent. Its wrong tries count like wrong recovery codes. */
    const { rows } = await (await db()).query(`SELECT totp_secret FROM accounts WHERE id = $1`, [a.id]);
    const secret: string | null = rows[0]?.totp_secret ?? null;
    if (secret && blocked(a.id, req)) return answer({ result: "recovery-wait" }, 429);
    if (!secret || !(await useTotpCode("accounts", a.id, secret, six))) {
      const r = await checkCodeFor(a.ref, six);
      if (r.result !== "ok") {
        if (secret) noteWrong(a.id, req);
        return answer({ result: r.result }, r.result === "wrong" ? 401 : r.result === "expired" ? 410 : 429);
      }
    }
  } else {
    /* its own answer: the page's "slow-down" talks about sending codes, which has nothing to do with this wait */
    if (blocked(a.id, req)) return answer({ result: "recovery-wait" }, 429);
  }
  const recovery = !/^\d{6}$/.test(six);
  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone }, totpOn: true });
  /* a recovery code is used up in the same step as the sign-in completes, so a sign-in that can't complete (it ended
     meanwhile) leaves the code unused */
  let codeRight = null as boolean | null;
  const spend = recovery ? async (c: PoolClient) => (codeRight = await useRecoveryCode(a.id, typed, c)) : undefined;
  if (!(await finishPendingSession(res, req, spend))) {
    if (codeRight === false) {
      noteWrong(a.id, req);
      return answer({ result: "wrong" }, 401);
    }
    /* the waiting sign-in ended meanwhile (another device signed in, it ran out): sign in again */
    return answer({ result: "gone" }, 401);
  }
  if (recovery) {
    wrong.delete(visitorKey(a.id, req));
    logMerchant(a.id, "twostep.recovery-used");
  }
  await noteLogin(a.id, req);
  await noteSigninPlace(req, `m:${a.id}`);
  logMerchant(a.id, "signin", { twoStep: true, recovery });
  touchShop(a.id);
  return res;
});
