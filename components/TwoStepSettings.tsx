"use client";

import { useEffect, useState } from "react";
import { logInCode, SUPPORT_VIEW, TWO_STEP_ASK } from "./accounts";
import { merchantCall, onServer } from "./merchantApi";
import { usePrefs } from "./Prefs";

/* Optional 2-step codes for merchants: a 6-digit code from an authenticator app (Google Authenticator, Microsoft
   Authenticator, 1Password...) asked after the password. Three pieces:
   - TwoStepSettings: on the settings page, turning it on (scan or type the secret, then confirm with a code) and off
     (password and a code);
   - TwoStepCodeStep: the code step of the sign-in form;
   - TwoStepPrompt: right after signing up or in without it, a gentle offer that can be skipped (remembered per account).
   None of this runs in the platform tour or signed out: the server holds everything (app/api/auth/totp). */

const SKIPPED = "seen-2fa-skipped";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
const primary = "h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50";
const ghost = "h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft";

const words = {
  en: {
    title: "2-step code",
    offHint: "Optional. After your password, Dukkan also asks for a 6-digit code from an app on your phone, so a stolen password alone can't open your store.",
    onHint: "On. Signing in asks for your password and a code from your authenticator app.",
    on: "On",
    off: "Off",
    setUp: "Set up",
    step1: "1. In your authenticator app, add an account and paste this link, or type the key below.",
    link: "Setup link",
    key: "Key",
    copy: "Copy",
    copied: "Copied",
    step2: "2. Type the 6-digit code the app shows.",
    code: "6-digit code",
    confirm: "Turn on",
    cancel: "Cancel",
    nowOn: "2-step code is on.",
    nowOff: "2-step code is off.",
    turnOff: "Turn off",
    offTitle: "Turn off the 2-step code",
    password: "Your password",
    wrongCode: "That code is not right. Check the time on your phone and try the newest code.",
    wrongPassword: "The password is not right.",
    slow: "Too many tries. Wait a few minutes and try again.",
    server: "We couldn't reach Dukkan right now. Try again.",
    support: "Dukkan support can't change this while viewing your store.",
    lost: "Lost your phone? Contact Dukkan support: after checking it's you, they can turn the code off.",
    signInTitle: "Enter your 2-step code",
    signInHint: "Open your authenticator app and type the 6-digit code for Dukkan.",
    verify: "Continue",
    expired: "This took too long. Sign in again.",
    promptTitle: "Protect your account with a 2-step code",
    promptHint: "Add a code from your phone to your sign-in. It takes a minute.",
    promptYes: "Set up now",
    promptSkip: "Skip for now",
  },
  ar: {
    title: "رمز التحقق بخطوتين",
    offHint: "اختياري. بعد كلمة المرور يطلب دكّان رمزًا من 6 أرقام من تطبيق على هاتفك، فلا تكفي كلمة مرور مسروقة وحدها لفتح متجرك.",
    onHint: "مفعّل. يطلب تسجيل الدخول كلمة المرور ورمزًا من تطبيق المصادقة.",
    on: "مفعّل",
    off: "غير مفعّل",
    setUp: "إعداد",
    step1: "1. في تطبيق المصادقة أضف حسابًا والصق هذا الرابط، أو اكتب المفتاح أدناه.",
    link: "رابط الإعداد",
    key: "المفتاح",
    copy: "نسخ",
    copied: "تم النسخ",
    step2: "2. اكتب الرمز المكوّن من 6 أرقام الذي يظهره التطبيق.",
    code: "رمز من 6 أرقام",
    confirm: "تفعيل",
    cancel: "إلغاء",
    nowOn: "تم تفعيل رمز التحقق بخطوتين.",
    nowOff: "تم إيقاف رمز التحقق بخطوتين.",
    turnOff: "إيقاف",
    offTitle: "إيقاف رمز التحقق بخطوتين",
    password: "كلمة المرور",
    wrongCode: "الرمز غير صحيح. تأكد من وقت هاتفك وجرّب أحدث رمز.",
    wrongPassword: "كلمة المرور غير صحيحة.",
    slow: "محاولات كثيرة. انتظر بضع دقائق وحاول مجددًا.",
    server: "تعذّر الاتصال بدكّان الآن. حاول مجددًا.",
    support: "لا يستطيع دعم دكّان تغيير هذا أثناء عرض متجرك.",
    lost: "فقدت هاتفك؟ تواصل مع دعم دكّان: بعد التأكد من هويتك يمكنهم إيقاف الرمز.",
    signInTitle: "أدخل رمز التحقق",
    signInHint: "افتح تطبيق المصادقة واكتب الرمز المكوّن من 6 أرقام الخاص بدكّان.",
    verify: "متابعة",
    expired: "استغرق الأمر وقتًا طويلًا. سجّل الدخول من جديد.",
    promptTitle: "احمِ حسابك برمز التحقق بخطوتين",
    promptHint: "أضف رمزًا من هاتفك إلى تسجيل الدخول. يستغرق الأمر دقيقة.",
    promptYes: "الإعداد الآن",
    promptSkip: "تخطَّ الآن",
  },
};

