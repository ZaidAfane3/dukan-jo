"use client";

import { demoActive } from "./demoSandbox";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { pushNotification } from "./notifications";
import { usePrefs } from "./Prefs";
import { cleanOrder, parseList } from "./records";
import { initialOf } from "./safe";
import { AnimatedNumber, Money, mulberry32, pctDecimals } from "./reportBits";
import { usePageTitle } from "./pageTitle";
import { merchantMoney } from "./moneyText";
import { merchantCall, onServer } from "./merchantApi";
import { noPhotoHue, ProductPhoto } from "./storefront/NoPhoto";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const RANGE_SCALE = [1, 3.6, 2.4];

type Row = {
  id: number;
  name: string;
  createdDays: number;
  items: number;
  total: number;
  updatedDays: number;
  sent: boolean;
  color: string;
  /* a real cart of the merchant's store (the sample carts of the tour have none) */
  cart?: Cart;
};

const SWATCHES = ["#ffaa63", "#ffb270", "#e67726", "#d9c9b5", "#c4621c", "#ffe3c4", "#e0806e", "#5b8dd6"];

/* A real cart customers left on the merchant's live store (server/storeCarts.ts CartRow, GET /api/abandoned-carts) */
type Cart = {
  id: string;
  /* the name the customer typed, or "" */
  name: string;
  /* his email, else his mobile */
  contact: string;
  channel: "email" | "phone";
  items: number;
  products: string[];
  image: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  reminders: number;
  remindedAt: string | null;
  nextAt: string | null;
  canRemind: boolean;
  recovered: boolean;
  order: number | null;
};

/* the words of the real carts (the sample carts of the tour keep content.ts marketing) */
const words = {
  en: {
    about: "A cart shows here when a customer typed an email or mobile at checkout and left without ordering for an hour. Reminders go by email: one a day, at most 3 per cart. WhatsApp reminders are coming soon.",
    loading: "Loading carts…",
    loadFail: "The carts couldn't load. Check your connection and try again.",
    retry: "Try again",
    minAgo: "{n} min ago",
    hoursAgo: "{n} h ago",
    recovered: "Recovered: order #{n}",
    sending: "Sending…",
    again: "Send another reminder",
    whatsapp: "WhatsApp: coming soon",
    whatsappTip: "This customer left only a mobile number. Reminders by WhatsApp are coming soon.",
    maxed: "3 reminders sent",
    maxedTip: "A cart gets at most 3 reminders.",
    waitMin: "Again in {n} min",
    waitHours: "Again in {n} h",
    waitTip: "One reminder a day per cart, once the customer has left it for an hour.",
    done: "Reminder emailed to {name}.",
    stub: "Email isn't set up on this server: the reminder was written to the server's console instead, nothing was sent.",
    why: {
      "no-sender": "Email isn't set up yet, so the reminder couldn't be sent.",
      failed: "The email couldn't be sent. Try again later.",
      wait: "This cart was reminded less than a day ago.",
      max: "This cart already got 3 reminders, the most.",
      recovered: "This customer already placed the order.",
      active: "The customer is still shopping. Try again in an hour.",
      closed: "Your store isn't open now, so the link in the email wouldn't work.",
      "no-email": "This customer left only a mobile number.",
      "slow-down": "Too many reminders for now. Try again tomorrow.",
      suspended: "Your store is suspended, so nothing can be sent.",
      none: "This cart is no longer there.",
      offline: "Couldn't reach the server. Check your connection and try again.",
    } as Record<string, string>,
  },
  ar: {
    about: "تظهر السلة هنا عندما يكتب العميل بريده الإلكتروني أو رقم جواله عند الطلب ثم يغادر دون إتمامه لمدة ساعة. يُرسل التذكير بالبريد الإلكتروني: تذكير واحد في اليوم، و3 تذكيرات كحد أقصى لكل سلة. التذكير عبر واتساب قريبًا.",
    loading: "جارٍ تحميل السلات…",
    loadFail: "تعذّر تحميل السلات. تحقّق من اتصالك وحاول مجددًا.",
    retry: "حاول مجددًا",
    minAgo: "منذ {n} دقيقة",
    hoursAgo: "منذ {n} ساعة",
    recovered: "استُردت: الطلب رقم {n}",
    sending: "جارٍ الإرسال…",
    again: "إرسال تذكير آخر",
    whatsapp: "واتساب: قريبًا",
    whatsappTip: "ترك هذا العميل رقم جواله فقط. التذكير عبر واتساب قريبًا.",
    maxed: "أُرسلت 3 تذكيرات",
    maxedTip: "تحصل السلة على 3 تذكيرات كحد أقصى.",
    waitMin: "مجددًا بعد {n} دقيقة",
    waitHours: "مجددًا بعد {n} ساعة",
    waitTip: "تذكير واحد في اليوم لكل سلة، بعد أن يتركها العميل ساعة.",
    done: "أُرسل التذكير إلى {name} بالبريد الإلكتروني.",
    stub: "البريد غير مفعّل على هذا الخادم: كُتب التذكير في سجل الخادم بدلًا من إرساله، ولم يُرسل شيء.",
    why: {
      "no-sender": "لم يُفعّل إرسال البريد بعد، فلم يُرسل التذكير.",
      failed: "تعذّر إرسال البريد. حاول لاحقًا.",
      wait: "أُرسل تذكير لهذه السلة قبل أقل من يوم.",
      max: "وصلت هذه السلة 3 تذكيرات، وهو الحد الأقصى.",
      recovered: "أكمل هذا العميل طلبه بالفعل.",
      active: "ما زال العميل يتسوّق. حاول بعد ساعة.",
      closed: "متجرك غير مفتوح الآن، فلن يعمل الرابط في الرسالة.",
      "no-email": "ترك هذا العميل رقم جواله فقط.",
      "slow-down": "أرسلت تذكيرات كثيرة الآن. حاول غدًا.",
      suspended: "متجرك موقوف، فلا يمكن إرسال شيء.",
      none: "لم تعد هذه السلة موجودة.",
      offline: "تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مجددًا.",
    } as Record<string, string>,
  },
};

