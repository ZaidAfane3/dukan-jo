"use client";

import { useEffect, useRef, useState } from "react";
import { secondsText } from "./EmailCodeStep";
import { merchantCall, onServer } from "./merchantApi";
import { usePrefs } from "./Prefs";

/* Optional 2-step sign-in for merchants: after the password, every sign-in asks for a 6-digit code sent to the account's
   email (WhatsApp is to come: shown in the list as soon). Two pieces:
   - TwoStepSettings: on the settings page, choosing how to get the code and turning it on (the password only: the email
     was confirmed with a code when the account was made or its email changed) or off (an emailed code, or a recovery
     code, and the password);
   - the full page asking to turn it on after signing up or in without it is its own piece (TwoStepPrompt.tsx), which
     leads here and starts it at once (/settings#two-step-start).
   The sign-in's own code page is EmailCodeStep.tsx. None of this runs in the platform tour or signed out: the server
   holds everything (app/api/auth/totp). */

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
const primary = "h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50";
const ghost = "h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft";
const link = "text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline";

const words = {
  en: {
    title: "2-step sign-in",
    offHint: "Optional, and strongly suggested. After your password, Dukkan also asks for a 6-digit code it sends you, so a stolen password alone can't open your store.",
    onHint: "On. Every sign-in asks for your password and a code we email you.",
    on: "On",
    off: "Off",
    how: "Get the code by",
    email: "Email",
    whatsapp: "WhatsApp (coming soon)",
    start: "Turn on",
    onIntro: (to: string) => `From now on, each sign-in will also ask for a 6-digit code we email to ${to}. Type your password to turn 2-step sign-in on.`,
    offNoCode: "We couldn't send a code to your email just now. Type one of your recovery codes and your password to turn 2-step sign-in off, or send a new code.",
    sentToOff: (to: string) => `We sent a 6-digit code to ${to}. Type it (or a recovery code) and your password to turn 2-step sign-in off.`,
    yourEmail: "your email",
    code: "6-digit code",
    password: "Your password",
    confirm: "Turn on",
    cancel: "Cancel",
    resend: "Send a new code",
    resendIn: (n: number) => `Send a new code in ${secondsText(n, "en")}`,
    resent: "We sent a new code. Use the code in the newest email.",
    nowOn: "2-step sign-in is on.",
    nowOff: "2-step sign-in is off.",
    turnOff: "Turn off",
    offTitle: "Turn off 2-step sign-in",
    wrongCode: "That code isn't right. Use the code in the newest email from Dukkan.",
    expired: "This code has expired. Send a new code.",
    tooMany: "Too many wrong tries for this code. Send a new code.",
    locked: "Too many wrong tries. For your safety, wait an hour and try again.",
    wrongPassword: "The password isn't right.",
    slow: "Too many tries. Wait a few minutes and try again.",
    sendFailed: "We couldn't send the email just now. Try again in a moment.",
    unavailable: "Dukkan can't send email right now. Try again later.",
    server: "We couldn't reach Dukkan right now. Try again.",
    lost: "Can't reach your email? Use one of your recovery codes instead of the emailed code, or contact Dukkan support.",
    useRecovery: "Use a recovery code instead",
    useEmail: "Use the code from the email",
    recovery: "Recovery code",
    codesTitle: "Your recovery codes",
    codesHint: "If you can't reach your email, each of these opens your store once instead of the emailed code. Save them somewhere safe now: they won't be shown again.",
    copyAll: "Copy all",
    copied: "Copied",
    saved: "I saved them",
    left: (n: number) => (n === 1 ? "1 recovery code left." : `${n} recovery codes left.`),
    alreadyOn: "2-step sign-in is already on (turned on from another tab or device).",
  },
  ar: {
    title: "التحقق بخطوتين",
    offHint: "اختياري، وننصح به بشدة. بعد كلمة المرور يطلب دكّان أيضًا رمزًا من 6 أرقام يرسله إليك، فلا تكفي كلمة مرور مسروقة وحدها لفتح متجرك.",
    onHint: "مفعّل. يطلب كل تسجيل دخول كلمة المرور ورمزًا نرسله إلى بريدك.",
    on: "مفعّل",
    off: "غير مفعّل",
    how: "استلام الرمز عبر",
    email: "البريد الإلكتروني",
    whatsapp: "واتساب (قريبًا)",
    start: "تفعيل",
    onIntro: (to: string) => `من الآن سيطلب كل تسجيل دخول أيضًا رمزًا من 6 أرقام نرسله إلى ${to}. اكتب كلمة المرور لتفعيل التحقق بخطوتين.`,
    offNoCode: "لم نتمكّن من إرسال رمز إلى بريدك الآن. اكتب أحد رموز الاسترداد مع كلمة المرور لإيقاف التحقق بخطوتين، أو أرسل رمزًا جديدًا.",
    sentToOff: (to: string) => `أرسلنا رمزًا من 6 أرقام إلى ${to}. اكتبه (أو رمز استرداد) مع كلمة المرور لإيقاف التحقق بخطوتين.`,
    yourEmail: "بريدك الإلكتروني",
    code: "رمز من 6 أرقام",
    password: "كلمة المرور",
    confirm: "تفعيل",
    cancel: "إلغاء",
    resend: "إرسال رمز جديد",
    resendIn: (n: number) => `إرسال رمز جديد بعد ${secondsText(n, "ar")}`,
    resent: "أرسلنا رمزًا جديدًا. استخدم الرمز الموجود في أحدث رسالة.",
    nowOn: "تم تفعيل التحقق بخطوتين.",
    nowOff: "تم إيقاف التحقق بخطوتين.",
    turnOff: "إيقاف",
    offTitle: "إيقاف التحقق بخطوتين",
    wrongCode: "الرمز غير صحيح. استخدم الرمز الموجود في أحدث رسالة من دكّان.",
    expired: "انتهت صلاحية هذا الرمز. أرسل رمزًا جديدًا.",
    tooMany: "محاولات خاطئة كثيرة لهذا الرمز. أرسل رمزًا جديدًا.",
    locked: "محاولات خاطئة كثيرة. حفاظًا على أمانك، انتظر ساعة ثم حاول مرة أخرى.",
    wrongPassword: "كلمة المرور غير صحيحة.",
    slow: "محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.",
    sendFailed: "لم نتمكّن من إرسال الرسالة الآن. حاول مرة أخرى بعد قليل.",
    unavailable: "لا يستطيع دكّان إرسال البريد الآن. حاول لاحقًا.",
    server: "تعذّر الاتصال بدكّان الآن. حاول مرة أخرى.",
    lost: "لا يمكنك الوصول إلى بريدك؟ استخدم أحد رموز الاسترداد بدل الرمز المرسَل، أو تواصل مع دعم دكّان.",
    useRecovery: "استخدم رمز استرداد بدلًا منه",
    useEmail: "استخدم الرمز من الرسالة",
    recovery: "رمز الاسترداد",
    codesTitle: "رموز الاسترداد",
    codesHint: "إذا لم تستطع الوصول إلى بريدك، يفتح كل رمز منها متجرك مرة واحدة بدل الرمز المرسَل. احفظها في مكان آمن الآن: لن تظهر مرة أخرى.",
    copyAll: "نسخ الكل",
    copied: "تم النسخ",
    saved: "حفظتها",
    /* the counted noun as Arabic needs it: one, two, 3 to 10 (plural), 11 and up (singular, accusative) */
    left: (n: number) =>
      n === 0 ? "لم يبقَ لديك أي رمز استرداد."
      : n === 1 ? "بقي لديك رمز استرداد واحد."
      : n === 2 ? "بقي لديك رمزان للاسترداد."
      : n <= 10 ? `بقيت لديك ${n} رموز للاسترداد.`
      : `بقي لديك ${n} رمزًا للاسترداد.`,
    alreadyOn: "التحقق بخطوتين مفعّل بالفعل (فُعّل من علامة تبويب أو جهاز آخر).",
  },
};