/* what is typed: digits only (Arabic digits too), at most 6 */
const typedCode = (v: string) =>
  v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/\D/g, "")
    .slice(0, 6);

function CodeInput({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id: string; label: string }) {
  return (
    <input
      id={id}
      dir="ltr"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={label}
      placeholder="123456"
      value={value}
      onChange={(e) => onChange(typedCode(e.target.value))}
      className={`${field} text-center text-lg tracking-[0.4em]`}
    />
  );
}

/** The settings page section */
export function TwoStepSettings() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [state, setState] = useState<"hidden" | "loading" | "off" | "on">("loading");
  const [setup, setSetup] = useState<{ link: string; grouped: string } | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!onServer()) return setState("hidden");
    void merchantCall("/api/auth/totp/setup", "GET").then((r) => setState(r?.status === 200 ? (r.data.on ? "on" : "off") : "hidden"));
  }, []);

  if (state === "hidden" || state === "loading") return null;

  const fail = (result: unknown) =>
    setError(
      result === "wrong" || result === "wrong-code"
        ? w.wrongCode
        : result === "wrong-password"
          ? w.wrongPassword
          : result === "slow-down"
            ? w.slow
            : result === "view-only"
              ? w.support
              : w.server,
    );

  const start = async () => {
    setBusy(true);
    setError("");
    setNote("");
    const r = await merchantCall("/api/auth/totp/setup", "POST", {});
    setBusy(false);
    if (r?.status === 200) setSetup({ link: r.data.link, grouped: r.data.grouped });
    else fail(r?.data.result);
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    const r = await merchantCall("/api/auth/totp/setup", "POST", { code });
    setBusy(false);
    if (r?.status !== 200) return fail(r?.data.result);
    setSetup(null);
    setCode("");
    setState("on");
    setNote(w.nowOn);
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    const r = await merchantCall("/api/auth/totp/disable", "POST", { password, code });
    setBusy(false);
    if (r?.status !== 200) return fail(r?.data.result);
    setTurningOff(false);
    setCode("");
    setPassword("");
    setState("off");
    setNote(w.nowOff);
  };

  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked: the text can still be selected */
    }
  };

  return (
    <section id="two-step" className={`${card} scroll-mt-24`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{w.title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${state === "on" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-fg/10"}`}>
          {state === "on" ? w.on : w.off}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{state === "on" ? w.onHint : w.offHint}</p>

      {state === "off" && !setup && (
        <button type="button" disabled={busy} onClick={start} className={`${primary} mt-5`}>
          {w.setUp}
        </button>
      )}

      {state === "off" && setup && (
        <div className="mt-5 space-y-4">
          <p className="text-sm font-medium">{w.step1}</p>
          {(
            [
              ["link", w.link, setup.link],
              ["key", w.key, setup.grouped],
            ] as const
          ).map(([k, label, text]) => (
            <div key={k}>
              <p className="mb-1 text-xs font-semibold text-muted">{label}</p>
              <div className="flex items-stretch gap-2">
                <code dir="ltr" className="min-w-0 flex-1 select-all break-all rounded-xl bg-soft px-3 py-2.5 text-xs">
                  {text}
                </code>
                <button type="button" onClick={() => copy(k, k === "key" ? text.replace(/ /g, "") : text)} className={`${ghost} shrink-0`}>
                  {copied === k ? w.copied : w.copy}
                </button>
              </div>
            </div>
          ))}
          <p className="text-sm font-medium">{w.step2}</p>
          <div className="max-w-xs">
            <CodeInput id="two-step-code" label={w.code} value={code} onChange={setCode} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || code.length !== 6} onClick={confirm} className={primary}>
              {w.confirm}
            </button>
            <button type="button" onClick={() => (setSetup(null), setCode(""), setError(""))} className={ghost}>
              {w.cancel}
            </button>
          </div>
        </div>
      )}

      {state === "on" && !turningOff && (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => (setTurningOff(true), setNote(""))} className={ghost}>
            {w.turnOff}
          </button>
          <p className="text-xs text-muted">{w.lost}</p>
        </div>
      )}

      {state === "on" && turningOff && (
        <div className="mt-5 max-w-md space-y-4">
          <p className="text-sm font-semibold">{w.offTitle}</p>
          <input type="password" autoComplete="current-password" aria-label={w.password} placeholder={w.password} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          <CodeInput id="two-step-off-code" label={w.code} value={code} onChange={setCode} />
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || !password || code.length !== 6} onClick={disable} className={primary}>
              {w.turnOff}
            </button>
            <button type="button" onClick={() => (setTurningOff(false), setCode(""), setPassword(""), setError(""))} className={ghost}>
              {w.cancel}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      {note && <p role="status" className="mt-3 text-sm font-semibold text-primary">{note}</p>}
    </section>
  );
}

/** The sign-in form's code step: a small window over the form. Tells the form how it ended. */
export function TwoStepCodeStep({ onDone }: { onDone: (r: "ok" | "cancel") => void }) {
  const { lang } = usePrefs();
  const w = words[lang];
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => document.getElementById("two-step-signin")?.focus(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    const r = await logInCode(code);
    setBusy(false);
    if (r === "ok") return onDone("ok");
    setCode("");
    setError(r === "wrong" ? w.wrongCode : r === "slow-down" ? w.slow : r === "expired" ? w.expired : w.server);
    if (r === "expired") setTimeout(() => onDone("cancel"), 2500);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="two-step-title" className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-fg/10">
        <h2 id="two-step-title" className="text-lg font-bold">{w.signInTitle}</h2>
        <p className="mt-1 text-sm text-muted">{w.signInHint}</p>
        <div className="mt-5">
          <CodeInput id="two-step-signin" label={w.code} value={code} onChange={(v) => (setCode(v), setError(""))} />
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={busy || code.length !== 6} className={`${primary} flex-1`}>
            {w.verify}
          </button>
          <button type="button" onClick={() => onDone("cancel")} className={ghost}>
            {w.cancel}
          </button>
        </div>
        <p className="mt-4 text-xs text-muted">{w.lost}</p>
      </form>
    </div>
  );
}

/** Right after signing up or in without a 2-step code: an offer to set one up, until he sets it up or skips it */
export function TwoStepPrompt() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!onServer()) return;
    try {
      if (sessionStorage.getItem(TWO_STEP_ASK) !== "1" || sessionStorage.getItem(SUPPORT_VIEW)) return;
      /* kept with the account's store, so skipping is remembered on every device */
      if (localStorage.getItem(SKIPPED)) return;
    } catch {
      return;
    }
    if (window.location.pathname.startsWith("/settings")) return;
    setShow(true);
  }, []);
  if (!show) return null;

  const close = (skip: boolean) => {
    try {
      sessionStorage.removeItem(TWO_STEP_ASK);
      if (skip) localStorage.setItem(SKIPPED, String(Date.now()));
    } catch {
      /* storage blocked */
    }
    setShow(false);
  };

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-5 py-3 md:px-10">
      <div className="min-w-0">
        <p className="text-sm font-bold">{w.promptTitle}</p>
        <p className="text-xs text-muted">{w.promptHint}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a href="/settings#two-step" onClick={() => close(false)} className="grid h-9 place-items-center rounded-lg bg-ink px-4 text-xs font-semibold text-onink hover:bg-deep">
          {w.promptYes}
        </a>
        <button type="button" onClick={() => close(true)} className="h-9 rounded-lg border border-fg/20 px-4 text-xs font-semibold hover:bg-soft">
          {w.promptSkip}
        </button>
      </div>
    </div>
  );
}
