import type { Lang } from "../content";
import { categoriesOf, type StoreProduct } from "./useStoreData";

/* The store's search: what a customer types is compared with each product's name, its categories, and the words the
   merchant wrote about it (description, notes line, brand), all folded the same way, so case, accents, Arabic hamza
   forms, taa marbuta, alef maqsura, tashkeel and tatweel never stop a match. Every word typed must be found. */

/** A text folded for comparing: lower case, no accents or tashkeel, one form of each Arabic letter, Western digits, single spaces */
export function foldText(s: string): string {
  return s
    .normalize("NFKD")
    /* Latin accents, and the hamza and madda marks NFKD splits off أ إ آ ؤ ئ */
    .replace(/[̀-ͯ]/g, "")
    /* tashkeel, Quranic marks, the dagger alef, tatweel, and invisible direction marks */
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ؜​-‏⁦-⁩]/g, "")
    .replace(/[آأإٱ-ٳ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a search, folded. "العطر" also finds "عطر" (the article is dropped from a word of 4 letters or more). */
export function searchWords(query: string): string[] {
  return foldText(query)
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length >= 4 && w.startsWith("ال") ? w.slice(2) : w));
}

type Entry = { p: StoreProduct; name: string; cats: string; catList: string[]; rest: string };

/** The products folded once, so each key typed only compares (rebuilt when the products change) */
export function searchIndex(products: StoreProduct[]): Entry[] {
  return products.map((p) => ({
    p,
    name: foldText(p.name),
    cats: foldText(categoriesOf(p).join(" ")),
    catList: categoriesOf(p).map(foldText),
    rest: foldText([p.description, p.notes, p.brand].filter(Boolean).join(" ")),
  }));
}

/** The products that match every word: the products of a category named exactly so first (a category of the sidebar
    is searched by its name), then the ones whose name has them all, then name and category, then the rest, each in the
    store's order */
export function searchProducts(index: Entry[], query: string): StoreProduct[] {
  const words = searchWords(query);
  if (!words.length) return [];
  const whole = foldText(query);
  const found: { p: StoreProduct; rank: number; at: number }[] = [];
  index.forEach((e, at) => {
    const all = `${e.name} ${e.cats} ${e.rest}`;
    if (!words.every((w) => all.includes(w))) return;
    const rank = e.catList.includes(whole) ? -1 : words.every((w) => e.name.includes(w)) ? 0 : words.every((w) => e.name.includes(w) || e.cats.includes(w)) ? 1 : 2;
    found.push({ p: e.p, rank, at });
  });
  return found.sort((a, b) => a.rank - b.rank || a.at - b.at).map((x) => x.p);
}

/** "3 products" / "3 منتجات", with the Arabic forms of the number (one, two, 3 to 10, 11 to 99, and 100 and up) */
export function productCount(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "1 product" : `${n} products`;
  if (n === 0) return "لا منتجات";
  if (n === 1) return "منتج واحد";
  if (n === 2) return "منتجان";
  const m = n % 100;
  if (m >= 3 && m <= 10) return `${n} منتجات`;
  if (m >= 11) return `${n} منتجًا`;
  return `${n} منتج`;
}

/** The words of the results view, with the search set apart so it reads the right way in either language */
export const searchCopy = {
  en: {
    results: (q: string) => `Results for “⁨${q}⁩”`,
    none: (q: string) => `No products match “⁨${q}⁩”.`,
    clear: "Clear search",
  },
  ar: {
    results: (q: string) => `نتائج البحث عن «⁨${q}⁩»`,
    none: (q: string) => `لا توجد منتجات تطابق «⁨${q}⁩».`,
    clear: "مسح البحث",
  },
};

/** The longest search kept (in the box's address too) */
export const SEARCH_MAX = 100;
