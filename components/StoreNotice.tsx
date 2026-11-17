"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { brandName } from "./content";
import { usePrefs } from "./Prefs";
import { isStoreAddress } from "./safe";
import { usePageTitle } from "./pageTitle";

/* The short pages shown instead of a store: suspended by Dukkan, not open yet, no store at this address, or no page at
   all (app/not-found.tsx). */

const notices = {
  unavailable: {
    en: { title: "This store is unavailable", body: "This store can't be visited right now. Please try again later." },
    ar: { title: "هذا المتجر غير متاح", body: "لا يمكن زيارة هذا المتجر حاليًا. يرجى المحاولة لاحقًا." },
  },

  soon: {
    en: { title: "This store is under maintenance", body: "We're getting the store ready for you. Please come back soon." },
    ar: { title: "المتجر قيد الصيانة", body: "نجهّز المتجر لك. يرجى العودة قريبًا." },
  },
};

/* A short, polite page in place of a store that can't be shown: suspended by Dukkan, or not open yet */
export function Notice({ kind, name, lang }: { kind: keyof typeof notices; name?: string; lang: "en" | "ar" }) {
  const w = notices[kind][lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-[#f6f5f2] text-brand-ink">
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          {name?.trim() && <p className="text-lg font-extrabold"><bdi>{name}</bdi></p>}
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">{w.title}</h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-brand-ink/70">{w.body}</p>
        </div>
      </main>
      <footer className="pb-8 text-center text-xs text-brand-ink/60">
        <a href="/" className="font-semibold hover:underline">{brandName(lang)}</a>
      </footer>
    </div>
  );
}

const missing = {
  store: {
    en: { title: "This store doesn't exist!", lines: ["Sorry, there is no store at this address.", "Check the link, go back to the home page, or create a great store of your own."] },
    ar: { title: "المتجر غير موجود!", lines: ["عذرًا، لا يوجد متجر على هذا العنوان.", "تأكد من الرابط، أو عد إلى الصفحة الرئيسية، أو أنشئ متجرك الرائع."] },
  },
  page: {
    en: { title: "This page doesn't exist!", lines: ["Sorry, there is nothing at this address.", "Check the link, or go back to the home page."] },
    ar: { title: "الصفحة غير موجودة!", lines: ["عذرًا، لا يوجد شيء على هذا العنوان.", "تأكد من الرابط، أو عد إلى الصفحة الرئيسية."] },
  },
  create: { en: "Create your store now", ar: "أنشئ متجرك الآن" },
  home: { en: "Go to Dukkan's home page", ar: "العودة إلى صفحة دكان الرئيسية" },
  /* a missing page inside a store that exists: back to that store */
  storeHome: { en: "Back to the store", ar: "العودة إلى المتجر" },
  storeHomeNamed: { en: "Back to {name}", ar: "العودة إلى {name}" },
};

/* Dukkan's store mark, looking sad: the shop's roof line and a frown, drawn in the brand colour */
function SadMark() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className="h-20 w-20 shrink-0 text-primary sm:h-24 sm:w-24" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="80" height="80" rx="24" />
      <path d="M8 34h80" strokeWidth="7" />
      <path d="M30 70c5-9 31-9 36 0" />
    </svg>
  );
}

/** An address that leads nowhere: a big 404 and a sad store, then one part (where a store would be) says there is no
    store there, a longer one that the page doesn't exist. In the visitor's language, with a link to Dukkan's main page
    to create a store. */
export function MissingPage() {
  const { lang } = usePrefs();
  const parts = (usePathname() || "/").split("/").filter(Boolean);
  const w = missing[parts.length === 1 ? "store" : "page"][lang];
  /* an address inside a store (/<store>/...) that leads nowhere: when that store exists, a way back to its home page */
  const storeSlug = parts.length > 1 && isStoreAddress(`/${parts[0]}`) ? parts[0].toLowerCase() : "";
  const [store, setStore] = useState<{ slug: string; name: string } | null>(null);
  useEffect(() => {
    if (!storeSlug) return;
    let live = true;
    fetch(`/api/public/store/${encodeURIComponent(storeSlug)}`, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { result?: string; store?: { status?: string; name?: unknown; setup?: { name?: unknown } } } | null) => {
        if (!live || j?.result !== "ok" || !j.store) return;
        /* a suspended store gives no name; an open one its own */
        const raw = j.store.status === "open" ? j.store.setup?.name : j.store.status === "unavailable" ? "" : j.store.name;
        setStore({ slug: storeSlug, name: typeof raw === "string" ? raw.trim().slice(0, 60) : "" });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [storeSlug]);
  const back = store && store.slug === storeSlug ? store : null;
  /* the tab says what happened, in the visitor's language ("Store not found · Dukkan"), not only the site's name */
  usePageTitle(`${w.title.replace(/!$/, "")} · ${brandName(lang)}`);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-page text-fg">
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-xl">
          <div dir="ltr" className={`flex items-center gap-5 ${lang === "ar" ? "justify-end" : "justify-start"}`}>
            <span className="text-7xl font-extrabold leading-none tracking-tight text-primary sm:text-8xl">404</span>
            <SadMark />
          </div>
          <h1 className="mt-10 text-3xl font-extrabold tracking-tight text-fg/80 sm:text-4xl">{w.title}</h1>
          {w.lines.map((l) => <p key={l} className="mt-2 leading-relaxed text-muted first-of-type:mt-5">{l}</p>)}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* inside a store that exists: back to its home page first */}
            {back && (
              <a href={`/${back.slug}`} className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90">
                {back.name ? <>{missing.storeHomeNamed[lang].split("{name}")[0]}<bdi>{back.name}</bdi>{missing.storeHomeNamed[lang].split("{name}")[1]}</> : missing.storeHome[lang]}
              </a>
            )}
            {/* the home page the words speak of: Dukkan's own */}
            <a href="/" className={back ? "inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-fg/80 ring-1 ring-fg/15 transition hover:ring-fg/30" : "inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90"}>
              {missing.home[lang]}
            </a>
            {/* to Dukkan's main page, where anyone can see what Dukkan is and start a store of their own */}
            <a href="/" className="inline-block text-sm font-semibold text-primary hover:underline">{missing.create[lang]}</a>
          </div>
        </div>
      </main>
    </div>
  );
}
