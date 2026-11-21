import { NextResponse, type NextRequest } from "next/server";
import { SLUG_RULE } from "@/components/safe";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* Only for middleware.ts: whether a store link can be visited, without reading the store itself (the page reads it once,
   right after). One row of the shops table, by its link index:
     200 { result: "ok" }    a shop has this link (open, paused or not open yet: the page says which)
     404 { result: "none" }  no shop has it, or Dukkan suspended it (a visitor is told "unavailable", with a 404)
   It says nothing GET /api/public/store/<link> does not already say. */
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const name = String((await ctx.params).slug ?? "").toLowerCase();
  if (!SLUG_RULE.test(name)) return NextResponse.json({ result: "none" }, { status: 404, headers });
  try {
    const { rows } = await (await db()).query(`SELECT status FROM shops WHERE lower(slug) = $1 LIMIT 1`, [name]);
    const found = rows[0] && rows[0].status !== "suspended";
    return NextResponse.json({ result: found ? "ok" : "none" }, { status: found ? 200 : 404, headers });
  } catch (e) {
    console.error("[store exists]", name, e);
    return NextResponse.json({ result: "error" }, { status: 503, headers });
  }
}
