"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TWO_STEP_ASK } from "./accounts";
import { isStaffPage } from "./diwan/nav";
import { popupSlot } from "./MerchantPopup";
import { merchantCall, onServer } from "./merchantApi";
import { usePrefs } from "./Prefs";

/* Right after signing up or in (accounts.ts marks the tab with TWO_STEP_ASK; signing in with a 2-step code does not),
   on the first dashboard page: if the account has no 2-step code, a pop-up over the whole page asks to turn it on
   (TwoStepSettings on /settings#two-step). "Skip for now" (or Esc) hides it for this sign-in only: it is back on the
   next sign-in, until the code is on. It takes the tab's pop-up place (popupSlot) before Dukkan's pop-ups and the
   rejected-document one, which show on a later page once it is closed. Signed in on Dukkan's server only: never in the
   platform tour, never on staff pages, never on a store's public pages (they do not draw the dashboard bar). */

const words = {
  en: {
    kicker: "Account security",
    title: "Keep your account safe",
    hint: "Don't forget to turn on two-step sign-in. It keeps your store safe even if someone learns your password.",
    points: ["After your password, a 6-digit code from an app on your phone", "A stolen password alone can't open your store", "It takes about a minute to set up"],
    yes: "Turn on two-step sign-in",
    skip: "Skip for now",
    later: "We'll remind you the next time you sign in.",
  },
  ar: {
    kicker: "أمان الحساب",
    title: "احمِ حسابك",
    hint: "لا تنسَ تفعيل التحقق بخطوتين. يبقى متجرك آمنًا حتى لو عرف أحدهم كلمة مرورك.",
    points: ["بعد كلمة المرور، رمز من 6 أرقام من تطبيق على هاتفك", "كلمة مرور مسروقة وحدها لا تفتح متجرك", "يستغرق إعداده دقيقة تقريبًا"],
    yes: "فعّل التحقق بخطوتين",
    skip: "تخطَّ الآن",
    later: "سنذكّرك في المرة القادمة التي تسجّل فيها الدخول.",
  },
};

/** Not asked again in this tab (until the next sign-in marks it again) */
const forget = () => {
  try {
    sessionStorage.removeItem(TWO_STEP_ASK);
  } catch {
    /* storage blocked */
  }
};

function Shield() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden>
      <defs>
        <linearGradient id="two-step-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--brand-2))" />
          <stop offset="1" stopColor="rgb(var(--brand-deep))" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="rgb(var(--brand) / 0.12)" />
      <circle cx="60" cy="60" r="44" fill="rgb(var(--brand) / 0.12)" />
      <path d="M60 22 88 33v22c0 19-12 34-28 41-16-7-28-22-28-41V33z" fill="url(#two-step-shield)" />
      <path d="M60 22 88 33v22c0 19-12 34-28 41z" fill="#fff" opacity="0.12" />
      <rect x="47" y="55" width="26" height="20" rx="4" fill="#fff" />
      <path d="M52 55v-5a8 8 0 0 1 16 0v5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="63.5" r="3" fill="rgb(var(--brand-deep))" />
      <rect x="58.6" y="64" width="2.8" height="6" rx="1.4" fill="rgb(var(--brand-deep))" />
      <circle cx="96" cy="28" r="4" fill="rgb(var(--brand-2))" className="two-step-spark" />
      <circle cx="22" cy="86" r="3" fill="rgb(var(--brand))" className="two-step-spark" />
    </svg>
  );
}

const check = (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
    <path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function TwoStepPrompt() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [show, setShow] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /* on the page's first draw: the place is taken at once (before the other pop-ups ask), and given back if the code is
     on already or the server can't say */
  useEffect(() => {
    const path = window.location.pathname;
    if (!onServer() || isStaffPage(path, window.location.search) || path.startsWith("/demo") || path.startsWith("/settings")) return;
    try {
      if (sessionStorage.getItem(TWO_STEP_ASK) !== "1") return;
    } catch {
      return;
    }
    if (popupSlot.open) return;
    popupSlot.open = true;
    let gone = false;
    void merchantCall("/api/auth/totp/setup", "GET").then((r) => {
      if (gone) return;
      if (r?.status === 200 && r.data.on === false) return setShow(true);
      /* on already (or signed out): nothing to ask in this tab; the server unreachable: asked again on the next page */
      if (r && r.status < 500) forget();
      popupSlot.open = false;
    });
    return () => {
      gone = true;
      popupSlot.open = false;
    };
  }, []);

  const close = () => {
    forget();
    popupSlot.open = false;
    setShow(false);
  };

  /* while it is open: Esc skips it, Tab stays inside it, the page under it does not scroll, and the focus comes back after */
  useEffect(() => {
    if (!show) return;
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(box.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !box.current?.contains(document.activeElement))) {
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
  }, [show]);

  if (!show) return null;
  return createPortal(
    <div data-two-step-prompt className="two-step-fade fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="two-step-prompt-title"
        aria-describedby="two-step-prompt-hint"
        className="two-step-pop relative my-auto w-full max-w-md overflow-hidden rounded-3xl bg-card p-6 text-center shadow-2xl ring-1 ring-fg/10 sm:p-8"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent" />
        <div className="relative">
          <div className="mx-auto grid w-fit place-items-center">
            <Shield />
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[rgb(var(--brand-deep))] dark:text-primary">{w.kicker}</p>
          <h2 id="two-step-prompt-title" className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
            {w.title}
          </h2>
          <p id="two-step-prompt-hint" className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {w.hint}
          </p>
          <ul className="mt-5 space-y-2.5 rounded-2xl bg-soft/70 p-4 text-start text-sm">
            {w.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[rgb(var(--brand-deep))] dark:text-primary">{check}</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/settings#two-step"
            onClick={close}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-onink shadow-sm transition hover:bg-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {w.yes}
          </Link>
          <button
            type="button"
            onClick={close}
            className="mt-2.5 h-11 w-full rounded-xl text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {w.skip}
          </button>
          <p className="mt-2 text-xs text-muted">{w.later}</p>
        </div>
      </div>
      <style>{`@keyframes twoStepFade{from{opacity:0}to{opacity:1}}@keyframes twoStepPop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}@keyframes twoStepSpark{0%,100%{opacity:.35}50%{opacity:1}}.two-step-fade{animation:twoStepFade .25s ease-out}.two-step-pop{animation:twoStepPop .3s cubic-bezier(.2,.8,.2,1)}.two-step-spark{animation:twoStepSpark 2.4s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.two-step-fade,.two-step-pop,.two-step-spark{animation:none}}`}</style>
    </div>,
    document.body,
  );
}
