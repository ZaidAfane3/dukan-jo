"use client";

import { createAccount, logIn, logOut } from "./accounts";
import { demoActive, endDemo } from "./demoSandbox";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { resetToStarterDesign } from "./storefront/storage";
import { SUSPENDED_PATH } from "./suspended";
import { TwoStepCodeStep } from "./TwoStepSettings";
import { ForgotPassword } from "./ForgotPassword";
import { usePageTitle } from "./pageTitle";

type Tab = "create" | "login";

/* Words only this page uses: the button before the page is ready, and what is said once a forgotten password was
   reset by code (ForgotPassword.tsx, which also keeps the ways to reach support for when no code comes) */
const words = {
  en: {
    loading: "Loading…",
    resetDone: "Your password was changed.",
    resetSigningIn: "Your password was changed. Signing you in…",
    resetTitle: "Reset password",
  },
  ar: {
    loading: "جارٍ التحميل…",
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", loginId: "" });
  const [errors, setErrors] = useState<Errors>({});
  /* a message about the whole form, not one field (too many sign-ups from this connection) */
  const [formErr, setFormErr] = useState("");
  /* while the server answers, the button can't be pressed twice */
  const [busy, setBusy] = useState(false);
  /* signing in to an account with 2-step codes: the code step is open, and tells the sign-in how it ended */
  const [codeStep, setCodeStep] = useState<((r: "ok" | "cancel") => void) | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    /* a field's mistake goes away as soon as he edits it */
    if (key in errors) setErrors((x) => ({ ...x, [key]: undefined }));
  };

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
      const r = await createAccount({ email, name, phone, password: form.password });
      setBusy(false);
      if (r === "slow-down") {
        /* not about one field: said under the button, where he is looking */
        setFormErr(c.errSignupMany);
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
      let r: Awaited<ReturnType<typeof logIn>> | "cancel" = await logIn(form.loginId, form.password);
      if (r === "code") {
        r = await new Promise<"ok" | "cancel">((done) => setCodeStep(() => done));
        setCodeStep(null);
      }
      setBusy(false);
      if (r === "cancel") return;
      /* the password was right but Dukkan suspended the store: a page of its own says why (logIn kept the reason) */
      if (r === "suspended") return router.push(SUSPENDED_PATH);
      if (r !== "ok") {
        /* one message for a wrong email, mobile or password: the server does not say which it was */
        setErrors({ password: r === "wrong" ? c.errWrongPassword : r === "slow-down" ? c.errTooMany : c.errServer });
        document.getElementById("s-password")?.focus();
        return;
      }
      /* his store is ready: the dashboard, or the setup if it is not finished */
      if ((loadSetup()?.done ?? []).filter(Boolean).length >= 6) goTo = "/dashboard";
    }
    if (valid) {
      /* Kept only for this browser session, so setup can offer it as the support number. */
      try {
        if (tab === "create") {
          /* A new account starts from the starter template (the default design). Not in the tour: it must never touch real data. */
          if (!tour) resetToStarterDesign();
          sessionStorage.setItem("seen-account-phone", phone);
          /* Never the password, only what the settings page can show. */
          sessionStorage.setItem("seen-account-profile", JSON.stringify({ name, email, phone }));
          /* The number he registered with is the starting contact number of his store, until he changes it in setup or the
             designer. His own name is the account's name only: the store name starts empty in setup, for him to type. */
          const prev = loadSetup();
          if (!prev?.phone) {
            saveSetup({
              name: prev?.name ?? "",
              description: prev?.description ?? "",
              color: prev?.color ?? "#e67726",
              phone: prev?.phone || phone,
              slug: prev?.slug ?? "",
              done: prev?.done ?? Array.from({ length: 6 }, () => false),
              pickup: prev?.pickup,
              logo: prev?.logo,
              product: prev?.product ?? null,
              shipping: prev?.shipping ?? null,
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
  };

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
    let r: Awaited<ReturnType<typeof logIn>> | "cancel" = await logIn(id, password);
    if (r === "code") {
      r = await new Promise<"ok" | "cancel">((done) => setCodeStep(() => done));
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

  const launch = c.side;
  const done = 2;

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
          {forgot ? (
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
          {codeStep && <TwoStepCodeStep onDone={codeStep} />}


          {/* Prototype shortcut: go in without creating an account (also for the platform tour) */}
          <div className="mt-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-fg/15" />
            {c.or}
            <span className="h-px flex-1 bg-fg/15" />
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                void logOut();
                sessionStorage.removeItem("seen-account-phone");
                sessionStorage.setItem("seen-signed-in", "1");
              } catch {
                /* ignore */
              }
              router.push(tour ? "/demo" : "/onboarding");
            }}
            className="mt-6 h-12 w-full rounded-xl border border-fg/20 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-soft"
          >
            {c.guest}
          </button>

          {tab === "create" && (
            <p className="mt-6 text-center text-xs leading-relaxed text-muted">
              {c.terms.before}
              <a href="#" className="font-semibold text-fg hover:underline">{c.terms.terms}</a>
              {c.terms.and}
              <a href="#" className="font-semibold text-fg hover:underline">{c.terms.privacy}</a>
            </p>
          )}
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
              {done}/{launch.steps.length}
            </span>
          </div>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {launch.steps.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-primary" : "bg-fg/10"}`} />
            ))}
          </div>
          <ul className="mt-5 space-y-3">
            {launch.steps.map((s, i) => (
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
