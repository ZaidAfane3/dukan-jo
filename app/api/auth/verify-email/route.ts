import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { emailOn } from "@/server/email";
import { checkVerifyCode, emailUnconfirmed, SEND_PER_ACCOUNT, SEND_PER_IP, sendVerifyCode, verifyLang } from "@/server/emailVerify";

export const dynamic = "force-dynamic";

/* The signed-in merchant confirms his email (server/emailVerify.ts; the banner is components/VerifyEmail.tsx).
   - POST { code }: the 6-digit code from the email. Answers "ok" (confirmed, also when it already was), "wrong",
     "expired" (no good code: ran out, used, or sent to the email before), "too-many" (this code's 5 tries, or the
     account's tries for the hour, are used up: a new code, or later).
   - POST { resend: true, lang? }: a new code to the account's email (the one before stops working). At most 3 per 15
     minutes per account and 10 per hour per address: "slow-down" (429) past that.
   Both: "no-sender" (503) while Dukkan can't send email (then nothing needs confirming), "none" (401) signed out,
   "forbidden" (403) not from Dukkan's own pages, "invalid" (400). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  /* every request from this address, before anything else is looked at */
  if (tooMany(req, "verify-email", 60, 15)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  if (!emailOn()) return answer({ result: "no-sender" }, 503);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);

  if (body.resend === true) {
    if (!(await emailUnconfirmed(a.id))) return answer({ result: "ok", verified: true });
    if (tooManyFor(`verify-email-send:${a.id}`, SEND_PER_ACCOUNT.max, SEND_PER_ACCOUNT.minutes)) return answer({ result: "slow-down" }, 429);
    if (tooMany(req, "verify-email-send", SEND_PER_IP.max, SEND_PER_IP.minutes)) return answer({ result: "slow-down" }, 429);
    const sent = await sendVerifyCode(a.id, a.email, verifyLang(req, body.lang));
    if (sent === "slow-down") return answer({ result: "slow-down" }, 429);
    return answer({ result: "ok", sent: true });
  }

  const code = typeof body.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  const result = await checkVerifyCode(a.id, a.email, code);
  return answer(result === "ok" ? { result, verified: true } : { result }, result === "ok" ? 200 : result === "too-many" ? 429 : 400);
});
