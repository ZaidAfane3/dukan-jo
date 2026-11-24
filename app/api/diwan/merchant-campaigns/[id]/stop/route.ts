import { answer } from "@/server/auth";
import { merchantCampaignOf, stopMerchantCampaign } from "@/server/merchantCampaigns";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Stops a campaign that is sending: POST /api/diwan/merchant-campaigns/<id>/stop. The merchants it hasn't reached yet
    never get it; a batch already handed to the email service still arrives. Answers "ok" (with the campaign as it is
    now), 404 "none", 409 "not-sending". */
export const POST = staffRoute("announce", async (req, staff, { params }) => {
  const id = String(params.id ?? "");
  const before = await merchantCampaignOf(id);
  if (!before) return answer({ result: "none" }, 404);
  const now = await stopMerchantCampaign(id, staff.id);
  if (!now) return answer({ result: "not-sending" }, 409);
  await audit(req, staff.id, "merchant_campaign.stop", { type: "merchant_campaign", id }, null, {
    title: now.subjectEn || now.subjectAr,
    count: Math.max(0, now.skipped - before.skipped),
  });
  return answer({ result: "ok", campaign: now });
});
