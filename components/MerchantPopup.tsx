"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { refreshCatalog } from "./catalog";
import { isStaffPage } from "./diwan/nav";
import { serverMode } from "./notifications";
import type { PopupView } from "./popupRules";
import { isTemplateId, valueOf } from "./popupTemplateRules";
import { PopupTemplate, type PopupAction } from "./popupTemplates";
import { usePrefs } from "./Prefs";
import { PreviewWindow } from "./ThemePopup";
import { applyTheme, findTheme, ownsLook, type ThemeInfo } from "./themes";

/* A pop-up from Dukkan's team (Diwan: /diwan/popups), drawn by its template (components/popupTemplates.tsx). It is shown
   from the dashboard's shared bar (DashboardBar), so every merchant page can show one: the home page asks for home and
   any-page pop-ups, the other pages for any-page ones only. One at a time, and at most one per page view: each shop sees
   each pop-up once (it is marked seen on the server as soon as it shows), so after one is closed the next one waiting
   shows on the next page. It never lands on something the merchant has started on the page (pageIsCalm, watchStarted
   below): then it waits for a later page. A rejected document (DocumentRejected.tsx) goes first on the same page: this one waits for
   it to be closed, or for the documents answer to say there is none (a few seconds at most, so a slow or failed answer
   does not hold it back). Signed in only; never in the platform tour, never on staff pages. */

const tell = (id: string, action: "seen" | "clicked") =>
  fetch(`/api/popups/${id}`, { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);

/** One pop-up open in the whole tab, whatever page draws the bar: Dukkan's pop-ups here, the rejected-document one
    (DocumentRejected.tsx) and the 2-step sign-in one after signing in (TwoStepPrompt.tsx, which takes it first) take
    turns through it. `doc`: the rejected-document one has this page first (its answer is coming, or it is waiting or
    open), so Dukkan's pop-up waits behind it */
export const popupSlot = { open: false, doc: false };

/* whoever waits for the place on this page tries again when it is freed (or the documents answer is in) */
const waiting = new Set<() => void>();
/** Calls `f` each time the pop-up place may have changed hands; returns the way to stop */
export function onPopupSlot(f: () => void): () => void {
  waiting.add(f);
  return () => void waiting.delete(f);
}
/** Tells the ones waiting to try again. Not called when a page goes away: its waiting ones go with it */
export function popupSlotChanged() {
  for (const f of [...waiting]) f();
}

/* A pop-up never lands on something the merchant has started: each one, when its turn comes, checks that nothing was
   started on this page since it opened (watchStarted) and that the page is calm (pageIsCalm); if not, it waits for a
   later page. The pop-ups' own outer layers carry data-dukkan-popup: clicks and keys inside them, and the closing one
   still on screen, do not count, so one can follow another on the same page. */

/** Nothing on the page is open or being filled in: no dialog, checkout, drawer or menu over it, the page not held still
    by one, and nothing focused to type in (Dukkan's own pop-ups, data-dukkan-popup, are not counted) */
export function pageIsCalm(): boolean {
  const ours = (el: Element) => !!el.closest("[data-dukkan-popup]");
  for (const el of Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [data-theme-preview]'))) {
    if (!ours(el)) return false;
  }
  /* the app's own layers over the whole page (dialogs, the theme checkout, the mobile menu's backdrop) */
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(".fixed.inset-0"))) {
    if (ours(el)) continue;
    const s = getComputedStyle(el);
    if (s.display !== "none" && s.visibility !== "hidden" && s.pointerEvents !== "none" && Number(s.opacity) > 0.05) return false;
  }
  /* the page held still by something else (one of Dukkan's pop-ups closing still holds it for a moment) */
  if (document.body.style.overflow === "hidden" && !document.querySelector("[data-dukkan-popup]")) return false;
  const a = document.activeElement;
  if (a instanceof HTMLElement && !ours(a) && (a.isContentEditable || a.matches("input, textarea, select"))) return false;
  return true;
}

/** From now on, whether the merchant starts something on this page: a click or tap, a key, typing, the browser's back
    or forward. `busy()`: started, or the page not calm right now. `stop()` when the page goes away or it is decided */
export function watchStarted(): { started: () => boolean; busy: () => boolean; stop: () => void } {
  let on = false;
  const touch = (e: Event) => {
    if (e.target instanceof Element && e.target.closest("[data-dukkan-popup]")) return;
    on = true;
  };
  const events = ["pointerdown", "keydown", "input", "popstate"] as const;
  for (const e of events) window.addEventListener(e, touch, true);
  return {
    started: () => on,
    busy: () => on || !pageIsCalm(),
    stop: () => {
      for (const e of events) window.removeEventListener(e, touch, true);
    },
  };
}

