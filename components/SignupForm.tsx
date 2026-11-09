"use client";

import { GIFT_FLAG } from "./ThemePopup";
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
import { ACCOUNT_LIMITS, passwordError } from "./safeAccount";
import { loadSetup, saveSetup } from "./setup";
import { resetToStarterDesign } from "./storefront/storage";
import { TwoStepCodeStep } from "./TwoStepSettings";

type Tab = "create" | "login";

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

/* Only the password's show/hide button has an icon; the other fields are plain */
const icons = {
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

/* The id of the small line under a field (its hint or its mistake), which the input points to */
const noteId = (id: string) => `${id}-note`;

/* A field: its label above, the input, and under it a hint or the mistake. The line under it is always there
   (empty when there is nothing to say) and is a polite live region, so a screen reader reads a mistake when it appears. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const note = error || hint;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      <div className="relative">{children}</div>
      <p id={noteId(id)} aria-live="polite" className={`text-xs ${note ? "mt-1.5" : ""} ${error ? "text-rose-600 dark:text-rose-400" : "text-muted"}`}>
        {note}
      </p>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-fg/15 bg-card px-3.5 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";
/* the quiet text buttons (change mode, continue without an account) */
const textLink =
  "rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

type Errors = { name?: string; email?: string; phone?: string; password?: string; loginId?: string };

export function SignupForm() {
  const { lang, t } = usePrefs();
  const c = content[lang].signup;

  const [tab, setTab] = useState<Tab>("create");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", loginId: "" });
  const [errors, setErrors] = useState<Errors>({});
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

  useEffect(() => {
    document.title = `${brandName(lang)} | ${tab === "create" ? c.tabs.create : c.tabs.login}`;
  }, [tab, c]);

  /* The create form is checked when he presses the button, each mistake shown under its field */
  const check = (): Errors => {
    const e: Errors = {};
    if (visibleLength(form.name) < 2) e.name = c.errName;
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
    if (busy) return;
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
      const r = await createAccount({ email, name, phone, password: form.password });
      setBusy(false);
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
      if (r !== "ok") {
        const suspended = lang === "ar" ? "أوقف فريق دكّان هذا المتجر مؤقتًا. تواصل مع الدعم لمعرفة السبب." : "Dukkan has suspended this store. Contact support to find out why.";
        setErrors(r === "none" ? { loginId: c.errNoAccount } : r === "wrong" ? { password: c.errWrongPassword } : r === "suspended" ? { password: suspended } : { password: c.errServer });
        document.getElementById(r === "none" ? "s-loginId" : "s-password")?.focus();
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
          /* His name and the number he registered with are the starting name and contact number of his store, until he changes them in setup or the designer. */
          const prev = loadSetup();
          if (!prev?.name || !prev?.phone) {
            saveSetup({
              name: prev?.name || name,
              description: prev?.description ?? "",
              color: prev?.color ?? "#004956",
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
        /* a real account (not the tour): the founders' gift greets it on the next page, once per account */
        if (!tour) sessionStorage.setItem(GIFT_FLAG, "1");
      } catch {
        /* storage unavailable */
      }
      router.push(tour ? "/demo" : goTo);
    }
  };

  const creating = tab === "create";
  const heading = c.heading[tab];
  const switchLine = creating ? c.switchMode.toLogin : c.switchMode.toCreate;
  const passwordField = (
    <Field id="s-password" label={c.password} hint={creating ? c.passwordHint : undefined} error={errors.password}>
      <input
        id="s-password"
        type={showPassword ? "text" : "password"}
        value={form.password}
        onChange={set("password")}
        placeholder={c.passwordPh}
        autoComplete={creating ? "new-password" : "current-password"}
        aria-required aria-invalid={!!errors.password} aria-describedby={noteId("s-password")}
        className={`${inputClass} pe-11 ${errors.password ? bad : ""}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? c.hidePassword : c.showPassword}
        aria-pressed={showPassword}
        className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {showPassword ? icons.eyeOff : icons.eye}
      </button>
    </Field>
  );

  return (
    <main className="relative min-h-screen bg-page px-4 pb-12 pt-20 sm:pt-28">
      {/* Language and theme, small in the page's top corner */}
      <div className="absolute end-4 top-4 flex items-center gap-2">
        <LangSwitch />
        <ThemeToggle />
      </div>

      <div data-lang-fade className="mx-auto w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>

        {tour && (
          <p className="mt-6 rounded-xl bg-primary/10 px-4 py-3 text-center text-sm font-medium text-deep dark:text-primary">
            {lang === "ar" ? "سجّل دخولك أو أنشئ حسابًا لتجربة المنصة." : "Log in or create an account to try the platform."}
          </p>
        )}

        <div className="mt-8 rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-20px_rgba(0,73,86,0.25)] ring-1 ring-fg/10 sm:p-8">
          <h1 className="text-xl font-bold text-fg">{heading.title}</h1>
          <p className="mt-1 text-sm text-muted">{heading.subtitle}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {tab === "create" ? (
              <>
                <Field id="s-name" label={c.fullName} error={errors.name}>
                  <input id="s-name" maxLength={ACCOUNT_LIMITS.name * 2} value={form.name} onChange={set("name")} placeholder={c.fullNamePh} autoComplete="name" aria-required aria-invalid={!!errors.name} aria-describedby={noteId("s-name")} className={`${inputClass} ${errors.name ? bad : ""}`} />
                </Field>
                <Field id="s-email" label={c.email} error={errors.email}>
                  <input id="s-email" type="email" maxLength={254} value={form.email} onChange={set("email")} placeholder={c.emailPh} autoComplete="email" aria-required aria-invalid={!!errors.email} aria-describedby={noteId("s-email")} className={`${inputClass} ${errors.email ? bad : ""}`} />
                </Field>
                <Field id="s-phone" label={c.phone} error={errors.phone}>
                  {/* the country code sits before the number, always left to right */}
                  <span dir="ltr" className={`flex h-11 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${errors.phone ? "!border-rose-500 focus-within:!ring-rose-500/25" : ""}`}>
                    <span className="flex h-full shrink-0 items-center gap-2 border-e border-fg/15 px-3 font-medium text-muted"><FlagJO />+962</span>
                    <input
                      id="s-phone"
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      aria-required aria-invalid={!!errors.phone} aria-describedby={noteId("s-phone")}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, phone: typedPhone(e.target.value) }));
                        if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
                      }}
                      placeholder={c.phonePh}
                      autoComplete="tel-national"
                      className="h-full min-w-0 flex-1 bg-transparent px-3 text-fg outline-none placeholder:text-muted/70"
                    />
                  </span>
                </Field>
                {passwordField}
              </>
            ) : (
              <>
                <Field id="s-loginId" label={c.loginId} error={errors.loginId}>
                  <input id="s-loginId" maxLength={254} value={form.loginId} onChange={set("loginId")} placeholder={c.loginIdPh} autoComplete="username" aria-required aria-invalid={!!errors.loginId} aria-describedby={noteId("s-loginId")} className={`${inputClass} ${errors.loginId ? bad : ""}`} />
                </Field>
                {passwordField}
                {/* TODO: show "Forgot your password?" (c.forgot) here once there is a page to reset it; it is hidden until then rather than a link that goes nowhere */}
              </>
            )}

            {/* Always pressable when creating an account: pressing it shows what is missing */}
            <button
              type="submit"
              disabled={busy || (tab === "login" && !loginValid)}
              className="!mt-6 h-11 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition enabled:hover:bg-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:bg-primary/20 disabled:text-muted dark:bg-primary dark:text-ink dark:enabled:hover:bg-primary/90 dark:disabled:bg-primary/20 dark:disabled:text-muted"
            >
              {tab === "create" ? c.register : c.loginBtn}
            </button>

            {tab === "create" && (
              <p className="text-center text-xs leading-relaxed text-muted">
                {c.terms.before}
                <a href="#" className="font-medium text-fg underline-offset-2 hover:underline">{c.terms.terms}</a>
                {c.terms.and}
                <a href="#" className="font-medium text-fg underline-offset-2 hover:underline">{c.terms.privacy}</a>
              </p>
            )}
          </form>
          {codeStep && <TwoStepCodeStep onDone={codeStep} />}

          {/* One quiet line changes between signing in and creating an account */}
          <p className="mt-6 border-t border-fg/10 pt-5 text-center text-sm text-muted">
            {switchLine.question}{" "}
            <button type="button" onClick={() => setTab(creating ? "login" : "create")} className={textLink}>
              {switchLine.action}
            </button>
          </p>
        </div>

        {/* Prototype shortcut: go in without creating an account (also for the platform tour) */}
        <p className="mt-6 text-center text-sm">
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
            className="rounded font-medium text-muted underline-offset-2 transition hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {c.guest}
          </button>
        </p>
      </div>
    </main>
  );
}
