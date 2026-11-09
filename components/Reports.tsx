"use client";

import { demoActive } from "./demoSandbox";
import { animate } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { brandName, content, type Content, type ReportWidget, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { cleanOrder, cleanProduct, parseList, type Order, type Product } from "./records";
import { cleanLine } from "./safe";
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
  type RangeKind,
  type Span,
} from "./storeNumbers";

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
      <span aria-hidden className={value < 0 ? "rotate-180" : ""}>▲</span>
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
      <span className="grid h-7 w-10 shrink-0 place-items-center rounded-md bg-white text-primary ring-1 ring-fg/10">
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
    <span className="grid h-7 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-fg/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain p-0.5" />
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
                    <p className={`text-4xl font-bold ${tone}`}><span dir="ltr"><AnimatedNumber value={d.value} decimals={1} />%</span></p>
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
                            <span className="min-w-0 truncate">{name}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 text-muted">
                            {w.kind === "breakdown" ? (numbers[w.id] ? d.rows[i].toLocaleString("en-US") : `${((d.rows[i] / total) * 100).toFixed(1)}%`) : w.kind === "ratelist" ? `${d.rows[i]}%` : d.rows[i]}
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

type StoreData = { orders: Order[]; products: Product[] };

const real = {
  en: {
    notTracked: "Not tracked yet",
    noCompare: "No earlier sales to compare with",
    visitsNote: "Dukkan does not count store visits yet, so there is nothing to show here. Your orders, customers and stock are in the other reports.",
    cartsNote: "Dukkan does not keep the carts customers leave yet, so there is nothing to show here.",
    cogsUnknown: (n: number) => `${n === 1 ? "1 sold item has" : `${n} sold items have`} no known cost (no cost on the product, or the product was deleted), so ${n === 1 ? "it is" : "they are"} left out.`,
    profitHigh: "Some sold items have no cost on their product, so the real profit is lower than this.",
    shippingNone: "Not saved on these orders",
    orders: { title: "Orders", desc: "Every order placed in the period, whatever its status." },
    average: { title: "Average order", desc: "What an order brought in on average, without cancelled or refunded ones.", formula: ["Average order", "=", "Net sales", "÷", "Orders"] },
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
    methods: { title: "Payment methods used", desc: "How the period's paid orders were paid, by number of orders and amount." },
    pays: { card: "Card", cliq: "CliQ", cash: "Cash on delivery", none: "Not recorded (added by hand)" },
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
    noCompare: "لا توجد مبيعات سابقة للمقارنة",
    visitsNote: "لا يحسب دكان زيارات المتجر بعد، فلا يوجد ما يُعرض هنا. طلباتك وعملاؤك ومخزونك في التقارير الأخرى.",
    cartsNote: "لا يحفظ دكان السلات التي يتركها العملاء بعد، فلا يوجد ما يُعرض هنا.",
    cogsUnknown: (n: number) => `${n === 1 ? "قطعة مباعة واحدة تكلفتها" : `${n} من القطع المباعة تكلفتها`} غير معروفة (لا تكلفة على المنتج، أو حُذف المنتج)، فلم تُحسب.`,
    profitHigh: "بعض القطع المباعة لا تكلفة على منتجها، فالربح الحقيقي أقل من هذا.",
    shippingNone: "غير محفوظة على هذه الطلبات",
    orders: { title: "الطلبات", desc: "كل الطلبات التي وصلت خلال الفترة، أيًّا كانت حالتها." },
    average: { title: "متوسط الطلب", desc: "ما جلبه الطلب الواحد في المتوسط، دون الطلبات الملغاة أو المستردة.", formula: ["متوسط الطلب", "=", "صافي المبيعات", "÷", "الطلبات"] },
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
    methods: { title: "طرق الدفع المستخدمة", desc: "كيف دُفعت طلبات الفترة، بعدد الطلبات والمبلغ." },
    pays: { card: "بطاقة", cliq: "كليك", cash: "الدفع عند الاستلام", none: "غير مسجّلة (أُضيفت يدويًا)" },
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
      <p className={`text-end text-4xl font-bold ${tone}`}><span dir="ltr"><AnimatedNumber value={value} decimals={1} />%</span></p>
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
                  <span dir="auto" className="min-w-0 truncate">{row.label}</span>
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

function RealReport({ section, data, span, prev, busy, refresh }: { section: number; data: StoreData; span: Span; prev: Span; busy: Partial<Record<string, boolean>>; refresh: (id: string) => void }) {
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

  if (section === 3) return <NotTrackedPanel note={w.visitsNote} />;
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
        {card("ro-all", w.orders, <Stat delta={percentChange(o.all, before.all)}><span dir="ltr"><AnimatedNumber value={o.all} /></span></Stat>)}
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
                <a href="/products" dir="auto" className="min-w-0 truncate font-semibold hover:text-primary hover:underline">{x.name}</a>
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  /* A real store's own orders and products, read again by each refresh button and when the range changes */
  const [data, setData] = useState<StoreData>({ orders: [], products: [] });
  const readData = useCallback(() => {
    try {
      setData({ orders: parseList(localStorage.getItem("seen-orders"), cleanOrder), products: parseList(localStorage.getItem("seen-products"), cleanProduct) });
    } catch {
      /* storage blocked: nothing to count */
    }
  }, []);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${r.menu[0]}`;
  }, [r]);

  useEffect(() => {
    if (demoActive()) {
      setSample(true);
      setTour(true);
    } else readData();
    setUpdatedAt(new Date());
  }, [readData]);

  const figures = sample ? sampleFigures(range, seed) : ZERO;
  const { net, costs, profit } = derive(figures);
  const cur = r.currency;

  /* Each refresh button reloads its widget: it spins, then new numbers arrive (the tour draws new sample ones, a real
     store reads its orders and products again) */
  const refresh = useCallback((id: WidgetId) => {
    setBusy((b) => ({ ...b, [id]: true }));
    window.setTimeout(() => {
      setSeed((s) => s + 1);
      if (!demoActive()) readData();
      setUpdatedAt(new Date());
      setBusy((b) => ({ ...b, [id]: false }));
    }, 900);
  }, [readData]);

  /* A real store's sales, and the same days just before to compare with (storeNumbers.ts) */
  const at = updatedAt ?? new Date();
  const span = rangeSpan(range as RangeKind, at);
  const prevSpan = previousSpan(range as RangeKind, at);
  const realNow = sample ? null : salesFigures(data.orders, data.products, span);
  const realPrev = sample ? null : salesFigures(data.orders, data.products, prevSpan);

  /* A report he sets up is kept in this browser as a saved definition (nothing is sent anywhere) */
  const createReport = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cleanLine(reportName, 60);
    if (name.length < 2) return setReportError(true);
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
  const cards: { id: WidgetId; help: HelpKey; title: string; value: number; slot: number; color: string; badge?: boolean; delta?: number | null }[] = [
    { id: "net", help: "netSales", title: r.cards[0], value: net, slot: 1, color: "text-primary" },
    { id: "sales", help: "totalSales", title: r.cards[1], value: figures.sales, slot: 2, color: "text-primary", badge: true },
    { id: "profit", help: "netProfit", title: r.cards[2], value: profit, slot: 3, color: "text-emerald-600 dark:text-emerald-400" },
    { id: "costs", help: "totalCosts", title: r.cards[3], value: costs, slot: 4, color: "text-rose-500" },
  ];

  /* `value` null: not known for a real store, and `note` says why instead of a 0 */
  const rows: { help: HelpKey; label: string; value: number | null; tone: string; slot: number; delta?: number | null; note?: string }[] = [
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
    const d = (now: number, before: number) => percentChange(now, before);
    const figuresNow = { net: realNow.sales, gross: realNow.gross, profit: realNow.profit, costs: costsOf(realNow) };
    const figuresPrev = { net: realPrev.sales, gross: realPrev.gross, profit: realPrev.profit, costs: costsOf(realPrev) };
    const keys = ["net", "gross", "profit", "costs"] as const;
    keys.forEach((k, i) => Object.assign(cards[i], { value: figuresNow[k], delta: d(figuresNow[k], figuresPrev[k]) }));
    const set = (i: number, value: number | null, delta: number | null, note?: string) => Object.assign(rows[i], { value, delta, note });
    set(0, realNow.gross, d(realNow.gross, realPrev.gross));
    set(1, realNow.discounts, d(realNow.discounts, realPrev.discounts));
    set(2, realNow.sales, d(realNow.sales, realPrev.sales));
    set(3, realNow.cogs, d(realNow.cogs, realPrev.cogs), realNow.cogsUnknown ? rw.cogsUnknown(realNow.cogsUnknown) : undefined);
    set(4, realNow.shipping, realNow.shipping === null ? null : d(realNow.shipping, realPrev.shipping ?? 0), realNow.shipping === null ? rw.shippingNone : undefined);
    set(5, null, null, rw.notTracked);
    set(6, null, null, rw.notTracked);
    set(7, figuresNow.costs, d(figuresNow.costs, figuresPrev.costs));
    set(8, realNow.profit, d(realNow.profit, realPrev.profit), realNow.cogsUnknown ? rw.profitHigh : undefined);
  }

  const ab = abandonedFigures(range, seed, sample);
  const tourProducts = useTourProducts();
  const productNames = tourProducts.length ? tourProducts : content[lang].dashboard.products.map((p) => p.name);
  const [topOpen, setTopOpen] = useState(false);
  const abTop = Math.max(...ab.top, 1);
  const abCards: { id: WidgetId; help: HelpKey; title: string; node: React.ReactNode; color: string; slot: number; badge?: boolean }[] = [
    { id: "ab1", help: "abandoned", title: r.abandoned.cards[0], node: <AnimatedNumber value={ab.count} />, color: "text-primary", slot: 21, badge: true },
    { id: "ab2", help: "lostRevenue", title: r.abandoned.cards[1], node: <Money value={ab.lost} currency={cur} />, color: "text-rose-500", slot: 22 },
    { id: "ab3", help: "recovery", title: r.abandoned.cards[2], node: <span dir="ltr"><AnimatedNumber value={ab.rate} decimals={1} />%</span>, color: "text-emerald-600 dark:text-emerald-400", slot: 23 },
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
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400"><span dir="ltr"><AnimatedNumber value={ab.rate} decimals={1} />%</span></p>
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
          {/* Date and data controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={range}
                onChange={(e) => {
                  setRange(Number(e.target.value));
                  if (!tour) readData();
                  setUpdatedAt(new Date());
                }}
                aria-label={rangeText}
                className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary"
              >
                {r.ranges.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
              <span dir="ltr" className="text-sm text-muted">{rangeText}</span>
            </div>

          </div>


          {section === 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                {cards.map((card) => (
                  <section key={card.id} className="flex min-h-[15rem] flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <HelpTip id={card.help} />
                        {card.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <RefreshButton busy={!!busy[card.id]} onClick={() => refresh(card.id)} label={r.refresh} />
                      </div>
                    </div>
                    <div className={`flex flex-1 flex-col items-center justify-center gap-3 transition-opacity duration-300 ${busy[card.id] ? "opacity-40" : ""}`}>
                      <Delta value={card.delta !== undefined ? card.delta : change(seed, card.slot, sample)} />
                      <p className={`text-6xl font-bold ${card.color}`}><Money value={card.value} currency={cur} /></p>
                      {card.id === "profit" && realNow?.cogsUnknown ? <p className="max-w-xs text-center text-xs text-amber-700 dark:text-amber-300">{real[lang].profitHigh}</p> : null}
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
                          <HelpTip id={row.help} />
                          {row.label}
                        </span>
                        <span className="flex items-center gap-3">
                          {row.value === null ? (
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
            <RealReport section={section} data={data} span={span} prev={prevSpan} busy={busy} refresh={refresh} />
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
