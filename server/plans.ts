import { jodOf } from "./shopActions";

/* What a plan form sends, checked: names in both languages, prices in JOD, limits (empty: no limit). */
export type PlanInput = {
  nameEn: string;
  nameAr: string;
  priceMonth: string;
  priceYear: string;
  maxProducts: number | null;
  customDomain: boolean;
  maxStaff: number | null;
  active: boolean;
};

const name = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) : "");
/* empty, null or undefined: no limit; otherwise a whole number from 0 to 1,000,000 (false: not valid) */
const limit = (v: unknown): number | null | false => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : false;
};

export function planInput(b: Record<string, unknown> | null): PlanInput | null {
  if (!b) return null;
  const nameEn = name(b.nameEn);
  const nameAr = name(b.nameAr);
  const priceMonth = jodOf(b.priceMonth ?? "0");
  const priceYear = jodOf(b.priceYear ?? "0");
  const maxProducts = limit(b.maxProducts);
  const maxStaff = limit(b.maxStaff);
  if (nameEn.length < 2 || nameAr.length < 2 || !priceMonth || !priceYear || maxProducts === false || maxStaff === false) return null;
  return { nameEn, nameAr, priceMonth, priceYear, maxProducts, customDomain: b.customDomain !== false, maxStaff, active: b.active !== false };
}

/** A key for a new plan from its English name (a-z, 0-9 and dashes) */
export const planKey = (nameEn: string) =>
  nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "plan";
