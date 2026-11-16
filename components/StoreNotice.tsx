"use client";

import { usePathname } from "next/navigation";
import { brandName } from "./content";
import { usePrefs } from "./Prefs";

/* The short pages shown instead of a store: suspended by Dukkan, not open yet, no store at this address, or no page at
   all (app/not-found.tsx). */

const notices = {
  unavailable: {
    en: { title: "This store is unavailable", body: "This store can't be visited right now. Please try again later." },
    ar: { title: "هذا المتجر غير متاح", body: "لا يمكن زيارة هذا المتجر حاليًا. يرجى المحاولة لاحقًا." },
  },
  page: {
    en: { title: "This page doesn't exist", body: "Check the link, or go back to the home page." },
    ar: { title: "هذه الصفحة غير موجودة", body: "تأكد من الرابط، أو عد إلى الصفحة الرئيسية." },
  },
  missing: {
    en: { title: "This store doesn't exist", body: "Check the link: there is no store at this address." },
    ar: { title: "هذا المتجر غير موجود", body: "تأكد من الرابط: لا يوجد متجر على هذا العنوان." },
  },
  soon: {
    en: { title: "This store is not open yet", body: "The store is still getting ready. Please come back soon." },
    ar: { title: "هذا المتجر لم يُفتتح بعد", body: "ما زال المتجر يستعد للافتتاح. عد إليه قريبًا." },
  },
};

/* A short, polite page in place of a store that can't be shown: suspended by Dukkan, not open yet, or no store at all at
   this address (app/[slug]/not-found.tsx) */
export function Notice({ kind, name, lang }: { kind: keyof typeof notices; name?: string; lang: "en" | "ar" }) {
  const w = notices[kind][lang];
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-[#f6f5f2] text-brand-ink">
      <main className="grid flex-1 place-items-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          {name?.trim() && <p className="text-lg font-extrabold"><bdi>{name}</bdi></p>}
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">{w.title}</h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-brand-ink/70">{w.body}</p>
        </div>
      </main>
      <footer className="pb-8 text-center text-xs text-brand-ink/60">
        <a href="/" className="font-semibold hover:underline">{brandName(lang)}</a>
      </footer>
    </div>
  );
}

/** An address that leads nowhere: one part (where a store would be) says there is no store there, a longer one that
    the page doesn't exist. In the visitor's language. */
export function MissingPage() {
  const { lang } = usePrefs();
  const parts = (usePathname() || "/").split("/").filter(Boolean);
  return <Notice kind={parts.length === 1 ? "missing" : "page"} lang={lang} />;
}
