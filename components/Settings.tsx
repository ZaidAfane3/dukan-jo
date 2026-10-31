"use client";

import { useEffect, useState } from "react";
import { brandName, content } from "./content";
import { inLang } from "./safeOrder";
import { DashboardBar } from "./DashboardBar";
import { FlagJO } from "./Flag";
import { usePrefs } from "./Prefs";
import { isJordanMobile, jordanMobile, phoneError, savedMobile, shownMobile, typedPhone } from "./phone";
import { cleanDate, cleanLine, emailOf, isBlank, passwordProblem, visibleLength } from "./safe";
import { ACCOUNT_LIMITS, cleanProfile, DOB_MIN, dobError, passwordError, type Profile } from "./safeAccount";

const PROFILE_KEY = "seen-account-profile";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const EMPTY: Profile = { name: "", email: "", phone: "", dob: "", gender: "", city: "" };

function loadProfile(): Profile {
  try {
    /* anything can be written into this browser storage: a wrong field comes back empty */
    return cleanProfile(JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? "null"));
  } catch {
    return EMPTY;
  }
}

function Field({ label, children, error, id, required = false }: { label: string; children: React.ReactNode; error?: string; id?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
        {required && <span className="ms-1 text-rose-600" aria-hidden>*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function Radio({ name, value, current, label, onChange }: { name: string; value: string; current: string; label: string; onChange: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} className="h-5 w-5 accent-[rgb(var(--primary))]" />
      {label}
    </label>
  );
}

export function Settings() {
  const { lang } = usePrefs();
  const s = content[lang].settings;
  const cities = content[lang].onboarding.shipping.cities;

  const [p, setP] = useState<Profile>(EMPTY);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  /* The profile as last loaded or saved, to know if there are unsaved changes */
  const [kept, setKept] = useState(JSON.stringify(EMPTY));
  /* The profile as the fields show it: the 9 digits after the fixed +962, and the city in the language of the page */
  const forFields = (x: Profile): Profile => ({ ...x, phone: shownMobile(x.phone), city: inLang(x.city, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang) });
  const today = new Date().toISOString().slice(0, 10);
  const dirty = JSON.stringify(p) !== kept || current !== "" || next !== "" || confirm !== "";

  useEffect(() => {
    document.title = `${brandName(lang)} | ${s.tab}`;
  }, [lang, s]);

  /* What he typed at signup, plus anything saved here before. */
  useEffect(() => {
    const loaded = loadProfile();
    const shown = forFields(loaded);
    setP(shown);
    setKept(JSON.stringify(shown));
  }, []);

  /* the page language can arrive after the profile is loaded: the city follows it, saved or not */
  useEffect(() => {
    const follow = (x: Profile): Profile => ({ ...x, city: inLang(x.city, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang) });
    setP(follow);
    setKept((k) => JSON.stringify(follow(JSON.parse(k) as Profile)));
  }, [lang]);

  /* Leaving the page with unsaved changes asks first */
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((old) => ({ ...old, [key]: value }));

  const save = () => {
    const e: Record<string, string> = {};
    if (visibleLength(p.name) < 2) e.name = s.errors.name;
    if (!emailOf(p.email)) e.email = s.errors.email;
    if (!isJordanMobile(p.phone)) e.phone = phoneError[lang];
    if (p.dob && p.dob > today) e.dob = s.errors.dob;
    else if (p.dob && !cleanDate(p.dob, DOB_MIN, today)) e.dob = dobError[lang];

    /* Passwords are only checked, never stored. */
    const changing = current !== "" || next !== "" || confirm !== "";
    if (changing) {
      if (isBlank(current)) e.current = s.errors.current;
      const pw = passwordProblem(next);
      if (pw) e.next = pw === "short" ? s.errors.short : passwordError[pw][lang];
      else if (next !== confirm) e.confirm = s.errors.mismatch;
    }
    setErrors(e);
    /* the first field with a mistake comes into view with the cursor in it */
    const first = (["name", "phone", "email", "dob", "current", "next", "confirm"] as const).find((k) => e[k]);
    if (first) {
      const el = document.getElementById(`set-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    /* what is kept: the name cleaned, the email in lower case and the mobile as +9627XXXXXXXX */
    const clean: Profile = { ...cleanProfile(p), name: cleanLine(p.name, ACCOUNT_LIMITS.name), email: emailOf(p.email), phone: savedMobile(p.phone) };
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
      sessionStorage.setItem("seen-account-phone", clean.phone);
    } catch {
      /* storage unavailable: the page still behaves, nothing is kept */
    }
    setP(forFields(clean));
    setKept(JSON.stringify(forFields(clean)));
    setCurrent("");
    setNext("");
    setConfirm("");
    setToast(s.saved);
    window.setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="settings" subtabs={[s.tab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        {/* Title with a back arrow, and the Save button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" aria-label={s.back} title={s.back} className="grid h-11 w-11 place-items-center rounded-full border border-fg/15 transition hover:bg-soft">
              <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </a>
            <h1 className="text-2xl font-extrabold">{s.tab}</h1>
          </div>
          <button type="button" onClick={save} className="h-12 rounded-full bg-ink px-10 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">
            {s.save}
          </button>
        </div>

        {/* Account details */}
        <section id="account" className={`${card} scroll-mt-24`}>
          <h2 className="text-xl font-bold">{s.account.title}</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label={s.account.name} error={errors.name} id="set-name" required>
              <input id="set-name" aria-invalid={!!errors.name} maxLength={ACCOUNT_LIMITS.name * 2} value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={`${field} ${errors.name ? bad : ""}`} />
            </Field>
            <Field label={s.account.phone} error={errors.phone} id="set-phone" required>
              <span dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${errors.phone ? "!border-rose-500 focus-within:!ring-rose-500/25" : ""}`}>
                <span className="flex h-full items-center gap-2 border-e border-fg/15 bg-soft/60 px-3 font-semibold">
                  <FlagJO />+962
                </span>
                <input
                  id="set-phone"
                  aria-invalid={!!errors.phone}
                  type="tel"
                  inputMode="tel"
                  value={p.phone}
                  onChange={(e) => set("phone", typedPhone(e.target.value))}
                  className="h-full flex-1 bg-transparent px-3 outline-none"
                />
              </span>
            </Field>
            <Field label={s.account.email} error={errors.email} id="set-email" required>
              <input id="set-email" aria-invalid={!!errors.email} type="email" dir="ltr" maxLength={254} value={p.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={`${field} text-start ${errors.email ? bad : ""}`} />
            </Field>
            <Field label={s.account.dob} error={errors.dob} id="set-dob">
              <input id="set-dob" aria-invalid={!!errors.dob} type="date" value={p.dob} min={DOB_MIN} max={today} onChange={(e) => set("dob", e.target.value)} className={`${field} ${errors.dob ? bad : ""}`} />
            </Field>
          </div>

          <div className="mt-6 space-y-6">
            <Field label={s.account.gender}>
              <div className="flex gap-6">
                <Radio name="gender" value="male" current={p.gender} label={s.account.male} onChange={(v) => set("gender", v as Profile["gender"])} />
                <Radio name="gender" value="female" current={p.gender} label={s.account.female} onChange={(v) => set("gender", v as Profile["gender"])} />
              </div>
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label={s.account.city} id="set-city">
                <select id="set-city" value={p.city} onChange={(e) => set("city", e.target.value)} className={field}>
                  <option value="">{s.account.cityPh}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {/* a city saved before the list was cut stays shown, so the profile is not changed by itself */}
                  {p.city && !cities.includes(p.city) && <option value={p.city}>{p.city}</option>}
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* Password */}
        <section className={card}>
          <h2 className="text-xl font-bold">{s.password.title}</h2>
          <div className="mt-6 space-y-5">
            <Field label={s.password.current} error={errors.current} id="set-current">
              <input id="set-current" aria-invalid={!!errors.current} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={s.password.ph} autoComplete="current-password" className={`${field} ${errors.current ? bad : ""}`} />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={s.password.next} error={errors.next} id="set-next">
                <input id="set-next" aria-invalid={!!errors.next} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={`${field} ${errors.next ? bad : ""}`} />
              </Field>
              <Field label={s.password.confirm} error={errors.confirm} id="set-confirm">
                <input id="set-confirm" aria-invalid={!!errors.confirm} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={`${field} ${errors.confirm ? bad : ""}`} />
              </Field>
            </div>
            <p className="text-xs text-muted">{s.password.note}</p>
          </div>
        </section>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
