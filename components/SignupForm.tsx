"use client";

import { createAccount, logIn, logInCode, logInResend, loginCodeTo, madeProfile, signupCancel, signupCode, signupResend, signupWaiting } from "./accounts";
import { EmailCodeStep } from "./EmailCodeStep";
import { useLogOut } from "./LogOut";
import { demoActive, endDemo } from "./demoSandbox";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brandName, content } from "./content";
import { FlagJO } from "./Flag";
import { Logo } from "./Nav";
import { LangSwitch, ThemeToggle, usePrefs } from "./Prefs";
import { isJordanMobile, jordanMobile, phoneError, savedMobile, typedPhone } from "./phone";
import { cleanLine, emailOf, isBlank, passwordProblem, visibleLength } from "./safe";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { ACCOUNT_LIMITS, passwordError } from "./safeAccount";
import { LengthCounter, lineLength, nameTooLong } from "./LengthCounter";
import { loadSetup, saveSetup } from "./setup";
import { SETUP_STEPS } from "./safeOrder";
import { resetToStarterDesign } from "./storefront/storage";
import { SUSPENDED_PATH } from "./suspended";
import { ForgotPassword } from "./ForgotPassword";
import { usePageTitle } from "./pageTitle";

type Tab = "create" | "login";

/* Words only this page uses: the button before the page is ready, and what is said once a forgotten password was
   reset by code (ForgotPassword.tsx, which also keeps the ways to reach support for when no code comes) */
