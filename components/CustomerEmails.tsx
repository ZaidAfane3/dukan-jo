"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brandName, dateLocale, type Lang } from "./content";
import { DashboardBar } from "./DashboardBar";
import { load as loadInfoPages } from "./InfoPages";
import { merchantCall, onServer } from "./merchantApi";
import { usePageTitle } from "./pageTitle";
import { usePrefs } from "./Prefs";

/* The emails visitors left on the merchant's live store (server/storeSignups.ts, GET /api/store-signups), in two
   lists: the newsletter block, and "Remind me when it's back" on sold-out products. Newest first, a page at a time;
   each can be deleted, and each list downloaded as one CSV file. Dukkan sends these people nothing: the lists are
   the merchant's to use. Signed out or in the tour there is nothing to read (nothing is saved there). */

type Kind = "newsletter" | "back_in_stock";
type Row = { id: string; email: string; lang: "ar" | "en"; source: "home" | "page" | "product"; pageId: number | null; productId: number | null; product: string; size: string; at: string };

const copy = {
  en: {
    title: "Customer emails",
    sub: "The emails visitors left on your store.",
    noSend: "Nothing is sent to these emails automatically: Dukkan doesn't send emails to your customers yet. The lists are yours to use, for example download them and write to your customers yourself.",
    tabs: { newsletter: "Newsletter", back_in_stock: "Back-in-stock requests" } as Record<Kind, string>,
    tabHint: {
      newsletter: "Emails left in the newsletter block of your store.",
      back_in_stock: "Customers who asked to be told when a sold-out product (or size) is back.",
    } as Record<Kind, string>,
    count: (n: number) => (n === 1 ? "1 email" : `${n} emails`),
    cols: { email: "Email", where: "Signed up on", product: "Product", size: "Size", lang: "Language", date: "Date", actions: "Actions" },
    where: { home: "Home page", page: "Info page", product: "Product page" },
    langs: { ar: "Arabic", en: "English" },
    allSizes: "Whole product",
    export: "Export CSV",
    exporting: "Preparing the file…",
    exportFail: "The file couldn't be made. Check your connection and try again.",
    more: "Load more",
    loading: "Loading…",
    loadFail: "The list couldn't load. Check your connection and try again.",
    retry: "Try again",
    empty: { newsletter: "No newsletter emails yet. They appear here when visitors sign up on your store.", back_in_stock: "No back-in-stock requests yet. When a product or size is sold out, visitors can leave their email on its page." } as Record<Kind, string>,
    tour: "Nothing is saved in the tour. On your own store, the emails visitors leave appear here.",
    del: "Delete",
    delAsk: "Delete this email?",
    keep: "Keep",
    delFail: "It couldn't be deleted. Try again.",
    file: { newsletter: "newsletter-emails.csv", back_in_stock: "back-in-stock-requests.csv" } as Record<Kind, string>,
  },
  ar: {
    title: "إيميلات العملاء",
    sub: "الإيميلات التي تركها الزوّار في متجرك.",
    noSend: "لا يُرسل أي شيء إلى هذه الإيميلات تلقائيًا: دكان لا يرسل رسائل إلى عملائك حاليًا. القوائم لك لتستخدمها، مثلًا نزّلها وراسل عملاءك بنفسك.",
    tabs: { newsletter: "النشرة البريدية", back_in_stock: "طلبات التذكير عند التوفّر" } as Record<Kind, string>,
    tabHint: {
      newsletter: "الإيميلات التي تُركت في قسم النشرة البريدية في متجرك.",
      back_in_stock: "عملاء طلبوا أن يُخبَروا عند توفّر منتج (أو مقاس) نفدت كميته.",
    } as Record<Kind, string>,
    count: (n: number) => (n === 1 ? "إيميل واحد" : n === 2 ? "إيميلان" : n >= 3 && n <= 10 ? `${n} إيميلات` : `${n} إيميل`),
    cols: { email: "الإيميل", where: "مكان الاشتراك", product: "المنتج", size: "المقاس", lang: "اللغة", date: "التاريخ", actions: "الإجراءات" },
    where: { home: "الصفحة الرئيسية", page: "صفحة تعريفية", product: "صفحة منتج" },
    langs: { ar: "العربية", en: "الإنجليزية" },
    allSizes: "المنتج كله",
    export: "تصدير CSV",
    exporting: "جارٍ تجهيز الملف…",
    exportFail: "تعذّر تجهيز الملف. تأكّد من اتصالك وحاول مرة أخرى.",
    more: "عرض المزيد",
    loading: "جارٍ التحميل…",
    loadFail: "تعذّر تحميل القائمة. تأكّد من اتصالك وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    empty: { newsletter: "لا توجد إيميلات في النشرة البريدية بعد. تظهر هنا عندما يشترك الزوّار من متجرك.", back_in_stock: "لا توجد طلبات تذكير بعد. عندما تنفد كمية منتج أو مقاس، يستطيع الزوّار ترك إيميلهم في صفحته." } as Record<Kind, string>,
    tour: "لا يُحفظ شيء في الجولة. في متجرك، تظهر هنا الإيميلات التي يتركها الزوّار.",
    del: "حذف",
    delAsk: "حذف هذا الإيميل؟",
    keep: "إبقاء",
    delFail: "تعذّر الحذف. حاول مرة أخرى.",
    file: { newsletter: "newsletter-emails.csv", back_in_stock: "back-in-stock-requests.csv" } as Record<Kind, string>,
  },
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const KINDS: Kind[] = ["newsletter", "back_in_stock"];

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
  const [pages, setPages] = useState<Map<number, { ar: string; en: string }>>(new Map());
  /* the answer of an older read (another tab chosen meanwhile) is dropped */
  const reading = useRef(0);

  useEffect(() => {
    setLive(onServer());
    try {
      setPages(new Map(loadInfoPages().map((p) => [p.id, p.title])));
    } catch {
      /* no pages to name */
    }
  }, []);

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
    const r = await merchantCall(`/api/store-signups?kind=${kind}&before=${encodeURIComponent(next)}`, "GET");
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

  const whereOf = (x: Row, l: Lang) => {
    if (x.source !== "page") return copy[l].where[x.source];
    const t = x.pageId !== null ? pages.get(x.pageId) : undefined;
    const name = t ? t[l] || t[l === "ar" ? "en" : "ar"] : "";
    return name ? `${copy[l].where.page}: ${name}` : copy[l].where.page;
  };
  const productOf = (x: Row) => x.product || (x.productId !== null ? `#${x.productId}` : "");

  /* the whole list (not only the rows loaded), read again from the server, as one file */
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    setExportFailed(false);
    const r = await merchantCall(`/api/store-signups?kind=${kind}&all=1`, "GET");
    setExporting(false);
    if (!(r?.status === 200 && r.data.result === "ok" && Array.isArray(r.data.signups))) return setExportFailed(true);
    const list = r.data.signups as Row[];
    const head = kind === "newsletter" ? [c.cols.email, c.cols.where, c.cols.lang, c.cols.date] : [c.cols.email, c.cols.product, c.cols.size, c.cols.lang, c.cols.date];
    const lines = [head.map(cell).join(",")];
    for (const x of list) {
      const date = csvDate.format(new Date(x.at));
      const cells = kind === "newsletter" ? [x.email, whereOf(x, lang), c.langs[x.lang], date] : [x.email, productOf(x), x.size || c.allSizes, c.langs[x.lang], date];
      lines.push(cells.map(cell).join(","));
    }
    try {
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = c.file[kind];
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
                {live && !loading && !failed && <p className="mt-1 text-sm font-semibold" aria-live="polite">{c.count(total)}</p>}
              </div>
              {live && (
                <button type="button" onClick={exportCsv} disabled={exporting || loading || total === 0} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50">
                  {exporting ? c.exporting : c.export}
                </button>
              )}
            </div>
            {exportFailed && <p role="alert" className="mt-2 text-sm text-rose-600">{c.exportFail}</p>}

            {live === false ? (
              <p className="mt-5 rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.tour}</p>
            ) : live === null || loading ? (
              <p className="mt-5 py-6 text-center text-sm text-muted" aria-live="polite">{c.loading}</p>
            ) : failed ? (
              <div className="mt-5 py-6 text-center">
                <p role="alert" className="text-sm text-rose-600">{c.loadFail}</p>
                <button type="button" onClick={() => void read(kind)} className="mt-3 h-10 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">{c.retry}</button>
              </div>
            ) : rows.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.empty[kind]}</p>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="bg-soft/60">
                      <tr>
                        <th className={th}>{c.cols.email}</th>
                        {kind === "newsletter" ? (
                          <th className={th}>{c.cols.where}</th>
                        ) : (
                          <>
                            <th className={th}>{c.cols.product}</th>
                            <th className={th}>{c.cols.size}</th>
                          </>
                        )}
                        <th className={th}>{c.cols.lang}</th>
                        <th className={th}>{c.cols.date}</th>
                        <th className={th}><span className="sr-only">{c.cols.actions}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.id} className="border-t border-fg/10">
                          <td className={td}><bdi dir="ltr" className="break-all font-medium">{x.email}</bdi></td>
                          {kind === "newsletter" ? (
                            <td className={td}>{whereOf(x, lang)}</td>
                          ) : (
                            <>
                              <td className={td}>
                                <bdi>{productOf(x)}</bdi>
                              </td>
                              <td className={td}>{x.size ? <bdi>{x.size}</bdi> : <span className="text-muted">{c.allSizes}</span>}</td>
                            </>
                          )}
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
