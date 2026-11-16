"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { can } from "./perms";
import { Badge, type Tone, useStaff, useT } from "./ui";
import { storeAddress, storeUrl } from "../siteAddress";

/* Small pieces the shop pages share (Overview, Shops, a shop, Payments). */

/* server/shops.ts STATUS_SQL: Dukkan has no plans and no free trial, so a store is open, paused by its merchant, or
   suspended by Dukkan */
export type ShopStatus = "open" | "paused" | "suspended";

const STATUS: Record<ShopStatus, { en: string; ar: string; tone: Tone }> = {
  open: { en: "Open", ar: "مفتوح", tone: "green" },
  paused: { en: "Under maintenance", ar: "تحت الصيانة", tone: "amber" },
  suspended: { en: "Suspended", ar: "موقوف", tone: "red" },
};

/* each state's colours (a soft tint, a stronger edge and text) and its mark: an open shop's awning with a tick, a
   wrench for a store its merchant paused for maintenance, a lock for a store Dukkan suspended */
export const STATUS_LOOK: Record<ShopStatus, { pill: string; band: string; icon: string }> = {
  open: {
    pill: "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300",
    band: "bg-emerald-500/[0.08] ring-emerald-500/25 text-emerald-900 dark:text-emerald-100",
    icon: "bg-emerald-500 text-white",
  },
  paused: {
    pill: "bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-300",
    band: "bg-amber-500/[0.09] ring-amber-500/30 text-amber-950 dark:text-amber-100",
    icon: "bg-amber-500 text-amber-950",
  },
  suspended: {
    pill: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300",
    band: "bg-red-500/[0.08] ring-red-500/25 text-red-900 dark:text-red-100",
    icon: "bg-red-600 text-white",
  },
};

/** The mark of a store's state, drawn in the current colour */
export function StatusIcon({ status, className = "h-3.5 w-3.5" }: { status: string; className?: string }) {
  const p = { viewBox: "0 0 24 24", className: `${className} shrink-0`, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (status === "suspended")
    return (
      <svg {...p}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  if (status === "paused")
    return (
      <svg {...p}>
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M4 9h16l-1.5-4h-13z" />
      <path d="M5 9v10h14V9" />
      <path d="m9.5 14 2 2 3.5-3.5" />
    </svg>
  );
}

/** A store's state as a small tinted pill with its mark (lists and the store's numbers) */
export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const key = (STATUS[status as ShopStatus] ? status : "open") as ShopStatus;
  const s = STATUS[key];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_LOOK[key].pill}`}>
      <StatusIcon status={key} />
      {t(s.en, s.ar)}
    </span>
  );
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

/** A store's (or its owner's) name wherever Diwan lists one: a link to the store's page for staff who may open stores,
    plain text for the others (the Marketing role), whose role would only be refused there. */
export function ShopLink({ id, children, className = "font-semibold text-primary hover:underline" }: { id: string | number | null | undefined; children: React.ReactNode; className?: string }) {
  const staff = useStaff();
  if (!id || !staff || !can(staff, "shops.read")) return <span className="font-semibold">{children}</span>;
  return (
    <Link href={`/diwan/shops/${id}`} className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

/** One value of the page's address (?tab=, ?shop=...), and a way to change it that keeps the others and the scroll
    position, so a filtered list can be linked and sent to a colleague */
export function useUrlParam(key: string): [string, (v: string) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname() ?? "";
  const value = sp?.get(key) ?? "";
  const set = useCallback(
    (v: string) => {
      const next = new URLSearchParams(Array.from(sp?.entries() ?? []));
      if (v) next.set(key, v);
      else next.delete(key);
      const q = next.toString();
      router.replace(q ? `${path}?${q}` : path, { scroll: false });
    },
    [sp, router, path, key],
  );
  return [/^[\w-]{0,40}$/.test(value) ? value : "", set];
}

/** The note above a list narrowed to one store (from a store page's "See all"), with the way back to every store */
export function ShopOnly({ id, name, onClear }: { id: string; name?: string | null; onClear: () => void }) {
  const t = useT();
  if (!id) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary/[0.07] px-4 py-2.5 text-sm ring-1 ring-primary/20">
      <span className="text-muted">{t("Only this store:", "هذا المتجر فقط:")}</span>
      <ShopLink id={id}>{name || t(`Store #${id}`, `متجر #${id}`)}</ShopLink>
      <button type="button" onClick={onClear} className="ms-auto rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
        {t("Show every store", "عرض كل المتاجر")}
      </button>
    </div>
  );
}

/** A store and who owns it, the same way everywhere in Diwan: the store's name as the link to its page (or a muted
    "no store name yet" when the merchant has not named it), and the owner's name under it, labelled, only when it says
    something more than the store's name. */
export function ShopAndOwner({ id, shop, owner, className = "" }: { id: string | number | null | undefined; shop: string | null | undefined; owner?: string | null; className?: string }) {
  const t = useT();
  const name = (shop ?? "").trim();
  const who = (owner ?? "").trim();
  return (
    <span className={`block ${className}`}>
      {name ? (
        <ShopLink id={id}>{name}</ShopLink>
      ) : (
        <ShopLink id={id} className="font-medium text-muted hover:text-primary hover:underline">
          {t("(no store name yet)", "(لا اسم للمتجر بعد)")}
        </ShopLink>
      )}
      {who && who.toLowerCase() !== name.toLowerCase() && (
        <span className="block text-xs text-muted">
          {t("Owner:", "المالك:")} <bdi>{who}</bdi>
        </span>
      )}
    </span>
  );
}
