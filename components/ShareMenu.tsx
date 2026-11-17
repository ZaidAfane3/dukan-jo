"use client";

import { useEffect, useRef, useState } from "react";
import { qrMatrix, qrPath } from "./qr";

/* "Share" for a store's link. On a phone it opens the phone's own share sheet (it already lists WhatsApp, Instagram and
   the rest). On a computer, where that sheet is missing or does nothing useful, it opens a small menu instead: WhatsApp,
   Facebook, X, Telegram, email, copy, and a QR code made right here in the browser (components/qr.ts), so the link is
   not sent to another site just to draw it. Instagram has no share link on the web: the menu says what to do instead. */

const words = {
  en: {
    share: "Share", label: "Share your store link", whatsapp: "WhatsApp", facebook: "Facebook", x: "X", telegram: "Telegram", email: "Email",
    copy: "Copy link", copied: "Copied", qr: "QR code", instagram: "Instagram", instagramHint: "Copy the link and add it to your Instagram bio.",
    back: "Back", download: "Download PNG", qrHint: "Customers scan it with their phone camera to open your store.", close: "Close",
    visit: "Visit {name}: {url}",
  },
  ar: {
    share: "مشاركة", label: "مشاركة رابط متجرك", whatsapp: "واتساب", facebook: "فيسبوك", x: "إكس", telegram: "تيليجرام", email: "البريد الإلكتروني",
    copy: "نسخ الرابط", copied: "تم النسخ", qr: "رمز QR", instagram: "إنستغرام", instagramHint: "انسخ الرابط وأضفه إلى نبذة حسابك في إنستغرام.",
    back: "رجوع", download: "تنزيل PNG", qrHint: "يمسحه العملاء بكاميرا الهاتف ليفتحوا متجرك.", close: "إغلاق",
    visit: "زوروا {name}: {url}",
  },
};

const ic = { viewBox: "0 0 24 24", className: "h-4 w-4 shrink-0", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const icons = {
  chat: <svg {...ic}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.2L4 20Z" /></svg>,
  f: <svg {...ic}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" /></svg>,
  x: <svg {...ic}><path d="M4 4l16 16M20 4 4 20" /></svg>,
  plane: <svg {...ic}><path d="M21 4 3 11l6 2 2 6 3-4 4 3 3-14Z" /><path d="m9 13 8-6" /></svg>,
  mail: <svg {...ic}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  copy: <svg {...ic}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>,
  qr: <svg {...ic}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>,
  camera: <svg {...ic}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></svg>,
  back: <svg {...ic} className="h-4 w-4 shrink-0 rtl:rotate-180"><path d="m15 6-6 6 6 6" /></svg>,
};

const QUIET = 4;

/** The QR code as a PNG file (black on white, with the quiet border scanners need) */
function qrPng(m: boolean[][], scale = 12): Promise<Blob | null> {
  const n = m.length + QUIET * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  m.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect((x + QUIET) * scale, (y + QUIET) * scale, scale, scale)));
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** A "Share" button for a link. `title`: the store's name (the email subject and the phone sheet's title); `fileName`:
    the QR picture's name without ".png". `align`: which side of the button the menu lines up with. */
