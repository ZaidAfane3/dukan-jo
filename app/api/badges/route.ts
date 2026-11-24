import { answer, readJson } from "@/server/auth";
import { isMerchantBadgeTab, markBellSeen, markMerchantSeen, merchantBadges } from "@/server/merchantBadges";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The red numbers of the signed-in merchant's dashboard (server/merchantBadges.ts). Only his own shop's: the account comes
   from his session, never from the request.
     GET                       what is new on each page: { counts: { orders, carts, signups }, bellSeen }
     POST { tab }              he opened that page (orders, carts, signups): its number starts again from now
     POST { tab: "bell", at }  his bell's open panel showed the notifications up to `at` (ms) */
export const GET = merchantRoute(async (_req, me) => answer({ result: "ok", ...(await merchantBadges(me.id)) }));

export const POST = merchantRoute(async (req, me) => {
  const body = await readJson(req, 200);
  if (body?.tab === "bell") {
    const at = Number(body.at);
    if (!Number.isSafeInteger(at) || at <= 0) return answer({ result: "invalid" }, 400);
    await markBellSeen(me.id, at);
  } else if (body && isMerchantBadgeTab(body.tab)) await markMerchantSeen(me.id, body.tab);
  else return answer({ result: "invalid" }, 400);
  return answer({ result: "ok", ...(await merchantBadges(me.id)) });
});
