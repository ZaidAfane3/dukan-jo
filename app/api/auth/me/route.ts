import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, renewCookie, sessionReplaced, sessionSuspension } from "@/server/auth";
import { emailUnconfirmed } from "@/server/emailVerify";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/** The account signed in on this browser, or 401. totpOn: 2-step codes are on. emailVerified: false only while the
    account has not confirmed its email and Dukkan can send the code (server/emailVerify.ts; with email off it is always
    true, since nothing could confirm it), for the dashboard's banner (components/VerifyEmail.tsx). It is beside the
    account, not in it, so the profile the pages keep (accounts.ts rememberProfile) stays as it was. 403 "suspended" with
    the reason and date: the merchant was signed in when Dukkan suspended the store, so the open tab can say why. 401
    with why: "elsewhere" when this browser was signed out because the account was signed in on another device (an
    account is open on one device at a time: server/auth.ts), so the page can say so. */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) {
    const s = await sessionSuspension(req);
    if (s) return answer(s, 403);
    return answer((await sessionReplaced(req)) ? { result: "none", why: "elsewhere" } : { result: "none" }, 401);
  }
  const res = answer({
    result: "ok",
    account: { email: a.email, name: a.name, phone: a.phone },
    totpOn: a.totpOn,
    emailVerified: !(await emailUnconfirmed(a.id)),
  });
  renewCookie(res, req);
  touchShop(a.id);
  return res;
});