export function ShareMenu({ url, title, lang, fileName = "store-qr", label, disabled = false, disabledTitle, align = "end", className = "" }: { url: string; title: string; lang: "en" | "ar"; fileName?: string; /* the button's words ("Share" when none) */ label?: string; disabled?: boolean; disabledTitle?: string; align?: "start" | "end"; className?: string }) {
  const w = words[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "qr">("list");
  const [copied, setCopied] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  /* a phone with its own share sheet: Share opens that sheet, so the QR code gets its own button beside it */
  const [phoneSheet, setPhoneSheet] = useState(false);
  useEffect(() => setPhoneSheet(typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches && typeof navigator.share === "function"), []);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = (focusBack = true) => {
    setOpen(false);
    setView("list");
    if (focusBack) button.current?.focus();
  };

  /* Esc closes and puts the focus back on the button; a press outside closes */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !wrapper.current?.contains(e.target as Node) && close(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* the first choice of the menu (or of the QR view) gets the focus */
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open, view]);

  const press = async () => {
    if (disabled) return;
    if (open) return close();
    /* a phone (touch screen) with a share sheet: the phone's own sheet. A computer gets the menu, also when its browser
       has a share sheet, since on a computer that sheet often shows nothing useful */
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const data: ShareData = { title, text: w.visit.replace("{name}", title).split("{url}")[0].replace(/[:\s]+$/, ""), url };
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof nav.share === "function" && (nav.canShare?.(data) ?? true)) {
      try {
        await nav.share(data);
        return;
      } catch (e) {
        /* he closed the sheet: nothing more. It failed: the menu opens instead */
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; /* clipboard blocked: do not claim it was copied */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const matrix = open && view === "qr" ? qrMatrix(url) : null;
  const download = async () => {
    if (!matrix) return;
    const blob = await qrPng(matrix);
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const u = encodeURIComponent(url);
  /* "Visit Olive & Co: https://…" in the page's language; the link comes last, so the apps show it as a link */
  const message = w.visit.replace("{name}", title).replace("{url}", url);
  const before = encodeURIComponent(w.visit.replace("{name}", title).split("{url}")[0].replace(/[:\s]+$/, ""));
  const links = [
    { key: "whatsapp", label: w.whatsapp, icon: icons.chat, href: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { key: "facebook", label: w.facebook, icon: icons.f, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "x", label: w.x, icon: icons.x, href: `https://x.com/intent/tweet?text=${encodeURIComponent(message)}` },
    { key: "telegram", label: w.telegram, icon: icons.plane, href: `https://t.me/share/url?url=${u}&text=${before}` },
    { key: "email", label: w.email, icon: icons.mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}` },
  ];
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-fg transition hover:bg-soft focus-visible:bg-soft focus-visible:outline-none";

  return (
    /* tabbing out of the menu closes it, as a press outside does */
    <div ref={wrapper} className="relative inline-flex" onBlur={(e) => open && e.relatedTarget && !wrapper.current?.contains(e.relatedTarget as Node) && close(false)}>
      <button
        ref={button}
        type="button"
        onClick={() => void press()}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        {label ?? w.share}
      </button>
      {phoneSheet && (
        <button type="button" onClick={() => { if (disabled) return; setView("qr"); setOpen(true); }} disabled={disabled} title={disabled ? disabledTitle : undefined} aria-haspopup="dialog" className={`${className} ms-3`}>
          {w.qr}
        </button>
      )}

      {open && (
        <>
          {/* on a phone the menu is a sheet at the bottom of the screen, over a dim page */}
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" aria-hidden onClick={() => close(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-label={w.label}
            className={`fixed inset-x-4 bottom-4 z-50 max-h-[80vh] overflow-y-auto rounded-2xl bg-card p-2 text-fg shadow-2xl ring-1 ring-fg/10 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:w-72 ${align === "end" ? "sm:end-0" : "sm:start-0"}`}
          >
            {view === "list" ? (
              <ul>
                {links.map((l) => (
                  <li key={l.key}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => close()} className={row}>
                      <span className="text-primary">{l.icon}</span>
                      {l.label}
                    </a>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={() => void copy()} className={row}>
                    <span className="text-primary">{icons.copy}</span>
                    <span aria-live="polite">{copied ? w.copied : w.copy}</span>
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setView("qr")} className={row}>
                    <span className="text-primary">{icons.qr}</span>
                    {w.qr}
                  </button>
                </li>
                <li className="mt-1 flex gap-3 border-t border-fg/10 px-3 pb-1.5 pt-3 text-xs text-muted">
                  <span className="mt-0.5">{icons.camera}</span>
                  <span>
                    <span className="block font-semibold text-fg">{w.instagram}</span>
                    {w.instagramHint}
                  </span>
                </li>
              </ul>
            ) : (
              <div className="p-2">
                <button type="button" onClick={() => setView("list")} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-primary transition hover:bg-soft">
                  {icons.back}
                  {w.back}
                </button>
                {matrix && (
                  <svg viewBox={`0 0 ${matrix.length + QUIET * 2} ${matrix.length + QUIET * 2}`} role="img" aria-label={`${w.qr}: ${url}`} className="mx-auto mt-2 block w-48 rounded-lg bg-white" shapeRendering="crispEdges">
                    <path d={qrPath(matrix, QUIET)} fill="#000" />
                  </svg>
                )}
                <p dir="ltr" className="mt-2 break-all text-center text-xs font-semibold">{url}</p>
                <p className="mt-1 text-center text-xs text-muted">{w.qrHint}</p>
                <button type="button" onClick={() => void download()} className="mt-3 h-10 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep">
                  {w.download}
                </button>
              </div>
            )}
            <button type="button" onClick={() => close()} className="mt-1 h-10 w-full rounded-xl text-sm font-semibold text-muted transition hover:bg-soft sm:hidden">
              {w.close}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
