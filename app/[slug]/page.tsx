import type { Metadata } from "next";
import { cache } from "react";
import { publicStore } from "@/server/publicStore";
import { MissingPage, MovedPage } from "@/components/StoreNotice";
import { movedStore } from "@/server/slugHolds";
import { PublicStore } from "./PublicStore";

/* Every store lives at Dukkan's address followed by its link name (components/siteAddress.ts): this page is that
   address. The platform's own pages are folders next to this one and always win over it, and no store may take one of
   their names (safe.ts isPlatformPage). A link name no shop has is "not found". What is shown comes from
   server/publicStore.ts: only what a visitor may see, read fresh on every visit. */

export const dynamic = "force-dynamic";

/* the page and its title ask once per visit */
const load = cache((slug: string) => publicStore(slug));
/* a link no shop has now: a store that gave it up lately says where it moved (server/slugHolds.ts) */
const moved = cache((slug: string) => movedStore(slug).catch(() => null));

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  /* a link name no shop has: the page below says so (middleware.ts gives it the 404) */
  const store = await load(params.slug);
  /* the first drawing is Arabic (the site's first language); the page then puts the visitor's language in the tab */
  if (!store) return { title: (await moved(params.slug)) ? "انتقل هذا المتجر · دكان" : "المتجر غير موجود · دكان", robots: { index: false, follow: false } };
  if (store.status !== "open") {
    const name = store.status === "unavailable" ? "" : store.name;
    /* a store that can't be visited now is kept out of search engines */
    return { title: name || "Dukkan", robots: { index: false, follow: false } };
  }
  return { title: store.setup.name || "Dukkan", description: store.setup.description.slice(0, 160) || undefined };
}

export default async function StorePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const store = await load(params.slug);
  /* drawn here rather than with notFound(): Next 14 shows its own plain page for a notFound() from this segment */
  if (!store) {
    const to = await moved(params.slug);
    return to ? <MovedPage to={to.slug} name={to.name} /> : <MissingPage kind="store" />;
  }
  return <PublicStore store={store} />;
}
