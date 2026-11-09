"use client";

import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "@/components/Prefs";
import { DiwanMark } from "@/components/diwan/icons";
import { PAPER } from "@/components/diwan/Shell";
import { passwordWords, STAFF_2FA_REQUIRED, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { Btn, field, useT } from "@/components/diwan/ui";

/* The staff sign-in: email and password, then the 6-digit code of an authenticator app. On the first sign-in the app is
   set up here (the secret to type in, or the otpauth link), and a temporary password given by an owner is replaced.
   While Diwan has no staff at all, the first owner can be made here with the server's setup key.
   TODO(2FA): while STAFF_2FA_REQUIRED is off, the password is enough ("done"), or a temporary one is replaced first
   ("new-password"); the "new-password" step goes once it is on.
   The look is kept quiet on purpose: Diwan's mark and name, one card with a title and a line under it, plain labels
   over plain fields, one button. */

type Step = "password" | "enroll" | "code" | "new-password" | "setup";
type Reply = { status: number; data: Record<string, any> | null };

async function post(url: string, body: unknown): Promise<Reply> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => null) };
  } catch {
    return { status: 0, data: null };
  }
}

/* the name is set in Ruq'ah, as in the console's top bar */
const RUQAA = { fontFamily: "var(--font-ruqaa), var(--font-sans)" };
/* Diwan's field, a little taller for a sign-in; 16px text on phones so the page does not zoom in on a tap */
const input = `${field} h-11 text-base sm:text-sm`;
const label = "mb-1.5 block text-sm font-medium";
const hint = "mt-1.5 text-xs text-muted";

