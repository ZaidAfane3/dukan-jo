"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TWO_STEP_ASK, TWO_STEP_NEW } from "./accounts";
import { brandName } from "./content";
import { DashSkeleton } from "./DashSkeleton";
import { isStaffPage } from "./diwan/nav";
import { popupSlot, popupSlotChanged, watchStarted } from "./MerchantPopup";
import { signedInAs } from "./demoSandbox";
import { merchantCall, onServer } from "./merchantApi";
import { LangSwitch, ThemeToggle, usePrefs } from "./Prefs";
import { loadSetup } from "./setup";

/* Right after signing up or in (accounts.ts marks the tab with TWO_STEP_ASK; signing in with a 2-step code does not), a
   full page over the dashboard asks to turn 2-step sign-in on. Its button opens TwoStepSettings on
   /settings#two-step-start, which opens the setup at once (the password is all it asks). "Not now" (or Esc) hides it for this sign-in only: it is
   back on the next sign-in, until the code is on.

   When it shows. It never lands on top of something the merchant has started:
   - only as a page opens: it takes the tab's pop-up place (popupSlot) at once, before Dukkan's pop-ups and the
     rejected-document one, and asks the server whether the code is on;
   - the answer is in and nothing was touched yet (no click, key or typing, no dialog, drawer or checkout open, nothing
     focused to type in: MerchantPopup.tsx watchStarted / pageIsCalm, the rule every pop-up follows) and it came
     within LATE: it shows;
   - otherwise it waits for the next page that opens. The answer is kept for this tab ("off"), so there it shows the
     moment the page opens, with no wait; the place stays taken on the page it gave up, so no other pop-up drops on a
     merchant who is busy there either;
   - never on the settings page (visiting it makes the next page ask the server again, the code may be on now), never
     in the designer, the platform tour, staff pages or a store's public pages (they do not draw the dashboard bar);
   - never during or right after signing up: not until the store setup (the 6 tasks of /onboarding) is finished, or the
     account is 3 days old with the setup still unfinished (OLD_ENOUGH, from the first time this browser saw it), and
     not in a new account's first minutes (FIRST_WAIT). Until then the ask is kept for a later page of this sign-in.
   The page is checked again on every move inside the app and right before it shows. Signed in on Dukkan's server only.

   While the server is asked (right after signing in, nothing known yet), the page shows the dashboard's loading look over
   it, decided before the page is painted: the dashboard never shows first only to be swapped for this page seconds later.
   The answer comes (the code is on: the dashboard; off: this page) or LATE passes (the dashboard; asked on the next
   page). */

const words = {
  en: {
    title: "Protect your account with 2-step sign-in",
    why: "Every time you sign in, we'll also email you a 6-digit code. Someone who learns your password still can't get in without it.",
    stepsTitle: "It takes less than a minute:",
    steps: [
      "Choose how to get the code: by email (WhatsApp is coming soon).",
      "Type your password to turn it on, and you're done.",
      "From then on, each sign-in also asks for a 6-digit code we email you.",
    ],
    yes: "Turn on 2-step sign-in",
    later: "Not now",
    remind: "We'll remind you the next time you sign in.",
  },
  ar: {
    title: "احمِ حسابك بالتحقق بخطوتين",
    why: "في كل مرة تسجّل فيها الدخول سنرسل إلى بريدك أيضًا رمزًا من 6 أرقام. فمن يعرف كلمة مرورك لن يستطيع الدخول بدونه.",
    stepsTitle: "يستغرق الأمر أقل من دقيقة:",
    steps: [
      "اختر طريقة استلام الرمز: عبر البريد الإلكتروني (واتساب قريبًا).",
      "اكتب كلمة المرور لتفعيله، وانتهى.",
      "بعدها يطلب كل تسجيل دخول أيضًا رمزًا من 6 أرقام نرسله إلى بريدك.",
    ],
    yes: "فعّل التحقق بخطوتين",
    later: "ليس الآن",
    remind: "سنذكّرك عند تسجيل دخولك القادم.",
  },
};

