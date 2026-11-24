"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { brandName } from "./content";
import { usePrefs } from "./Prefs";
import { isStoreAddress } from "./safe";
import { usePageTitle } from "./pageTitle";
import { STORE_PREFIX } from "./siteAddress";

/* The short pages shown instead of a store: suspended by Dukkan, not open yet, no store at this address, or no page at
   all (app/not-found.tsx). */

const notices = {
  unavailable: {
    en: { title: "This store is unavailable", body: "This store can't be visited right now. Please try again later." },
    ar: { title: "هذا المتجر غير متاح", body: "لا يمكن زيارة هذا المتجر حاليًا. يرجى المحاولة لاحقًا." },
  },

  /* a store never published yet: it is on its way, not broken ("under maintenance" said the wrong thing) */
  soon: {
    en: { title: "This store is coming soon", body: "We're getting the store ready for you. Please come back soon." },
    ar: { title: "المتجر قادم قريبًا", body: "نجهّز المتجر لك. يرجى العودة قريبًا." },
  },
};

/* A short, polite page in place of a store that can't be shown: suspended by Dukkan, or not open yet */
export function Notice({ kind, name, lang }: { kind: keyof typeof notices; name?: string; lang: "en" | "ar" }) {
  const w = notices[kind][lang];
  /* the tab says what happened in the visitor's language ("This store is unavailable · Dukkan"), like the missing and
     moved pages; a store not open yet keeps its own name there */
  usePageTitle(name?.trim() || `${w.title} · ${brandName(lang)}`);
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
    en: { title: "This store doesn't exist!", lines: ["Sorry, there is no store at this address.", "Check the link, or open a store of your own."] },
    ar: { title: "المتجر غير موجود!", lines: ["عذرًا، لا يوجد متجر على هذا العنوان.", "تأكد من الرابط، أو افتح متجرك الخاص."] },
  },
  page: {
    en: { title: "This page doesn't exist!", lines: ["Sorry, there is nothing at this address.", "Check the link, or go back to the home page."] },
    ar: { title: "الصفحة غير موجودة!", lines: ["عذرًا، لا يوجد شيء على هذا العنوان.", "تأكد من الرابط، أو عد إلى الصفحة الرئيسية."] },
  },
  home: { en: "Go to Dukkan's home page", ar: "العودة إلى صفحة دكان الرئيسية" },
  register: { en: "Register your store now", ar: "سجل متجرك الآن" },
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
    store there, a longer one that the page doesn't exist. In the visitor's language. No store at the address: only a
    clickable line «سجل متجرك الآن» / "Register your store now" (to sign-up), no buttons. Any other missing page: one
    button to Dukkan's main page.
    The words depend on the address, which is read in the browser once the page is there: the not-found page is drawn
    ahead of time (app/not-found.tsx, for every address at once), so an address read while drawing would be another one
    than in the browser, and the page then failed to take over its own HTML (React error 418). `kind`: known ahead
    (app/[slug] knows a store link with no store), so the words are right from the start. */
export function MissingPage({ kind }: { kind?: "store" | "page" } = {}) {
  const { lang } = usePrefs();
  const [path, setPath] = useState<string | null>(null);
  /* before the first paint after the page takes over, so the other words never show */
  useLayoutEffect(() => setPath(window.location.pathname), []);
  const parts = (path ?? "/").split("/").filter(Boolean);
  const which = kind ?? (path === null ? "page" : parts.length === 1 ? "store" : "page");
  const w = missing[which][lang];
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
            {which === "store" && !back ? (
              /* no store at this address: one clickable line to start a store, not a button */
              <a href="/signup" className="text-base font-bold text-primary underline underline-offset-4 transition hover:opacity-80">{missing.register[lang]}</a>
            ) : (
              /* the home page the words speak of: Dukkan's own */
              <a href="/" className={back ? "inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-fg/80 ring-1 ring-fg/15 transition hover:ring-fg/30" : "inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90"}>
                {missing.home[lang]}
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const moved = {
  en: { title: "This store has moved", line: "It has a new address now. Update your saved link or QR code.", go: "Go to the store", goNamed: "Go to {name}", home: "Go to Dukkan's home page" },
  ar: { title: "انتقل هذا المتجر", line: "أصبح له عنوان جديد. حدّث الرابط أو رمز QR المحفوظ لديك.", go: "الذهاب إلى المتجر", goNamed: "الذهاب إلى {name}", home: "العودة إلى صفحة دكان الرئيسية" },
};

/** An old store link a store gave up less than two days ago (server/slugHolds.ts): says the store moved, with its new
    address and a button to it, in the visitor's language */
export function MovedPage({ to, name }: { to: string; name: string }) {
  const { lang } = usePrefs();
  const w = moved[lang];
  usePageTitle(`${w.title} · ${brandName(lang)}`);
  const goNamed = w.goNamed.split("{name}");
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-page text-fg">
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-fg/80 sm:text-4xl">{w.title}</h1>
          <p className="mt-5 leading-relaxed text-muted">{w.line}</p>
          <p dir="ltr" className={`mt-3 break-all text-lg font-bold ${lang === "ar" ? "text-end" : ""}`}>
            <a href={`/${to}`} className="hover:text-primary hover:underline">{`${STORE_PREFIX}${to}`}</a>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href={`/${to}`} className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90">
              {name ? <>{goNamed[0]}<bdi>{name}</bdi>{goNamed[1]}</> : w.go}
            </a>
            <a href="/" className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-fg/80 ring-1 ring-fg/15 transition hover:ring-fg/30">{w.home}</a>
          </div>
        </div>
      </main>
    </div>
  );
}