export function AbandonedCarts() {
  const { lang } = usePrefs();
  const m = content[lang].marketing;
  const r = content[lang].reports;
  const cur = r.currency;
  const t = words[lang];

  const [sample, setSample] = useState(false);
  /* In the platform tour the carts are already there, so there is no switch */
  const [tour, setTour] = useState(false);
  /* In the tour the carts belong to the same customers as the orders */
  const [tourNames, setTourNames] = useState<string[]>([]);
  const [range, setRange] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(0);
  const [visible, setVisible] = useState([true, true, true, true, true, true]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [reminded, setReminded] = useState<Record<number, number>>({});
  const [toast, setToast] = useState("");
  /* a signed-in merchant's store (not the tour): its real carts, from Dukkan's server (null: not read yet, or failed) */
  const [live, setLive] = useState(false);
  const [carts, setCarts] = useState<Cart[] | null>(null);
  const [stats, setStats] = useState({ count: 0, recovered: 0, average: 0 });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /* the cart whose reminder is on its way */
  const [sending, setSending] = useState<string | null>(null);
  const reading = useRef(0);

  usePageTitle(`${brandName(lang)} | ${m.menu[0]}`);

  useEffect(() => {
    if (demoActive()) {
      setSample(true);
      setTour(true);
      try {
        const orders = parseList(localStorage.getItem("seen-orders"), cleanOrder);
        setTourNames(orders.map((o) => o.customer).slice(0, 9));
      } catch {
        /* the sample names stay */
      }
    } else setLive(onServer());
  }, []);

  /* the store's real carts for the range picked */
  const read = useCallback(async (rg: number) => {
    const n = ++reading.current;
    setLoading(true);
    setFailed(false);
    const res = await merchantCall(`/api/abandoned-carts?range=${rg}`, "GET");
    if (n !== reading.current) return;
    setLoading(false);
    if (res?.status === 200 && res.data.result === "ok" && Array.isArray(res.data.carts)) {
      setCarts(res.data.carts as Cart[]);
      setStats({ count: Number(res.data.count) || 0, recovered: Number(res.data.recovered) || 0, average: Number(res.data.average) || 0 });
    } else {
      setCarts(null);
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (live) void read(range);
  }, [live, range, read]);

  /* A fixed set of sample carts (empty for a store with no abandoned carts). */
  const rows: Row[] = useMemo(() => {
    if (!sample) return [];
    const rnd = mulberry32(range * 91 + 7);
    const names = tourNames.length ? m.names.map((n, i) => tourNames[i] ?? n) : m.names;
    return names.map((name, i) => ({
      id: i,
      name,
      createdDays: Math.round((3 + rnd() * 40) * RANGE_SCALE[range]),
      items: 1 + Math.floor(rnd() * 4),
      total: Math.round((12 + rnd() * 170) * 100) / 100,
      updatedDays: Math.round((1 + rnd() * 25) * RANGE_SCALE[range]),
      sent: rnd() < 0.35,
      color: SWATCHES[Math.floor(rnd() * SWATCHES.length)],
    }));
  }, [sample, range, m.names, tourNames]);

  /* the real carts in the shape of the table's rows (the rest is in `cart`) */
  const realRows: Row[] = useMemo(
    () => (carts ?? []).map((c, i) => ({ id: i, name: c.name || c.contact, createdDays: 0, items: c.items, total: c.total, updatedDays: 0, sent: c.reminders > 0, color: "", cart: c })),
    [carts],
  );
  const allRows = sample ? rows : realRows;

  /* how long ago a real cart last changed: minutes, then hours, then days */
  const agoOf = (iso: string) => {
    const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 60) return t.minAgo.replace("{n}", String(Math.max(1, min)));
    if (min < 24 * 60) return t.hoursAgo.replace("{n}", String(Math.floor(min / 60)));
    return m.ago.replace("{n}", String(Math.floor(min / (24 * 60))));
  };

  /* A cart can be reminded again and again: this counts every reminder sent, including the one already sent before */
  const timesSent = (row: Row) => (row.cart ? row.cart.reminders : (row.sent ? 1 : 0) + (reminded[row.id] ?? 0));
  const isSent = (row: Row) => timesSent(row) > 0;

  const shown = allRows.filter((row) => {
    if (status === 1 && !isSent(row)) return false;
    if (status === 2 && isSent(row)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    /* a real cart is found by its customer's name, email or mobile, or one of its products */
    const texts = row.cart ? [row.name, row.cart.contact, ...row.cart.products] : [row.name];
    return texts.some((x) => x.toLowerCase().includes(q));
  });

  const count = sample ? rows.length : stats.count;
  const recovered = sample ? (count ? Math.round((rows.filter((x) => x.sent).length / count) * 1000) / 10 : 0) : stats.recovered;
  const average = sample ? (count ? rows.reduce((a, b) => a + b.total, 0) / count : 0) : stats.average;

  const say = (text: string, ms = 2600) => {
    setToast(text);
    window.setTimeout(() => setToast((x) => (x === text ? "" : x)), ms);
  };

  /* The platform tour acts a reminder out on its sample carts (nothing is sent). A real cart is reminded by email through
     Dukkan's server, which holds every limit (server/storeCarts.ts); the bell says so only when an email really went
     out. WhatsApp is not built: a cart with only a mobile shows it as coming soon. */
  const remind = async (row: Row) => {
    const c = row.cart;
    if (!c) {
      if (!tour) return;
      pushNotification("reminderSent", { name: row.name });
      setReminded((s) => ({ ...s, [row.id]: (s[row.id] ?? 0) + 1 }));
      return say(m.notice);
    }
    if (!c.canRemind || sending) return;
    setSending(c.id);
    const res = await merchantCall(`/api/abandoned-carts/${encodeURIComponent(c.id)}/remind`, "POST");
    setSending(null);
    if (res?.status === 200 && res.data.result === "ok") {
      /* in development without email the server only writes the email to its console: no bell, it was not sent */
      const stub = res.data.stub === true;
      const next = typeof res.data.nextAt === "string" ? res.data.nextAt : null;
      setCarts((all) => (all ?? []).map((x) => (x.id === c.id ? { ...x, reminders: Number(res.data.reminders) || x.reminders + 1, remindedAt: new Date().toISOString(), canRemind: false, nextAt: next } : x)));
      if (!stub) pushNotification("reminderSent", { name: row.name });
      return say(stub ? t.stub : t.done.replace("{name}", row.name), stub ? 6000 : 2600);
    }
    const why = res ? String(res.data.result ?? "") : "offline";
    say(t.why[why] ?? t.why.offline, 4000);
    /* the cart changed since the list was read (an order, a reminder from another tab): the list is read again */
    if (["recovered", "max", "wait", "active", "none", "no-email"].includes(why)) void read(range);
  };

  /* what a real cart's button says, and why it can't be pressed now */
  const actionOf = (c: Cart): { label: string; tip?: string; can: boolean } => {
    if (sending === c.id) return { label: t.sending, can: false };
    if (c.channel === "phone") return { label: t.whatsapp, tip: t.whatsappTip, can: false };
    if (c.reminders >= 3) return { label: t.maxed, tip: t.maxedTip, can: false };
    if (c.canRemind) return { label: c.reminders ? t.again : m.remind, can: true };
    const min = c.nextAt ? Math.max(1, Math.ceil((new Date(c.nextAt).getTime() - Date.now()) / 60_000)) : 1;
    return { label: min < 60 ? t.waitMin.replace("{n}", String(min)) : t.waitHours.replace("{n}", String(Math.ceil(min / 60))), tip: t.waitTip, can: false };
  };
  const statusOf = (row: Row) => (row.cart?.recovered ? t.recovered.replace("{n}", String(row.cart.order ?? "")) : isSent(row) ? m.sent : m.notSent);

  /* Download exactly what the table currently shows, as a spreadsheet file. */
  const exportCsv = () => {
    const cols = m.cols.filter((_, i) => i < 5 && visible[i]);
    const lines = [cols.join(",")];
    for (const row of shown) {
      const c = row.cart;
      const who = c ? (c.name ? `${c.name} (${c.contact})` : c.contact) : row.name;
      const all = [who, String(row.items), merchantMoney(row.total).replace(/,/g, ""), c ? agoOf(c.updatedAt) : String(row.updatedDays), statusOf(row)];
      /* a cell that starts like a formula (= + - @, tab, return) gets a ' first, so Excel shows it instead of running it:
         the name is typed by store visitors */
      lines.push(all.filter((_, i) => visible[i]).map((v) => `"${v.replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "abandoned-carts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="marketing" subtabs={m.tabs} subHrefs={["/marketing/abandoned-carts", "/marketing/reminders"]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        {/* Summary */}
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-extrabold">{m.title}</h1>
              <p className="mt-1 text-sm text-muted">{m.sub}</p>
              {!tour && <p className="mt-2 max-w-3xl rounded-lg bg-soft px-2.5 py-1.5 text-xs font-semibold leading-relaxed text-muted">{t.about}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{m.viewFull}<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></a>
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                aria-label={r.ranges[range]}
                className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary"
              >
                {r.ranges.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { title: m.cards[0], node: <AnimatedNumber value={count} />, ico: <path d="M3 4h2l2.4 11h11l2-8H6.2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01" /> },
              { title: m.cards[1], node: <span dir="ltr"><AnimatedNumber value={recovered} decimals={pctDecimals(recovered)} />%</span>, ico: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /> },
              { title: m.cards[2], node: <Money value={average} currency={cur} />, glyph: cur },
            ].map((c) => (
              <div key={c.title} className="flex items-center gap-4 rounded-xl border border-fg/10 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-primary">
                  {"glyph" in c ? <span className="text-xs font-bold leading-none">{c.glyph}</span> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{c.ico}</svg>}
                </span>
                <div>
                  <p className="text-sm font-semibold text-muted">{c.title}</p>
                  <p className="text-2xl font-bold">{c.node}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Table */}
        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.search}
              aria-label={m.search}
              className="h-11 min-w-[14rem] flex-1 rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <select value={status} onChange={(e) => setStatus(Number(e.target.value))} aria-label={m.cols[4]} className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary">
              {m.status.map((s, i) => (
                <option key={s} value={i}>{s}</option>
              ))}
            </select>
            <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50">
              {m.export}
            </button>
            <div className="relative">
              <button type="button" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((o) => !o)} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">
                {m.columns}
              </button>
              {columnsOpen && (
                <div className="absolute end-0 top-full z-20 mt-2 w-56 rounded-xl border border-fg/10 bg-card p-3 shadow-2xl">
                  {m.cols.slice(0, 5).map((col, i) => (
                    <label key={col} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${i === 0 ? "opacity-60" : "cursor-pointer hover:bg-soft"}`}>
                      <input
                        type="checkbox"
                        checked={visible[i]}
                        disabled={i === 0}
                        onChange={() => setVisible((v) => v.map((x, k) => (k === i ? !x : x)))}
                        className="h-4 w-4 accent-[rgb(var(--primary))]"
                      />
                      {col}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>


          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>
                  {m.cols.map((col, i) => (i === 5 || visible[i]) && <th key={col} className={th}>{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {shown.map((row) => {
                  const sent = isSent(row);
                  const times = timesSent(row);
                  const c = row.cart;
                  const act = c ? actionOf(c) : null;
                  return (
                    <tr key={c ? c.id : row.id} className="transition-colors hover:bg-soft/40">
                      {visible[0] && (
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">{initialOf(row.name)}</span>
                            <div className="min-w-0">
                              {/* (a cart with no name shows its email or mobile, written left to right) */}
                              <p dir={c && !c.name ? "ltr" : undefined} className={`font-semibold ${c && !c.name ? "rtl:text-right" : ""}`}>{row.name}</p>
                              {/* a real cart: how to reach the customer (his email, else his mobile) under the name he typed */}
                              {c ? (
                                c.name && <p dir="ltr" className="truncate text-xs text-muted rtl:text-right">{c.contact}</p>
                              ) : (
                                <p className="text-xs text-muted">{m.created.replace("{n}", String(row.createdDays))}</p>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      {visible[1] && (
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            {c ? (
                              <ProductPhoto src={c.image} hue={noPhotoHue(c.id)} className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-black/10" />
                            ) : (
                              <span className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: row.color }} />
                            )}
                            <span className="text-muted" title={c ? c.products.join(lang === "ar" ? "، " : ", ") : undefined}>{lang === "en" && row.items === 1 ? "1 item" : m.items.replace("{n}", String(row.items))}</span>
                          </div>
                        </td>
                      )}
                      {visible[2] && <td className={`${td} font-semibold`}><span dir="ltr">{merchantMoney(row.total)} {cur}</span></td>}
                      {visible[3] && <td className={`${td} text-muted`}>{c ? agoOf(c.updatedAt) : m.ago.replace("{n}", String(row.updatedDays))}</td>}
                      {visible[4] && (
                        <td className={td}>
                          {c?.recovered ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {statusOf(row)}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${sent ? "bg-primary/15 text-deep dark:text-primary" : "bg-fg/10 text-muted"}`}>
                              <span className={`h-2 w-2 rounded-full ${sent ? "bg-primary" : "bg-fg/40"}`} />
                              {sent ? m.sent : m.notSent}
                              {times > 1 && <span dir="ltr" className="font-extrabold">×{times}</span>}
                            </span>
                          )}
                        </td>
                      )}
                      <td className={td}>
                        {c?.recovered ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void remind(row)}
                            disabled={c ? !act?.can : !tour}
                            title={c ? act?.tip : !tour ? (lang === "ar" ? "إرسال التذكير قريبًا" : "Sending reminders is coming soon") : undefined}
                            className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-fg/15 disabled:text-muted disabled:hover:bg-transparent"
                          >
                            {c ? act?.label : !tour ? (lang === "ar" ? "قريبًا" : "Coming soon") : sent ? t.again : m.remind}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!sample && loading && carts === null ? (
              <p className="px-4 py-14 text-center text-sm text-muted" aria-live="polite">{t.loading}</p>
            ) : !sample && failed ? (
              <div className="px-4 py-14 text-center">
                <p className="text-sm text-muted">{t.loadFail}</p>
                <button type="button" onClick={() => void read(range)} className="mt-3 rounded-lg border border-fg/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-soft">{t.retry}</button>
              </div>
            ) : allRows.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <p className="font-bold">{m.empty}</p>
                <p className="mt-1 text-sm text-muted">{m.emptyHint}</p>
              </div>
            ) : (
              shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{m.noMatch}</p>
            )}
          </div>
        </section>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
