"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { PageBody, type MerchantPage } from "./dukkanPages";
import { merchantCall, onServer } from "./merchantApi";
import { usePrefs } from "./Prefs";

/* "From Dukkan": the guides, news and rules Dukkan's team publishes for merchants (made in Diwan's developer portal,
   /diwan/pages), read here in the dashboard. Only for a signed-in account: they come from Dukkan's server. */

const words = {
  en: {
    title: "From Dukkan", sub: "Guides, news and rules from the Dukkan team.", empty: "Nothing from Dukkan yet. New guides and news will show here.",
    signedOut: "Sign in to your account to read Dukkan's pages.", pinned: "Pinned", unread: "New", back: "All pages", missing: "This page is not available.", failed: "Could not load. Check your connection and try again.", retry: "Try again",
  },
  ar: {
    title: "من دكّان", sub: "أدلة وأخبار وقواعد من فريق دكّان.", empty: "لا يوجد شيء من دكّان بعد. ستظهر هنا الأدلة والأخبار الجديدة.",
    signedOut: "سجّل الدخول إلى حسابك لقراءة صفحات دكّان.", pinned: "مثبّتة", unread: "جديد", back: "كل الصفحات", missing: "هذه الصفحة غير متاحة.", failed: "تعذّر التحميل. تحقق من الاتصال وحاول مجددًا.", retry: "حاول مجددًا",
  },
};

type State<T> = { kind: "loading" } | { kind: "out" } | { kind: "failed" } | { kind: "missing" } | { kind: "ok"; data: T };

function useMerchant<T>(path: string, pick: (d: Record<string, any>) => T, again: number): State<T> {
  const [s, setS] = useState<State<T>>({ kind: "loading" });
  useEffect(() => {
    if (!onServer()) return setS({ kind: "out" });
    let live = true;
    setS({ kind: "loading" });
    void merchantCall(path, "GET").then((r) => {
      if (!live) return;
      if (!r) return setS({ kind: "failed" });
      if (r.status === 401) return setS({ kind: "out" });
      if (r.status === 404) return setS({ kind: "missing" });
      if (r.status !== 200) return setS({ kind: "failed" });
      setS({ kind: "ok", data: pick(r.data) });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, again]);
  return s;
}

function Frame({ children }: { children: React.ReactNode }) {
  const { lang } = usePrefs();
  const w = words[lang];
  useEffect(() => {
    document.title = `${brandName(lang)} | ${w.title}`;
  }, [lang, w.title]);
  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="dukkan" subtabs={[w.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[860px] space-y-6 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}

function Note({ text, retry }: { text: string; retry?: () => void }) {
  const { lang } = usePrefs();
  return (
    <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted shadow-sm ring-1 ring-fg/10">
      <p>{text}</p>
      {retry && <button type="button" onClick={retry} className="mt-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-onink">{words[lang].retry}</button>}
    </div>
  );
}

const pick = (p: MerchantPage, lang: "en" | "ar") => ({
  title: lang === "ar" ? p.titleAr || p.titleEn : p.titleEn || p.titleAr,
  summary: lang === "ar" ? p.summaryAr || p.summaryEn : p.summaryEn || p.summaryAr,
  body: lang === "ar" ? p.bodyAr || p.bodyEn || "" : p.bodyEn || p.bodyAr || "",
});

/** The list of Dukkan's pages for this shop */
export function FromDukkanList() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [again, setAgain] = useState(0);
  const s = useMerchant("/api/dukkan-pages", (d) => (Array.isArray(d.pages) ? (d.pages as MerchantPage[]) : []), again);
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }) : "");
  return (
    <Frame>
      <div>
        <h1 className="text-xl font-extrabold">{w.title}</h1>
        <p className="mt-1 text-sm text-muted">{w.sub}</p>
      </div>
      {s.kind === "loading" ? (
        <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card ring-1 ring-fg/10" />)}</div>
      ) : s.kind === "out" ? (
        <Note text={w.signedOut} />
      ) : s.kind === "failed" || s.kind === "missing" ? (
        <Note text={w.failed} retry={() => setAgain((n) => n + 1)} />
      ) : s.data.length === 0 ? (
        <Note text={w.empty} />
      ) : (
        <ul className="space-y-3">
          {s.data.map((p) => {
            const x = pick(p, lang);
            return (
              <li key={p.slug}>
                <Link href={`/from-dukkan/${p.slug}`} className="block rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.inMenu && <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">{w.pinned}</span>}
                    {!p.seen && <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">{w.unread}</span>}
                    <span className="text-xs text-muted">{date(p.publishedAt)}</span>
                  </div>
                  <h2 className="mt-2 text-base font-bold">{x.title}</h2>
                  {x.summary && <p className="mt-1 text-sm text-muted">{x.summary}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}

/** One of Dukkan's pages */
export function FromDukkanPage({ slug }: { slug: string }) {
  const { lang } = usePrefs();
  const w = words[lang];
  const [again, setAgain] = useState(0);
  const s = useMerchant(`/api/dukkan-pages/${encodeURIComponent(slug)}`, (d) => d.page as MerchantPage, again);
  const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }) : "");
  return (
    <Frame>
      <Link href="/from-dukkan" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <span aria-hidden className="rtl:-scale-x-100">←</span>
        {w.back}
      </Link>
      {s.kind === "loading" ? (
        <div className="h-64 animate-pulse rounded-2xl bg-card ring-1 ring-fg/10" aria-busy="true" />
      ) : s.kind === "out" ? (
        <Note text={w.signedOut} />
      ) : s.kind === "missing" ? (
        <Note text={w.missing} />
      ) : s.kind === "failed" ? (
        <Note text={w.failed} retry={() => setAgain((n) => n + 1)} />
      ) : (
        <article className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-fg/10 md:p-8">
          <p className="text-xs text-muted">{date(s.data.publishedAt)}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{pick(s.data, lang).title}</h1>
          {pick(s.data, lang).summary && <p className="mt-2 text-muted">{pick(s.data, lang).summary}</p>}
          <PageBody text={pick(s.data, lang).body} className="mt-6" />
        </article>
      )}
    </Frame>
  );
}
