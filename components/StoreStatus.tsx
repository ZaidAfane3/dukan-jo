"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { loadMaintenance, saveMaintenance, type Maintenance } from "./maintenance";

const words = {
  en: {
    open: "Store open",
    paused: "Store under maintenance",
    openHint: "Visitors can see your store.",
    pausedHint: "Visitors see a maintenance page.",
    see: "See what visitors see",
  },
  ar: {
    open: "المتجر مفتوح",
    paused: "المتجر قيد الصيانة",
    openHint: "يستطيع الزوار رؤية متجرك.",
    pausedHint: "يرى الزوار صفحة الصيانة.",
    see: "عرض ما يراه الزوار",
  },
};

/** The profile menu's switch to put the store under maintenance and open it again. Visitors of a paused store see
    Dukkan's own "under maintenance" page (MaintenancePage.tsx); the merchant can't write his own text on it. */
export function StoreStatus({ lang, disabled = false, disabledTitle, onLink }: { lang: Lang; disabled?: boolean; disabledTitle?: string; onLink?: () => void }) {
  const w = words[lang];
  const [m, setM] = useState<Maintenance | null>(null);
  useEffect(() => setM(loadMaintenance()), []);
  if (!m) return null;
  const open = !m.on;
  const flip = () => {
    if (disabled) return;
    const next = { on: open, message: { en: "", ar: "" } };
    setM(next);
    saveMaintenance(next);
  };
  return (
    <div className="px-5 py-3.5">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={open}
        aria-disabled={disabled || undefined}
        title={disabled ? disabledTitle : undefined}
        onClick={flip}
        className={`flex w-full items-center justify-between gap-3 text-start text-sm ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${open ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="min-w-0">
            <span className="block font-semibold">{open ? w.open : w.paused}</span>
            <span className="block text-xs text-muted">{open ? w.openHint : w.pausedHint}</span>
          </span>
        </span>
        <span aria-hidden dir="ltr" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${open ? "bg-emerald-500" : "bg-amber-500"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${open ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
      {!open && !disabled && (
        <Link href="/store" target="_blank" onClick={onLink} className="ms-5 mt-1.5 inline-block text-xs font-semibold text-primary hover:underline">
          {w.see}
        </Link>
      )}
    </div>
  );
}
