"use client";

import { useEffect, useRef, useState } from "react";
import { brandName } from "./content";
import { MARKETING_PAUSE_DAYS, UNSUB_REASONS, UNSUB_REASON_WORDS, type UnsubReason, type UnsubText } from "./merchantCampaignRules";
import { LangSwitch, ThemeToggle, usePrefs } from "./Prefs";

/* The page "Stop Dukkan's marketing emails" in a campaign from Dukkan's team leads to (app/unsubscribe/dukkan,
   server/merchantCampaigns.ts). Owner decisions 2026-11-24:
   - never one click: the merchant types his account's email, and only when it is the address of the account the link
     was made for does anything change. A wrong address is told so, without ever showing the right one;
   - then he picks "Pause for 30 days" (they come again after it by themselves) or "Unsubscribe from all", with an
     optional reason (Diwan sees counts per reason only). "Turn them on again" undoes either, the same way;
   - the message at the top is Dukkan's team's to change in Diwan (Marketing > Campaigns to merchants);
   - it opens in the language of the email the link came from (signed in the link), without keeping that as the
     visitor's choice; the site's language switch changes it like on any page.
   His account's own emails (sign-in codes, new orders, tickets) are not marketing and still come. A link that isn't a
   real one says so. */

const words = {
  ar: {
    title: "رسائل دكان التسويقية",
    label: "بريد حسابك في دكان",
    hint: "اكتب البريد الذي وصلتك عليه الرسالة.",
    reason: "لماذا؟ (اختياري)",
    noReason: "بلا سبب",
    pause: `إيقاف مؤقت لمدة ${MARKETING_PAUSE_DAYS} يومًا`,
    off: "إلغاء الاشتراك في كل رسائل دكان التسويقية",
    on: "تشغيلها من جديد",
    busy: "جارٍ الحفظ…",
    isPaused: (d: string) => `رسائل دكان التسويقية متوقفة مؤقتًا حتى ${d}، ثم تعود وحدها.`,
    isOff: "رسائل دكان التسويقية متوقفة لهذا الحساب.",
    donePause: (d: string) => `تم. لن تصلك رسائل دكان التسويقية حتى ${d}.`,
    doneOff: "تم. لن تصلك رسائل دكان التسويقية بعد الآن.",
    doneOn: "ستصلك رسائل دكان التسويقية من جديد.",
    empty: "اكتب بريد حسابك أولًا.",
    mismatch: "هذا البريد ليس بريد الحساب الذي أُرسلت إليه هذه الرسالة. اكتب البريد الذي وصلتك عليه الرسالة.",
    slow: "محاولات كثيرة. حاول مجددًا بعد ساعة.",
    bad: "هذا الرابط غير صالح. افتح الرابط من آخر رسالة وصلتك من دكان.",
    fail: "تعذّر الحفظ. تحقّق من اتصالك وحاول مجددًا.",
  },
  en: {
    title: "Dukkan's marketing emails",
    label: "Your Dukkan account's email",
    hint: "Type the address this email reached you at.",
    reason: "Why? (optional)",
    noReason: "No reason",
    pause: `Pause Dukkan's marketing emails for ${MARKETING_PAUSE_DAYS} days`,
    off: "Unsubscribe from all Dukkan marketing emails",
    on: "Turn them on again",
    busy: "Saving…",
    isPaused: (d: string) => `Dukkan's marketing emails are paused until ${d}, then they come again by themselves.`,
    isOff: "Dukkan's marketing emails are off for this account.",
    donePause: (d: string) => `Done. You won't get Dukkan's marketing emails until ${d}.`,
    doneOff: "Done. You won't get Dukkan's marketing emails any more.",
    doneOn: "You'll get Dukkan's marketing emails again.",
    empty: "Type your account's email first.",
    mismatch: "That isn't the email of the account this message was sent to. Type the address the email reached you at.",
    slow: "Too many tries. Try again in an hour.",
    bad: "This link isn't valid. Open the link from the latest email Dukkan sent you.",
    fail: "It couldn't be saved. Check your connection and try again.",
  },
};

type State = "on" | "off" | "paused";
type Action = "pause" | "off" | "on";

