"use client";

import { useRef, useState } from "react";
import { PAUSE_DAYS, UNSUB_MESSAGE_DEFAULT, UNSUB_REASONS, type UnsubReason } from "./campaignRules";
import { brandName, dateLocale } from "./content";

/* The page a store's campaign email links to for "Unsubscribe" (app/unsubscribe, server/campaigns.ts), and where a mail
   app's own "Unsubscribe" leads too. It shows the store's name and logo and the merchant's own short words (or the
   default ones). The reader types the address the email came to, may say why (only counted for the store, never kept
   with the address), and chooses: pause the store's emails for PAUSE_DAYS, or unsubscribe from them. Only that address
   counts (a wrong one is told so, never which one it should be). "Subscribe again" undoes either, with the same
   address. In the language the email was read in (the link's l=), with a switch to the other; every answer after a
   choice stays in that language. A link that isn't a real one says so and offers nothing. */

const words = {
  ar: {
    title: "إلغاء الاشتراك",
    ask: (s: string) => `هل تريد إيقاف رسائل متجر «${s}» إلى بريدك؟`,
    email: "بريدك الإلكتروني",
    emailHint: "اكتب عنوان البريد الذي وصلتك عليه الرسالة.",
    reason: "لماذا تغادر؟ (اختياري)",
    reasonNone: "اختر سببًا",
    reasons: {
      "too-many": "تصلني رسائل كثيرة",
      "not-relevant": "الرسائل لا تهمّني",
      "never-signed-up": "لم أشترك أصلًا",
      other: "سبب آخر",
    } as Record<UnsubReason, string>,
    reasonHint: "لا يرى المتجر إلا عدد من اختار كل سبب، ولا يرى بريدك.",
    pause: `إيقاف رسائل هذا المتجر مؤقتًا لمدة ${PAUSE_DAYS} يومًا`,
    unsubscribe: "إلغاء الاشتراك في رسائل هذا المتجر",
    busy: "جارٍ الحفظ…",
    done: (s: string) => `تم. لن تصلك حملات متجر «${s}» بعد الآن.`,
    paused: (s: string, d: string) => `تم الإيقاف المؤقت. لن تصلك رسائل متجر «${s}» حتى ${d}، ثم تعود إليك تلقائيًا.`,
    again: "الاشتراك من جديد",
    unsubInstead: "إلغاء الاشتراك نهائيًا بدلًا من ذلك",
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
    email: "Your email",
    emailHint: "Type the email address this message was sent to.",
    reason: "Why are you leaving? (optional)",
    reasonNone: "Choose a reason",
    reasons: {
      "too-many": "I get too many emails",
      "not-relevant": "The emails aren't relevant to me",
      "never-signed-up": "I never signed up",
      other: "Another reason",
    } as Record<UnsubReason, string>,
    reasonHint: "The store only sees how many people chose each reason, never your email.",
    pause: `Pause this store's emails for ${PAUSE_DAYS} days`,
    unsubscribe: "Unsubscribe from this store's emails",
    busy: "Saving…",
    done: (s: string) => `Done. You won't get campaigns from ${s} any more.`,
    paused: (s: string, d: string) => `Paused. You won't get emails from ${s} until ${d}. After that they start again on their own.`,
    again: "Subscribe again",
    unsubInstead: "Unsubscribe for good instead",
    back: (s: string) => `You're subscribed to ${s}'s emails again.`,
    bad: "This link isn't valid. Open the unsubscribe link from the latest email you got.",
    mismatch: "This email doesn't match the address this message was sent to. Check it and try again.",
    slow: "Too many tries. Wait a while and try again.",
    fail: "It couldn't be saved. Check your connection and try again.",
    other: "العربية",
    by: "The emails were sent with Dukkan.",
  },
};

type State = "ask" | "unsubscribed" | "paused" | "back";
type Action = "unsubscribe" | "pause" | "undo";

