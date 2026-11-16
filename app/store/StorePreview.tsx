"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePrefs } from "@/components/Prefs";
import { StorefrontTheme } from "@/components/storefront/StorefrontTheme";
import { defaultConfig, type StorefrontConfig } from "@/components/storefront/config";
import { StoreSkeleton } from "@/components/StoreSkeletons";
import { loadConfig, loadTemplate } from "@/components/storefront/storage";
import { accountName, loadSetup } from "@/components/setup";
import { useCatalog } from "@/components/catalog";
import { composeDesign, findTheme, loadThemeState, previewProducts } from "@/components/themes";
import { safeStoredImage } from "@/components/safe";
import type { StoreProduct } from "@/components/storefront/useStoreData";
import { loadMaintenance } from "@/components/maintenance";
import { MaintenancePage } from "@/components/MaintenancePage";
import { demoActive } from "@/components/demoSandbox";

const banner = {
  en: { title: "Your store is under construction", body: "All you have to do is finish the launch steps today to start your journey with Dukkan.", button: "Finish the launch steps", preview: "Preview" },
  ar: { title: "متجرك حاليًا قيد الإنشاء", body: "كل ما عليك هو إتمام خطوات التدشين اليوم لبدء رحلتك في التجارة مع دكان.", button: "استكمل خطوات التدشين", preview: "معاينة" },
};

/* The merchant's store as visitors see it: his saved design with the products he has added.
   `owner` turns the empty state into a shortcut to add the first product. The browser tab
   shows his store name and his tab icon (favicon).
   `preview` is the owner's own look at the store before it is launched: the same store, with
   a banner on top that is always there and leads back to the launch steps. */
export function StorePreview({ preview = false }: { preview?: boolean }) {
  const { lang } = usePrefs();
  const b = banner[lang];
  const [config, setConfig] = useState<StorefrontConfig>(defaultConfig);
  /* /store?theme=<id> can be a theme made in Diwan: shown once the theme store's list is here */
  const catalog = useCatalog();
  const [demo, setDemo] = useState(false);
  /* /store?theme=mada: a ready theme's own made-up store, with its photos and products, to look at (nothing of his is shown or saved) */
  /* products: the theme's made-up ones; none: his own (a design he saved is shown on his own store) */
  const [showcase, setShowcase] = useState<{ products?: StoreProduct[]; name?: string; color?: string } | null>(null);
  /* His saved design is read in the browser, so show a placeholder until it is ready */
  const [ready, setReady] = useState(false);
  /* the store paused for maintenance (dashboard): visitors get the "back soon" page, with his message */
  const [paused, setPaused] = useState<string | null>(null);

  /* &look=1 (the preview window of the themes pages): the store can only be scrolled, every click and form is stopped */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("look") !== "1") return;
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const events = ["click", "auxclick", "submit", "pointerdown", "mousedown", "touchend", "keydown", "dragstart"] as const;
    events.forEach((n) => window.addEventListener(n, stop, true));
    document.documentElement.style.cursor = "default";
    return () => events.forEach((n) => window.removeEventListener(n, stop, true));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    /* /store?original=1 is the original design exactly as we made it (it never changes);
       /store?starter=1 is the template the admin can edit (the original if there is none). Both use sample products. */
    const original = q.get("original") === "1";
    const starter = q.get("starter") === "1";
    const shown = findTheme(q.get("theme"));
    if (shown) {
      setConfig(shown.build(lang, { samples: true }));
      setShowcase({ products: previewProducts(lang, shown), name: shown.demo?.name[lang] ?? shown.name[lang], color: shown.demo?.color ?? "" });
      setReady(true);
      return;
    }
    /* /store?saved=<id>: a design he saved in My themes, on his own store */
    const saved = loadThemeState().custom.find((c) => c.id === q.get("saved"));
    if (saved) {
      setConfig(composeDesign(loadConfig(), saved.look));
      setShowcase({});
      setReady(true);
      return;
    }
    setConfig(original ? defaultConfig : starter ? loadTemplate() ?? defaultConfig : loadConfig());
    /* /store?demo=1 shows the store with sample products, for screenshots. Nothing is saved. */
    setDemo(original || starter || q.get("demo") === "1");
    /* his own store, not a preview of it: paused, it shows the maintenance page instead */
    const m = loadMaintenance();
    setPaused(!preview && !original && !starter && q.get("demo") !== "1" && !demoActive() && m.on ? m.message[lang] : null);
    setReady(true);
  }, [lang, preview, catalog]);

  useEffect(() => {
    const name = loadSetup()?.name || accountName();
    if (name) document.title = preview ? `${b.preview} | ${name}` : name;
    /* only picture data or the site's own file: never a link to another site or a javascript: address */
    const icon = safeStoredImage(config.identity.favicon);
    if (!icon) return;
    /* Use his icon instead of the platform's while this page is open */
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
  }, [config.identity.favicon, preview, b.preview]);

  if (!ready) return <StoreSkeleton />;

  if (paused !== null) {
    const setup = loadSetup();
    const lg = config.identity.logo;
    /* his own logo picture, or the one from setup; otherwise the first letter on the store color */
    const logo = safeStoredImage(lg.kind === "image" ? lg.image : lg.kind === "auto" ? setup?.logo : "");
    return <MaintenancePage lang={lang} name={setup?.name || accountName()} logo={logo} color={setup?.color || "#004956"} message={paused} owner />;
  }

  return (
    <div className="min-h-screen bg-[#eef0f0]">
      {preview && (
        <div role="status" className="relative isolate overflow-hidden bg-[#00323b] text-white">
          <span aria-hidden className="absolute -end-10 -top-16 -z-10 h-52 w-52 rounded-full bg-white/[0.06]" />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-5 sm:px-8">
            {/* A small drawing of a page behind a barrier */}
            <svg aria-hidden viewBox="0 0 120 80" className="h-16 w-24 shrink-0">
              <rect x="22" y="6" width="76" height="52" rx="6" fill="#ffffff" fillOpacity="0.12" stroke="#96edd9" strokeWidth="2" />
              <rect x="30" y="16" width="34" height="5" rx="2.500" fill="#96edd9" />
              <rect x="30" y="28" width="58" height="4" rx="2" fill="#ffffff" fillOpacity="0.35" />
              <rect x="30" y="38" width="46" height="4" rx="2" fill="#ffffff" fillOpacity="0.35" />
              <rect x="6" y="46" width="62" height="12" rx="3" fill="#e5484d" />
              <path d="M16 46l8 12M30 46l8 12M44 46l8 12M58 46l8 12" stroke="#ffffff" strokeWidth="4" />
              <path d="M16 58v16M58 58v16" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" />
            </svg>
            <div className="min-w-0 flex-1 basis-64">
              <h1 className="text-lg font-extrabold sm:text-xl">{b.title}</h1>
              <p className="mt-1 text-sm text-white/75">{b.body}</p>
            </div>
            <Link href="/onboarding" className="shrink-0 rounded-lg bg-[#5fd9c4] px-6 py-3 text-sm font-bold text-[#00323b] transition hover:bg-[#8be8d6]">
              {b.button}
            </Link>
          </div>
        </div>
      )}
      {/* Like a real website, the store keeps a comfortable width on a big screen */}
      <div className="mx-auto max-w-[1180px] bg-white shadow-sm">
        {showcase ? (
          <StorefrontTheme config={config} products={showcase.products} store={showcase.name ? { name: showcase.name, color: showcase.color } : undefined} />
        ) : (
          <StorefrontTheme config={config} owner={!demo} sample={demo} />
        )}
      </div>
    </div>
  );
}