export function LoginForm() {
  const t = useT();
  const [step, setStep] = useState<Step>("password");
  const [setupOpen, setSetupOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [secret, setSecret] = useState("");
  const [link, setLink] = useState("");
  const [setup, setSetup] = useState({ key: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/diwan/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSetupOpen(!!j?.open))
      .catch(() => {});
  }, []);

  const common = (r: Reply) => {
    if (r.status === 0 || r.status >= 500) return t("Diwan can't be reached right now. Try again in a moment.", "تعذر الوصول إلى الديوان الآن. حاول بعد قليل.");
    if (r.status === 429) return t("Too many tries. Wait 15 minutes and try again.", "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجددًا.");
    if (r.status === 403 && r.data?.result === "forbidden") return t("Open this page from Dukkan's own address.", "افتح هذه الصفحة من عنوان دكّان نفسه.");
    return "";
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/diwan/auth/login", { email, password });
    setBusy(false);
    if (r.data?.result === "ok") {
      setMustChange(!!r.data.mustChange);
      setCode("");
      if (r.data.step === "done") {
        window.location.href = "/diwan";
        return;
      }
      if (r.data.step === "new-password") setStep("new-password");
      else if (r.data.step === "enroll") {
        setSecret(r.data.secret ?? "");
        setLink(r.data.link ?? "");
        setStep("enroll");
      } else setStep("code");
      return;
    }
    setError(common(r) || (r.data?.result === "invalid" ? t("Enter your email and password.", "أدخل بريدك وكلمة المرور.") : t("The email or the password is not right.", "البريد أو كلمة المرور غير صحيحة.")));
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mustChange) {
      if (newPassword.length < STAFF_PASSWORD_MIN) return setError(t(passwordWords.short.en, passwordWords.short.ar));
      if (newPassword !== newPassword2) return setError(t("The two new passwords are not the same.", "كلمتا المرور الجديدتان غير متطابقتين."));
    }
    setBusy(true);
    const r = await post("/api/diwan/auth/totp", { ...(step === "new-password" ? {} : { code: code.replace(/\s/g, "") }), ...(mustChange ? { newPassword } : {}) });
    if (r.data?.result === "ok") {
      window.location.href = "/diwan";
      return;
    }
    setBusy(false);
    const why = r.data?.result;
    if (why === "signed-out") {
      setStep("password");
      setError(t("That took too long. Sign in again.", "استغرق الأمر وقتًا طويلًا. سجّل الدخول مجددًا."));
      return;
    }
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    setError(
      common(r) ||
        (why === "weak" && w ? t(w.en, w.ar)
          : why === "same" ? t("Choose a password different from the temporary one.", "اختر كلمة مرور غير المؤقتة.")
            : t("That code is not right. Check the time on your phone and use the newest code.", "الرمز غير صحيح. تأكد من الوقت في هاتفك واستخدم أحدث رمز.")),
    );
  };

  const makeOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/diwan/setup", setup);
    setBusy(false);
    const why = r.data?.result;
    if (why === "ok") {
      setSetupOpen(false);
      setEmail(setup.email.trim().toLowerCase());
      setPassword("");
      setStep("password");
      setNote(STAFF_2FA_REQUIRED
        ? t("The first owner is ready. Sign in now to set up your 2-step code.", "المالك الأول جاهز. سجّل الدخول الآن لإعداد رمز التحقق بخطوتين.")
        : t("The first owner is ready. Sign in now.", "المالك الأول جاهز. سجّل الدخول الآن."));
      return;
    }
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    setError(
      (why === "forbidden" ? common(r) : "") ||
        (why === "wrong-key" ? t("The setup key is not right.", "مفتاح الإعداد غير صحيح.")
          : why === "closed" ? t("Diwan already has staff, or the server has no setup key. Ask an owner to add you.", "للديوان فريق بالفعل، أو لا يوجد مفتاح إعداد في الخادم. اطلب من المالك إضافتك.")
            : why === "weak" && w ? t(w.en, w.ar)
              : why === "invalid" ? t("Enter a name (2 letters or more) and a real email.", "أدخل اسمًا (حرفان أو أكثر) وبريدًا صحيحًا.")
                : common(r)),
    );
  };

  const copy = (what: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    }).catch(() => {});
  };

  const back = () => { setStep("password"); setError(""); };

  /* the one place a problem is shown, just above the button; role="alert" reads it out as soon as it appears */
  const problem = error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-red-700 dark:text-red-300">{error}</p> : null;

  const codeField = (
    <div>
      <label htmlFor="dw-code" className={label}>{t("6-digit code", "الرمز المكوّن من 6 أرقام")}</label>
      <input
        id="dw-code"
        className={`${field} h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums`}
        dir="ltr"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
        autoFocus
      />
    </div>
  );
  const newPasswordInputs = (
    <>
      <div>
        <label htmlFor="dw-new" className={label}>{t("New password", "كلمة المرور الجديدة")}</label>
        <PasswordInput id="dw-new" autoComplete="new-password" minLength={STAFF_PASSWORD_MIN} value={newPassword} onChange={setNewPassword} describedBy="dw-new-hint" />
        <p id="dw-new-hint" className={hint}>{t(passwordWords.short.en, passwordWords.short.ar)}</p>
      </div>
      <div>
        <label htmlFor="dw-new2" className={label}>{t("New password again", "أعد كتابة كلمة المرور الجديدة")}</label>
        <PasswordInput id="dw-new2" autoComplete="new-password" value={newPassword2} onChange={setNewPassword2} />
      </div>
    </>
  );
  /* with the code, a temporary password is replaced in the same go: a quiet section under a hairline */
  const newPasswordSection = mustChange && (
    <div className="space-y-4 border-t border-fg/10 pt-5">
      <p className="text-sm text-muted">{t("You signed in with a temporary password. Choose your own now.", "دخلت بكلمة مرور مؤقتة. اختر كلمة مرورك الآن.")}</p>
      {newPasswordInputs}
    </div>
  );

  const title =
    step === "setup" ? t("Create the first owner", "إنشاء المالك الأول")
      : step === "enroll" ? t("Set up your 2-step code", "إعداد رمز التحقق بخطوتين")
        : step === "code" ? t("Enter your 2-step code", "أدخل رمز التحقق")
          : step === "new-password" ? t("Choose your password", "اختر كلمة مرورك")
            : t("Sign in to Diwan", "تسجيل الدخول إلى الديوان");
  const sub =
    step === "setup" ? t("Diwan has no staff yet. The setup key is on the server (DIWAN_SETUP_KEY).", "لا يوجد فريق في الديوان بعد. مفتاح الإعداد موجود في الخادم (DIWAN_SETUP_KEY).")
      : step === "enroll" ? t("Diwan asks for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) every time you sign in.", "يطلب الديوان رمزًا من تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator أو 1Password…) في كل مرة تدخل فيها.")
        : step === "code" ? t("Open your authenticator app and type the code shown for Diwan.", "افتح تطبيق المصادقة واكتب الرمز الظاهر للديوان.")
          : step === "new-password" ? t("You signed in with a temporary password. Choose your own now.", "دخلت بكلمة مرور مؤقتة. اختر كلمة مرورك الآن.")
            : t("Use the email and password of your Diwan account.", "استخدم البريد وكلمة المرور لحسابك في الديوان.");

  return (
    <div className={`min-h-screen text-fg ${PAPER}`}>
      {/* language and theme, small, in the page's top corner */}
      <div className="flex justify-end gap-2 px-4 pt-4">
        <LangSwitch iconOnly />
        <ThemeToggle />
      </div>

      <main className="mx-auto w-full max-w-sm px-4 pb-16 pt-6 sm:pt-12">
        {/* Diwan's mark and name, and who this page is for */}
        <div className="mb-8 flex flex-col items-center text-center">
          <DiwanMark className="h-10 w-10 text-primary" />
          <p lang="ar" className="mt-3 text-[30px] leading-none" style={RUQAA}>الديوان</p>
          <p className="mt-2 text-sm text-muted">{t("Diwan · Staff only", "للموظفين فقط")}</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgba(60,40,10,0.04),0_12px_32px_-16px_rgba(60,40,10,0.18)] ring-1 ring-fg/[0.08] sm:p-7">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{sub}</p>

          {note && <p role="status" className="mt-5 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">{note}</p>}

          {step === "password" && (
            <form onSubmit={signIn} className="mt-6 space-y-5">
              <div>
                <label htmlFor="dw-email" className={label}>{t("Email", "البريد الإلكتروني")}</label>
                <input id="dw-email" type="email" dir="ltr" autoComplete="username" className={input} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div>
                <label htmlFor="dw-password" className={label}>{t("Password", "كلمة المرور")}</label>
                <PasswordInput id="dw-password" autoComplete="current-password" value={password} onChange={setPassword} />
              </div>
              {problem}
              <Submit busy={busy} busyText={t("Signing in…", "جارٍ الدخول…")}>{t("Continue", "متابعة")}</Submit>
              {setupOpen && (
                <QuietLink primary onClick={() => { setStep("setup"); setError(""); setNote(""); }}>
                  {t("Create the first owner", "إنشاء المالك الأول")}
                </QuietLink>
              )}
            </form>
          )}

          {step === "enroll" && (
            <form onSubmit={verify} className="mt-6 space-y-5">
              <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed marker:text-muted">
                <li>{t("In your authenticator app, add an account by typing a key (or open the link below on your phone).", "في تطبيق المصادقة، أضف حسابًا بكتابة مفتاح (أو افتح الرابط أدناه من هاتفك).")}</li>
                <li>{t("Then type the 6-digit code the app shows.", "ثم اكتب الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق.")}</li>
              </ol>
              <div className="divide-y divide-fg/10 rounded-xl border border-fg/10">
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted">{t("Key", "المفتاح")}</p>
                    <CopyButton done={copied === "key"} onClick={() => copy("key", secret)}>{t("Copy the key", "نسخ المفتاح")}</CopyButton>
                  </div>
                  <p dir="ltr" className="mt-1.5 break-all font-mono text-base font-semibold tracking-wider">{secret.match(/.{1,4}/g)?.join(" ")}</p>
                </div>
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted">{t("Link for authenticator apps", "رابط لتطبيقات المصادقة")}</p>
                    <CopyButton done={copied === "link"} onClick={() => copy("link", link)}>{t("Copy the link", "نسخ الرابط")}</CopyButton>
                  </div>
                  <p dir="ltr" className="mt-1.5 break-all font-mono text-xs text-fg/80">{link}</p>
                </div>
              </div>
              {codeField}
              {newPasswordSection}
              {problem}
              <Submit busy={busy} busyText={t("Checking…", "جارٍ التحقق…")}>{t("Turn on and sign in", "تفعيل والدخول")}</Submit>
              <QuietLink onClick={back}>{t("Back", "رجوع")}</QuietLink>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={verify} className="mt-6 space-y-5">
              {codeField}
              {newPasswordSection}
              {problem}
              <Submit busy={busy} busyText={t("Checking…", "جارٍ التحقق…")}>{t("Sign in", "دخول")}</Submit>
              <p className="text-center text-xs leading-relaxed text-muted">{t("Lost your phone? Ask an owner to reset your 2-step code.", "فقدت هاتفك؟ اطلب من المالك إعادة ضبط رمز التحقق.")}</p>
              <QuietLink onClick={back}>{t("Back", "رجوع")}</QuietLink>
            </form>
          )}

          {step === "new-password" && (
            <form onSubmit={verify} className="mt-6 space-y-5">
              {/* the line about the temporary password is the card's own line here, so only the fields */}
              {mustChange && newPasswordInputs}
              {problem}
              <Submit busy={busy} busyText={t("Saving…", "جارٍ الحفظ…")}>{t("Save and sign in", "حفظ والدخول")}</Submit>
              <QuietLink onClick={back}>{t("Back", "رجوع")}</QuietLink>
            </form>
          )}

          {step === "setup" && (
            <form onSubmit={makeOwner} className="mt-6 space-y-5">
              <div>
                <label htmlFor="dw-key" className={label}>{t("Setup key", "مفتاح الإعداد")}</label>
                <PasswordInput id="dw-key" autoComplete="off" maxLength={200} value={setup.key} onChange={(v) => setSetup({ ...setup, key: v })} autoFocus />
              </div>
              <div>
                <label htmlFor="dw-sname" className={label}>{t("Your name", "اسمك")}</label>
                <input id="dw-sname" className={input} required maxLength={60} value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dw-semail" className={label}>{t("Email", "البريد الإلكتروني")}</label>
                <input id="dw-semail" type="email" dir="ltr" autoComplete="username" className={input} required maxLength={254} value={setup.email} onChange={(e) => setSetup({ ...setup, email: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dw-spass" className={label}>{t("Password", "كلمة المرور")}</label>
                <PasswordInput id="dw-spass" autoComplete="new-password" minLength={STAFF_PASSWORD_MIN} value={setup.password} onChange={(v) => setSetup({ ...setup, password: v })} describedBy="dw-spass-hint" />
                <p id="dw-spass-hint" className={hint}>{t(passwordWords.short.en, passwordWords.short.ar)}</p>
              </div>
              {problem}
              <Submit busy={busy} busyText={t("Creating…", "جارٍ الإنشاء…")}>{t("Create the owner", "إنشاء المالك")}</Submit>
              <QuietLink onClick={back}>{t("Back", "رجوع")}</QuietLink>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

/** A password field with one small button at its end that shows or hides what was typed */
function PasswordInput({
  id, value, onChange, autoComplete, minLength, maxLength = 128, autoFocus, describedBy,
}: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number; maxLength?: number; autoFocus?: boolean; describedBy?: string }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        dir="ltr"
        autoComplete={autoComplete}
        className={`${input} pe-11`}
        required
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        spellCheck={false}
        autoCapitalize="none"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? t("Hide password", "إخفاء كلمة المرور") : t("Show password", "إظهار كلمة المرور")}
        aria-pressed={shown}
        aria-controls={id}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** The card's one button, the full width, with a small turning ring while it works */
function Submit({ busy, busyText, children }: { busy: boolean; busyText: string; children: React.ReactNode }) {
  return (
    <Btn type="submit" disabled={busy} aria-busy={busy} className="h-11 w-full rounded-xl">
      {busy && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {busy ? busyText : children}
    </Btn>
  );
}

/** A quiet text button under the main one: Back, or making the first owner */
function QuietLink({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-auto block rounded-md px-2 py-1 text-sm transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${primary ? "font-semibold text-primary" : "text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

/** Copy the key or the link; says Copied for two seconds */
function CopyButton({ done, onClick, children }: { done: boolean; onClick: () => void; children: React.ReactNode }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-md text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span aria-live="polite">{done ? t("Copied", "تم النسخ") : children}</span>
    </button>
  );
}
