"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { loadMaintenance, MAINTENANCE_MAX, maintenanceDefault, saveMaintenance, type Maintenance } from "./maintenance";

const words = {
  en: {
    title: "Store status",
    open: "Your store is open to visitors.",
    paused: "Your store is paused. Visitors see a maintenance page instead of it.",
    toggle: "Store open",
    message: "Message on the maintenance page",
    hint: "Leave it empty to use the usual message.",
    see: "See the maintenance page",
  },
  ar: {
    title: "حالة المتجر",
    open: "متجرك مفتوح للزوار.",
    paused: "متجرك متوقف مؤقتًا. يرى الزوار صفحة صيانة بدلًا منه.",
    toggle: "المتجر مفتوح",
    message: "رسالة صفحة الصيانة",
    hint: "اتركها فارغة لاستخدام الرسالة المعتادة.",
    see: "عرض صفحة الصيانة",
  },
};

/** The dashboard's switch to pause the store (a maintenance page for visitors) and open it again */
export function StoreStatus({ lang, className = "" }: { lang: Lang; className?: string }) {
  const w = words[lang];
  const [m, setM] = useState<Maintenance | null>(null);
  useEffect(() => setM(loadMaintenance()), []);
  if (!m) return null;
  const set = (next: Maintenance) => {
    setM(next);
    saveMaintenance(next);
  };
  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-bold">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${m.on ? "bg-amber-500" : "bg-emerald-500"}`} />
            {w.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{m.on ? w.paused : w.open}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <span className="text-sm font-semibold">{w.toggle}</span>
          <input type="checkbox" role="switch" checked={!m.on} onChange={(e) => set({ ...m, on: !e.target.checked })} className="peer sr-only" />
          <span aria-hidden dir="ltr" className="relative h-6 w-11 shrink-0 rounded-full bg-amber-500 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
          </span>
        </label>
      </div>
      {m.on && (
        <div className="mt-4 space-y-2 border-t border-fg/10 pt-4">
          <label htmlFor="maintenance-message" className="block text-sm font-semibold">{w.message}</label>
          <textarea
            id="maintenance-message"
            value={m.message[lang]}
            onChange={(e) => set({ ...m, message: { ...m.message, [lang]: e.target.value } })}
            placeholder={maintenanceDefault[lang].message}
            rows={2}
            maxLength={MAINTENANCE_MAX}
            className="w-full resize-none rounded-xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{w.hint}</p>
            <Link href="/store" target="_blank" className="text-sm font-semibold text-primary hover:underline">{w.see}</Link>
          </div>
        </div>
      )}
    </section>
  );
}
