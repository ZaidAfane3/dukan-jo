import { cleanLine, cleanLines } from "@/components/safe";
import { PAGE_LIMITS, PAGE_SLUG } from "@/components/dukkanPageRules";
import type { Audience } from "./announce";
import { cleanAudience } from "./audience";

/* Dukkan's pages for merchants (table dukkan_pages; the rules are in components/dukkanPages.tsx) */

export type PageInput = {
  slug: string;
  titleEn: string; titleAr: string;
  summaryEn: string; summaryAr: string;
  bodyEn: string; bodyAr: string;
  inMenu: boolean;
  sort: number;
  audience: Audience;
};

/** Checks a page from Diwan's form. Gives it cleaned, or the name of the first wrong field. With `partial` only the
    fields sent are checked (an edit); a new page needs its slug and both titles. */
export async function cleanPage(b: Record<string, unknown>, partial = false): Promise<Partial<PageInput> | { bad: string }> {
  const out: Partial<PageInput> = {};
  const has = (k: string) => !partial || k in b;
  if (has("slug")) {
    const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
    if (!PAGE_SLUG.test(slug)) return { bad: "slug" };
    out.slug = slug;
  }
  for (const k of ["titleEn", "titleAr"] as const) {
    if (!has(k)) continue;
    const v = cleanLine(b[k], PAGE_LIMITS.title);
    if (!v) return { bad: k };
    out[k] = v;
  }
  for (const k of ["summaryEn", "summaryAr"] as const) if (has(k)) out[k] = cleanLine(b[k], PAGE_LIMITS.summary);
  for (const k of ["bodyEn", "bodyAr"] as const) if (has(k)) out[k] = cleanLines(b[k], PAGE_LIMITS.body);
  if (has("inMenu")) out.inMenu = b.inMenu === true;
  if (has("sort")) {
    const n = b.sort === undefined ? 100 : Number(b.sort);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) return { bad: "sort" };
    out.sort = n;
  }
  if (has("audience")) {
    const a = b.audience === undefined && !partial ? { all: true as const } : await cleanAudience(b.audience);
    if (!a) return { bad: "audience" };
    out.audience = a;
  }
  return out;
}

/** The columns a PageInput field is kept in */
export const PAGE_COLUMNS: Record<keyof PageInput, string> = {
  slug: "slug", titleEn: "title_en", titleAr: "title_ar", summaryEn: "summary_en", summaryAr: "summary_ar",
  bodyEn: "body_en", bodyAr: "body_ar", inMenu: "in_menu", sort: "sort", audience: "audience",
};
