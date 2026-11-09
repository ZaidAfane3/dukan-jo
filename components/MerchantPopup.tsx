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
   shows on the next page. Signed in only; never in the platform tour, never on staff pages. */

const tell = (id: string, action: "seen" | "clicked") =>
  fetch(`/api/popups/${id}`, { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);

/* one pop-up open in the whole tab, whatever page draws the bar */
let openNow = false;

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

  /* asked once per page view, a moment after the page opens */
  useEffect(() => {
    if (!serverMode() || isStaffPage(window.location.pathname, window.location.search)) return;
    let gone = false;
    const at = window.location.pathname === "/dashboard" ? "home" : "any";
    const timer = window.setTimeout(async () => {
      if (openNow) return;
      const j = await fetch(`/api/popups?at=${at}`, { cache: "no-store", credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const p = j?.popup as PopupView | null | undefined;
      /* a template this version of the page does not know yet is left for later (not marked seen) */
      if (gone || !p || openNow || !isTemplateId(p.template)) return;
      openNow = true;
      setPopup(p);
      void tell(p.id, "seen");
    }, 1200);
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, []);

  const close = () => {
    openNow = false;
    setPopup(null);
  };
  /* leaving the page while it is open (the browser's back) frees the tab for the next one */
  useEffect(() => () => {
    if (popup) openNow = false;
  }, [popup]);

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
    if (theme && ownsLook(theme.id)) {
      applyTheme(theme, lang);
      router.push("/themes/mine");
    } else router.push("/themes");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={close}>
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
