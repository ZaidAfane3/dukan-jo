import { answer, readJson } from "@/server/auth";
import { deleteMerchantDraft, merchantCampaignOf, saveMerchantDraft } from "@/server/merchantCampaigns";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* One of Dukkan's campaigns to merchants (server/merchantCampaigns.ts):
     GET     the campaign, its texts and numbers
     PUT     saves a draft's texts and audience (one that started can't change: 409 "not-draft")
     DELETE  deletes a draft (one that started stays, with its numbers) */
export const GET = staffRoute("announce", async (_req, _me, { params }) => {
  const c = await merchantCampaignOf(String(params.id ?? ""));
  return c ? answer({ result: "ok", campaign: c }) : answer({ result: "none" }, 404);
});

export const PUT = staffRoute("announce", async (req, staff, { params }) => {
  const body = await readJson(req, 100_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const r = await saveMerchantDraft(staff.id, String(params.id ?? ""), body);
  if (r.status === 200) {
    const c = r.body.campaign;
    await audit(req, staff.id, "merchant_campaign.edit", { type: "merchant_campaign", id: c.id }, null, { title: c.subjectEn || c.subjectAr });
  }
  return answer(r.body, r.status);
});

export const DELETE = staffRoute("announce", async (req, staff, { params }) => {
  const id = String(params.id ?? "");
  const r = await deleteMerchantDraft(id);
  if (r.result === "ok") {
    await audit(req, staff.id, "merchant_campaign.delete", { type: "merchant_campaign", id }, null, { title: r.subject });
    return answer({ result: "ok" });
  }
  return answer({ result: r.result }, r.result === "none" ? 404 : 409);
});
