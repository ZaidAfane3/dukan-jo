"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { brandName, dateLocale, type Lang } from "./content";
import { DashboardBar } from "./DashboardBar";
import { merchantCall, onServer } from "./merchantApi";
import { usePageTitle } from "./pageTitle";
import { usePrefs } from "./Prefs";

/* What visitors left on the merchant's live store (server/storeSignups.ts, GET /api/store-signups), in two tabs:
   - the newsletter block: numbers only (how many, how many are new, by language and by where they signed up), never
     the addresses (owner decision 2026-11-24: the subscribers' privacy). He writes to them with a campaign (Marketing >
     Campaigns, components/Campaigns.tsx), which reaches them without showing him who they are;
   - "Remind me when it's back" on sold-out products: the requests themselves, newest first, a page at a time; each can
     be deleted, and the list downloaded as one CSV file, since Dukkan sends these reminders nothing by itself.
   Signed out or in the tour there is nothing to read (nothing is saved there): the tour shows the same page, empty. */

type Kind = "newsletter" | "back_in_stock";
type Row = { id: string; email: string; lang: "ar" | "en"; productId: number | null; product: string; size: string; at: string };
type Stats = { total: number; thisMonth: number; lastWeek: number; byLang: { ar: number; en: number }; bySource: { home: number; page: number; product: number } };

