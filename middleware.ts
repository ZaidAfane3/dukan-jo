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

/* the Diwan page asked for (path and query), handed to the console's layout so a signed-out visit can come back to it
   after signing in (/diwan/login?next=..., checked there by safeNext). Set here only, never taken from the visitor. */
export const DIWAN_PAGE = "x-diwan-page";

/* an address with a broken percent sign ("/%ff") can't be read: Next fails on it with a 500, so it is answered here */
function unreadable(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/* The page for such an address: no React page can be given for it (Next can't read the address to route it), so it is
   a small page of its own, drawn like the site's "page not found" (components/StoreNotice.tsx MissingPage) with the same
   colours, light or dark as the device is set, in Arabic then English (the visitor's language isn't known here). Nothing
   from the address is written into it. */
const BAD_LINK_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>رابط غير صالح · دكان — Link not valid · Dukkan</title>
<style>
  :root { color-scheme: light dark; --page: #f8f5ef; --fg: #141414; --muted: #606064; --primary: #b85c17; --on-primary: #fff; --line: rgba(20, 20, 20, 0.12); }
  @media (prefers-color-scheme: dark) { :root { --page: #1b120c; --fg: #f7ede3; --muted: #c0ac99; --primary: #f0964f; --on-primary: #1b120c; --line: rgba(247, 237, 227, 0.15); } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 64px 20px; background: var(--page); color: var(--fg); font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; }
  main { width: 100%; max-width: 36rem; }
  .code { margin: 0; font-size: 72px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; color: var(--primary); }
  section { margin-top: 40px; }
  section + section { margin-top: 32px; padding-top: 32px; border-top: 1px solid var(--line); }
  h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.01em; opacity: 0.85; }
  p { margin: 16px 0 0; line-height: 1.6; color: var(--muted); }
  a { display: inline-flex; align-items: center; min-height: 44px; margin-top: 24px; padding: 0 24px; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-size: 14px; font-weight: 700; text-decoration: none; }
  a:hover { opacity: 0.9; }
  a:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <p class="code">400</p>
  <section>
    <h1>هذا الرابط غير صالح</h1>
    <p>فيه رموز لا يمكن قراءتها. تحقّق من الرابط، أو ابدأ من الصفحة الرئيسية.</p>
    <a href="/">الصفحة الرئيسية لدكان</a>
  </section>
  <section lang="en" dir="ltr">
    <h1>This link is not valid</h1>
    <p>It has characters that can't be read. Check the link, or start from the home page.</p>
    <a href="/">Dukkan's home page</a>
  </section>
</main>
</body>
</html>
`;

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (unreadable(path)) {
    if (/^\/api\//.test(path)) return NextResponse.json({ result: "invalid" }, { status: 400 });
    return new NextResponse(BAD_LINK_PAGE, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (path.startsWith("/diwan/")) {
    const headers = new Headers(req.headers);
    headers.set(DIWAN_PAGE, `${path}${req.nextUrl.search}`.slice(0, 2000));
    return NextResponse.next({ request: { headers } });
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
   /media/ only an address with a percent sign comes here, for the broken-percent check. Diwan's pages come here to hand
   on the page asked for (DIWAN_PAGE). */
export const config = { matcher: ["/((?!(?:api|_next|media)(?:/|$))[^/]+)", "/(api|media)/(.*%.*)", "/diwan/:path+"] };
