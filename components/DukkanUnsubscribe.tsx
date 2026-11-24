"use client";

import { useState } from "react";
import { brandName } from "./content";

/* The page "Stop Dukkan's marketing emails" in a campaign from Dukkan's team leads to (app/unsubscribe/dukkan,
   server/merchantCampaigns.ts). One button turns those emails off for the merchant's account; "Turn them on again"
   undoes it. His account's own emails (sign-in codes, new orders, tickets) are not marketing and still come. In the
   language the email was read in (the link's l=), with a switch to the other. A link that isn't a real one says so. */

const words = {
  ar: {
    title: "رسائل دكان التسويقية",
    ask: "هل تريد إيقاف رسائل دكان التسويقية إلى بريدك؟",
    note: "لن تصلك أخبار دكان وعروضه بعد الآن. رسائل حسابك (رموز الدخول والطلبات الجديدة والردود على تذاكرك) تبقى كما هي. ويمكنك تشغيلها من جديد متى شئت.",
    button: "إيقاف الرسائل التسويقية",
    busy: "جارٍ الحفظ…",
    done: "تم. لن تصلك رسائل دكان التسويقية بعد الآن.",
    again: "تشغيلها من جديد",
    back: "ستصلك رسائل دكان التسويقية من جديد.",
    bad: "هذا الرابط غير صالح. افتح رابط الإيقاف من آخر رسالة وصلتك من دكان.",
    fail: "تعذّر الحفظ. تحقّق من اتصالك وحاول مجددًا.",
    other: "English",
  },
  en: {
    title: "Dukkan's marketing emails",
    ask: "Stop Dukkan's marketing emails to you?",
    note: "You won't get Dukkan's news and offers any more. Your account's own emails (sign-in codes, new orders, replies to your tickets) still come. You can turn them on again at any time.",
    button: "Stop marketing emails",
    busy: "Saving…",
    done: "Done. You won't get Dukkan's marketing emails any more.",
    again: "Turn them on again",
    back: "You'll get Dukkan's marketing emails again.",
    bad: "This link isn't valid. Open the link from the latest email Dukkan sent you.",
    fail: "It couldn't be saved. Check your connection and try again.",
    other: "العربية",
  },
};

export function DukkanUnsubscribe({ token, done, lang }: { token: string; done: boolean; lang: "ar" | "en" }) {
  const w = words[lang];
  const [state, setState] = useState<"ask" | "done" | "back">(done ? "done" : "ask");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async (undo: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await fetch("/api/public/dukkan-unsubscribe", {
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
            <a href={`/unsubscribe/dukkan?t=${encodeURIComponent(token)}&l=${other}`} className="text-sm font-semibold text-muted hover:text-fg" lang={other}>
              {w.other}
            </a>
          )}
        </div>
        <h1 className="mt-5 text-xl font-bold">{w.title}</h1>
        {!token ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{w.bad}</p>
        ) : state === "ask" ? (
          <>
            <p className="mt-3 font-semibold leading-relaxed">{w.ask}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{w.note}</p>
            <button type="button" disabled={busy} onClick={() => void send(false)} className={`${btn} mt-6 w-full bg-primary text-white hover:bg-deep`}>
              {busy ? w.busy : w.button}
            </button>
          </>
        ) : (
          <>
            <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
              {state === "done" ? w.done : w.back}
            </p>
            {state === "done" && (
              <button type="button" disabled={busy} onClick={() => void send(true)} className={`${btn} mt-5 w-full border border-fg/20 hover:bg-soft`}>
                {busy ? w.busy : w.again}
              </button>
            )}
          </>
        )}
        {failed && <p role="alert" className="mt-3 text-sm text-rose-600">{w.fail}</p>}
      </div>
    </main>
  );
}
