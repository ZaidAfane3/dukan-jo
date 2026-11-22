"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "@/components/pageTitle";
import { LangSwitch, ThemeToggle } from "@/components/Prefs";
import { DiwanMark } from "@/components/diwan/icons";
import { PAPER } from "@/components/diwan/Shell";
import { passwordWords, STAFF_PASSWORD_MIN } from "@/components/diwan/staffRules";
import { nextPage } from "@/components/diwan/signInAgain";
import { Btn, field, useT } from "@/components/diwan/ui";
import { latin } from "@/components/digits";

/* The staff sign-in: email and password, then the 6-digit code Diwan emails to the member's address on file
   (server/staffSignin.ts), with "Send a new code" (a minute between codes). A temporary password given by an owner is
   replaced in the same step as the code. Nobody is signed in before the code is right. A browser where the code was
   typed is remembered: there, next time, the password alone signs in (the server answers step "done").
   While Diwan has no staff at all, the first owner can be made here with the server's setup key.
   The look is kept quiet on purpose: Diwan's mark and name, one card with a title and a line under it, plain labels
   over plain fields, one button. */

type Step = "password" | "code" | "setup";
/* a minute between two codes, as the server waits (server/emailVerify.ts RESEND_SECONDS) */
const RESEND_SECONDS = 60;
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
  /* where the code went (partly hidden), and the seconds left before a new one can be asked for */
  const [to, setTo] = useState("");
  const [wait, setWait] = useState(0);
  const [setup, setSetup] = useState({ key: "", name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  /* the tab's title in the staff's language, again on a language switch and when Next's metadata title lands after it */
  usePageTitle(t("Diwan | Sign in", "ديوان | تسجيل الدخول"));

  useEffect(() => {
    fetch("/api/diwan/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSetupOpen(!!j?.open))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  /* why a code could not be sent: the email failed, too many codes lately, or too many wrong ones this hour */
  const notSent = (why: unknown) =>
    why === "locked" ? t("Too many wrong codes. For your safety, wait an hour and try again.", "رموز خاطئة كثيرة. حفاظًا على الأمان، انتظر ساعة ثم حاول مرة أخرى.")
      : why === "slow-down" ? t("Too many codes were sent to your email lately. Try again later.", "أُرسلت رموز كثيرة إلى بريدك مؤخرًا. حاول مرة أخرى لاحقًا.")
        : t("We couldn't send the code to your email. Try again later.", "تعذّر إرسال الرمز إلى بريدك. حاول مرة أخرى لاحقًا.");

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
    if (r.data?.result === "ok" && r.data.step === "done") {
      window.location.href = nextPage();
      return;
    }
    setBusy(false);
    if (r.data?.result === "ok" && r.data.step === "code") {
      setMustChange(!!r.data.mustChange);
      setCode("");
      setTo(String(r.data.to ?? ""));
      setNote("");
      setStep("code");
      if (r.data.sent === false) {
        setError(notSent(r.data.why));
        setWait(0);
      } else setWait(RESEND_SECONDS);
      return;
    }
    if (r.data?.result === "no-email")
      return setError(t("Diwan can't send sign-in codes by email right now, so nobody can sign in. Try again later.", "لا يستطيع الديوان إرسال رموز الدخول بالبريد الآن، لذا لا يمكن لأحد الدخول. حاول مرة أخرى لاحقًا."));
    setError(common(r) || (r.data?.result === "invalid" ? t("Enter your email and password.", "أدخل بريدك وكلمة المرور.") : t("The email or the password is not right.", "البريد أو كلمة المرور غير صحيحة.")));
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mustChange) {
      if (newPassword.length < STAFF_PASSWORD_MIN) return setError(t(passwordWords.short.en, passwordWords.short.ar));
      if (newPassword !== newPassword2) return setError(t("The two new passwords are not the same.", "كلمتا المرور الجديدتان غير متطابقتين."));
    }
    const six = code.replace(/\s/g, "");
    if (six.length !== 6) return setError(t("Type the 6 digits from the email.", "اكتب الأرقام الستة الموجودة في الرسالة."));
    setBusy(true);
    setNote("");
    const r = await post("/api/diwan/auth/code", { code: six, ...(mustChange ? { newPassword } : {}) });
    if (r.data?.result === "ok") {
      window.location.href = nextPage();
      return;
    }
    setBusy(false);
    const why = r.data?.result;
    if (why === "gone") return backAgain();
    const w = passwordWords[r.data?.problem as keyof typeof passwordWords];
    setError(
      why === "weak" && w ? t(w.en, w.ar)
        : why === "same" ? t("Choose a password different from the temporary one.", "اختر كلمة مرور غير المؤقتة.")
          : why === "wrong" ? t("That code isn't right. Use the code in the newest email from Diwan.", "الرمز غير صحيح. استخدم الرمز الموجود في أحدث رسالة من الديوان.")
            : why === "expired" ? t("This code has expired. Send a new code.", "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.")
              : why === "too-many" ? t("Too many wrong tries for this code. Send a new code.", "محاولات خاطئة كثيرة لهذا الرمز. اطلب رمزًا جديدًا.")
                : why === "locked" ? notSent("locked")
                  : common(r) || t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا."),
    );
  };

  /* the waiting sign-in ran out (15 minutes) or ended: back to the password */
  const backAgain = () => {
    setStep("password");
    setNote("");
    setError(t("That took too long. Sign in again.", "استغرق الأمر وقتًا طويلًا. سجّل الدخول مجددًا."));
  };

  const resend = async () => {
    setError("");
    setNote("");
    setBusy(true);
    const r = await post("/api/diwan/auth/code", { resend: true });
    setBusy(false);
    const why = r.data?.result;
    if (why === "ok") {
      setCode("");
      setWait(RESEND_SECONDS);
      setNote(t("We sent a new code. Use the code in the newest email; it works for 10 minutes.", "أرسلنا رمزًا جديدًا. استخدم الرمز الموجود في أحدث رسالة، وهو صالح لمدة 10 دقائق."));
      return;
    }
    if (why === "gone") return backAgain();
    /* refused for now: wait a minute before the next try, so pressing again can't use the allowance up */
    setWait(RESEND_SECONDS);
    setError(why === "send-failed" || why === "slow-down" || why === "locked" ? notSent(why === "send-failed" ? "failed" : why) : common(r) || notSent("failed"));
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
      setNote(t("The first owner is ready. Sign in now: a code will be sent to your email.", "المالك الأول جاهز. سجّل الدخول الآن، وسيصلك رمز على بريدك."));
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

  const back = () => { setStep("password"); setError(""); setNote(""); };

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
        placeholder="______"
        maxLength={7}
        required
        value={code}
        /* a code typed in Arabic digits (٠-٩) counts the same as one in Latin digits */
        onChange={(e) => setCode(latin(e.target.value).replace(/[^\d ]/g, ""))}
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
      : step === "code" ? t("Check your email", "تحقّق من بريدك")
        : t("Sign in to Diwan", "تسجيل الدخول إلى الديوان");
  /* the setup step does not name the server setting that holds the key: this page's script is sent to every visitor */
  const sub: React.ReactNode =
    step === "setup" ? t("Diwan has no staff yet. The setup key is in the server's settings.", "لا يوجد فريق في الديوان بعد. مفتاح الإعداد موجود في إعدادات الخادم.")
      : step === "code" ? (
          <>
            {t("We sent a 6-digit code to", "أرسلنا رمزًا من 6 أرقام إلى")}{" "}
            <bdi dir="ltr" className="font-medium text-fg">{to}</bdi>
            {t(". It works for 10 minutes.", "، وهو صالح لمدة 10 دقائق.")}
          </>
        )
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

          {step === "code" && (
            <form onSubmit={verify} className="mt-6 space-y-5">
              {codeField}
              <p className="-mt-2 text-xs leading-relaxed text-muted">{t("This browser will be remembered, so next time only your password is needed.", "سيتذكّر ديوان هذا المتصفح، فلن تحتاج في المرة القادمة إلا كلمة المرور.")}</p>
              {newPasswordSection}
              {problem}
              <Submit busy={busy} busyText={t("Checking…", "جارٍ التحقق…")}>{t("Sign in", "دخول")}</Submit>
              <button
                type="button"
                onClick={resend}
                disabled={busy || wait > 0}
                className="mx-auto block rounded-md px-2 py-1 text-sm font-semibold text-primary transition-colors hover:underline disabled:cursor-default disabled:font-normal disabled:text-muted disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {wait > 0 ? t(`Send a new code in ${wait} s`, `إرسال رمز جديد بعد ${wait} ث`) : t("Send a new code", "إرسال رمز جديد")}
              </button>
              <p className="text-center text-xs leading-relaxed text-muted">{t("Can't find it? Check your spam or junk folder.", "لم تجده؟ تحقّق من مجلد الرسائل غير المرغوب فيها.")}</p>
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
    /* ltr on the wrapper too, so the show button sits in the space the input keeps for it in Arabic as well */
    <div dir="ltr" className="relative">
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
