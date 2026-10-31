import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, renewCookie } from "@/server/auth";

export const dynamic = "force-dynamic";

/** The account signed in on this browser, or 401 */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const res = answer({ result: "ok", account: { email: a.email, name: a.name, phone: a.phone } });
  renewCookie(res, req);
  return res;
});
