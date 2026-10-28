"use client";

import { useEffect, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { isJordanMobile, savedMobile, typedAnyPhone } from "./phone";
import { cleanLine, isPickupAddress, visibleLength } from "./safe";
import { RequiredMark, RequiredNote, requiredNote } from "./Required";
import { usePrefs } from "./Prefs";
import { loadSetup, saveSetup, type SavedSetup } from "./setup";

/* The delivery options a merchant chose in setup. Until now there was no place to change them. */

const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const words = {
  en: { title: "Delivery options", sub: "Change how your orders reach customers. Your choice here is what customers and your team see.", save: "Save changes", saved: "Saved", notSet: "You have not chosen a delivery option yet." },
  ar: { title: "خيارات التوصيل", sub: "غيّر طريقة وصول طلباتك إلى عملائك. ما تختاره هنا هو ما يراه عملاؤك وفريقك.", save: "حفظ التغييرات", saved: "تم الحفظ", notSet: "لم تختر خيار توصيل بعد." },
};


type Mode = "own" | "seen";

export function Delivery() {
  const { lang } = usePrefs();
  const w = words[lang];
  const s = content[lang].onboarding.shipping;

  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<SavedSetup | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [pickup, setPickup] = useState(false);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  /* Each mistake shows under its own field */
  const [errors, setErrors] = useState<{ city?: string; address?: string; name?: string; phone?: string }>({});
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${w.title}`;
  }, [lang, w]);

  useEffect(() => {
    const v = loadSetup();
    setSetup(v);
    setPickup(v?.pickup ?? false);
    if (v?.shipping) {
      setMode(v.shipping.mode);
      setCity(v.shipping.city);
      setAddress(v.shipping.address);
      if (v.shipping.mode === "own") {
        setKind(v.shipping.kind);
        setName(v.shipping.name);
        setPhone(v.shipping.phone);
      }
    }
    setReady(true);
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    let shipping: SavedSetup["shipping"] = null;
    const next: typeof errors = {};
    if (mode === "seen") {
      if (!city) next.city = s.errCity;
      if (!isPickupAddress(address)) next.address = s.errAddress;
      shipping = { mode: "seen", kind: 0, name: s.seenName, phone: "", city, address: cleanLine(address, 120) };
    } else if (mode === "own") {
      if (visibleLength(name) < 2) next.name = s.errName;
      if (!isJordanMobile(phone)) next.phone = s.phoneInvalid;
      shipping = { mode: "own", kind, name: cleanLine(name, 60), phone: savedMobile(phone), city: "", address: "" };
    }
    setErrors(next);
    const first = (["city", "address", "name", "phone"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`d-${first}`)?.focus();
      return;
    }
    const base: SavedSetup = setup ?? { name: "", description: "", color: "#004956", phone: "", slug: "", done: Array.from({ length: 6 }, () => false), product: null, shipping: null };
    saveSetup({ ...base, pickup, shipping });
    setSetup({ ...base, pickup, shipping });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  };

  const radio = (on: boolean) => `flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${on ? "border-primary bg-primary/5" : "border-fg/15 hover:border-primary/60"}`;

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="domain" subtabs={[w.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <form onSubmit={save} noValidate className={`${card} max-w-2xl space-y-6 p-5 sm:p-7`}>
          <div>
            <h1 className="text-lg font-extrabold">{w.title}</h1>
            <p className="mt-1 text-sm text-muted">{w.sub}</p>
            {ready && !setup?.shipping && <p className="mt-3 rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">{w.notSet}</p>}
            {mode && <div className="mt-3"><RequiredNote text={requiredNote[lang]} /></div>}
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-bold">{s.modeTitle}</legend>
            {s.modes.map((m, i) => {
              const value: Mode = i === 0 ? "own" : "seen";
              return (
                <label key={m.title} className={radio(mode === value)}>
                  <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1 h-5 w-5 accent-[rgb(var(--primary))]" />
                  <span>
                    <span className="block text-sm font-bold">{m.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{m.desc}</span>
                    {value === "seen" && (
                      <span className="mt-1.5 block text-xs font-semibold text-primary">
                        {s.price} {s.perOrder}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {mode === "seen" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="d-city" className="mb-2 block text-sm font-semibold">{s.cityLabel}<RequiredMark /></label>
                <select id="d-city" aria-required aria-invalid={!!errors.city} value={city} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: undefined })); }} className={`${field} h-11 ${errors.city ? bad : ""}`}>
                  <option value="">{s.cityPh}</option>
                  {s.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.city && <p className="mt-1.5 text-xs text-rose-600">{errors.city}</p>}
              </div>
              <div>
                <label htmlFor="d-address" className="mb-2 block text-sm font-semibold">{s.addressLabel}<RequiredMark /></label>
                <input id="d-address" aria-required aria-invalid={!!errors.address} value={address} onChange={(e) => { setAddress(e.target.value); setErrors((x) => ({ ...x, address: undefined })); }} placeholder={s.addressPh} maxLength={120} className={`${field} h-11 ${errors.address ? bad : ""}`} />
                {errors.address && <p className="mt-1.5 text-xs text-rose-600">{errors.address}</p>}
              </div>
            </div>
          )}

          {mode === "own" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold">{s.whoLabel}</p>
                <div className="flex gap-2">
                  {s.kinds.map((k, i) => (
                    <button key={k} type="button" aria-pressed={kind === i} onClick={() => setKind(i)} className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition ${kind === i ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="d-name" className="mb-2 block text-sm font-semibold">{s.nameLabels[kind]}<RequiredMark /></label>
                <input id="d-name" aria-required aria-invalid={!!errors.name} value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} placeholder={s.namePhs[kind]} maxLength={60} className={`${field} h-11 ${errors.name ? bad : ""}`} />
                {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="d-phone" className="mb-2 block text-sm font-semibold">{s.phoneLabel}<RequiredMark /></label>
                <input id="d-phone" dir="ltr" inputMode="tel" aria-required aria-invalid={!!errors.phone} value={phone} onChange={(e) => { setPhone(typedAnyPhone(e.target.value)); setErrors((x) => ({ ...x, phone: undefined })); }} maxLength={20} placeholder="7X XXX XXXX" className={`${field} h-11 text-start ${errors.phone ? bad : ""}`} />
                {errors.phone ? <p className="mt-1.5 text-xs text-rose-600">{errors.phone}</p> : <p className="mt-1.5 text-xs text-muted">{s.phoneHint}</p>}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-fg/15 p-4 transition hover:border-primary/60">
            <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--primary))]" />
            <span>
              <span className="block text-sm font-bold">{s.pickupLabel}</span>
              <span className="mt-0.5 block text-xs text-muted">{s.pickupHint}</span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{w.save}</button>
            <span aria-live="polite" className="text-sm font-semibold text-primary">{flash ? w.saved : ""}</span>
          </div>
        </form>
      </main>
    </div>
  );
}
