import { answer, otherAccount } from "@/server/auth";
import { startCampaign } from "@/server/campaigns";
import { logMerchant } from "@/server/merchantLog";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* "Send now": POST /api/campaigns/<id>/send starts one of the signed-in merchant's drafts (server/campaigns.ts
   startCampaign holds every check, in one transaction: a second press or another tab gets 409 "not-draft"). It goes out
   in the background; the page follows its numbers with GET /api/campaigns. Answers: 200 { campaign }, 400 "invalid"
   (problems), 404 "none", 409 "not-draft" / "no-recipients" / "mobile-soon" / "other-account", 423 "suspended",
   429 "daily-limit" (max), 503 "no-sender" (email not set up on this server). */
export const POST = merchantRoute(async (req, me, ctx) => {
  if (otherAccount(req, me)) return answer({ result: "other-account" }, 409);
  const r = await startCampaign(me.id, String(ctx.params.id ?? ""));
  if (r.status === 200) logMerchant(me.id, "campaign.sent", { channel: r.body.campaign.channel, recipients: r.body.campaign.recipients });
  return answer(r.body, r.status);
});
