"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "./Prefs";
import { SAVE_REFUSED } from "./serverSync";

/* Says so when the server refused to keep a change for good (serverSync.ts SAVE_REFUSED): the page already shows the
   change, so without this the merchant would think it was saved. A suspended store is sent to its own page, so only
   these are said here. Shown on every merchant page, the store designer too (mounted by DemoBoot). */

const words = {
  en: {
    "too-big": "Some changes were not saved: your store has run out of space. Remove some products or pictures, then try again.",
    "media-full": "A picture was not saved: your store's space for pictures is full. Remove some pictures, then try again.",
    invalid: "Some changes could not be saved. Reload the page and try again.",
    "slug-taken": "Your store link was not saved: another store already uses it. Choose another link.",
    "slug-reserved": "Your store link was not saved: this name is reserved. Choose another link.",
    close: "Close",
  },
  ar: {
    "too-big": "لم تُحفظ بعض التعديلات: امتلأت مساحة متجرك. احذف بعض المنتجات أو الصور ثم حاول مرة أخرى.",
    "media-full": "لم تُحفظ إحدى الصور: امتلأت مساحة الصور في متجرك. احذف بعض الصور ثم حاول مرة أخرى.",
    invalid: "تعذّر حفظ بعض التعديلات. أعد تحميل الصفحة وحاول مرة أخرى.",
    "slug-taken": "لم يُحفظ رابط متجرك: متجر آخر يستخدمه. اختر رابطًا آخر.",
    "slug-reserved": "لم يُحفظ رابط متجرك: هذا الاسم محجوز. اختر رابطًا آخر.",
    close: "إغلاق",
  },
};

type Why = Exclude<keyof (typeof words)["en"], "close">;
const said = (v: unknown): v is Why => typeof v === "string" && v !== "close" && v in words.en;

export function SaveNotice() {
  const { lang } = usePrefs();
  const [why, setWhy] = useState<Why | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<unknown>).detail;
      if (said(d)) setWhy(d);
    };
    window.addEventListener(SAVE_REFUSED, on);
    return () => window.removeEventListener(SAVE_REFUSED, on);
  }, []);

  if (!why) return null;
  const w = words[lang];
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/15">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <p className="min-w-0 flex-1 leading-relaxed">{w[why]}</p>
      <button type="button" onClick={() => setWhy(null)} aria-label={w.close} title={w.close} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition hover:bg-white/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
