"use client";

import { useEffect, useState } from "react";
import { REASON_WORDS, REPORT_LIMITS, REPORT_REASONS, type ReportReason } from "../storeReports";
import { visibleLength } from "../safe";

/* "Report this store": a small link beside "Made with Dukkan" in every store's footer (StorefrontTheme.tsx), for
   customers who think a store is a scam or sells fake or banned goods. It opens a short form that goes to Dukkan's
   team (app/api/store-reports → Diwan's Store reports). The store's owner, the designer and the theme previews never
   show it. Its words are its own, in both languages, and it keeps plain colors so it reads the same in every theme. */

const words = {
  en: {
    link: "Report this store",
    title: "Report this store to Dukkan",
    intro: "Tell Dukkan's team what is wrong. The store is not told who sent this.",
    reason: "What is the problem?",
    details: "What happened?",
    detailsPh: "For example: I paid and never got my order, and the store doesn't answer.",
    detailsShort: `Write at least ${REPORT_LIMITS.min} characters.`,
    contact: "Your email or phone (optional)",
    contactHint: "Only if you want Dukkan to be able to reach you about it.",
    send: "Send report",
    sending: "Sending…",
    cancel: "Cancel",
    close: "Close",
    thanks: "Thank you. Dukkan's team will look into it.",
    slow: "You sent several reports already. Try again later.",
    failed: "Couldn't send. Check your connection and try again.",
  },
  ar: {
    link: "الإبلاغ عن المتجر",
    title: "الإبلاغ عن هذا المتجر لدكان",
    intro: "أخبر فريق دكان بالمشكلة. لن يعرف المتجر من أرسل البلاغ.",
    reason: "ما المشكلة؟",
    details: "ماذا حدث؟",
    detailsPh: "مثال: دفعت ولم يصلني طلبي، والمتجر لا يرد.",
    detailsShort: `اكتب ${REPORT_LIMITS.min} أحرف على الأقل.`,
    contact: "بريدك أو رقمك (اختياري)",
    contactHint: "فقط إن أردت أن يتواصل معك فريق دكان بخصوص البلاغ.",
    send: "إرسال البلاغ",
    sending: "جارٍ الإرسال…",
    cancel: "إلغاء",
    close: "إغلاق",
    thanks: "شكرًا لك. سيراجع فريق دكان البلاغ.",
    slow: "أرسلت عدة بلاغات بالفعل. حاول لاحقًا.",
    failed: "تعذّر الإرسال. تحقق من اتصالك وحاول مجددًا.",
  },
};

export function ReportStore({ slug, lang }: { slug: string; lang: "en" | "ar" }) {
  const w = words[lang];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("scam");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state !== "sending" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, state]);

  const start = () => {
    setReason("scam");
    setBody("");
    setContact("");
    setError("");
    setState("form");
    setOpen(true);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (visibleLength(body) < REPORT_LIMITS.min) return setError(w.detailsShort);
    setState("sending");
    setError("");
    try {
      const r = await fetch("/api/store-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, body, contact }),
      });
      if (r.ok) return setState("done");
      setError(r.status === 429 ? w.slow : r.status === 400 ? w.detailsShort : w.failed);
    } catch {
      setError(w.failed);
    }
    setState("form");
  };

  const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/15";

  return (
    <>
      <button type="button" onClick={start} className="underline-offset-2 hover:underline">
        {w.link}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && state !== "sending" && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={w.title} dir={lang === "ar" ? "rtl" : "ltr"} className="my-8 w-full max-w-md rounded-2xl bg-white p-6 text-start text-sm text-neutral-900 shadow-2xl">
            {state === "done" ? (
              <div className="text-center">
                <p role="status" className="text-base font-bold">{w.thanks}</p>
                <button type="button" onClick={() => setOpen(false)} className="mt-5 h-11 rounded-lg bg-neutral-900 px-6 font-semibold text-white hover:bg-neutral-700">{w.close}</button>
              </div>
            ) : (
              <form onSubmit={send} noValidate>
                <h2 className="text-lg font-bold">{w.title}</h2>
                <p className="mt-1 text-neutral-600">{w.intro}</p>
                <fieldset className="mt-5">
                  <legend className="mb-2 font-semibold">{w.reason}</legend>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-2.5">
                        <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-neutral-900" />
                        {REASON_WORDS[r][lang]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="report-body" className="mb-2 mt-5 block font-semibold">{w.details}</label>
                <textarea id="report-body" value={body} onChange={(e) => { setBody(e.target.value); setError(""); }} maxLength={REPORT_LIMITS.body} rows={4} placeholder={w.detailsPh} aria-invalid={!!error} className={`${input} py-2`} />
                <label htmlFor="report-contact" className="mb-2 mt-4 block font-semibold">{w.contact}</label>
                <input id="report-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={REPORT_LIMITS.contact} dir="ltr" autoComplete="email" className={`${input} h-11 text-start`} />
                <p className="mt-1 text-xs text-neutral-500">{w.contactHint}</p>
                {error && <p role="alert" className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
                <div className="mt-6 flex gap-3">
                  <button type="submit" disabled={state === "sending"} className="h-11 flex-1 rounded-lg bg-neutral-900 font-semibold text-white hover:bg-neutral-700 disabled:opacity-60">{state === "sending" ? w.sending : w.send}</button>
                  <button type="button" disabled={state === "sending"} onClick={() => setOpen(false)} className="h-11 rounded-lg border border-neutral-300 px-5 font-semibold hover:bg-neutral-100">{w.cancel}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
