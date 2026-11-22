import type { NextRequest } from "next/server";
import { answer, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { checkStoreCoupon, reserveCouponGuess } from "@/server/storeOrders";

export const dynamic = "force-dynamic";

/* A coupon code a customer types in a store's cart: POST /api/public/store/<link name>/coupon { code }, without a
   session. Answers { result: "ok", coupon } with only what the cart needs to show the discount, or { result: "refused",
   why }. Placing the order checks the code again. Limited per visitor, so codes can't be guessed by trying many. */

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    if (tooMany(req, "store-coupon", 30, 15)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, 500);
    if (!("body" in read)) return unreadable(read.why);
    const body = read.body;
    /* refused codes per store from every visitor together (server/storeOrders.ts COUPON_GUESSES): taken before the code
       is checked, so guesses sent at the same moment can't all pass, and given back when the code wasn't refused */
    const giveBack = reserveCouponGuess(p.slug);
    if (!giveBack) return answer({ result: "slow-down" }, 429);
    let refused = false;
    try {
      const r = await checkStoreCoupon(p.slug, body.code);
      refused = r.body.result === "refused";
      return answer(r.body, r.status);
    } finally {
      if (!refused) giveBack();
    }
  } catch (e) {
    console.error("[store coupon]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