/* what is typed: digits only (Arabic digits too), at most 6 */
const typedCode = (v: string) =>
  v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/\D/g, "")
    .slice(0, 6);

/** The 6-digit code field (also the forgotten-password code, ForgotPassword.tsx, and EmailCodeStep.tsx). invalid /
    describedBy: its mistake, for screen readers. */
export function CodeInput({ value, onChange, id, label, invalid, describedBy }: { value: string; onChange: (v: string) => void; id: string; label: string; invalid?: boolean; describedBy?: string }) {
  return (
    <input
      id={id}
      dir="ltr"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      /* six blanks, not a sample code: a sample looked like a code already filled in */
      placeholder="______"
      value={value}
      onChange={(e) => onChange(typedCode(e.target.value))}
      className={`${field} text-center text-lg tracking-[0.4em]`}
    />
  );
}

/* a recovery code as typed: letters and digits, upper case, at most XXXX-XXXX */
const typedRecovery = (v: string) =>
  v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 9);
export const recoveryReady = (v: string) => v.replace(/-/g, "").length === 8;

export function RecoveryInput({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id: string; label: string }) {
  return (
    <input
      id={id}
      dir="ltr"
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      placeholder="ABCD-EFGH"
      value={value}
      onChange={(e) => onChange(typedRecovery(e.target.value))}
      className={`${field} text-center text-lg tracking-[0.2em]`}
    />
  );
}

