import { cleanLine, cleanLines, visibleLength } from "./safe";

/* The theme store's list, as Dukkan's staff run it from Diwan (/diwan/themes). Shared by the server (which checks
   everything sent to it with these rules) and the pages (which show the same limits).

   Two kinds of theme:
   - "code": a theme written in Dukkan's code (components/themes.ts: Misk, Lamma). Its look is the code's; Diwan runs its
     listing: shown or hidden, price, order, and its words (empty words fall back to the code's own).
   - "design": a theme made in Diwan from a copy of a design, edited in the store designer (/design?catalog=<id>) and kept
     on the server. Everything about it is in the database.

   A theme is either live (in the theme store) or hidden (out of it). A new theme starts hidden, so only staff see it
   until it is released; a theme taken out of the store stays with the merchants who bought it. The old draft and review
   steps are gone: start-up turns any left into hidden (server/schema.ts), and they may only move on from there. */

export type Bi = { en: string; ar: string };
export const THEME_STATUSES = ["draft", "review", "live", "hidden"] as const;
export type ThemeStatus = (typeof THEME_STATUSES)[number];
export type ThemeSource = "code" | "design";

/** A theme's listing as the server sends it. Empty words (null) on a code theme mean "the code's own". */
export type ListingRow = {
  id: string;
  source: ThemeSource;
  status: ThemeStatus;
  name: Bi | null;
  tagline: Bi | null;
  about: Bi | null;
  features: Bi[] | null;
  tags: Bi[] | null;
  price: number;
  sort: number;
  featured: boolean;
  demo: { name: Bi; about: Bi; color: string } | null;
  /* a design theme's whole design (StorefrontConfig as plain JSON); never on a code theme */
  design?: unknown;
  releasedAt?: string | null;
  updatedAt?: string;
};

/** Where a theme can go from each step */
export const NEXT_STATUS: Record<ThemeSource, Record<ThemeStatus, ThemeStatus[]>> = {
  code: { draft: ["live", "hidden"], review: ["live", "hidden"], live: ["hidden"], hidden: ["live"] },
  design: { draft: ["live", "hidden"], review: ["live", "hidden"], live: ["hidden"], hidden: ["live"] },
};

export const LISTING_LIMITS = { name: 40, tagline: 120, about: 1200, feature: 140, features: 12, tag: 30, tags: 6, maxPrice: 1000 };

/* A new theme's code name: lowercase letters, digits and dashes. The code's own themes and the merchants' saved designs
   ("mine-...") keep theirs. */
export const THEME_ID = /^[a-z][a-z0-9-]{1,30}$/;
export const CODE_THEME_IDS = ["dukkan", "mada", "atelier", "lamma"];
export const themeIdOk = (id: unknown): id is string => typeof id === "string" && THEME_ID.test(id) && !id.startsWith("mine-") && !CODE_THEME_IDS.includes(id);

/** English and Arabic words, cleaned; null when both are empty */
export function cleanBi(v: unknown, max: number, multiline = false): Bi | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const clean = multiline ? cleanLines : cleanLine;
  const en = clean(o.en, max);
  const ar = clean(o.ar, max);
  return en || ar ? { en, ar } : null;
}

/** A list of English and Arabic lines (features, tags), cleaned; null when empty */
export function cleanBiList(v: unknown, maxItems: number, max: number): Bi[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => cleanBi(x, max)).filter((x): x is Bi => !!x).slice(0, maxItems);
  return out.length ? out : null;
}

export const cleanColor = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : "#1c1a17");

/** A price in JOD, at most 3 decimals; null when it is not one */
export function cleanPrice(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > LISTING_LIMITS.maxPrice) return null;
  return Math.round(n * 1000) / 1000;
}

/** What still stops a design theme from going live (nothing for a code theme: its words are in the code) */
export function liveProblem(r: Pick<ListingRow, "source" | "name" | "tagline" | "design">): "name" | "tagline" | "design" | null {
  if (r.source === "code") return null;
  if (!r.name || visibleLength(r.name.en) < 2 || visibleLength(r.name.ar) < 2) return "name";
  if (!r.tagline || !r.tagline.en || !r.tagline.ar) return "tagline";
  if (!r.design || typeof r.design !== "object") return "design";
  return null;
}
