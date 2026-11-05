import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, renewCookie } from "@/server/auth";
import { touchShop } from "@/server/shops";

export const dynamic = "force-dynamic";

/** The account signed in on this browser, or 401. totpOn: 2-step codes are on. impersonation: a Dukkan staff member
    opened this store from Diwan (their name, when it ends, whether it is view only). */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const imp = a.impersonation;
  const res = answer({
    result: "ok",
    account: { email: a.email, name: a.name, phone: a.phone },
    totpOn: a.totpOn,
    impersonation: imp ? { staffName: imp.staffName, endsAt: imp.endsAt, viewOnly: imp.viewOnly } : null,
  });
  /* a support session keeps its own short end, and does not count as the merchant being here */
  if (!imp) {
    renewCookie(res, req);
    touchShop(a.id);
  }
  return res;
});
