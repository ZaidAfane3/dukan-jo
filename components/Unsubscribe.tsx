"use client";

import { useState } from "react";
import { brandName } from "./content";

/* The page a store's campaign email links to for "Unsubscribe" (app/unsubscribe, server/campaigns.ts). One button stops
   that store's campaigns to this address; "Subscribe again" undoes it. In the language the email was read in (the link's
   l=), with a switch to the other. A link that isn't a real one says so and offers nothing. */

const words = {
  ar: {
    title: "إلغاء الاشتراك",
    ask: (s: string) => `هل تريد إيقاف رسائل متجر «${s}» إلى بريدك؟`,
    note: "لن تصلك حملات هذا المتجر التسويقية بعد الآن، ويمكنك الاشتراك من جديد متى شئت.",
    button: "إلغاء الاشتراك",
    busy: "جارٍ الحفظ…",
    done: (s: string) => `تم. لن تصلك حملات متجر «${s}» بعد الآن.`,
    again: "الاشتراك من جديد",
    back: (s: string) => `أنت مشترك من جديد في رسائل متجر «${s}».`,
    bad: "هذا الرابط غير صالح أو انتهت صلاحيته. افتح رابط إلغاء الاشتراك من آخر رسالة وصلتك.",
    fail: "تعذّر الحفظ. تحقّق من اتصالك وحاول مجددًا.",
    other: "English",
    by: "أُرسلت الرسائل عبر دكان.",
  },
  en: {
    title: "Unsubscribe",
    ask: (s: string) => `Stop emails from ${s}?`,
    note: "You won't get this store's marketing campaigns any more. You can subscribe again at any time.",
    button: "Unsubscribe",
    busy: "Saving…",
    done: (s: string) => `Done. You won't get campaigns from ${s} any more.`,
    again: "Subscribe again",
    back: (s: string) => `You're subscribed to ${s}'s emails again.`,
    bad: "This link isn't valid. Open the unsubscribe link from the latest email you got.",
    fail: "It couldn't be saved. Check your connection and try again.",
    other: "العربية",
    by: "The emails were sent with Dukkan.",
  },
};

export function Unsubscribe({ token, store, done, lang }: { token: string; store: string; done: boolean; lang: "ar" | "en" }) {
  const w = words[lang];
  const [state, setState] = useState<"ask" | "done" | "back">(done ? "done" : "ask");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async (undo: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await fetch("/api/public/unsubscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, ...(undo ? { undo: true } : {}) }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState(undo ? "back" : "done");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

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
            <button type="button" disabled={busy} onClick={() => void send(false)} className={`${btn} mt-6 w-full bg-primary text-white hover:bg-deep`}>
              {busy ? w.busy : w.button}
            </button>
          </>
        ) : (
          <>
            <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
              {state === "done" ? w.done(store) : w.back(store)}
            </p>
            {state === "done" && (
              <button type="button" disabled={busy} onClick={() => void send(true)} className={`${btn} mt-5 w-full border border-fg/20 hover:bg-soft`}>
                {busy ? w.busy : w.again}
              </button>
            )}
          </>
        )}
        {failed && <p role="alert" className="mt-3 text-sm text-rose-600">{w.fail}</p>}
        <p className="mt-6 text-xs text-muted">{w.by}</p>
      </div>
    </main>
  );
}
