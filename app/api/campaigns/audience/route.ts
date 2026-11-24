import { answer, startRunning } from "@/server/auth";
import { cleanAudience } from "@/components/campaignRules";
import { countAudience } from "@/server/campaigns";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* How many of the signed-in merchant's customers a campaign would reach now, for the form's "Will be sent to ~N
   customers": GET /api/campaigns/audience?channel=email|mobile&who=all|subscribers|buyers&days=0|30|90|365&min=1|2|3|5
   -> { count }. Unknown values count as their default (components/campaignRules.ts cleanAudience). It reads every
   customer of the store, so one account runs at most two at a time (429 "slow-down"). */
export const GET = merchantRoute(async (req, me) => {
  const sp = req.nextUrl.searchParams;
  const channel = sp.get("channel") === "mobile" ? "mobile" : "email";
  const audience = cleanAudience({ who: sp.get("who"), days: sp.get("days"), minOrders: sp.get("min") }, channel);
  const done = startRunning(`campaign-audience:${me.id}`, 2);
  if (!done) return answer({ result: "slow-down" }, 429);
  try {
    return answer({ result: "ok", count: await countAudience(me.id, channel, audience) });
  } finally {
    done();
  }
});
