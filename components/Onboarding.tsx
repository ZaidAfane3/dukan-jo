"use client";

import { QTY_DIGITS, StockChoice, stockNeedsAnswer, stockOverMax } from "./StockChoice";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brandName, content } from "./content";
import { inLang, KNOWN_CITIES, orderPays, ownCities, savedCities, type Payment } from "./safeOrder";
import { FlagJO } from "./Flag";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { shipCityShown, shipServes, shipWords, storePays, usePublicSettings, useSettingsChecked, type StorePay } from "./platformPublic";
import { storeAddress, storeUrl } from "./siteAddress";
import { ShareMenu } from "./ShareMenu";
import { CityGone, OwnCities, PaysPicker, payWords } from "./Delivery";
import { pushNotification } from "./notifications";
import { SeenShipLogo, SeenShipMark } from "./SeenShip";
import { loadSetup, saveSetup, setupProductNow, syncSetupProduct } from "./setup";
import { Tilt } from "./ui";
import { latin } from "./digits";
import { isJordanMobile, jordanMobile, savedMobile, shownMobile, typedPhone } from "./phone";
import { cleanFileName, cleanLine, cleanLines, cleanMoney, imageRules, initialOf, isMediaUrl, isNewSlug, isPickupAddress, isSlug, latinName, normalizeHex, slugDropped, slugDroppedText, SLUG_RULE, typedSlug, uploadProblemFor, visibleLength, type UploadProblem } from "./safe";
import { ACCOUNT_LIMITS, reservedSlugError, savedPhone } from "./safeAccount";
import { pickPicture, toSavedLogo } from "./designer/image";
import { ImageCropper } from "./ImageCropper";
import { keepPicture } from "./media";
import { merchantCall, onServer } from "./merchantApi";
import { MAX_PROOFS, ProofRows, syncProofPartner, usePartnerProofs, type ProofFile } from "./partnerProofs";
import { loadConfig, saveConfig, storeIsLive } from "./storefront/storage";
import { liveMissing, SellNeeds, sellWords, ShipDefaultNote, storeLiveNow, useSellReady } from "./ReadyToSell";
import { ProductPhoto } from "./storefront/NoPhoto";
import { dropUndos, offerUndo } from "./undo";
import { PRODUCT_MAX, typedMoney } from "./records";
import { kindWords } from "./productsContent";
import { SizesEditor } from "./SizesEditor";
import { PRODUCT_KINDS, kindHasSizes, kindShips, sizeName, type ProductKind, type SizeStock } from "./safeOrder";
import { RudeNote } from "./RudeNote";
import { usePageTitle } from "./pageTitle";

/* ====================================================================
   Types and constants
   ==================================================================== */

const TOTAL_TASKS = 6;
const MAX_DESCRIPTION = 200;
const SWATCHES = ["#e67726", "#004956", "#0b6b4a", "#8b2f35", "#e0a94e", "#4caf8a", "#5b8dd6", "#e06070"];

type LogoFile = { url: string; name: string; size: string };

type Store = {
  name: string;
  description: string;
  logo: LogoFile | null;
  logoData: string;
  color: string;
  phone: string;
  /* WhatsApp for customers (+9627XXXXXXXX), "" for none, null while the step was never answered */
  whatsapp: string | null;
  slug: string;
  product: { kind: ProductKind; name: string; price: string; quantity?: number; image: string | null; description?: string; /* the product it became in the product list */ id?: number; /* clothing and shoes */ sizes?: SizeStock[]; shipping?: boolean } | null;
  /* `fee`: his own courier's delivery fee per order (0: free), asked in this step and on the Delivery page; `cities`: the
     cities his courier delivers to (English names, see safeOrder ownCities) */
  shipping: { mode: "own" | "seen"; kind: number; name: string; phone: string; proofs: ProofFile[]; city: string; address: string; fee?: number; cities?: string[] } | null;
  pickup: boolean;
  /* the ways to pay he takes, asked in the shipping step (undefined: an older store that never chose, every way Dukkan
     has on; a new store starts with none) */
  pays?: Payment[];
};

const EMPTY_STORE: Store = {
  name: "",
  description: "",
  logo: null,
  logoData: "",
  color: "#e67726",
  phone: "",
  whatsapp: null,
  slug: "",
  product: null,
  shipping: null,
  pickup: false,
  pays: [],
};

type StepProps = { store: Store; onSave: (patch: Partial<Store>) => void };

const inputClass =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

/* ====================================================================
   Helpers
   ==================================================================== */

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** White or near-black text, whichever is easier to read on this color. */
function textOn(hex: string): string {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0b1b1f" : "#ffffff";
}

/** The most colorful tone in an image (ignores near-white and transparent pixels). */
function colorFromImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, weight = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [R, G, B, A] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (A < 200) continue;
        const max = Math.max(R, G, B);
        const min = Math.min(R, G, B);
        if (max > 235 && min > 235) continue;
        const w = 1 + (max - min) / 24; /* favor saturated pixels */
        r += R * w;
        g += G * w;
        b += B * w;
        weight += w;
      }
      if (!weight) return resolve(null);
      resolve("#" + [r, g, b].map((v) => Math.round(v / weight).toString(16).padStart(2, "0")).join(""));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "Olive & Co" -> "olive-co". A long name is shortened at the end of a whole word (never "olive-and-compan"); only a
    single word longer than the limit is cut. */
function slugify(value: string): string {
  /* an Arabic name is spelled in Latin letters first, so it gets a suggestion too */
  const full = latinName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (full.length <= 30) return full;
  const cut = full.slice(0, 31);
  const lastBreak = cut.lastIndexOf("-");
  return (lastBreak >= 3 ? cut.slice(0, lastBreak) : full.slice(0, 30)).replace(/-+$/, "");
}

/* ====================================================================
   Small shared pieces
   ==================================================================== */

/* A field he must fill gets a red border when he tries to go on without it (same as the product form) */
const bad = "!border-rose-500 focus:!ring-rose-500/25";
const badWithin = "!border-rose-500 focus-within:!ring-rose-500/25";

