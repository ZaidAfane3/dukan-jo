"use client";

import { useEffect, useRef, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { isJordanMobile, savedMobile, typedAnyPhone } from "./phone";
import { cleanLine, isPickupAddress, visibleLength } from "./safe";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { inLang, KNOWN_CITIES, orderPays, ownCities, PAYMENTS, savedCities, type Payment } from "./safeOrder";
import { usePrefs } from "./Prefs";
import { shipCityShown, shipServes, shipWords, STORE_PAYS, storePays, usePublicSettings, useSettingsChecked } from "./platformPublic";
import { loadSetup, saveSetup, type SavedSetup } from "./setup";
import { typedMoney } from "./records";
import { cleanMoney } from "./safe";
import { ACCOUNT_LIMITS } from "./safeAccount";
import { MAX_PROOFS, ProofRows, syncProofPartner, usePartnerProofs } from "./partnerProofs";
import { dropUndos, offerUndo, valueUndo } from "./undo";
import type { Lang } from "./content";
import { usePageTitle } from "./pageTitle";
import { sellCheck, sellWords, shipsByDefault, storeLiveNow } from "./ReadyToSell";

/* The delivery options a merchant chose in setup. Until now there was no place to change them. With his own delivery
   partner he can also add or remove the partner's proof here, the same files as in the setup's shipping step: they go
   to Dukkan's team to check (components/partnerProofs.tsx). */

const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const words = {
  en: { title: "Delivery options", sub: "Change how your orders reach customers. Your choice here is what customers and your team see.", save: "Save changes", saved: "Saved", notSet: "Customers can't order delivery until you choose how you deliver.", fee: "Delivery fee per order (JOD)", feeHint: "What customers pay for delivery at checkout. Write 0 if delivery is free.", feeEmpty: "Enter the delivery fee. Write 0 if delivery is free.", feeBad: "Enter an amount from 0 to {max} JOD, with up to 3 decimals." },
  ar: { title: "خيارات التوصيل", sub: "غيّر طريقة وصول طلباتك إلى عملائك. ما تختاره هنا هو ما يراه عملاؤك وفريقك.", save: "حفظ التغييرات", saved: "تم الحفظ", notSet: "لا يستطيع العملاء طلب التوصيل حتى تختار طريقة التوصيل.", fee: "رسوم التوصيل لكل طلب (د.أ)", feeHint: "ما يدفعه العميل للتوصيل عند إتمام الطلب. اكتب 0 إن كان التوصيل مجانيًا.", feeEmpty: "اكتب رسوم التوصيل. اكتب 0 إن كان التوصيل مجانيًا.", feeBad: "اكتب مبلغًا من 0 إلى {max} د.أ، بثلاث خانات عشرية على الأكثر." },
};


type Mode = "own" | "seen";
type Saved = Pick<SavedSetup, "pickup" | "shipping">;

/* the undo note at the bottom (UndoToast.tsx): the one thing a save changed, or "saved" when it changed several */
const undoWords: Record<Lang, { saved: string; mode: (m: string) => string; pickupOn: string; pickupOff: string; fee: (n: number) => string; city: (c: string) => string; partner: (n: string) => string; cities: string }> = {
  en: {
    saved: "Delivery options saved",
    mode: (m) => `Delivery changed to: ${m}`,
    pickupOn: "Pickup from your store turned on",
    pickupOff: "Pickup from your store turned off",
    fee: (n) => `Delivery fee changed to ${n} JOD`,
    city: (c) => `Pickup city changed: ${c}`,
    partner: (n) => `Delivery partner changed: ${n}`,
    cities: "Delivery cities changed",
  },
  ar: {
    saved: "حُفظت خيارات التوصيل",
    mode: (m) => `تغيّر التوصيل إلى: ${m}`,
    pickupOn: "فُعّل الاستلام من المتجر",
    pickupOff: "أُوقف الاستلام من المتجر",
    fee: (n) => `تغيّرت رسوم التوصيل إلى ${n} د.أ`,
    city: (c) => `تغيّرت مدينة الاستلام: ${c}`,
    partner: (n) => `تغيّر شريك التوصيل: ${n}`,
    cities: "تغيّرت مدن التوصيل",
  },
};
const allCities = { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities };
/** What a save of the delivery options changed, in his language */
function savedLabel(a: Saved, b: Saved): (l: Lang) => string {
  const x = a.shipping;
  const y = b.shipping;
  const changes: ((l: Lang) => string)[] = [];
  if (!!a.pickup !== !!b.pickup) changes.push((l) => (b.pickup ? undoWords[l].pickupOn : undoWords[l].pickupOff));
  if (y && x?.mode !== y.mode) changes.push((l) => undoWords[l].mode(content[l].onboarding.shipping.modes[y.mode === "own" ? 0 : 1].title));
  else if (x && y) {
    if (x.city !== y.city || x.address !== y.address) changes.push((l) => undoWords[l].city(inLang(y.city, allCities, l)));
    if (x.name !== y.name || x.phone !== y.phone || x.kind !== y.kind) changes.push((l) => undoWords[l].partner(y.name));
    if ((x.fee ?? 0) !== (y.fee ?? 0)) changes.push((l) => undoWords[l].fee(y.fee ?? 0));
    if (ownCities(x.cities).en.join() !== ownCities(y.cities).en.join()) changes.push((l) => undoWords[l].cities);
  }
  return changes.length === 1 ? changes[0] : (l) => undoWords[l].saved;
}
const savedOf = (v: SavedSetup | null): Saved => ({ pickup: v?.pickup ?? false, shipping: v?.shipping ?? null });

export function Delivery() {
  const { lang } = usePrefs();
  const w = words[lang];
  /* Dukkan Ship's price, pickup cities and points are the ones Dukkan's staff set in Diwan */
  const platform = usePublicSettings();
  const s = { ...content[lang].onboarding.shipping, ...shipWords(platform, lang) };
  /* the server's settings are in: only then is a city missing from the list really gone */
  const checked = useSettingsChecked();
  const seenNote = s.priceNote.trim();
  const seenPoints = s.features.map((p) => p.trim()).filter(Boolean);

  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState<SavedSetup | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [pickup, setPickup] = useState(false);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  /* His own courier's fee as he types it: it must be filled (0 is free). A store that never set one starts empty, so a
     save never turns it into "free" without him writing 0 */
  const [fee, setFee] = useState("");
  /* the cities his own courier delivers to (English names); every city until he chooses */
  const [cities, setCities] = useState<string[]>(KNOWN_CITIES.en);
  /* Each mistake shows under its own field */
  const [errors, setErrors] = useState<{ city?: string; address?: string; name?: string; phone?: string; fee?: string; cities?: string }>({});
  const [flash, setFlash] = useState(false);
  /* the save was stopped: it would leave his live store without a way for customers to get their orders */
  const [liveBlock, setLiveBlock] = useState(false);
  const proof = usePartnerProofs([], s, lang);
  const fileInput = useRef<HTMLInputElement>(null);

  usePageTitle(`${brandName(lang)} | ${w.title}`);

  /* the form shows the saved delivery options (when the page opens, and after an undo) */
  const fill = (v: SavedSetup | null) => {
    setSetup(v);
    setPickup(v?.pickup ?? false);
    setErrors({});
    if (v?.shipping) {
      setMode(v.shipping.mode);
      setCity(inLang(v.shipping.city, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang));
      setAddress(v.shipping.address);
      if (v.shipping.mode === "own") {
        setKind(v.shipping.kind);
        setName(v.shipping.name);
        setPhone(v.shipping.phone);
        setFee(v.shipping.fee !== undefined ? String(v.shipping.fee) : "");
        setCities(ownCities(v.shipping.cities).en);
      }
    } else setMode(null);
  };
  useEffect(() => {
    fill(loadSetup());
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* a link to the Ways to pay card (/delivery#ways-to-pay, from a "not ready to sell" list): the card shows once the setup
     is read, so the page scrolls to it then */
  useEffect(() => {
    if (ready && window.location.hash === "#ways-to-pay") document.getElementById("ways-to-pay")?.scrollIntoView({ block: "start" });
  }, [ready]);
  /* only this page can put the options back in its form: its undo goes when it closes */
  useEffect(() => () => dropUndos("delivery"), []);

  /* the page language can arrive after the setup is loaded: the city follows it */
  useEffect(() => setCity((old) => inLang(old, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang)), [lang]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    let shipping: SavedSetup["shipping"] = null;
    const next: typeof errors = {};
    if (mode === "seen") {
      /* a city Dukkan Ship no longer serves is never saved again: he chooses one it serves */
      if (!city || !shipServes(platform, city)) next.city = s.errCity;
      if (!isPickupAddress(address)) next.address = s.errAddress;
      shipping = { mode: "seen", kind: 0, name: s.seenName, phone: "", city, address: cleanLine(address, 120) };
    } else if (mode === "own") {
      if (visibleLength(name) < 2) next.name = s.errName;
      if (!isJordanMobile(phone)) next.phone = s.phoneInvalid;
      /* the same money rule as every amount he saves; it must be written (0 for free) */
      const amount = cleanMoney(fee, ACCOUNT_LIMITS.shipFee);
      if (fee.trim() === "") next.fee = w.feeEmpty;
      else if (amount === "") next.fee = w.feeBad.replace("{max}", String(ACCOUNT_LIMITS.shipFee));
      if (!savedCities(cities).length) next.cities = cityWords[lang].none;
      shipping = { mode: "own", kind, name: cleanLine(name, 60), phone: savedMobile(phone), city: "", address: "", fee: Number(amount) || 0, cities: savedCities(cities) };
    }
    setErrors(next);
    const first = (["city", "address", "name", "phone", "fee", "cities"] as const).find((k) => next[k]);
    if (first) {
      /* the first field with a mistake comes into view (centred, clear of the bar on top) with the cursor in it; a list
         of cities has no box of its own to type in, so its first input or button takes the cursor */
      const el = document.getElementById(`d-${first}`);
      const target = el && !el.matches("input, select, textarea, button") ? el.querySelector<HTMLElement>("input, select, textarea, button") ?? el : el;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
      return;
    }
    /* the setup as saved now (the ways to pay may have been saved below since the page opened) */
    const base: SavedSetup = loadSetup() ?? setup ?? { name: "", description: "", color: "#e67726", phone: "", slug: "", done: Array.from({ length: 6 }, () => false), product: null, shipping: null };
    /* a live store keeps a way for customers to get their orders: a change that takes away the last one is not saved
       (the server holds a save to the same rule: app/api/store PUT "not-ready"). A store already without one (Diwan
       took Dukkan Ship's cities away) can still save. */
    if (storeLiveNow() && sellCheck(platform, { ...base, pickup, shipping }).missing.includes("delivery") && !sellCheck(platform, base).missing.includes("delivery")) {
      setLiveBlock(true);
      return;
    }
    setLiveBlock(false);
    const before = savedOf(loadSetup());
    saveSetup({ ...base, pickup, shipping });
    /* the proofs still waiting for a check follow the partner's new name */
    if (shipping?.mode === "own") syncProofPartner(shipping.name, shipping.kind);
    setSetup({ ...base, pickup, shipping });
    /* an Undo puts the options back as they were before this save, unless they were saved again since (another tab, the setup) */
    const after = savedOf(loadSetup());
    const undo = valueUndo({
      before,
      after,
      now: () => savedOf(loadSetup()),
      put: (v) => {
        const cur = loadSetup() ?? base;
        saveSetup({ ...cur, ...v });
        if (v.shipping?.mode === "own" && (v.shipping.name !== after.shipping?.name || v.shipping.kind !== after.shipping?.kind)) syncProofPartner(v.shipping.name, v.shipping.kind);
        fill(loadSetup());
      },
    });
    if (undo) offerUndo({ scope: "delivery", label: savedLabel(before, after), undo });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  };

  const radio = (on: boolean) => `flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${on ? "border-primary bg-primary/5" : "border-fg/15 hover:border-primary/60"}`;

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="store" subtabs={[w.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <form onSubmit={save} noValidate className={`${card} max-w-2xl space-y-6 p-5 sm:p-7`}>
          <div>
            <h1 className="text-lg font-extrabold">{w.title}</h1>
            <p className="mt-1 text-sm text-muted">{w.sub}</p>
            {/* no choice saved: a live store delivers with Dukkan Ship by default until he chooses (ReadyToSell shipsByDefault) */}
            {ready && !setup?.shipping && <p className="mt-3 rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">{storeLiveNow() && checked && shipsByDefault(platform, setup) ? sellWords[lang].shipDefault : w.notSet}</p>}
            {mode && hasErrors(errors) && <div className="mt-3"><RequiredNote text={requiredNote[lang]} show /></div>}
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
                      <>
                        <span className="mt-1.5 block text-xs font-semibold text-primary">
                          {s.price}{!s.free && ` ${s.perOrder}`}
                        </span>
                        {/* the short line and the points Dukkan's staff write in Diwan (Ship: "What merchants read"), in the
                            page's language; left out when they are empty. Spans, since a label may only hold inline content */}
                        {seenNote && <span className="mt-1 block text-xs text-muted">{seenNote}</span>}
                        {seenPoints.length > 0 && (
                          <span role="list" className="mt-2 block space-y-1">
                            {seenPoints.map((p) => (
                              <span key={p} role="listitem" className="flex items-start gap-2 text-xs font-medium">
                                <span aria-hidden className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] text-white">✓</span>
                                <span className="min-w-0">{p}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {mode === "seen" && (
            <div className="space-y-4">
              {/* his saved pickup city was taken off Dukkan Ship's list in Diwan: kept as saved (nothing changes behind his back)
                  until he chooses another one here */}
              {checked && !shipServes(platform, city) && <CityGone text={s.cityGone} city={city} />}
              <div>
                <label htmlFor="d-city" className="mb-2 block text-sm font-semibold">{s.cityLabel}<RequiredMark /></label>
                <select id="d-city" aria-required aria-invalid={!!errors.city} aria-describedby={checked && !shipServes(platform, city) ? "d-city-gone" : undefined} value={shipCityShown(platform, city, lang)} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: undefined })); }} className={`${field} h-11 ${errors.city ? bad : ""}`}>
                  <option value="">{s.cityPh}</option>
                  {/* only the cities Dukkan Ship serves now */}
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
              <div>
                <label htmlFor="d-fee" className="mb-2 block text-sm font-semibold">{w.fee}<RequiredMark /></label>
                <input id="d-fee" dir="ltr" inputMode="decimal" aria-required aria-invalid={!!errors.fee} aria-describedby="d-fee-note" value={fee} onChange={(e) => { setFee(typedMoney(e.target.value, 3)); setErrors((x) => ({ ...x, fee: undefined })); }} placeholder="0" className={`${field} h-11 max-w-[12rem] text-start ${errors.fee ? bad : ""}`} />
                <p id="d-fee-note" className={`mt-1.5 text-xs ${errors.fee ? "text-rose-600" : "text-muted"}`}>{errors.fee ?? w.feeHint}</p>
              </div>
              <OwnCities lang={lang} id="d-cities" value={cities} onChange={(v) => { setCities(v); setErrors((x) => ({ ...x, cities: undefined })); }} error={errors.cities} />
              <div>
                <p className="mb-1 text-sm font-semibold">{s.proofLabel}</p>
                <p className="mb-3 text-xs text-muted">{s.proofHint}</p>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void proof.add(picked, { name: cleanLine(name, ACCOUNT_LIMITS.shipName), kind });
                  }}
                  className="hidden"
                />
                <button type="button" onClick={() => fileInput.current?.click()} disabled={proof.busy || !proof.ready || proof.proofs.length >= MAX_PROOFS} className="grid h-16 w-full place-items-center rounded-2xl border-2 border-dashed border-primary/40 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">
                  <span>
                    {proof.busy ? s.proofSending : s.proofAdd} <span dir="ltr" className="text-muted">({proof.proofs.length}/{MAX_PROOFS})</span>
                  </span>
                </button>
                <p className="mt-2 text-xs text-muted">{s.proofLimit}</p>
                {proof.error && <p role="alert" className="mt-1 text-xs text-rose-600">{proof.error}</p>}
                <ProofRows proofs={proof.proofs} s={s} onRemove={(f) => void proof.remove(f)} />
                <p className="mt-3 text-xs text-muted">{proof.sends ? s.serverNote : s.localNote}</p>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-fg/15 p-4 transition hover:border-primary/60">
            <input type="checkbox" checked={pickup} onChange={(e) => { setPickup(e.target.checked); setLiveBlock(false); }} className="mt-1 h-5 w-5 accent-[rgb(var(--primary))]" />
            <span>
              <span className="block text-sm font-bold">{s.pickupLabel}</span>
              <span className="mt-0.5 block text-xs text-muted">{s.pickupHint}</span>
            </span>
          </label>

          {liveBlock && <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-400">{sellWords[lang].liveDelivery}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{w.save}</button>
            <span aria-live="polite" className="text-sm font-semibold text-primary">{flash ? w.saved : ""}</span>
          </div>
        </form>
        {ready && <PaysCard />}
      </main>
    </div>
  );
}

/* The ways to pay a store takes: one switch per way, the ones Dukkan has off greyed (Diwan decides those) */
export const payWords = {
  en: {
    title: "Ways to pay",
    sub: "Choose how customers can pay you at checkout.",
    names: { cliq: "CliQ", cash: "Cash on delivery", card: "Card" } as Record<Payment, string>,
    unavailable: "Not available on Dukkan right now",
    none: "Customers can't place orders until you turn on at least one way to pay.",
    save: "Save",
    saved: "Saved",
    undo: "Ways to pay saved",
  },
  ar: {
    title: "طرق الدفع",
    sub: "اختر كيف يدفع لك العملاء عند إتمام الطلب.",
    names: { cliq: "كليك CliQ", cash: "الدفع عند الاستلام", card: "بطاقة" } as Record<Payment, string>,
    unavailable: "غير متاح على دكّان حاليًا",
    none: "لا يستطيع العملاء إتمام الطلب حتى تفعّل طريقة دفع واحدة على الأقل.",
    save: "حفظ",
    saved: "تم الحفظ",
    undo: "حُفظت طرق الدفع",
  },
};

/** The ways to pay he takes, one switch each (safeOrder orderPays: the checkout and the server offer only the ones Dukkan
    has on that he turned on). A way Dukkan has off is greyed and can't be turned on. The setup's shipping step shows the
    same switches. `id` goes on the first switch, where a mistake brings the cursor. */
export function PaysPicker({ lang, id, value, onChange, error }: { lang: Lang; id: string; value: Payment[]; onChange: (v: Payment[]) => void; error?: string }) {
  const t = payWords[lang];
  const on = storePays(usePublicSettings());
  return (
    <fieldset aria-describedby={`${id}-note`}>
      <legend className="mb-1 text-sm font-semibold">{t.title}<RequiredMark /></legend>
      <p id={`${id}-note`} className={`mb-3 text-xs ${error ? "text-rose-600" : "text-muted"}`}>{error ?? t.sub}</p>
      <div className={`divide-y divide-fg/10 rounded-xl border ${error ? "border-rose-500" : "border-fg/15"}`}>
        {STORE_PAYS.map((p, i) => {
          const avail = on.includes(p);
          const checked = avail && value.includes(p);
          return (
            <label key={p} className={`flex items-center justify-between gap-4 px-4 py-3 ${avail ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              <span>
                <span className="block text-sm font-semibold">{t.names[p]}</span>
                {!avail && <span className="mt-0.5 block text-xs text-muted">{t.unavailable}</span>}
              </span>
              <input id={i === 0 ? id : undefined} type="checkbox" role="switch" checked={checked} disabled={!avail} onChange={(e) => onChange(PAYMENTS.filter((x) => (x === p ? e.target.checked : value.includes(x))))} className="peer sr-only" />
              <span aria-hidden dir="ltr" className="relative h-6 w-11 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* The Delivery options page's "Ways to pay" card: saved in his setup (`pays`), with an Undo like the delivery save. A
   store that never chose shows the ways it takes today (every way Dukkan has on) */
function PaysCard() {
  const { lang } = usePrefs();
  const t = payWords[lang];
  const platform = usePublicSettings();
  const savedPays = () => loadSetup()?.pays;
  const [pays, setPays] = useState<Payment[]>(() => savedPays() ?? storePays(platform));
  const [flash, setFlash] = useState(false);
  /* the save was stopped: it would leave his live store without a way to pay */
  const [liveBlock, setLiveBlock] = useState(false);
  const live = orderPays(storePays(platform), pays);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const cur = loadSetup();
    const base: SavedSetup = cur ?? { name: "", description: "", color: "#e67726", phone: "", slug: "", done: Array.from({ length: 6 }, () => false), product: null, shipping: null };
    /* a live store keeps at least one way to pay that is on (the server holds a save to the same rule: app/api/store PUT
       "not-ready"); one Diwan already left without any can still save */
    if (storeLiveNow() && sellCheck(platform, { ...base, pays }).missing.includes("pay") && !sellCheck(platform, base).missing.includes("pay")) {
      setLiveBlock(true);
      return;
    }
    setLiveBlock(false);
    const before = { pays: cur?.pays };
    saveSetup({ ...base, pays });
    const after = { pays: loadSetup()?.pays };
    const undo = valueUndo({
      before,
      after,
      now: () => ({ pays: loadSetup()?.pays }),
      put: (v) => {
        const now = loadSetup() ?? base;
        const rest: SavedSetup = { ...now };
        delete rest.pays;
        saveSetup(v.pays ? { ...rest, pays: v.pays } : rest);
        setPays(loadSetup()?.pays ?? storePays(platform));
      },
    });
    if (undo) offerUndo({ scope: "delivery", label: (l) => payWords[l].undo, undo });
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
  };
  return (
    <form id="ways-to-pay" onSubmit={save} noValidate className={`${card} max-w-2xl scroll-mt-24 space-y-4 p-5 sm:p-7`}>
      <PaysPicker lang={lang} id="d-pays" value={pays} onChange={(v) => { setPays(v); setLiveBlock(false); }} />
      {liveBlock ? (
        <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-400">{sellWords[lang].livePay}</p>
      ) : live.length === 0 && <p role="status" className="rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">{t.none}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{t.save}</button>
        <span aria-live="polite" className="text-sm font-semibold text-primary">{flash ? t.saved : ""}</span>
      </div>
    </form>
  );
}

const cityWords = {
  en: { label: "Cities you deliver to", hint: "Customers can order delivery only to these cities.", all: "All cities", none: "Choose at least one city you deliver to." },
  ar: { label: "المدن التي توصّل إليها", hint: "يستطيع العملاء طلب التوصيل إلى هذه المدن فقط.", all: "كل المدن", none: "اختر مدينة واحدة على الأقل توصّل إليها." },
};

/** With his own courier: the cities he delivers to (safeOrder KNOWN_CITIES, saved by their English names), with an "All
    cities" switch. The checkout, the server and the add-order form offer only these (safeOrder deliveryCities). The
    setup's shipping step shows the same picker. `id` goes on the "All cities" box, where a mistake brings the cursor. */
export function OwnCities({ lang, id, value, onChange, error }: { lang: Lang; id: string; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const t = cityWords[lang];
  const all = KNOWN_CITIES.en.every((c) => value.includes(c));
  const box = "h-4 w-4 shrink-0 accent-[rgb(var(--primary))]";
  return (
    <fieldset aria-describedby={`${id}-note`}>
      <legend className="mb-1 text-sm font-semibold">{t.label}<RequiredMark /></legend>
      <p id={`${id}-note`} className={`mb-3 text-xs ${error ? "text-rose-600" : "text-muted"}`}>{error ?? t.hint}</p>
      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
        <input id={id} type="checkbox" checked={all} onChange={() => onChange(all ? [] : [...KNOWN_CITIES.en])} aria-invalid={!!error} className={box} />
        {t.all}
      </label>
      <div className={`grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-3 sm:grid-cols-3 ${error ? "border-rose-500" : "border-fg/15"}`}>
        {KNOWN_CITIES.en.map((c, i) => (
          <label key={c} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={value.includes(c)} onChange={(e) => onChange(savedCities(e.target.checked ? [...value, c] : value.filter((x) => x !== c)))} className={box} />
            {KNOWN_CITIES[lang][i]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The warning shown when the saved pickup city is one Dukkan Ship no longer serves, the city's name in <bdi> */
export function CityGone({ text, city, id = "d-city-gone" }: { text: string; city: string; id?: string }) {
  const [before, after = ""] = text.split("{city}");
  return (
    <p id={id} role="alert" className="rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">
      {before}
      <bdi>{city}</bdi>
      {after}
    </p>
  );
}
