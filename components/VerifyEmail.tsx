"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Lang } from "./content";
import { demoActive, signedInAs } from "./demoSandbox";
import { latin } from "./digits";
import { merchantCall } from "./merchantApi";
import { usePrefs } from "./Prefs";

/* The merchant confirms his email with the 6-digit code Dukkan sent it (app/api/auth/verify-email, server/emailVerify.ts).
   A slim banner at the top of every dashboard page (DashboardBar) while it is not confirmed; it goes once it is. Going
   live waits for it (ReadyToSell "email"); a store already live is never taken offline for it. Nothing shows while
   Dukkan can't send email (/api/auth/me then says emailVerified: true) or in the platform tour. */

const words = {
  en: {
    title: "Confirm your email address",
    sentTo: "We sent a 6-digit code to",
    why: "Your store can go live once it's confirmed.",
    label: "6-digit code",
    confirm: "Confirm",
    confirming: "Checking…",
    resend: "Send a new code",
    resendIn: (s: number) => `Send a new code in ${s} s`,
    sending: "Sending…",
    sent: "We sent a new code. It works for 10 minutes.",
    done: "Email confirmed",
    short: "Type the 6 digits from the email.",
    wrong: "That code isn't right. Check it and try again.",
    expired: "This code has expired. Send a new one.",
    tooMany: "Too many wrong tries. Send a new code, or try again later.",
    slowDown: "Too many requests. Wait a few minutes and try again.",
    noSender: "Email can't be sent right now. Contact Dukkan support.",
    noAnswer: "No answer from Dukkan. Check your connection and try again.",
  },
  ar: {
    title: "أكّد بريدك الإلكتروني",
    sentTo: "أرسلنا رمزًا من 6 أرقام إلى",
    why: "يمكن نشر متجرك بعد تأكيده.",
    label: "رمز من 6 أرقام",
    confirm: "تأكيد",
    confirming: "جارٍ التحقق…",
    resend: "أرسل رمزًا جديدًا",
    resendIn: (s: number) => `أرسل رمزًا جديدًا بعد ${s} ث`,
    sending: "جارٍ الإرسال…",
    sent: "أرسلنا رمزًا جديدًا. الرمز صالح لمدة 10 دقائق.",
    done: "تم تأكيد بريدك الإلكتروني",
    short: "اكتب الأرقام الستة الموجودة في الرسالة.",
    wrong: "الرمز غير صحيح. تحقّق منه وحاول مرة أخرى.",
    expired: "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.",
    tooMany: "محاولات خاطئة كثيرة. اطلب رمزًا جديدًا أو حاول لاحقًا.",
    slowDown: "طلبات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.",
    noSender: "لا يمكن إرسال البريد الآن. تواصل مع دعم دكّان.",
    noAnswer: "لا يوجد رد من دكّان. تحقق من اتصالك وحاول مجددًا.",
  },
};

/* ---------- whether the signed-in account still has to confirm its email, shared by every part of the page ---------- */

type EmailState = { known: boolean; verified: boolean; email: string };
const NONE: EmailState = { known: false, verified: true, email: "" };
let state: EmailState = NONE;
let askedAt = 0;
let asking: Promise<void> | null = null;
const listeners = new Set<() => void>();
const tell = (next: EmailState) => {
  state = next;
  listeners.forEach((l) => l());
};

