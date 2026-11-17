import type { NextRequest } from "next/server";
import { answer, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { placeStoreOrder } from "@/server/storeOrders";

export const dynamic = "force-dynamic";

/* A customer places an order on a store's public page: POST /api/public/store/<link name>/orders, without a session.
   server/storeOrders.ts checks the store is open, prices everything again from the store's own saved products, checks
   the stock, the coupon and the customer's details, takes the stock and saves the order for the merchant. No payment is
   taken: every order is a test order.

   Limits: only from Dukkan's own pages (the same origin check as the other routes), a small body, and at most a few
   orders per visitor and per store in a while, so a script can't fill a store with orders or empty its stock.
   Answers: 200 { result: "ok", order }, 400 "invalid" (with the fields), 404 "none", 409 "closed" / "changed" (with the
   cart priced again) / "coupon" (with why), 403 "forbidden", 413 "too-big", 429 "slow-down". */

const MAX_BODY = 16_000;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    /* per visitor: enough for a team testing from one office, too few to empty a store */
    if (tooMany(req, "store-order", 20, 15)) return answer({ result: "slow-down" }, 429);
    const body = await readJson(req, MAX_BODY);
    if (!body) return answer({ result: "too-big" }, 413);
    /* per store, from every visitor together */
    if (tooManyFor(`store-order-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`, 60, 60)) return answer({ result: "slow-down" }, 429);
    const r = await placeStoreOrder(p.slug, body);
    return answer(r.body, r.status);
  } catch (e) {
    console.error("[store order]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
