"use client";

import { useEffect, useState } from "react";
import { content } from "./content";
import { jordanMobile, savedMobile } from "./phone";
import { usePrefs } from "./Prefs";
import { emailOf, passwordProblem } from "./safe";
import { passwordError } from "./safeAccount";
import { supportLinks, usePublicSettings } from "./platformPublic";
import { CodeInput } from "./TwoStepSettings";

/* A forgotten password, on the sign-in page (SignupForm.tsx): the merchant types the email or mobile of his account, gets
   a 6-digit code there, types it, then picks a new password (app/api/auth/reset/...). When it is done the sign-in form
   signs him in with the new password (and asks for his 2-step code when it is on). Support stays one tap away at the
   bottom, for when no code comes (Dukkan has no email/SMS provider yet in production: server/sendCode.ts). */

type Step = "contact" | "code" | "password";

const words = {
  en: {
    title: "Reset your password",
    stepOf: (n: number) => `Step ${n} of 3`,
    contactIntro: "Enter the email or mobile number on your account. We'll send you a 6-digit code.",
    contactLabel: "Email or mobile number",
    contactPh: "name@example.com or 079 123 4567",
    contactError: "Enter a valid email or a Jordan mobile number, e.g. 0791234567",
    send: "Send code",
    sending: "Sending…",
    sent: "If this email or number has an account, we sent a code.",
    codeTitle: "Enter the code",
    codeIntro: "Enter the 6-digit code we sent to",
    codeLabel: "6-digit code",
    codeNote: "The code works for 10 minutes.",
    verify: "Continue",
    resend: "Send a new code",
    resendIn: (s: number) => `Send a new code in ${s} s`,
    other: "Use another email or number",
    wrongCode: "That code isn't right. Check it and try again.",
    expired: "This code has expired. Ask for a new one.",
    tooManyTries: "Too many wrong tries for this code. Ask for a new one.",
    slowDown: "Too many requests. Wait a few minutes and try again.",
    noSender: "Resetting by code isn't available yet. Contact Dukkan support.",
    passwordTitle: "Choose a new password",
    passwordIntro: "Changing your password signs you out on all your devices.",
    newPassword: "New password",
    confirm: "Confirm new password",
    hint: "8 characters at least",
    short: "The new password must be at least 8 characters.",
    mismatch: "The two passwords don't match.",
    save: "Change password",
    saving: "Saving…",
    tokenExpired: "This took too long. Ask for a new code.",
    back: "Back to log in",
    fallback: "Can't get a code? Contact support",
    call: "Call",
    whatsapp: "WhatsApp",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    stepOf: (n: number) => `الخطوة ${n} من 3`,
    contactIntro: "أدخل البريد الإلكتروني أو رقم الجوال المسجّل في حسابك، وسنرسل لك رمزًا من 6 أرقام.",
    contactLabel: "البريد الإلكتروني أو رقم الجوال",
    contactPh: "name@example.com أو 079 123 4567",
    contactError: "أدخل بريدًا إلكترونيًا صحيحًا أو رقم جوال أردنيًا، مثل 0791234567",
    send: "أرسل الرمز",
    sending: "جارٍ الإرسال…",
    sent: "إذا كان لهذا البريد أو الرقم حساب، فقد أرسلنا إليه رمزًا.",
    codeTitle: "أدخل الرمز",
    codeIntro: "أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى",
    codeLabel: "رمز من 6 أرقام",
    codeNote: "الرمز صالح لمدة 10 دقائق.",
    verify: "متابعة",
    resend: "أرسل رمزًا جديدًا",
    resendIn: (s: number) => `أرسل رمزًا جديدًا بعد ${s} ث`,
    other: "استخدم بريدًا أو رقمًا آخر",
    wrongCode: "الرمز غير صحيح. تحقّق منه وحاول مرة أخرى.",
    expired: "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.",
    tooManyTries: "محاولات خاطئة كثيرة لهذا الرمز. اطلب رمزًا جديدًا.",
    slowDown: "طلبات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.",
    noSender: "إعادة التعيين برمز غير متاحة بعد. تواصل مع دعم دكّان.",
    passwordTitle: "اختر كلمة مرور جديدة",
    passwordIntro: "تغيير كلمة المرور يسجّل خروجك من جميع أجهزتك.",
    newPassword: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة",
    hint: "8 أحرف على الأقل",
    short: "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    save: "غيّر كلمة المرور",
    saving: "جارٍ الحفظ…",
    tokenExpired: "استغرق الأمر وقتًا طويلًا. اطلب رمزًا جديدًا.",
    back: "العودة إلى تسجيل الدخول",
    fallback: "لم يصلك الرمز؟ تواصل مع الدعم",
    call: "اتصال",
    whatsapp: "واتساب",
  },
};

