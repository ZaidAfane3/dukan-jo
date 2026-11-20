import { NextResponse, type NextRequest } from "next/server";
import { isStoreAddress } from "@/components/safe";

/* A store's address is the site's address followed by its link name (app/[slug]). A link name no store has must answer
   "404 Not Found", but the page can't say so itself: the root app/loading.tsx starts sending the page (with 200) before
   the store is looked up. So, only for an address that could be a store link (one part, a link name, not one of the
   platform's own pages: safe.ts isStoreAddress), this asks first whether a shop has that link and gives the not-found
   page with a real 404 when there is no such store. A store Dukkan suspended is no store to a visitor either: its "store
   unavailable" page is given with a 404 too. The question is a one-row check (app/api/store-exists), not the whole
   store: the page reads that once, right after. If the check can't be answered within 1.5 s the visit goes on as usual. */
export async function middleware(req: NextRequest) {
  if (!isStoreAddress(req.nextUrl.pathname)) return NextResponse.next();
  const slug = req.nextUrl.pathname.slice(1).toLowerCase();
  try {
    /* asked of this same server from inside: on the live site the public address goes out through Cloudflare and back,
       which can fail. The server listens on PORT (Dockerfile); in development the page's own address works. */
    const base = process.env.NODE_ENV === "production" ? `http://127.0.0.1:${process.env.PORT || 3000}` : req.nextUrl.origin;
    const r = await fetch(new URL(`/api/store-exists/${slug}`, base), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (r.status === 404) return NextResponse.rewrite(new URL(`/${slug}`, req.url), { status: 404 });
  } catch {
    /* the server is restarting, unreachable or slow: let the page decide */
  }
  return NextResponse.next();
}

/* only addresses with a single part, never inside /api/, /_next/ or /media/ (those exact names: "/mediashop" is a store
   link like any other). Files and the platform's own pages are passed on by isStoreAddress above. */
export const config = { matcher: "/((?!(?:api|_next|media)(?:/|$))[^/]+)" };
