"use client";

import { useEffect, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { FlagJO } from "./Flag";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";

const PROFILE_KEY = "seen-account-profile";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "h-12 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

type Profile = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: "male" | "female" | "";
  city: string;
};

const EMPTY: Profile = { name: "", email: "", phone: "", dob: "", gender: "", city: "" };

function loadProfile(): Profile {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return { ...EMPTY, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return EMPTY;
  }
}

const digits = (v: string) => v.replace(/\D/g, "").length;

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
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
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${s.tab}`;
  }, [lang, s]);

  /* What he typed at signup, plus anything saved here before. */
  useEffect(() => {
    setP(loadProfile());
  }, []);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((old) => ({ ...old, [key]: value }));

  const save = () => {
    const e: Record<string, string> = {};
    if (p.name.trim().length < 2) e.name = s.errors.name;
    if (!/^\S+@\S+\.\S+$/.test(p.email)) e.email = s.errors.email;
    if (digits(p.phone) < 8) e.phone = s.errors.phone;
    if (p.dob && p.dob > today) e.dob = s.errors.dob;

    /* Passwords are only checked, never stored. */
    const changing = current !== "" || next !== "" || confirm !== "";
    if (changing) {
      if (current === "") e.current = s.errors.current;
      if (next.length < 8) e.next = s.errors.short;
      else if (next !== confirm) e.confirm = s.errors.mismatch;
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      sessionStorage.setItem("seen-account-phone", p.phone.trim());
    } catch {
      /* storage unavailable: the page still behaves, nothing is kept */
    }
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
            <Field label={s.account.name} error={errors.name}>
              <input value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={field} />
            </Field>
            <Field label={s.account.phone} error={errors.phone}>
              <span dir="ltr" className="flex h-12 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
                <span className="flex h-full items-center gap-2 border-e border-fg/15 bg-soft/60 px-3 font-semibold">
                  <FlagJO />+962
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={p.phone}
                  onChange={(e) => set("phone", latin(e.target.value).replace(/[^\d\s]/g, "").replace(/^[\s0]+/, ""))}
                  className="h-full flex-1 bg-transparent px-3 outline-none"
                />
              </span>
            </Field>
            <Field label={s.account.email} error={errors.email}>
              <input type="email" dir="ltr" value={p.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={`${field} text-start`} />
            </Field>
            <Field label={s.account.dob} error={errors.dob}>
              <input type="date" value={p.dob} max={today} onChange={(e) => set("dob", e.target.value)} className={field} />
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
              <Field label={s.account.city}>
                <select value={p.city} onChange={(e) => set("city", e.target.value)} className={field}>
                  <option value="">{s.account.cityPh}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* Password */}
        <section className={card}>
          <h2 className="text-xl font-bold">{s.password.title}</h2>
          <div className="mt-6 space-y-5">
            <Field label={s.password.current} error={errors.current}>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={s.password.ph} autoComplete="current-password" className={field} />
            </Field>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={s.password.next} error={errors.next}>
                <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={field} />
              </Field>
              <Field label={s.password.confirm} error={errors.confirm}>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={s.password.ph} autoComplete="new-password" className={field} />
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