/* how long Dukkan's pop-up, once ready, waits for the documents answer before it shows anyway */
const DOC_WAIT = 4000;

/** The theme a theme gift gives (a theme made in Diwan needs the theme store's list first) */
async function giftTheme(id: string): Promise<ThemeInfo | null> {
  if (!id) return null;
  if (!findTheme(id)) await refreshCatalog(true);
  return findTheme(id);
}

export function MerchantPopup() {
  const { lang } = usePrefs();
  const router = useRouter();
  const [popup, setPopup] = useState<PopupView | null>(null);
  const [previewing, setPreviewing] = useState<ThemeInfo | null>(null);
  const box = useRef<HTMLDivElement>(null);
  /* whether this one holds the tab's pop-up place (read when the page goes away, after the state may have moved on) */
  const holds = useRef({ on: false });

  /* asked once per page view, a moment after the page opens */
  useEffect(() => {
    if (!serverMode() || isStaffPage(window.location.pathname, window.location.search)) return;
    let gone = false;
    let stop = () => {};
    let patience = 0;
    const h = holds.current;
    const at = window.location.pathname === "/dashboard" ? "home" : "any";
    /* what the merchant starts on this page from its first draw */
    const watch = watchStarted();
    const timer = window.setTimeout(async () => {
      /* the 2-step one holds the place: this one shows on a later page. A rejected document open or coming is waited for */
      if (popupSlot.open && !popupSlot.doc) return;
      const j = await fetch(`/api/popups?at=${at}`, { cache: "no-store", credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const p = j?.popup as PopupView | null | undefined;
      /* a template this version of the page does not know yet is left for later (not marked seen) */
      if (gone || !p || !isTemplateId(p.template)) return;
      let patient = true;
      const show = () => {
        if (gone || popupSlot.open || (patient && popupSlot.doc)) return false;
        stop();
        window.clearTimeout(patience);
        /* the merchant started something here (or a dialog, checkout or drawer is open): it waits for a later page,
           not marked seen */
        if (watch.busy()) return true;
        popupSlot.open = true;
        h.on = true;
        setPopup(p);
        void tell(p.id, "seen");
        return true;
      };
      if (show()) return;
      stop = onPopupSlot(show);
      /* the documents answer is slow: this one shows anyway, and a rejection that comes later waits for it to close */
      patience = window.setTimeout(() => {
        patient = false;
        show();
      }, DOC_WAIT);
    }, 1200);
    return () => {
      gone = true;
      window.clearTimeout(timer);
      window.clearTimeout(patience);
      stop();
      watch.stop();
      /* leaving the page while it is open (the browser's back) frees the tab for the next one */
      if (h.on) popupSlot.open = false;
      h.on = false;
    };
  }, []);

  /* closed: the place is free, and a rejected document waiting behind it shows now */
  const close = () => {
    holds.current.on = false;
    popupSlot.open = false;
    setPopup(null);
    popupSlotChanged();
  };

  const act = async (a: PopupAction) => {
    if (!popup) return;
    if (a === "close" || a === "later") return close();
    if (a === "button") {
      void tell(popup.id, "clicked");
      return close();
    }
    const theme = await giftTheme(valueOf(popup.slots, "theme"));
    if (a === "preview") return theme && setPreviewing(theme);
    /* "use": a theme he has (a free one, or one he bought) goes on his store; one he does not own opens in the theme store */
    void tell(popup.id, "clicked");
    close();
    /* applyTheme refuses a paid theme the store has not bought (themes.ts unboughtBase): that one opens in the theme store too */
    if (theme && ownsLook(theme.id) && applyTheme(theme, lang)) router.push("/themes/mine");
    else router.push("/themes");
  };

  /* while it is open: Esc closes it, Tab stays inside it, the page under it does not scroll, and the focus comes back after */
  useEffect(() => {
    if (!popup) return;
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      /* the theme preview window closes itself first */
      if (e.key === "Escape") return !document.querySelector("[data-theme-preview]") && close();
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
    <div data-dukkan-popup className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={close}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="dukkan-popup-title" className="dk-pop flex w-full justify-center" onClick={(e) => e.stopPropagation()}>
        <PopupTemplate template={popup.template} slots={popup.slots} lang={lang} titleId="dukkan-popup-title" act={(a) => void act(a)} />
      </div>
      {previewing && (
        <div data-theme-preview onClick={(e) => e.stopPropagation()}>
          <PreviewWindow theme={previewing} onClose={() => setPreviewing(null)} />
        </div>
      )}
      <style>{`@keyframes dkPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}.dk-pop{animation:dkPop .25s ease-out}@media (prefers-reduced-motion: reduce){.dk-pop{animation:none}}`}</style>
    </div>
  );
}
