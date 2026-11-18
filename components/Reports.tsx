"use client";

import { demoActive } from "./demoSandbox";
import { animate } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { brandName, content, type Content, type ReportWidget, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { cleanProduct, parseList, type Product } from "./records";
import { cleanLine } from "./safe";
import { onServer } from "./merchantApi";
import { loadSetup } from "./setup";
import { storeAddress, storeUrl } from "./siteAddress";
import { useStoreVisits } from "./storeVisits";
import { arCount, dropUndos, offerUndo, snapshot, storageUndo } from "./undo";
import { sourceNames, type VisitCounts, type VisitStats } from "./visitStats";
import { STATUS_KEYS, ordersCopy } from "./ordersContent";
import {
  PAY_KEYS,
  customersReport,
  inventoryReport,
  ordersReport,
  paymentsReport,
  percentChange,
  previousSpan,
  rangeSpan,
  salesFigures,
  type CountedOrder,
  type RangeKind,
  type Span,
} from "./storeNumbers";
import { useStoreOrders } from "./useStoreOrders";
import { usePageTitle } from "./pageTitle";

/* ====================================================================
   Data. A brand-new store has no sales, so every figure starts at zero.
   "Sample data" fills the page with made-up numbers so you can see how
   it looks, and each refresh button then draws a fresh set.
   ==================================================================== */

type Figures = { sales: number; discounts: number; cogs: number; shipping: number; taxes: number; fees: number };

const ZERO: Figures = { sales: 0, discounts: 0, cogs: 0, shipping: 0, taxes: 0, fees: 0 };
const RANGE_SCALE = [1, 3.6, 2.4];

/** Small seeded random generator, so a given seed always gives the same numbers. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Amounts with fils (two decimals), so sample figures never look round */
const r2 = (n: number) => Math.round(n * 100) / 100;

function sampleFigures(range: number, seed: number): Figures {
  const rnd = mulberry32(seed * 7919 + range * 101);
  const sales = r2((900 + rnd() * 600) * RANGE_SCALE[range]);
  return {
    sales,
    discounts: r2(sales * (0.04 + rnd() * 0.05)),
    cogs: r2(sales * (0.36 + rnd() * 0.1)),
    shipping: r2(sales * (0.05 + rnd() * 0.03)),
    taxes: r2(sales * (0.04 + rnd() * 0.03)),
    fees: r2(sales * (0.02 + rnd() * 0.01)),
  };
}

function derive(f: Figures) {
  const net = f.sales - f.discounts;
  const costs = f.cogs + f.shipping + f.taxes + f.fees;
  return { net, costs, profit: net - costs };
}

/** A repeatable "change vs the previous period" for sample data (0 for real, empty data). */
function change(seed: number, slot: number, sample: boolean): number {
  if (!sample) return 0;
  return Math.round((mulberry32(seed * 31 + slot * 17)() * 30 - 8) * 10) / 10;
}

type AbandonedFigures = { count: number; lost: number; rate: number; recovered: number; reminders: number; top: number[] };

function abandonedFigures(range: number, seed: number, sample: boolean): AbandonedFigures {
  if (!sample) return { count: 0, lost: 0, rate: 0, recovered: 0, reminders: 0, top: Array(10).fill(0) };
  const rnd = mulberry32(seed * 4177 + range * 53 + 9);
  const count = Math.round((120 + rnd() * 80) * RANGE_SCALE[range]);
  const lost = r2(count * (18 + rnd() * 14));
  const reminders = Math.round(count * (0.7 + rnd() * 0.2));
  const rate = Math.round((6 + rnd() * 8) * 10) / 10;
  const recovered = Math.round((count * rate) / 100);
  const top = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => Math.round((10 + rnd() * 40) * RANGE_SCALE[range])).sort((x, y) => y - x);
  return { count, lost, rate, recovered, reminders, top };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/* ====================================================================
   Small pieces
   ==================================================================== */

/** Counts smoothly from the old value to the new one. */
/** In the platform tour, lists of products use the products of the made-up store (empty outside the tour). */
function useTourProducts(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!demoActive()) return;
    try {
      const list = parseList(localStorage.getItem("seen-products"), cleanProduct);
      setNames(list.filter((p) => !p.deletedAt && !p.hidden).map((p) => p.name).slice(0, 10));
    } catch {
      /* the sample names stay */
    }
  }, []);
  return names;
}

/** A button that opens a long list in full, and closes it again. */
function MoreButton({ open, onClick, lang }: { open: boolean; onClick: () => void; lang: "en" | "ar" }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className="mt-4 text-sm font-semibold text-primary hover:underline">
      {open ? (lang === "ar" ? "عرض أقل" : "Show less") : lang === "ar" ? "عرض المزيد" : "Show more"}
    </button>
  );
}

const SHORT_LIST = 4;

/** Decimals for a percentage: one when it has a tenth, none when it is whole (0%, 25%, never 0.0% or 25.0%) */
export const pctDecimals = (v: number) => (Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
/** A percentage as text, one decimal at most and no trailing .0 */
const pctText = (v: number) => `${Math.round(v * 10) / 10}%`;

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const show = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = show(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);
  return <span ref={ref}>{show(0)}</span>;
}

export function Money({ value, currency }: { value: number; currency: string }) {
  return (
    <span dir="ltr" className="inline-flex items-baseline gap-1.5">
      <AnimatedNumber value={value} decimals={2} />
      <small className="text-[0.45em] font-bold opacity-70">{currency}</small>
    </span>
  );
}

/* null: there is nothing earlier to compare with (a real store's first sales), so no percentage is made up */
function Delta({ value }: { value: number | null }) {
  const { lang } = usePrefs();
  if (value === null) {
    const none = real[lang].noCompare;
    return (
      <span title={none} aria-label={none} className="inline-flex items-center rounded-full bg-fg/10 px-2.5 py-0.5 text-[11px] font-bold text-muted">
        —
      </span>
    );
  }
  const tone = value > 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : value < 0 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-fg/10 text-muted";
  return (
    <span dir="ltr" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>
      {/* no change: just 0%, no arrow pointing up or down */}
      {value !== 0 && <span aria-hidden className={value < 0 ? "rotate-180" : ""}>▲</span>}
      {Math.abs(value)}%
    </span>
  );
}

type HelpKey = keyof (typeof content)["en"]["reports"]["help"];

/**
 * The "?" next to a figure. Hover it, focus it with the keyboard, or tap it
 * to see what the number means and, where it applies, how it is worked out.
 */
type HelpInfo = { title: string; desc: string; formula?: string[] };

function HelpTip({ id, info }: { id?: HelpKey; info?: HelpInfo }) {
  const { lang } = usePrefs();
  const h = info ?? content[lang].reports.help[id as HelpKey];
  const tipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-describedby={tipId}
        aria-label={h.title}
        onKeyDown={(e) => e.key === "Escape" && (e.currentTarget as HTMLButtonElement).blur()}
        className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[11px] font-bold text-primary outline-none transition hover:bg-primary hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
      >
        ?
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none invisible absolute start-0 top-full z-30 mt-2 w-72 max-w-[80vw] translate-y-1 rounded-xl border border-fg/15 bg-card p-4 text-start font-normal opacity-0 shadow-2xl transition duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span className="block text-sm font-bold">{h.title}</span>
        <span className="mt-2 block text-sm leading-relaxed text-muted">{h.desc}</span>
        {h.formula && (
          <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-soft px-3 py-2 text-xs font-semibold">
            {h.formula.map((part, i) =>
              part === "=" || part === "+" || part === "−" || part === "×" || part === "÷" ? (
                <span key={i} aria-hidden className={part === "−" ? "text-rose-500" : part === "+" ? "text-emerald-600 dark:text-emerald-400" : part === "×" || part === "÷" ? "text-sky-500" : "text-muted"}>{part}</span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </span>
        )}
      </span>
    </span>
  );
}

/** Refresh icon: spins while the widget reloads. */
export function RefreshButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full text-primary transition hover:bg-primary/10 disabled:cursor-progress"
    >
      <svg viewBox="0 0 24 24" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12A9 9 0 0 1 18.5 5.8L21 8" />
        <path d="M21 3v5h-5M3 21v-5h5" />
      </svg>
    </button>
  );
}

/* ====================================================================
   Report pages made from a list of cards (Orders, Customers, Inventory)
   ==================================================================== */

type WidgetData = { value: number; a: number; b: number; rows: number[] };

/** Sample numbers for a card. Real stores start at zero. */
function widgetData(w: ReportWidget, section: number, index: number, range: number, seed: number, sample: boolean): WidgetData {
  const n = w.items?.length ?? 0;
  if (!sample) return { value: 0, a: 0, b: 0, rows: Array(n).fill(0) };
  const rnd = mulberry32(seed * 6151 + section * 131 + index * 17 + range * 7);
  const scale = RANGE_SCALE[range];
  if (w.kind === "stat") {
    const value = w.unit === "decimal" ? Math.round((1.1 + rnd() * 1.2) * 10) / 10 : w.unit === "money" ? Math.round((300 + rnd() * 900) * scale) : Math.round((20 + rnd() * 400) * scale);
    return { value, a: 0, b: 0, rows: [] };
  }
  if (w.kind === "rate") {
    if (w.rateRange) {
      const [lo, hi] = w.rateRange;
      const b = Math.round((60 + rnd() * 240) * scale);
      const a = Math.max(1, Math.round((b * (lo + rnd() * (hi - lo))) / 100));
      return { value: Math.round((a / b) * 1000) / 10, a, b, rows: [] };
    }
    const a = Math.round((15 + rnd() * 50) * scale);
    const b = Math.round(a * (8 + rnd() * 12));
    return { value: Math.round((a / b) * 1000) / 10, a, b, rows: [] };
  }
  if (w.kind === "ratelist") {
    /* Each row is its own percentage (for example acceptance per payment method). */
    return { value: 0, a: 0, b: 0, rows: Array.from({ length: n }, () => Math.round((82 + rnd() * 17) * 10) / 10) };
  }
  const rows = Array.from({ length: n }, () => Math.round((8 + rnd() * 60) * scale));
  if (w.kind === "list") rows.sort((x, y) => y - x);
  return { value: 0, a: 0, b: 0, rows };
}

