"use client";

import { useCallback, useEffect, useState } from "react";
import { MaintenancePage } from "@/components/MaintenancePage";
import { Notice } from "@/components/StoreNotice";
import { usePrefs } from "@/components/Prefs";
import type { PublicStore as Store, PublicStoreOpen } from "@/components/publicStore";
import { safeStoredImage } from "@/components/safe";
import { StoreSkeleton } from "@/components/StoreSkeletons";
import type { StorefrontConfig } from "@/components/storefront/config";
import { visitorDesign } from "@/components/storefront/storage";
import { StorefrontTheme } from "@/components/storefront/StorefrontTheme";
import { VisitorRefreshContext, VisitorStoreContext } from "@/components/storefront/visitorStore";

/* A merchant's store at its address, for its visitors (app/[slug]/page.tsx). Everything shown comes from what the server
   sent; the visitor's own browser storage is never read or written for it (see storefront/visitorStore.ts), so a visitor
   who has a Dukkan store of their own sees this store only. Only the visitor's basket is kept there, per store
   (storefront/visitorBasket.ts). A product or page open has its own address (?p=<id>, ?page=<id>, see StorefrontTheme).
   The language is the visitor's own choice. */

/* An open store: its design is put together in the browser (like the merchant's own preview, app/store), then drawn */
function OpenStore({ store }: { store: PublicStoreOpen }) {
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  useEffect(() => {
    setConfig(visitorDesign(store.design, store.template, store.pages, store.setup.shipping?.mode));
  }, [store]);
  /* the store as read last: the page's own copy, or a fresh one asked for after an order (the cart asks, so a product
     that just sold out shows as sold out). Only an open store's answer replaces it: a store that closed meanwhile keeps
     its page until the next visit, and its checkout says it is closed. The design stays the one the page opened with. */
  const [live, setLive] = useState(store);
  useEffect(() => setLive(store), [store]);
  const slug = store.setup.slug;
  const refresh = useCallback(async () => {
    try {
      /* (a new address each time, so no cache in between answers with the copy from before the order) */
      const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}?fresh=${Date.now()}`, { cache: "no-store", headers: { accept: "application/json" } });
      const j = (await r.json().catch(() => null)) as { result?: string; store?: Store } | null;
      if (j?.result === "ok" && j.store?.status === "open") setLive(j.store);
    } catch {
      /* offline: the page keeps what it has; the server checks the stock at every order anyway */
    }
  }, [slug]);

  /* the store's own tab icon while it is open (only picture data or the site's own file, never another site's) */
  const favicon = config?.identity.favicon;
  useEffect(() => {
    const icon = safeStoredImage(favicon);
    if (!icon) return;
    const old = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    old.forEach((l) => l.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = icon;
    document.head.appendChild(link);
    return () => {
      link.remove();
      old.forEach((l) => document.head.appendChild(l));
    };
  }, [favicon]);

  if (!config) return <StoreSkeleton />;
  return (
    <VisitorStoreContext.Provider value={live}>
      <VisitorRefreshContext.Provider value={refresh}>
        <div className="min-h-screen bg-[#eef0f0]">
          {/* Like a real website, the store keeps a comfortable width on a big screen */}
          <div className="mx-auto max-w-[1180px] bg-white shadow-sm">
            <StorefrontTheme config={config} />
          </div>
        </div>
      </VisitorRefreshContext.Provider>
    </VisitorStoreContext.Provider>
  );
}

export function PublicStore({ store }: { store: Store }) {
  const { lang } = usePrefs();
  if (store.status === "unavailable") return <Notice kind="unavailable" lang={lang} />;
  if (store.status === "soon") return <Notice kind="soon" name={store.name} lang={lang} />;
  if (store.status === "paused") {
    return <MaintenancePage lang={lang} name={store.name} message={store.message[lang]} />;
  }
  return <OpenStore store={store} />;
}
