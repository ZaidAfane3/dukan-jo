import type { NextRequest } from "next/server";
import { answer, currentAccount, endSession, guarded, sameOrigin } from "@/server/auth";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const res = answer({ result: "ok" });
  const a = await currentAccount(req).catch(() => null);
  await endSession(res, req);
  if (a) logMerchant(a.id, "signout");
  return res;
});
