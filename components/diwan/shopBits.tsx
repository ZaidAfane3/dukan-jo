"use client";

import { Badge, type Tone, useT } from "./ui";
import { storeAddress, storeUrl } from "../siteAddress";

/* Small pieces the shop pages share (Overview, Shops, a shop, Payments). */

/* server/shops.ts STATUS_SQL: Dukkan has no plans and no free trial, so a store is open, paused by its merchant, or
   suspended by Dukkan */
export type ShopStatus = "open" | "paused" | "suspended";

const STATUS: Record<ShopStatus, { en: string; ar: string; tone: Tone }> = {
  open: { en: "Open", ar: "مفتوح", tone: "green" },
  paused: { en: "Paused", ar: "متوقف مؤقتًا", tone: "grey" },
  suspended: { en: "Suspended", ar: "موقوف", tone: "red" },
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const s = STATUS[status as ShopStatus] ?? STATUS.open;
  return <Badge tone={s.tone}>{t(s.en, s.ar)}</Badge>;
}

export const statusOptions = (t: (en: string, ar: string) => string) =>
  (Object.keys(STATUS) as ShopStatus[]).map((k) => ({ value: k, label: t(STATUS[k].en, STATUS[k].ar) }));

export const statusText = (t: (en: string, ar: string) => string, status: string) => {
  const s = STATUS[status as ShopStatus] ?? STATUS.open;
  return t(s.en, s.ar);
};

/* The ways staff can mark a payment received (app/api/diwan/shops/[id]/payments accepts only these) */
export const MARK_METHODS = ["bank", "cliq", "cash", "card"] as const;
/* Every way a store pays Dukkan, for the Payments page (the theme checkout takes card and CliQ, both among these) */
export const METHODS = MARK_METHODS;
/* A theme bought before the checkout recorded the way to pay has no method, so it reads "Not recorded" */
export const methodText = (t: (en: string, ar: string) => string, m: string | null) =>
  !m
    ? t("Not recorded", "غير مسجّلة")
    : ({ bank: t("Bank transfer", "حوالة بنكية"), cliq: t("CliQ", "كليك"), cash: t("Cash", "نقدًا"), card: t("Card", "بطاقة"), paypal: t("PayPal", "باي بال") })[m] ?? m;

/* Each way to pay shown by its logo, the same everywhere in Diwan: a store's payments to Dukkan (bank, cliq, cash, card, paypal)
   and the checkouts' methods in Platform settings (cod, cliq, card, paypal). Cash and bank transfer have no brand, so
   they get a drawn note and a drawn bank. */
const PAY_LOGO: Record<string, { src: string; h: string } | "cash" | "bank"> = {
  cliq: { src: "/logos/cliq-tight.png", h: "h-[70%]" },
  card: { src: "/logos/visa.png", h: "h-[45%]" },
  paypal: { src: "/logos/paypal.png", h: "h-[45%]" },
  cash: "cash",
  cod: "cash",
  bank: "bank",
};

/** A way to pay's logo on a small white tile (white in the dark too: the logos are made for a light background) */
export function PayLogo({ method, className = "h-7 w-11", dim = false }: { method: string | null; className?: string; dim?: boolean }) {
  const l = method ? PAY_LOGO[method] : undefined;
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-black/[0.07] ${dim ? "opacity-50 grayscale" : ""} ${className}`}>
      {typeof l === "object" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.src} alt="" className={`${l.h} w-auto max-w-[80%] object-contain`} />
      ) : l === "cash" ? (
        <svg viewBox="0 0 24 24" className="h-[62%] w-auto text-emerald-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" />
        </svg>
      ) : l === "bank" ? (
        <svg viewBox="0 0 24 24" className="h-[62%] w-auto text-sky-800" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" />
        </svg>
      ) : (
        <span className="text-[10px] font-bold text-neutral-500">?</span>
      )}
    </span>
  );
}

/** How a payment was made: its logo and its name */
export function MethodBadge({ method }: { method: string | null }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <PayLogo method={method} />
      {methodText(t, method)}
    </span>
  );
}

/** The store link as people see it */
export const storeLink = (slug: string | null | undefined) => (slug ? storeAddress(slug) : "");
/** The link that opens a shop's store for its visitors (app/[slug]); "" when it has no store link yet */
export const storeLinkHref = (slug: string | null | undefined) => (slug ? storeUrl(slug) : "");

/** Today in Jordan, yyyy-mm-dd */
export const todayJo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());

/** A select box styled like the other fields */
export function Select({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 rounded-xl border border-fg/15 bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
