"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { brandName, dateLocale, type Lang } from "./content";
import { DashboardBar } from "./DashboardBar";
import { merchantCall, onServer } from "./merchantApi";
import { usePageTitle } from "./pageTitle";
import { usePrefs } from "./Prefs";

/* What visitors left on the merchant's live store (server/storeSignups.ts, GET /api/store-signups), in two tabs, as
   numbers only: never an address (owner decisions 2026-11-24: the shoppers' privacy):
   - the newsletter block: how many, how many are new, by language and by where they signed up. He writes to them with a
     campaign (Marketing > Campaigns, components/Campaigns.tsx), which reaches them without showing him who they are;
   - "Remind me when it's back" on sold-out products: how many wait, per product and size, and how many were told so
     far. Once a product is back in stock he presses "Tell them it's back" and Dukkan emails them (POST
     /api/store-signups/back-in-stock); he may also clear a product's waiting list. Neither shows him who they are.
   Signed out or in the tour there is nothing to read (nothing is saved there): the tour shows the same page, empty. */

type Kind = "newsletter" | "back_in_stock";
type Stats = { total: number; thisMonth: number; lastWeek: number; byLang: { ar: number; en: number }; bySource: { home: number; page: number; product: number } };
/* waiting: for a press; sending: in a batch handed to the email service whose answer isn't settled yet (finished on the
   server in a few minutes, never by another press) */
type Group = { productId: number; product: string; size: string; waiting: number; sending: number; notified: number; lastAt: string | null; notifiedAt: string | null; gone: boolean; ready: boolean };
type BackStats = { waiting: number; sending: number; notified: number; products: number; groups: Group[] };
/* what the last press on one row said */
type Said = { tone: "ok" | "bad"; text: string };

