import { answer, readJson } from "@/server/auth";
import { listMerchantCampaigns, saveMerchantDraft } from "@/server/merchantCampaigns";
import { onceByKey } from "@/server/onceKey";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Dukkan's campaigns to merchants (server/merchantCampaigns.ts), for Diwan > Marketing > Campaigns to merchants.
   Counts only, never who got one. "announce" is the marketing permission (announcements, pop-ups, pages).
     GET  ?view=now             drafts and campaigns sending: { campaigns, today, emailOn }
     GET  ?view=past&page=<n>   sent, failed and stopped ones, 25 a page: { rows, page, pages, today, emailOn }
     POST { texts..., audience, requestKey }   a new draft: { campaign } */
export const GET = staffRoute("announce", async (req) => {
  const sp = req.nextUrl.searchParams;
  return answer({ result: "ok", ...(await listMerchantCampaigns(sp.get("view") ?? "now", Number(sp.get("page")) || 1)) });
});

export const POST = staffRoute("announce", async (req, staff) => {
  const body = await readJson(req, 100_000);
  if (!body) return answer({ result: "invalid" }, 400);
  /* sent twice (a double click, a retry) with the same key: made once (server/onceKey.ts) */
  return onceByKey(`merchant-campaign:${staff.id}`, body.requestKey, async () => {
    const r = await saveMerchantDraft(staff.id, null, body);
    if (r.status === 200) {
      const c = r.body.campaign;
      await audit(req, staff.id, "merchant_campaign.create", { type: "merchant_campaign", id: c.id }, null, { title: c.subjectEn || c.subjectAr });
    }
    return answer(r.body, r.status);
  });
});
