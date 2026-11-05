"use client";

import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "@/components/Prefs";
import { passwordWords, STAFF_2FA_REQUIRED, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { Btn, card, field, useT } from "@/components/diwan/ui";

/* The staff sign-in: email and password, then the 6-digit code of an authenticator app. On the first sign-in the app is
   set up here (the secret to type in, or the otpauth link), and a temporary password given by an owner is replaced.
   While Diwan has no staff at all, the first owner can be made here with the server's setup key.
   TODO(2FA): while STAFF_2FA_REQUIRED is off, the password is enough ("done"), or a temporary one is replaced first
   ("new-password"); the "new-password" step goes once it is on. */

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

  const label = "mb-1.5 block text-sm font-medium";
  const codeField = (
    <div>
      <label htmlFor="dw-code" className={label}>{t("6-digit code", "الرمز المكوّن من 6 أرقام")}</label>
      <input
        id="dw-code"
        className={`${field} h-12 text-center text-xl tracking-[0.4em] tabular-nums`}
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
  const newPasswordFields = mustChange && (
    <div className="space-y-3 rounded-xl bg-soft p-3">
      <p className="text-sm">{t("You signed in with a temporary password. Choose your own now.", "دخلت بكلمة مرور مؤقتة. اختر كلمة مرورك الآن.")}</p>
      <div>
        <label htmlFor="dw-new" className={label}>{t("New password", "كلمة المرور الجديدة")}</label>
        <input id="dw-new" type="password" autoComplete="new-password" className={field} minLength={STAFF_PASSWORD_MIN} maxLength={128} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <p className="mt-1 text-xs text-muted">{t(passwordWords.short.en, passwordWords.short.ar)}</p>
      </div>
      <div>
        <label htmlFor="dw-new2" className={label}>{t("New password again", "أعد كتابة كلمة المرور الجديدة")}</label>
        <input id="dw-new2" type="password" autoComplete="new-password" className={field} maxLength={128} required value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold text-primary">{t("Diwan", "الديوان")}</span>
        <div className="flex items-center gap-2">
          <LangSwitch iconOnly />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className={`${card} w-full max-w-md p-6 sm:p-8`}>
          <h1 className="text-xl font-bold">
            {step === "setup" ? t("Create the first owner", "إنشاء المالك الأول")
              : step === "enroll" ? t("Set up your 2-step code", "إعداد رمز التحقق بخطوتين")
                : step === "code" ? t("Enter your 2-step code", "أدخل رمز التحقق")
                  : step === "new-password" ? t("Choose your password", "اختر كلمة مرورك")
                  : t("Sign in to Diwan", "الدخول إلى الديوان")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {step === "setup" ? t("Diwan has no staff yet. The setup key is on the server (DIWAN_SETUP_KEY).", "لا يوجد فريق في الديوان بعد. مفتاح الإعداد موجود في الخادم (DIWAN_SETUP_KEY).")
              : step === "enroll" ? t("Diwan asks for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) every time you sign in.", "يطلب الديوان رمزًا من تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator أو 1Password…) في كل مرة تدخل فيها.")
                : step === "code" ? t("Open your authenticator app and type the code shown for Diwan.", "افتح تطبيق المصادقة واكتب الرمز الظاهر للديوان.")
                  : t("For Dukkan staff only.", "لفريق دكّان فقط.")}
          </p>

          {note && <p className="mt-4 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">{note}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

          {step === "password" && (
            <form onSubmit={signIn} className="mt-6 space-y-4">
              <div>
                <label htmlFor="dw-email" className={label}>{t("Email", "البريد الإلكتروني")}</label>
                <input id="dw-email" type="email" dir="ltr" autoComplete="username" className={field} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div>
                <label htmlFor="dw-password" className={label}>{t("Password", "كلمة المرور")}</label>
                <input id="dw-password" type="password" autoComplete="current-password" className={field} required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Btn type="submit" disabled={busy} className="w-full">{busy ? t("Signing in…", "جارٍ الدخول…") : t("Continue", "متابعة")}</Btn>
              {setupOpen && (
                <button type="button" onClick={() => { setStep("setup"); setError(""); setNote(""); }} className="w-full text-center text-sm font-semibold text-primary hover:underline">
                  {t("Create the first owner", "إنشاء المالك الأول")}
                </button>
              )}
            </form>
          )}

          {step === "enroll" && (
            <form onSubmit={verify} className="mt-6 space-y-4">
              <ol className="list-decimal space-y-2 ps-5 text-sm">
                <li>{t("In your authenticator app, add an account by typing a key (or open the link below on your phone).", "في تطبيق المصادقة، أضف حسابًا بكتابة مفتاح (أو افتح الرابط أدناه من هاتفك).")}</li>
                <li>{t("Then type the 6-digit code the app shows.", "ثم اكتب الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق.")}</li>
              </ol>
              <div className="rounded-xl bg-soft p-3">
                <p className="text-xs font-semibold text-muted">{t("Key", "المفتاح")}</p>
                <p dir="ltr" className="mt-1 break-all font-mono text-base font-semibold tracking-wider">{secret.match(/.{1,4}/g)?.join(" ")}</p>
                <button type="button" onClick={() => copy("key", secret)} className="mt-2 text-sm font-semibold text-primary hover:underline">
                  {copied === "key" ? t("Copied", "تم النسخ") : t("Copy the key", "نسخ المفتاح")}
                </button>
              </div>
              <div className="rounded-xl bg-soft p-3">
                <p className="text-xs font-semibold text-muted">{t("Link for authenticator apps", "رابط لتطبيقات المصادقة")}</p>
                <p dir="ltr" className="mt-1 break-all font-mono text-xs">{link}</p>
                <button type="button" onClick={() => copy("link", link)} className="mt-2 text-sm font-semibold text-primary hover:underline">
                  {copied === "link" ? t("Copied", "تم النسخ") : t("Copy the link", "نسخ الرابط")}
                </button>
              </div>
              {codeField}
              {newPasswordFields}
              <Btn type="submit" disabled={busy} className="w-full">{busy ? t("Checking…", "جارٍ التحقق…") : t("Turn on and sign in", "تفعيل والدخول")}</Btn>
              <BackLink onClick={() => { setStep("password"); setError(""); }} />
            </form>
          )}

          {step === "code" && (
            <form onSubmit={verify} className="mt-6 space-y-4">
              {codeField}
              {newPasswordFields}
              <Btn type="submit" disabled={busy} className="w-full">{busy ? t("Checking…", "جارٍ التحقق…") : t("Sign in", "دخول")}</Btn>
              <p className="text-xs text-muted">{t("Lost your phone? Ask an owner to reset your 2-step code.", "فقدت هاتفك؟ اطلب من المالك إعادة ضبط رمز التحقق.")}</p>
              <BackLink onClick={() => { setStep("password"); setError(""); }} />
            </form>
          )}

          {step === "new-password" && (
            <form onSubmit={verify} className="mt-6 space-y-4">
              {newPasswordFields}
              <Btn type="submit" disabled={busy} className="w-full">{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save and sign in", "حفظ والدخول")}</Btn>
              <BackLink onClick={() => { setStep("password"); setError(""); }} />
            </form>
          )}

          {step === "setup" && (
            <form onSubmit={makeOwner} className="mt-6 space-y-4">
              <div>
                <label htmlFor="dw-key" className={label}>{t("Setup key", "مفتاح الإعداد")}</label>
                <input id="dw-key" type="password" autoComplete="off" className={field} required maxLength={200} value={setup.key} onChange={(e) => setSetup({ ...setup, key: e.target.value })} autoFocus />
              </div>
              <div>
                <label htmlFor="dw-sname" className={label}>{t("Your name", "اسمك")}</label>
                <input id="dw-sname" className={field} required maxLength={60} value={setup.name} onChange={(e) => setSetup({ ...setup, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dw-semail" className={label}>{t("Email", "البريد الإلكتروني")}</label>
                <input id="dw-semail" type="email" dir="ltr" autoComplete="username" className={field} required maxLength={254} value={setup.email} onChange={(e) => setSetup({ ...setup, email: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dw-spass" className={label}>{t("Password", "كلمة المرور")}</label>
                <input id="dw-spass" type="password" autoComplete="new-password" className={field} required minLength={STAFF_PASSWORD_MIN} maxLength={128} value={setup.password} onChange={(e) => setSetup({ ...setup, password: e.target.value })} />
                <p className="mt-1 text-xs text-muted">{t(passwordWords.short.en, passwordWords.short.ar)}</p>
              </div>
              <Btn type="submit" disabled={busy} className="w-full">{busy ? t("Creating…", "جارٍ الإنشاء…") : t("Create the owner", "إنشاء المالك")}</Btn>
              <BackLink onClick={() => { setStep("password"); setError(""); }} />
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className="w-full text-center text-sm text-muted hover:text-fg hover:underline">
      {t("Back", "رجوع")}
    </button>
  );
}
