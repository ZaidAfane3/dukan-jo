"use client";

import type { Ref } from "react";
import type { Lang } from "../content";
import { dc } from "./copy";

const own = {
  en: { gone: (name?: string) => (name ? `${name} and its settings will be removed.` : "It will be removed with its settings.") },
  ar: { gone: (name?: string) => (name ? `سيُحذف «${name}» مع كل إعداداته.` : "سيُحذف مع كل إعداداته.") },
};

/** Asking before an element is deleted: a small card with a trash icon, what goes, and Cancel / Yes, delete side by side */
export function DeleteAsk({ lang, name, onYes, onNo, boxRef, inRow = false }: { lang: Lang; name?: string; onYes: () => void; onNo: () => void; boxRef?: Ref<HTMLDivElement>; /* under a row of the elements list: no rounded top, it hangs from the row */ inRow?: boolean }) {
  const t = dc[lang];
  return (
    <div ref={boxRef} role="alertdialog" aria-label={t.deleteAsk} className={`border border-rose-500/25 bg-rose-500/[0.06] p-3 ${inRow ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-bold leading-snug">{t.deleteAsk}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{own[lang].gone(name)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onNo} className="h-10 rounded-xl border border-fg/15 bg-card text-sm font-semibold transition hover:bg-soft">{t.cancel}</button>
        <button type="button" onClick={onYes} className="h-10 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700">{t.deleteYes}</button>
      </div>
    </div>
  );
}
