import type { NextRequest } from "next/server";
import { latin } from "@/components/digits";
import { answer, reserveTry, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { findStoreAttempt, placeStoreOrder, previousAttempts, reserveCouponGuess, type PlaceResult } from "@/server/storeOrders";

export const dynamic = "force-dynamic";

/* A customer places an order on a store's public page: POST /api/public/store/<link name>/orders, without a session.
   server/storeOrders.ts checks the store is open, prices everything again from the store's own saved products, checks
   the stock, the coupon and the customer's details, and saves the order for the merchant (it takes no stock: that happens when the merchant confirms it or marks its payment received, server/storeOrders.ts). No payment is
   taken: every order is a test order.

   Limits: only from Dukkan's own pages (the same origin check as the other routes), a small body, and at most a few
   orders per visitor and per store in a while, so a script can't fill a store with orders or empty its stock.
   Answers: 200 { result: "ok", order }, 400 "invalid" (with the fields), 404 "none", 409 "closed" / "no-delivery" (no delivery choice and no pickup) / "changed" (with the
   cart priced again) / "coupon" (with why) / "too-big" (the order comes to more than a store amount can be), 403 "forbidden", 413 "too-big"
   (the request itself), 429 "slow-down". */

const MAX_BODY = 16_000;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    /* looking up whether a checkout got in (below) only reads: it has its own, looser limit per visitor, so a customer
       whose order went in gets his thank-you even after trying many times, while a script still can't read without end */
    if (tooMany(req, "store-order-lookup", 120, 15)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return unreadable(read.why);
    const body = read.body;
    /* { lookup: <key> }: only asks whether the order sent with that key got in (a reloaded checkout), places nothing */
    if (typeof body.lookup === "string") {
      const r = await findStoreAttempt(p.slug, body.lookup);
      return answer(r.body, r.status);
    }
    /* a checkout sent again (its answer was lost, or the page was reloaded): its order, if it got in, comes back before
       the order limits below, and doesn't count again */
    for (const key of [body.attempt, ...previousAttempts(body.previous, body.attempt)]) {
      if (typeof key !== "string") continue;
      const before = await findStoreAttempt(p.slug, key);
      if (before.status === 200 && before.body.result === "ok") return answer(before.body, 200);
    }
    /* per visitor, for placing an order: enough for a team testing from one office, too few to empty a store */
    if (tooMany(req, "store-order", 20, 15)) return answer({ result: "slow-down" }, 429);
    /* per store, from every visitor together, and per customer mobile: only orders that went in count, so a stranger
       sending empty or broken orders can't use up a store's allowance and lock its real customers out */
    const shopKey = `store-order-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`;
    const customer = body.customer && typeof body.customer === "object" ? (body.customer as Record<string, unknown>) : {};
    const mobile = typeof customer.phone === "string" ? latin(customer.phone).replace(/\D/g, "").slice(-9) : "";
    const phoneKey = mobile ? `${shopKey}:${mobile}` : null;
    /* each allowance is taken before the order is placed, so orders sent at the same moment can't all pass the look while
       the first ones are still being written, and given back below when the order didn't go in. A coupon code also
       takes one try of the store's allowance for wrong codes, the same one as the cart's coupon box (server/storeOrders.ts
       COUPON_GUESSES): placing orders can't be used to go on guessing codes once it is used up. */
    const nothing = () => {};
    const hasCoupon = typeof body.coupon === "string" && body.coupon.slice(0, 40).trim() !== "";
    const backShop = reserveTry(shopKey, 200, 60);
    const backPhone = backShop && (phoneKey ? reserveTry(phoneKey, 5, 60) : nothing);
    const backCoupon = backPhone && (hasCoupon ? reserveCouponGuess(p.slug) : nothing);
    if (!backShop || !backPhone || !backCoupon) {
      backShop?.();
      backPhone?.();
      return answer({ result: "slow-down" }, 429);
    }
    let r: PlaceResult | null = null;
    try {
      r = await placeStoreOrder(p.slug, body);
      return answer(r.body, r.status);
    } finally {
      if (r?.status !== 200) {
        backShop();
        backPhone();
      }
      /* only a wrong code counts (a code that works but needs a bigger basket, "min", is not a guess) */
      if (!(r?.status === 409 && r.body.result === "coupon" && r.body.why === "unknown")) backCoupon();
    }
  } catch (e) {
    console.error("[store order]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
