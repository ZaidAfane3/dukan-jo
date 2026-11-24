"use client";

import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { brandName } from "./content";
import { AGAIN_AFTER, RELOADED } from "./loadFailKeys";
import { usePageTitle } from "./pageTitle";

/* What a page shows when it fails while opening, in place of Next's own English-only "This page couldn't load"
   (app/error.tsx for every page, app/diwan/(console)/error.tsx inside Diwan, app/global-error.tsx when even the frame of
   the site fails).

   Most of these failures are a file of the page that didn't arrive: the site was updated while the tab was open (the
   old page asks for files the new version no longer has), or the connection dropped the request. Loading the page again
   fixes that, so it is done once, by itself, without asking. Once only: the address and the time are kept in this tab
   (sessionStorage), and a second failure of the same page within a minute shows the page below instead of reloading
   again and again. Any other error shows the page below straight away. A page opened in full whose code itself failed
   never gets this far: components/loadFailScript.ts does the same for it, with the same note in the tab. */

const LOAD_FAILED = /ChunkLoadError|Loading (CSS )?chunk|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to fetch RSC payload|Connection closed/i;

/** A part of the page (its code, its styles, or the server's answer for it) that failed to arrive */
export const isLoadError = (e: unknown): boolean =>
  e instanceof Error && (e.name === "ChunkLoadError" || LOAD_FAILED.test(`${e.name}: ${e.message}`));

/** Loads the page again, unless this same page was already loaded again for this in the last minute. True when it does. */
function reloadOnce(): boolean {
  try {
    const here = location.pathname + location.search;
    const last = JSON.parse(sessionStorage.getItem(RELOADED) ?? "null") as { url?: string; at?: number } | null;
    if (last?.url === here && Date.now() - (last.at ?? 0) < AGAIN_AFTER) return false;
    sessionStorage.setItem(RELOADED, JSON.stringify({ url: here, at: Date.now() }));
  } catch {
    /* no storage: nothing would stop a loop, so no reload by itself (the buttons below still work) */
    return false;
  }
  location.reload();
  return true;
}

/** The language and look saved in this browser (as the site's first script reads them, app/layout.tsx), for the page
    shown when the site's own frame failed and no PrefsProvider is there to ask */
export function savedPrefs(): { lang: Lang; dark: boolean } {
  let lang: Lang = "ar";
  let dark = false;
  try {
    const l = localStorage.getItem("seen-lang") ?? document.cookie.match(/(?:^|; )seen-lang=(en|ar)/)?.[1];
    if (l === "en" || l === "ar") lang = l;
    dark = localStorage.getItem("seen-theme") === "dark";
  } catch {
    /* storage blocked: Arabic and light, like a first visit */
  }
  return { lang, dark };
}

const words = {
  en: { title: "This page couldn't load", body: "Something went wrong while opening it. Reload to try again, or go back.", reload: "Reload", back: "Back" },
  ar: { title: "تعذّر تحميل هذه الصفحة", body: "حدث خطأ أثناء فتحها. أعد التحميل للمحاولة مرة أخرى، أو ارجع.", reload: "إعادة التحميل", back: "رجوع" },
};

/** The error page itself. `inside`: drawn inside Diwan's frame (its menu stays), so it doesn't fill the whole screen. */
export function LoadErrorPage({ error, lang, inside = false }: { error: Error; lang: Lang; inside?: boolean }) {
  /* a load failure first tries a reload by itself (nothing is drawn meanwhile, so the page doesn't flash an error) */
  const [reloading, setReloading] = useState(() => isLoadError(error));
  useEffect(() => {
    if (isLoadError(error) && reloadOnce()) return;
    setReloading(false);
  }, [error]);
  const w = words[lang];
  usePageTitle(`${w.title} · ${brandName(lang)}`);
  if (reloading) return null;
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = inside ? "/diwan" : "/";
  };
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className={`grid place-items-center px-5 py-16 text-fg ${inside ? "min-h-[60vh]" : "min-h-screen bg-page"}`}>
      <div role="alert" className="w-full max-w-md text-center">
        <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{w.title}</h1>
        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted">{w.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/* a full reload, not React's reset: a file that failed to arrive is only fetched again by loading the page */}
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90">
            {w.reload}
          </button>
          <button type="button" onClick={back} className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold text-fg/80 ring-1 ring-fg/15 transition hover:ring-fg/30">
            {w.back}
          </button>
        </div>
      </div>
    </div>
  );
}