const copy = {
  en: {
    title: "Customer emails",
    sub: "What visitors left on your store.",
    noSend: "Nothing is sent to these people automatically. To write to your newsletter subscribers and buyers, create a campaign in Marketing > Campaigns. To tell customers a sold-out product is back, use the Back-in-stock requests tab.",
    tabs: { newsletter: "Newsletter", back_in_stock: "Back-in-stock requests" } as Record<Kind, string>,
    tabHint: {
      newsletter: "People who signed up in the newsletter block of your store.",
      back_in_stock: "Customers who asked to be told when a sold-out product (or size) is back.",
    } as Record<Kind, string>,
    privacy: "To protect your subscribers' privacy, their email addresses aren't shown. You see how many they are, and you reach them with a campaign.",
    backPrivacy: "To protect your customers' privacy, their email addresses aren't shown. When a product is back in stock, press “Tell them it's back” and Dukkan emails each of them once for you, in the language they used.",
    stats: { total: "Subscribers", month: "New this month", week: "New in the last 7 days" },
    backStats: { waiting: "Waiting now", products: "Products waited for", notified: "Told so far" },
    byLang: "By language",
    bySource: "Where they signed up",
    campaign: "Send them a campaign",
    cols: { product: "Product", size: "Size", waiting: "Waiting", sending: "Being sent", notified: "Told so far", last: "Latest request", status: "Now", actions: "Actions" },
    where: { home: "Home page", page: "Info pages", product: "Product pages" },
    langs: { ar: "Arabic", en: "English" },
    allSizes: "Whole product",
    state: { ready: "In stock", sold: "Sold out", gone: "Deleted" },
    notify: "Tell them it's back",
    notifying: "Sending…",
    notifyHint: "Available once the product (or size) is in stock and shown on your store.",
    sendingNow: "We're sending these emails now. It can take a few minutes.",
    sendingAll: (n: number) => `${n === 1 ? "1 email is" : `${n} emails are`} being sent now. It can take a few minutes, and this page updates by itself.`,
    clear: "Clear list",
    clearAsk: (n: number) => `Remove ${n === 1 ? "this 1 request" : `these ${n} requests`}? Nobody is emailed.`,
    keep: "Keep",
    sent: (n: number, left: number) => `Sent to ${n === 1 ? "1 customer" : `${n} customers`}.${left ? ` ${left} still waiting: press again to send to the next ones.` : ""}`,
    stub: "Email isn't set up on this server, so nothing was sent.",
    cleared: "The waiting list was cleared.",
    fail: {
      "sold-out": "It's still sold out (or hidden). Add stock on Products first.",
      closed: "Your store isn't open (not published or paused), so nothing was sent.",
      none: "Nobody is waiting for this any more.",
      "slow-down": "Too many emails for now. Try again later.",
      failed: "The email service didn't take these emails, so nothing was sent. Try again in a few minutes.",
      "no-sender": "Email isn't set up yet, so nothing was sent.",
      suspended: "Your store is suspended, so nothing can be sent.",
      other: "That didn't work. Check your connection and try again.",
    } as Record<string, string>,
    loading: "Loading…",
    loadFail: "This couldn't load. Check your connection and try again.",
    retry: "Try again",
    empty: { newsletter: "No newsletter subscribers yet. They're counted here when visitors sign up on your store.", back_in_stock: "No back-in-stock requests yet. When a product or size is sold out, visitors can leave their email on its page." } as Record<Kind, string>,
    tour: "Nothing is saved in the tour. On your own store, what visitors leave is counted here.",
  },
  ar: {
    title: "إيميلات العملاء",
    sub: "ما تركه الزوّار في متجرك.",
    noSend: "لا يُرسل أي شيء إلى هؤلاء تلقائيًا. لمراسلة المشتركين في نشرتك والمشترين منك، أنشئ حملة من التسويق > حملات تسويقية. ولإخبار العملاء بعودة منتج نفدت كميته، استخدم تبويب طلبات التذكير عند التوفّر.",
    tabs: { newsletter: "النشرة البريدية", back_in_stock: "طلبات التذكير عند التوفّر" } as Record<Kind, string>,
    tabHint: {
      newsletter: "من اشتركوا من قسم النشرة البريدية في متجرك.",
      back_in_stock: "عملاء طلبوا أن يُخبَروا عند توفّر منتج (أو مقاس) نفدت كميته.",
    } as Record<Kind, string>,
    privacy: "حفاظًا على خصوصية المشتركين، لا تظهر عناوين بريدهم. ترى عددهم، وتصل إليهم بحملة تسويقية.",
    backPrivacy: "حفاظًا على خصوصية عملائك، لا تظهر عناوين بريدهم. عندما يتوفّر المنتج من جديد، اضغط «أخبرهم بتوفّره» ويرسل دكان لكل واحد منهم رسالة واحدة نيابةً عنك، باللغة التي استخدمها.",
    stats: { total: "المشتركون", month: "جدد هذا الشهر", week: "جدد في آخر 7 أيام" },
    backStats: { waiting: "بانتظار التوفّر الآن", products: "منتجات ينتظرونها", notified: "أُخبروا حتى الآن" },
    byLang: "حسب اللغة",
    bySource: "مكان الاشتراك",
    campaign: "أرسل لهم حملة",
    cols: { product: "المنتج", size: "المقاس", waiting: "بالانتظار", sending: "قيد الإرسال", notified: "أُخبروا", last: "آخر طلب", status: "الآن", actions: "الإجراءات" },
    where: { home: "الصفحة الرئيسية", page: "الصفحات التعريفية", product: "صفحات المنتجات" },
    langs: { ar: "العربية", en: "الإنجليزية" },
    allSizes: "المنتج كله",
    state: { ready: "متوفّر", sold: "نفدت الكمية", gone: "محذوف" },
    notify: "أخبرهم بتوفّره",
    notifying: "جارٍ الإرسال…",
    notifyHint: "يتاح عندما يتوفّر المنتج (أو المقاس) ويكون ظاهرًا في متجرك.",
    sendingNow: "نرسل هذه الإيميلات الآن. قد يستغرق ذلك بضع دقائق.",
    sendingAll: (n: number) => `${n === 1 ? "إيميل واحد قيد الإرسال" : n === 2 ? "إيميلان قيد الإرسال" : `${n} إيميلات قيد الإرسال`} الآن. قد يستغرق ذلك بضع دقائق، وتتحدّث هذه الصفحة وحدها.`,
    clear: "مسح القائمة",
    clearAsk: (n: number) => `حذف ${n === 1 ? "هذا الطلب" : n === 2 ? "هذين الطلبين" : `هذه الطلبات (${n})`}؟ لن يُرسل أي إيميل.`,
    keep: "إبقاء",
    sent: (n: number, left: number) => `أُرسل إلى ${n === 1 ? "عميل واحد" : n === 2 ? "عميلين" : n >= 3 && n <= 10 ? `${n} عملاء` : `${n} عميلًا`}.${left ? ` ما زال ${left} بالانتظار: اضغط مرة أخرى للإرسال إلى التالين.` : ""}`,
    stub: "البريد غير مُعدّ على هذا الخادم، لذلك لم يُرسل شيء.",
    cleared: "مُسحت قائمة الانتظار.",
    fail: {
      "sold-out": "ما زالت كميته نافدة (أو هو مخفي). أضف كمية من صفحة المنتجات أولًا.",
      closed: "متجرك غير مفتوح (غير منشور أو متوقف مؤقتًا)، لذلك لم يُرسل شيء.",
      none: "لم يعد أحد بانتظار هذا المنتج.",
      "slow-down": "إيميلات كثيرة الآن. حاول لاحقًا.",
      failed: "لم تقبل خدمة البريد هذه الإيميلات، لذلك لم يُرسل شيء. حاول مرة أخرى بعد بضع دقائق.",
      "no-sender": "البريد غير مُعدّ بعد، لذلك لم يُرسل شيء.",
      suspended: "متجرك موقوف، لذلك لا يمكن إرسال شيء.",
      other: "لم ينجح ذلك. تأكّد من اتصالك وحاول مرة أخرى.",
    } as Record<string, string>,
    loading: "جارٍ التحميل…",
    loadFail: "تعذّر التحميل. تأكّد من اتصالك وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    empty: { newsletter: "لا يوجد مشتركون في النشرة البريدية بعد. يُحسبون هنا عندما يشترك الزوّار من متجرك.", back_in_stock: "لا توجد طلبات تذكير بعد. عندما تنفد كمية منتج أو مقاس، يستطيع الزوّار ترك إيميلهم في صفحته." } as Record<Kind, string>,
    tour: "لا يُحفظ شيء في الجولة. في متجرك، يُحسب هنا ما يتركه الزوّار.",
  },
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const KINDS: Kind[] = ["newsletter", "back_in_stock"];
/* the tour, and a store with no subscribers: the same page with zeros */
const NO_STATS: Stats = { total: 0, thisMonth: 0, lastWeek: 0, byLang: { ar: 0, en: 0 }, bySource: { home: 0, page: 0, product: 0 } };
const NO_BACK: BackStats = { waiting: 0, sending: 0, notified: 0, products: 0, groups: [] };

const dateOf = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(dateLocale(lang), { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Amman" }).format(new Date(iso));

/* one row of the back-in-stock list: a product and the size asked for */
const keyOf = (g: Pick<Group, "productId" | "size">) => `${g.productId}|${g.size}`;

export function CustomerEmails() {
  const { lang } = usePrefs();
  const c = copy[lang];
  usePageTitle(`${brandName(lang)} | ${c.title}`);
  const [kind, setKind] = useState<Kind>("newsletter");
  /* null until known: signed in and not in the tour */
  const [live, setLive] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [back, setBack] = useState<BackStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /* the row asked about before clearing, the row being sent or cleared, and what each row's last press said */
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, Said>>({});
  /* the answer of an older read (another tab chosen meanwhile) is dropped */
  const reading = useRef(0);

  useEffect(() => setLive(onServer()), []);

  /* gives the back-in-stock numbers it read (null: none, or an older read) */
  const read = useCallback(async (k: Kind, quiet = false): Promise<BackStats | null> => {
    const n = ++reading.current;
    if (!quiet) {
      setLoading(true);
      setFailed(false);
      setAsking(null);
    }
    const r = await merchantCall(`/api/store-signups?kind=${k}`, "GET");
    if (n !== reading.current) return null;
    setLoading(false);
    const ok = r?.status === 200 && r.data.result === "ok" && r.data.stats;
    if (k === "newsletter") {
      if (ok) setStats(r.data.stats as Stats);
      else if (!quiet) {
        setStats(null);
        setFailed(true);
      }
      return null;
    }
    if (ok && Array.isArray(r.data.stats.groups)) {
      setBack(r.data.stats as BackStats);
      return r.data.stats as BackStats;
    }
    if (!quiet) {
      setBack(null);
      setFailed(true);
    }
    return null;
  }, []);

  useEffect(() => {
    if (live) {
      setSaid({});
      void read(kind);
    }
  }, [live, kind, read]);

  const failText = (r: { status: number; data: Record<string, any> } | null) => c.fail[String(r?.data?.result ?? "")] ?? c.fail.other;

  /* while some emails are being sent, the numbers are read again now and then: the server finishes them by itself */
  const sendingNow = kind === "back_in_stock" && !!live && (back?.sending ?? 0) > 0;
  useEffect(() => {
    if (!sendingNow) return;
    const t = window.setInterval(() => void read("back_in_stock", true), 30_000);
    return () => window.clearInterval(t);
  }, [sendingNow, read]);

  /* "Tell them it's back": Dukkan emails them; the page reads the numbers again after */
  const notify = async (g: Group) => {
    const k = keyOf(g);
    if (busy) return;
    setBusy(k);
    setAsking(null);
    const r = await merchantCall(`/api/store-signups/back-in-stock`, "POST", { product: g.productId, size: g.size });
    setBusy(null);
    const ok = r?.status === 200 && r.data.result === "ok";
    /* "sending": the email service gave no clear answer (or nobody waits but some are being sent): the server finishes
       them in a few minutes, so it is no failure of his and pressing again changes nothing */
    const sending = r?.data?.result === "sending";
    const text = (s: Said) => setSaid((x) => ({ ...x, [k]: s }));
    text(ok ? { tone: "ok", text: r.data.stub ? c.stub : c.sent(Number(r.data.sent) || 0, Number(r.data.left) || 0) } : sending ? { tone: "ok", text: c.sendingNow } : { tone: "bad", text: failText(r) });
    const fresh = await read("back_in_stock", true);
    /* no answer in time (the press may still be going on the server): what the numbers say now, not "your connection" */
    if (!r && (fresh?.groups.find((x) => keyOf(x) === k)?.sending ?? 0) > 0) text({ tone: "ok", text: c.sendingNow });
  };

  const clear = async (g: Group) => {
    const k = keyOf(g);
    if (busy) return;
    setBusy(k);
    const r = await merchantCall(`/api/store-signups/back-in-stock`, "DELETE", { product: g.productId, size: g.size });
    setBusy(null);
    setAsking(null);
    const ok = r?.status === 200 && r.data.result === "ok";
    setSaid((x) => ({ ...x, [k]: ok ? { tone: "ok", text: c.cleared } : { tone: "bad", text: failText(r) } }));
    void read("back_in_stock", true);
  };

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-3.5 text-sm align-middle";
  const num = (n: number) => n.toLocaleString(dateLocale(lang));

  const tiles = (list: [string, number][]) => (
    <dl className="grid gap-3 sm:grid-cols-3">
      {list.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-fg/10 px-4 py-3">
          <dt className="text-xs font-semibold text-muted">{k}</dt>
          <dd className="mt-1 text-2xl font-extrabold tabular-nums">{num(v)}</dd>
        </div>
      ))}
    </dl>
  );

  /* the newsletter: its numbers, and the way to write to them */
  const newsletter = (s: Stats) => (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl bg-soft/70 px-4 py-3 text-sm leading-relaxed">{c.privacy}</p>
      {s.total === 0 && live && <p className="rounded-xl border border-dashed border-fg/20 px-4 py-4 text-center text-sm text-muted">{c.empty.newsletter}</p>}
      {tiles([
        [c.stats.total, s.total],
        [c.stats.month, s.thisMonth],
        [c.stats.week, s.lastWeek],
      ])}
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

  /* what a product (and size) is now, as the server read it */
  const stateOf = (g: Group) => (g.gone ? c.state.gone : g.ready ? c.state.ready : c.state.sold);

  /* back in stock: the numbers, and per product and size how many wait, with the two actions */
  const backInStock = (s: BackStats) => (
    <div className="mt-5 space-y-4">
      <p className="rounded-xl bg-soft/70 px-4 py-3 text-sm leading-relaxed">{c.backPrivacy}</p>
      {tiles([
        [c.backStats.waiting, s.waiting],
        [c.backStats.products, s.products],
        [c.backStats.notified, s.notified],
      ])}
      {s.sending > 0 && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm leading-relaxed text-deep dark:text-primary">{c.sendingAll(s.sending)}</p>}
      {s.groups.length === 0 ? (
        live && <p className="rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.empty.back_in_stock}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-fg/10">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="bg-soft/60">
              <tr>
                <th className={th}>{c.cols.product}</th>
                <th className={th}>{c.cols.size}</th>
                <th className={th}>{c.cols.waiting}</th>
                <th className={th}>{c.cols.sending}</th>
                <th className={th}>{c.cols.notified}</th>
                <th className={th}>{c.cols.last}</th>
                <th className={th}>{c.cols.status}</th>
                <th className={th}><span className="sr-only">{c.cols.actions}</span></th>
              </tr>
            </thead>
            <tbody>
              {s.groups.map((g) => {
                const k = keyOf(g);
                /* "being sent" is dropped once the server finished them (the numbers read again say so) */
                const note = said[k]?.text === c.sendingNow && g.sending === 0 ? undefined : said[k];
                return (
                  <tr key={k} className="border-t border-fg/10">
                    <td className={`${td} font-medium`}><bdi>{g.product || `#${g.productId}`}</bdi></td>
                    <td className={td}>{g.size ? <bdi>{g.size}</bdi> : <span className="text-muted">{c.allSizes}</span>}</td>
                    <td className={`${td} font-semibold tabular-nums`}>{num(g.waiting)}</td>
                    <td className={`${td} tabular-nums ${g.sending ? "font-semibold text-deep dark:text-primary" : "text-muted"}`}>{num(g.sending)}</td>
                    <td className={`${td} tabular-nums text-muted`}>{num(g.notified)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{g.lastAt ? dateOf(g.lastAt, lang) : "—"}</td>
                    <td className={td}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${g.ready ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-fg/5 text-muted"}`}>{stateOf(g)}</span>
                    </td>
                    <td className={`${td} text-end`}>
                      {g.waiting > 0 &&
                        (asking === k ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <span className="text-xs font-semibold">{c.clearAsk(g.waiting)}</span>
                            <button type="button" disabled={busy === k} onClick={() => void clear(g)} className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">{c.clear}</button>
                            <button type="button" disabled={busy === k} onClick={() => setAsking(null)} className="h-9 rounded-lg border border-fg/20 px-3 text-xs font-semibold transition hover:bg-soft">{c.keep}</button>
                          </span>
                        ) : (
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!g.ready || !!busy}
                              title={g.ready ? undefined : c.notifyHint}
                              onClick={() => void notify(g)}
                              className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition enabled:hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy === k ? c.notifying : c.notify}
                            </button>
                            <button type="button" disabled={!!busy} onClick={() => setAsking(k)} className="h-9 rounded-lg px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-600/10 disabled:opacity-50">{c.clear}</button>
                          </span>
                        ))}
                      {/* all of this row's people are in a batch being sent: nothing for a press to do until it settles */}
                      {g.waiting === 0 && g.sending > 0 && (
                        <button type="button" disabled title={c.sendingNow} className="h-9 cursor-not-allowed rounded-lg bg-primary px-3 text-xs font-semibold text-white opacity-50">
                          {c.notify}
                        </button>
                      )}
                      {!g.ready && g.waiting > 0 && !g.gone && <p className="mt-1 text-xs text-muted">{c.notifyHint}</p>}
                      {g.sending > 0 && note?.text !== c.sendingNow && <p className="mt-1 text-xs text-deep dark:text-primary">{c.sendingNow}</p>}
                      {note && <p role={note.tone === "bad" ? "alert" : "status"} className={`mt-1 text-xs ${note.tone === "bad" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-400"}`}>{note.text}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
            <p className="text-sm text-muted">{c.tabHint[kind]}</p>

            {live === false ? (
              <>
                <p className="mt-5 rounded-xl border border-dashed border-fg/20 px-4 py-6 text-center text-sm text-muted">{c.tour}</p>
                {kind === "newsletter" ? newsletter(NO_STATS) : backInStock(NO_BACK)}
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
            ) : (
              backInStock(back ?? NO_BACK)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