const words = {
  en: {
    loading: "Loading…",
    confirmTitle: "Confirm your email",
    changeDetails: "Change my details",
    signInCodeTitle: "Enter your sign-in code",
    backToSignIn: "Back to sign in",
    /* no time is promised: an hour's cap or a day's cap may be the one that was reached */
    emailSlow: "Too many codes were sent to this email. Try again later.",
    sendFailed: "We couldn't send a code to this email. Check it's typed right.",
    locked: "Too many wrong tries. For your safety, wait an hour and try again.",
    gone: "That took too long. Please send the form again.",
    made: "Your account is ready. Sign in with your email and password.",
    resetDone: "Your password was changed.",
    resetSigningIn: "Your password was changed. Signing you in…",
    resetTitle: "Reset password",
  },
  ar: {
    loading: "جارٍ التحميل…",
    confirmTitle: "أكّد بريدك الإلكتروني",
    changeDetails: "تعديل بياناتي",
    signInCodeTitle: "أدخل رمز تسجيل الدخول",
    backToSignIn: "العودة إلى تسجيل الدخول",
    emailSlow: "أُرسلت رموز كثيرة إلى هذا البريد. حاول مرة أخرى لاحقًا.",
    sendFailed: "لم نتمكّن من إرسال رمز إلى هذا البريد. تأكّد من كتابته بشكل صحيح.",
    locked: "محاولات خاطئة كثيرة. حفاظًا على أمانك، انتظر ساعة ثم حاول مرة أخرى.",
    gone: "استغرق الأمر وقتًا طويلًا. أرسل النموذج مرة أخرى.",
    made: "حسابك جاهز. سجّل الدخول ببريدك وكلمة المرور.",
    resetDone: "تم تغيير كلمة المرور.",
    resetSigningIn: "تم تغيير كلمة المرور. جارٍ تسجيل دخولك…",
    resetTitle: "إعادة تعيين كلمة المرور",
  },
};

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const icons = {
  user: (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  mail: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  lock: (
    <svg {...iconProps}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  eye: (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg {...iconProps}>
      <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
};

function Field({
  label,
  icon,
  hint,
  error,
  children,
  below,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  /* shown under the mistake or hint (the length of a name) */
  below?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">{label}<RequiredMark /></span>
        <span className="relative block">
          {icon && <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
          {children}
        </span>
      </label>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {below}
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-fg/15 bg-card text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

type Errors = { name?: string; email?: string; phone?: string; password?: string; loginId?: string };

export function SignupForm() {
  const { lang, t } = usePrefs();
  const c = content[lang].signup;
  const w = words[lang];
  /* "Forgot your password?" opens the reset by code in place of the form (ForgotPassword.tsx); notice: what is said on
     the sign-in form when it is done */
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState("");
  /* Until the page has loaded its script, pressing the button (or Enter) would send the form the browser's way: the
     page reloads and everything typed is gone. So the button waits, disabled, until the page is ready. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [tab, setTab] = useState<Tab>("create");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  /* the guest button signs out an account still signed in here, the same way the account menu does */
  const out = useLogOut(lang);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", loginId: "" });
  const [errors, setErrors] = useState<Errors>({});
  /* a message about the whole form, not one field (too many sign-ups from this connection) */
  const [formErr, setFormErr] = useState("");
  /* while the server answers, the button can't be pressed twice */
  const [busy, setBusy] = useState(false);
  /* the emailed code's page, in place of the form: signing up (the account is made once the code is right), or signing
     in with 2-step on. It tells the form how it ended. */
  const [codeStep, setCodeStep] = useState<{ kind: "signup" | "login"; to: string; sent: boolean; locked?: boolean; done: (r: "ok" | "cancel") => void } | null>(null);
  const askCode = (kind: "signup" | "login", to: string, sent = true, locked = false) =>
    new Promise<"ok" | "cancel">((done) => setCodeStep({ kind, to, sent, locked, done }));
  /* the field the cursor goes to once the code page has given the form its place back (it is drawn only then) */
  const focusAfterCode = useRef("");
  useEffect(() => {
    if (codeStep || !focusAfterCode.current) return;
    document.getElementById(focusAfterCode.current)?.focus();
    focusAfterCode.current = "";
  }, [codeStep]);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    /* a field's mistake goes away as soon as he edits it */
    if (key in errors) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  /* the form was sent on this page: a waiting sign-up found as the page opens no longer takes its place */
  const sentForm = useRef(false);

  /* Open on the login tab when arriving from the "Log in" button. */
  const [tour, setTour] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "login") setTab("login");
    /* "Try the platform" needs an account first, and goes to the tour after signing in */
    if (q.get("next") === "demo") {
      setTour(true);
      setTab((t) => (q.get("tab") ? t : "login"));
    }
    /* Making his own account ends the platform tour: otherwise his new store would be saved into the tour's made-up
       perfume store (the tour lives in this tab). The page opens again with his real data. */
    else if (demoActive()) endDemo(window.location.pathname + window.location.search);
    else {
      /* A sign-up of this browser still waits for its code (the page was loaded again on the code step): its code page
         comes back as it was, with no new code sent, instead of an empty form whose new send would use up another of
         the address's codes. Not when he already pressed the button meanwhile. */
      let off = false;
      void signupWaiting().then(async (email) => {
        if (!email || off || sentForm.current) return;
        setTab("create");
        setForm((f) => ({ ...f, email }));
        setBusy(true);
        const r = await askCode("signup", email);
        setCodeStep(null);
        setBusy(false);
        /* what was typed is gone with the old page: the account just made, as the server has it, is what setup keeps */
        if (r === "ok") enter("create", madeProfile() ?? { name: "", email, phone: "" });
      });
      return () => {
        off = true;
      };
    }
  }, []);

  usePageTitle(`${brandName(lang)} | ${forgot ? w.resetTitle : tab === "create" ? c.tabs.create : c.tabs.login}`);

  /* The create form is checked when he presses the button, each mistake shown under its field */
  const check = (): Errors => {
    const e: Errors = {};
    if (visibleLength(form.name) < 2) e.name = c.errName;
    /* a name over the limit is refused, never cut */
    else if (lineLength(form.name) > ACCOUNT_LIMITS.name) e.name = nameTooLong(ACCOUNT_LIMITS.name)[lang];
    if (!emailOf(form.email)) e.email = c.errEmail;
    if (!isJordanMobile(form.phone)) e.phone = phoneError[lang];
    const pw = passwordProblem(form.password);
    if (pw) e.password = pw === "short" ? c.errPassword : passwordError[pw][lang];
    return e;
  };
  const loginValid = !isBlank(form.loginId) && !isBlank(form.password);

  /* Creates the account (or signs in) on the server, then goes to first-time setup or the dashboard */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    sentForm.current = true;
    let valid = loginValid;
    if (tab === "create") {
      const found = check();
      setErrors(found);
      valid = Object.keys(found).length === 0;
      /* the cursor goes to the first field with a mistake */
      const first = (["name", "email", "phone", "password"] as const).find((k) => found[k]);
      if (first) document.getElementById(`s-${first}`)?.focus();
    }
    /* Each account has its own store: a new email makes an empty one, and logging in needs an account that exists */
    /* what is kept: the name cleaned, the email in lower case and the 9 digits of the mobile */
    const name = cleanLine(form.name, ACCOUNT_LIMITS.name);
    const email = emailOf(form.email);
    const phone = savedMobile(form.phone);
    if (valid && tab === "create" && !tour) {
      setBusy(true);
      setFormErr("");
      let r: Awaited<ReturnType<typeof createAccount>> | "cancel" = await createAccount({ email, name, phone, password: form.password, lang });
      if (r === "code") {
        r = await askCode("signup", email);
        setCodeStep(null);
      }
      setBusy(false);
      if (r === "cancel") return;
      if (r === "slow-down" || r === "email-slow-down" || r === "locked") {
        /* not about one field: said under the button, where he is looking */
        setFormErr(r === "slow-down" ? c.errSignupMany : r === "locked" ? w.locked : w.emailSlow);
        return;
      }
      if (r === "send-failed") {
        setErrors({ email: w.sendFailed });
        document.getElementById("s-email")?.focus();
        return;
      }
      if (r !== "ok") {
        const field = r === "taken-phone" ? "phone" : r === "taken" ? "email" : "password";
        setErrors({ [field]: r === "taken-phone" ? c.errPhoneTaken : r === "taken" ? c.errTaken : c.errServer });
        document.getElementById(`s-${field}`)?.focus();
        return;
      }
    }
    let goTo = "/onboarding";
    if (valid && tab === "login" && !tour) {
      setBusy(true);
      let r: Awaited<ReturnType<typeof logIn>> | "cancel" = await logIn(form.loginId, form.password, lang);
      if (r === "code") {
        r = await askCode("login", loginCodeTo().to, loginCodeTo().sent, loginCodeTo().locked);
        setCodeStep(null);
      }
      setBusy(false);
      if (r === "cancel") return;
      /* the password was right but Dukkan suspended the store: a page of its own says why (logIn kept the reason) */
      if (r === "suspended") return router.push(SUSPENDED_PATH);
      if (r !== "ok") {
        /* one message for a wrong email, mobile or password: the server does not say which it was */
        setErrors({ password: r === "wrong" ? c.errWrongPassword : r === "slow-down" ? c.errTooMany : r === "server" ? c.errServerDown : c.errServer });
        document.getElementById("s-password")?.focus();
        return;
      }
      /* his store is ready: the dashboard, or the setup if it is not finished */
      if ((loadSetup()?.done ?? []).filter(Boolean).length >= 6) goTo = "/dashboard";
    }
    if (valid) enter(tab, { name, email, phone }, goTo);
  };

  /* Signed up or in (or into the platform tour): what this tab keeps of the account, then on to setup, the dashboard or
     the tour. `p`: the account's name, email and mobile as kept (the form's, or the server's after a refresh). */
  function enter(kind: Tab, p: { name: string; email: string; phone: string }, goTo = "/onboarding") {
    /* Kept only for this browser session, so setup can offer it as the support number. */
    try {
      if (kind === "create") {
        /* A new account starts from the starter template (the default design). Not in the tour: it must never touch real data. */
        if (!tour) resetToStarterDesign();
        sessionStorage.setItem("seen-account-phone", p.phone);
        /* Never the password, only what the settings page can show. */
        sessionStorage.setItem("seen-account-profile", JSON.stringify({ name: p.name, email: p.email, phone: p.phone }));
        /* The number he registered with is the starting contact number of his store, until he changes it in setup or the
           designer. His own name is the account's name only: the store name starts empty in setup, for him to type. */
        const prev = loadSetup();
        if (!prev?.phone) {
          saveSetup({
            name: prev?.name ?? "",
            description: prev?.description ?? "",
            color: prev?.color ?? "#e67726",
            phone: prev?.phone || p.phone,
            slug: prev?.slug ?? "",
            done: prev?.done ?? Array.from({ length: SETUP_STEPS }, () => false),
            pickup: prev?.pickup,
            logo: prev?.logo,
            product: prev?.product ?? null,
            shipping: prev?.shipping ?? null,
            /* a new store takes no way to pay until he turns one on (setup or Delivery options); an older one keeps its choice */
            pays: prev ? prev.pays : [],
          });
        }
      }
      else sessionStorage.removeItem("seen-account-phone");
    } catch {
      /* storage unavailable: setup just won't offer the registered number */
    }
    try {
      sessionStorage.setItem("seen-signed-in", "1");
    } catch {
      /* storage unavailable */
    }
    router.push(tour ? "/demo" : goTo);
  }

  /* The password was reset by code: back on the sign-in form, signed in with the new one the usual way (so the 2-step
     code is still asked for when it is on, and a suspended store still goes to its page). If that does not work out
     (the code step closed, the server can't be reached, or in the platform tour, which never signs in), the form just
     says the password was changed, ready for him to sign in. */
  const afterReset = async (id: string, password: string) => {
    setForgot(false);
    setTab("login");
    setErrors({});
    setForm((f) => ({ ...f, loginId: id, password: "" }));
    const back = () => {
      setNotice(w.resetDone);
      setTimeout(() => document.getElementById("s-password")?.focus(), 0);
    };
    if (tour) return back();
    setNotice(w.resetSigningIn);
    setBusy(true);
    let r: Awaited<ReturnType<typeof logIn>> | "cancel" = await logIn(id, password, lang);
    if (r === "code") {
      r = await askCode("login", loginCodeTo().to, loginCodeTo().sent, loginCodeTo().locked);
      setCodeStep(null);
    }
    setBusy(false);
    if (r === "suspended") return router.push(SUSPENDED_PATH);
    if (r !== "ok") return back();
    try {
      sessionStorage.removeItem("seen-account-phone");
      sessionStorage.setItem("seen-signed-in", "1");
    } catch {
      /* storage unavailable */
    }
    router.push((loadSetup()?.done ?? []).filter(Boolean).length >= 6 ? "/dashboard" : "/onboarding");
  };

  const creating = tab === "create";
  const passwordField = (
    <Field label={c.password} icon={icons.lock} hint={creating ? c.passwordHint : undefined} error={errors.password}>
      <input
        id="s-password"
        type={showPassword ? "text" : "password"}
        value={form.password}
        onChange={set("password")}
        placeholder={c.passwordPh}
        autoComplete={creating ? "new-password" : "current-password"}
        aria-required aria-invalid={!!errors.password}
        className={`${inputClass} ps-11 pe-11 ${errors.password ? bad : ""}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? c.hidePassword : c.showPassword}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-fg"
      >
        {showPassword ? icons.eyeOff : icons.eye}
      </button>
    </Field>
  );

  /* the path shown beside the form is the setup that follows sign-up (Onboarding.tsx): its steps, none done yet */
  const launch = c.side;
  const steps = content[lang].onboarding.tasks.slice(0, SETUP_STEPS).map((t) => t.title);
  const done = 0;

  return (
    <main className="grid min-h-screen bg-page lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </header>

        <div data-lang-fade className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {tour && (
            <p className="mb-5 rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-deep dark:text-primary">
              {lang === "ar" ? "سجّل دخولك أو أنشئ حسابًا لتجربة المنصة." : "Log in or create an account to try the platform."}
            </p>
          )}
          {codeStep ? (
            codeStep.kind === "signup" ? (
              <EmailCodeStep
                title={w.confirmTitle}
                to={codeStep.to}
                sent={codeStep.sent}
                backLabel={w.changeDetails}
                onSubmit={async (code) => {
                  const r = await signupCode(code);
                  if (r === "ok") codeStep.done("ok");
                  /* someone took the email or mobile meanwhile, or the hour ran out: back to the form, which says so */
                  else if (r === "made") {
                    /* the account was already made with this code (another tab): it signs in the usual way */
                    codeStep.done("cancel");
                    setTab("login");
                    setErrors({});
                    setForm((f) => ({ ...f, loginId: f.email, password: "" }));
                    setNotice(w.made);
                    focusAfterCode.current = "s-password";
                  } else if (r === "taken" || r === "taken-phone" || r === "gone") {
                    codeStep.done("cancel");
                    if (r === "gone") setFormErr(w.gone);
                    else {
                      const field = r === "taken-phone" ? "phone" : "email";
                      setErrors({ [field]: r === "taken-phone" ? c.errPhoneTaken : c.errTaken });
                      focusAfterCode.current = `s-${field}`;
                    }
                  }
                  return r;
                }}
                onResend={() => signupResend(lang)}
                onBack={() => {
                  void signupCancel();
                  /* back on the form, with what he typed: the cursor goes to its first field, so Enter sends it again */
                  focusAfterCode.current = "s-name";
                  codeStep.done("cancel");
                }}
              />
            ) : (
              <EmailCodeStep
                title={w.signInCodeTitle}
                to={codeStep.to}
                sent={codeStep.sent}
                locked={codeStep.locked}
                recovery
                backLabel={w.backToSignIn}
                onSubmit={async (code) => {
                  const r = await logInCode(code);
                  if (r === "ok") codeStep.done("ok");
                  return r;
                }}
                onResend={() => logInResend(lang)}
                onBack={() => {
                  focusAfterCode.current = "s-loginId";
                  codeStep.done("cancel");
                }}
              />
            )
          ) : forgot ? (
            <ForgotPassword
              initial={form.loginId}
              onBack={() => {
                setForgot(false);
                setTimeout(() => document.getElementById("s-loginId")?.focus(), 0);
              }}
              onDone={afterReset}
            />
          ) : (
          <>
          <div role="tablist" className="grid grid-cols-2 overflow-hidden rounded-xl border border-primary/30">
            {(["login", "create"] as const).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`h-12 text-sm font-semibold transition-colors ${tab === id ? "bg-soft text-fg" : "text-muted hover:text-fg"}`}
              >
                {c.tabs[id]}
              </button>
            ))}
          </div>

          {/* method post and no named fields: even a send before the page is ready never puts what he typed (the password)
              into the address */}
          <form method="post" action="#" onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <RequiredNote text={requiredNote[lang]} show={hasErrors(errors)} />
            {notice && tab === "login" && (
              <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-deep dark:text-primary">
                {notice}
              </p>
            )}
            {tab === "create" ? (
              <>
                <Field label={c.fullName} icon={icons.user} error={errors.name} below={<LengthCounter value={form.name} max={ACCOUNT_LIMITS.name} lang={lang} hideMessage={!!errors.name} />}>
                  {/* room past the limit, so a longer name is shown as too long instead of being stopped or cut */}
                  <input id="s-name" maxLength={ACCOUNT_LIMITS.name * 2} value={form.name} onChange={set("name")} placeholder={c.fullNamePh} autoComplete="name" aria-required aria-invalid={!!errors.name} className={`${inputClass} ps-11 ${errors.name ? bad : ""}`} />
                </Field>
                <Field label={c.email} icon={icons.mail} error={errors.email}>
                  <input id="s-email" type="email" maxLength={254} value={form.email} onChange={set("email")} placeholder={c.emailPh} autoComplete="email" aria-required aria-invalid={!!errors.email} className={`${inputClass} ps-11 ${errors.email ? bad : ""}`} />
                </Field>
                <Field label={c.phone} error={errors.phone}>
                  <span dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${errors.phone ? "!border-rose-500 focus-within:!ring-rose-500/25" : ""}`}>
                    <span className="flex h-full items-center gap-2 border-e border-fg/15 bg-soft/60 px-3 font-semibold"><FlagJO />+962</span>
                    <input
                      id="s-phone"
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      aria-required aria-invalid={!!errors.phone}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, phone: typedPhone(e.target.value) }));
                        if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
                      }}
                      placeholder={c.phonePh}
                      autoComplete="tel-national"
                      className="h-full flex-1 bg-transparent px-3 outline-none placeholder:text-muted/70"
                    />
                  </span>
                </Field>
                {passwordField}
              </>
            ) : (
              <>
                <Field label={c.loginId} icon={icons.user} error={errors.loginId}>
                  <input id="s-loginId" maxLength={254} value={form.loginId} onChange={set("loginId")} placeholder={c.loginIdPh} autoComplete="username" aria-required aria-invalid={!!errors.loginId} className={`${inputClass} ps-11 ${errors.loginId ? bad : ""}`} />
                </Field>
                {passwordField}
                <div>
                  {/* the reset by code, in place of this form; its last line keeps the ways to reach support */}
                  <button
                    type="button"
                    onClick={() => {
                      setNotice("");
                      setForgot(true);
                    }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {c.forgot}
                  </button>
                </div>
              </>
            )}

            {/* New here? A small line under the sign-in form that goes to registration */}
            {tab === "login" && (
              <p className="text-center text-xs text-muted">
                {lang === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
                <button type="button" onClick={() => setTab("create")} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {lang === "ar" ? "أنشئ حسابًا" : "Create one"}
                </button>
              </p>
            )}

            {/* Always pressable when creating an account: pressing it shows what is missing */}
            <button
              type="submit"
              disabled={!ready || busy || (tab === "login" && !loginValid)}
              aria-disabled={!ready || undefined}
              className={`h-12 w-full rounded-xl bg-ink text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-deep disabled:cursor-not-allowed disabled:bg-primary/20 disabled:text-muted ${ready ? "" : "!cursor-wait"}`}
            >
              {!ready ? w.loading : tab === "create" ? c.register : c.loginBtn}
            </button>
            {formErr && <p role="alert" className="text-center text-sm text-rose-600 dark:text-rose-400">{formErr}</p>}

          </form>


          {/* Prototype shortcut: go in without creating an account (also for the platform tour) */}
          <div className="mt-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-fg/15" />
            {c.or}
            <span className="h-px flex-1 bg-fg/15" />
          </div>
          <button
            type="button"
            onClick={() =>
              out.start(() => {
                try {
                  sessionStorage.removeItem("seen-account-phone");
                  sessionStorage.setItem("seen-signed-in", "1");
                } catch {
                  /* ignore */
                }
                router.push(tour ? "/demo" : "/onboarding");
              })
            }
            className="mt-6 h-12 w-full rounded-xl border border-fg/20 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-soft"
          >
            {c.guest}
          </button>
          {out.dialog}
          {/* No "you agree to Dukkan's Terms and Privacy Policy" line: Dukkan has no such pages of its own yet (the landing
              footer hides those links too), so agreeing to them meant nothing. Bring it back with real links once they exist. */}
          </>
          )}
        </div>
      </div>

      {/* Promo panel (desktop) */}
      <aside data-lang-fade className="m-3 hidden flex-col items-center justify-center rounded-[2rem] bg-soft px-10 py-12 text-center lg:flex">
        <p className="text-lg text-muted">{launch.kicker}</p>
        <h2 className="mt-2 max-w-md text-3xl font-extrabold leading-snug">{launch.heading}</h2>

        <div className="mt-10 w-full max-w-md rounded-3xl bg-card p-6 text-start shadow-[0_24px_60px_-24px_rgba(0,73,86,0.35)]">
          <div className="flex items-center justify-between">
            <p className="font-bold">{launch.panelTitle}</p>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-deep dark:text-primary">
              {done}/{steps.length}
            </span>
          </div>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-primary" : "bg-fg/10"}`} />
            ))}
          </div>
          <ul className="mt-5 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${i < done ? "bg-primary text-white" : "border border-fg/25 text-muted"}`}>
                  {i < done ? "✓" : i + 1}
                </span>
                <span className={i < done ? "font-semibold" : "text-muted"}>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-lg text-muted">{launch.caption}</p>
      </aside>
    </main>
  );
}
