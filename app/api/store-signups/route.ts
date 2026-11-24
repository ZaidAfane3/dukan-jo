import { answer } from "@/server/auth";
import { listSignups, newsletterStats } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The emails visitors left on the signed-in merchant's own store (server/storeSignups.ts). Only his own shop's: the
   account comes from his session, never from the request.
     GET /api/store-signups?kind=newsletter                  the newsletter's numbers only: { stats } (never an address:
                                                             he reaches them with a campaign, Marketing > Campaigns)
     GET /api/store-signups?kind=back_in_stock               the newest page of back-in-stock requests: { signups, next, total }
     GET /api/store-signups?kind=back_in_stock&before=<id>   the page older than that one (its id from "next")
     GET /api/store-signups?kind=back_in_stock&all=1         all of them at once, for his file (Export CSV) */
export const GET = merchantRoute(async (req, me) => {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");
  if (kind === "newsletter") return answer({ result: "ok", stats: await newsletterStats(me.id) });
  if (kind !== "back_in_stock") return answer({ result: "invalid" }, 400);
  return answer({ result: "ok", ...(await listSignups(me.id, kind, { before: sp.get("before"), all: sp.get("all") === "1" })) });
});