function Label({ title, hint, optional, required, htmlFor }: { title: string; hint?: string; optional?: string; required?: boolean; htmlFor?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="font-bold">
          {title}
          {required && <span className="ms-1 text-rose-600" aria-hidden>*</span>}
        </label>
        {optional && <span className="rounded-full bg-fg/10 px-2.5 py-0.5 text-[11px] font-medium text-muted">{optional}</span>}
      </div>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** "Fields with * must be filled", at the top of a step that has required fields: only after he pressed save with one left empty. */
function RequiredNote({ text, show }: { text: string; show: boolean }) {
  if (!show) return null;
  const [before, after] = text.split("*");
  return <p className="text-xs text-muted">{before}<span className="text-rose-600">*</span>{after}</p>;
}

/** Red message under a field he still has to fix. */
function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return <p id={id} className="mt-2 text-xs text-rose-600">{children}</p>;
}

/** Brings the first field with a mistake into view with the cursor in it. */
function focusFirst(ids: string[]) {
  const el = ids.length ? document.getElementById(ids[0]) : null;
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus({ preventScroll: true });
}

/** The tick on a chosen card, an empty ring on the others. */
function ChoiceMark({ on }: { on: boolean }) {
  return (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${on ? "border-primary bg-primary text-white" : "border-fg/20 text-transparent"}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>
  );
}

function SaveButton({ disabled = false, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-12 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition enabled:hover:-translate-y-0.5 enabled:hover:bg-deep disabled:cursor-not-allowed disabled:bg-primary/20 disabled:text-muted"
    >
      {children}
    </button>
  );
}

function PhoneField({ id, value, onChange, onBlur, placeholder, label, invalid = false }: { id?: string; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder: string; label: string; invalid?: boolean }) {
  return (
    <span dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${invalid ? badWithin : ""}`}>
      <span className="flex h-full items-center gap-2 border-e border-fg/15 bg-soft/60 px-3 font-semibold">
        <FlagJO />+962
      </span>
      <input
        id={id}
        aria-invalid={invalid}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(typedPhone(e.target.value))}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={label}
        className="h-full flex-1 bg-transparent px-3 outline-none placeholder:text-muted/70"
      />
    </span>
  );
}


const icon = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* Dukkan's own simple line icons, one per task */
const taskIcons = [
  <svg key="0" {...icon}><circle cx="12" cy="12" r="9" /><path d="m12 7 1.6 3.4 3.7.5-2.7 2.5.7 3.7L12 15.3 8.7 17.1l.7-3.7L6.7 10.9l3.7-.5L12 7Z" /></svg>,
  <svg key="1" {...icon}><path d="M5 5h4l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 3 7a2 2 0 0 1 2-2Z" /></svg>,
  <svg key="2" {...icon}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></svg>,
  <svg key="3" {...icon}><path d="M9 3h6l1 4-4 2-4-2 1-4Z" /><path d="M8 8c-1 4-2 8-3 13h14c-1-5-2-9-3-13" /></svg>,
  <svg key="4" {...icon}><path d="M2 6h11v10H2zM13 9h5l3 3v4h-8" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>,
  <svg key="5" {...icon}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></svg>,
];

/* Product-kind icons (the product form's kinds): a parcel, a shirt, a shoe, a card with a code, a calendar */
const productIcons: Record<ProductKind, React.ReactNode> = {
  standard: <svg {...icon}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9M7.5 5.25l9 4.5" /></svg>,
  clothing: <svg {...icon}><path d="M9 3.5 4 6 2.5 10.5l3 1.5L6.5 10v10.5h11V10l1 2 3-1.5L20 6l-5-2.5a3 3 0 0 1-6 0Z" /></svg>,
  shoes: <svg {...icon}><path d="M3 17.5V8h5c.5 2 2 3 4 3.5l6 1.5a3 3 0 0 1 3 3v1.5H3Z" /><path d="M3 20h18M10 11l1-2M13 12l1-2" /></svg>,
  digital: <svg {...icon}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14.5h2M11 14.5h2M15 14.5h2" /></svg>,
  service: <svg {...icon}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>,
};

const chevron = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

/** The seven-task launch path: done tasks fill in, the next one pulses. */
function LaunchPath({ done, labels }: { done: boolean[]; labels: string[] }) {
  const current = done.findIndex((d) => !d);
  return (
    <ol className="mt-5 flex items-center" aria-label="Launch path">
      {labels.map((label, i) => {
        const isDone = done[i];
        const isCurrent = i === current;
        return (
          <li key={label} className={`flex items-center ${i < labels.length - 1 ? "flex-1" : ""}`} aria-current={isCurrent ? "step" : undefined}>
            <span
              title={label}
              className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-all duration-500 ${
                isDone
                  ? "border-primary bg-primary text-white"
                  : isCurrent
                    ? "border-primary bg-card text-primary shadow-[0_0_0_6px_rgb(var(--primary)/0.18)]"
                    : "border-fg/20 bg-card text-muted"
              }`}
            >
              {isDone ? "✓" : i + 1}
              {isCurrent && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/50" aria-hidden />}
            </span>
            {i < labels.length - 1 && (
              <span className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-fg/10">
                <span className="block h-full rounded-full bg-primary transition-all duration-700" style={{ width: isDone ? "100%" : "0%" }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Shell shared by every step: title on one side, back button on the other. */
function StepShell({ title, iconIndex, onBack, backLabel, children }: { title: string; iconIndex: number; onBack: () => void; backLabel: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-3xl border border-fg/15 bg-card p-5 sm:p-7">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-primary text-primary">{taskIcons[iconIndex]}</span>
          {title}
        </h2>
        <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className="grid h-10 w-10 place-items-center rounded-full border border-primary/60 text-primary transition hover:bg-primary hover:text-white">
          {chevron}
        </button>
      </div>
      {children}
    </section>
  );
}

/** Tinted panel that holds a live preview. */
function PreviewPanel({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-soft p-4 pb-6">
      <p className="px-2 pb-4 pt-2 text-center text-sm font-semibold">{hint}</p>
      <Tilt max={20} className="store-preview">{children}</Tilt>
    </div>
  );
}

const card3d = "rounded-2xl bg-card shadow-[0_28px_55px_-25px_rgba(0,73,86,0.5)]";

/* ====================================================================
   Step 1: Store identity
   ==================================================================== */

function IdentityStep({ store, onSave }: StepProps) {
  const { lang } = usePrefs();
  const c = content[lang].onboarding;

  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description);
  const [logo, setLogo] = useState<LogoFile | null>(store.logo);
  /* a chosen logo waiting to be cropped, and why the last file was refused */
  const [logoPending, setLogoPending] = useState<{ url: string; name: string } | null>(null);
  /* the logo as it is being cropped, shown in the preview avatar right away */
  const [logoLive, setLogoLive] = useState<string | null>(null);
  const [logoProblem, setLogoProblem] = useState<UploadProblem | null>(null);
  const [logoColor, setLogoColor] = useState<string | null>(null);
  const [color, setColor] = useState(store.color);
  const [hex, setHex] = useState(store.color.toUpperCase());
  const [nameError, setNameError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const created = useRef<string[]>([]);
  const savedUrl = useRef<string | null>(store.logo?.url ?? null);
  /* the logo as it is now, for the Undo after "Remove" (it is put back only while no other logo was picked) */
  const logoNow = useRef(logo);
  useEffect(() => {
    logoNow.current = logo;
  }, [logo]);

  /* Free preview URLs that were never saved when the step closes (its undo goes first: it needs them) */
  useEffect(() => {
    const urls = created.current;
    return () => {
      dropUndos("setup-logo");
      urls.forEach((u) => u !== savedUrl.current && URL.revokeObjectURL(u));
    };
  }, []);
  const removeLogo = () => {
    const was = logoNow.current;
    if (!was) return;
    logoNow.current = null;
    setLogo(null);
    offerUndo({
      scope: "setup-logo",
      label: (l) => (l === "ar" ? "أُزيل الشعار" : "Logo removed"),
      undo: () => {
        if (logoNow.current) return false;
        logoNow.current = was;
        setLogo(was);
      },
    });
  };

  /* Read the logo's main color so it can be offered as a swatch. Local only. */
  useEffect(() => {
    let cancelled = false;
    setLogoColor(null);
    if (logo) colorFromImage(logo.url).then((found) => !cancelled && setLogoColor(found));
    return () => {
      cancelled = true;
    };
  }, [logo]);

  const apply = (value: string) => {
    const ok = normalizeHex(value);
    if (ok) {
      setColor(ok);
      setHex(ok.toUpperCase());
    }
  };

  const onHexChange = (value: string) => {
    setHex(value);
    const ok = normalizeHex(value);
    if (ok) setColor(ok);
  };

  const hexInvalid = hex.trim() !== "" && !normalizeHex(hex);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void pickPicture(file, imageRules.logo, 1024, "image/png").then((picked) => {
      setLogoProblem("problem" in picked ? picked.problem : null);
      if ("url" in picked) setLogoPending({ url: picked.url, name: cleanFileName(file.name) });
    });
  };

  const ink = textOn(color);
  const swatches = logoColor ? [logoColor, ...SWATCHES] : SWATCHES;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-8 lg:order-2">
        <RequiredNote text={c.requiredNote} show={!!nameError} />
        <div className="!mt-4">
          <Label title={c.nameLabel} hint={c.nameHint} required htmlFor="ob-name" />
          <input
            id="ob-name"
            required
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "ob-name-err" : undefined}
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
            placeholder={c.namePh}
            maxLength={40}
            className={`${inputClass} h-12 ${nameError ? bad : ""}`}
          />
          {nameError && <FieldError id="ob-name-err">{nameError}</FieldError>}
        </div>

        <div>
          <Label title={c.descLabel} hint={c.descHint} optional={c.optional} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))} placeholder={c.descPh} rows={4} className={`${inputClass} resize-none py-3`} />
          <p dir="ltr" className="mt-2 text-xs text-muted">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        <div>
          <Label title={c.logoLabel} hint={c.logoHint} optional={c.optional} />
          {/* only what the logo box takes (imageRules.logo), so the picker does not offer a HEIC or a GIF it refuses */}
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFile} className="hidden" />
          {logoPending ? (
            <ImageCropper lang={lang} src={logoPending.url} out={256} onLive={setLogoLive} onCancel={() => { setLogoPending(null); setLogoLive(null); }} onDone={(url) => { setLogo({ url, name: logoPending.name, size: formatSize(Math.round((url.length * 3) / 4)) }); setLogoPending(null); setLogoLive(null); }} />
          ) : logo ? (
            <div className="flex items-center gap-4 rounded-2xl border border-fg/15 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <p dir="auto" className="truncate font-semibold">{logo.name}</p>
                <p dir="ltr" className="text-xs text-muted">{logo.size}</p>
              </div>
              <button type="button" onClick={removeLogo} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
                {c.logoRemove}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="grid h-32 w-full place-items-center rounded-2xl border-2 border-dashed border-primary/40 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5">
              {c.logoUpload}
            </button>
          )}
          {/* the real reason, with the logo box's own kinds and limits */}
          {logoProblem && <p role="alert" className="mt-2 text-xs text-rose-600">{uploadProblemFor(logoProblem, imageRules.logo, lang)}</p>}
        </div>

        <div>
          <Label title={c.colorLabel} hint={c.colorHint} optional={c.optional} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {swatches.map((s, i) => {
              const fromLogo = logoColor !== null && i === 0;
              return (
                <button
                  key={`${s}-${i}`}
                  type="button"
                  onClick={() => apply(s)}
                  aria-label={fromLogo ? c.fromLogo : s}
                  title={fromLogo ? c.fromLogo : s}
                  aria-pressed={color === s.toLowerCase()}
                  className={`grid h-10 w-10 place-items-center rounded-full transition hover:scale-110 ${color === s.toLowerCase() ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : ""} ${fromLogo ? "outline outline-2 outline-offset-2 outline-dashed outline-primary/60" : ""}`}
                  style={{ backgroundColor: s }}
                >
                  {/* The chosen color carries a tick, so it reads as picked */}
                  {color === s.toLowerCase() && (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={textOn(s.toLowerCase())} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          {logoColor && <p className="mt-2 text-xs text-muted">{c.fromLogo}</p>}

          {/* Exact color: one big hex field, with the color dot inside it (click the dot for the picker) */}
          <div dir="ltr" className="relative mt-4 max-w-xs">
            <input
              value={hex}
              onChange={(e) => onHexChange(e.target.value)}
              onBlur={() => !hexInvalid && apply(hex || color)}
              maxLength={7}
              spellCheck={false}
              aria-label={c.hexLabel}
              aria-invalid={hexInvalid}
              placeholder="#e67726"
              className={`${inputClass} h-11 pe-14 text-sm font-semibold uppercase ${hexInvalid ? "!border-rose-500 !ring-rose-500/25" : ""}`}
            />
            <label className="absolute end-3 top-1/2 h-6 w-6 -translate-y-1/2 cursor-pointer overflow-hidden rounded-full border border-fg/20 shadow-sm transition hover:scale-110" title={c.pickColor}>
              <span className="absolute inset-0 transition-colors duration-300" style={{ backgroundColor: color }} />
              <input type="color" value={color} onChange={(e) => apply(e.target.value)} aria-label={c.pickColor} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
          </div>
          <p className={`mt-2 text-xs ${hexInvalid ? "text-rose-600" : "text-muted"}`}>{hexInvalid ? c.hexInvalid : c.hexHint}</p>
        </div>

        <SaveButton
          onClick={async () => {
            /* The store name is the one thing he must fill here */
            if (visibleLength(name) < 2) {
              setNameError(c.errName);
              focusFirst(["ob-name"]);
              return;
            }
            /* a logo still in the cropper counts as it looks there now: no need to press Done first */
            const kept = logoPending ? (() => { const url = logoLive ?? logoPending.url; return { url, name: logoPending.name, size: formatSize(Math.round((url.length * 3) / 4)) }; })() : logo;
            if (logoPending) { setLogo(kept); setLogoPending(null); setLogoLive(null); }
            savedUrl.current = kept?.url ?? null;
            /* a signed-in store keeps the logo on Dukkan's server and saves its address (components/media.ts) */
            const logoData = kept ? await keepPicture(await toSavedLogo(kept.url), "logo") : "";
            onSave({ name: cleanLine(name, ACCOUNT_LIMITS.storeName), description: cleanLines(description, ACCOUNT_LIMITS.description), logo: kept, logoData, color });
          }}
        >
          {c.save}
        </SaveButton>
      </div>

      {/* Live 3D storefront */}
      <div className="lg:order-1">
        <PreviewPanel hint={c.previewHint}>
          <div style={{ transformStyle: "preserve-3d" }}>
            <div className={card3d} style={{ transform: "translateZ(10px)", transformStyle: "preserve-3d" }}>
              <div className="flex items-center gap-1.5 px-4 py-3">
                <i className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <i className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <i className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>
              <div className="rounded-b-2xl px-5 pb-7 pt-4 transition-colors duration-500" style={{ backgroundColor: color, color: ink, transformStyle: "preserve-3d" }}>
                <div className="flex items-center justify-between opacity-90">
                  <span className="h-3 w-14 rounded-full" style={{ backgroundColor: ink, opacity: 0.85 }} />
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <i key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ink, opacity: 0.6 }} />
                    ))}
                  </span>
                </div>
                <div className="mt-4 h-9 rounded-lg" style={{ backgroundColor: ink, opacity: 0.14 }} />
                <div className="mt-6 flex items-center gap-4" style={{ transformStyle: "preserve-3d" }}>
                  <span
                    key={logo?.url ?? "empty"}
                    className="grid h-24 w-24 shrink-0 animate-[pop_0.5s_cubic-bezier(0.2,0.8,0.3,1.2)] place-items-center overflow-hidden rounded-full bg-white shadow-2xl"
                    style={{ transform: "translateZ(55px)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {logoLive || logo ? <img src={logoLive ?? logo!.url} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl text-black/55">◎</span>}
                  </span>
                  <span className="min-w-0 truncate text-xl font-bold" style={{ transform: "translateZ(30px)" }}>{name || c.defaultName}</span>
                </div>
              </div>
            </div>
            <div className={`mt-4 p-4 ${card3d}`} style={{ transform: "translateZ(35px)" }}>
              <p className="truncate font-bold" style={{ color }}>{name || c.defaultName}</p>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] whitespace-pre-line text-sm text-muted">{description || " "}</p>
              <div className="mt-4 flex gap-2" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-8 w-8 rounded-full bg-fg/10" />
                ))}
              </div>
            </div>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