export function Unsubscribe({ token, store, logo, message, state: first, until: firstUntil, lang }: {
  token: string;
  store: string;
  logo: string;
  /* the merchant's own words in this language ("" for the default ones) */
  message: string;
  state: "none" | "paused" | "unsubscribed";
  until: string | null;
  lang: "ar" | "en";
}) {
  const w = words[lang];
  const [state, setState] = useState<State>(first === "none" ? "ask" : first);
  const [until, setUntil] = useState(firstUntil);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<UnsubReason | "">("");
  /* the address once it proved to be the right one: the next choice then needs no typing */
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [problem, setProblem] = useState<"fail" | "mismatch" | "slow" | null>(null);

  const send = async (action: Action) => {
    setBusy(action);
    setProblem(null);
    try {
      const r = await fetch("/api/public/unsubscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        /* the reason only with the first choice: one person's reason is counted once */
        body: JSON.stringify({ t: token, email, action, ...(state === "ask" && action !== "undo" && reason ? { reason } : {}) }),
      });
      const b = (await r.json().catch(() => null)) as { result?: string; state?: string; until?: string | null } | null;
      if (r.status === 400 && b?.result === "mismatch") return setProblem("mismatch");
      if (r.status === 429) return setProblem("slow");
      if (!r.ok) throw new Error(String(r.status));
      setKnown(true);
      setUntil(typeof b?.until === "string" ? b.until : null);
      setState(action === "undo" ? "back" : b?.state === "paused" ? "paused" : "unsubscribed");
    } catch {
      setProblem("fail");
    } finally {
      setBusy(null);
    }
  };
  /* the button pressed (its click comes before the form's submit), so the browser still checks the address field
     (required, an email) before anything is sent */
  const chosen = useRef<Action>("unsubscribe");
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(chosen.current);
  };
  const choose = (a: Action) => () => (chosen.current = a);
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
  const untilText = until
    ? new Intl.DateTimeFormat(dateLocale(lang), { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Amman" }).format(new Date(until))
    : "";

  const other = lang === "ar" ? "en" : "ar";
  const btn = "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const primary = `${btn} w-full bg-primary text-white hover:bg-deep`;
  const plain = `${btn} w-full border border-fg/20 hover:bg-soft`;
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
        {token && (
          <div className="mt-5 flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-fg/10" />
            )}
            <p className="min-w-0 truncate font-bold" dir="auto">{store}</p>
          </div>
        )}
        <h1 className="mt-5 text-xl font-bold">{w.title}</h1>
        {!token ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{w.bad}</p>
        ) : state === "ask" ? (
          <>
            <p className="mt-3 font-semibold leading-relaxed">{w.ask(store)}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{message || UNSUB_MESSAGE_DEFAULT[lang]}</p>
            <form onSubmit={submit}>
              {emailField}
              <div className="mt-4">
                <label htmlFor="unsub-reason" className="text-sm font-semibold">{w.reason}</label>
                <select
                  id="unsub-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as UnsubReason | "")}
                  aria-describedby="unsub-reason-hint"
                  className="mt-1.5 h-11 w-full rounded-xl border border-fg/20 bg-page px-3 text-sm text-fg outline-none focus:border-primary"
                >
                  <option value="">{w.reasonNone}</option>
                  {UNSUB_REASONS.map((x) => <option key={x} value={x}>{w.reasons[x]}</option>)}
                </select>
                <p id="unsub-reason-hint" className="mt-1.5 text-xs text-muted">{w.reasonHint}</p>
              </div>
              <div className="mt-5 grid gap-2.5">
                {/* the first, so Enter in the address field unsubscribes, as the email's link said */}
                <button type="submit" onClick={choose("unsubscribe")} disabled={!!busy} className={primary}>
                  {busy === "unsubscribe" ? w.busy : w.unsubscribe}
                </button>
                <button type="submit" onClick={choose("pause")} disabled={!!busy} className={plain}>
                  {busy === "pause" ? w.busy : w.pause}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
              {state === "unsubscribed" ? w.done(store) : state === "paused" ? w.paused(store, untilText) : w.back(store)}
            </p>
            {state !== "back" && (
              <form onSubmit={submit}>
                {!known && emailField}
                <div className="mt-5 grid gap-2.5">
                  <button type="submit" onClick={choose("undo")} disabled={!!busy} className={plain}>
                    {busy === "undo" ? w.busy : w.again}
                  </button>
                  {state === "paused" && (
                    <button type="submit" onClick={choose("unsubscribe")} disabled={!!busy} className={plain}>
                      {busy === "unsubscribe" ? w.busy : w.unsubInstead}
                    </button>
                  )}
                </div>
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