/* the server's answer later than this after the page opened: it waits for the next page instead of showing late */
const LATE = 6000;
/* pages it never shows on (the settings page has the setup itself; onboarding and the designer are work in progress) */
const NOT_ON = ["/settings", "/onboarding", "/design", "/demo"];
const notOn = (path: string) => NOT_ON.some((p) => path === p || path.startsWith(`${p}/`));
/* a brand-new account is not asked in its first minutes, even with the setup done quickly */
const FIRST_WAIT = 10 * 60_000;
/* the store setup is finished: all 6 tasks of /onboarding (SignupForm.tsx sends a signed-in store there until then) */
const setupDone = () => (loadSetup()?.done ?? []).filter(Boolean).length >= 6;
/* made in this tab less than FIRST_WAIT ago (accounts.ts createAccount) */
const brandNew = () => {
  try {
    const at = Number(sessionStorage.getItem(TWO_STEP_NEW));
    return at > 0 && Date.now() - at < FIRST_WAIT;
  } catch {
    return false;
  }
};
/* a store whose setup is never finished is still asked, once the account is this old */
const OLD_ENOUGH = 3 * 24 * 60 * 60_000;
/* the client has no account creation time: the first time this browser saw the signed-in account stands for it */
const FIRST_SEEN = "dukkan-2fa-first-seen:";
const seenSince = (): number => {
  const me = signedInAs();
  const now = Date.now();
  if (!me) return now;
  try {
    const key = FIRST_SEEN + me;
    const at = Number(localStorage.getItem(key));
    if (at > 0 && at <= now) return at;
    localStorage.setItem(key, String(now));
  } catch {
    /* storage blocked: counted from now */
  }
  return now;
};
/* whether it may ask on this page now; when not, the ask stays for a later page */
const mayAsk = (path: string) => !notOn(path) && !brandNew() && (setupDone() || Date.now() - seenSince() >= OLD_ENOUGH);

/* the tab's mark: "1" asked after signing in, the server not asked yet; "off" the server said the code is off */
const readMark = () => {
  try {
    return sessionStorage.getItem(TWO_STEP_ASK);
  } catch {
    return null;
  }
};
const setMark = (v: "1" | "off") => {
  try {
    sessionStorage.setItem(TWO_STEP_ASK, v);
  } catch {
    /* storage blocked */
  }
};
/** Not asked again in this tab (until the next sign-in marks it again) */
const forget = () => {
  try {
    sessionStorage.removeItem(TWO_STEP_ASK);
  } catch {
    /* storage blocked */
  }
};

/* the brand mark as on the sign-in page (Nav.tsx Logo), without its link home: leaving is "Not now" */
function Mark({ lang }: { lang: "en" | "ar" }) {
  return (
    <span className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-fg">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
        </svg>
      </span>
      {brandName(lang)}
    </span>
  );
}

/* how long the page takes to fade away once closed (globals.css .two-step-out); it is drawn until then */
const OUT_MS = 160;

