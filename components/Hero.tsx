"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { brandName, content } from "./content";
import { usePrefs } from "./Prefs";
import { Tilt } from "./ui";

const bars = [38, 26, 31, 22, 62, 50, 36, 47, 66, 52, 62, 82, 100];

/* Text inside the dashboard picture. */
const preview = {
  en: {
    nav: ["Home", "Orders", "Products", "Marketing", "More"],
    summary: "October sales summary",
    visits: "Visits",
    sales: "Sales",
    orders: "Orders",
    more: "More reports",
    goal: "Monthly goal",
    ordersTitle: "Orders",
    newBadge: "New",
    cur: "JOD",
    statuses: [
      { label: "Awaiting review", dot: "bg-rose-500" },
      { label: "Awaiting payment", dot: "bg-amber-500" },
      { label: "Processing", dot: "bg-sky-500" },
    ],
    names: ["Layla A.", "Omar K.", "Noor S.", "Sara M.", "Yazan H.", "Huda R.", "Khaled B."],
    times: ["Just now", "1 min ago", "23 min ago"],
  },
  ar: {
    nav: ["الرئيسية", "الطلبات", "المنتجات", "التسويق", "المزيد"],
    summary: "ملخص مبيعات أكتوبر",
    visits: "الزيارات",
    sales: "المبيعات",
    orders: "الطلبات",
    more: "المزيد من التقارير",
    goal: "هدف الشهر",
    ordersTitle: "الطلبات",
    newBadge: "جديد",
    cur: "د.أ",
    statuses: [
      { label: "بانتظار المراجعة", dot: "bg-rose-500" },
      { label: "بانتظار الدفع", dot: "bg-amber-500" },
      { label: "قيد التنفيذ", dot: "bg-sky-500" },
    ],
    names: ["ليلى أ.", "عمر ك.", "نور س.", "سارة م.", "يزن ح.", "هدى ر.", "خالد ب."],
    times: ["الآن", "منذ دقيقة", "منذ 23 دقيقة"],
  },
};

const avatarHues = ["from-[#73e7cb] to-[#348d9c]", "from-[#f7f1ea] to-[#d9c9b5]", "from-[#348d9c] to-[#004956]"];

/* One digit that rolls like a combination lock: when it changes, the new digit slides up
   from below, always upward (9 to 0 keeps rolling the same way). */
const reel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Digit({ d }: { d: number }) {
  const [pos, setPos] = useState(d);
  const [instant, setInstant] = useState(false);
  const prev = useRef(d);

  useEffect(() => {
    if (d === prev.current) return;
    const step = (d - prev.current + 10) % 10;
    prev.current = d;
    setInstant(false);
    setPos((p) => p + step);
  }, [d]);

  return (
    <span className="relative inline-block h-[1.25em] overflow-hidden align-bottom leading-[1.25em]">
      {/* The widest digit sets the width, so the number does not wobble while it rolls. */}
      <span className="invisible">0</span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col"
        style={{ transform: `translateY(-${pos * 1.25}em)`, transition: instant ? "none" : "transform 1.8s cubic-bezier(0.3, 0.7, 0.2, 1)" }}
        onTransitionEnd={() => {
          if (pos >= 10) {
            setInstant(true);
            setPos(pos % 10);
          }
        }}
      >
        {reel.map((n, i) => (
          <span key={i} className="block h-[1.25em] text-center">{n}</span>
        ))}
      </span>
    </span>
  );
}

