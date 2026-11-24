import { answer } from "@/server/auth";
import { backInStockStats, newsletterStats } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The emails visitors left on the signed-in merchant's own store (server/storeSignups.ts), as numbers only: never an
   address (owner decisions 2026-11-24, the shoppers' privacy). Only his own shop's: the account comes from his session,
   never from the request.
     GET /api/store-signups?kind=newsletter      { stats }: how many, new this month / in 7 days, by language and place
                                                 (he reaches them with a campaign, Marketing > Campaigns)
     GET /api/store-signups?kind=back_in_stock   { stats }: how many wait and were told, in total and per product and
                                                 size (he tells them with POST /api/store-signups/back-in-stock) */
export const GET = merchantRoute(async (req, me) => {
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind === "newsletter") return answer({ result: "ok", stats: await newsletterStats(me.id) });
  if (kind === "back_in_stock") return answer({ result: "ok", stats: await backInStockStats(me.id) });
  return answer({ result: "invalid" }, 400);
});
