import { phoneCodesByEmail } from "@/server/sendCode";
import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { answer, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { canSendTo, codeLang, contactOf, noteResetSend, requestCode, resetSendLimited, SEND_PER_IP } from "@/server/passwordReset";

export const dynamic = "force-dynamic";

/* Forgot password, step 1: { contact, lang } (the email or Jordan mobile of the account; the language of the message).
   Answers:
   - "sent" (200): the same whether that email or mobile has an account or not ("If this email or number has an account,
     we sent a code"), after about the same wait, so nobody can test which ones have one;
   - "slow-down" (429): 3 codes for this email or mobile from this visitor in 15 minutes, 10 for it from everyone in an
     hour (30 a day), or 10 requests from this address in an hour (server/passwordReset.ts SEND_PER_CONTACT). Refused
     requests never count, so a stranger can't keep the owner's reset closed;
   - "no-sender" (503): nothing can send codes yet (production without an email/SMS provider, server/sendCode.ts);
   - "invalid" (400): neither an email nor a Jordan mobile. */

/* every "sent" takes at least this long, plus a little at random */
const MIN_MS = 450;

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "reset-send", SEND_PER_IP.max, SEND_PER_IP.minutes)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  const c = contactOf(body?.contact);
  if (!c) return answer({ result: "invalid" }, 400);
  /* decided by the kind of contact only, never by the account */
  if (!canSendTo(c)) return answer({ result: "no-sender" }, 503);
  /* looked at and counted in one step (nothing waited for in between), and the same for an unknown email or mobile */
  if (resetSendLimited(req, c)) return answer({ result: "slow-down" }, 429);
  noteResetSend(req, c);
  const until = Date.now() + MIN_MS + randomInt(150);
  await requestCode(req, c, codeLang(body?.lang));
  const left = until - Date.now();
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  /* a mobile typed while codes go by email: the page says to look in the account's email */
  return answer({ result: "sent", ...(c.channel === "phone" && phoneCodesByEmail() ? { via: "email" } : {}) });
});
