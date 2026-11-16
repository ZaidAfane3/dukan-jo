import { NextResponse, type NextRequest } from "next/server";
import { isStoreAddress } from "@/components/safe";

/* A store's address is the site's address followed by its link name (app/[slug]). A link name no store has must answer
   "404 Not Found", but the page can't say so itself: the root app/loading.tsx starts sending the page (with 200) before
   the store is looked up. So, only for an address that could be a store link (one part, a link name, not one of the
   platform's own pages: safe.ts isStoreAddress), this asks the public store API first and gives the not-found page with
   a real 404 when there is no such store. If the API can't be reached the visit goes on as usual. */
export async function middleware(req: NextRequest) {
  if (!isStoreAddress(req.nextUrl.pathname)) return NextResponse.next();
  const slug = req.nextUrl.pathname.slice(1).toLowerCase();
  try {
    const r = await fetch(new URL(`/api/public/store/${slug}`, req.nextUrl.origin), { method: "GET", headers: { accept: "application/json" }, cache: "no-store" });
    if (r.status === 404) return NextResponse.rewrite(new URL(`/${slug}`, req.url), { status: 404 });
  } catch {
    /* the API is restarting or unreachable: let the page decide */
  }
  return NextResponse.next();
}

/* only addresses with a single part and no dot (no files, no /api, no /_next) */
export const config = { matcher: "/((?!api|_next|media)[^/.]+)" };