/* ====================================================================
   Step 2: Customer service number
   ==================================================================== */

function ServiceStep({ store, onSave }: StepProps) {
  const { lang } = usePrefs();
  const c = content[lang].onboarding;
  const sv = c.service;

  /* The number he signed up with, if he created an account in this session. */
  const [account, setAccount] = useState("");
  const [tried, setTried] = useState(false);
  /* A box's "not a valid number" note waits until he leaves the box (or presses save), not while he types */
  const [waLeft, setWaLeft] = useState(false);
  const [callLeft, setCallLeft] = useState(false);
  /* WhatsApp (required): the account's number by default, or another one */
  const [useAccount, setUseAccount] = useState(true);
  const [waField, setWaField] = useState("");
  /* Phone for calls (optional): the WhatsApp number by default, another one, or none (left empty) */
  const [callSame, setCallSame] = useState(true);
  const [callField, setCallField] = useState("");

  useEffect(() => {
    let registered = "";
    try {
      registered = shownMobile(sessionStorage.getItem("seen-account-phone") ?? "");
    } catch {
      /* ignore */
    }
    setAccount(registered);
    if (store.whatsapp === null) {
      /* never answered: WhatsApp starts from the account's number (or the phone an older setup saved), calls on the same number */
      setUseAccount(registered !== "");
      setWaField(registered ? "" : shownMobile(store.phone));
      setCallSame(true);
      setCallField("");
      return;
    }
    /* reopening a saved step: show what he chose */
    const w = jordanMobile(store.whatsapp);
    const p = jordanMobile(store.phone);
    const same = registered !== "" && w === registered;
    setUseAccount(same);
    setWaField(same ? "" : w);
    setCallSame(p !== "" && p === w);
    setCallField(p !== "" && p !== w ? p : "");
  }, [store.phone, store.whatsapp]);

  const hasAccount = account !== "";
  const usingAccount = hasAccount && useAccount;
  /* At least one way to reach him: WhatsApp (filled in by default), a phone for calls, or both */
  const waNumber = usingAccount ? account : waField.trim();
  const waOk = isJordanMobile(waNumber);
  const waError = !usingAccount && waField.trim() !== "" && !isJordanMobile(waField);
  /* "Same number as WhatsApp" only makes sense while there is a WhatsApp number; otherwise the phone field shows */
  const callOwn = !callSame || !waOk;
  const callNumber = callOwn ? callField.trim() : waNumber;
  const callBad = callOwn && callField.trim() !== "" && !isJordanMobile(callField);
  const none = !waOk && !isJordanMobile(callNumber);
  /* "Add at least one" only while both boxes are empty (the registered number counts as filled) */
  const noneShown = none && !waError && !callBad;
  const noneError = tried && noneShown;
  const waErrorShown = waError && (waLeft || tried);
  const callBadShown = callBad && (callLeft || tried);

  const save = () => {
    if (waError || callBad || none) {
      setTried(true);
      focusFirst([...(waError || (none && !usingAccount) ? ["ob-service-wa"] : []), ...(callBad || none ? ["ob-service-phone"] : [])]);
      return;
    }
    const whatsapp = waOk ? savedMobile(waNumber) : "";
    /* A store that is already open shows the design's own WhatsApp, so it changes there too */
    if (storeIsLive()) {
      const cfg = loadConfig();
      saveConfig({ ...cfg, footer: { ...cfg.footer, whatsapp: whatsapp ? `+962 ${jordanMobile(whatsapp)}` : "" } });
    }
    onSave({ whatsapp, phone: isJordanMobile(callNumber) ? savedMobile(callNumber) : "" });
  };

  const box = "mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--primary))]";
  const waIcon = <svg {...icon} className="h-3.5 w-3.5"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" /><path d="M9 8.5c.3 2.8 2.7 5.2 5.5 5.5l1.2-1.3-1.8-1-.9.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.9-1-1.8L9 8.5Z" /></svg>;
  const phoneIcon = <svg {...icon} className="h-3.5 w-3.5"><path d="M5 5h4l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 3 7a2 2 0 0 1 2-2Z" /></svg>;
  const placeholderRow = (
    <div className="flex items-center justify-between gap-3 opacity-70">
      <span className="h-2 flex-1 rounded-full bg-fg/25" />
      <span className="h-4 w-4 rounded-full bg-fg/20" />
    </div>
  );

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-6 lg:order-2">
        {/* One of the two is needed; WhatsApp is the one filled in by default */}
        {noneShown && <p className={`!mt-4 rounded-xl px-3 py-2 text-sm ${noneError ? "bg-rose-500/10 font-semibold text-rose-600" : "bg-primary/10 text-deep dark:text-primary"}`} role={noneError ? "alert" : undefined}>{sv.oneNeeded}</p>}

        {/* WhatsApp */}
        <div>
          <Label title={sv.waLabel} hint={sv.waHint} htmlFor={usingAccount ? undefined : "ob-service-wa"} />

          {hasAccount && (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={useAccount} onChange={(e) => setUseAccount(e.target.checked)} className={box} />
              <span>
                {sv.useSame} <span dir="ltr" className="font-bold">(+962 {account})</span>
                <span className="ms-2 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 align-middle text-[11px] font-bold text-deep dark:text-primary">{sv.registered}</span>
              </span>
            </label>
          )}

          {/* Another number: shown when "same number" is off, or when there is no account number */}
          {!usingAccount && (
            <div className={hasAccount ? "mt-5" : ""}>
              {hasAccount && <p className="mb-2 text-sm font-semibold">{sv.waOther}</p>}
              <PhoneField id="ob-service-wa" value={waField} onChange={(v) => { setWaField(v); setTried(false); setWaLeft(false); }} onBlur={() => setWaLeft(true)} placeholder={sv.phonePh} label={sv.waOther} invalid={waErrorShown || noneError} />
              {waErrorShown ? <FieldError id="ob-service-wa-err">{sv.waInvalid}</FieldError> : waField.trim() === "" ? <p className="mt-2 text-xs text-muted">{sv.waEmpty}</p> : null}
            </div>
          )}
        </div>

        {/* Phone for calls */}
        <div>
          <Label title={sv.callLabel} hint={sv.callHint} htmlFor={callOwn ? "ob-service-phone" : "ob-service-call-same"} />
          {waOk && (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input id="ob-service-call-same" type="checkbox" checked={callSame} onChange={(e) => setCallSame(e.target.checked)} className={box} />
              <span>{sv.callSame}</span>
            </label>
          )}
          {callOwn && (
            <div className={waOk ? "mt-4" : ""}>
              <PhoneField id="ob-service-phone" value={callField} onChange={(v) => { setCallField(v); setTried(false); setCallLeft(false); }} onBlur={() => setCallLeft(true)} placeholder={sv.phonePh} label={sv.callOther} invalid={callBadShown || noneError} />
              {callBadShown ? <FieldError id="ob-service-phone-err">{sv.invalid}</FieldError> : waOk && callField.trim() === "" ? <p className="mt-2 text-xs text-muted">{sv.callEmpty}</p> : null}
            </div>
          )}
        </div>

        <SaveButton onClick={save}>{c.save}</SaveButton>
      </div>

      <div className="lg:order-1">
        <PreviewPanel hint={sv.previewHint}>
          <div style={{ transformStyle: "preserve-3d" }}>
            <div className={`p-5 ${card3d}`} style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }}>
              <p className="font-bold" style={{ color: store.color }}>{store.name || c.defaultName}</p>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] whitespace-pre-line text-sm text-muted">{store.description || " "}</p>

              {/* Contact card: WhatsApp in its green, then the phone for calls when there is one; other lines are placeholders */}
              <div className="mx-auto mt-5 max-w-[15rem] space-y-3 rounded-xl bg-soft p-4" style={{ transform: "translateZ(40px)" }}>
                {placeholderRow}
                {waNumber ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-card px-2 py-2 shadow-sm">
                    <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm font-bold text-fg">+962 {waNumber}</span>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1fa855] text-white" aria-label="WhatsApp">{waIcon}</span>
                  </div>
                ) : (
                  placeholderRow
                )}
                {callNumber ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-card px-2 py-2 shadow-sm">
                    <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm font-bold text-fg">+962 {callNumber}</span>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: store.color }}>{phoneIcon}</span>
                  </div>
                ) : (
                  placeholderRow
                )}
                {placeholderRow}
              </div>

              <div className="mt-5 flex justify-center gap-2" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-5 w-9 rounded-md bg-fg/10" />
                ))}
              </div>
            </div>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

