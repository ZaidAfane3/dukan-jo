import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, guarded, readJson, sameOrigin } from "@/server/auth";
import { db } from "@/server/db";
import { checkCodeFor, codeRouteBusy, endCodes, sendCodeEmail, verifyLang } from "@/server/emailVerify";
import { clearPendingCookie, currentPending, makeAccount, signInMade } from "@/server/signup";

export const dynamic = "force-dynamic";

/* Signing up, step 2: the code from the email (app/api/auth/signup sent it; server/emailVerify.ts checks it).
   - POST { code }: right: the account is made, signed in, and answered "ok" with it as signing in answers. "made": it
     was already made with this code (another tab): sign in. Else "wrong",
     "expired" (no good code: ran out, or a newer one was sent), "too-many" (this code's 5 tries: send a new one),
     "locked" (10 wrong tries this hour: wait), "taken" / "taken-phone" (someone made an account with that email or mobile
     meanwhile), "gone" (no sign-up waiting on this browser: it ran out after an hour, start again).
   - POST { resend: true, lang? }: a new code (the one before stops working): "ok", or "slow-down" (3 per 15 minutes, and
     the address's own cap), "send-failed", "locked", "gone".
   - POST { cancel: true }: the sign-up is given up (back to the form): "ok".
   - GET: the sign-up this browser is waiting on, so a page loaded again (a refresh) goes back to its code instead of
     the empty form: { pending: true, email } or { pending: false }. Only this browser's own cookie names it, and the
     email is the one it typed. */
export const GET = guarded(async (req: NextRequest) => {
  if (codeRouteBusy(req, "signup")) return answer({ result: "slow-down" }, 429);
  const p = await currentPending(req);
  return answer(p && !p.account_id ? { pending: true, email: p.email } : { pending: false });
});

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (codeRouteBusy(req, "signup")) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const p = await currentPending(req);

  if (body.cancel === true) {
    const res = answer({ result: "ok" });
    if (p && !p.account_id) {
      await endCodes(p.ref, true);
      await (await db()).query(`DELETE FROM signup_pending WHERE id = $1`, [p.id]);
    }
    clearPendingCookie(res, req);
    return res;
  }
  if (!p) return answer({ result: "gone" }, 410);

  if (body.resend === true) {
    if (p.account_id) return answer({ result: "gone" }, 410);
    const sent = await sendCodeEmail(req, "signup", p.ref, p.email, verifyLang(req, body.lang));
    if (sent === "sent") return answer({ result: "ok" });
    return answer({ result: sent === "failed" ? "send-failed" : sent === "locked" ? "locked" : "slow-down" }, sent === "failed" ? 502 : 429);
  }

  const code = typeof body.code === "string" ? latin(body.code).replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return answer({ result: "invalid" }, 400);
  let r = await checkCodeFor(p.ref, code);
  /* the same right code sent twice at once (two tabs, a retry): the other request can mark the code used between this
     one's count and its own mark, which reads "expired". Asked once more, the code just used is known again ("ok") */
  if (r.result === "expired") r = await checkCodeFor(p.ref, code);
  if (r.result !== "ok") return answer({ result: r.result }, r.result === "wrong" ? 400 : r.result === "expired" ? 410 : 429);
  /* the account was already made with this code (a second tab, or the answer got lost): nothing more is signed in by it
     (a copied sign-up cookie must not open the account somewhere else). "made": the page asks to sign in. */
  if (p.account_id) return answer({ result: "made" }, 409);
  const account = { email: p.email, name: p.name, phone: p.phone };
  const made = await makeAccount(p);
  /* made by the other request at the same moment (makeAccount waits for it): the same as above */
  if (made.result === "made") return answer({ result: "made" }, 409);
  if (made.result !== "ok") {
    await (await db()).query(`DELETE FROM signup_pending WHERE id = $1`, [p.id]);
    const res = answer({ result: made.result }, 409);
    clearPendingCookie(res, req);
    return res;
  }
  const res = answer({ result: "ok", account, totpOn: false });
  await signInMade(res, req, made.id);
  return res;
});

