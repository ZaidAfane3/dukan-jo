"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isStaffPage } from "./diwan/nav";
import { serverMode } from "./notifications";
import { isOutside, type PopupView } from "./popupRules";
import { usePrefs } from "./Prefs";

/* A pop-up from Dukkan's team (Diwan: /diwan/popups) on the merchant's home page: one at a time, each shop sees each one
   once (it is marked seen as soon as it shows). Signed in only; never in the platform tour, never on staff pages.
   PopupCard is the pop-up itself, so Diwan's preview shows exactly what merchants see. */

const closeWord = { en: "Close", ar: "إغلاق" };

export function PopupCard({ popup: p, lang, onClose, onButton, titleId }: { popup: PopupView; lang: "en" | "ar"; onClose?: () => void; onButton?: () => void; titleId?: string }) {
  const title = lang === "ar" ? p.titleAr : p.titleEn;
  const body = lang === "ar" ? p.bodyAr : p.bodyEn;
  const button = lang === "ar" ? p.buttonAr : p.buttonEn;
  const btnClass = "inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:bg-deep";
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-card text-fg shadow-2xl ring-1 ring-fg/10">
      <button type="button" onClick={onClose} aria-label={closeWord[lang]} title={closeWord[lang]} className={`absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full transition ${p.image ? "bg-black/40 text-white hover:bg-black/60" : "text-muted hover:bg-soft hover:text-fg"}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" draggable={false} className="block max-h-56 w-full select-none object-cover" />
      ) : (
        <div className="h-2 bg-gradient-to-r from-primary via-primary/60 to-amber-400" aria-hidden />
      )}
      <div className="space-y-3 px-6 pb-6 pt-5">
        <h2 id={titleId} className="break-words pe-8 text-xl font-extrabold leading-snug">{title}</h2>
        {body && <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted">{body}</p>}
        {button && p.buttonLink && (
          <div className="pt-2">
            {isOutside(p.buttonLink) ? (
              <a href={p.buttonLink} target="_blank" rel="noopener noreferrer" onClick={onButton} className={btnClass}>{button}</a>
            ) : (
              <Link href={p.buttonLink} onClick={onButton} className={btnClass}>{button}</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const tell = (id: string, action: "seen" | "clicked") =>
  fetch(`/api/popups/${id}`, { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);

export function MerchantPopup() {
  const { lang } = usePrefs();
  const [popup, setPopup] = useState<PopupView | null>(null);
  const box = useRef<HTMLDivElement>(null);

  /* asked once per visit of the home page, a moment after it opens */
  useEffect(() => {
    if (!serverMode() || isStaffPage(window.location.pathname, window.location.search)) return;
    let gone = false;
    const timer = window.setTimeout(async () => {
      const j = await fetch("/api/popups", { cache: "no-store", credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (gone || !j?.popup) return;
      setPopup(j.popup as PopupView);
      void tell(j.popup.id, "seen");
    }, 1200);
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, []);

  /* while it is open: Esc closes it, Tab stays inside it, the page under it does not scroll, and the focus comes back after */
  useEffect(() => {
    if (!popup) return;
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setPopup(null);
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [popup]);

  if (!popup) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setPopup(null)}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="dukkan-popup-title" className="dk-pop flex w-full justify-center" onClick={(e) => e.stopPropagation()}>
        <PopupCard
          popup={popup}
          lang={lang}
          titleId="dukkan-popup-title"
          onClose={() => setPopup(null)}
          onButton={() => {
            void tell(popup.id, "clicked");
            setPopup(null);
          }}
        />
      </div>
      <style>{`@keyframes dkPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}.dk-pop{animation:dkPop .25s ease-out}@media (prefers-reduced-motion: reduce){.dk-pop{animation:none}}`}</style>
    </div>
  );
}
