"use client";

import { useState } from "react";
import { brandName } from "./content";

/* The page a store's campaign email links to for "Unsubscribe" (app/unsubscribe, server/campaigns.ts), and where a mail
   app's own "Unsubscribe" leads too. The reader types the address the email came to and presses the button: only that
   address stops the store's campaigns (a wrong one is told so, never which one it should be). "Subscribe again" undoes
   it, with the same address. In the language the email was read in (the link's l=), with a switch to the other. A link
   that isn't a real one says so and offers nothing. */

const words = {
  ar: {
    title: "إلغاء الاشتراك",
    ask: (s: string) => `هل تريد إيقاف رسائل متجر «${s}» إلى بريدك؟`,
    note: "لن تصلك حملات هذا المتجر التسويقية بعد الآن، ويمكنك الاشتراك من جديد متى شئت.",
    email: "بريدك الإلكتروني",
    emailHint: "اكتب عنوان البريد الذي وصلتك عليه الرسالة.",
    button: "إلغاء الاشتراك",
    busy: "جارٍ الحفظ…",
    done: (s: string) => `تم. لن تصلك حملات متجر «${s}» بعد الآن.`,
    again: "الاشتراك من جديد",
    back: (s: string) => `أنت مشترك من جديد في رسائل متجر «${s}».`,
    bad: "هذا الرابط غير صالح أو انتهت صلاحيته. افتح رابط إلغاء الاشتراك من آخر رسالة وصلتك.",
    mismatch: "هذا البريد لا يطابق العنوان الذي أُرسلت إليه هذه الرسالة. تحقّق منه وحاول مجددًا.",
    slow: "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.",
    fail: "تعذّر الحفظ. تحقّق من اتصالك وحاول مجددًا.",
    other: "English",
    by: "أُرسلت الرسائل عبر دكان.",
  },
  en: {
    title: "Unsubscribe",
    ask: (s: string) => `Stop emails from ${s}?`,
    note: "You won't get this store's marketing campaigns any more. You can subscribe again at any time.",
    email: "Your email",
    emailHint: "Type the email address this message was sent to.",
    button: "Unsubscribe",
    busy: "Saving…",
    done: (s: string) => `Done. You won't get campaigns from ${s} any more.`,
    again: "Subscribe again",
    back: (s: string) => `You're subscribed to ${s}'s emails again.`,
    bad: "This link isn't valid. Open the unsubscribe link from the latest email you got.",
    mismatch: "This email doesn't match the address this message was sent to. Check it and try again.",
    slow: "Too many tries. Wait a while and try again.",
    fail: "It couldn't be saved. Check your connection and try again.",
    other: "العربية",
    by: "The emails were sent with Dukkan.",
  },
};

export function Unsubscribe({ token, store, done, lang }: { token: string; store: string; done: boolean; lang: "ar" | "en" }) {
  const w = words[lang];
  const [state, setState] = useState<"ask" | "done" | "back">(done ? "done" : "ask");
  const [email, setEmail] = useState("");
  /* the address once it proved to be the right one: "Subscribe again" then needs no typing */
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"fail" | "mismatch" | "slow" | null>(null);

  const send = async (undo: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch("/api/public/unsubscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, email, ...(undo ? { undo: true } : {}) }),
      });
      const b = (await r.json().catch(() => null)) as { result?: string } | null;
      if (r.status === 400 && b?.result === "mismatch") return setProblem("mismatch");
      if (r.status === 429) return setProblem("slow");
      if (!r.ok) throw new Error(String(r.status));
      setKnown(true);
      setState(undo ? "back" : "done");
    } catch {
      setProblem("fail");
    } finally {
      setBusy(false);
    }
  };
  const submit = (undo: boolean) => (e: React.FormEvent) => {
    e.preventDefault();
    void send(undo);
  };
  const emailField = (
    <div className="mt-5">
      <label htmlFor="unsub-email" className="text-sm font-semibold">{w.email}</label>
      <input
        id="unsub-email"
        type="email"
        dir="ltr"
        required
        maxLength={254}
        autoComplete="email"
        value={email}
        onChange={(e) => (setEmail(e.target.value), setProblem(null))}
        aria-invalid={problem === "mismatch"}
        aria-describedby="unsub-email-hint"
        className="mt-1.5 h-11 w-full rounded-xl border border-fg/20 bg-page px-3 text-start text-sm text-fg outline-none focus:border-primary"
      />
      <p id="unsub-email-hint" className="mt-1.5 text-xs text-muted">{w.emailHint}</p>
    </div>
  );

  const other = lang === "ar" ? "en" : "ar";
  const btn = "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="grid min-h-screen place-items-center bg-page px-4 py-10 text-fg">
      <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-sm ring-1 ring-fg/10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-extrabold text-primary">{brandName(lang)}</p>
          {token && (
            <a href={`/unsubscribe?t=${encodeURIComponent(token)}&l=${other}`} className="text-sm font-semibold text-muted hover:text-fg" lang={other}>
              {w.other}
            </a>
          )}
        </div>
        <h1 className="mt-5 text-xl font-bold">{w.title}</h1>
        {!token ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{w.bad}</p>
        ) : state === "ask" ? (
          <>
            <p className="mt-3 font-semibold leading-relaxed">{w.ask(store)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{w.note}</p>
            <form onSubmit={submit(false)}>
              {emailField}
              <button type="submit" disabled={busy} className={`${btn} mt-5 w-full bg-primary text-white hover:bg-deep`}>
                {busy ? w.busy : w.button}
              </button>
            </form>
          </>
        ) : (
          <>
            <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
              {state === "done" ? w.done(store) : w.back(store)}
            </p>
            {state === "done" && (
              <form onSubmit={submit(true)}>
                {!known && emailField}
                <button type="submit" disabled={busy} className={`${btn} mt-5 w-full border border-fg/20 hover:bg-soft`}>
                  {busy ? w.busy : w.again}
                </button>
              </form>
            )}
          </>
        )}
        {problem && <p role="alert" className="mt-3 text-sm text-rose-600">{w[problem]}</p>}
        <p className="mt-6 text-xs text-muted">{w.by}</p>
      </div>
    </main>
  );
}