/* A number made of rolling digits. Commas and the decimal point stay still. */
function Roll({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const text = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const chars = text.split("");
  return (
    <span dir="ltr" className="inline-flex" aria-label={text}>
      {chars.map((ch, i) => {
        const fromEnd = chars.length - i; /* keep each digit's column when the number gets longer */
        return /\d/.test(ch) ? <Digit key={`d${fromEnd}`} d={Number(ch)} /> : <span key={`s${fromEnd}`}>{ch}</span>;
      })}
    </span>
  );
}

const GOAL = 56000;
const START = { visits: 12480, sales: 48339, orders: 692 };

export function Hero() {
  const { lang, t } = usePrefs();
  const d = content[lang].dashboard;
  const pv = preview[lang];

  /* A new order drops in at the top every few seconds, with the "new" badge. */
  type Row = { key: number; name: number; id: number; status: number; amount: number; isNew: boolean };
  const [rows, setRows] = useState<Row[]>([
    { key: 3, name: 0, id: 1042, status: 0, amount: 128, isNew: true },
    { key: 2, name: 1, id: 1041, status: 1, amount: 245, isNew: false },
    { key: 1, name: 2, id: 1040, status: 2, amount: 96, isNew: false },
  ]);
  const [totals, setTotals] = useState(START);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useRef(true);
  const counter = useRef(3);
  const goalPct = Math.min(100, Math.round((totals.sales / GOAL) * 1000) / 10);
  /* Only run while the picture is on screen, so a tab left open does not keep counting. */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => (inView.current = entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.hidden || !inView.current) return;
      counter.current += 1;
      const n = counter.current;
      /* Keys only need to be unique. The shown order number and name cycle, so they never run away. */
      const order = { key: n, name: n % pv.names.length, id: 1040 + (n % 900), status: Math.floor(Math.random() * 3), amount: 40 + Math.floor(Math.random() * 40) * 5, isNew: true };
      setRows((prev) => [order, ...prev.slice(0, 2).map((r) => ({ ...r, isNew: false }))]);
      /* The board follows the new order: sales, order count, visits and the monthly goal. */
      setTotals((t) => {
        const sales = t.sales + order.amount;
        /* The month goal is reached: start a new "month" so the numbers never grow without end. */
        if (sales >= GOAL) return START;
        return { sales, orders: t.orders + 1, visits: t.visits + 1 + Math.floor(Math.random() * 4) };
      });
    }, 5000);
    return () => clearInterval(id);
  }, [pv.names.length]);
  return (
    <section className="relative overflow-hidden bg-soft">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
          >
            {t.h1a}<span className="text-primary">{t.h1b}</span>{t.h1c}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-muted"
          >
            {t.sub}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <a href="/signup" className="rounded-xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep">
              {t.cta1}
            </a>
            <a href="/demo" className="rounded-xl border border-fg/20 px-6 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:bg-card">
              {t.cta2}
            </a>
          </motion.div>
          <p className="mt-6 text-base font-medium text-muted">{t.note}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
          ref={stage}
          className="relative"
        >
          <Tilt max={20}>
          {/* Dashboard picture: top bar, sales summary with chart, latest orders */}
          <div className="overflow-hidden rounded-3xl bg-card shadow-[0_30px_80px_-20px_rgba(0,73,86,0.30)] ring-1 ring-fg/10">
            <div className="flex items-center gap-1 bg-[#00323b] px-4 py-2.5 text-[11px] font-medium text-white/80">
              <span className="me-2 inline-flex items-center gap-1.5 font-extrabold text-white">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-[#96edd9] text-[#00323b]">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                    <path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
                  </svg>
                </span>
                {brandName(lang)}
              </span>
              {pv.nav.map((n, i) => (
                <span key={n} className={`rounded-md px-2.5 py-1 ${i === 0 ? "bg-[#c1fdf6] font-bold text-[#00323b]" : ""}`}>{n}</span>
              ))}
            </div>

            <div className="space-y-3 bg-[#f3f4f4] p-3 dark:bg-black/20">
              {/* Summary */}
              <div className="grid overflow-hidden rounded-2xl bg-card sm:grid-cols-[0.9fr_1.1fr] sm:rtl:grid-cols-[1.1fr_0.9fr]">
                <div className="flex h-36 items-end gap-1.5 bg-[#e1f5f2] p-3 dark:bg-primary/10 sm:h-auto rtl:order-last">
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.9, delay: 0.6 + i * 0.06, ease: "easeOut" }}
                      className="flex-1 rounded-t-[3px] bg-[#348d9c]"
                    />
                  ))}
                </div>
                <div className="p-4 text-xs">
                  <p className="text-sm font-bold">{pv.summary}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
                    {[
                      { k: pv.visits, v: <Roll value={totals.visits} />, icon: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" /> },
                      { k: pv.sales, v: <Roll value={totals.sales} />, glyph: pv.cur },
                      { k: pv.orders, v: <Roll value={totals.orders} />, icon: <path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4" /> },
                    ].map((m) => (
                      <div key={m.k} className="flex items-center gap-2.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-fg/10">
                          {m.glyph ? (
                            <span className="text-[11px] font-bold leading-none">{m.glyph}</span>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{m.icon}</svg>
                          )}
                        </span>
                        <span>
                          <span className="block text-muted">{m.k}</span>
                          <span className="block text-base font-extrabold" dir="ltr">{m.v}</span>
                        </span>
                      </div>
                    ))}
                    <p className="self-center text-[11px] font-semibold text-primary">{pv.more} ›</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px]">
                    <span dir="ltr" className="text-muted">{GOAL.toLocaleString("en-US")} {pv.cur}</span>
                    <span className="font-bold" dir="ltr">{pv.goal} <Roll value={goalPct} decimals={1} />%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${goalPct}%` }} transition={{ duration: 1, delay: counter.current > 3 ? 0 : 0.9, ease: "easeOut" }} className="h-full rounded-full bg-[#348d9c]" />
                  </div>
                </div>
              </div>

              {/* Latest orders */}
              <div className="rounded-2xl bg-card p-3">
                <p className="px-1 pb-2 text-sm font-bold">{pv.ordersTitle}</p>
                <ul className="space-y-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {rows.map((r, i) => {
                      const st = pv.statuses[r.status];
                      const name = pv.names[r.name];
                      return (
                        <motion.li
                          key={r.key}
                          layout
                          initial={{ opacity: 0, y: -28, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94 }}
                          transition={{ type: "spring", stiffness: 260, damping: 26 }}
                          className="flex items-center gap-3 rounded-xl border border-fg/10 bg-card px-3 py-2.5 text-xs shadow-sm"
                        >
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-extrabold text-white ${avatarHues[r.name % avatarHues.length]}`}>{name.charAt(0)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold">{name}</span>
                              {r.isNew && <span className="rounded-full border border-rose-400 px-2 text-[10px] font-semibold text-rose-500">{pv.newBadge}</span>}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                              <span dir="ltr">#{r.id}</span>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </span>
                          <span className="text-end">
                            <span dir="ltr" className="block text-sm font-extrabold">{r.amount} <small className="text-[10px] font-semibold opacity-70">{pv.cur}</small></span>
                            <span className="text-[10px] text-muted">{pv.times[i]}</span>
                          </span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </div>

          </Tilt>
        </motion.div>
      </div>
    </section>
  );
}