/* ====================================================================
   Step 3: Store link
   ==================================================================== */

function LinkStep({ store, onSave }: StepProps) {
  const { lang } = usePrefs();
  const c = content[lang].onboarding;
  const [slug, setSlug] = useState(store.slug);
  const [touched, setTouched] = useState(false);
  const [tried, setTried] = useState(false);
  /* the link Dukkan said belongs to another store (asked on Save, like the Store link page) */
  const [taken, setTaken] = useState("");
  /* the link the store already has is always fine to keep; the rules for new choices apply to a different one */
  const valid = (slug !== "" && slug === store.slug && isSlug(slug)) || isNewSlug(slug);
  /* Wrong after he leaves the field, or still empty after he pressed Save */
  const showError = (!valid && ((touched && slug !== "") || tried)) || (taken !== "" && taken === slug);
  const suggestion = slugify(store.name);
  const canSuggest = isNewSlug(suggestion) && suggestion !== slug;

  const clean = typedSlug;
  /* he typed something a link can't hold (Arabic letters, symbols): say so instead of dropping it silently */
  const [dropped, setDropped] = useState(false);

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-6 lg:order-2">
        <RequiredNote text={c.requiredNote} show={tried && showError} />
        <div className="!mt-4">
          <Label title={c.link.label} hint={c.link.hint} required htmlFor="ob-link" />
          <div dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border bg-card text-sm transition focus-within:ring-2 ${showError ? "border-rose-500 focus-within:ring-rose-500/25" : "border-fg/15 focus-within:border-primary focus-within:ring-primary/25"}`}>
            <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">{c.link.prefix}</span>
            <input
              id="ob-link"
              required
              value={slug}
              onChange={(e) => { setDropped(slugDropped(e.target.value)); setSlug(clean(e.target.value)); setTried(false); }}
              onBlur={() => setTouched(true)}
              placeholder={c.link.ph}
              spellCheck={false}
              autoCapitalize="none"
              aria-label={c.link.label}
              aria-invalid={showError}
              className="h-full flex-1 bg-transparent px-3 outline-none placeholder:text-muted/70"
            />
          </div>
          {showError ? (
            <FieldError id="ob-link-err">
              {taken !== "" && taken === slug
                ? lang === "ar"
                  ? "هذا الرابط مستخدم لمتجر آخر. اختر رابطًا غيره."
                  : "This link is taken by another store. Choose another one."
                : !slug
                  ? c.link.errEmpty
                  : SLUG_RULE.test(slug)
                    ? reservedSlugError[lang]
                    : c.link.invalid}
            </FieldError>
          ) : dropped ? (
            <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{slugDroppedText[lang]}</p>
          ) : (
            <p dir="ltr" className="mt-2 text-xs text-muted">{c.link.examples}</p>
          )}
          {canSuggest && (
            <button type="button" onClick={() => { setSlug(suggestion); setDropped(false); }} className="mt-3 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
              {c.link.suggest} <span dir="ltr">{c.link.prefix}{suggestion}</span>
            </button>
          )}
        </div>
        <SaveButton
          onClick={async () => {
            if (!valid) {
              setTried(true);
              focusFirst(["ob-link"]);
              return;
            }
            /* a store link belongs to one store: a signed-in account asks Dukkan first (the save is refused anyway if taken) */
            if (onServer() && slug !== store.slug) {
              const r = await merchantCall(`/api/shop/slug?slug=${encodeURIComponent(slug)}`, "GET");
              if (r?.data.result === "taken") {
                setTaken(slug);
                focusFirst(["ob-link"]);
                return;
              }
            }
            onSave({ slug });
          }}
        >
          {c.save}
        </SaveButton>
      </div>

      <div className="lg:order-1">
        <PreviewPanel hint={c.link.previewHint}>
          <div style={{ transformStyle: "preserve-3d" }}>
            <div className={card3d} style={{ transform: "translateZ(10px)", transformStyle: "preserve-3d" }}>
              <div className="px-4 pt-4" style={{ transform: "translateZ(30px)" }}>
                <div dir="ltr" className="flex items-center gap-2 rounded-full bg-soft px-4 py-2.5 text-sm font-semibold shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
                  </svg>
                  <span className="truncate">https://{c.link.prefix}{slug || c.link.fallback}</span>
                </div>
              </div>
              <div className="mt-4 rounded-b-2xl bg-white/60 p-4 dark:bg-white/5">
                <div className="h-9 rounded-lg bg-fg/10" />
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-12 w-12 rounded-full" style={{ backgroundColor: store.color }} />
                  <span className="h-3 w-24 rounded-full bg-fg/15" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-square rounded-lg bg-fg/10" />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2.5 w-2/3 rounded-full bg-fg/10" />
                  <div className="h-2.5 w-1/2 rounded-full bg-fg/10" />
                </div>
              </div>
            </div>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

/* ====================================================================
   Step 4: First product
   ==================================================================== */

function ProductStep({ store, onSave }: StepProps) {
  const { lang } = usePrefs();
  const c = content[lang].onboarding;
  const p = c.product;

  /* The step opens with the product as it is now in the product list (it may have sold some, or been changed on the
     Products page), not the setup's older copy of it; saving writes back only what he changed here (syncSetupProduct).
     The product was deleted since: the step makes a new one, starting from the setup's copy. */
  const [saved] = useState(() => {
    const copy = store.product;
    if (!copy?.id) return copy;
    const now = setupProductNow(copy.id);
    if (now) return now;
    const rest = { ...copy };
    delete rest.id;
    return rest;
  });
  /* the same kinds, words and rules as the product form (Products.tsx): one list in productsContent.ts */
  const kw = kindWords[lang];
  const [kind, setKind] = useState<ProductKind>(saved?.kind ?? "standard");
  /* clothing and shoes: each size and how many of it (typed, so a string), in the product form's own editor */
  const [sizes, setSizes] = useState<{ name: string; quantity: string }[]>((saved?.sizes ?? []).map((z) => ({ name: z.name, quantity: String(z.quantity) })));
  const [name, setName] = useState(saved?.name ?? "");
  const [price, setPrice] = useState(saved?.price ?? "");
  /* optional, with the same limit and cleaning as the product editor's description */
  const [description, setDescription] = useState(saved?.description ?? "");
  const [image, setImage] = useState<string | null>(saved?.image ?? null);
  /* a chosen picture waiting to be cropped */
  const [imagePending, setImagePending] = useState("");
  /* the picture as it is being cropped, shown in the product preview right away */
  const [imageLive, setImageLive] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [needsShipping, setNeedsShipping] = useState(saved?.shipping !== false);
  const [unlimited, setUnlimited] = useState(saved?.quantity === undefined);
  const [quantity, setQuantity] = useState(saved?.quantity !== undefined ? String(saved.quantity) : "");
  /* a big quantity (999 or more) he said is right; one he saved before already was */
  const [stockOk, setStockOk] = useState(saved?.quantity !== undefined ? String(saved.quantity) : "");
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [errors, setErrors] = useState<{ name?: string; price?: string; quantity?: string; sizes?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const created = useRef<string[]>([]);
  const savedUrl = useRef<string | null>(saved?.image ?? null);
  /* the picture as it is now, for the Undo after "Remove image" (it is put back only while no other one was picked) */
  const imageNow = useRef(image);
  useEffect(() => {
    imageNow.current = image;
  }, [image]);
  const removeImage = () => {
    const was = imageNow.current;
    if (!was) return;
    imageNow.current = null;
    setImage(null);
    offerUndo({
      scope: "setup-product",
      label: (l) => (l === "ar" ? "أُزيلت صورة المنتج" : "Product picture removed"),
      undo: () => {
        if (imageNow.current) return false;
        imageNow.current = was;
        setImage(was);
      },
    });
  };

  useEffect(() => {
    const urls = created.current;
    return () => {
      /* its undo needs the step and its pictures: it goes first */
      dropUndos("setup-product");
      urls.forEach((u) => u !== savedUrl.current && URL.revokeObjectURL(u));
    };
  }, []);

  /* As in the product form: a digital product or a service is never shipped, the others are unless he says no;
     clothing and shoes are sold in sizes, each with its own stock */
  const physical = kindShips(kind);
  const sized = kindHasSizes(kind);
  const chooseKind = (k: ProductKind) => {
    setNeedsShipping((v) => (!kindShips(k) ? false : !kindShips(kind) ? true : v));
    /* clothing sizes are not shoe sizes: switching between the two starts the sizes again (as in the product form) */
    if (sized && kindHasSizes(k) && k !== kind) setSizes([]);
    setKind(k);
    if (errors.sizes || errors.quantity) setErrors((x) => ({ ...x, sizes: undefined, quantity: undefined }));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    /* the same limit as the product editor (one rule, components/safe.ts) */
    if (file.size > imageRules.productPhoto.max) {
      setImageError(p.imageTooBig);
      return;
    }
    void pickPicture(file, imageRules.productPhoto, 1600, "image/jpeg", 0.85).then((picked) => {
      setImageError("problem" in picked ? uploadProblemFor(picked.problem, imageRules.productPhoto, lang) : "");
      if ("url" in picked) setImagePending(picked.url);
    });
  };

  /* "1.2.3", more than 3 decimals or an amount over a million is not a price */
  const priceNumber = Number(cleanMoney(price) || NaN);
  const shownName = name.trim() || p.productDefault;
  const hasData = name.trim() !== "" || price !== "" || image !== null;

  /* The name and the price must be filled */
  const save = () => {
    const next: typeof errors = {};
    if (visibleLength(name) < 2) next.name = p.errName;
    if (!(priceNumber > 0)) next.price = p.errPrice;
    /* clothing and shoes: at least one size with a name (their stock is the sizes'), the product form's rule */
    const savedSizes = sizes.map((z) => ({ name: sizeName(z.name), quantity: Math.max(0, Math.floor(Number(z.quantity) || 0)) })).filter((z) => z.name);
    if (sized) {
      if (!savedSizes.length) next.sizes = kw.errSizes;
    } else if (!unlimited && quantity === "") next.quantity = p.errQuantity;
    /* above the most that can be saved: the stock box says so itself (with "Make it unlimited"); this only stops the save */
    else if (stockOverMax(unlimited, quantity)) next.quantity = p.errQuantity;
    else if (stockNeedsAnswer(unlimited, quantity, stockOk)) next.quantity = lang === "ar" ? "أكّد هذه الكمية الكبيرة، أو اجعلها غير محدودة." : "Confirm this big quantity, or make it unlimited.";
    /* a photo still in the cropper counts as it looks there now: no need to press Done first */
    const photo = imagePending ? imageLive ?? imagePending : image;
    if (imagePending) { setImage(photo); setImagePending(""); setImageLive(null); }
    /* every product needs a photo (as on the Products page, see productProblems) */
    const noPhoto = !photo;
    if (noPhoto) setImageError(p.errImage);
    setErrors(next);
    const wrong = (["name", "price", "sizes", "quantity"] as const).filter((k) => next[k]);
    if (wrong.length || noPhoto) {
      focusFirst([...(noPhoto ? ["ob-product-photo"] : []), ...wrong.map((k) => `ob-product-${k}`)]);
      return;
    }
    savedUrl.current = photo;
    const product = {
      kind,
      name: cleanLine(name, ACCOUNT_LIMITS.productName),
      price: cleanMoney(price),
      /* clothing and shoes: their sizes are the stock (never unlimited); the others: the quantity, or none for unlimited */
      ...(sized ? { sizes: savedSizes } : unlimited ? {} : { quantity: Number(quantity) }),
      ...(physical && !needsShipping ? { shipping: false } : {}),
      image: photo,
      description: cleanLines(description, PRODUCT_MAX.description),
    };
    /* it becomes a real product, with its cropped picture, so the store shows it */
    const id = syncSetupProduct(product, saved?.id, saved ?? undefined) ?? saved?.id;
    onSave({ product: { ...product, ...(id ? { id } : {}) } });
  };

  return (
    <div className="mt-6">
      <p className="font-bold">{p.typeQuestion}</p>
      <p className="mt-1 text-sm text-muted">{kw.kindHint}</p>
      {/* the product form's kinds, names and descriptions (productsContent.ts kindWords) */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => chooseKind(k)}
            aria-pressed={kind === k}
            className={`flex items-center gap-4 rounded-2xl border-2 bg-card p-4 text-start transition ${kind === k ? "border-primary shadow-md" : "border-fg/10 hover:-translate-y-0.5 hover:border-primary/50"}`}
          >
            {/* The chosen kind: solid icon tile, thick border and a tick */}
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${kind === k ? "bg-primary text-white" : "bg-soft text-primary"}`}>{productIcons[k]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{kw.names[k]}</span>
              <span className="mt-0.5 block text-sm text-muted">{kw.about[k]}</span>
            </span>
            <ChoiceMark on={kind === k} />
          </button>
        ))}
      </div>

      <h3 className="mb-1 mt-10 font-bold">{p.dataTitle}</h3>
      {Object.values(errors).some(Boolean) && <div className="mb-4"><RequiredNote text={c.requiredNote} show /></div>}
      <div className="grid gap-8 rounded-2xl border border-fg/10 p-4 sm:p-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6 lg:order-2">
          <div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} className="hidden" />
            {imagePending ? (
              <ImageCropper lang={lang} src={imagePending} shapes={["square", "tall", "wide"]} out={1200} type="image/jpeg" onLive={setImageLive} onCancel={() => { setImagePending(""); setImageLive(null); }} onDone={(url) => { setImage(url); setImagePending(""); setImageLive(null); void keepPicture(url, "product").then((kept) => kept !== url && setImage((cur) => (cur === url ? kept : cur))); }} />
            ) : image ? (
              <div className="flex items-center gap-4 rounded-2xl border border-fg/15 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" onClick={removeImage} className="ms-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
                  {p.imageRemove}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-fg/20 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-muted">{p.imageAdd}<span className="ms-1 text-rose-600" aria-hidden>*</span></p>
                <button id="ob-product-photo" type="button" onClick={() => fileInput.current?.click()} aria-describedby={imageError ? "ob-product-photo-err" : undefined} className="mt-3 rounded-xl border border-fg/25 px-4 py-2 text-sm font-semibold transition hover:bg-soft">
                  {p.imageBrowse}
                </button>
                <p className="mx-auto mt-3 max-w-xs text-[11px] leading-relaxed text-muted">{p.imageHint}</p>
              </div>
            )}
            {imageError && <p id="ob-product-photo-err" role="alert" className="mt-2 text-xs text-rose-600">{imageError}</p>}
          </div>

          <div>
            <Label title={p.nameLabel} required htmlFor="ob-product-name" />
            <input
              id="ob-product-name"
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "ob-product-name-err" : undefined}
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }}
              placeholder={p.namePh}
              maxLength={80}
              className={`${inputClass} h-12 ${errors.name ? bad : ""}`}
            />
            {errors.name && <FieldError id="ob-product-name-err">{errors.name}</FieldError>}
          </div>

          <div>
            <Label title={p.priceLabel} required htmlFor="ob-product-price" />
            <div className="relative">
              <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">{p.currency}</span>
              <input
                id="ob-product-price"
                required
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? "ob-product-price-err" : undefined}
                value={price}
                onChange={(e) => { setPrice(latin(e.target.value).replace(/[^\d.]/g, "").slice(0, 13)); if (errors.price) setErrors((x) => ({ ...x, price: undefined })); }}
                inputMode="decimal"
                placeholder={p.pricePh}
                className={`${inputClass} h-12 ps-14 ${errors.price ? bad : ""}`}
              />
            </div>
            {errors.price && <FieldError id="ob-product-price-err">{errors.price}</FieldError>}
          </div>

          <div>
            <Label title={lang === "ar" ? "وصف المنتج" : "Product description"} optional={c.optional} htmlFor="ob-product-desc" />
            <textarea
              id="ob-product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "ar" ? "اكتب التفاصيل التي يحتاجها عملاؤك" : "Write the details your customers need"}
              rows={3}
              maxLength={PRODUCT_MAX.description}
              className={`${inputClass} resize-y py-3`}
            />
            <RudeNote lang={lang} text={description} />
          </div>

          <div>
            <Label title={p.shippingLabel} />
            {physical ? (
              <div className="flex flex-wrap gap-5 text-sm">
                {[true, false].map((v) => (
                  <label key={String(v)} className="flex cursor-pointer items-center gap-2.5">
                    <input type="radio" name="shipping" checked={needsShipping === v} onChange={() => setNeedsShipping(v)} className="h-5 w-5 accent-[rgb(var(--primary))]" />
                    {v ? p.needsShipping : p.noShipping}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{p.noShipping}</p>
            )}
          </div>

          {sized ? (
          /* clothing and shoes: the product form's size editor, a stock for each size (the size chart waits for the Products page) */
          <div>
            <SizesEditor
              id="ob-product-sizes"
              lang={lang}
              kind={kind}
              sizes={sizes}
              error={errors.sizes}
              inputClass={inputClass}
              onChange={(v) => { setSizes(v); if (errors.sizes) setErrors((x) => ({ ...x, sizes: undefined })); }}
            />
            <p className="mt-3 text-xs text-muted">
              {lang === "ar" ? "يمكنك إضافة جدول المقاسات بعد الإعداد من " : "You can add a size chart after setup in "}
              <a href="/products" className="font-semibold text-primary hover:underline">{lang === "ar" ? "صفحة المنتجات" : "Products"}</a>.
            </p>
          </div>
          ) : (
          <div>
            <Label title={p.quantityLabel} />
            <StockChoice
              lang={lang}
              unlimited={unlimited}
              quantity={quantity}
              okFor={stockOk}
              onUnlimited={(v) => { setUnlimited(v); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
              onQuantity={(v) => { setQuantity(latin(v).replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, QTY_DIGITS)); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
              onConfirm={(q) => { setStockOk(q); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
              inputId="ob-product-quantity"
              inputClass={`${inputClass} ${errors.quantity ? bad : ""}`}
              error={errors.quantity}
              required
              neutral={!physical}
            />
          </div>
          )}

          <SaveButton onClick={save}>{p.add}</SaveButton>
        </div>

        {/* Live product preview */}
        <div className="lg:order-1">
          <div className="rounded-3xl bg-soft p-4 pb-6">
            <div className="flex justify-center gap-2" role="group">
              {(["mobile", "desktop"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} title={d === "mobile" ? p.previewMobile : p.previewDesktop} className={`grid h-9 w-9 place-items-center rounded-lg transition ${device === d ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                  {d === "mobile" ? (
                    <svg {...icon} className="h-4 w-4"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>
                  ) : (
                    <svg {...icon} className="h-4 w-4"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Tilt max={20} className="store-preview">
                <div style={{ transformStyle: "preserve-3d" }}>
                  <div className={`mx-auto p-4 transition-all duration-500 ${card3d} ${device === "mobile" ? "max-w-[15rem]" : ""}`} style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }}>
                    <div className={`flex gap-4 ${device === "mobile" ? "flex-col-reverse" : "items-center"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold">{shownName}</p>
                        <p className="mt-2 text-sm font-semibold">
                          {priceNumber > 0 ? <span dir="ltr">{priceNumber.toFixed(2)} {p.currency}</span> : <span className="text-muted">-</span>}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <span className="flex-1 rounded-md border border-fg/30 px-2 py-2 text-center text-[11px] font-semibold">{p.addToCart}</span>
                          <span className="flex-1 rounded-md bg-ink px-2 py-2 text-center text-[11px] font-semibold text-onink">{p.buyNow}</span>
                        </div>
                      </div>
                      {/* no photo yet: the store's own placeholder, as his store will show it */}
                      <div className={`shrink-0 overflow-hidden rounded-xl ${device === "mobile" ? "aspect-square w-full" : "h-32 w-32"}`} style={{ transform: "translateZ(40px)" }}>
                        <ProductPhoto src={imageLive ?? image} className="h-full w-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </Tilt>
            </div>
            {!hasData && <p className="mt-6 text-center text-sm font-semibold text-primary">{p.previewEmpty}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   Step 5: Shipping method (company or person, their number, proof)
   ==================================================================== */

/* His own courier's fee per order: the Delivery page's field and rule (components/Delivery.tsx) */
const feeWords = {
  en: { label: "Delivery fee per order", hint: "What customers pay for delivery. Write 0 if delivery is free.", empty: "Enter the delivery fee. Write 0 if delivery is free.", bad: "Enter an amount from 0 to {max} JOD, with up to 3 decimals." },
  ar: { label: "رسوم التوصيل لكل طلب", hint: "ما يدفعه العميل للتوصيل. اكتب 0 إن كان التوصيل مجانيًا.", empty: "اكتب رسوم التوصيل. اكتب 0 إن كان التوصيل مجانيًا.", bad: "اكتب مبلغًا من 0 إلى {max} د.أ، بثلاث خانات عشرية على الأكثر." },
};

function ShippingStep({ store, onSave }: StepProps) {
  const { lang } = usePrefs();
  const c = content[lang].onboarding;
  /* Dukkan Ship's price, the line under it, pickup cities and points are the ones Dukkan's staff set in Diwan */
  const platform = usePublicSettings();
  const s = { ...c.shipping, ...shipWords(platform, lang) };
  /* the server's settings are in: only then is a city missing from the list really gone */
  const checked = useSettingsChecked();

  const saved = store.shipping;
  const [mode, setMode] = useState<"own" | "seen" | null>(saved?.mode ?? null);
  const [pickup, setPickup] = useState(store.pickup);
  /* the ways to pay he takes: at least one Dukkan has on, so customers can place orders (safeOrder orderPays) */
  const [pays, setPays] = useState<Payment[]>(store.pays ?? storePays(platform));
  const paysMissing = () => storePays(platform).length > 0 && orderPays(storePays(platform), pays).length === 0;

  /* Dukkan Ship: only needs a pickup place */
  const [city, setCity] = useState(inLang(saved?.city ?? "", { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang));
  const [address, setAddress] = useState(saved?.address ?? "");
  /* the page language can arrive after the step is drawn: the city follows it */
  useEffect(() => setCity((old) => inLang(old, { en: content.en.onboarding.shipping.allCities, ar: content.ar.onboarding.shipping.allCities }, lang)), [lang]);

  /* His own shipping way: who delivers, their number, and proof */
  const own = saved?.mode === "own" ? saved : null;
  const [kind, setKind] = useState(own?.kind ?? 0);
  const [name, setName] = useState(own?.name ?? "");
  const [phone, setPhone] = useState(shownMobile(own?.phone ?? ""));
  /* what customers pay for delivery: the same field, limit and saved value as the Delivery page (0 is free) */
  const [fee, setFee] = useState(own?.fee !== undefined ? String(own.fee) : "");
  const [cities, setCities] = useState<string[]>(own ? ownCities(own.cities).en : KNOWN_CITIES.en);
  /* the proofs go to Dukkan's server as soon as they are picked (components/partnerProofs.tsx) */
  const { proofs, error, busy, ready: proofsReady, sends: proofsSent, add: addProofs, remove: removeProof, keep: keepProofs } = usePartnerProofs(own?.proofs ?? [], s, lang);
  const [errors, setErrors] = useState<{ city?: string; address?: string; name?: string; phone?: string; fee?: string; cities?: string; pays?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);

  /* Images and PDFs only, up to 5 files of 5 MB, checked from their bytes. Each one is sent with the partner as typed
     now; saving the step tells the server the final name (syncProofPartner). */
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addProofs(picked, { name: cleanLine(name, ACCOUNT_LIMITS.shipName), kind });
  };

  const pickupBox = (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-fg/15 p-4 transition hover:border-primary/60">
      <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="peer sr-only" />
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-bold">{s.pickupLabel}</span>
        <span className="mt-0.5 block text-xs text-muted">{s.pickupHint}</span>
      </span>
    </label>
  );

  const paysBox = <PaysPicker lang={lang} id="ob-ship-pays" value={pays} onChange={(v) => { setPays(v); setErrors((x) => ({ ...x, pays: undefined })); }} error={errors.pays} />;

  /* ---------- Step 1: choose how orders are delivered ---------- */
  if (mode === null) {
    return (
      <div className="mt-6">
        <p className="font-bold">{s.modeTitle}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => setMode("own")} className="flex flex-col items-start gap-4 rounded-2xl border border-fg/15 p-6 text-start transition hover:-translate-y-1 hover:border-primary hover:shadow-lg">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-soft text-primary">{taskIcons[4]}</span>
            <span>
              <span className="block text-lg font-bold">{s.modes[0].title}</span>
              <span className="mt-1 block text-sm text-muted">{s.modes[0].desc}</span>
            </span>
          </button>

          <button type="button" onClick={() => setMode("seen")} className="flex flex-col items-start gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-start transition hover:-translate-y-1 hover:border-primary hover:shadow-lg">
            <SeenShipMark className="h-14 w-14" />
            <span>
              <span className="block text-lg font-bold">{s.modes[1].title}</span>
              <span className="mt-1 block text-sm text-muted">{s.modes[1].desc}</span>
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-deep dark:text-primary">
              <span dir="auto">{s.price}{!s.free && ` ${s.perOrder}`}</span>
            </span>
          </button>
        </div>
        <div className="mt-4">{pickupBox}</div>
      </div>
    );
  }

  const changeLink = (
    <button type="button" onClick={() => setMode(null)} className="text-sm font-semibold text-primary hover:underline">
      {s.change}
    </button>
  );

  /* ---------- Dukkan Ship ---------- */
  if (mode === "seen") {
    const saveSeen = () => {
      /* A courier collects from the address, so Dukkan Ship needs both */
      const next: typeof errors = {};
      /* a city Dukkan Ship no longer serves is never saved again: he chooses one it serves */
      if (city === "" || !shipServes(platform, city)) next.city = s.errCity;
      if (!isPickupAddress(address)) next.address = s.errAddress;
      if (paysMissing()) next.pays = payWords[lang].none;
      if (next.city || next.address || next.pays) {
        setErrors(next);
        focusFirst([next.pays && "ob-ship-pays", next.city && "ob-ship-city", next.address && "ob-ship-address"].filter(Boolean) as string[]);
        return;
      }
      onSave({ pickup, pays, shipping: { mode: "seen", kind: 0, name: s.seenName, phone: "", proofs: [], city, address: cleanLine(address, ACCOUNT_LIMITS.address) } });
    };
    return (
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-8 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {changeLink}
            <RequiredNote text={c.requiredNote} show={!!error || Object.values(errors).some(Boolean)} />
          </div>
          {pickupBox}
          {paysBox}

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <SeenShipLogo />
            <p className="mt-4 text-3xl font-bold text-primary">
              <span dir="auto">{s.price}</span>{!s.free && <> <span className="text-base font-medium text-muted">{s.perOrder}</span></>}
            </p>
            <p className="mt-1 text-sm text-muted">{s.priceNote}</p>
          </div>

          <div>
            {/* his saved pickup city was taken off Dukkan Ship's list in Diwan: kept as saved until he chooses another */}
            {checked && !shipServes(platform, city) && <div className="mb-3"><CityGone text={s.cityGone} city={city} id="ob-ship-city-gone" /></div>}
            <Label title={s.cityLabel} required htmlFor="ob-ship-city" />
            <select
              id="ob-ship-city"
              required
              aria-invalid={!!errors.city}
              aria-describedby={checked && !shipServes(platform, city) ? "ob-ship-city-gone" : undefined}
              value={shipCityShown(platform, city, lang)}
              onChange={(e) => { setCity(e.target.value); if (errors.city) setErrors((x) => ({ ...x, city: undefined })); }}
              className={`${inputClass} h-12 ${errors.city ? bad : ""}`}
            >
              <option value="">{s.cityPh}</option>
              {/* only the cities Dukkan Ship serves now */}
              {s.cities.map((name, i) => (
                <option key={i} value={name}>{name}</option>
              ))}
            </select>
            {errors.city && <FieldError id="ob-ship-city-err">{errors.city}</FieldError>}
          </div>

          <div>
            <Label title={s.addressLabel} required htmlFor="ob-ship-address" />
            <input
              id="ob-ship-address"
              required
              aria-invalid={!!errors.address}
              value={address}
              onChange={(e) => { setAddress(e.target.value); if (errors.address) setErrors((x) => ({ ...x, address: undefined })); }}
              placeholder={s.addressPh}
              maxLength={120}
              className={`${inputClass} h-12 ${errors.address ? bad : ""}`}
            />
            {errors.address && <FieldError id="ob-ship-address-err">{errors.address}</FieldError>}
          </div>

          <SaveButton onClick={saveSeen}>{c.save}</SaveButton>
        </div>

        <div className="lg:order-1">
          <PreviewPanel hint={s.previewSeen}>
            <div style={{ transformStyle: "preserve-3d" }}>
              <div className={`p-5 ${card3d}`} style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }}>
                <div style={{ transform: "translateZ(40px)" }}>
                  <SeenShipLogo />
                </div>
                <p className="mt-5 text-4xl font-bold text-primary" style={{ transform: "translateZ(25px)" }}>
                  <span dir="auto">{s.price}</span>{!s.free && <> <span className="text-base font-medium text-muted">{s.perOrder}</span></>}
                </p>
                <ul className="mt-5 space-y-3">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm font-medium">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] text-white">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl bg-soft px-4 py-3 text-sm" style={{ transform: "translateZ(30px)" }}>
                  <p className="text-xs text-muted">{s.cityLabel}</p>
                  <p className="mt-0.5 font-semibold">{city ? `${city}${address.trim() ? ` · ${address.trim()}` : ""}` : s.cityPh}</p>
                </div>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    );
  }

  /* ---------- His own shipping way ---------- */
  const phoneOk = isJordanMobile(phone);
  const shownName = name.trim() || s.previewName;
  /* Wrong number while typing, or a mistake found when he pressed Save */
  const phoneError = errors.phone ?? (phone.trim() !== "" && !phoneOk ? s.phoneInvalid : "");

  /* Who delivers: their name and a working number must be filled */
  const saveOwn = () => {
    const next: typeof errors = {};
    if (visibleLength(name) < 2) next.name = s.errName;
    if (!phoneOk) next.phone = s.phoneInvalid;
    const amount = cleanMoney(fee, ACCOUNT_LIMITS.shipFee);
    if (fee.trim() === "") next.fee = feeWords[lang].empty;
    else if (amount === "") next.fee = feeWords[lang].bad.replace("{max}", String(ACCOUNT_LIMITS.shipFee));
    if (!savedCities(cities).length) next.cities = lang === "ar" ? "اختر مدينة واحدة على الأقل توصّل إليها." : "Choose at least one city you deliver to.";
    if (paysMissing()) next.pays = payWords[lang].none;
    setErrors(next);
    const wrong = (["pays", "name", "phone", "fee", "cities"] as const).filter((k) => next[k]);
    if (wrong.length) {
      focusFirst(wrong.map((k) => `ob-ship-${k}`));
      return;
    }
    keepProofs();
    syncProofPartner(cleanLine(name, ACCOUNT_LIMITS.shipName), kind);
    /* the Dukkan Ship pickup city and address saved before stay with it (only used while Dukkan Ship is chosen), so
       switching back to Dukkan Ship finds them filled */
    onSave({ pickup, pays, shipping: { mode: "own", kind, name: cleanLine(name, ACCOUNT_LIMITS.shipName), phone: savedMobile(phone), proofs, city: saved?.city ?? "", address: saved?.address ?? "", fee: Number(amount) || 0, cities: savedCities(cities) } });
  };

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="space-y-8 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {changeLink}
          <RequiredNote text={c.requiredNote} show={Object.values(errors).some(Boolean)} />
        </div>
        {pickupBox}
        {paysBox}

        <div>
          <Label title={s.label} hint={s.hint} />
          <p className="mb-3 text-sm font-semibold">{s.whoLabel}</p>
          <div role="radiogroup" className="grid grid-cols-2 gap-3">
            {s.kinds.map((k, i) => (
              <button key={k} type="button" role="radio" aria-checked={kind === i} onClick={() => setKind(i)} className={`h-12 rounded-xl border text-sm font-semibold transition ${kind === i ? "border-ink bg-ink text-onink" : "border-fg/15 hover:border-primary/50"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label title={s.nameLabels[kind]} required htmlFor="ob-ship-name" />
          <input
            id="ob-ship-name"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "ob-ship-name-err" : undefined}
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }}
            placeholder={s.namePhs[kind]}
            maxLength={60}
            className={`${inputClass} h-12 ${errors.name ? bad : ""}`}
          />
          {errors.name && <FieldError id="ob-ship-name-err">{errors.name}</FieldError>}
        </div>

        <div>
          <Label title={s.phoneLabel} hint={s.phoneHint} required htmlFor="ob-ship-phone" />
          <PhoneField
            id="ob-ship-phone"
            value={phone}
            onChange={(v) => { setPhone(v); if (errors.phone) setErrors((x) => ({ ...x, phone: undefined })); }}
            placeholder={c.service.phonePh}
            label={s.phoneLabel}
            invalid={!!phoneError}
          />
          {phoneError && <FieldError id="ob-ship-phone-err">{phoneError}</FieldError>}
        </div>

        <div>
          <Label title={feeWords[lang].label} hint={feeWords[lang].hint} required htmlFor="ob-ship-fee" />
          <div className="relative max-w-[14rem]">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">{c.product.currency}</span>
            <input
              id="ob-ship-fee"
              dir="ltr"
              required
              inputMode="decimal"
              aria-invalid={!!errors.fee}
              aria-describedby={errors.fee ? "ob-ship-fee-err" : undefined}
              value={fee}
              onChange={(e) => { setFee(typedMoney(e.target.value, 3)); if (errors.fee) setErrors((x) => ({ ...x, fee: undefined })); }}
              placeholder="0"
              className={`${inputClass} h-12 ps-14 text-start ${errors.fee ? bad : ""}`}
            />
          </div>
          {errors.fee && <FieldError id="ob-ship-fee-err">{errors.fee}</FieldError>}
        </div>

        <OwnCities lang={lang} id="ob-ship-cities" value={cities} onChange={(v) => { setCities(v); if (errors.cities) setErrors((x) => ({ ...x, cities: undefined })); }} error={errors.cities} />

        <div>
          <Label title={s.proofLabel} hint={s.proofHint} optional={c.optional} />
          <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={onFiles} className="hidden" />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !proofsReady || proofs.length >= MAX_PROOFS} className="grid h-24 w-full place-items-center rounded-2xl border-2 border-dashed border-primary/40 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">
            <span>
              {busy ? s.proofSending : s.proofAdd} <span dir="ltr" className="text-muted">({proofs.length}/{MAX_PROOFS})</span>
            </span>
          </button>
          <p className="mt-2 text-xs text-muted">{s.proofLimit}</p>
          {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}

          <ProofRows proofs={proofs} s={s} onRemove={(f) => void removeProof(f)} />
          <p className="mt-3 text-xs text-muted">{proofsSent ? s.serverNote : s.localNote}</p>
        </div>

        <SaveButton onClick={saveOwn}>{c.save}</SaveButton>
      </div>

      {/* Partner card */}
      <div className="lg:order-1">
        <PreviewPanel hint={s.previewHint}>
          <div style={{ transformStyle: "preserve-3d" }}>
            <div className={`p-5 ${card3d}`} style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }}>
              <div className="flex items-center gap-4" style={{ transformStyle: "preserve-3d" }}>
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ink text-2xl font-bold text-onink shadow-xl" style={{ transform: "translateZ(45px)" }}>
                  {initialOf(name) || taskIcons[4]}
                </span>
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-soft px-3 py-0.5 text-[11px] font-bold text-deep dark:text-primary">{s.kinds[kind]}</span>
                  <p className="mt-1 truncate text-lg font-bold">{shownName}</p>
                  <p dir="ltr" className="truncate text-start text-sm text-muted">{phone.trim() ? `+962 ${phone.trim()}` : "+962 7X XXX XXXX"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-soft p-3" style={{ transform: "translateZ(30px)" }}>
                <p className={`flex items-center gap-2 text-sm font-semibold ${proofs.length ? "" : "text-muted"}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${proofs.length ? "bg-primary text-white" : "border border-fg/25"}`}>{proofs.length ? "✓" : ""}</span>
                  {proofs.length ? s.proofAttached : s.noProof}
                  {proofs.length > 0 && <span dir="ltr" className="ms-auto text-xs text-muted">{proofs.length}</span>}
                </p>
                {proofs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {proofs.map((f) =>
                      f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={f.id} src={f.url} alt="" className="h-12 w-12 rounded-lg object-cover shadow-md" />
                      ) : (
                        <span key={f.id} className="grid h-12 w-12 place-items-center rounded-lg bg-card text-[10px] font-bold text-rose-600 shadow-md">PDF</span>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

/* ====================================================================
   The end of setup: the store is live
   ==================================================================== */

const liveWords = {
  en: {
    title: "Your store is live", sub: "Customers can visit it now at this address:", open: "Open store", copy: "Copy link", copied: "Copied", dashboard: "Go to dashboard",
    pays: "Customers can pay by: {list}", payNames: { cash: "Cash on delivery", cliq: "CliQ", card: "Card" } as Record<StorePay, string>,
  },
  ar: {
    title: "متجرك مفتوح الآن", sub: "يستطيع العملاء زيارته الآن على هذا العنوان:", open: "افتح المتجر", copy: "نسخ الرابط", copied: "تم النسخ", dashboard: "اذهب إلى لوحة التحكم",
    pays: "طرق الدفع المتاحة لعملائك: {list}", payNames: { cash: "الدفع عند الاستلام", cliq: "كليك", card: "البطاقة" } as Record<StorePay, string>,
  },
};

/** Every task is done and the store's design is saved, so customers can see it: its address, open it, copy or share the
    link, and how customers can pay (the ways Dukkan's staff turned on in Diwan; merchants do not choose them) */
/* `chosen`: the ways to pay he turned on (undefined: an older store, every way Dukkan has on); the moment lists the ones customers can use */
function LiveMoment({ slug, name, chosen }: { slug: string; name: string; chosen?: Payment[] }) {
  const { lang } = usePrefs();
  const t = liveWords[lang];
  const pays = orderPays(storePays(usePublicSettings()), chosen);
  const sell = useSellReady();
  const [copied, setCopied] = useState(false);
  /* signed in, the store is at its own address; otherwise it opens as customers would see it (as the profile menu does) */
  const [href, setHref] = useState("/store");
  useEffect(() => setHref(onServer() && storeIsLive() ? storeUrl(slug) : "/store"), [slug]);
  const url = storeUrl(slug);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; /* clipboard blocked: do not claim it was copied */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const ghost = "inline-flex h-11 items-center rounded-xl border border-primary/60 px-5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white";
  /* not ready to sell (safeOrder readyToSell): no "your store is live" yet, but what is missing, each a link to fix it.
     A store already live stays live: the list then says customers can't complete an order, unless it delivers with
     Dukkan Ship by default (ReadyToSell shipsByDefault): that is said instead, asking him to choose */
  if (sell.read && !sell.ok) {
    const live = storeLiveNow();
    const missing = liveMissing(sell.missing, live && sell.shipDefault);
    return (
      <div className="mt-8 space-y-3">
        {missing.length > 0 && <SellNeeds lang={lang} missing={missing} title={live ? sellWords[lang].liveNotReady : undefined} />}
        {live && sell.shipDefault && <ShipDefaultNote lang={lang} />}
      </div>
    );
  }
  return (
    <section className="mt-8 rounded-3xl border border-primary/40 bg-primary/5 p-6 text-center sm:p-8" aria-labelledby="ob-live-title">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-white" aria-hidden>
        <svg {...icon} className="h-7 w-7" strokeWidth={2.4}><path d="m5 12 5 5 9-10" /></svg>
      </span>
      <h2 id="ob-live-title" className="mt-4 text-2xl font-extrabold">{t.title}</h2>
      <p className="mt-2 text-sm text-muted">{t.sub}</p>
      <p dir="ltr" className="mt-1 break-all text-lg font-bold">{storeAddress(slug)}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{t.open}</a>
        <button type="button" onClick={() => void copy()} className={ghost}><span aria-live="polite">{copied ? t.copied : t.copy}</span></button>
        <ShareMenu url={url} title={name} lang={lang} fileName={`${slug}-qr`} align="start" className={ghost} />
        <a href="/dashboard" className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-primary transition hover:bg-card">{t.dashboard}</a>
      </div>
      {pays.length > 0 && <p className="mt-6 text-sm text-muted">{t.pays.replace("{list}", pays.map((p) => t.payNames[p]).join(lang === "ar" ? "، " : ", "))}</p>}
    </section>
  );
}

/* ====================================================================
   Page: task list that opens each step
   ==================================================================== */

export function Onboarding() {
  const router = useRouter();
  const { lang } = usePrefs();
  const c = content[lang].onboarding;

  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [done, setDone] = useState<boolean[]>(() => Array(TOTAL_TASKS).fill(false));
  /* He lands on the first task, Store identity, already open. */
  const [view, setView] = useState<number | null>(0);

  usePageTitle(`${brandName(lang)} | ${view === null ? c.title : c.tasks[view].title}`);

  /* Pick up where he left off: restore saved answers and progress for this session. */
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const s = loadSetup();
    if (s && Array.isArray(s.done) && s.done.length === TOTAL_TASKS) {
      setStore((prev) => ({
        ...prev,
        name: s.name,
        description: s.description,
        color: s.color,
        phone: s.phone,
        whatsapp: s.whatsapp ?? null,
        slug: s.slug,
        product: s.product ? { ...s.product, image: s.product.image ?? null } : null,
        pickup: s.pickup === true,
        logoData: s.logo ?? "",
        logo: s.logo ? { url: s.logo, name: "logo", size: "" } : null,
        shipping: s.shipping ? { ...s.shipping, mode: s.shipping.mode ?? "own", city: s.shipping.city ?? "", address: s.shipping.address ?? "", proofs: [] } : null,
        /* none saved: an older store, every way Dukkan has on */
        pays: s.pays,
      }));
      setDone(s.done);
      /* Someone who has already started sees their task list, not the first step. */
      if (s.done.some(Boolean)) setView(null);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    saveSetup({
      name: store.name,
      description: store.description,
      color: store.color,
      phone: store.phone,
      ...(store.whatsapp !== null ? { whatsapp: store.whatsapp } : {}),
      slug: store.slug,
      done,
      pickup: store.pickup,
      logo: store.logoData,
      product: store.product ? { kind: store.product.kind, ...(store.product.sizes?.length ? { sizes: store.product.sizes } : {}), ...(store.product.shipping === false ? { shipping: false } : {}), name: store.product.name, price: store.product.price, ...(store.product.quantity !== undefined ? { quantity: store.product.quantity } : {}), ...(store.product.description ? { description: store.product.description } : {}), ...(store.product.image && (store.product.image.startsWith("data:") || isMediaUrl(store.product.image)) ? { image: store.product.image } : {}), ...(store.product.id ? { id: store.product.id } : {}) } : null,
      ...(store.pays ? { pays: store.pays } : {}),
      shipping: store.shipping ? { mode: store.shipping.mode, kind: store.shipping.kind, name: store.shipping.name, phone: store.shipping.phone, city: store.shipping.city, address: store.shipping.address, ...(store.shipping.fee !== undefined ? { fee: store.shipping.fee } : {}), ...(store.shipping.cities ? { cities: store.shipping.cities } : {}) } : null,
    });
  }, [restored, store, done]);

  const open = (i: number) => {
    /* The store design task is its own full-screen page, the designer. */
    if (i === 5) {
      router.push("/design");
      return;
    }
    setView(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = (index: number, patch: Partial<Store>) => {
    pushNotification("taskDone", { task: String(index) });
    setStore((s) => ({ ...s, ...patch }));
    setDone((d) => d.map((v, i) => (i === index ? true : v)));
    setView(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => setView(null);
  const doneCount = done.filter(Boolean).length;
  const taskTitles = c.tasks.map((t) => t.title);

  /* Wait for the saved setup (his phone, from signup) to load before mounting the steps: they copy "store" into their own state once, on mount. */
  if (!restored) return null;

  const stepBody =
    view === 0 ? <IdentityStep store={store} onSave={(p) => finish(0, p)} />
    : view === 1 ? <ServiceStep store={store} onSave={(p) => finish(1, p)} />
    : view === 2 ? <LinkStep store={store} onSave={(p) => finish(2, p)} />
    : view === 3 ? <ProductStep store={store} onSave={(p) => finish(3, p)} />
    : view === 4 ? <ShippingStep store={store} onSave={(p) => finish(4, p)} />
    : (
      <div className="mt-6 rounded-2xl bg-soft p-8 text-center">
        <p className="font-semibold">{c.comingSoon}</p>
        <button type="button" onClick={back} className="mt-5 rounded-xl border border-fg/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-card">
          {c.back}
        </button>
      </div>
    );

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="home" subtabs={[c.summary]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1720px] px-5 py-10 md:px-10">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-xl font-extrabold sm:text-2xl">{c.title}</h1>
          <span dir="ltr" className="text-lg font-bold text-muted">{doneCount}/{TOTAL_TASKS}</span>
        </div>
        <LaunchPath done={done} labels={taskTitles} />

        {/* every task done: the store is live, said once here before the list (the home page says it too) */}
        {view === null && doneCount >= TOTAL_TASKS && store.slug && <LiveMoment slug={store.slug} name={store.name} chosen={store.pays} />}
        {view === null ? (
          <ul className="mt-8 space-y-3">
            {c.tasks.map((task, i) => (
              <li key={task.title}>
                <button
                  type="button"
                  onClick={() => open(i)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-fg/15 bg-card px-5 py-4 text-start transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <span className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${done[i] ? "bg-primary text-white" : "border border-primary/50 text-primary"}`}>
                      {done[i] ? "✓" : taskIcons[i]}
                    </span>
                    {task.title}
                  </span>
                  <span className="rounded-lg border border-primary/60 px-4 py-1.5 text-sm font-semibold text-primary">{done[i] ? c.edit : task.action}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <StepShell title={c.tasks[view].title} iconIndex={view} onBack={back} backLabel={c.back}>
            {stepBody}
          </StepShell>
        )}
      </main>
    </div>
  );
}
