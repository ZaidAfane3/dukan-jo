import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { findStoreOrders, listStoreOrders, onlineRev, storeOrderByNumber, storeOrderCounts } from "@/server/storeOrders";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The orders customers placed on the signed-in merchant's public store (server/storeOrders.ts), newest first, with the
   customer's details: only the shop's own owner ever gets them. The Orders page shows them with the orders kept in his
   browser, a page at a time:
     GET /api/orders                the newest page: { orders, next, total, rev }
     GET /api/orders?before=<id>    the page of orders older than that one (its id from "next"), until "next" is null
     GET /api/orders?number=<n>     one order by its number (a link to an order not loaded yet): { orders: [it] or [] }
     GET /api/orders?q=<text>&status=<s>   the newest 100 that match a search and/or are in that status, among all of
                                    them (the page has not loaded every order): { orders }
   `total`: how many store orders the shop has; `counts`: how many in each status (newest page only); `rev`: the newest store order, so his browser can fetch the stock those
   orders took (components/serverSync.ts). */
export const GET = merchantRoute(async (req, me) => {
  const sp = req.nextUrl.searchParams;
  const number = sp.get("number");
  if (number !== null) {
    const one = await storeOrderByNumber(me.id, number);
    return answer({ result: "ok", orders: one ? [one] : [] });
  }
  const q = sp.get("q");
  const status = sp.get("status");
  if (q !== null || status !== null) return answer({ result: "ok", orders: await findStoreOrders(me.id, q ?? "", status) });
  const before = sp.get("before");
  const page = await listStoreOrders(me.id, before);
  return answer({ result: "ok", ...page, ...(before ? {} : { counts: await storeOrderCounts(me.id) }), rev: await onlineRev(await db(), me.id) });
});
