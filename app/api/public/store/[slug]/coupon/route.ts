import type { NextRequest } from "next/server";
import { answer, readJson, sameOrigin, tooMany } from "@/server/auth";
import { checkStoreCoupon } from "@/server/storeOrders";

export const dynamic = "force-dynamic";

/* A coupon code a customer types in a store's cart: POST /api/public/store/<link name>/coupon { code }, without a
   session. Answers { result: "ok", coupon } with only what the cart needs to show the discount, or { result: "refused",
   why }. Placing the order checks the code again. Limited per visitor, so codes can't be guessed by trying many. */

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    if (tooMany(req, "store-coupon", 30, 15)) return answer({ result: "slow-down" }, 429);
    const body = await readJson(req, 500);
    if (!body) return answer({ result: "too-big" }, 413);
    const r = await checkStoreCoupon(ctx.params.slug, body.code);
    return answer(r.body, r.status);
  } catch (e) {
    console.error("[store coupon]", ctx.params.slug, e);
    return answer({ result: "error" }, 503);
  }
}
