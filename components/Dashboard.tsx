"use client";

import { useCallback, useEffect, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { AnimatedNumber, Money, RefreshButton, mulberry32 } from "./Reports";
import { demoActive } from "./demoSandbox";
import { ordersCopy, type StatusKey } from "./ordersContent";
import { loadSetup } from "./setup";
import { cleanOrder, money, parseList, typedMoney } from "./records";

const TOTAL_TASKS = 6;

const icon = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-3xl bg-soft text-primary">
        <svg {...icon} className="h-9 w-9"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      </span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1 max-w-[16rem] text-sm text-muted">{hint}</p>
    </div>
  );
}

/** 950 stays 950; 1,250 becomes 1.2K; 15,300 becomes 15K; 2,400,000 becomes 2.4M. Short enough for a narrow bar. */
function short(n: number): string {
  const f = (v: number, unit: string) => `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return f(n / 1000, "K");
  return f(n / 1_000_000, "M");
}

export function Dashboard() {
  const { lang } = usePrefs();
  const h = content[lang].home;
  const r = content[lang].reports;
  const cur = r.currency;

  const [sample, setSample] = useState(false);
  /* In the platform tour everything is already made-up data, so the sample switch is not needed */
  const [tour, setTour] = useState(false);
  /* In the tour the latest orders are the same orders the Orders page lists */
  const [tourOrders, setTourOrders] = useState<{ name: string; total: string; status: StatusKey }[]>([]);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [goal, setGoal] = useState(0);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${h.pageTitle}`;
  }, [h]);

  useEffect(() => {
    const s = loadSetup();
    if (s) {
      setName(s.name);
      setDoneCount(s.done.filter(Boolean).length);
    }
    /* In the platform tour the home page starts with its sample numbers on, so it is not empty */
    if (demoActive()) {
      setSample(true);
      setTour(true);
      try {
        const list = parseList(localStorage.getItem("seen-orders"), cleanOrder);
        setTourOrders(list.sort((a, b) => b.created - a.created).slice(0, 3).map((x) => ({ name: x.customer, total: String(x.total), status: x.status })));
      } catch {
        /* the sample list stays */
      }
      /* The store in the tour already has a monthly target */
      setGoal(2500);
    }
    setNow(new Date());
  }, []);

  const refresh = useCallback((id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    window.setTimeout(() => {
      setSeed((s) => s + 1);
      setBusy((b) => ({ ...b, [id]: false }));
    }, 900);
  }, []);

  /* ---------- Chart data (all zero for a new store) ---------- */
  const today = now ?? new Date(2026, 0, 1);
  const year = today.getFullYear();
  const month = today.getMonth();
  const locale = dateLocale(lang);
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(today);
  const monthShort = (m: number) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, m, 1));

  const length = mode === "daily" ? new Date(year, month + 1, 0).getDate() : 12;
  const current = mode === "daily" ? today.getDate() - 1 : month;
  const rnd = mulberry32(seed * 9973 + (mode === "daily" ? 1 : 2));
  const sales = Array.from({ length }, (_, i) => {
    const v = Math.round((mode === "daily" ? 20 + rnd() * 140 : 600 + rnd() * 2400) * 100) / 100;
    return sample && i <= current ? v : 0;
  });
  const orders = sales.map((v) => (v ? Math.max(1, Math.round(v / (16 + rnd() * 12))) : 0));
  const netSales = sales.reduce((a, b) => a + b, 0);
  const orderTotal = orders.reduce((a, b) => a + b, 0);
  const visits = sample ? Math.round(netSales * (6 + rnd() * 3)) + 1 + Math.floor(rnd() * 8) : 0;
  const peak = Math.max(...sales, 1);
  const shown = hover ?? current;
  const label = mode === "daily" ? `${shown + 1} ${monthShort(month)}` : monthShort(shown);

  /* ---------- Smaller cards ---------- */
  const rndSmall = mulberry32(seed * 7717 + 3);
  const lastHour = Array.from({ length: 12 }, () => (sample ? Math.round(2 + rndSmall() * 14) : 0));
  const lastHourMax = Math.max(...lastHour, 1);
  const abandoned = sample ? Math.round(6 + rndSmall() * 18) : 0;
  const lost = sample ? Math.round(abandoned * (18 + rndSmall() * 14) * 100) / 100 : 0;
  const latest = tour && tourOrders.length ? tourOrders.map((x) => ({ ...x, status: ordersCopy[lang].statuses[x.status] })) : sample ? h.latestSample : [];

  const goalProgress = goal > 0 ? Math.min((netSales / goal) * 100, 100) : 0;

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="home" subtabs={[h.summaryTab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        {/* Greeting */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{name ? h.welcome.replace("{name}", name) : h.welcomeNoName}</h1>
            <p className="mt-1 text-sm text-muted">{h.welcomeSub}</p>
          </div>
        </div>

        {/* Setup progress. The tour shows a store that is already running, so it has none. */}
        {!tour && (
          <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{doneCount >= TOTAL_TASKS ? h.setupDone : h.setupTitle}</h2>
              <p dir="auto" className="mt-1 text-sm text-muted">
                {h.setupProgress.replace("{done}", String(doneCount)).replace("{total}", String(TOTAL_TASKS))}
              </p>
              <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_TASKS} aria-valuenow={doneCount}>
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(doneCount / TOTAL_TASKS) * 100}%` }} />
              </div>
            </div>
            <a href="/onboarding" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">
              {h.setupCta}
            </a>
          </section>
        )}

        {/* Month summary */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <svg {...icon} className="h-5 w-5 text-primary"><circle cx="12" cy="12" r="9" /><path d="M12 3v9h9" /></svg>
              {h.summaryTitle.replace("{month}", monthYear)}
            </h2>
            <div className="flex items-center gap-2">
              <div role="group" className="flex rounded-lg border border-fg/15 p-0.5 text-xs font-semibold">
                {(["daily", "monthly"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHover(null); }} className={`rounded-md px-3 py-1.5 transition ${mode === m ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                    {m === "daily" ? h.daily : h.monthly}
                  </button>
                ))}
              </div>
              <RefreshButton busy={!!busy.summary} onClick={() => refresh("summary")} label={r.refresh} />
            </div>
          </div>

          {/* The chart is always on the left and the figures on the right, in both languages */}
          <div dir="ltr" className={`mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] transition-opacity duration-300 ${busy.summary ? "opacity-40" : ""}`}>
            {/* Chart */}
            <div dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="rounded-xl bg-soft px-4 py-3 text-xs" dir="auto">
                <p className="font-bold">{label}</p>
                <p className="mt-1 text-muted">{h.netSales}: <span dir="ltr" className="font-semibold text-fg">{fmt(sales[shown] ?? 0)} {cur}</span></p>
                <p className="text-muted">{h.totalOrders}: <span className="font-semibold text-fg">{orders[shown] ?? 0}</span></p>
              </div>
              <div dir="ltr" className="mt-4 flex h-32 items-end gap-1" role="img" aria-label={h.chartLabel}>
                {sales.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${mode === "daily" ? i + 1 : monthShort(i)}: ${v} ${cur}`}
                    className={`flex-1 rounded-sm transition-all duration-500 ${i === shown ? "bg-deep" : i === current ? "bg-primary" : "bg-primary/35 hover:bg-primary/60"}`}
                    style={{ height: `${v ? Math.max((v / peak) * 100, 12) : 28}%`, opacity: v || i === current ? 1 : 0.55 }}
                  />
                ))}
              </div>
            </div>

            {/* Totals */}
            <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-5">
              {[
                { title: h.visits, node: <AnimatedNumber value={visits} />, ico: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" /> },
                { title: h.netSales, node: <Money value={netSales} currency={cur} />, glyph: cur },
                { title: h.orders, node: <AnimatedNumber value={orderTotal} />, ico: <path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4" /> },
              ].map((m) => (
                <div key={m.title} className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-fg/10">{"glyph" in m ? <span className="text-sm font-bold leading-none">{m.glyph}</span> : <svg {...icon}>{m.ico}</svg>}</span>
                  <div>
                    <p className="text-sm text-muted">{m.title}</p>
                    <p className="text-2xl font-bold">{m.node}</p>
                  </div>
                </div>
              ))}
              <a href="/reports" className="inline-block rounded-xl border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                {h.viewReports}
              </a>
            </div>
          </div>

          {/* Monthly goal */}
          <div className="mt-6 border-t border-fg/10 pt-5">
            {goal > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{h.goalLabel}</span>
                  <span dir="ltr" className="text-muted">{fmt(netSales)} / {fmt(goal)} {cur}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress)}>
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${goalProgress}%` }} />
                </div>
                <button type="button" onClick={() => { setGoal(0); setGoalOpen(true); }} className="mt-3 text-xs font-semibold text-primary hover:underline">{h.goalChange}</button>
              </div>
            ) : goalOpen ? (
              <form
                className="flex flex-wrap items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = money(goalText) ?? 0;
                  if (v > 0) {
                    setGoal(v);
                    setGoalOpen(false);
                    setGoalText("");
                  }
                }}
              >
                <label className="text-sm font-bold" htmlFor="goal">{h.goalLabel}</label>
                <input id="goal" value={goalText} onChange={(e) => setGoalText(typedMoney(e.target.value))} inputMode="decimal" placeholder={cur} dir="ltr" className="h-11 w-40 rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                <button type="submit" disabled={!((money(goalText) ?? 0) > 0)} className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition enabled:hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50">{h.goalSave}</button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{h.goalTitle}</p>
                  <p className="mt-1 text-sm text-muted">{h.goalHint}</p>
                </div>
                <button type="button" onClick={() => setGoalOpen(true)} className="rounded-xl border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{h.goalBtn}</button>
              </div>
            )}
          </div>
        </section>

        {/* Smaller cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{h.lastHourTitle}</h2>
              <RefreshButton busy={!!busy.hour} onClick={() => refresh("hour")} label={r.refresh} />
            </div>
            <div className={`flex flex-1 flex-col transition-opacity duration-300 ${busy.hour ? "opacity-40" : ""}`}>
              {sample ? (
                <>
                  <p className="mt-4 text-3xl font-bold"><AnimatedNumber value={lastHour.reduce((a, b) => a + b, 0)} /></p>
                  <p className="text-sm text-muted">{h.visits}</p>
                  <div dir="ltr" className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label={h.lastHourTitle}>
                    {lastHour.map((v, i) => (
                      <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <span title={v.toLocaleString("en-US")} className="max-w-full truncate text-[10px] font-bold tabular-nums text-fg/80 sm:text-[11px]">{short(v)}</span>
                        <span className="w-full rounded-sm bg-primary/70 transition-all duration-500" style={{ height: `${Math.max((v / lastHourMax) * 78, 6)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-muted">
                    <span>{lang === "ar" ? "قبل 60 د" : "60 min ago"}</span>
                    <span>{lang === "ar" ? "الآن" : "Now"}</span>
                  </div>
                </>
              ) : (
                <EmptyState title={h.empty} hint={h.emptyVisits} />
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{h.latestTitle}</h2>
              <RefreshButton busy={!!busy.orders} onClick={() => refresh("orders")} label={r.refresh} />
            </div>
            <div className={`flex flex-1 flex-col transition-opacity duration-300 ${busy.orders ? "opacity-40" : ""}`}>
              {latest.length ? (
                <ul className="mt-4 space-y-2">
                  {latest.map((o) => (
                    <li key={o.name} className="flex items-center justify-between rounded-xl bg-soft/70 px-3 py-2.5 text-sm">
                      <span className="font-semibold">{o.name}</span>
                      <span dir="ltr" className="text-muted">{o.total} {cur}</span>
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-deep dark:text-primary">{o.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={h.empty} hint={h.emptyOrders} />
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{h.cartsTitle}</h2>
              <RefreshButton busy={!!busy.carts} onClick={() => refresh("carts")} label={r.refresh} />
            </div>
            <div className={`mt-4 flex flex-1 flex-col justify-center gap-5 transition-opacity duration-300 ${busy.carts ? "opacity-40" : ""}`}>
              <div>
                <p className="text-sm text-muted">{h.cartsCount}</p>
                <p className="text-3xl font-bold text-primary"><AnimatedNumber value={abandoned} /></p>
              </div>
              <div>
                <p className="text-sm text-muted">{h.cartsLost}</p>
                <p className="text-3xl font-bold text-rose-500"><Money value={lost} currency={cur} /></p>
              </div>
              <a href="/reports?section=abandoned" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{h.cartsLink}<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