export function TwoStepPrompt() {
  const { lang } = usePrefs();
  const w = words[lang];
  /* drawn into the page only on a page that may ask (so the portal is not there on every page) */
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);
  /* the server is being asked whether the code is on: the loading look covers the page until the answer (or LATE) */
  const [waiting, setWaiting] = useState(false);
  /* drawn: shown, or fading away after it closed (CSS in globals.css: .two-step-in / .two-step-rise / .two-step-out) */
  const [drawn, setDrawn] = useState(false);
  if (show && !drawn) setDrawn(true);
  const leaving = drawn && !show;
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setDrawn(false), OUT_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);
  const box = useRef<HTMLDivElement>(null);
  const yes = useRef<HTMLAnchorElement>(null);
  /* whether this one holds the tab's pop-up place (read when the page goes away, after the state may have moved on) */
  const holds = useRef({ on: false });
  /* the page the app is on, checked again on every move inside the app (the bar may stay drawn across a move) */
  const pathname = usePathname();
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);

  /* a layout effect: whether the page waits for the answer is known before it is painted */
  useLayoutEffect(() => {
    const path = pathname || window.location.pathname;
    if (!onServer() || isStaffPage(path, window.location.search)) return;
    /* the account's first-seen time starts counting on its first page here (setup included) */
    seenSince();
    const mark = readMark();
    if (notOn(path)) {
      /* the code may be turned on here: the next page asks the server again instead of trusting "off" */
      if (path.startsWith("/settings") && mark === "off") setMark("1");
      return;
    }
    if (mark !== "1" && mark !== "off") return;
    /* the setup is not finished or the account is minutes old: the ask is kept for a later page */
    if (!mayAsk(path)) return;
    if (popupSlot.open) return;
    popupSlot.open = true;
    const h = holds.current;
    h.on = true;
    setReady(true);
    let gone = false;
    let decided = false;
    const opened = Date.now();
    /* the end of the loading look when the answer is late */
    let late = 0;

    /* anything the merchant starts on this page before the answer is in (MerchantPopup.tsx: the same rule for every
       pop-up) */
    const watch = watchStarted();
    const unwatch = watch.stop;

    const giveBack = () => {
      if (!h.on) return;
      h.on = false;
      popupSlot.open = false;
      popupSlotChanged();
    };
    /* the code is off: shown now if the page is calm, else on the next page that opens (the place stays taken here) */
    const offNow = () => {
      if (decided) return;
      decided = true;
      setWaiting(false);
      const busy = watch.busy();
      unwatch();
      /* checked again right before it shows: the app may have moved to a page it never shows on meanwhile */
      const stillHere = here.current === path && window.location.pathname === path && mayAsk(path);
      if (!busy && stillHere && Date.now() - opened <= LATE) return setShow(true);
      setMark("off");
      if (!stillHere) giveBack();
    };

    if (mark === "off") {
      /* known from an earlier page: shown as this page opens, no waiting for the server */
      offNow();
      /* still checked: turned on meanwhile (another tab), or signed out: closed and not asked again */
      void merchantCall("/api/auth/totp/setup", "GET").then((r) => {
        if (gone || !r || r.status >= 500 || (r.status === 200 && r.data.on === false)) return;
        forget();
        setShow(false);
        giveBack();
      });
    } else {
      /* nothing known yet: the loading look until the answer, never the dashboard first */
      setWaiting(true);
      late = window.setTimeout(() => setWaiting(false), LATE);
      void merchantCall("/api/auth/totp/setup", "GET").then((r) => {
        window.clearTimeout(late);
        if (gone) return;
        if (r?.status === 200 && r.data.on === false) return offNow();
        setWaiting(false);
        unwatch();
        /* on already (or signed out): nothing to ask in this tab; the server unreachable: asked again on the next page */
        if (r && r.status < 500) forget();
        giveBack();
      });
    }
    return () => {
      gone = true;
      window.clearTimeout(late);
      unwatch();
      /* leaving the page frees the tab for the next one (the others on the next page ask for it themselves); not answered
         yet, it is asked on that page (the mark stays) */
      if (h.on) popupSlot.open = false;
      h.on = false;
      setShow(false);
      setWaiting(false);
    };
  }, [pathname]);

  /* "Not now" and "Turn on" both end it for this sign-in; the place is free for the next pop-up */
  const close = () => {
    forget();
    setShow(false);
    if (holds.current.on) {
      holds.current.on = false;
      popupSlot.open = false;
      popupSlotChanged();
    }
  };

  /* while it is open: Esc is "Not now", Tab stays inside it, the page under it does not scroll, and the focus comes back */
  useEffect(() => {
    if (!show) return;
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(box.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    (yes.current ?? focusables()[0])?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return close();
      }
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
      before?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!ready) return null;
  return createPortal(
    <>
    {/* the answer is not in yet: the page's loading look over it (the dashboard's, as the page itself shows it first) */}
    {waiting && !show && (
      <div data-two-step-wait className="fixed inset-0 z-[110] overflow-hidden bg-page">
        <DashSkeleton variant={pathname === "/dashboard" ? "home" : "form"} />
      </div>
    )}
    {drawn && (
        <div
          ref={box}
          data-two-step-prompt
          data-dukkan-popup
          role="dialog"
          aria-modal="true"
          aria-labelledby="two-step-prompt-title"
          aria-describedby="two-step-prompt-why"
          className={`dash fixed inset-0 z-[110] flex flex-col overflow-y-auto bg-page text-fg ${leaving ? "two-step-out" : "two-step-in"}`}
        >
          <header className="flex items-center justify-between px-6 py-6 sm:px-10">
            <Mark lang={lang} />
            <div className="flex items-center gap-2">
              <LangSwitch />
              <ThemeToggle />
            </div>
          </header>

          <main
            data-lang-fade
            className="two-step-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16 pt-4 sm:px-0"
          >
            <h1 id="two-step-prompt-title" className="text-3xl font-extrabold leading-tight tracking-tight">
              {w.title}
            </h1>
            <p id="two-step-prompt-why" className="mt-4 text-base leading-relaxed text-muted">
              {w.why}
            </p>

            <p className="mt-10 text-sm font-semibold">{w.stepsTitle}</p>
            <ol className="mt-3 border-t border-fg/10">
              {w.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-4 border-b border-fg/10 py-4">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-fg/20 text-sm font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>

            <Link
              ref={yes}
              href="/settings#two-step-start"
              onClick={close}
              className="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page motion-reduce:hover:translate-y-0"
            >
              {w.yes}
            </Link>
            <button
              type="button"
              onClick={close}
              className="mt-3 h-12 w-full rounded-xl text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {w.later}
            </button>
            <p className="mt-3 text-center text-xs text-muted">{w.remind}</p>
          </main>
        </div>
      )}
    </>,
    document.body,
  );
}
