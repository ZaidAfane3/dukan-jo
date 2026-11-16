import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicStore } from "@/server/publicStore";
import { PublicStore } from "./PublicStore";

/* Every store lives at Dukkan's address followed by its link name (components/siteAddress.ts): this page is that
   address. The platform's own pages are folders next to this one and always win over it, and no store may take one of
   their names (safe.ts RESERVED_SLUGS). A link name no shop has is "not found". What is shown comes from
   server/publicStore.ts: only what a visitor may see, read fresh on every visit. */

export const dynamic = "force-dynamic";

/* the page and its title ask once per visit */
const load = cache((slug: string) => publicStore(slug));

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  /* asked here too, so a link name no shop has answers 404 before the page starts streaming (app/loading.tsx) */
  const store = await load(params.slug);
  if (!store) notFound();
  if (store.status !== "open") {
    const name = store.status === "unavailable" ? "" : store.name;
    /* a store that can't be visited now is kept out of search engines */
    return { title: name || "Dukkan", robots: { index: false, follow: false } };
  }
  return { title: store.setup.name || "Dukkan", description: store.setup.description.slice(0, 160) || undefined };
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const store = await load(params.slug);
  if (!store) notFound();
  return <PublicStore store={store} />;
}
