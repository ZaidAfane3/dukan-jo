"use client";

import { useEffect, useState } from "react";
import type { Lang } from "../content";
import { accountName, accountPhone } from "../setup";
import { pagesScope } from "../InfoPages";
import type { SectionConfig } from "./config";
import { isUnlimited, money, productId, salePrice, sellableStock } from "../safeOrder";
import { sanitizePages } from "../safeDesign";
import { safeStoredImage } from "../safe";

/* What the storefront shows comes from what the merchant has saved in this browser,
   so a product added in the dashboard appears in the store by itself. A new store has
   no products and starts empty. Only the designer can switch on sample products, as a
   preview that is never saved. */

export type StoreProduct = {
  id: number;
  name: string;
  category: string;
  price: number | null;
  sale: number | null;
  featured: boolean;
  /* What can be sold: an unlimited product gets UNLIMITED_STOCK, so it is never sold out or "only a few left" */
  quantity: number;
  unlimited?: boolean;
  /* Sample products get a color so their picture is not a gray box */
  hue?: number;
  /* A picture of the product (the platform tour uses real files in /public/demo) */
  image?: string;
  /* The notes line under the name ("rose · musk · incense") and a short label on the picture ("New") */
  notes?: string;
  badge?: string;
  /* The part of the picture that must stay visible when it is cropped (percent from the left and from the top) */
  focus?: { x: number; y: number; zoom?: number };
};

export type StoreData = {
  name: string;
  description: string;
  color: string;
  phone: string;
  slug: string;
  logo: string;
  products: StoreProduct[];
  categories: string[];
  links: { id: number; title: string }[];
  /* Every published page of the store, with its text: buttons can lead to any of them, and the footer shows the ones that asked to be there */
  pages: { id: number; title: string; content: string; sections: SectionConfig[] }[];
  /* The merchant lets customers collect orders themselves (set on the delivery page) */
  pickup: boolean;
  isDemo: boolean;
};

type Bi = { en: string; ar: string };

const demo: { name: Bi; category: Bi; price: number; sale: number | null; featured: boolean; hue: number; qty?: number }[] = [
  { name: { en: "Everyday backpack", ar: "حقيبة ظهر يومية" }, category: { en: "Bags", ar: "حقائب" }, price: 34, sale: null, featured: true, hue: 190 },
  { name: { en: "Steel water bottle", ar: "قارورة ماء معدنية" }, category: { en: "Home", ar: "المنزل" }, price: 11, sale: 8.5, featured: false, hue: 150 },
  { name: { en: "Utility jacket", ar: "جاكيت عملي" }, category: { en: "Clothing", ar: "ملابس" }, price: 62, sale: null, featured: true, hue: 28 },
  { name: { en: "Canvas cap", ar: "كاب قماشي" }, category: { en: "Clothing", ar: "ملابس" }, price: 14, sale: 10, featured: false, hue: 48 },
  { name: { en: "Ceramic mug set", ar: "طقم أكواب خزفية" }, category: { en: "Home", ar: "المنزل" }, price: 27, sale: null, featured: true, hue: 12 },
  { name: { en: "Leather wallet", ar: "محفظة جلدية" }, category: { en: "Bags", ar: "حقائب" }, price: 39, sale: 31, featured: false, hue: 330 },
  { name: { en: "Wireless earbuds", ar: "سماعات لاسلكية" }, category: { en: "Electronics", ar: "إلكترونيات" }, price: 58, sale: null, featured: true, hue: 262 },
  { name: { en: "Scented candle", ar: "شمعة عطرية" }, category: { en: "Home", ar: "المنزل" }, price: 16, sale: 12, featured: false, hue: 95, qty: 0 },
];

