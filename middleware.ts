import { NextResponse, type NextRequest } from "next/server";
import { isStoreAddress } from "@/components/safe";

/* A store's address is the site's address followed by its link name (app/[slug]). A link name no store has must answer
   "404 Not Found", but the page can't say so itself: the root app/loading.tsx starts sending the page (with 200) before
   the store is looked up. So, only for an address that could be a store link (one part, a link name, not one of the
   platform's own pages: safe.ts isStoreAddress), this asks first whether a shop has that link and gives the not-found
   page with a real 404 when there is no such store. A store Dukkan suspended is no store to a visitor either: its "store
   unavailable" page is given with a 404 too. The question is a one-row check (app/api/store-exists), not the whole
   store: the page reads that once, right after. If the check can't be answered within 1.5 s the visit goes on as usual.

   A rewrite is fetched by Next from the server again when Next takes its address for another server's: that happens when
   the server listens on 127.0.0.1 (Next calls it "localhost" in here, and the two don't match). That second visit comes
   back here, and without a mark it would be sent round again and again (until a 30 s timeout and a 500). So the rewrite
   marks the request (PASSED), and a marked one goes straight on to the page, which shows "store not found" itself.
   A visitor sending the mark only skips the check: the page still shows the right thing. */
const PASSED = "x-dukkan-store-checked";

/* an address with a broken percent sign ("/%ff") can't be read: Next fails on it with a 500, so it is answered here */
function unreadable(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (unreadable(path)) {
    if (/^\/api\//.test(path)) return NextResponse.json({ result: "invalid" }, { status: 400 });
    return new NextResponse("هذا الرابط غير صالح.\nThis link is not valid.\n", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!isStoreAddress(path) || req.headers.has(PASSED)) return NextResponse.next();
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
    if (r.status === 404) {
      const to = req.nextUrl.clone();
      to.pathname = `/${slug}`;
      const headers = new Headers(req.headers);
      headers.set(PASSED, "1");
      return NextResponse.rewrite(to, { status: 404, request: { headers } });
    }
  } catch {
    /* the server is restarting, unreachable or slow: let the page decide */
  }
  return NextResponse.next();
}

/* only addresses with a single part, never inside /api/, /_next/ or /media/ (those exact names: "/mediashop" is a store
   link like any other). Files and the platform's own pages are passed on by isStoreAddress above. Inside /api/ and
   /media/ only an address with a percent sign comes here, for the broken-percent check. */
export const config = { matcher: ["/((?!(?:api|_next|media)(?:/|$))[^/]+)", "/(api|media)/(.*%.*)"] };
