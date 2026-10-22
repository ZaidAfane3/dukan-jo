"use client";

import { demoActive } from "./demoSandbox";
import { animate } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { brandName, content, type Content, type ReportWidget, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";

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
      const list = JSON.parse(localStorage.getItem("seen-products") ?? "[]") as { name: string; deletedAt?: number; hidden?: boolean }[];
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

function Delta({ value }: { value: number }) {
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

  useEffect(() => {
    document.title = `${brandName(lang)} | ${r.menu[0]}`;
  }, [r]);

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

  /* Each refresh button reloads its widget: it spins, then new numbers arrive. */
  const refresh = useCallback((id: WidgetId) => {
    setBusy((b) => ({ ...b, [id]: true }));
    window.setTimeout(() => {
      setSeed((s) => s + 1);
      setUpdatedAt(new Date());
      setBusy((b) => ({ ...b, [id]: false }));
    }, 900);
  }, []);

  /* A report he sets up is kept in this browser as a saved definition (nothing is sent anywhere) */
  const createReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportName.trim().length < 2) return setReportError(true);
    try {
      const list = JSON.parse(localStorage.getItem("seen-reports") ?? "[]") as unknown[];
      list.unshift({ id: Date.now(), name: reportName.trim(), section: reportSection, range: reportRange, format: reportFormat });
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

  const toggleSample = () => {
    setSample((s) => !s);
    setUpdatedAt(new Date());
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

  const cards: { id: WidgetId; help: HelpKey; title: string; value: number; slot: number; color: string; badge?: boolean }[] = [
    { id: "net", help: "netSales", title: r.cards[0], value: net, slot: 1, color: "text-primary" },
    { id: "sales", help: "totalSales", title: r.cards[1], value: figures.sales, slot: 2, color: "text-primary", badge: true },
    { id: "profit", help: "netProfit", title: r.cards[2], value: profit, slot: 3, color: "text-emerald-600 dark:text-emerald-400" },
    { id: "costs", help: "totalCosts", title: r.cards[3], value: costs, slot: 4, color: "text-rose-500" },
  ];

  const rows: { help: HelpKey; label: string; value: number; tone: string; slot: number }[] = [
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
      <DashboardBar
        active="reports"
        subtabs={r.menu}
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
          <div className="space-y-2 p-4">
            <button type="button" onClick={() => setCreating(true)} className="block w-full rounded-xl bg-ink py-2.5 text-center text-sm font-semibold text-onink transition hover:bg-deep">+ {r.createReport}</button>
            <span className="block rounded-xl border border-primary/50 py-2.5 text-center text-sm font-semibold text-primary">{r.manage}</span>
          </div>
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

            {!tour && <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              {r.sampleToggle}
              <button
                type="button"
                role="switch"
                aria-checked={sample}
                onClick={toggleSample}
                className={`relative h-6 w-11 rounded-full transition-colors ${sample ? "bg-primary" : "bg-fg/20"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sample ? "start-[1.375rem]" : "start-0.5"}`} />
              </button>
            </label>}
          </div>

          {sample && !tour && <p className="rounded-xl bg-primary/15 px-4 py-2 text-center text-sm font-medium text-deep dark:text-primary">{r.sampleNote}</p>}

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
                      <Delta value={change(seed, card.slot, sample)} />
                      <p className={`text-6xl font-bold ${card.color}`}><Money value={card.value} currency={cur} /></p>
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
                    <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <HelpTip id={row.help} />
                        {row.label}
                      </span>
                      <span className="flex items-center gap-3">
                        <Delta value={change(seed, row.slot, sample)} />
                        <span className={`min-w-[6.5rem] text-end font-bold ${row.tone}`}><Money value={row.value} currency={cur} /></span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
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