/** Asks /api/auth/me again (at most every 30 s unless `force`). Not in the tour: there is no account to confirm. */
export function refreshEmailState(force = false): Promise<void> {
  if (typeof window === "undefined" || demoActive()) return Promise.resolve();
  if (asking) return asking;
  if (!force && askedAt && Date.now() - askedAt < 30_000) return Promise.resolve();
  askedAt = Date.now();
  asking = (async () => {
    try {
      const r = await merchantCall("/api/auth/me", "GET");
      /* signed out: nothing to confirm here (the page's own session check sends him to sign in) */
      if (r?.status === 401 || r?.status === 403) return tell(NONE);
      /* offline, or the server restarting: what was known stays */
      if (r?.status !== 200) return;
      const j = r.data as { emailVerified?: unknown; account?: { email?: unknown } };
      tell({ known: true, verified: j.emailVerified !== false, email: typeof j.account?.email === "string" ? j.account.email : "" });
    } finally {
      asking = null;
    }
  })();
  return asking;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether the signed-in account still has to confirm its email (false until the server said so, and in the tour) */
export function useEmailUnconfirmed(): { unconfirmed: boolean; email: string; known: boolean } {
  const s = useSyncExternalStore(subscribe, () => state, () => NONE);
  useEffect(() => {
    void refreshEmailState();
    /* back to the tab (the email may have been confirmed or changed in another one) */
    const again = () => {
      if (document.visibilityState === "visible") void refreshEmailState();
    };
    document.addEventListener("visibilitychange", again);
    /* the email changed in this tab (Settings: the tab then follows the account's new email, demoSandbox signInAs): asked
       again at once, so the banner names the new address. Only compared here; nothing is fetched while it is the same. */
    const watch = setInterval(() => {
      const me = signedInAs();
      if (state.known && me && me.toLowerCase() !== state.email.toLowerCase()) void refreshEmailState(true);
    }, 3000);
    return () => {
      document.removeEventListener("visibilitychange", again);
      clearInterval(watch);
    };
  }, []);
  return { unconfirmed: s.known && !s.verified, email: s.email, known: s.known };
}

/* ---------- the banner ---------- */

/* seconds before another code can be asked for, kept for the tab so moving between pages doesn't reset it */
const RESEND_SECONDS = 60;
const WAIT_KEY = "dukkan-verify-email-wait";
const readWait = (): number => {
  try {
    return Number(sessionStorage.getItem(WAIT_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeWait = (until: number) => {
  try {
    sessionStorage.setItem(WAIT_KEY, String(until));
  } catch {
    /* storage blocked: the wait lasts for this page only */
  }
};

type Note = { ok: boolean; text: string } | null;

async function post(body: unknown): Promise<{ status: number; result: string; verified: boolean } | null> {
  const r = await merchantCall("/api/auth/verify-email", "POST", body);
  return r && { status: r.status, result: typeof r.data.result === "string" ? r.data.result : "", verified: r.data.verified === true };
}

const problem = (w: (typeof words)[Lang], result: string | undefined): string =>
  result === "wrong" ? w.wrong
  : result === "expired" ? w.expired
  : result === "too-many" ? w.tooMany
  : result === "slow-down" ? w.slowDown
  : result === "no-sender" ? w.noSender
  : result === "invalid" ? w.short
  : w.noAnswer;

export function VerifyEmail() {
  const { lang } = usePrefs();
  const w = words[lang];
  const { unconfirmed, email } = useEmailUnconfirmed();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [done, setDone] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setUntil(readWait()), []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!left) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [left]);
  /* "Email confirmed" for a moment, then the banner goes */
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(t);
  }, [done]);

  if (done)
    return (
      <div className="px-5 pt-4 md:px-10">
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0"><path d="m5 10.5 3.2 3L15 6.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {w.done}
        </p>
      </div>
    );
  if (!unconfirmed) return null;

  const confirm = async () => {
    if (busy) return;
    if (code.length !== 6) return setNote({ ok: false, text: w.short });
    setBusy("check");
    setNote(null);
    const r = await post({ code });
    setBusy(null);
    if (r?.status === 200 && r.result === "ok") {
      setCode("");
      setDone(true);
      tell({ ...state, known: true, verified: true });
      return;
    }
    /* signed out meanwhile: the page's own session check takes it from here */
    if (r?.status === 401) return void refreshEmailState(true);
    setNote({ ok: false, text: problem(w, r?.result) });
  };

  const resend = async () => {
    if (busy || left) return;
    setBusy("send");
    setNote(null);
    const r = await post({ resend: true, lang });
    setBusy(null);
    /* confirmed already (in another tab): the banner goes */
    if (r?.status === 200 && r.verified) {
      setDone(true);
      return tell({ ...state, known: true, verified: true });
    }
    if (r?.status === 200 && r.result === "ok") {
      const next = Date.now() + RESEND_SECONDS * 1000;
      writeWait(next);
      setUntil(next);
      setNow(Date.now());
      setCode("");
      setNote({ ok: true, text: w.sent });
      return;
    }
    if (r?.status === 401) return void refreshEmailState(true);
    setNote({ ok: false, text: problem(w, r?.result) });
  };

  return (
    <div className="px-5 pt-4 md:px-10">
      <section id="verify-email" aria-labelledby="verify-email-title" className="scroll-mt-24 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 dark:bg-primary/[0.1]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:min-w-[16rem]">
            <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-deep dark:text-primary">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4"><rect x="2.5" y="4.5" width="15" height="11" rx="2" /><path d="m3 5.5 7 5.5 7-5.5" strokeLinejoin="round" /></svg>
            </span>
            <div className="min-w-0">
              <p id="verify-email-title" className="text-sm font-bold">{w.title}</p>
              <p className="text-sm text-muted">
                {w.sentTo} <bdi dir="ltr" className="break-all font-semibold text-fg">{email}</bdi>. {w.why}
              </p>
            </div>
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={w.label}
              aria-invalid={(note && !note.ok) || undefined}
              aria-describedby={note ? "verify-email-note" : undefined}
              placeholder="______"
              maxLength={12}
              value={code}
              onChange={(e) => {
                setCode(latin(e.target.value).replace(/\D/g, "").slice(0, 6));
                if (note && !note.ok) setNote(null);
              }}
              className="h-10 w-36 rounded-xl border border-fg/15 bg-card px-3 text-center text-base tracking-[0.35em] outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <button type="submit" disabled={!!busy} className="h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50">
              {busy === "check" ? w.confirming : w.confirm}
            </button>
            <button
              type="button"
              onClick={() => void resend()}
              disabled={!!busy || left > 0}
              className="h-10 rounded-xl px-3 text-sm font-semibold text-deep underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline dark:text-primary dark:disabled:text-muted"
            >
              {busy === "send" ? w.sending : left > 0 ? w.resendIn(left) : w.resend}
            </button>
          </form>
        </div>
        {note && (
          <p id="verify-email-note" role={note.ok ? "status" : "alert"} className={`mt-2 text-sm font-medium ${note.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {note.text}
          </p>
        )}
      </section>
    </div>
  );
}
