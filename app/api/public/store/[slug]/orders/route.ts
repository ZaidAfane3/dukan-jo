import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, countTry, limitReached, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { findStoreAttempt, placeStoreOrder } from "@/server/storeOrders";

export const dynamic = "force-dynamic";

/* A customer places an order on a store's public page: POST /api/public/store/<link name>/orders, without a session.
   server/storeOrders.ts checks the store is open, prices everything again from the store's own saved products, checks
   the stock, the coupon and the customer's details, takes the stock and saves the order for the merchant. No payment is
   taken: every order is a test order.

   Limits: only from Dukkan's own pages (the same origin check as the other routes), a small body, and at most a few
   orders per visitor and per store in a while, so a script can't fill a store with orders or empty its stock.
   Answers: 200 { result: "ok", order }, 400 "invalid" (with the fields), 404 "none", 409 "closed" / "no-delivery" (no delivery choice and no pickup) / "changed" (with the
   cart priced again) / "coupon" (with why), 403 "forbidden", 413 "too-big", 429 "slow-down". */

const MAX_BODY = 16_000;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    /* per visitor: enough for a team testing from one office, too few to empty a store */
    if (tooMany(req, "store-order", 20, 15)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return unreadable(read.why);
    const body = read.body;
    /* { lookup: <key> }: only asks whether the order sent with that key got in (a reloaded checkout), places nothing */
    if (typeof body.lookup === "string") {
      const r = await findStoreAttempt(p.slug, body.lookup);
      return answer(r.body, r.status);
    }
    /* per store, from every visitor together, and per customer mobile: only orders that went in count, so a stranger
       sending empty or broken orders can't use up a store's allowance and lock its real customers out */
    /* a checkout sent again (its answer was lost, or the page was reloaded): its order, if it got in, comes back before
       any limit, and doesn't count again */
    for (const key of [body.attempt, body.previous]) {
      if (typeof key !== "string") continue;
      const before = await findStoreAttempt(p.slug, key);
      if (before.status === 200 && before.body.result === "ok") return answer(before.body, 200);
    }
    const shopKey = `store-order-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`;
    const customer = body.customer && typeof body.customer === "object" ? (body.customer as Record<string, unknown>) : {};
    const mobile = typeof customer.phone === "string" ? latin(customer.phone).replace(/\D/g, "").slice(-9) : "";
    const phoneKey = mobile ? `${shopKey}:${mobile}` : null;
    if (limitReached(shopKey, 200, 60) || (phoneKey && limitReached(phoneKey, 5, 60))) return answer({ result: "slow-down" }, 429);
    const r = await placeStoreOrder(p.slug, body);
    if (r.status === 200) {
      countTry(shopKey, 60);
      if (phoneKey) countTry(phoneKey, 60);
    }
    return answer(r.body, r.status);
  } catch (e) {
    console.error("[store order]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