/** A saved list of records; anything else saved under the key gives an empty list */
function savedList(key: string): Record<string, unknown>[] {
  const v = read<unknown>(key);
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** A product as the dashboard saves it, turned into what the store shows. */
export function toStoreProduct(p: Record<string, unknown>): StoreProduct {
  /* A price that is not a real amount can't be sold, a sale counts only below the price, and the stock is a whole number */
  const price = money(p.price);
  return {
    id: productId(p.id) ?? NaN,
    name: String(p.name ?? ""),
    category: String(p.category ?? ""),
    price,
    sale: salePrice(price, p.sale),
    featured: p.featured === true,
    quantity: sellableStock(p),
    ...(isUnlimited(p) ? { unlimited: true } : {}),
    hue: (Number(p.id) * 47) % 360,
    /* a picture saved in this browser, never a link to another site (it could track the visitors) */
    image: Array.isArray(p.images) ? safeStoredImage(p.images[0]) || undefined : undefined,
    notes: typeof p.notes === "string" && p.notes ? p.notes : undefined,
    badge: typeof p.badge === "string" && p.badge ? p.badge : undefined,
    focus: (() => {
      const f = p.focus as { x?: unknown; y?: unknown; zoom?: unknown } | undefined;
      /* the zoom (crop closer) comes along with the point that stays visible */
      return f && typeof f.x === "number" && typeof f.y === "number" ? { x: f.x, y: f.y, ...(typeof f.zoom === "number" && f.zoom > 1 ? { zoom: Math.min(3, f.zoom) } : {}) } : undefined;
    })(),
  };
}

/** The group of products that have no category. A category the merchant named "Other" or "أخرى" himself is the
    same group, so the store never shows two of them. */
export const OTHER_CATEGORY: Record<Lang, string> = { en: "Other", ar: "أخرى" };
const isOther = (c: string) => {
  const v = c.trim().toLowerCase();
  return !v || v === OTHER_CATEGORY.en.toLowerCase() || v === OTHER_CATEGORY.ar;
};

/** Every product with a category to show: no category (or "Other") becomes the "Other" group of this language. */
export function withOtherCategory<T extends { category: string }>(products: T[], lang: Lang): T[] {
  return products.map((p) => (isOther(p.category) ? { ...p, category: OTHER_CATEGORY[lang] } : p));
}

/** The categories the store shows, in the order the products have them, with "Other" always last and only when a
    product is in it. Used by every theme (filters, the menu, the footer column). */
export function storeCategories(products: { category: string }[], lang: Lang): string[] {
  const named = Array.from(new Set(products.map((p) => p.category).filter((c) => !isOther(c))));
  return [...named, ...(products.some((p) => isOther(p.category)) ? [OTHER_CATEGORY[lang]] : [])];
}

function build(lang: Lang, sample: boolean): StoreData {
  const setup = read<{ name?: string; description?: string; color?: string; phone?: string; slug?: string; logo?: string; pickup?: unknown }>("seen-setup");
  /* Only products with a real id, each id once (a damaged list must not break the store or sell twice) */
  const seen = new Set<number>();
  const saved = savedList("seen-products").filter((p) => !p.deletedAt && !p.hidden).map(toStoreProduct).filter((p) => !Number.isNaN(p.id) && !seen.has(p.id) && !!seen.add(p.id));

  const isDemo = sample;
  /* a product with no category shows under "Other", in every theme */
  const products: StoreProduct[] = withOtherCategory(isDemo
    ? demo.map((d, i) => ({ id: -(i + 1), name: d.name[lang], category: d.category[lang], price: d.price, sale: d.sale, featured: d.featured, quantity: d.qty ?? 10, hue: d.hue }))
    : saved, lang);

  const other = lang === "ar" ? "en" : "ar";
  const allPages = ((sanitizePages(read<unknown>(pagesScope())) ?? []) as { id: number; published: boolean; footer: boolean; title: Bi; content?: Bi; sections?: SectionConfig[] }[]).filter((p) => p.published && (pagesScope() !== "seen-pages" || p.id < 9100 || p.id >= 9300));
  const pages = allPages.filter((p) => p.footer).map((p) => ({ id: p.id, title: p.title[lang] || p.title[other] }));
  const pageList = allPages.map((p) => ({ id: p.id, title: p.title[lang] || p.title[other], content: p.content?.[lang] || p.content?.[other] || "", sections: Array.isArray(p.sections) ? p.sections : [] }));

  return {
    name: setup?.name?.trim() || accountName() || (lang === "ar" ? "متجرك" : "Your store"),
    description: setup?.description?.trim() || "",
    color: setup?.color || "#004956",
    phone: setup?.phone || accountPhone() ? `+962 ${setup?.phone || accountPhone()}` : "",
    slug: setup?.slug || "",
    /* read straight from storage: only picture data or the site's own files, never a link to another site */
    logo: safeStoredImage(setup?.logo),
    products,
    categories: storeCategories(products, lang),
    links: pages,
    pages: pageList,
    pickup: setup?.pickup === true,
    isDemo,
  };
}

const empty: StoreData = { name: "", description: "", color: "#004956", phone: "", slug: "", logo: "", products: [], categories: [], links: [], pages: [], pickup: false, isDemo: true };

export function useStoreData(lang: Lang, sample = false): StoreData {
  const [data, setData] = useState<StoreData>(empty);
  useEffect(() => {
    setData(build(lang, sample));
    /* Other tabs (the dashboard) can change the data while the storefront is open. */
    const onStorage = () => setData(build(lang, sample));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [lang, sample]);
  return data;
}

/** The merchant's real products (not deleted), for pickers in the designer. */
export function readProducts(): { id: number; name: string; category: string }[] {
  return savedList("seen-products")
    .filter((p) => !p.deletedAt)
    .map((p) => ({ id: Number(p.id), name: String(p.name ?? ""), category: String(p.category ?? "") }));
}

/** Keeps which part of a product's main picture stays visible (the store designer sets it by clicking the picture). */
export function saveProductFocus(id: number, focus: { x: number; y: number; zoom?: number }) {
  try {
    const list = JSON.parse(localStorage.getItem("seen-products") ?? "[]") as Record<string, unknown>[];
    localStorage.setItem("seen-products", JSON.stringify(list.map((p) => (Number(p.id) === id ? { ...p, focus } : p))));
    /* The store preview reloads its products when this event arrives (the same event other tabs send) */
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* storage unavailable */
  }
}
