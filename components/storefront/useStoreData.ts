"use client";

import { useEffect, useState } from "react";
import type { Lang } from "../content";
import { accountName, accountPhone } from "../setup";

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
  quantity: number;
  /* Sample products get a color so their picture is not a gray box */
  hue?: number;
  /* A picture of the product (the platform tour uses real files in /public/demo) */
  image?: string;
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

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function build(lang: Lang, sample: boolean): StoreData {
  const setup = read<{ name?: string; description?: string; color?: string; phone?: string; slug?: string; logo?: string }>("seen-setup");
  const saved = (read<Record<string, unknown>[]>("seen-products") ?? [])
    .filter((p) => !p.deletedAt && !p.hidden)
    .map(
      (p): StoreProduct => ({
        id: Number(p.id),
        name: String(p.name ?? ""),
        category: String(p.category ?? ""),
        price: typeof p.price === "number" ? p.price : null,
        sale: typeof p.sale === "number" ? p.sale : null,
        featured: p.featured === true,
        quantity: Number(p.quantity ?? 0),
        hue: (Number(p.id) * 47) % 360,
      }),
    );

  const isDemo = sample;
  const products: StoreProduct[] = isDemo
    ? demo.map((d, i) => ({ id: -(i + 1), name: d.name[lang], category: d.category[lang], price: d.price, sale: d.sale, featured: d.featured, quantity: d.qty ?? 10, hue: d.hue }))
    : saved;

  const pages = (read<{ id: number; published: boolean; footer: boolean; title: Bi }[]>("seen-pages") ?? [])
    .filter((p) => p.published && p.footer)
    .map((p) => ({ id: p.id, title: p.title[lang] || p.title[lang === "ar" ? "en" : "ar"] }));

  return {
    name: setup?.name?.trim() || accountName() || (lang === "ar" ? "متجرك" : "Your store"),
    description: setup?.description?.trim() || "",
    color: setup?.color || "#004956",
    phone: setup?.phone || accountPhone() ? `+962 ${setup?.phone || accountPhone()}` : "",
    slug: setup?.slug || "",
    logo: setup?.logo || "",
    products,
    categories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    links: pages,
    isDemo,
  };
}

const empty: StoreData = { name: "", description: "", color: "#004956", phone: "", slug: "", logo: "", products: [], categories: [], links: [], isDemo: true };

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
  return (read<Record<string, unknown>[]>("seen-products") ?? [])
    .filter((p) => !p.deletedAt)
    .map((p) => ({ id: Number(p.id), name: String(p.name ?? ""), category: String(p.category ?? "") }));
}
