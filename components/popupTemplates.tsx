"use client";

import Link from "next/link";
import type { Lang } from "./content";
import { isOutside } from "./popupRules";
import { listOf, textOf, valueOf, type SlotValues, type TemplateId } from "./popupTemplateRules";
import { findTheme } from "./themes";

/* The pop-up templates as React components: each draws one pop-up from its slots (what they are and their limits are in
   components/popupTemplateRules.ts). The same component is shown to merchants (components/MerchantPopup.tsx) and in
   Diwan's preview (/diwan/popups), so the preview is exactly what merchants see.

   A template only draws: what its buttons do is the host's. It calls act() with what was pressed:
   "close" (the ×), "button" (a link button: the host counts the press, the link itself goes), and for a theme gift
   "use", "preview" and "later". */

export type PopupAction = "close" | "button" | "use" | "preview" | "later";
export type TemplateProps = {
  slots: SlotValues;
  lang: Lang;
  act: (a: PopupAction) => void;
  /** the id of its title, for the dialog's name */
  titleId?: string;
};

const closeWord = { en: "Close", ar: "إغلاق" };
const box = "relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-card text-fg shadow-2xl ring-1 ring-fg/10";
const linkBtn = "inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:bg-deep";

function CloseX({ lang, onPicture, act }: { lang: Lang; onPicture: boolean; act: TemplateProps["act"] }) {
  return (
    <button type="button" onClick={() => act("close")} aria-label={closeWord[lang]} title={closeWord[lang]} className={`absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full transition ${onPicture ? "bg-black/40 text-white hover:bg-black/60" : "text-muted hover:bg-soft hover:text-fg"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

/** A button that goes to a Dukkan page, or to an https address in a new tab */
function LinkButton({ label, link, act }: { label: string; link: string; act: TemplateProps["act"] }) {
  if (!label || !link) return null;
  return isOutside(link) ? (
    <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => act("button")} className={linkBtn}>{label}</a>
  ) : (
    <Link href={link} onClick={() => act("button")} className={linkBtn}>{label}</Link>
  );
}

const Stripe = () => <div className="h-2 bg-gradient-to-r from-primary via-primary/60 to-amber-400" aria-hidden />;

/* ---------------- card: a title, a text, a picture and a button ---------------- */

function CardPopup({ slots, lang, act, titleId }: TemplateProps) {
  const image = valueOf(slots, "image");
  const body = textOf(slots, "body", lang);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className={box}>
      <CloseX lang={lang} onPicture={!!image} act={act} />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" draggable={false} className="block max-h-56 w-full select-none object-cover" />
      ) : (
        <Stripe />
      )}
      <div className="space-y-3 px-6 pb-6 pt-5">
        <h2 id={titleId} className="break-words pe-8 text-xl font-extrabold leading-snug">{textOf(slots, "title", lang)}</h2>
        {body && <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted">{body}</p>}
        {textOf(slots, "button", lang) && valueOf(slots, "buttonLink") && (
          <div className="pt-2"><LinkButton label={textOf(slots, "button", lang)} link={valueOf(slots, "buttonLink")} act={act} /></div>
        )}
      </div>
    </div>
  );
}

/* ---------------- theme gift: a theme given to the store ---------------- */

const eye = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.500-6 10-6 10 6 10 6-3.500 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.500" /></svg>
);

function ThemeGiftPopup({ slots, lang, act, titleId }: TemplateProps) {
  /* the picture: the one given, else the theme's own picture of its home page */
  const image = valueOf(slots, "image") || findTheme(valueOf(slots, "theme"))?.shot || "";
  const w = (k: string) => textOf(slots, k, lang);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="w-full max-w-md overflow-hidden rounded-2xl bg-card text-fg shadow-2xl ring-1 ring-fg/10">
      {/* the whole store page, scrolling slowly down and back up by itself (paused under the mouse), as on the landing page */}
      <div className="group relative h-[var(--box)] overflow-hidden bg-soft [--box:12rem]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" draggable={false} className="dk-shot block w-full select-none" />
        ) : (
          <div className="h-full bg-gradient-to-br from-primary/30 via-primary/10 to-amber-300/30" aria-hidden />
        )}
        {w("badge") && (
          <span className="absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.500a2.500 2.500 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.500a2.500 2.500 0 1 0 0-5C13 2 12 7 12 7Z" /></svg>
            {w("badge")}
          </span>
        )}
      </div>
      <div className="p-6">
        <h2 id={titleId} className="break-words text-xl font-extrabold">{w("title")}</h2>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-fg/80">{w("body")}</p>
        {w("note") && <p className="mt-1.5 break-words text-xs text-muted">{w("note")}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => act("use")} className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:opacity-90">{w("use")}</button>
          {w("preview") && (
            <button type="button" onClick={() => act("preview")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-fg/15 px-4 text-sm font-semibold transition hover:bg-soft">{eye}{w("preview")}</button>
          )}
          <button type="button" onClick={() => act("later")} className="ms-auto h-11 px-3 text-sm font-semibold text-muted transition hover:text-fg">{w("later")}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- what's new: a title and a few points ---------------- */

function WhatsNewPopup({ slots, lang, act, titleId }: TemplateProps) {
  const intro = textOf(slots, "intro", lang);
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className={box}>
      <CloseX lang={lang} onPicture={false} act={act} />
      <Stripe />
      <div className="px-6 pb-6 pt-5">
        <h2 id={titleId} className="break-words pe-8 text-xl font-extrabold leading-snug">{textOf(slots, "title", lang)}</h2>
        {intro && <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted">{intro}</p>}
        <ul className="mt-4 space-y-2.5">
          {listOf(slots, "items", lang).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>
              </span>
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
        {textOf(slots, "button", lang) && valueOf(slots, "buttonLink") && (
          <div className="pt-5"><LinkButton label={textOf(slots, "button", lang)} link={valueOf(slots, "buttonLink")} act={act} /></div>
        )}
      </div>
    </div>
  );
}

/** Every template's component, by its id (every id of POPUP_TEMPLATE_RULES must have one) */
export const POPUP_TEMPLATES: Record<TemplateId, (p: TemplateProps) => JSX.Element> = {
  card: CardPopup,
  "theme-gift": ThemeGiftPopup,
  "whats-new": WhatsNewPopup,
};

/** Draws a pop-up by its template (nothing for a template this version does not know) */
export function PopupTemplate({ template, ...p }: TemplateProps & { template: string }) {
  const T = (POPUP_TEMPLATES as Record<string, ((p: TemplateProps) => JSX.Element) | undefined>)[template];
  return T ? <T {...p} /> : null;
}
