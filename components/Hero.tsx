"use client";

import { motion } from "framer-motion";
import { usePrefs } from "./Prefs";

const orders = [
  { name: "Layla A.", total: "JOD 128", status: "Paid", tone: "bg-emerald-100 text-emerald-700" },
  { name: "Omar K.", total: "JOD 245", status: "Pending", tone: "bg-amber-100 text-amber-700" },
  { name: "Noor S.", total: "JOD 96", status: "Shipped", tone: "bg-indigo-100 text-indigo-700" },
];

const products = [
  { name: "Daily Backpack", price: "JOD 34", color: "from-indigo-400 to-indigo-600" },
  { name: "Steel Bottle", price: "JOD 11", color: "from-sky-300 to-sky-500" },
  { name: "Utility Jacket", price: "JOD 62", color: "from-teal-400 to-teal-600" },
  { name: "Canvas Cap", price: "JOD 14", color: "from-orange-300 to-rose-400" },
];

const bars = [30, 45, 38, 60, 52, 75, 68, 90];

export function Hero() {
  const { t } = usePrefs();
  return (
    <section className="relative overflow-hidden bg-soft">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-deep dark:text-indigo-200 shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t.badge}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl"
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
            <a href="#" className="rounded-xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep">
              {t.cta1}
            </a>
            <a href="#solutions" className="rounded-xl border border-fg/20 px-6 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:bg-card">
              {t.cta2}
            </a>
          </motion.div>
          <p className="mt-6 text-sm text-muted">{t.note}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
          className="relative"
        >
          {/* Dashboard card */}
          <div className="rounded-3xl bg-card p-5 shadow-[0_30px_80px_-20px_rgba(55,48,163,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Revenue this month</p>
                <p className="text-2xl font-extrabold">JOD 48,339</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">+18%</span>
            </div>
            <div className="mt-4 flex h-28 items-end gap-2">
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.9, delay: 0.6 + i * 0.07, ease: "easeOut" }}
                  className="flex-1 rounded-t-md bg-primary/85"
                />
              ))}
            </div>
            <ul className="mt-5 space-y-2">
              {orders.map((o) => (
                <li key={o.name} className="flex items-center justify-between rounded-xl bg-soft/70 px-3 py-2.5 text-sm">
                  <span className="font-semibold">{o.name}</span>
                  <span className="text-muted">{o.total}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${o.tone}`}>{o.status}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Floating storefront card */}
          <div className="animate-floaty absolute -bottom-10 -end-2 hidden w-56 rounded-2xl bg-card p-3 shadow-[0_20px_50px_-15px_rgba(20,18,58,0.35)] sm:block">
            <p className="mb-2 text-xs font-bold text-muted">Your store</p>
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => (
                <div key={p.name}>
                  <div className={`h-16 rounded-lg bg-gradient-to-br ${p.color}`} />
                  <p className="mt-1 truncate text-[11px] font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted">{p.price}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
