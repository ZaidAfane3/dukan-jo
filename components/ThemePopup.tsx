"use client";

import { useEffect } from "react";
import { usePrefs } from "./Prefs";
import type { ThemeInfo } from "./themes";

/* Theme previews in a window over the page (not a new tab). The founders' gift that was here is a pop-up run from Diwan
   now (the "theme-gift" template, components/popupTemplates.tsx). */

const close = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
);
const eye = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.500-6 10-6 10 6 10 6-3.500 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.500" /></svg>
);

/** Where a theme's view-only page is: a theme's sample store, or a design he saved, drawn on his own store */
export const previewUrl = (t: ThemeInfo) => (t.custom ? `/store?saved=${t.id}` : `/store?theme=${t.id}`);

/** A theme's store in a window over the page, to scroll through only (nothing in it can be clicked). Esc, the × or a click outside closes it. */
export function PreviewWindow({ theme, onClose }: { theme: ThemeInfo; onClose: () => void }) {
  const { lang } = usePrefs();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = was;
    };
  }, [onClose]);
  const label = lang === "ar" ? "إغلاق المعاينة" : "Close the preview";
  return (
    <div role="dialog" aria-modal="true" aria-label={theme.name[lang]} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={onClose}>
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-fg/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-2.5">
          <span className="text-muted">{eye}</span>
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{(lang === "ar" ? "معاينة: " : "Preview: ") + theme.name[lang]}</p>
          <button type="button" onClick={onClose} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-fg">{close}</button>
        </div>
        <iframe src={`${previewUrl(theme)}&look=1`} title={theme.name[lang]} className="w-full flex-1 bg-white" />
      </div>
    </div>
  );
}

/** The small eye beside a theme's name: opens its preview window */
export function PreviewEye({ onOpen }: { onOpen: () => void }) {
  const { lang } = usePrefs();
  const label = lang === "ar" ? "معاينة" : "Preview";
  return <button type="button" onClick={onOpen} aria-label={label} title={label} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-fg/15 text-muted transition hover:bg-soft hover:text-fg">{eye}</button>;
}
