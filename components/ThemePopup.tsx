"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { demoActive } from "./demoSandbox";
import { isStaffPage } from "./diwan/nav";
import { usePrefs } from "./Prefs";
import { applyTheme, madaTheme, type ThemeInfo } from "./themes";

/* Theme previews in a window over the page (not a new tab), and the founders' gift shown once to each account after it signs in. */

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

/* Set by the sign-up page when an account signs in or is made; the gift then shows once on the next page */
export const GIFT_FLAG = "seen-founders-gift";
/* kept under the account (see installAccounts), so each account sees it once */
const GIFT_SEEN = "seen-founders-gift-seen";

const giftWords = {
  en: {
    badge: "A gift for you",
    title: "Dukkan Founders",
    body: "Because you are one of Dukkan's founders, we are gifting you this free theme for your store.",
    note: "It stays in My themes, so you can use it any time.",
    use: "Use it on my store",
    preview: "Preview",
    later: "Later",
  },
  ar: {
    badge: "هدية لك",
    title: "مؤسسو دكان",
    body: "لأنك من مؤسسي دكان، نهديك هذا التصميم مجانًا لتستخدمه في متجرك.",
    note: "يبقى في «ثيماتي» لتستخدمه في أي وقت.",
    use: "استخدمه في متجري",
    preview: "معاينة",
    later: "لاحقًا",
  },
};

export function FoundersGift() {
  const { lang } = usePrefs();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (path.startsWith("/signup") || path.startsWith("/store") || isStaffPage(path, window.location.search) || demoActive()) return;
    try {
      if (sessionStorage.getItem(GIFT_FLAG) === "1" && localStorage.getItem(GIFT_SEEN) !== "1") setOpen(true);
    } catch {
      /* storage blocked: no gift window */
    }
  }, [path]);
  if (!open) return null;
  const w = giftWords[lang];
  const done = () => {
    try {
      sessionStorage.removeItem(GIFT_FLAG);
      localStorage.setItem(GIFT_SEEN, "1");
    } catch {
      /* storage blocked */
    }
    setOpen(false);
  };
  const use = () => {
    applyTheme(madaTheme, lang);
    done();
    router.push("/themes/mine");
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gift-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card text-fg shadow-2xl ring-1 ring-fg/10">
        {/* the whole store page, scrolling slowly down and back up by itself (paused under the mouse), as on the landing page */}
        <div className="group relative h-[var(--box)] overflow-hidden bg-soft [--box:12rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/themes/mada.jpg?v=4" alt="" draggable={false} className="dk-shot block w-full select-none" />
          <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.500a2.500 2.500 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.500a2.500 2.500 0 1 0 0-5C13 2 12 7 12 7Z" /></svg>
            {w.badge}
          </span>
        </div>
        <div className="p-6">
          <h2 id="gift-title" className="text-xl font-extrabold">{w.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg/80">{w.body}</p>
          <p className="mt-1.5 text-xs text-muted">{w.note}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="button" onClick={use} className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:opacity-90">{w.use}</button>
            <button type="button" onClick={() => setPreviewing(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-fg/15 px-4 text-sm font-semibold transition hover:bg-soft">{eye}{w.preview}</button>
            <button type="button" onClick={done} className="ms-auto h-11 px-3 text-sm font-semibold text-muted transition hover:text-fg">{w.later}</button>
          </div>
        </div>
      </div>
      {previewing && <PreviewWindow theme={madaTheme} onClose={() => setPreviewing(false)} />}
    </div>
  );
}