/* the date a pause ends, as in Jordan */
const dayOf = (iso: string, lang: "ar" | "en") =>
  new Date(iso).toLocaleDateString(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Amman" });

export function DukkanUnsubscribe(props: { token: string; state: State; until: string | null; linkLang: "ar" | "en"; text: UnsubText }) {
  const { token, linkLang, text } = props;
  const { lang, setLang } = usePrefs();
  const w = words[lang];
  /* the email's language first (quietly: not kept as the visitor's choice); hidden until then, so it never flashes in
     another */
  const [shown, setShown] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    setLang(linkLang, { quiet: true });
    setShown(true);
  }, [linkLang, setLang]);

  const [state, setState] = useState<State>(props.state);
  const [until, setUntil] = useState<string | null>(props.until);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<UnsubReason | "">("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Action | null>(null);

  const send = async (action: Action) => {
    if (!email.trim()) return setErr(w.empty);
    setBusy(action);
    setErr("");
    setDone(null);
    try {
      const r = await fetch("/api/public/dukkan-unsubscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, email: email.trim(), action, ...(action !== "on" && reason ? { reason } : {}) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok) {
        setState(action === "on" ? "on" : action === "off" ? "off" : "paused");
        setUntil(action === "pause" ? new Date(Date.now() + MARKETING_PAUSE_DAYS * 86_400_000).toISOString() : null);
        setDone(action);
      } else setErr(j?.result === "mismatch" ? w.mismatch : j?.result === "slow-down" ? w.slow : j?.result === "none" ? w.bad : w.fail);
    } catch {
      setErr(w.fail);
    } finally {
      setBusy(null);
    }
  };

  const btn = "inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const main = `${btn} bg-primary text-white hover:bg-deep`;
  const second = `${btn} border border-fg/20 hover:bg-soft`;
  const status =
    done === "pause" && until ? w.donePause(dayOf(until, lang))
    : done === "off" ? w.doneOff
    : done === "on" ? w.doneOn
    : null;
  const now = state === "paused" && until ? w.isPaused(dayOf(until, lang)) : state === "off" ? w.isOff : null;
  return (
    <main className={`grid min-h-screen place-items-center bg-page px-4 py-10 text-fg transition-opacity ${shown ? "opacity-100" : "opacity-0"}`}>
      <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-sm ring-1 ring-fg/10">
        <header className="flex items-center justify-between gap-3">
          <p className="text-lg font-extrabold text-primary">{brandName(lang)}</p>
          <div className="flex items-center gap-2">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>
        <h1 className="mt-5 text-xl font-bold">{w.title}</h1>
        {!token ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{w.bad}</p>
        ) : (
          <form onSubmit={(e) => (e.preventDefault(), void send(state === "on" ? "pause" : "on"))}>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{text[lang]}</p>
            {status ? (
              <p role="status" className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300" suppressHydrationWarning>
                {status}
              </p>
            ) : (
              now && <p className="mt-4 rounded-xl bg-soft px-4 py-3 text-sm font-semibold leading-relaxed" suppressHydrationWarning>{now}</p>
            )}
            <label htmlFor="unsub-email" className="mt-5 block text-sm font-semibold">{w.label}</label>
            <input
              id="unsub-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              maxLength={320}
              value={email}
              onChange={(e) => (setEmail(e.target.value), setErr(""))}
              className="mt-1.5 h-11 w-full rounded-xl border border-fg/20 bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <p className="mt-1 text-xs text-muted">{w.hint}</p>
            {state !== "off" && (
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">{w.reason}</legend>
                <div className="mt-2 grid gap-1.5">
                  {(["", ...UNSUB_REASONS] as const).map((r) => (
                    <label key={r || "none"} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
                      {r ? UNSUB_REASON_WORDS[r][lang] : w.noReason}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="mt-5 grid gap-2.5">
              {state === "on" && (
                <button type="submit" disabled={!!busy} className={main}>{busy === "pause" ? w.busy : w.pause}</button>
              )}
              {state !== "off" && (
                <button type="button" disabled={!!busy} onClick={() => void send("off")} className={state === "on" ? second : main}>
                  {busy === "off" ? w.busy : w.off}
                </button>
              )}
              {state !== "on" && (
                <button type={state === "off" ? "submit" : "button"} disabled={!!busy} onClick={state === "off" ? undefined : () => void send("on")} className={second}>
                  {busy === "on" ? w.busy : w.on}
                </button>
              )}
            </div>
          </form>
        )}
        {err && <p role="alert" className="mt-3 text-sm text-rose-600">{err}</p>}
      </div>
    </main>
  );
}