/* the same look as the sign-in form's fields and button (SignupForm.tsx) */
const inputClass =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
const bad = "!border-rose-500 focus:!ring-rose-500/25";
const primaryBtn =
  "h-12 w-full rounded-xl bg-ink text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-deep disabled:cursor-not-allowed disabled:bg-primary/20 disabled:text-muted";
const linkBtn = "text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline";

/* the sign-in form's eye icons, for showing the password */
const iconProps = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const eye = (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const eyeOff = (
  <svg {...iconProps}>
    <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

/* seconds before another code can be asked for */
const RESEND_SECONDS = 60;

/** Where the code went, partly hidden: "079 ••• ••67" or "na•••@example.com" */
export function maskedContact(typed: string): string {
  const d = jordanMobile(typed);
  if (d) return `0${d.slice(0, 2)} ••• ••${d.slice(-2)}`;
  const email = emailOf(typed);
  const [user, domain] = email.split("@");
  if (!user || !domain) return typed;
  return `${user.slice(0, user.length > 2 ? 2 : 1)}•••@${domain}`;
}

type Reply = { status: number; result: string; token?: string };

async function post(path: string, body: unknown): Promise<Reply | null> {
  try {
    const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = ((await r.json().catch(() => ({}))) ?? {}) as { result?: string; token?: string };
    return { status: r.status, result: j.result ?? "", token: j.token };
  } catch {
    return null;
  }
}

export function ForgotPassword({
  initial,
  onBack,
  onDone,
}: {
  /* what was typed in the sign-in form's email / mobile field */
  initial: string;
  onBack: () => void;
  /* the new password is set: the sign-in form takes it from here */
  onDone: (contact: string, password: string) => void;
}) {
  const { lang } = usePrefs();
  const w = words[lang];
  const c = content[lang].signup;
  const support = supportLinks(usePublicSettings());

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState(initial.trim());
  /* the email or mobile the code was sent to, as typed (the next steps name it) */
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  /* a mistake about the field of this step (role=alert), and a calm note (role=status) */
  const [error, setError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [note, setNote] = useState("");
  /* resetting by code can't be done here (no sender in production): support is the way */
  const [noSender, setNoSender] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  /* the cursor goes to the field of each step as it opens */
  useEffect(() => {
    document.getElementById(step === "contact" ? "fp-contact" : step === "code" ? "fp-code" : "fp-password")?.focus();
  }, [step]);

  /* the countdown to "Send a new code", only while it runs */
  useEffect(() => {
    if (step !== "code" || resendAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, resendAt]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const errorFor = (result: string | undefined) =>
    result === "slow-down" ? w.slowDown : result === "no-sender" ? w.noSender : c.errServer;

  /* asks the server for a code (first time, or again) */
  const ask = async (to: string): Promise<boolean> => {
    setBusy(true);
    setError("");
    setNote("");
    const r = await post("/api/auth/reset/request", { contact: to, lang });
    setBusy(false);
    if (r?.result === "sent") {
      setNoSender(false);
      setNote(w.sent);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
      return true;
    }
    /* not about the field: the support box below says it, with the ways to reach support */
    if (r?.result === "no-sender") {
      setNoSender(true);
      return false;
    }
    setError(r?.result === "invalid" ? w.contactError : errorFor(r?.result));
    return false;
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const typed = contact.trim();
    if (!savedMobile(typed) && !emailOf(typed)) {
      setError(w.contactError);
      document.getElementById("fp-contact")?.focus();
      return;
    }
    if (await ask(typed)) {
      setSentTo(typed);
      setCode("");
      setStep("code");
    } else document.getElementById("fp-contact")?.focus();
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    const r = await post("/api/auth/reset/verify", { contact: sentTo, code });
    setBusy(false);
    if (r?.result === "ok" && r.token) {
      setToken(r.token);
      setNote("");
      setStep("password");
      return;
    }
    setCode("");
    /* a dead code: a new one can be asked for at once */
    if (r?.result === "expired" || r?.result === "too-many") setResendAt(0);
    setError(r?.result === "wrong" ? w.wrongCode : r?.result === "expired" ? w.expired : r?.result === "too-many" ? w.tooManyTries : errorFor(r?.result));
    document.getElementById("fp-code")?.focus();
  };

  const resend = async () => {
    if (busy || wait > 0) return;
    setCode("");
    await ask(sentTo);
    document.getElementById("fp-code")?.focus();
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const pw = passwordProblem(password);
    const pwErr = pw ? (pw === "short" ? w.short : passwordError[pw][lang]) : "";
    const cfErr = !pwErr && password !== confirm ? w.mismatch : "";
    setError(pwErr);
    setConfirmError(cfErr);
    if (pwErr) return void document.getElementById("fp-password")?.focus();
    if (cfErr) return void document.getElementById("fp-confirm")?.focus();
    setBusy(true);
    const r = await post("/api/auth/reset/set", { token, password });
    setBusy(false);
    if (r?.result === "ok") return onDone(sentTo, password);
    if (r?.result === "expired") {
      /* back to the code step, where a new code can be asked for at once */
      setToken("");
      setPassword("");
      setConfirm("");
      setResendAt(0);
      setCode("");
      setStep("code");
      setError(w.tokenExpired);
      return;
    }
    setError(errorFor(r?.result));
    document.getElementById("fp-password")?.focus();
  };

  const n = step === "contact" ? 1 : step === "code" ? 2 : 3;
  const errorBox = error ? (
    <p id="fp-error" role="alert" className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
      {error}
    </p>
  ) : null;

  return (
    <section aria-labelledby="fp-title">
      <p className="text-xs font-semibold text-muted">{w.stepOf(n)}</p>
      <h1 id="fp-title" className="mt-1 text-2xl font-extrabold">
        {step === "contact" ? w.title : step === "code" ? w.codeTitle : w.passwordTitle}
      </h1>

      {step === "contact" && (
        <form method="post" action="#" onSubmit={submitContact} noValidate className="mt-6 space-y-5">
          <p className="text-sm leading-relaxed text-muted">{w.contactIntro}</p>
          <div>
            <label htmlFor="fp-contact" className="mb-2 block text-sm font-semibold">{w.contactLabel}</label>
            <input
              id="fp-contact"
              dir="auto"
              maxLength={254}
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                if (error) setError("");
              }}
              placeholder={w.contactPh}
              autoComplete="username"
              aria-required
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "fp-error" : undefined}
              className={`${inputClass} ${error ? bad : ""}`}
            />
            {errorBox}
          </div>
          <button type="submit" disabled={busy || !contact.trim()} className={primaryBtn}>
            {busy ? w.sending : w.send}
          </button>
        </form>
      )}

      {step === "code" && (
        <form method="post" action="#" onSubmit={submitCode} noValidate className="mt-6 space-y-5">
          <p className="text-sm leading-relaxed text-muted">
            {w.codeIntro}{" "}
            <bdi dir="ltr" className="font-semibold text-fg">{maskedContact(sentTo)}</bdi>
          </p>
          {note && <p role="status" className="rounded-xl bg-soft px-4 py-3 text-sm">{note}</p>}
          <div>
            <label htmlFor="fp-code" className="mb-2 block text-sm font-semibold">{w.codeLabel}</label>
            <CodeInput
              id="fp-code"
              label={w.codeLabel}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError("");
              }}
              invalid={!!error}
              describedBy={error ? "fp-error" : "fp-code-note"}
            />
            {errorBox ?? <p id="fp-code-note" className="mt-1.5 text-xs text-muted">{w.codeNote}</p>}
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
            {w.verify}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={resend} disabled={busy || wait > 0} className={linkBtn}>
              {wait > 0 ? w.resendIn(wait) : w.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("contact");
                setError("");
                setNote("");
                setCode("");
              }}
              className={linkBtn}
            >
              {w.other}
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form method="post" action="#" onSubmit={submitPassword} noValidate className="mt-6 space-y-5">
          <p className="text-sm leading-relaxed text-muted">{w.passwordIntro}</p>
          {/* the account's email or mobile, for the browser's password manager to save the new password under */}
          <input type="text" name="username" autoComplete="username" value={sentTo} readOnly hidden />
          <div>
            <label htmlFor="fp-password" className="mb-2 block text-sm font-semibold">{w.newPassword}</label>
            <span className="relative block">
              <input
                id="fp-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="new-password"
                aria-required
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "fp-error" : "fp-hint"}
                className={`${inputClass} pe-11 ${error ? bad : ""}`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? c.hidePassword : c.showPassword}
                aria-pressed={show}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-fg"
              >
                {show ? eyeOff : eye}
              </button>
            </span>
            {errorBox ?? <p id="fp-hint" className="mt-1.5 text-xs text-muted">{w.hint}</p>}
          </div>
          <div>
            <label htmlFor="fp-confirm" className="mb-2 block text-sm font-semibold">{w.confirm}</label>
            <input
              id="fp-confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (confirmError) setConfirmError("");
              }}
              autoComplete="new-password"
              aria-required
              aria-invalid={!!confirmError || undefined}
              aria-describedby={confirmError ? "fp-confirm-error" : undefined}
              className={`${inputClass} ${confirmError ? bad : ""}`}
            />
            {confirmError && (
              <p id="fp-confirm-error" role="alert" className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
                {confirmError}
              </p>
            )}
          </div>
          <button type="submit" disabled={busy || !password || !confirm} className={primaryBtn}>
            {busy ? w.saving : w.save}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack} className={`${linkBtn} mt-6`}>
        {w.back}
      </button>

      {/* For when no code comes (or none can be sent yet): Dukkan support, reached the way staff set in Diwan > Platform
          settings; each way left empty is left out */}
      <div className={`mt-6 rounded-xl px-4 py-3 text-sm ${noSender ? "bg-primary/10" : "bg-soft"}`}>
        {noSender ? (
          <p role="alert" className="font-semibold leading-relaxed">{w.noSender}</p>
        ) : (
          <p className="leading-relaxed">{w.fallback}</p>
        )}
        {(support.tel || support.whatsapp || support.mailto) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {support.tel && (
              <a href={support.tel} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-semibold text-onink transition hover:bg-deep">
                {w.call} <span dir="ltr">{support.phone}</span>
              </a>
            )}
            {support.whatsapp && (
              <a href={support.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700">
                {w.whatsapp}
              </a>
            )}
            {support.mailto && (
              <a href={support.mailto} className="inline-flex h-10 items-center rounded-xl border border-fg/15 bg-card px-4 text-sm font-semibold transition hover:bg-page">
                <span dir="ltr">{support.email}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
