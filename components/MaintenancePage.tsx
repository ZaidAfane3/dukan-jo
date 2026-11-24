"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "./content";
import { maintenanceDefault } from "./maintenance";

const words = {
  /* to the merchant himself: his store is "not live", never "maintenance" (that is only what visitors are told) */
  en: { owner: "Your store isn't live: this is the page visitors see now.", back: "Back to the dashboard", signup: "Open your store now" },
  ar: { owner: "متجرك غير منشور: هذه هي الصفحة التي يراها الزوار الآن.", back: "العودة إلى لوحة التحكم", signup: "افتح متجرك الآن" },
};

/* A wrench on a soft square, in Dukkan's colour: the page plainly says "under maintenance", whatever the store looks
   like (its logo is never shown here). currentColor and a see-through fill, so it reads in light and dark. */
function MaintenanceMark() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className="mx-auto h-24 w-24 text-primary">
      <rect x="4" y="4" width="88" height="88" rx="28" fill="currentColor" opacity="0.12" />
      <g transform="translate(24 24) scale(2)" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </g>
    </svg>
  );
}

/** What visitors see while the store is not live: Dukkan's own "under maintenance" page, with a maintenance mark (never
    the store's logo), "We'll be back soon", the merchant's message when he wrote one, and the store's name as plain
    small text, in the visitor's language. Below it "Open your store now": to Dukkan's sign-up for visitors.
    `owner`: he looks at it himself (app/store): a slim bar on top says this is what visitors see, with a way back to
    the dashboard, and `ownerAction` replaces the sign-up link (StoreStatus.tsx OpenStoreButton makes his store live). */
export function MaintenancePage({ lang, name, message, owner = false, ownerAction }: { lang: Lang; name: string; message: string; owner?: boolean; ownerAction?: ReactNode }) {
  const d = maintenanceDefault[lang];
  const w = words[lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-page text-fg">
      {owner && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-brand-dark px-4 py-2.5 text-center text-sm text-white">
          <span>{w.owner}</span>
          <Link href="/dashboard" className="rounded-lg bg-brand-light px-3 py-1 text-xs font-bold text-brand-dark transition hover:bg-brand-pale">{w.back}</Link>
        </div>
      )}
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          <MaintenanceMark />
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">{d.title}</h1>
          <p className="mt-3 text-lg font-semibold text-fg/80">{d.message}</p>
          {message.trim() && <p dir="auto" className="mx-auto mt-3 max-w-sm whitespace-pre-line leading-relaxed text-muted">{message.trim()}</p>}
          {name.trim() && <p className="mt-6 text-sm text-muted"><bdi>{name}</bdi></p>}
          {owner && ownerAction ? (
            ownerAction
          ) : (
            <div className="mt-8">
              <a href="/signup" className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90">{w.signup}</a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