const copy = {
  en: {
    title: "Customer emails",
    sub: "What visitors left on your store.",
    noSend: "Nothing is sent to these people automatically. To write to your newsletter subscribers and buyers, create a campaign in Marketing > Campaigns.",
    tabs: { newsletter: "Newsletter", back_in_stock: "Back-in-stock requests" } as Record<Kind, string>,
    tabHint: {
      newsletter: "People who signed up in the newsletter block of your store.",
      back_in_stock: "Customers who asked to be told when a sold-out product (or size) is back.",
    } as Record<Kind, string>,
    privacy: "To protect your subscribers' privacy, their email addresses aren't shown. You see how many they are, and you reach them with a campaign.",
    stats: { total: "Subscribers", month: "New this month", week: "New in the last 7 days" },
    byLang: "By language",
    bySource: "Where they signed up",
    campaign: "Send them a campaign",
    count: (n: number) => (n === 1 ? "1 email" : `${n} emails`),
    cols: { email: "Email", product: "Product", size: "Size", lang: "Language", date: "Date", actions: "Actions" },
    where: { home: "Home page", page: "Info pages", product: "Product pages" },
    langs: { ar: "Arabic", en: "English" },
    allSizes: "Whole product",
    export: "Export CSV",
    exporting: "Preparing the file…",
    exportFail: "The file couldn't be made. Check your connection and try again.",
    more: "Load more",
    loading: "Loading…",
    loadFail: "This couldn't load. Check your connection and try again.",
    retry: "Try again",
    empty: { newsletter: "No newsletter subscribers yet. They're counted here when visitors sign up on your store.", back_in_stock: "No back-in-stock requests yet. When a product or size is sold out, visitors can leave their email on its page." } as Record<Kind, string>,
    tour: "Nothing is saved in the tour. On your own store, what visitors leave appears here.",
    del: "Delete",
    delAsk: "Delete this email?",
    keep: "Keep",
    delFail: "It couldn't be deleted. Try again.",
    file: "back-in-stock-requests.csv",
  },
  ar: {
    title: "إيميلات العملاء",
    sub: "ما تركه الزوّار في متجرك.",
    noSend: "لا يُرسل أي شيء إلى هؤلاء تلقائيًا. لمراسلة المشتركين في نشرتك والمشترين منك، أنشئ حملة من التسويق > حملات تسويقية.",
    tabs: { newsletter: "النشرة البريدية", back_in_stock: "طلبات التذكير عند التوفّر" } as Record<Kind, string>,
    tabHint: {
      newsletter: "من اشتركوا من قسم النشرة البريدية في متجرك.",
      back_in_stock: "عملاء طلبوا أن يُخبَروا عند توفّر منتج (أو مقاس) نفدت كميته.",
    } as Record<Kind, string>,
    privacy: "حفاظًا على خصوصية المشتركين، لا تظهر عناوين بريدهم. ترى عددهم، وتصل إليهم بحملة تسويقية.",
    stats: { total: "المشتركون", month: "جدد هذا الشهر", week: "جدد في آخر 7 أيام" },
    byLang: "حسب اللغة",
    bySource: "مكان الاشتراك",
    campaign: "أرسل لهم حملة",
    count: (n: number) => (n === 1 ? "إيميل واحد" : n === 2 ? "إيميلان" : n >= 3 && n <= 10 ? `${n} إيميلات` : `${n} إيميل`),
    cols: { email: "الإيميل", product: "المنتج", size: "المقاس", lang: "اللغة", date: "التاريخ", actions: "الإجراءات" },
    where: { home: "الصفحة الرئيسية", page: "الصفحات التعريفية", product: "صفحات المنتجات" },
    langs: { ar: "العربية", en: "الإنجليزية" },
    allSizes: "المنتج كله",
    export: "تصدير CSV",
    exporting: "جارٍ تجهيز الملف…",
    exportFail: "تعذّر تجهيز الملف. تأكّد من اتصالك وحاول مرة أخرى.",
    more: "عرض المزيد",
    loading: "جارٍ التحميل…",
    loadFail: "تعذّر التحميل. تأكّد من اتصالك وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    empty: { newsletter: "لا يوجد مشتركون في النشرة البريدية بعد. يُحسبون هنا عندما يشترك الزوّار من متجرك.", back_in_stock: "لا توجد طلبات تذكير بعد. عندما تنفد كمية منتج أو مقاس، يستطيع الزوّار ترك إيميلهم في صفحته." } as Record<Kind, string>,
    tour: "لا يُحفظ شيء في الجولة. في متجرك، يظهر هنا ما يتركه الزوّار.",
    del: "حذف",
    delAsk: "حذف هذا الإيميل؟",
    keep: "إبقاء",
    delFail: "تعذّر الحذف. حاول مرة أخرى.",
    file: "back-in-stock-requests.csv",
  },
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const KINDS: Kind[] = ["newsletter", "back_in_stock"];
/* the tour, and a store with no subscribers: the same page with zeros */
const NO_STATS: Stats = { total: 0, thisMonth: 0, lastWeek: 0, byLang: { ar: 0, en: 0 }, bySource: { home: 0, page: 0, product: 0 } };

const dateOf = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(dateLocale(lang), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Amman" }).format(new Date(iso));

/* the file's dates: Jordan time, written so a spreadsheet sorts them (2026-11-22 14:05) */
const csvDate = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Amman" });

/* one CSV cell: quoted, and one that starts like a formula (= + - @, tab, return) gets a ' first, so Excel shows it
   instead of running it (the emails are typed by store visitors) */
const cell = (v: string) => `"${v.replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;

export function CustomerEmails() {
  const { lang } = usePrefs();
  const c = copy[lang];
  usePageTitle(`${brandName(lang)} | ${c.title}`);
  const [kind, setKind] = useState<Kind>("newsletter");
  /* null until known: signed in and not in the tour */
  const [live, setLive] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [delFailed, setDelFailed] = useState<string | null>(null);
  /* the answer of an older read (another tab chosen meanwhile) is dropped */
  const reading = useRef(0);

  useEffect(() => setLive(onServer()), []);

  const read = useCallback(async (k: Kind) => {
    const n = ++reading.current;
    setLoading(true);
    setFailed(false);
    setMoreFailed(false);
    setAsking(null);
    setDelFailed(null);
    const r = await merchantCall(`/api/store-signups?kind=${k}`, "GET");
    if (n !== reading.current) return;
    setLoading(false);
    if (k === "newsletter") {
      if (r?.status === 200 && r.data.result === "ok" && r.data.stats) setStats(r.data.stats as Stats);
      else {
        setStats(null);
        setFailed(true);
      }
      return;
    }
    if (r?.status === 200 && r.data.result === "ok" && Array.isArray(r.data.signups)) {
      setRows(r.data.signups as Row[]);
      setNext(typeof r.data.next === "string" ? r.data.next : null);
      setTotal(Number(r.data.total) || 0);
    } else {
      setRows([]);
      setNext(null);
      setTotal(0);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (live) void read(kind);
  }, [live, kind, read]);

  const loadMore = async () => {
    if (!next || moreLoading) return;
    const n = reading.current;
    setMoreLoading(true);
    setMoreFailed(false);
    const r = await merchantCall(`/api/store-signups?kind=back_in_stock&before=${encodeURIComponent(next)}`, "GET");
    if (n !== reading.current) return;
    setMoreLoading(false);
    if (r?.status === 200 && r.data.result === "ok" && Array.isArray(r.data.signups)) {
      const seen = new Set(rows.map((x) => x.id));
      setRows((all) => [...all, ...(r.data.signups as Row[]).filter((x) => !seen.has(x.id))]);
      setNext(typeof r.data.next === "string" ? r.data.next : null);
      setTotal(Number(r.data.total) || 0);
    } else setMoreFailed(true);
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setDelFailed(null);
    const r = await merchantCall(`/api/store-signups/${encodeURIComponent(id)}`, "DELETE");
    setDeleting(null);
    setAsking(null);
    /* already gone (another tab): out of the list too */
    if (r?.status === 200 || r?.status === 404) {
      setRows((all) => all.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } else setDelFailed(id);
  };

  const productOf = (x: Row) => x.product || (x.productId !== null ? `#${x.productId}` : "");

  /* the whole list of back-in-stock requests (not only the rows loaded), read again from the server, as one file */
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    setExportFailed(false);
    const r = await merchantCall(`/api/store-signups?kind=back_in_stock&all=1`, "GET");
    setExporting(false);
    if (!(r?.status === 200 && r.data.result === "ok" && Array.isArray(r.data.signups))) return setExportFailed(true);
    const list = r.data.signups as Row[];
    const lines = [[c.cols.email, c.cols.product, c.cols.size, c.cols.lang, c.cols.date].map(cell).join(",")];
    for (const x of list) lines.push([x.email, productOf(x), x.size || c.allSizes, c.langs[x.lang], csvDate.format(new Date(x.at))].map(cell).join(","));
    try {
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = c.file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportFailed(true);
    }
  };

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-3.5 text-sm align-middle";
  const num = (n: number) => n.toLocaleString(dateLocale(lang));

  /* the newsletter: its numbers, and the way to write to them */
  const newsletter = (s: Stats) => (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl bg-soft/70 px-4 py-3 text-sm leading-relaxed">{c.privacy}</p>
      {s.total === 0 && live && <p className="rounded-xl border border-dashed border-fg/20 px-4 py-4 text-center text-sm text-muted">{c.empty.newsletter}</p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          [c.stats.total, s.total],
          [c.stats.month, s.thisMonth],
          [c.stats.week, s.lastWeek],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border border-fg/10 px-4 py-3">
            <dt className="text-xs font-semibold text-muted">{k}</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums">{num(v as number)}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-fg/10 px-4 py-3">
          <p className="text-xs font-semibold text-muted">{c.byLang}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {(["ar", "en"] as const).map((l) => (
              <li key={l} className="flex justify-between gap-3"><span>{c.langs[l]}</span><span className="font-semibold tabular-nums">{num(s.byLang[l])}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-fg/10 px-4 py-3">
          <p className="text-xs font-semibold text-muted">{c.bySource}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {(["home", "page", "product"] as const).map((w) => (
              <li key={w} className="flex justify-between gap-3"><span>{c.where[w]}</span><span className="font-semibold tabular-nums">{num(s.bySource[w])}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <Link href="/marketing/campaigns" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-deep">
        {c.campaign}
      </Link>
    </div>
  );

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="marketing" subtabs={[c.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <section className={card}>
          <h1 className="text-lg font-extrabold">{c.title}</h1>
          <p className="mt-1 text-sm text-muted">{c.sub}</p>
          <p className="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-sm leading-relaxed text-deep dark:text-primary">{c.noSend}</p>
        </section>

        <section className={card}>
          <div role="tablist" aria-label={c.title} className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${kind === k ? "bg-ink text-onink" : "border border-fg/15 hover:bg-soft"}`}
              >
                {c.tabs[k]}
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={c.tabs[kind]} className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{c.tabHint[kind]}</p>
                {kind === "back_in_stock" && live && !loading && !failed && <p className="mt-1 text-sm font-semibold" aria-live="polite">{c.count(total)}</p>}
              </div>
              {kind === "back_in_stock" && live && (
                <button type="button" onClick={exportCsv} disabled={exporting || loading || total === 0} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50">
                  {exporting ? c.exporting : c.export}
                </button>
              )}
            </div>
            {exportFailed && kind === "back_in_stock" && <p role="alert" className="mt-2 text-sm text-rose-600">{c.exportFail}</p>}

            {live === false ? (
              <>
                <p className="mt-5 rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.tour}</p>
                {kind === "newsletter" && newsletter(NO_STATS)}
              </>
            ) : live === null || loading ? (
              <p className="mt-5 py-6 text-center text-sm text-muted" aria-live="polite">{c.loading}</p>
            ) : failed ? (
              <div className="mt-5 py-6 text-center">
                <p role="alert" className="text-sm text-rose-600">{c.loadFail}</p>
                <button type="button" onClick={() => void read(kind)} className="mt-3 h-10 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">{c.retry}</button>
              </div>
            ) : kind === "newsletter" ? (
              newsletter(stats ?? NO_STATS)
            ) : rows.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.empty.back_in_stock}</p>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-soft/60">
                      <tr>
                        <th className={th}>{c.cols.email}</th>
                        <th className={th}>{c.cols.product}</th>
                        <th className={th}>{c.cols.size}</th>
                        <th className={th}>{c.cols.lang}</th>
                        <th className={th}>{c.cols.date}</th>
                        <th className={th}><span className="sr-only">{c.cols.actions}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.id} className="border-t border-fg/10">
                          <td className={td}><bdi dir="ltr" className="break-all font-medium">{x.email}</bdi></td>
                          <td className={td}>
                            <bdi>{productOf(x)}</bdi>
                          </td>
                          <td className={td}>{x.size ? <bdi>{x.size}</bdi> : <span className="text-muted">{c.allSizes}</span>}</td>
                          <td className={td}>{c.langs[x.lang]}</td>
                          <td className={`${td} whitespace-nowrap text-muted`}>{dateOf(x.at, lang)}</td>
                          <td className={`${td} text-end`}>
                            {asking === x.id ? (
                              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                                <span className="text-xs font-semibold">{c.delAsk}</span>
                                <button type="button" disabled={deleting === x.id} onClick={() => void remove(x.id)} className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">{c.del}</button>
                                <button type="button" disabled={deleting === x.id} onClick={() => setAsking(null)} className="h-9 rounded-lg border border-fg/20 px-3 text-xs font-semibold transition hover:bg-soft">{c.keep}</button>
                              </span>
                            ) : (
                              <button type="button" onClick={() => { setAsking(x.id); setDelFailed(null); }} aria-label={`${c.del}: ${x.email}`} className="h-9 rounded-lg px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-600/10">{c.del}</button>
                            )}
                            {delFailed === x.id && <p role="alert" className="mt-1 text-xs text-rose-600">{c.delFail}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {next && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button type="button" onClick={() => void loadMore()} disabled={moreLoading} className="h-10 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:opacity-60">
                      {moreLoading ? c.loading : c.more}
                    </button>
                    {moreFailed && <p role="alert" className="text-xs text-rose-600">{c.loadFail}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
