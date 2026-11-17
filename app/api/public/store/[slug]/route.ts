import { NextResponse, type NextRequest } from "next/server";
import { publicStore } from "@/server/publicStore";

export const dynamic = "force-dynamic";

/* A store as its visitors see it, for anyone and without a session: GET /api/public/store/<link name>. Only what the
   storefront shows comes back (server/publicStore.ts decides what that is), never orders, customers, coupons or
   anything about the account. A store link that belongs to no shop answers 404 "none".

   Shared caches may keep an answer for 30 seconds and serve it a little longer while they fetch a fresh one, so a
   change the merchant saves (or a store Dukkan suspends) reaches visitors within about a minute. */

const headers = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const p = await ctx.params;
  try {
    const store = await publicStore(p.slug);
    if (!store) return NextResponse.json({ result: "none" }, { status: 404, headers });
    return NextResponse.json({ result: "ok", store }, { headers });
  } catch (e) {
    console.error("[public store]", p.slug, e);
    return NextResponse.json({ result: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
