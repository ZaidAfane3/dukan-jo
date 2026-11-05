"use client";

import { Badge, type Tone, useT } from "./ui";

/* Small pieces the shop pages share (Overview, Shops, a shop, Plans). */

export type ShopStatus = "trial" | "active" | "expired" | "suspended";

const STATUS: Record<ShopStatus, { en: string; ar: string; tone: Tone }> = {
  trial: { en: "Trial", ar: "تجريبي", tone: "blue" },
  active: { en: "Active (paying)", ar: "فعّال (مدفوع)", tone: "green" },
  expired: { en: "Expired", ar: "منتهي", tone: "amber" },
  suspended: { en: "Suspended", ar: "موقوف", tone: "red" },
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const s = STATUS[status as ShopStatus] ?? STATUS.expired;
  return <Badge tone={s.tone}>{t(s.en, s.ar)}</Badge>;
}

export const statusOptions = (t: (en: string, ar: string) => string) =>
  (Object.keys(STATUS) as ShopStatus[]).map((k) => ({ value: k, label: t(STATUS[k].en, STATUS[k].ar) }));

export const statusText = (t: (en: string, ar: string) => string, status: string) => {
  const s = STATUS[status as ShopStatus] ?? STATUS.expired;
  return t(s.en, s.ar);
};

/** A plan's name in the page's language */
export const planName = (t: (en: string, ar: string) => string, p: { name_en?: string | null; name_ar?: string | null; plan_en?: string | null; plan_ar?: string | null }) =>
  t(p.name_en ?? p.plan_en ?? "", p.name_ar ?? p.plan_ar ?? "") || "—";

export const METHODS = ["bank", "cliq", "cash", "card"] as const;
export const methodText = (t: (en: string, ar: string) => string, m: string) =>
  ({ bank: t("Bank transfer", "حوالة بنكية"), cliq: "CliQ", cash: t("Cash", "نقدًا"), card: t("Card", "بطاقة") })[m] ?? m;

/** The store link as people see it */
export const storeLink = (slug: string | null | undefined) => (slug ? `dukkan.store/${slug}` : "");

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
