"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateLocale } from "./content";
import { Logo } from "./Nav";
import { LangSwitch, ThemeToggle, usePrefs } from "./Prefs";
import { checkSuspension, readSuspension, rememberSuspension, type Suspension } from "./suspended";
import { useSiteContent } from "./useSiteContent";

/* The page a merchant sees when Dukkan suspended their store: after signing in with the right password, or in a tab
   that was open when it happened. It says why (the reason staff wrote in Diwan), since when, and how to reach support.
   Support tickets need a signed-in store, so it gives the phone, email and WhatsApp of the site's contact section
   (Diwan > Website > Contact and legal), so changing them there changes this page too; an empty one is left out. The reason comes from this tab (components/suspended.ts) or, when the page is opened again, from the
   session the merchant signed in with; anyone else just sees a way back to sign in. */

const words = {
  en: {
    title: "Your store is suspended",
    contactTitle: "To sort this out, contact Dukkan support:",
    call: "Call",
    whatsapp: "WhatsApp",
    intro: "Dukkan's team has paused your store for now. While it is suspended you can't sign in or make changes.",
    reason: "The reason our team gave",
    noReason: "No reason was written.",
    since: "Suspended since",
    next: "Mention the email or mobile number on your account so we can find your store quickly.",
    email: "Email",
    back: "Back to sign in",
    loading: "One moment…",
    noneTitle: "Nothing to show here",
    none: "This page explains a suspended store to its owner. If your store was suspended, sign in again to see why.",
  },
  ar: {
    title: "تم إيقاف متجرك مؤقتًا",
    contactTitle: "لحلّ الأمر تواصل مع دعم دكّان:",
    call: "اتصال",
    whatsapp: "واتساب",
    intro: "أوقف فريق دكّان متجرك مؤقتًا. لا يمكنك تسجيل الدخول أو إجراء أي تغيير طوال فترة الإيقاف.",
    reason: "السبب الذي ذكره فريقنا",
    noReason: "لم يُكتب سبب.",
    since: "موقوف منذ",
    next: "اذكر البريد الإلكتروني أو رقم الجوال المسجّل في حسابك لنجد متجرك بسرعة.",
    email: "البريد الإلكتروني",
    back: "العودة إلى تسجيل الدخول",
    loading: "لحظة من فضلك…",
    noneTitle: "لا يوجد ما يُعرض هنا",
    none: "تشرح هذه الصفحة لصاحب المتجر سبب إيقافه. إذا أُوقف متجرك، سجّل الدخول مرة أخرى لترى السبب.",
  },
};

/* wa.me wants the number with its country code and digits only: a local Jordanian 07... number gets 962 in front */
function waLink(n: string): string {
  let d = n.replace(/\D/g, "").replace(/^00/, "");
  if (/^07\d{8}$/.test(d)) d = `962${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : "";
}

const iconProps = { viewBox: "0 0 24 24", className: "h-4 w-4", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const icon = {
  phone: (
    <svg {...iconProps}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  ),
  chat: (
    <svg {...iconProps}>
      <path d="M3 21l1.7-4.6A8.5 8.5 0 1 1 8 19.6Z" />
    </svg>
  ),
  mail: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
};

export function SuspendedNotice() {
  const { lang } = usePrefs();
  const w = words[lang];
  const { contact } = useSiteContent();
  /* undefined: still asking the server; null: nothing to show */
  const [s, setS] = useState<Suspension | null | undefined>(undefined);

  useEffect(() => {
    const kept = readSuspension();
    if (kept) return setS(kept);
    let alive = true;
    checkSuspension().then((found) => {
      if (found) rememberSuspension(found);
      if (alive) setS(found);
    });
    return () => {
      alive = false;
    };
  }, []);

  const since = s?.since ? new Date(s.since).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }) : "";
  const tel = contact.phone.replace(/[^\d+]/g, "");
  const wa = waLink(contact.whatsapp);
  const button =
    "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <main className="flex min-h-screen flex-col bg-page px-6 py-6 text-fg sm:px-10">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </header>

      <div data-lang-fade className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10">
        {s === undefined ? (
          <p role="status" className="text-center text-sm text-muted">
            {w.loading}
          </p>
        ) : (
          <section aria-labelledby="suspended-title" className="rounded-3xl border border-fg/10 bg-card p-6 shadow-sm sm:p-8">
            <span aria-hidden className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M10 9v6M14 9v6" />
              </svg>
            </span>
            <h1 id="suspended-title" className="text-2xl font-bold">
              {s ? w.title : w.noneTitle}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s ? w.intro : w.none}</p>

            {s && (
              <>
                <div className="mt-6 rounded-2xl bg-soft/70 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{w.reason}</p>
                  {/* the reason may be written in either language, so it takes its own direction */}
                  <p dir="auto" className="mt-2 whitespace-pre-line break-words text-base font-medium">
                    {s.reason || w.noReason}
                  </p>
                  {since && (
                    <p className="mt-3 text-xs text-muted">
                      {w.since} {since}
                    </p>
                  )}
                </div>

                {(tel || contact.email || wa) && (
                  <>
                    <p className="mt-6 text-sm font-semibold">{w.contactTitle}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tel && (
                        <a href={`tel:${tel}`} className={`${button} bg-ink text-onink hover:bg-deep`}>
                          {icon.phone}
                          {w.call} <span dir="ltr">{contact.phone}</span>
                        </a>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>
                          {icon.chat}
                          {w.whatsapp}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className={`${button} border border-fg/15 hover:bg-soft`}>
                          {icon.mail}
                          <span dir="ltr">{contact.email}</span>
                        </a>
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted">{w.next}</p>
                  </>
                )}
              </>
            )}

            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border border-fg/15 px-5 text-sm font-semibold transition hover:bg-soft"
            >
              {w.back}
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
