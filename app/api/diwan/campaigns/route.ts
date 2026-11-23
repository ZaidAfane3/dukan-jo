import { answer } from "@/server/auth";
import { staffCampaigns } from "@/server/campaigns";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** The marketing campaigns stores started, for Diwan > Store campaigns (server/campaigns.ts staffCampaigns): status,
    shop, page. Counts only, never a recipient. */
export const GET = staffRoute("shops.read", async (req) => answer({ result: "ok", ...(await staffCampaigns(req.nextUrl.searchParams)) }));
