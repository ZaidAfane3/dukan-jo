"use client";

import { useEffect, useState } from "react";
import { MaintenancePage } from "@/components/MaintenancePage";
import { Notice } from "@/components/StoreNotice";
import { usePrefs } from "@/components/Prefs";
import type { PublicStore as Store, PublicStoreOpen } from "@/components/publicStore";
import { safeStoredImage } from "@/components/safe";
import { StoreSkeleton } from "@/components/StoreSkeletons";
import type { StorefrontConfig } from "@/components/storefront/config";
import { visitorDesign } from "@/components/storefront/storage";
import { StorefrontTheme } from "@/components/storefront/StorefrontTheme";
import { VisitorStoreContext } from "@/components/storefront/visitorStore";

/* A merchant's store at its address, for its visitors (app/[slug]/page.tsx). Everything shown comes from what the server
   sent; the visitor's own browser storage is never read or written for it (see storefront/visitorStore.ts), so a visitor
   who has a Dukkan store of their own sees this store only. The language is the visitor's own choice. */

/* An open store: its design is put together in the browser (like the merchant's own preview, app/store), then drawn */
function OpenStore({ store }: { store: PublicStoreOpen }) {
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  useEffect(() => {
    setConfig(visitorDesign(store.design, store.template, store.pages, store.setup.shipping?.mode));
  }, [store]);

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
    <VisitorStoreContext.Provider value={store}>
      <div className="min-h-screen bg-[#eef0f0]">
        {/* Like a real website, the store keeps a comfortable width on a big screen */}
        <div className="mx-auto max-w-[1180px] bg-white shadow-sm">
          <StorefrontTheme config={config} />
        </div>
      </div>
    </VisitorStoreContext.Provider>
  );
}

export function PublicStore({ store }: { store: Store }) {
  const { lang } = usePrefs();
  if (store.status === "unavailable") return <Notice kind="unavailable" lang={lang} />;
  if (store.status === "soon") return <Notice kind="soon" name={store.name} lang={lang} />;
  if (store.status === "paused") {
    return <MaintenancePage lang={lang} name={store.name} logo={safeStoredImage(store.logo)} color={store.color} message={store.message[lang]} />;
  }
  return <OpenStore store={store} />;
}
