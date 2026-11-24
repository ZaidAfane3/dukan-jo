import { answer } from "@/server/auth";
import { startMerchantCampaign } from "@/server/merchantCampaigns";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Starts a draft: POST /api/diwan/merchant-campaigns/<id>/send. Its merchants are fixed now and the emails go out in
    batches in the background (server/merchantCampaigns.ts). A second press answers 409 "not-draft" and sends nothing.
    Other answers: 400 "invalid" (problems), 404 "none", 409 "no-recipients", 429 "daily-limit", 503 "no-sender". */
export const POST = staffRoute("announce", async (req, staff, { params }) => {
  const id = String(params.id ?? "");
  const r = await startMerchantCampaign(id, staff.id);
  if (r.status === 200) {
    const c = r.body.campaign;
    await audit(req, staff.id, "merchant_campaign.send", { type: "merchant_campaign", id }, null, { title: c.subjectEn || c.subjectAr, count: c.recipients, audience: c.audience });
  }
  return answer(r.body, r.status);
});
