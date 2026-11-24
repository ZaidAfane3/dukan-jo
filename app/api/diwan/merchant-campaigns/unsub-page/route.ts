import { UNSUB_TEXT_DEFAULT } from "@/components/merchantCampaignRules";
import { answer, readJson } from "@/server/auth";
import { readUnsubText, saveUnsubText, unsubStats } from "@/server/merchantCampaigns";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The page a merchant reaches from "Stop Dukkan's marketing emails" (app/unsubscribe/dukkan), as Diwan sees it
   (server/merchantCampaigns.ts):
     GET  its message in both languages (and the defaults), and how many merchants have these emails stopped or paused
          now, with counts per reason they gave (never who)
     PUT  { en, ar } changes the message (an empty language goes back to the default; 400 "too-long" over 1,000) */
export const GET = staffRoute("announce", async () => {
  const [text, stats] = await Promise.all([readUnsubText(), unsubStats()]);
  return answer({ result: "ok", text, defaults: UNSUB_TEXT_DEFAULT, stats });
});

export const PUT = staffRoute("announce", async (req, staff) => {
  const body = await readJson(req, 20_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const r = await saveUnsubText(staff.id, body);
  if (!r) return answer({ result: "too-long" }, 400);
  /* the log keeps both texts before and after, so every change can be told from what to what */
  await audit(req, staff.id, "merchant_campaign.unsub_text", { type: "setting", id: "dukkan_unsub_page" }, null, { before: r.before, after: r.after });
  return answer({ result: "ok", text: r.after });
});