/** The settings page section. email: the account's address, named when a code is sent to it. */
export function TwoStepSettings({ email }: { email?: string }) {
  const { lang } = usePrefs();
  const w = words[lang];
  const [state, setState] = useState<"hidden" | "loading" | "off" | "on">("loading");
  /* the form that is open: turning it on (the password), or off (a code and the password) */
  const [step, setStep] = useState<"on" | "off" | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [byRecovery, setByRecovery] = useState(false);
  /* turning it off: whether the last code asked for really went (if not, the form still opens for a recovery code) */
  const [offSent, setOffSent] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  /* the one-minute wait after a code: kept across Cancel, so closing and opening the form again never sends another
     code at once */
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const passwordBox = useRef<HTMLInputElement>(null);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [wait]);
  const startWait = () => {
    setUntil(Date.now() + 60_000);
    setNow(Date.now());
  };

  useEffect(() => {
    if (!onServer()) return setState("hidden");
    void merchantCall("/api/auth/totp/setup", "GET").then((r) => {
      setState(r?.status === 200 ? (r.data.on ? "on" : "off") : "hidden");
      if (r?.status === 200 && typeof r.data.recoveryLeft === "number") setLeft(r.data.recoveryLeft);
    });
  }, []);

  const fail = (result: unknown) =>
    setError(
      result === "wrong" || result === "wrong-code" ? w.wrongCode
      : result === "expired" ? w.expired
      : result === "too-many" ? w.tooMany
      : result === "locked" ? w.locked
      : result === "wrong-password" ? w.wrongPassword
      : result === "slow-down" ? w.slow
      : result === "send-failed" ? w.sendFailed
      : result === "unavailable" ? w.unavailable
      : w.server,
    );

  const reset = () => {
    setStep(null);
    setCode("");
    setPassword("");
    setError("");
    setByRecovery(false);
  };

  /* turning it on: only the password is asked (the form opens with the cursor in it) */
  const openOn = () => {
    reset();
    setNote("");
    setStep("on");
    requestAnimationFrame(() => passwordBox.current?.focus({ preventScroll: true }));
  };

  /* turning it off: a code to the email. When it can't be sent (refused, failed, locked), the form opens anyway with a
     recovery code: a merchant who can't get an email can still turn it off. Within a minute of the last code, opening
     the form again sends nothing: the code already sent still works. */
  const sendOff = async (again = false) => {
    if (busy) return;
    if (wait && !again) {
      setStep("off");
      setByRecovery(!offSent);
      return;
    }
    if (again && wait) return;
    setBusy(true);
    setError("");
    setNote("");
    const r = await merchantCall("/api/auth/totp/disable", "POST", { send: true, lang });
    setBusy(false);
    /* already off (in another tab) */
    if (r?.status === 200 && r.data.on === false) {
      reset();
      return setState("off");
    }
    /* refused for asking too often: the button waits a minute too */
    if (r?.data.result === "slow-down") startWait();
    setStep("off");
    setCode("");
    if (r?.status !== 200) {
      setOffSent(false);
      setByRecovery(true);
      return fail(r?.data.result);
    }
    startWait();
    setOffSent(true);
    setByRecovery(false);
    if (again) setNote(w.resent);
  };

  /* opened with a link to it: #two-step scrolls to it; #two-step-start (the full page after signing in,
     TwoStepPrompt.tsx) also opens the form to turn it on, with the cursor in the password, so one press there goes
     straight into it */
  const ready = state === "on" || state === "off";
  useEffect(() => {
    const hash = window.location.hash;
    if (!ready || (hash !== "#two-step" && hash !== "#two-step-start")) return;
    const el = document.getElementById("two-step");
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const focusFirst = () => el?.querySelector<HTMLElement>("input, button, select")?.focus({ preventScroll: true });
    if (hash !== "#two-step-start" || state !== "off") return void focusFirst();
    /* started once: a reload or the browser's back does not start it again */
    history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}#two-step`);
    openOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (state === "hidden" || state === "loading") return null;

  const finish = async () => {
    setBusy(true);
    setError("");
    setNote("");
    const r =
      step === "on"
        ? await merchantCall("/api/auth/totp/setup", "POST", { password, method: "email", lang })
        : await merchantCall("/api/auth/totp/disable", "POST", { code, password });
    setBusy(false);
    /* turned on meanwhile from another tab or device: nothing to do here */
    if (step === "on" && r?.data.result === "already-on") {
      reset();
      setState("on");
      return setNote(w.alreadyOn);
    }
    if (r?.status !== 200) {
      if (r?.data.result !== "wrong-password") setCode("");
      return fail(r?.data.result);
    }
    const turnedOn = step === "on";
    reset();
    setState(turnedOn ? "on" : "off");
    setNote(turnedOn ? w.nowOn : w.nowOff);
    if (turnedOn && Array.isArray(r.data.recoveryCodes)) {
      setCodes(r.data.recoveryCodes);
      setLeft(r.data.recoveryCodes.length);
    }
    if (!turnedOn) setLeft(null);
  };

  const copyCodes = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the codes can still be selected */
    }
  };

  const ready6 = step === "on" || (byRecovery ? recoveryReady(code) : code.length === 6);

  return (
    <section id="two-step" className={`${card} scroll-mt-24`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{w.title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${state === "on" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-fg/10"}`}>
          {state === "on" ? w.on : w.off}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{state === "on" ? w.onHint : w.offHint}</p>

      {!step && !codes && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">{w.how}</span>
            {/* only email for now: WhatsApp shows as coming soon */}
            <select value="email" disabled={state === "on"} onChange={() => {}} className={`${field} w-64`}>
              <option value="email">{w.email}</option>
              <option value="whatsapp" disabled>
                {w.whatsapp}
              </option>
            </select>
          </label>
          {state === "off" ? (
            <button type="button" disabled={busy} onClick={openOn} className={primary}>
              {w.start}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void sendOff()} className={ghost}>
              {w.turnOff}
            </button>
          )}
        </div>
      )}

      {step && (
        <form
          className="mt-5 max-w-md space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && ready6 && password) void finish();
          }}
        >
          {step === "off" && <p className="text-sm font-semibold">{w.offTitle}</p>}
          <p className="text-sm">{step === "on" ? w.onIntro(email || w.yourEmail) : offSent ? w.sentToOff(email || w.yourEmail) : w.offNoCode}</p>
          {step === "off" &&
            (byRecovery ? (
              <RecoveryInput id="two-step-code" label={w.recovery} value={code} onChange={(v) => (setCode(v), setError(""))} />
            ) : (
              <CodeInput id="two-step-code" label={w.code} value={code} onChange={(v) => (setCode(v), setError(""))} />
            ))}
          <input ref={passwordBox} id="two-step-password" type="password" autoComplete="current-password" aria-label={w.password} placeholder={w.password} value={password} maxLength={128} onChange={(e) => (setPassword(e.target.value), setError(""))} className={field} />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy || !ready6 || !password} className={primary}>
              {step === "on" ? w.confirm : w.turnOff}
            </button>
            <button type="button" onClick={reset} className={ghost}>
              {w.cancel}
            </button>
          </div>
          {step === "off" && (
            <div className="flex flex-col items-start gap-2">
              {!byRecovery && (
                <button type="button" disabled={busy || wait > 0} onClick={() => void sendOff(true)} className={link}>
                  {wait > 0 ? w.resendIn(wait) : w.resend}
                </button>
              )}
              <button type="button" onClick={() => (setByRecovery((v) => !v), setCode(""), setError(""))} className={link}>
                {byRecovery ? w.useEmail : w.useRecovery}
              </button>
            </div>
          )}
        </form>
      )}

      {state === "on" && codes && (
        <div className="mt-5 space-y-3 rounded-xl bg-soft p-4">
          <p className="text-sm font-semibold">{w.codesTitle}</p>
          <p className="text-sm text-muted">{w.codesHint}</p>
          <ul dir="ltr" className="grid select-all grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
            {codes.map((c) => (
              <li key={c} className="rounded-lg bg-card px-2 py-1.5 text-center">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void copyCodes()} className={ghost}>
              {copied ? w.copied : w.copyAll}
            </button>
            <button type="button" onClick={() => setCodes(null)} className={primary}>
              {w.saved}
            </button>
          </div>
        </div>
      )}

      {state === "on" && !codes && !step && (
        <div className="mt-3 space-y-1">
          {left !== null && <p className="text-xs text-muted">{w.left(left)}</p>}
          <p className="text-xs text-muted">{w.lost}</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      {note && <p role="status" className="mt-3 text-sm font-semibold text-primary">{note}</p>}
    </section>
  );
}
