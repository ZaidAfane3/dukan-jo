import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, renewCookie, sessionSuspension } from "@/server/auth";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/** The account signed in on this browser, or 401. totpOn: 2-step codes are on. 403 "suspended" with the reason and
    date: the merchant was signed in when Dukkan suspended the store, so the open tab can say why. */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) {
    const s = await sessionSuspension(req);
    return s ? answer(s, 403) : answer({ result: "none" }, 401);
  }
  const res = answer({
    result: "ok",
    account: { email: a.email, name: a.name, phone: a.phone },
    totpOn: a.totpOn,
  });
  renewCookie(res, req);
  touchShop(a.id);
  return res;
});
