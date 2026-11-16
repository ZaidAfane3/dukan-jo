import { NextResponse, type NextRequest } from "next/server";
import { currentAccount, readJson, sameOrigin, tooMany, tooManyFor } from "@/server/auth";
import { STAFF_COOKIE } from "@/server/staff";
import { isBot, isPrefetch, recordVisit } from "@/server/storeVisits";

export const dynamic = "force-dynamic";

/* A visitor opened a page of a store at its address: POST /api/public/store/<link name>/visit, sent by the store's page
   in the visitor's browser (components/storeVisits.ts sendVisit) once per page, without a session. server/storeVisits.ts
   decides what is counted and keeps nothing that names the visitor.

   Not counted: requests from other sites (the same origin check as the other routes), programs (search engines, link
   previews, scripts), prefetches, Dukkan's staff (a Diwan cookie in the browser), the store's own merchant signed in
   on this browser, a store that is not open, a body over a few hundred characters, and more than a person could open
   (per visitor and per store). Whatever happens the answer is the same quick, empty 204: the page never waits for it
   and learns nothing from it. */

const MAX_BODY = 400;
const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  try {
    if (!sameOrigin(req) || isPrefetch(req) || isBot(req.headers.get("user-agent") ?? "")) return done();
    if (req.cookies.get(STAFF_COOKIE)?.value) return done();
    /* per visitor: a person opens far fewer pages than this */
    if (tooMany(req, "store-visit", 120, 10)) return done();
    const slug = String(ctx.params.slug ?? "").toLowerCase().slice(0, 64);
    /* per store, from every visitor together */
    if (tooManyFor(`store-visit-shop:${slug}`, 6000, 10)) return done();
    const body = await readJson(req, MAX_BODY);
    if (!body) return done();
    /* saved after the answer has gone: the page is never held up by the database */
    const signedIn = async () => (await currentAccount(req))?.id ?? null;
    void recordVisit(req, slug, body, signedIn).catch((e) => console.error("[store visit]", slug, e));
  } catch (e) {
    console.error("[store visit]", ctx.params.slug, e);
  }
  return done();
}