/* The logo of each payment method, in the same order as the items of the widget. "cash" is drawn here. */
const PAY_LOGOS: Record<string, string[]> = { "p-methods": ["/logos/visa.png", "/logos/cliq.png", "cash", "/logos/paypal.png"] };

function PayLogo({ src }: { src: string }) {
  if (src === "cash") {
    /* Dukkan's own pictogram for cash on delivery, the same one the main page shows */
    return (
      <span className="grid h-7 w-10 shrink-0 place-items-center rounded-md bg-white text-primary ring-1 ring-fg/10 dark:bg-white/[0.07]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <g transform="rotate(-14 14 7)">
            <rect x="8" y="2.5" width="12" height="7.5" rx="1.3" />
            <circle cx="14" cy="6.25" r="1.7" />
          </g>
          <path d="M3 14.5h3l3.4 1.8h4.9c1.2 0 1.8 1.4.8 2.1L13 19.6H9L3 18.2" />
        </svg>
      </span>
    );
  }
  return (
    <span className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-fg/10 dark:bg-white/[0.07]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* in the dark the tile is dark and the logo white (they are dark letters on clear ground) */}
      <img src={src} alt="" className="h-full w-full object-contain p-0.5 dark:brightness-0 dark:invert" />
    </span>
  );
}

function GenericReport({
  widgets,
  section,
  range,
  seed,
  sample,
  busy,
  refresh,
  r,
}: {
  widgets: ReportWidget[];
  section: number;
  range: number;
  seed: number;
  sample: boolean;
  busy: Partial<Record<WidgetId, boolean>>;
  refresh: (id: WidgetId) => void;
  r: Content["reports"];
}) {
  /* Each split can be read as percentages or as plain numbers */
  const [numbers, setNumbers] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const { lang } = usePrefs();
  const tourProducts = useTourProducts();
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {widgets.map((w, wi) => {
        const items = w.items && tourProducts.length && (w.id === "i-wish" || w.id === "i-req") ? tourProducts : w.items;
        const d = widgetData({ ...w, items }, section, wi, range, seed, sample);
        const collapsed = w.kind === "list" && !!items && items.length > SHORT_LIST && !opened[w.id];
        const tone = w.tone === "bad" ? "text-rose-500" : w.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-primary";
        const max = Math.max(...d.rows, 1);
        const total = d.rows.reduce((x, y) => x + y, 0);
        const empty = (w.kind === "list" || w.kind === "breakdown" || w.kind === "ratelist") && total === 0;
        const slot = 40 + section * 10 + wi;

        return (
          <section key={w.id} className="flex min-h-[15rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
            <div className="flex items-start justify-between gap-2">
              <h3 className="flex items-start gap-2 text-sm font-bold">
                <span className="pt-px"><HelpTip info={w} /></span>
                {w.title}
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                {w.kind === "breakdown" && (
                  <div dir="ltr" role="group" className="flex rounded-lg border border-fg/15 p-0.5 text-[11px] font-bold">
                    {([false, true] as const).map((asNum) => (
                      <button key={String(asNum)} type="button" aria-pressed={!!numbers[w.id] === asNum} onClick={() => setNumbers((m) => ({ ...m, [w.id]: asNum }))} className={`rounded-md px-2 py-1 transition ${!!numbers[w.id] === asNum ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                        {asNum ? "123" : "%"}
                      </button>
                    ))}
                  </div>
                )}
                <RefreshButton busy={!!busy[w.id]} onClick={() => refresh(w.id)} label={r.refresh} />
              </div>
            </div>

            <div className={`mt-4 flex flex-1 flex-col transition-opacity duration-300 ${busy[w.id] ? "opacity-40" : ""}`}>
              {w.kind === "stat" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <Delta value={change(seed, slot, sample)} />
                  <p className={`text-4xl font-bold ${tone}`}>
                    {w.unit === "money" ? <Money value={d.value} currency={r.currency} /> : <span dir="ltr"><AnimatedNumber value={d.value} decimals={w.unit === "decimal" ? 1 : 0} /></span>}
                  </p>
                </div>
              )}

              {w.kind === "rate" && (
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-center justify-between gap-3">
                    <Delta value={change(seed, slot, sample)} />
                    <p className={`text-4xl font-bold ${tone}`}><span dir="ltr"><AnimatedNumber value={d.value} decimals={pctDecimals(d.value)} />%</span></p>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={d.value} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(d.value * 4, 100)}%` }} />
                  </div>
                  <ul className="mt-5 space-y-3 text-sm">
                    {[w.items?.[0], w.items?.[1]].map((label, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="text-muted">{label}</span>
                        <span className="font-bold"><AnimatedNumber value={i === 0 ? d.a : d.b} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(w.kind === "list" || w.kind === "breakdown" || w.kind === "ratelist") &&
                (empty ? (
                  <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">{r.noData}</p>
                ) : (
                  <ul className="space-y-4">
                    {items?.map((name, i) => (collapsed && i >= SHORT_LIST ? null : (
                      <li key={name}>
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span className="flex min-w-0 items-center gap-2.5">
                            {PAY_LOGOS[w.id]?.[i] && <PayLogo src={PAY_LOGOS[w.id][i]} />}
                            <span dir="auto" className="min-w-0 truncate ltr:text-left rtl:text-right">{name}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 text-muted">
                            {w.kind === "breakdown" ? (numbers[w.id] ? d.rows[i].toLocaleString("en-US") : pctText((d.rows[i] / total) * 100)) : w.kind === "ratelist" ? `${d.rows[i]}%` : d.rows[i]}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${w.kind === "ratelist" ? d.rows[i] : (d.rows[i] / (w.kind === "breakdown" ? total : max)) * 100}%` }} />
                        </div>
                      </li>
                    )))}
                  </ul>
                ))}
              {w.kind === "list" && !empty && !!items && items.length > SHORT_LIST && <MoreButton open={!!opened[w.id]} onClick={() => setOpened((m) => ({ ...m, [w.id]: !m[w.id] }))} lang={lang} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ====================================================================
   A real store's reports: the same pages, worked out from its own
   orders and products (storeNumbers.ts). What Dukkan does not count
   yet (visits, carts left behind, taxes, payment fees) says so.
   ==================================================================== */

type StoreData = { orders: CountedOrder[]; products: Product[] };

const real = {
  en: {
    notTracked: "Not tracked yet",
    /* before the page has read the store's orders and products (the first moment after it opens) */
    loading: "Loading your numbers…",
    noCompare: "No earlier sales to compare with",
    visitsNote: "Visitors are counted for a store that is signed in and open at its link. Your orders, customers and stock are in the other reports.",
    cartsNote: "Dukkan does not keep the carts customers leave yet, so there is nothing to show here.",
    cogsUnknown: (n: number) => `${n === 1 ? "1 sold item has" : `${n} sold items have`} no known cost (no cost on the product, or the product was deleted), so ${n === 1 ? "it is" : "they are"} left out.`,
    profitHigh: "Some sold items have no cost on their product, so the real profit is lower than this.",
    /* the profit counts only the products that have a cost price (storeNumbers.ts salesFigures) */
    profitFrom: (n: number, m: number) => `${n} of the ${m} products sold ${n === 1 ? "has" : "have"} a cost price: the profit is from ${n === 1 ? "it" : "those"} only`,
    /* so net sales − costs − this = profit, and the cards add up */
    costless: (amount: string) => `Not in the profit: ${amount} paid for products with no cost price`,
    addCosts: "Add cost prices to your products to see profit.",
    /* what counts as a sale (storeNumbers.ts saleState), the same rule as the home page */
    expected: "Orders waiting for delivery: {n} · expected {amount}",
    notCharged: "Card or CliQ test orders not counted (nothing was charged): {n}",
    netSalesHelp: { title: "Net sales", desc: "What customers paid for delivered orders, and for orders you added yourself once they're marked paid, after coupons. Orders still on their way are shown apart as expected. Cancelled or refunded orders, and card or CliQ test orders (nothing was charged), are not counted.", formula: ["Net sales", "=", "Total sales", "−", "Discounts"] },
    profitHelp: { title: "Net profit", desc: "What you made on the products that have a cost price: what customers paid for them (after coupons, without the delivery fee), minus their cost. Products with no cost price are left out, so they never count as 100% profit. What you pay the courier isn't tracked yet.", formula: ["Net profit", "=", "Paid for products with a cost", "−", "Their cost"] },
    failed: "Your orders couldn't be loaded. Check your connection and try again.",
    retry: "Try again",
    shippingNone: "Not saved on these orders",
    shippingPaid: "Paid by customers; taken out of the profit",
    courierNote: "What you pay the courier isn't tracked yet: this is the profit on your products.",
    orders: { title: "Orders", desc: "Every order placed in the period, whatever its status. Card or CliQ test orders (nothing was charged) are not counted, here or in any report." },
    average: { title: "Average order", desc: "What a delivered order brought in on average (the orders counted in net sales).", formula: ["Average order", "=", "Net sales", "÷", "Orders"] },
    cancel: { title: "Cancellation rate", desc: "The share of the period's orders that were cancelled.", formula: ["Cancellation rate", "=", "Cancelled orders", "÷", "All orders", "×", "100"] },
    cancelItems: ["Cancelled orders", "All orders"],
    byStatus: { title: "Orders by status", desc: "Where the period's orders are now." },
    bySource: { title: "Orders by source", desc: "Orders placed in your online store, and orders you added yourself." },
    byWay: { title: "Delivery or pickup", desc: "How the period's orders reach your customers." },
    ways: ["Delivered", "Picked up from the store"],
    byDay: { title: "Orders by day", desc: "How many orders came in each day of the period." },
    customers: { title: "Customers", desc: "Different customers who bought in the period, told apart by phone number or email. Cancelled and refunded orders are not counted." },
    newCustomers: { title: "New customers", desc: "Customers whose first purchase from your store is in this period." },
    returning: { title: "Returning customer rate", desc: "The share of the period's customers who bought more than once in it.", formula: ["Returning rate", "=", "Returning customers", "÷", "All customers", "×", "100"] },
    returningItems: ["Returning customers", "All customers"],
    top: { title: "Customers with the most orders", desc: "Your most loyal customers in the period, ranked by number of orders." },
    ordersN: (n: number) => (n === 1 ? "1 order" : `${n} orders`),
    noContact: "Orders with no phone or email: {n}. They are not counted as customers.",
    methods: { title: "Payment methods used", desc: "How the period's orders were paid, or will be paid on delivery, by number of orders and amount. Card or CliQ test orders (nothing was charged) and cancelled or refunded orders are not counted." },
    pays: { card: "Card", cliq: "CliQ", cash: "Cash (on delivery or pickup)", none: "Not recorded (added by hand)" },
    electronic: { title: "Share of electronic payments", desc: "Orders paid by card or CliQ, out of the orders whose way of paying is known." },
    electronicItems: ["Electronic payments", "Payments with a known method"],
    products: { title: "Products", desc: "Products in your store, hidden ones too (not the ones in the bin)." },
    stock: { title: "Units in stock", desc: "All the units you have, over the products with a counted stock." },
    unlimited: "+ {n} with no stock limit",
    sold: { title: "Units sold", desc: "Units sold in the period, without cancelled or refunded orders." },
    availability: { title: "Stock availability by product", desc: "Products in stock, running low (at or under their own low stock amount) and sold out. Products with no stock limit count as in stock." },
    availItems: ["In stock", "Low stock", "Out of stock"],
    best: { title: "Best sellers", desc: "The products that sold the most units in the period." },
    restock: { title: "To restock", desc: "Products sold out or running low, fewest left first." },
    left: (n: number, at: number) => `${n} left · low at ${at}`,
  },
  ar: {
    notTracked: "لا يُتتبّع بعد",
    loading: "جارٍ تحميل أرقامك…",
    noCompare: "لا توجد مبيعات سابقة للمقارنة",
    visitsNote: "يُحسب الزوار لمتجر مسجّل الدخول ومفتوح على رابطه. طلباتك وعملاؤك ومخزونك في التقارير الأخرى.",
    cartsNote: "لا يحفظ دكان السلات التي يتركها العملاء بعد، فلا يوجد ما يُعرض هنا.",
    cogsUnknown: (n: number) => `${n === 1 ? "قطعة مباعة واحدة تكلفتها" : `${n} من القطع المباعة تكلفتها`} غير معروفة (لا تكلفة على المنتج، أو حُذف المنتج)، فلم تُحسب.`,
    profitHigh: "بعض القطع المباعة لا تكلفة على منتجها، فالربح الحقيقي أقل من هذا.",
    profitFrom: (n: number, m: number) =>
      `${n === 1 ? "منتج واحد" : n === 2 ? "منتجان" : n} من أصل ${arCount(m, { one: "منتج واحد", two: "منتجين مباعين", few: "منتجات مباعة", many: "منتجًا مباعًا" })} ${n === 1 ? "له" : "لها"} سعر تكلفة، والربح ${n === 1 ? "منه" : "منها"} وحده${n === 1 ? "" : "ا"}`,
    costless: (amount: string) => `لا يدخل في الربح: ${amount} دُفعت في منتجات بلا سعر تكلفة`,
    addCosts: "أضف سعر التكلفة لمنتجاتك لترى الربح.",
    expected: "طلبات بانتظار التوصيل: {n} · المتوقَّع {amount}",
    notCharged: "طلبات تجريبية بالبطاقة أو كليك لا تُحتسب (لم يُخصم أي مبلغ): {n}",
    netSalesHelp: { title: "صافي المبيعات", desc: "ما دفعه العملاء في الطلبات التي تم توصيلها، وفي الطلبات التي أضفتها بنفسك بعد أن تصبح مدفوعة، بعد الكوبونات. الطلبات التي لم تصل بعد تظهر وحدها كمبلغ متوقَّع. لا تُحتسب الطلبات الملغاة أو المستردة، ولا الطلبات التجريبية بالبطاقة أو كليك (لم يُخصم فيها أي مبلغ).", formula: ["صافي المبيعات", "=", "إجمالي المبيعات", "−", "الخصومات"] },
    profitHelp: { title: "صافي الأرباح", desc: "ما ربحته من المنتجات التي لها سعر تكلفة: ما دفعه العملاء فيها (بعد الكوبونات ودون رسوم التوصيل) ناقص تكلفتها. المنتجات بلا سعر تكلفة لا تُحتسب، فلا تظهر أبدًا كربح كامل. ما تدفعه لشركة التوصيل لا يُتتبّع بعد.", formula: ["صافي الأرباح", "=", "ما دُفع في المنتجات ذات التكلفة", "−", "تكلفتها"] },
    failed: "تعذّر تحميل طلباتك. تحقق من الاتصال وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    shippingNone: "غير محفوظة على هذه الطلبات",
    shippingPaid: "دفعها العملاء؛ تُطرح من الربح",
    courierNote: "ما تدفعه لشركة التوصيل لا يُتتبّع بعد: هذا هو الربح من منتجاتك.",
    orders: { title: "الطلبات", desc: "كل الطلبات التي وصلت خلال الفترة، أيًّا كانت حالتها. لا تُحتسب الطلبات التجريبية بالبطاقة أو كليك (لم يُخصم فيها أي مبلغ)، هنا ولا في أي تقرير." },
    average: { title: "متوسط الطلب", desc: "ما جلبه الطلب الواحد الذي تم توصيله في المتوسط (الطلبات المحسوبة في صافي المبيعات).", formula: ["متوسط الطلب", "=", "صافي المبيعات", "÷", "الطلبات"] },
    cancel: { title: "معدل الإلغاء", desc: "نسبة الطلبات الملغاة من طلبات الفترة.", formula: ["معدل الإلغاء", "=", "الطلبات الملغاة", "÷", "كل الطلبات", "×", "100"] },
    cancelItems: ["الطلبات الملغاة", "كل الطلبات"],
    byStatus: { title: "الطلبات حسب الحالة", desc: "أين وصلت طلبات الفترة الآن." },
    bySource: { title: "الطلبات حسب المصدر", desc: "طلبات من متجرك الإلكتروني، وطلبات أضفتها بنفسك." },
    byWay: { title: "توصيل أو استلام", desc: "كيف تصل طلبات الفترة إلى عملائك." },
    ways: ["توصيل", "استلام من المتجر"],
    byDay: { title: "الطلبات حسب اليوم", desc: "كم طلبًا وصل في كل يوم من أيام الفترة." },
    customers: { title: "العملاء", desc: "العملاء المختلفون الذين اشتروا خلال الفترة، نميّزهم برقم الهاتف أو البريد. لا تُحسب الطلبات الملغاة أو المستردة." },
    newCustomers: { title: "عملاء جدد", desc: "عملاء كان أول شراء لهم من متجرك في هذه الفترة." },
    returning: { title: "نسبة العملاء العائدين", desc: "نسبة عملاء الفترة الذين اشتروا أكثر من مرة خلالها.", formula: ["نسبة العائدين", "=", "العملاء العائدون", "÷", "كل العملاء", "×", "100"] },
    returningItems: ["العملاء العائدون", "كل العملاء"],
    top: { title: "العملاء الأكثر طلبًا", desc: "أكثر عملائك ولاءً خلال الفترة، مرتّبين حسب عدد الطلبات." },
    ordersN: (n: number) => (n === 1 ? "طلب واحد" : n === 2 ? "طلبان" : n <= 10 ? `${n} طلبات` : `${n} طلبًا`),
    noContact: "طلبات بلا هاتف أو بريد: {n}. لم تُحسب ضمن العملاء.",
    methods: { title: "طرق الدفع المستخدمة", desc: "كيف دُفعت طلبات الفترة أو ستُدفع عند الاستلام، بعدد الطلبات والمبلغ. لا تُحتسب الطلبات التجريبية بالبطاقة أو كليك (لم يُخصم فيها أي مبلغ) ولا الملغاة أو المستردة." },
    pays: { card: "بطاقة", cliq: "كليك", cash: "نقدًا عند الاستلام", none: "غير مسجّلة (أُضيفت يدويًا)" },
    electronic: { title: "نسبة الدفع الإلكتروني", desc: "الطلبات المدفوعة ببطاقة أو كليك، من الطلبات المعروفة طريقة دفعها." },
    electronicItems: ["مدفوعات إلكترونية", "مدفوعات معروفة الطريقة"],
    products: { title: "المنتجات", desc: "منتجات متجرك، ومنها المخفية (دون التي في سلة المحذوفات)." },
    stock: { title: "القطع في المخزون", desc: "كل القطع المتوفرة لديك، في المنتجات ذات المخزون المعدود." },
    unlimited: "+ {n} بلا حد للمخزون",
    sold: { title: "القطع المباعة", desc: "القطع المباعة خلال الفترة، دون الطلبات الملغاة أو المستردة." },
    availability: { title: "توفّر المخزون حسب المنتج", desc: "منتجات متوفرة، وأخرى قاربت على النفاد (عند حد المخزون المنخفض لكل منتج أو أقل)، وأخرى نفدت. المنتجات بلا حد للمخزون تُحسب متوفرة." },
    availItems: ["متوفر", "مخزون منخفض", "نفد"],
    best: { title: "الأكثر مبيعًا", desc: "المنتجات التي بيع منها أكبر عدد من القطع خلال الفترة." },
    restock: { title: "لإعادة التخزين", desc: "منتجات نفدت أو قاربت على النفاد، الأقل أولًا." },
    left: (n: number, at: number) => `باقٍ ${n} · الحد ${at}`,
  },
};

const panel = "flex min-h-[15rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";

/** One card of a real report: its "?" and title, its refresh button, and what it shows. */
function RealCard({ id, info, busy, refresh, wide, children }: { id: string; info: HelpInfo; busy: Partial<Record<string, boolean>>; refresh: (id: string) => void; wide?: boolean; children: React.ReactNode }) {
  const { lang } = usePrefs();
  return (
    <section className={`${panel} ${wide ? "md:col-span-2 lg:col-span-3" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-start gap-2 text-sm font-bold">
          <span className="pt-px"><HelpTip info={info} /></span>
          {info.title}
        </h3>
        <RefreshButton busy={!!busy[id]} onClick={() => refresh(id)} label={content[lang].reports.refresh} />
      </div>
      <div className={`mt-4 flex flex-1 flex-col transition-opacity duration-300 ${busy[id] ? "opacity-40" : ""}`}>{children}</div>
    </section>
  );
}

function Stat({ delta, tone = "text-primary", children, note }: { delta?: number | null; tone?: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {delta !== undefined && <Delta value={delta} />}
      <p className={`text-4xl font-bold ${tone}`}>{children}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

/** A rate with the two counts it comes from. */
function Rate({ value, tone, labels, a, b }: { value: number; tone: string; labels: string[]; a: number; b: number }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <p className={`text-end text-4xl font-bold ${tone}`}><span dir="ltr"><AnimatedNumber value={value} decimals={pctDecimals(value)} />%</span></p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <ul className="mt-5 space-y-3 text-sm">
        {[a, b].map((n, i) => (
          <li key={labels[i]} className="flex items-center justify-between">
            <span className="text-muted">{labels[i]}</span>
            <span className="font-bold"><AnimatedNumber value={n} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows with a bar each; `shown` is what is written at the end of the row (the count when left out). */
function Bars({ rows, logos }: { rows: { label: string; value: number; shown?: string }[]; logos?: (string | undefined)[] }) {
  const { lang } = usePrefs();
  const [open, setOpen] = useState(false);
  const max = Math.max(...rows.map((x) => x.value), 1);
  if (!rows.some((x) => x.value > 0)) return <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">{content[lang].reports.noData}</p>;
  return (
    <>
      <ul className="space-y-4">
        {rows.map((row, i) =>
          !open && i >= SHORT_LIST ? null : (
            <li key={`${row.label}-${i}`}>
              <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="flex min-w-0 items-center gap-2.5">
                  {logos?.[i] && <PayLogo src={logos[i] as string} />}
                  <span dir="auto" className="min-w-0 truncate ltr:text-left rtl:text-right">{row.label}</span>
                </span>
                <span dir="ltr" className="shrink-0 text-muted">{row.shown ?? row.value.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </li>
          ),
        )}
      </ul>
      {rows.length > SHORT_LIST && <MoreButton open={open} onClick={() => setOpen((v) => !v)} lang={lang} />}
    </>
  );
}

/** Nothing to show because Dukkan does not count it yet (not a 0, which would look like a fact). */
function NotTrackedPanel({ note }: { note: string }) {
  const { lang } = usePrefs();
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-fg/10">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-soft text-muted">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <p className="mt-4 font-bold">{real[lang].notTracked}</p>
      <p className="mt-1 max-w-md text-sm text-muted">{note}</p>
    </div>
  );
}

/* ====================================================================
   Visitors: the people who opened the store at its link, counted by
   Dukkan's server (server/storeVisits.ts, GET /api/visits) and read
   again every minute while the page is open.
   ==================================================================== */

const seen = {
  en: {
    tiles: ["Last hour", "Today", "Yesterday", "Last 7 days", "Last 30 days"],
    tileHelp: [
      "People who opened your store in the last 60 minutes.",
      "People who opened your store today, since midnight in Jordan.",
      "People who opened your store yesterday (Jordan time).",
      "The visitors of the last 7 days, today included. Each day's visitors are added up, so someone who came on two days counts twice.",
      "The visitors of the last 30 days, today included. Each day's visitors are added up, so someone who came on two days counts twice.",
    ],
    visitors: "visitors",
    visits: (n: number) => (n === 1 ? "1 visit" : `${n.toLocaleString("en-US")} visits`),
    views: (n: number) => (n === 1 ? "1 page view" : `${n.toLocaleString("en-US")} page views`),
    chart: { title: "Visitors over time", desc: "Different people who opened your store in each hour of the last 24 hours, or each day of the last 30 days." },
    hours: "24 hours",
    days: "30 days",
    sources: { title: "Where visits came from", desc: "The last 30 days. Where people were just before they opened your store: a link shared on an app, a search, or another website. Links opened straight from WhatsApp often don't say where they came from, so they show as direct." },
    products: { title: "Most viewed products", desc: "The product pages opened most in the last 30 days." },
    help: { title: "How visitors are counted", desc: "A visitor is one person on one day (one browser on one network). A visit starts when they open your store, and a new one after 30 minutes without opening anything. A page view is each page they open. Your own visits while signed in, Dukkan's staff, search engines and link previews are not counted. Nothing that names a visitor is kept." },
    updated: "Updated",
    emptyTitle: "No visitors yet",
    emptyHint: "When people open your store, you'll see them here within a minute. Share your store's link on WhatsApp, Instagram or wherever your customers are.",
    shareLink: "Your store's link",
    /* the server leaves out the merchant's own visits on purpose (server/storeVisits.ts): a 0 after he opened it says why */
    ownVisits: "Your own visits aren't counted while you're signed in on this browser.",
    /* while the server's answer is on its way, and when it can't be had: never zeros, which would read as "no visitors" */
    loading: "Loading your visitor numbers…",
    failed: "Your visitor numbers couldn't be loaded. Check your connection and try again.",
    retry: "Try again",
  },
  ar: {
    tiles: ["آخر ساعة", "اليوم", "أمس", "آخر 7 أيام", "آخر 30 يومًا"],
    tileHelp: [
      "الأشخاص الذين فتحوا متجرك في آخر 60 دقيقة.",
      "الأشخاص الذين فتحوا متجرك اليوم، منذ منتصف الليل بتوقيت الأردن.",
      "الأشخاص الذين فتحوا متجرك أمس (بتوقيت الأردن).",
      "زوار آخر 7 أيام مع اليوم. تُجمع أعداد زوار كل يوم، فمن جاء في يومين يُحسب مرتين.",
      "زوار آخر 30 يومًا مع اليوم. تُجمع أعداد زوار كل يوم، فمن جاء في يومين يُحسب مرتين.",
    ],
    visitors: "زائر",
    visits: (n: number) => (n === 1 ? "زيارة واحدة" : n === 2 ? "زيارتان" : n >= 3 && n <= 10 ? `${n} زيارات` : `${n.toLocaleString("en-US")} زيارة`),
    views: (n: number) => (n === 1 ? "مشاهدة صفحة واحدة" : `${n.toLocaleString("en-US")} مشاهدة صفحة`),
    chart: { title: "الزوار عبر الوقت", desc: "الأشخاص المختلفون الذين فتحوا متجرك في كل ساعة من آخر 24 ساعة، أو كل يوم من آخر 30 يومًا." },
    hours: "24 ساعة",
    days: "30 يومًا",
    sources: { title: "من أين جاءت الزيارات", desc: "آخر 30 يومًا. أين كان الزوار قبل أن يفتحوا متجرك: رابط في تطبيق، أو بحث، أو موقع آخر. الروابط التي تُفتح من واتساب مباشرة كثيرًا ما لا تذكر مصدرها، فتظهر كزيارات مباشرة." },
    products: { title: "المنتجات الأكثر مشاهدة", desc: "صفحات المنتجات التي فُتحت أكثر في آخر 30 يومًا." },
    help: { title: "كيف يُحسب الزوار", desc: "الزائر شخص واحد في يوم واحد (متصفح واحد على شبكة واحدة). تبدأ الزيارة حين يفتح متجرك، وتبدأ زيارة جديدة بعد 30 دقيقة دون أن يفتح شيئًا. مشاهدة الصفحة هي كل صفحة يفتحها. لا تُحسب زياراتك أنت وأنت مسجّل الدخول، ولا فريق دكان، ولا محركات البحث ومعاينات الروابط. ولا يُحفظ شيء يدل على هوية الزائر." },
    updated: "آخر تحديث",
    emptyTitle: "لا زوار بعد",
    emptyHint: "حين يفتح الناس متجرك ستراهم هنا خلال دقيقة. شارك رابط متجرك على واتساب أو إنستغرام أو حيث يوجد عملاؤك.",
    shareLink: "رابط متجرك",
    ownVisits: "زياراتك أنت لا تُحتسب وأنت مسجّل الدخول على هذا المتصفح.",
    loading: "جارٍ تحميل أرقام الزوار…",
    failed: "تعذّر تحميل أرقام الزوار. تحقق من الاتصال وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
  },
};

const NO_VISITS: VisitCounts = { visitors: 0, visits: 0, views: 0 };

/** Three grey rows in place of a list of bars that is still loading */
function ListPlaceholder() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Placeholder className="h-3.5 w-2/5" />
          <Placeholder className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A grey block in place of a number or a list that is still loading */
function Placeholder({ className }: { className: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-lg bg-fg/10 motion-reduce:animate-none ${className}`} />;
}

/** No one has opened the store yet: says so, and gives the link to share */
function VisitorsEmpty() {
  const { lang } = usePrefs();
  const v = seen[lang];
  const [slug, setSlug] = useState("");
  useEffect(() => setSlug(loadSetup()?.slug ?? ""), []);
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-fg/10">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-soft text-primary">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" />
        </svg>
      </span>
      <p className="mt-4 font-bold">{v.emptyTitle}</p>
      <p className="mt-1 max-w-md text-sm text-muted">{v.emptyHint}</p>
      <p className="mt-2 max-w-md text-xs text-muted">{v.ownVisits}</p>
      {slug && (
        <p className="mt-4 text-sm">
          <span className="text-muted">{v.shareLink}: </span>
          <a href={storeUrl(slug)} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-semibold text-primary hover:underline">{storeAddress(slug)}</a>
        </p>
      )}
    </div>
  );
}

/** The Visitors report of a signed-in store: five periods, a chart, where visits came from and the most viewed products */
function VisitorsReport({ productNames }: { productNames: Map<number, string> }) {
  const { lang } = usePrefs();
  const v = seen[lang];
  const r = content[lang].reports;
  const { stats, loaded, reload } = useStoreVisits();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"hours" | "days">("hours");
  const [hover, setHover] = useState<number | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    if (stats) setAt(new Date());
  }, [stats]);
  const refresh = async () => {
    setBusy(true);
    await reload();
    setBusy(false);
  };

  if (loaded && stats && stats.days30.views === 0 && stats.lastHour.views === 0) return <VisitorsEmpty />;
  /* the server answered nothing usable (and there are no numbers from before): says so, with a way to ask again */
  if (loaded && !stats)
    return (
      <div role="alert" className="flex flex-col items-center rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-fg/10">
        <p className="max-w-md text-sm text-rose-600 dark:text-rose-400">{v.failed}</p>
        <button type="button" onClick={() => void refresh()} disabled={busy} className="mt-4 rounded-xl border border-fg/15 px-4 py-2 text-sm font-semibold transition hover:bg-soft disabled:opacity-60">
          {v.retry}
        </button>
      </div>
    );
  const s: VisitStats | null = stats;
  /* still loading: grey blocks stand where the numbers will be, not zeros */
  const loading = !s;
  const tiles = [s?.lastHour, s?.today, s?.yesterday, s?.week, s?.days30].map((x) => x ?? NO_VISITS);
  const fading = `transition-opacity duration-300 ${busy ? "opacity-40" : ""}`;

  /* the chart: the last 24 hours by hour, or the last 30 days by day (Jordan time) */
  const hourName = (t: number) => new Intl.DateTimeFormat(dateLocale(lang), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Amman" }).format(new Date(t));
  const dayName = (d: string) => new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const bars = mode === "hours"
    ? (s?.hours ?? []).map((h) => ({ label: hourName(h.at), visitors: h.visitors, views: h.views }))
    : (s?.days ?? []).map((d) => ({ label: dayName(d.day), visitors: d.visitors, views: d.views }));
  const peak = Math.max(...bars.map((b) => b.visitors), 1);
  const shown = bars[hover ?? bars.length - 1];

  /* products he deleted since are left out */
  const products = (s?.products ?? []).flatMap((p) => {
    const name = productNames.get(p.id);
    return name ? [{ label: name, value: p.views }] : [];
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
        <h3 className="flex items-start gap-2 text-sm font-bold">
          <span className="pt-px"><HelpTip info={v.help} /></span>
          {v.help.title}
        </h3>
        <div className="flex items-center gap-3">
          {loading && <span role="status" className="text-xs text-muted">{v.loading}</span>}
          {at && <span dir="ltr" className="text-xs text-muted">{v.updated} {at.toLocaleTimeString(dateLocale(lang))}</span>}
          <RefreshButton busy={busy} onClick={() => void refresh()} label={r.refresh} />
        </div>
      </div>

      {/* the last hour, today and yesterday on one row, the last 7 and 30 days under them */}
      <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-6 ${fading}`}>
        {tiles.map((t, i) => (
          <section key={v.tiles[i]} className={`flex min-h-[11rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 ${i < 3 ? "lg:col-span-2" : "lg:col-span-3"} ${i === 4 ? "sm:col-span-2" : ""}`}>
            <h3 className="flex items-start gap-2 text-sm font-bold">
              <span className="pt-px"><HelpTip info={{ title: v.tiles[i], desc: v.tileHelp[i] }} /></span>
              {v.tiles[i]}
            </h3>
            {loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <Placeholder className="h-10 w-20" />
                <Placeholder className="h-3 w-32" />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <p className="text-4xl font-bold text-primary"><span dir="ltr"><AnimatedNumber value={t.visitors} /></span></p>
                <p className="text-xs font-semibold text-muted">{v.visitors}</p>
                <p className="mt-2 text-xs text-muted">{v.visits(t.visits)} · {v.views(t.views)}</p>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className={`${panel} ${fading}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="flex items-start gap-2 text-sm font-bold">
            <span className="pt-px"><HelpTip info={v.chart} /></span>
            {v.chart.title}
          </h3>
          <div role="group" className="flex rounded-lg border border-fg/15 p-0.5 text-xs font-semibold">
            {(["hours", "days"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHover(null); }} className={`rounded-md px-3 py-1.5 transition ${mode === m ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                {m === "hours" ? v.hours : v.days}
              </button>
            ))}
          </div>
        </div>
        {shown && (
          <div className="mt-4 rounded-xl bg-soft px-4 py-3 text-xs" dir="auto">
            <p className="font-bold">{shown.label}</p>
            <p className="mt-1 text-muted"><span className="font-semibold text-fg">{shown.visitors.toLocaleString("en-US")}</span> {v.visitors} · {v.views(shown.views)}</p>
          </div>
        )}
        {loading && <Placeholder className="mt-4 h-36 w-full" />}
        <div dir="ltr" className={`mt-4 flex h-36 items-end gap-1 ${loading ? "hidden" : ""}`} role="img" aria-label={v.chart.title}>
          {bars.map((b, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${b.label}: ${b.visitors} ${v.visitors}`}
              className={`flex-1 rounded-sm transition-all duration-500 ${hover === i ? "bg-deep" : b.visitors ? "bg-primary" : "bg-primary/20"}`}
              style={{ height: `${b.visitors ? Math.max((b.visitors / peak) * 100, 8) : 4}%` }}
            />
          ))}
        </div>
        {bars.length > 0 && (
          <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>{bars[0].label}</span>
            <span>{bars[bars.length - 1].label}</span>
          </div>
        )}
      </section>

      <div className={`grid gap-6 lg:grid-cols-2 ${fading}`}>
        <section className={panel}>
          <h3 className="flex items-start gap-2 text-sm font-bold">
            <span className="pt-px"><HelpTip info={v.sources} /></span>
            {v.sources.title}
          </h3>
          <div className="mt-4 flex flex-1 flex-col">
            {loading ? <ListPlaceholder /> : <Bars rows={(s?.sources ?? []).map((x) => ({ label: sourceNames[lang][x.source], value: x.visits, shown: v.visits(x.visits) }))} />}
          </div>
        </section>
        <section className={panel}>
          <h3 className="flex items-start gap-2 text-sm font-bold">
            <span className="pt-px"><HelpTip info={v.products} /></span>
            {v.products.title}
          </h3>
          <div className="mt-4 flex flex-1 flex-col">
            {loading ? <ListPlaceholder /> : <Bars rows={products.map((x) => ({ label: x.label, value: x.value, shown: v.views(x.value) }))} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function RealReport({ section, data, span, prev, busy, refresh, signedIn }: { section: number; data: StoreData; span: Span; prev: Span; busy: Partial<Record<string, boolean>>; refresh: (id: string) => void; signedIn: boolean }) {
  const { lang } = usePrefs();
  const w = real[lang];
  const r = content[lang].reports;
  const cur = r.currency;
  const grid = "grid gap-6 md:grid-cols-2 lg:grid-cols-3";
  const money2 = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  const card = (id: string, info: HelpInfo, body: React.ReactNode, wide?: boolean) => (
    <RealCard key={id} id={id} info={info} busy={busy} refresh={refresh} wide={wide}>
      {body}
    </RealCard>
  );

  if (section === 3) return signedIn ? <VisitorsReport productNames={new Map(data.products.map((p) => [p.id, p.name]))} /> : <NotTrackedPanel note={w.visitsNote} />;
  if (section === 4) return <NotTrackedPanel note={w.cartsNote} />;

  if (section === 1) {
    const o = ordersReport(data.orders, span);
    const before = ordersReport(data.orders, prev);
    const f = salesFigures(data.orders, data.products, span);
    const fBefore = salesFigures(data.orders, data.products, prev);
    const st = ordersCopy[lang].statuses;
    const dayName = (t: number) => new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "short" }).format(new Date(t));
    const peak = Math.max(...o.byDay.map((d) => d.orders), 1);
    return (
      <div className={grid}>
        {card("ro-all", w.orders, <Stat delta={percentChange(o.all, before.all)} note={o.test ? w.notCharged.replace("{n}", String(o.test)) : undefined}><span dir="ltr"><AnimatedNumber value={o.all} /></span></Stat>)}
        {card("ro-avg", w.average, <Stat delta={percentChange(f.average, fBefore.average)}><Money value={f.average} currency={cur} /></Stat>)}
        {card("ro-cancel", w.cancel, <Rate value={o.cancelRate} tone="text-rose-500" labels={w.cancelItems} a={o.byStatus.cancelled} b={o.all} />)}
        {card("ro-status", w.byStatus, <Bars rows={STATUS_KEYS.map((k) => ({ label: st[k], value: o.byStatus[k] }))} />)}
        {card("ro-source", w.bySource, <Bars rows={[{ label: ordersCopy[lang].channels[1], value: o.online }, { label: ordersCopy[lang].channels[0], value: o.manual }]} />)}
        {card("ro-way", w.byWay, <Bars rows={[{ label: w.ways[0], value: o.delivery }, { label: w.ways[1], value: o.pickup }]} />)}
        {card(
          "ro-day",
          w.byDay,
          o.all === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">{r.noData}</p>
          ) : (
            <div>
              <div dir="ltr" className="flex h-36 items-end gap-1" role="img" aria-label={w.byDay.title}>
                {o.byDay.map((d) => (
                  <span
                    key={d.day}
                    title={`${dayName(d.day)}: ${d.orders} · ${money2(d.sales)}`}
                    className={`flex-1 rounded-sm transition-all duration-500 ${d.orders ? "bg-primary" : "bg-primary/20"}`}
                    style={{ height: `${d.orders ? Math.max((d.orders / peak) * 100, 8) : 4}%` }}
                  />
                ))}
              </div>
              <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>{dayName(o.byDay[0].day)}</span>
                <span>{dayName(o.byDay[o.byDay.length - 1].day)}</span>
              </div>
            </div>
          ),
          true,
        )}
      </div>
    );
  }

  if (section === 2) {
    const c = customersReport(data.orders, span);
    const before = customersReport(data.orders, prev);
    const rate = c.customers ? Math.round((c.repeat / c.customers) * 1000) / 10 : 0;
    return (
      <div className={grid}>
        {card("rc-all", w.customers, <Stat delta={percentChange(c.customers, before.customers)} note={c.unknown ? w.noContact.replace("{n}", String(c.unknown)) : undefined}><span dir="ltr"><AnimatedNumber value={c.customers} /></span></Stat>)}
        {card("rc-new", w.newCustomers, <Stat delta={percentChange(c.newCustomers, before.newCustomers)} tone="text-emerald-600 dark:text-emerald-400"><span dir="ltr"><AnimatedNumber value={c.newCustomers} /></span></Stat>)}
        {card("rc-return", w.returning, <Rate value={rate} tone="text-emerald-600 dark:text-emerald-400" labels={w.returningItems} a={c.repeat} b={c.customers} />)}
        {card("rc-top", w.top, <Bars rows={c.top.map((x) => ({ label: x.name, value: x.orders, shown: `${w.ordersN(x.orders)} · ${money2(x.spent)}` }))} />, true)}
      </div>
    );
  }

  if (section === 5) {
    const p = paymentsReport(data.orders, span);
    const known = p.card.count + p.cliq.count + p.cash.count;
    const online = p.card.count + p.cliq.count;
    const logos: Record<string, string | undefined> = { card: "/logos/visa.png", cliq: "/logos/cliq.png", cash: "cash" };
    const keys = PAY_KEYS.filter((k) => k !== "none" || p.none.count > 0);
    return (
      <div className={grid}>
        {card("rp-methods", w.methods, <Bars rows={keys.map((k) => ({ label: w.pays[k], value: p[k].count, shown: `${p[k].count} · ${money2(p[k].sum)}` }))} logos={keys.map((k) => logos[k])} />, false)}
        {card("rp-online", w.electronic, <Rate value={known ? Math.round((online / known) * 1000) / 10 : 0} tone="text-emerald-600 dark:text-emerald-400" labels={w.electronicItems} a={online} b={known} />)}
      </div>
    );
  }

  /* section 6: inventory */
  const inv = inventoryReport(data.products, data.orders, span);
  const before = inventoryReport(data.products, data.orders, prev);
  return (
    <div className={grid}>
      {card("ri-products", w.products, <Stat><span dir="ltr"><AnimatedNumber value={inv.products} /></span></Stat>)}
      {card("ri-stock", w.stock, <Stat note={inv.unlimited ? w.unlimited.replace("{n}", String(inv.unlimited)) : undefined}><span dir="ltr"><AnimatedNumber value={inv.stock} /></span></Stat>)}
      {card("ri-sold", w.sold, <Stat delta={percentChange(inv.sold, before.sold)}><span dir="ltr"><AnimatedNumber value={inv.sold} /></span></Stat>)}
      {card("ri-avail", w.availability, <Bars rows={w.availItems.map((label, i) => ({ label, value: [inv.inStock, inv.low, inv.out][i] }))} />)}
      {card("ri-best", w.best, <Bars rows={inv.topSold.map((x) => ({ label: x.name, value: x.qty }))} />)}
      {card(
        "ri-restock",
        w.restock,
        inv.lowList.length ? (
          <ul className="space-y-3 text-sm">
            {inv.lowList.map((x, i) => (
              <li key={`${x.name}-${i}`} className="flex items-center justify-between gap-3">
                <a href="/products" dir="auto" className="min-w-0 truncate ltr:text-left rtl:text-right font-semibold hover:text-primary hover:underline">{x.name}</a>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${x.quantity === 0 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>{w.left(x.quantity, x.lowAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted">{r.noData}</p>
        ),
      )}
    </div>
  );
}

/* ====================================================================
   Page
   ==================================================================== */

type WidgetId = string;

export function Reports() {
  const { lang } = usePrefs();
  const r = content[lang].reports;

  const [range, setRange] = useState(0);
  const [sample, setSample] = useState(false);
  /* In the platform tour the page already shows its made-up numbers, so there is no switch */
  const [tour, setTour] = useState(false);
  const [seed, setSeed] = useState(1);
  const [section, setSection] = useState(0);
  const [creating, setCreating] = useState(false);
  const [reportName, setReportName] = useState("");
  const [reportSection, setReportSection] = useState(0);
  const [reportRange, setReportRange] = useState(0);
  const [reportFormat, setReportFormat] = useState(0);
  const [reportError, setReportError] = useState(false);
  const [reportToast, setReportToast] = useState(false);

  /* /reports?section=abandoned opens the abandoned carts report straight away */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") === "abandoned") setSection(4);
  }, []);
  const [busy, setBusy] = useState<Partial<Record<WidgetId, boolean>>>({});
  /* a signed-in store outside the tour: its visitors are counted on the server */
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(onServer()), []);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  /* A real store's orders (his browser's and, signed in, the ones customers placed on his store: the same list the
     Orders page shows) and products, read when the page opens, every minute, when he comes back to the tab and by each
     refresh button (useStoreOrders.ts, shared with the home page) */
  const data = useStoreOrders();
  const reloadOrders = data.reload;

  usePageTitle(`${brandName(lang)} | ${r.menu[0]}`);

  useEffect(() => {
    if (demoActive()) {
      setSample(true);
      setTour(true);
    }
    setUpdatedAt(new Date());
  }, []);

  const figures = sample ? sampleFigures(range, seed) : ZERO;
  const { net, costs, profit } = derive(figures);
  const cur = r.currency;

  /* Each refresh button reloads its widget: it spins, then new numbers arrive (the tour draws new sample ones, a real
     store reads its orders and products again) */
  const refresh = useCallback((id: WidgetId) => {
    setBusy((b) => ({ ...b, [id]: true }));
    if (!demoActive()) {
      void reloadOrders().finally(() => {
        setUpdatedAt(new Date());
        setBusy((b) => ({ ...b, [id]: false }));
      });
      return;
    }
    window.setTimeout(() => {
      setSeed((s) => s + 1);
      setUpdatedAt(new Date());
      setBusy((b) => ({ ...b, [id]: false }));
    }, 900);
  }, [reloadOrders]);

  /* A real store's sales, and the same days just before to compare with (storeNumbers.ts) */
  const at = updatedAt ?? new Date();
  const span = rangeSpan(range as RangeKind, at);
  const prevSpan = previousSpan(range as RangeKind, at);
  const realNow = sample ? null : salesFigures(data.orders, data.products, span);
  const realPrev = sample ? null : salesFigures(data.orders, data.products, prevSpan);
  /* the reports worked out from the orders wait for them (Visitors and abandoned carts don't) */
  const needsOrders = !sample && section !== 3 && section !== 4;
  const money2 = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  /* only this page made its reports: its undo goes when it closes */
  useEffect(() => () => dropUndos("reports"), []);
  /* A report he sets up is kept in this browser as a saved definition (nothing is sent anywhere), with an Undo that takes
     it out again (unless the saved reports changed since) */
  const createReport = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cleanLine(reportName, 60);
    if (name.length < 2) return setReportError(true);
    const before = snapshot(["seen-reports"]);
    try {
      /* a saved list that is broken or not a list starts again */
      let list: unknown[] = [];
      try {
        const old = JSON.parse(localStorage.getItem("seen-reports") ?? "[]");
        if (Array.isArray(old)) list = old.filter((x) => x && typeof x === "object");
      } catch {
        /* broken: starts empty */
      }
      list.unshift({ id: Date.now(), name, section: reportSection, range: reportRange, format: reportFormat });
      localStorage.setItem("seen-reports", JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
    const undo = storageUndo(before, snapshot(["seen-reports"]));
    if (undo) offerUndo({ scope: "reports", label: (l) => (l === "ar" ? `أُنشئ التقرير «${name}»` : `Report “${name}” created`), undo });
    setReportName("");
    setReportError(false);
    setCreating(false);
    setReportToast(true);
    window.setTimeout(() => setReportToast(false), 2600);
  };

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" }).format(d);
  const days = [7, 30, 0][range];
  const end = new Date();
  const start = new Date(end);
  if (days) start.setDate(end.getDate() - (days - 1));
  else start.setDate(1);
  const rangeText = `${formatDate(start)} - ${formatDate(end)}`;
  const timeText = updatedAt ? updatedAt.toLocaleTimeString(dateLocale(lang)) : "";

  /* `delta` is the real store's change from the period before; the tour keeps its repeatable sample one (slot) */
  /* `value` null (a real store's profit when nothing sold has a cost price): no number, a hint instead; `info`: the real
     store's own "?" text; `notes`: lines under the number */
  const cards: { id: WidgetId; help: HelpKey; title: string; value: number | null; slot: number; color: string; badge?: boolean; delta?: number | null; info?: HelpInfo; notes?: string[] }[] = [
    { id: "net", help: "netSales", title: r.cards[0], value: net, slot: 1, color: "text-primary" },
    { id: "sales", help: "totalSales", title: r.cards[1], value: figures.sales, slot: 2, color: "text-primary", badge: true },
    { id: "profit", help: "netProfit", title: r.cards[2], value: profit, slot: 3, color: "text-emerald-600 dark:text-emerald-400" },
    { id: "costs", help: "totalCosts", title: r.cards[3], value: costs, slot: 4, color: "text-rose-500" },
  ];

  /* `value` null: not known for a real store, and `note` says why instead of a 0 */
  const rows: { help: HelpKey; label: string; value: number | null; tone: string; slot: number; delta?: number | null; note?: string; href?: string; info?: HelpInfo }[] = [
    { help: "totalSales", label: r.rows[0], value: figures.sales, tone: "", slot: 5 },
    { help: "discounts", label: r.rows[1], value: figures.discounts, tone: "text-rose-500", slot: 6 },
    { help: "netSales", label: r.rows[2], value: net, tone: "text-emerald-600 dark:text-emerald-400", slot: 7 },
    { help: "cogs", label: r.rows[3], value: figures.cogs, tone: "text-rose-500", slot: 8 },
    { help: "shipping", label: r.rows[4], value: figures.shipping, tone: "text-rose-500", slot: 9 },
    { help: "taxes", label: r.rows[5], value: figures.taxes, tone: "text-rose-500", slot: 10 },
    { help: "fees", label: r.rows[6], value: figures.fees, tone: "text-rose-500", slot: 11 },
    { help: "totalCosts", label: r.rows[7], value: costs, tone: "text-rose-500", slot: 12 },
    { help: "netProfit", label: r.rows[8], value: profit, tone: "text-emerald-600 dark:text-emerald-400", slot: 13 },
  ];

  if (realNow && realPrev) {
    const rw = real[lang];
    /* Net sales is what customers paid (the orders' totals, after coupons); total sales is the same before coupons.
       The costs are the ones that are known: products with a cost, and delivery fees saved on the orders */
    const costsOf = (f: typeof realNow) => f.cogs + (f.shipping ?? 0);
    /* a profit that is not known (nothing sold has a cost price) has nothing to compare */
    const d = (now: number | null, before: number | null) => (now === null || before === null ? null : percentChange(now, before));
    const figuresNow = { net: realNow.sales, gross: realNow.gross, profit: realNow.profit, costs: costsOf(realNow) };
    const figuresPrev = { net: realPrev.sales, gross: realPrev.gross, profit: realPrev.profit, costs: costsOf(realPrev) };
    const keys = ["net", "gross", "profit", "costs"] as const;
    keys.forEach((k, i) => Object.assign(cards[i], { value: figuresNow[k], delta: d(figuresNow[k], figuresPrev[k]) }));
    /* what is not a sale yet, or never one, said under net sales; which products the profit comes from, under it */
    const salesNotes = [
      realNow.expected.orders ? rw.expected.replace("{n}", String(realNow.expected.orders)).replace("{amount}", money2(realNow.expected.sales)) : "",
      realNow.notCharged ? rw.notCharged.replace("{n}", String(realNow.notCharged)) : "",
    ].filter(Boolean);
    const p = realNow.products;
    Object.assign(cards[0], { info: rw.netSalesHelp, notes: salesNotes });
    /* what was paid for things with no cost price is in net sales but not in the profit: said with its amount, so net
       sales − costs − it = profit */
    const profitNotes =
      realNow.profit === null
        ? []
        : [p.withCost < p.all ? rw.profitFrom(p.withCost, p.all) : "", realNow.costless > 0 ? rw.costless(money2(realNow.costless)) : ""].filter(Boolean);
    Object.assign(cards[2], { info: rw.profitHelp, notes: profitNotes });
    const set = (i: number, value: number | null, delta: number | null, note?: string) => Object.assign(rows[i], { value, delta, note });
    set(0, realNow.gross, d(realNow.gross, realPrev.gross));
    set(1, realNow.discounts, d(realNow.discounts, realPrev.discounts));
    set(2, realNow.sales, d(realNow.sales, realPrev.sales), salesNotes.length ? salesNotes.join(" · ") : undefined);
    rows[2].info = rw.netSalesHelp;
    set(3, realNow.cogs, d(realNow.cogs, realPrev.cogs), realNow.cogsUnknown ? rw.cogsUnknown(realNow.cogsUnknown) : undefined);
    set(4, realNow.shipping, realNow.shipping === null ? null : d(realNow.shipping, realPrev.shipping ?? 0), realNow.shipping === null ? rw.shippingNone : rw.shippingPaid);
    set(5, null, null, rw.notTracked);
    set(6, null, null, rw.notTracked);
    set(7, figuresNow.costs, d(figuresNow.costs, figuresPrev.costs));
    /* the courier's real cost is not recorded, so the profit always says what it leaves out */
    if (realNow.profit === null) Object.assign(rows[8], { value: null, delta: null, note: rw.addCosts, href: "/products", info: rw.profitHelp });
    else {
      set(8, realNow.profit, d(realNow.profit, realPrev.profit), [...profitNotes, rw.courierNote].join(". "));
      rows[8].info = rw.profitHelp;
    }
  }

  const ab = abandonedFigures(range, seed, sample);
  const tourProducts = useTourProducts();
  const productNames = tourProducts.length ? tourProducts : content[lang].dashboard.products.map((p) => p.name);
  const [topOpen, setTopOpen] = useState(false);
  const abTop = Math.max(...ab.top, 1);
  const abCards: { id: WidgetId; help: HelpKey; title: string; node: React.ReactNode; color: string; slot: number; badge?: boolean }[] = [
    { id: "ab1", help: "abandoned", title: r.abandoned.cards[0], node: <AnimatedNumber value={ab.count} />, color: "text-primary", slot: 21, badge: true },
    { id: "ab2", help: "lostRevenue", title: r.abandoned.cards[1], node: <Money value={ab.lost} currency={cur} />, color: "text-rose-500", slot: 22 },
    { id: "ab3", help: "recovery", title: r.abandoned.cards[2], node: <span dir="ltr"><AnimatedNumber value={ab.rate} decimals={pctDecimals(ab.rate)} />%</span>, color: "text-emerald-600 dark:text-emerald-400", slot: 23 },
  ];

  const abandonedView = (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {abCards.map((card) => (
          <section key={card.id} className="flex min-h-[13rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
            <div className="flex items-start justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <HelpTip id={card.help} />
                {card.title}
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                <RefreshButton busy={!!busy[card.id]} onClick={() => refresh(card.id)} label={r.refresh} />
              </div>
            </div>
            <div className={`flex flex-1 flex-col items-center justify-center gap-3 transition-opacity duration-300 ${busy[card.id] ? "opacity-40" : ""}`}>
              <Delta value={change(seed, card.slot, sample)} />
              <p className={`text-4xl font-bold ${card.color}`}>{card.node}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <HelpTip id="topProducts" />
              {r.abandoned.cards[3]}
            </h3>
            <RefreshButton busy={!!busy.ab4} onClick={() => refresh("ab4")} label={r.refresh} />
          </div>
          {ab.count === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{r.abandoned.empty}</p>
          ) : (
            <ul className={`mt-5 space-y-4 transition-opacity duration-300 ${busy.ab4 ? "opacity-40" : ""}`}>
              {productNames.map((name, i) => (!topOpen && i >= SHORT_LIST ? null : (
                <li key={name}>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{name}</span>
                    <span dir="ltr" className="text-muted">{ab.top[i]}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(ab.top[i] / abTop) * 100}%` }} />
                  </div>
                </li>
              )))}
            </ul>
          )}
          {ab.count > 0 && productNames.length > SHORT_LIST && <MoreButton open={topOpen} onClick={() => setTopOpen((v) => !v)} lang={lang} />}
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <HelpTip id="recovery" />
              {r.abandoned.cards[2]}
            </h3>
            <RefreshButton busy={!!busy.ab5} onClick={() => refresh("ab5")} label={r.refresh} />
          </div>
          <div className={`mt-5 transition-opacity duration-300 ${busy.ab5 ? "opacity-40" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <Delta value={change(seed, 24, sample)} />
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400"><span dir="ltr"><AnimatedNumber value={ab.rate} decimals={pctDecimals(ab.rate)} />%</span></p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuenow={ab.rate} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(ab.rate * 4, 100)}%` }} />
            </div>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                { label: r.abandoned.rows[0], value: ab.recovered },
                { label: r.abandoned.rows[1], value: ab.reminders },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between">
                  <span className="text-muted">{row.label}</span>
                  <span className="font-bold"><AnimatedNumber value={row.value} /></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="dash min-h-screen bg-page">
      {/* TODO: the "Reports" subtab (saved reports) has no page yet, so a real store shows only "Store performance";
          the tour keeps its look */}
      <DashboardBar
        active="reports"
        subtabs={tour ? r.menu : r.menu.slice(0, 1)}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto grid max-w-[1720px] gap-6 px-5 py-8 md:px-10 lg:grid-cols-[15rem_1fr]">
        {/* Sidebar */}
        <aside className="h-fit overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-fg/10">
          <p className="bg-soft px-4 py-3 text-sm font-bold">{r.sidebarTitle}</p>
          <ul className="divide-y divide-fg/10">
            {r.sections.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setSection(i)}
                  aria-current={section === i}
                  className={`flex w-full items-center gap-2 px-4 py-3 text-start text-sm transition-colors active:bg-fg/[0.14] ${section === i ? "bg-black/[0.07] font-semibold text-fg dark:bg-white/[0.1]" : "text-muted hover:bg-fg/[0.05]"}`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
          {/* TODO: a report he creates is saved (seen-reports) but nothing reads it back or makes its file yet, so a real
              store does not get these buttons until that exists; the tour keeps its look */}
          {tour && (
            <div className="space-y-2 p-4">
              <button type="button" onClick={() => setCreating(true)} className="block w-full rounded-xl bg-ink py-2.5 text-center text-sm font-semibold text-onink transition hover:bg-deep">+ {r.createReport}</button>
              <span className="block rounded-xl border border-primary/50 py-2.5 text-center text-sm font-semibold text-primary">{r.manage}</span>
            </div>
          )}
        </aside>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {/* Date and data controls (not on a real store's Visitors report, which has its own fixed periods) */}
          {!(section === 3 && !sample) && <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={range}
                onChange={(e) => {
                  setRange(Number(e.target.value));
                  setUpdatedAt(new Date());
                }}
                aria-label={rangeText}
                className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary"
              >
                {r.ranges.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
              {/* each date kept whole and the range in the page's direction: forcing left to right broke the Arabic dates apart */}
              <span className="text-sm text-muted"><bdi>{formatDate(start)}</bdi> – <bdi>{formatDate(end)}</bdi></span>
            </div>

          </div>}


          {/* updatedAt is set once the page has read the store's numbers (or chosen the tour's): until then grey blocks,
              not the zeros it starts with, which would read as a store with no sales */}
          {!updatedAt || (needsOrders && data.state === "loading") ? (
            <div aria-busy="true" className="grid gap-6 sm:grid-cols-2">
              <p role="status" className="sr-only">{real[lang].loading}</p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex min-h-[15rem] flex-col justify-between rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
                  <Placeholder className="h-4 w-1/3" />
                  <Placeholder className="mx-auto h-14 w-1/2" />
                  <span />
                </div>
              ))}
            </div>
          ) : needsOrders && data.state === "failed" ? (
            /* the first read of the orders did not come: says so, with a way to ask again (never zeros) */
            <div role="alert" className="flex flex-col items-center rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-fg/10">
              <p className="max-w-md text-sm text-rose-600 dark:text-rose-400">{real[lang].failed}</p>
              <button type="button" onClick={() => refresh("summary")} disabled={!!busy.summary} className="mt-4 rounded-xl border border-fg/15 px-4 py-2 text-sm font-semibold transition hover:bg-soft disabled:opacity-60">
                {real[lang].retry}
              </button>
            </div>
          ) : section === 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                {cards.map((card) => (
                  <section key={card.id} className="flex min-h-[15rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        {card.info ? <HelpTip info={card.info} /> : <HelpTip id={card.help} />}
                        {card.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <RefreshButton busy={!!busy[card.id]} onClick={() => refresh(card.id)} label={r.refresh} />
                      </div>
                    </div>
                    <div className={`flex flex-1 flex-col items-center justify-center gap-3 transition-opacity duration-300 ${busy[card.id] ? "opacity-40" : ""}`}>
                      {card.value === null ? (
                        /* nothing sold has a cost price: no profit number (it would be the whole sale), a way to get one */
                        <a href="/products" className="max-w-xs text-center text-sm font-semibold text-primary hover:underline">{real[lang].addCosts}</a>
                      ) : (
                        <>
                          <Delta value={card.delta !== undefined ? card.delta : change(seed, card.slot, sample)} />
                          <p className={`text-6xl font-bold ${card.color}`}><Money value={card.value} currency={cur} /></p>
                        </>
                      )}
                      {card.notes?.map((n) => <p key={n} dir="auto" className="max-w-xs text-center text-xs text-muted">{n}</p>)}
                    </div>
                  </section>
                ))}
              </div>

              <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{r.summary}</h3>
                  <div className="flex items-center gap-3">
                    {timeText && <span dir="ltr" className="text-xs text-muted">{r.updated} {timeText}</span>}
                    <RefreshButton busy={!!busy.summary} onClick={() => refresh("summary")} label={r.refresh} />
                  </div>
                </div>
                <ul className={`mt-4 divide-y divide-fg/10 transition-opacity duration-300 ${busy.summary ? "opacity-40" : ""}`}>
                  {rows.map((row) => (
                    <li key={row.label} className="py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 font-semibold">
                          {row.info ? <HelpTip info={row.info} /> : <HelpTip id={row.help} />}
                          {row.label}
                        </span>
                        <span className="flex items-center gap-3">
                          {row.value === null && row.href ? (
                            <a href={row.href} className="min-w-[6.5rem] text-end font-semibold text-primary hover:underline">{row.note}</a>
                          ) : row.value === null ? (
                            <span className="min-w-[6.5rem] text-end font-semibold text-muted">{row.note}</span>
                          ) : (
                            <>
                              <Delta value={row.delta !== undefined ? row.delta : change(seed, row.slot, sample)} />
                              <span className={`min-w-[6.5rem] text-end font-bold ${row.tone}`}><Money value={row.value} currency={cur} /></span>
                            </>
                          )}
                        </span>
                      </div>
                      {row.value !== null && row.note && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{row.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : !sample ? (
            <RealReport section={section} data={data} span={span} prev={prevSpan} busy={busy} refresh={refresh} signedIn={signedIn} />
          ) : section === 4 ? (
            abandonedView
          ) : section === 1 || section === 2 || section === 3 || section === 5 || section === 6 ? (
            <GenericReport
              widgets={r.widgets[section === 1 ? "orders" : section === 2 ? "customers" : section === 3 ? "visits" : section === 5 ? "payments" : "inventory"]}
              section={section}
              range={range}
              seed={seed}
              sample={sample}
              busy={busy}
              refresh={refresh}
              r={r}
            />
          ) : (
            <div className="rounded-2xl bg-soft p-10 text-center font-semibold">{r.soon}</div>
          )}
        </div>
      </main>
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={createReport} noValidate role="dialog" aria-modal="true" aria-label={r.createReport} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{r.createReport}</h2>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="rep-name" className="mb-2 block text-sm font-semibold">{lang === "ar" ? "اسم التقرير" : "Report name"}</label>
                <input id="rep-name" value={reportName} onChange={(e) => { setReportName(e.target.value); setReportError(false); }} maxLength={60} placeholder={lang === "ar" ? "مثال: مبيعات الشهر" : "For example: This month's sales"} className="h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25" />
                {reportError && <p className="mt-1.5 text-xs text-rose-600">{lang === "ar" ? "اكتب اسمًا للتقرير." : "Give the report a name."}</p>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="rep-section" className="mb-2 block text-sm font-semibold">{lang === "ar" ? "نوع التقرير" : "Report type"}</label>
                  <select id="rep-section" value={reportSection} onChange={(e) => setReportSection(Number(e.target.value))} className="h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
                    {r.sections.map((name, i) => <option key={name} value={i}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="rep-range" className="mb-2 block text-sm font-semibold">{lang === "ar" ? "الفترة" : "Period"}</label>
                  <select id="rep-range" value={reportRange} onChange={(e) => setReportRange(Number(e.target.value))} className="h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
                    {r.ranges.map((name, i) => <option key={name} value={i}>{name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="rep-format" className="mb-2 block text-sm font-semibold">{lang === "ar" ? "صيغة الملف" : "File format"}</label>
                <select id="rep-format" value={reportFormat} onChange={(e) => setReportFormat(Number(e.target.value))} className="h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25">
                  {["Excel (CSV)", "PDF"].map((name, i) => <option key={name} value={i}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{r.createReport}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
            </div>
          </form>
        </div>
      )}
      {reportToast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {lang === "ar" ? "تم حفظ التقرير" : "Report saved"}
        </div>
      )}
    </div>
  );
}
