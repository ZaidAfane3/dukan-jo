import type { NextRequest } from "next/server";
import { answer, reserveTry, sameOrigin, tooMany, readJsonOr, unreadable } from "@/server/auth";
import { cartFromLink, saveStoreCart, type CartSaveResult } from "@/server/storeCarts";

export const dynamic = "force-dynamic";

/* A visitor's basket on a store's public page, kept on the server so the merchant can remind him of it
   (server/storeCarts.ts), without a session:
     POST /api/public/store/<link name>/cart { key, lines, email?, phone?, name?, lang }   keeps (or, empty, deletes) it
     POST /api/public/store/<link name>/cart { restore: "<id>-<signature>" }              the lines of a reminder's link
   The cart sends it a few seconds after each change, only once a valid email or mobile is typed at checkout. Every
   price is worked out again from the store's own products.

   Limits: Dukkan's own pages only (the same origin check as the other public routes), a small body, a ceiling per
   visitor, and per store from every visitor together (only saves that went through count, as store orders).
   Answers: 200 "ok" (with `lines` for a link), 400 "invalid", 404 "none", 409 "closed", 403 "forbidden",
   413 "too-big", 429 "slow-down". */

const MAX_BODY = 8_000;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
    const read = await readJsonOr(req, MAX_BODY);
    if (!("body" in read)) return unreadable(read.why);
    const body = read.body;
    if (body.restore !== undefined) {
      /* a reminder's link opened: a few per visitor, so links can't be tried one after another */
      if (tooMany(req, "store-cart-link", 20, 15)) return answer({ result: "slow-down" }, 429);
      const r = await cartFromLink(p.slug, body.restore);
      return answer(r.body, r.status);
    }
    /* per visitor: a basket changed often while shopping (each change is sent once, a few seconds after it) */
    if (tooMany(req, "store-cart", 120, 15)) return answer({ result: "slow-down" }, 429);
    /* per store, from every visitor together; taken before the database wait and given back when nothing was kept */
    const back = reserveTry(`store-cart-shop:${String(p.slug ?? "").toLowerCase().slice(0, 64)}`, 3000, 60);
    if (!back) return answer({ result: "slow-down" }, 429);
    let r: CartSaveResult | null = null;
    try {
      r = await saveStoreCart(p.slug, body);
      return answer(r.body, r.status);
    } finally {
      if (r?.status !== 200) back();
    }
  } catch (e) {
    console.error("[store cart]", p.slug, e);
    return answer({ result: "error" }, 503);
  }
}
