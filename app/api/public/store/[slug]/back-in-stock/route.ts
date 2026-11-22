import type { NextRequest } from "next/server";
import { answer, reserveTry, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { backInStockSignup } from "@/server/storeSignups";

export const dynamic = "force-dynamic";

/* "Remind me when it's back" on a sold-out product of a store: POST /api/public/store/<link name>/back-in-stock
   { email, lang, product, size? }, without a session. server/storeSignups.ts checks the store is open (like an order)
   and that the product (or that size) is really sold out, and keeps the email, sealed, once per product and size, for
   the store's merchant only. Nothing is sent to the email.

   Limits: the same as the newsletter (app/api/public/store/[slug]/newsletter): Dukkan's own pages only, a small body, a
   few per visitor and a ceiling per store from every visitor together.
   Answers: 200 "ok" (also for an email already on the list: the answer never tells), 400 "invalid", 404 "none",
   409 "closed" / "in-stock" (it can be bought now), 403 "forbidden", 413 "too-big", 429 "slow-down". */

const MAX_BODY = 600;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    /* per visitor: a few products, a family on one connection */
    if (tooMany(req, "store-back-in-stock", 20, 15)) return answer({ result: "slow-down" }, 429);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return unreadable(read.why);
    /* per store, from every visitor together: only requests that went through count */
    const shopKey = `store-back-in-stock-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`;
    /* taken before the database wait, so requests sent at the same moment can't all pass the look; given back when
       nothing was kept (as store orders, F10) */
    const back = reserveTry(shopKey, 300, 60);
    if (!back) return answer({ result: "slow-down" }, 429);
    let r: Awaited<ReturnType<typeof backInStockSignup>> | null = null;
    try {
      r = await backInStockSignup(p.slug, read.body);
      return answer(r.body, r.status);
    } finally {
      if (r?.status !== 200) back();
    }
  } catch (e) {
    console.error("[store back in stock]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
