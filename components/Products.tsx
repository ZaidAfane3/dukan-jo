"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { FILTER_KEYS, productsCopy, type FilterKey } from "./productsContent";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { readPhoto } from "./designer/image";
import { demoActive } from "./demoSandbox";
import { FocusPicker } from "./FocusPicker";
import { ImageCropper } from "./ImageCropper";
import { PRODUCT_MAX, cleanCategory, cleanProduct, productCategories, money, parseList, productProblems, typedCount, typedMoney, type Product, type SendBy } from "./records";
import { cleanLine, cleanLines } from "./safe";
import { hasErrors, RequiredMark, RequiredNote } from "./Required";
import { RudeNote } from "./RudeNote";
import { StockChoice, stockNeedsAnswer } from "./StockChoice";
import { Blocked } from "./designer/controls";
import { CardPeek, type PeekField } from "./CardPeek";
import { PRODUCT_KINDS, SIZE_MAX, kindHasSizes, kindShips, sizeName, type ProductKind } from "./safeOrder";
import type { Lang } from "./content";

/* What kind of product it is, and the sizes of clothing and shoes */
const kindWords: Record<Lang, { kind: string; kindHint: string; names: Record<ProductKind, string>; about: Record<ProductKind, string>; chart: string; optional: string; chartHint: string; chartUpload: string; chartBusy: string; chartChange: string; chartRemove: string; chartBad: string; sizes: string; sizesHint: string; quick: string; addSize: string; sizeName: string; sizeQty: string; removeSize: string; total: string; pieces: string; errSizes: string; sizesOff: (k: string) => string; stockBySize: string; shipOff: (k: string) => string }> = {
  ar: {
    kind: "نوع المنتج",
    kindHint: "يحدد ما يحتاجه المنتج: المقاسات والشحن والكمية.",
    names: { standard: "منتج عادي", clothing: "ملابس", shoes: "أحذية", digital: "منتج رقمي", service: "خدمة" },
    about: {
      standard: "كمية واحدة للمنتج، مثل العطور والإكسسوارات والأجهزة.",
      clothing: "مقاسات مثل S وM وL، ولكل مقاس كميته.",
      shoes: "مقاسات بالأرقام مثل 40 و41، ولكل مقاس كميته.",
      digital: "أكواد وبطاقات هدايا واشتراكات، تصل للعميل بلا شحن.",
      service: "حجوزات وتصميم وتعليم وغيرها، بلا شحن ولا مقاسات.",
    },
    chart: "جدول المقاسات",
    optional: "(اختياري)",
    chartHint: "صورة لجدول مقاساتك، يفتحها العميل من صفحة المنتج بجانب المقاسات.",
    chartUpload: "ارفع صورة الجدول",
    chartBusy: "جارٍ الرفع…",
    chartChange: "تغيير",
    chartRemove: "حذف",
    chartBad: "هذا الملف ليس صورة أو أكبر من 8 ميجابايت. استخدم PNG أو JPG أو WebP.",
    sizes: "المقاسات",
    sizesHint: "أضف المقاسات المتوفرة وكمية كل مقاس. المقاس الذي كميته صفر يظهر للعميل «نفد».",
    quick: "إضافة سريعة:",
    addSize: "+ مقاس آخر",
    sizeName: "المقاس",
    sizeQty: "الكمية",
    removeSize: "حذف المقاس",
    total: "مجموع الكمية",
    pieces: "قطعة",
    errSizes: "أضف مقاسًا واحدًا على الأقل واكتب اسمه.",
    sizesOff: (k) => `غير متاح لأن نوع المنتج «${k}». المقاسات للملابس والأحذية فقط.`,
    stockBySize: "غير متاح لأن الكمية تُحدَّد لكل مقاس في «المقاسات».",
    shipOff: (k) => `غير متاح لأن نوع المنتج «${k}» لا يُشحن.`,
  },
  en: {
    kind: "Product type",
    kindHint: "Decides what the product needs: sizes, shipping and quantity.",
    names: { standard: "Regular product", clothing: "Clothing", shoes: "Shoes", digital: "Digital product", service: "Service" },
    about: {
      standard: "One quantity for the product, like perfumes, accessories and devices.",
      clothing: "Sizes like S, M and L, each with its own quantity.",
      shoes: "Number sizes like 40 and 41, each with its own quantity.",
      digital: "Codes, gift cards and subscriptions, delivered without shipping.",
      service: "Bookings, design, lessons and more, with no shipping or sizes.",
    },
    chart: "Size chart",
    optional: "(optional)",
    chartHint: "A picture of your size chart. Customers open it from the product page, beside the sizes.",
    chartUpload: "Upload the chart picture",
    chartBusy: "Uploading…",
    chartChange: "Change",
    chartRemove: "Remove",
    chartBad: "This file is not a picture, or it is bigger than 8 MB. Use PNG, JPG or WebP.",
    sizes: "Sizes",
    sizesHint: "Add the sizes you have and how many of each. A size with 0 shows to customers as sold out.",
    quick: "Quick add:",
    addSize: "+ Another size",
    sizeName: "Size",
    sizeQty: "Quantity",
    removeSize: "Remove size",
    total: "Total quantity",
    pieces: "pieces",
    errSizes: "Add at least one size and write its name.",
    sizesOff: (k) => `Not available because the product type is “${k}”. Sizes are for clothing and shoes only.`,
    stockBySize: "Not available because the quantity is set for each size in “Sizes”.",
    shipOff: (k) => `Not available because a “${k}” is not shipped.`,
  },
};
/* the usual sizes, one press each */
const sizePresets: Partial<Record<ProductKind, string[]>> = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
};


type Draft = {
  kind: ProductKind;
  /* clothing and shoes: each size and how many of it (typed, so a string) */
  sizes: { name: string; quantity: string }[];
  /* clothing and shoes: a picture of the size chart ("" none) */
  sizeChart: string;
  name: string;
  price: string;
  sale: string;
  cost: string;
  categories: string[];
  brand: string;
  description: string;
  notes: string;
  badge: string;
  quantity: string;
  /* the stock has no limit: the quantity is not asked */
  unlimited: boolean;
  hidden: boolean;
  featured: boolean;
  shipping: boolean;
  lowAt: string;
  restockMin: string;
  restockPct: string;
  lowBy: SendBy;
  restockBy: SendBy;
};

const KEY = "seen-products";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const blank: Draft = {
  kind: "standard",
  sizes: [],
  sizeChart: "",
  name: "",
  price: "",
  sale: "",
  cost: "",
  categories: [],
  brand: "",
  description: "",
  notes: "",
  badge: "",
  quantity: "1",
  unlimited: false,
  hidden: false,
  featured: false,
  shipping: true,
  lowAt: "5",
  restockMin: "15",
  restockPct: "100",
  lowBy: "both",
  restockBy: "both",
};

/* An amount typed in a field: null when empty, NaN when it is not an amount Dukkan accepts (more than a million too) */
const num = (v: string) => (v.trim() === "" ? null : money(v) ?? NaN);
/* An amount of money as he types it: one dot, at most two decimals (fils), no extra zeros in front ("007" becomes "7") */
const digits = (v: string) => typedMoney(v);
/* A whole number as he types it: digits only, no extra zeros in front, and never above `max` */
const whole = (v: string, max?: number) => typedCount(v, max);

/* What is saved is checked again when it is read: storage can hold old, broken or hand-changed products */
function load(): Product[] {
  try {
    return parseList(localStorage.getItem(KEY), cleanProduct);
  } catch {
    return [];
  }
}

const matches: Record<FilterKey, (p: Product) => boolean> = {
  all: () => true,
  deleted: (p) => !!p.deletedAt,
  unpriced: (p) => p.price === null,
  featured: (p) => p.featured,
  hidden: (p) => p.hidden,
  discounted: (p) => p.sale !== null,
  /* a product with unlimited stock never sells out and never runs low */
  soldOut: (p) => !p.unlimited && p.quantity <= 0,
  forSale: (p) => !p.hidden && (p.unlimited || p.quantity > 0) && p.price !== null,
  uncategorized: (p) => p.categories.length === 0,
  shipping: (p) => p.shipping,
  nearSoldOut: (p) => !p.unlimited && p.quantity > 0 && p.quantity <= p.lowAt,
  noDescription: (p) => !p.description.trim(),
};

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden dir="ltr" className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
      </span>
    </label>
  );
}

/** The sizes of a piece of clothing or a pair of shoes: one press adds a usual size, each size has its own quantity */
function SizesEditor({ lang, kind, sizes, onChange, chart, onChart, error, inputClass }: { lang: Lang; kind: ProductKind; sizes: { name: string; quantity: string }[]; onChange: (v: { name: string; quantity: string }[]) => void; chart: string; onChart: (v: string) => void; error?: string; inputClass: string }) {
  const w = kindWords[lang];
  /* the size chart: a picture he uploads (a file that is not a picture says so) */
  const chartInput = useRef<HTMLInputElement>(null);
  const [chartBad, setChartBad] = useState(false);
  const [chartBusy, setChartBusy] = useState(false);
  const pickChart = async (f?: File) => {
    if (!f) return;
    setChartBusy(true);
    const url = f.size <= 8_000_000 ? await readPhoto(f, 1400) : null;
    setChartBusy(false);
    setChartBad(!url);
    if (url) onChart(url);
  };
  const has = (n: string) => sizes.some((z) => z.name.trim().toLowerCase() === n.toLowerCase());
  const presets = (sizePresets[kind] ?? sizePresets.clothing ?? []).filter((n) => !has(n));
  const total = sizes.reduce((n, z) => n + Math.max(0, Math.floor(Number(z.quantity) || 0)), 0);
  const edit = (i: number, patch: Partial<{ name: string; quantity: string }>) => onChange(sizes.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <div id="p-sizes" tabIndex={-1} className="space-y-3 outline-none">
      <div>
        <p className="text-sm font-semibold">{w.sizes}<RequiredMark /></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{w.sizesHint}</p>
      </div>
      {presets.length > 0 && sizes.length < SIZE_MAX.count && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted">{w.quick}</span>
          {presets.map((n) => (
            <button key={n} type="button" onClick={() => onChange([...sizes, { name: n, quantity: "0" }])} className="h-8 min-w-[2.5rem] rounded-lg border border-fg/15 px-2.5 text-xs font-bold transition hover:border-primary hover:bg-primary/10" dir="ltr">
              {n}
            </button>
          ))}
        </div>
      )}
      {sizes.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_2.25rem] gap-2 text-xs font-semibold text-muted">
            <span>{w.sizeName}</span>
            <span>{w.sizeQty}</span>
            <span />
          </div>
          {sizes.map((z, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2.25rem] items-center gap-2">
              <input value={z.name} onChange={(e) => edit(i, { name: e.target.value })} maxLength={SIZE_MAX.name} aria-label={w.sizeName} dir="auto" className={`${inputClass} h-10`} />
              <input value={z.quantity} onChange={(e) => edit(i, { quantity: latin(e.target.value).replace(/[^0-9]/g, "").slice(0, 6) })} inputMode="numeric" dir="ltr" aria-label={`${w.sizeQty} ${z.name}`} className={`${inputClass} h-10 text-start`} />
              <button type="button" onClick={() => onChange(sizes.filter((_, j) => j !== i))} aria-label={`${w.removeSize} ${z.name}`} title={w.removeSize} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {sizes.length < SIZE_MAX.count && (
        <button type="button" onClick={() => onChange([...sizes, { name: "", quantity: "0" }])} className="text-sm font-semibold text-primary hover:underline">{w.addSize}</button>
      )}
      {sizes.length > 0 && <p className="text-xs font-semibold">{w.total}: <span dir="ltr">{total}</span> {w.pieces}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      {/* the size chart: optional, a picture customers open from the product page beside the sizes */}
      <div className="rounded-xl bg-soft/70 p-3">
        <p className="text-sm font-semibold">{w.chart} <span className="text-xs font-normal text-muted">{w.optional}</span></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{w.chartHint}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {chart ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chart} alt={w.chart} className="h-20 w-28 rounded-lg bg-white object-contain ring-1 ring-fg/10" />
              <button type="button" onClick={() => chartInput.current?.click()} className="text-sm font-semibold text-primary hover:underline">{w.chartChange}</button>
              <button type="button" onClick={() => onChart("")} className="text-sm font-semibold text-rose-600 hover:underline">{w.chartRemove}</button>
            </>
          ) : (
            <button type="button" onClick={() => chartInput.current?.click()} disabled={chartBusy} className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-dashed border-fg/20 px-4 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary disabled:opacity-60">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" /></svg>
              {chartBusy ? w.chartBusy : w.chartUpload}
            </button>
          )}
        </div>
        {chartBad && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{w.chartBad}</p>}
        <input ref={chartInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void pickChart(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function Label({ id, children, hint, required = false, peek }: { id: string; children: React.ReactNode; hint?: string; required?: boolean; /* a "!" that shows where it lands on the store's product card */ peek?: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center">
        <label htmlFor={id} className="block text-sm font-semibold">
          {children}
          {required && <RequiredMark />}
        </label>
        {peek}
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* His own categories (بنطلون، جينز، تيشرت…): he makes them once and picks one or more for each product. Kept in this browser
   with the categories his products already have. */
const CATS = "seen-categories";

function loadCategories(products: Product[]): string[] {
  let saved: string[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(CATS) ?? "[]");
    if (Array.isArray(raw)) saved = raw.map(cleanCategory).filter(Boolean);
  } catch {
    /* none saved yet */
  }
  const used = products.filter((x) => !x.deletedAt).flatMap((x) => x.categories);
  return Array.from(new Set([...saved, ...used]));
}

/** The categories of a product: his categories as chips to pick (as many as he wants), a box to make a new one, and × only on
    the ones no product uses and that are not picked here, so a category in use can't be deleted */
function CategoryPicker({ value, onChange, onTyped, products, words }: { value: string[]; onChange: (v: string[]) => void; onTyped: (v: string) => void; products: Product[]; words: { catNewPh: string; catAdd: string; catNone: string; catRemove: string; catEmpty: string } }) {
  const [list, setList] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  useEffect(() => setList(loadCategories(products)), [products]);
  const keep = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(CATS, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const add = () => {
    const v = cleanCategory(typed);
    if (!v) return;
    if (!list.includes(v)) keep([...list, v]);
    /* a new category is picked for this product, with the ones already picked */
    if (!value.includes(v) && value.length < PRODUCT_MAX.categories) onChange([...value, v]);
    setTyped("");
    onTyped("");
  };
  const used = (c: string) => products.some((x) => !x.deletedAt && x.categories.includes(c));
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : value.length < PRODUCT_MAX.categories ? [...value, c] : value);
  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <p className="text-xs text-muted">{words.catNone}</p>
      ) : (
        <div role="group" className="flex flex-wrap gap-2">
          {/* the category is optional: "No category" (it clears the others) puts the product under "Other" in the store */}
          <span className={`inline-flex items-center rounded-full border border-dashed text-sm font-semibold transition ${value.length === 0 ? "border-ink bg-ink text-onink" : "border-fg/25 text-muted hover:bg-soft"}`}>
            <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className="px-4 py-1.5">{words.catEmpty}</button>
          </span>
          {list.map((c) => (
            <span key={c} className={`inline-flex items-center rounded-full border text-sm font-semibold transition ${value.includes(c) ? "border-ink bg-ink text-onink" : "border-fg/15 hover:bg-soft"}`}>
              <button type="button" aria-pressed={value.includes(c)} onClick={() => toggle(c)} className="inline-flex items-center gap-1.5 px-4 py-1.5">
                {value.includes(c) && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                {c}
              </button>
              {!used(c) && !value.includes(c) && (
                <button type="button" onClick={() => keep(list.filter((x) => x !== c))} aria-label={`${words.catRemove}: ${c}`} title={words.catRemove} className="-ms-2 grid h-7 w-7 place-items-center rounded-full text-muted transition hover:text-rose-600">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          id="p-category"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); onTyped(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={words.catNewPh}
          maxLength={40}
          className={`${field} h-11 flex-1`}
        />
        <button type="button" onClick={add} disabled={!typed.trim()} className="h-11 shrink-0 rounded-xl border border-primary/60 px-5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-40">+ {words.catAdd}</button>
      </div>
    </div>
  );
}

export function Products() {
  const { lang } = usePrefs();
  const p = productsCopy[lang];

  const [items, setItems] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  /* a big quantity (999 or more) he said is right */
  const [stockOk, setStockOk] = useState("");
  const [errors, setErrors] = useState<{ name?: string; price?: string; sale?: string; images?: string; quantity?: string; sizes?: string }>({});
  const [picked, setPicked] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* the "saved" card at the top: the product's name (empty: a product brought back from the bin) */
  const [flash, setFlash] = useState<{ name: string; n: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const showSaved = (name: string) => {
    clearTimeout(flashTimer.current);
    setFlash((f) => ({ name, n: (f?.n ?? 0) + 1 }));
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  };
  /* the editor scrolls on its own on a wide screen; after saving (it closes) it goes back to its top */
  const editorBox = useRef<HTMLElement>(null);
  /* The product's photos: shrunk and saved with the product, so the store shows them */
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBad, setPhotoBad] = useState(false);
  /* photos still being read, and the ones that failed to show: neither counts as the product's photo */
  const [uploading, setUploading] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  /* a new category typed in the box but not added with its button yet */
  const typedCat = useRef("");
  /* the photo being cropped (the first photo has its own focus picker below) */
  const [cropAt, setCropAt] = useState<number | null>(null);
  /* the photo as it is being cropped, shown in its place right away (back to the old one on Cancel) */
  const [photoLive, setPhotoLive] = useState<string | null>(null);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const fileInput = useRef<HTMLInputElement>(null);
  /* The editor as it was when opened or last saved, to know if there are unsaved changes */
  const [clean, setClean] = useState("");
  const snapshot = (d: Draft, imgs: string[], f: { x: number; y: number }) => JSON.stringify([d, imgs, f]);
  const dirty = editing !== null && snapshot(draft, photos, focus) !== clean;

  useEffect(() => {
    document.title = `${brandName(lang)} | ${p.title}`;
  }, [lang, p]);

  useEffect(() => {
    setItems(load());
    setReady(true);
    /* Another tab changed the products (or the store sold some): take its list, so this tab never writes back an old one */
    const onStorage = (e: StorageEvent) => e.key === KEY && setItems(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* A search result links here with ?open=ID. */
  useEffect(() => {
    if (!ready) return;
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    const hit = id ? items.find((x) => x.id === id && !x.deletedAt) : undefined;
    if (hit) openEdit(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items, ready]);

  const test = (k: FilterKey) => (x: Product) => (k === "deleted" ? !!x.deletedAt : !x.deletedAt && matches[k](x));
  const counts = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, items.filter(test(k)).length])) as Record<FilterKey, number>, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(test(filter)).filter((x) => !q || x.name.toLowerCase().includes(q) || x.categories.some((c) => c.toLowerCase().includes(q)) || x.brand.toLowerCase().includes(q));
    const by = [
      (a: Product, b: Product) => b.created - a.created,
      (a: Product, b: Product) => a.name.localeCompare(b.name, lang),
      (a: Product, b: Product) => (a.price ?? Infinity) - (b.price ?? Infinity),
      (a: Product, b: Product) => (b.price ?? -1) - (a.price ?? -1),
    ][sort];
    return [...list].sort(by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, query, sort, lang]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Unsaved changes are only thrown away after he says so */
  const leave = () => !dirty || window.confirm(p.discardAsk);

  const openEdit = (x: Product) => {
    const d: Draft = {
      kind: x.kind ?? "standard",
      sizes: (x.sizes ?? []).map((z) => ({ name: z.name, quantity: String(z.quantity) })),
      sizeChart: x.sizeChart ?? "",
      name: x.name,
      price: x.price === null ? "" : String(x.price),
      sale: x.sale === null ? "" : String(x.sale),
      cost: x.cost === null ? "" : String(x.cost),
      categories: x.categories,
      brand: x.brand,
      description: x.description,
      notes: x.notes ?? "",
      badge: x.badge ?? "",
      quantity: String(x.quantity),
      unlimited: x.unlimited === true,
      hidden: x.hidden,
      featured: x.featured,
      shipping: x.shipping,
      lowAt: String(x.lowAt),
      lowBy: x.lowBy ?? "both",
      restockBy: x.restockBy ?? "both",
      restockMin: String(x.restockMin),
      restockPct: String(x.restockPct),
    };
    setEditing(x.id);
    setDraft(d);
    /* a quantity he saved before was already right */
    setStockOk(d.quantity);
    setErrors({});
    setConfirmDelete(false);
    setPhotos(x.images ?? []);
    setCropAt(null);
    setFocus(x.focus ?? { x: 50, y: 50 });
    setClean(snapshot(d, x.images ?? [], x.focus ?? { x: 50, y: 50 }));
    setPhotoBad(false);
    setBroken([]);
    typedCat.current = "";
  };

  const openNew = () => {
    setEditing("new");
    setDraft(blank);
    setStockOk("");
    setErrors({});
    setConfirmDelete(false);
    setPhotos([]);
    setCropAt(null);
    setFocus({ x: 50, y: 50 });
    setClean(snapshot(blank, [], { x: 50, y: 50 }));
    setPhotoBad(false);
    setBroken([]);
    typedCat.current = "";
  };

  const close = () => {
    if (leave()) setEditing(null);
  };

  /* Escape closes the editor, asking first when there are unsaved changes */
  useEffect(() => {
    if (editing === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (!dirty || window.confirm(p.discardAsk))) setEditing(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, dirty, p]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* Each photo is shrunk to a small picture, so a few of them fit in the browser's storage */
  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const n = files.length;
    setUploading((u) => u + n);
    const made = await Promise.all(Array.from(files).filter((f) => f.size <= 8_000_000).map((f) => readPhoto(f, 900))).finally(() => setUploading((u) => Math.max(0, u - n)));
    const ok = made.filter((u): u is string => !!u);
    if (ok.length) setErrors((x) => ({ ...x, images: undefined }));
    /* a file that is not a picture, and pictures past the 6 that fit, are reported, not dropped silently */
    setPhotoBad(ok.length < files.length || photos.length + ok.length > 6);
    setPhotos((cur) => [...cur, ...ok].slice(0, 6));
  };

  const kw = kindWords[lang];
  /* the "!" beside a field that shows on the product card: the card filled with what he typed */
  const peek = (f: PeekField) => <CardPeek lang={lang} field={f} values={{ name: draft.name, notes: draft.notes, badge: draft.badge, category: draft.categories[0] ?? typedCat.current, price: draft.price, sale: draft.sale, photo: photos[0] }} />;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const price = num(draft.price);
    const sale = num(draft.sale);
    /* only the photos that are really there count: one still uploading or that failed to show does not */
    const shownPhotos = photos.filter((u) => !broken.includes(u));
    const quantity = draft.quantity.trim() === "" ? null : Number(draft.quantity);
    /* The name, the price, a photo and (unless it is unlimited) the quantity must be filled (the same rules the server
       will use). The category is optional: without one the store shows the product under "Other". */
    const sized = kindHasSizes(draft.kind);
    const sizes = draft.sizes.map((z) => ({ name: sizeName(z.name), quantity: Math.max(0, Math.floor(Number(z.quantity) || 0)) })).filter((z) => z.name);
    const bad = productProblems({ name: draft.name, price, sale, images: shownPhotos, quantity, unlimited: draft.unlimited, kind: draft.kind, sizes });
    if (bad.includes("name")) next.name = p.errName;
    if (bad.includes("images")) next.images = uploading > 0 ? p.imagesUploading : p.errImages;
    if (bad.includes("price")) next.price = p.errPrice;
    if (bad.includes("sale")) next.sale = p.errSale;
    if (bad.includes("sizes")) next.sizes = kw.errSizes;
    if (bad.includes("quantity")) next.quantity = p.errQuantity;
    else if (!sized && stockNeedsAnswer(draft.unlimited, draft.quantity, stockOk)) next.quantity = p.errStockAsk;
    setErrors(next);
    /* the first field with a mistake comes into view with the cursor in it */
    const first = (["name", "images", "price", "sale", "sizes", "quantity"] as const).find((k) => next[k]);
    if (first) {
      const el = document.getElementById(first === "quantity" ? "p-qty" : `p-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    const base = {
      kind: draft.kind,
      /* only clothing and shoes keep sizes; their stock is all the sizes together and never "unlimited" */
      sizes: sized ? sizes : [],
      sizeChart: sized ? draft.sizeChart : "",
      name: cleanLine(draft.name, PRODUCT_MAX.name),
      price,
      sale,
      /* a cost that is not an amount is left out rather than saved wrong */
      cost: money(num(draft.cost)),
      /* a new category typed but not added with its button still counts; only spaces is no category */
      ...(() => {
        const categories = productCategories({ categories: [...draft.categories, typedCat.current] });
        return { categories, category: categories[0] ?? "" };
      })(),
      brand: cleanLine(draft.brand, PRODUCT_MAX.brand),
      description: cleanLines(draft.description, PRODUCT_MAX.description),
      notes: cleanLine(draft.notes, PRODUCT_MAX.notes),
      badge: cleanLine(draft.badge, PRODUCT_MAX.badge),
      quantity: sized ? sizes.reduce((n, z) => n + z.quantity, 0) : Math.max(0, Math.floor(Number(draft.quantity) || 0)),
      unlimited: sized ? false : draft.unlimited,
      hidden: draft.hidden,
      featured: draft.featured,
      shipping: kindShips(draft.kind) && draft.shipping,
      lowAt: Math.max(0, Math.floor(Number(draft.lowAt) || 0)),
      lowBy: draft.lowBy,
      restockBy: draft.restockBy,
      restockMin: Math.max(0, Math.floor(Number(draft.restockMin) || 0)),
      /* everyone who asked is told (the share was taken out of the form; kept in the record for the backend) */
      restockPct: 100,
      images: shownPhotos,
      focus,
    };

    if (editing === "new") {
      const id = items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      setItems((list) => [{ id, created: Date.now(), ...base }, ...list]);
    } else {
      /* if the product was removed meanwhile (in another tab), his edits bring it back instead of being lost */
      setItems((list) => (list.some((x) => x.id === editing) ? list.map((x) => (x.id === editing ? { ...x, ...base } : x)) : [{ id: editing as number, created: Date.now(), ...base }, ...list]));
    }
    /* saved: the editor closes and the first screen ("pick a product") comes back, under the "saved" card */
    setCropAt(null);
    setPhotoLive(null);
    setEditing(null);
    showSaved(base.name);
    editorBox.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const trash = (ids: number[]) => {
    setItems((list) => list.map((x) => (ids.includes(x.id) ? { ...x, deletedAt: Date.now() } : x)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setConfirmDelete(false);
  };

  const restore = (ids: number[]) => {
    setItems((list) => list.map((x) => (ids.includes(x.id) ? { ...x, deletedAt: undefined } : x)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    showSaved("");
  };

  const remove = (ids: number[]) => {
    setItems((list) => list.filter((x) => !ids.includes(x.id)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setConfirmDelete(false);
  };

  const allPicked = shown.length > 0 && shown.every((x) => picked.includes(x.id));
  const togglePick = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="products"
        subtabs={p.tabs}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={p.searchPh} aria-label={p.searchPh} className={`${field} h-12 ps-12`} />
        </div>
          <button type="button" onClick={() => leave() && openNew()} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {p.newProduct} </button>
        </div>

        {/* filters | list | editor; in Arabic the editor comes first, on the right, and the filters go to the left */}
        <div className={`grid items-start gap-5 ${lang === "ar" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_16rem]" : "lg:grid-cols-[16rem_minmax(0,24rem)_minmax(0,1fr)]"}`}>
          {/* Filters */}
          <section className={`${card} overflow-hidden ${lang === "ar" ? "lg:order-3" : ""}`}>
            <ul className="max-lg:flex max-lg:overflow-x-auto">
              {FILTER_KEYS.map((k) => (
                <li key={k} className="max-lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors max-lg:whitespace-nowrap ${filter === k ? "bg-black/[0.07] font-bold dark:bg-white/[0.1]" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`}
                  >
                    <span className="flex-1 text-start">{p.filters[k]}</span>
                    <span dir="ltr" className="text-xs">{counts[k]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* List */}
          <section className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 border-b border-fg/10 px-4 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? [] : shown.map((x) => x.id))}
                  aria-label={p.selectAll}
                  className="h-4 w-4 accent-[rgb(var(--primary))]"
                />
                {p.selectAll}
              </label>
              <select value={sort} onChange={(e) => setSort(Number(e.target.value))} aria-label={p.sort} className="ms-auto h-9 rounded-lg border border-fg/15 bg-card px-2 text-xs font-semibold outline-none focus:border-primary">
                {p.sorts.map((s, i) => <option key={s} value={i}>{s}</option>)}
              </select>
              {picked.length > 0 && (
                filter === "deleted" ? (
                  <button type="button" onClick={() => restore(picked)} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.restore} ({picked.length})
                  </button>
                ) : (
                  <button type="button" onClick={() => trash(picked)} className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10">
                    {p.deleteSelected} ({picked.length})
                  </button>
                )
              )}
            </div>

            {shown.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold">{items.length === 0 ? p.empty : p.noMatch}</p>
                {items.length === 0 && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{p.emptyHint}</p>}
                {items.length === 0 && (
                  <button type="button" onClick={openNew} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.newProduct}
                  </button>
                )}
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-fg/10 overflow-y-auto">
                {shown.map((x) => (
                  <li key={x.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${editing === x.id ? "bg-black/[0.07] dark:bg-white/[0.1]" : "hover:bg-fg/[0.05]"}`}>
                    <input type="checkbox" checked={picked.includes(x.id)} onChange={() => togglePick(x.id)} aria-label={x.name} className="h-4 w-4 shrink-0 accent-[rgb(var(--primary))]" />
                    <button type="button" onClick={() => x.id !== editing && leave() && openEdit(x)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-soft text-muted">
                        {x.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={x.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M9 3 3.5 6 5.5 10.5 8 9.5V20.5H16V9.5l2.5 1L20.5 6 15 3a3 3 0 0 1-6 0Z" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{x.name}</span>
                          {x.hidden && <span className="shrink-0 rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-bold text-muted">{p.filters.hidden.split(" ").pop()}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {x.categories.join(lang === "ar" ? "، " : ", ") || p.otherCategory} · {x.unlimited ? p.unlimitedShort : <><span dir="ltr">{x.quantity}</span> {p.piece}</>}
                        </span>
                        <span dir="ltr" className="mt-0.5 block text-start text-sm font-bold">
                          {x.price === null ? (
                            <span className="font-medium text-muted">{p.noPrice}</span>
                          ) : x.sale !== null ? (
                            <>
                              {fmt(x.sale)} <small className="font-semibold opacity-70">{p.currency}</small>{" "}
                              <s className="text-[13px] font-medium text-muted [text-decoration-thickness:1.5px]">{fmt(x.price)}</s>
                            </>
                          ) : (
                            <>
                              {fmt(x.price)} <small className="font-semibold opacity-70">{p.currency}</small>
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Editor: on a wide screen it stays in view under the top bar and scrolls by itself, not the whole page */}
          <section ref={editorBox} className={`${card} p-5 sm:p-7 ${lang === "ar" ? "lg:order-first" : ""} lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain`}>
            {editing === null ? (
              <div className="grid min-h-[16rem] place-items-center text-center">
                <div>
                  <p className="text-sm text-muted">{p.pickOne}</p>
                  <button type="button" onClick={openNew} className="mt-4 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.newProduct}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={save} noValidate className="space-y-8">
                <h2 className="text-lg font-extrabold">{editing === "new" ? p.newProduct : p.edit}</h2>
                {typeof editing === "number" && items.find((x) => x.id === editing)?.deletedAt && <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{p.deletedNote}</p>}

                {/* a thin line under every field, like the store designer */}
                <div className="space-y-5 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold">{p.basic}</h3>
                    <RequiredNote text={p.requiredNote} show={hasErrors(errors)} />
                  </div>
                  {/* what kind of product: it decides whether it has sizes and whether it is shipped */}
                  <div>
                    <Label id="p-kind" hint={kw.kindHint}>{kw.kind}</Label>
                    <div role="radiogroup" aria-label={kw.kind} className="grid gap-2 sm:grid-cols-2">
                      {PRODUCT_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={draft.kind === k}
                          onClick={() => setDraft((d) => ({ ...d, kind: k, shipping: !kindShips(k) ? false : !kindShips(d.kind) ? true : d.shipping, sizes: kindHasSizes(k) && kindHasSizes(d.kind) && k !== d.kind ? [] : d.sizes }))}
                          className={`rounded-xl border px-3.5 py-2.5 text-start transition ${draft.kind === k ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-fg/15 hover:bg-soft"}`}
                        >
                          <span className="block text-sm font-bold">{kw.names[k]}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{kw.about[k]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label id="p-name" required>{p.name}</Label>
                    <input id="p-name" required aria-invalid={!!errors.name} value={draft.name} onChange={(e) => { set("name", e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }} placeholder={p.namePh} maxLength={80} className={`${field} h-12 ${errors.name ? bad : ""}`} />
                    {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
                    <RudeNote lang={lang} text={draft.name} />
                  </div>

                  <div>
                    <p id="p-images-label" className="mb-2 text-sm font-semibold">{p.images}<RequiredMark /></p>
                    <div role="group" aria-labelledby="p-images-label" aria-describedby={errors.images ? "p-images-err" : undefined} className={`grid grid-cols-3 gap-3 rounded-xl sm:grid-cols-4 ${errors.images ? "ring-2 ring-rose-500 ring-offset-4 ring-offset-card" : ""}`}>
                      {photos.map((u, i) => (
                        <div key={u} className="group relative aspect-square overflow-hidden rounded-xl bg-soft ring-1 ring-fg/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={i === cropAt && photoLive ? photoLive : u} alt="" onError={() => setBroken((b) => (b.includes(u) ? b : [...b, u]))} onLoad={() => setBroken((b) => b.filter((x) => x !== u))} className="h-full w-full object-cover" />
                          {broken.includes(u) && <span className="absolute inset-0 grid place-items-center bg-rose-600/80 p-1 text-center text-[10px] font-bold leading-tight text-white">{p.imageBroken}</span>}
                          {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{p.primary}</span>}
                          {/* any other photo can become the main one: the one on the product card and first on its page (its visible
                              part is chosen again, since it is a different picture) */}
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => { setCropAt(null); setPhotoLive(null); setFocus({ x: 50, y: 50 }); setPhotos((cur) => [cur[i], ...cur.filter((_, j) => j !== i)]); }}
                              className="absolute start-1.5 top-1.5 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#1c1a17] shadow-sm ring-1 ring-black/10 transition hover:bg-primary hover:text-white"
                            >
                              {lang === "ar" ? "اجعلها الأساسية" : "Make main"}
                            </button>
                          )}
                          {i > 0 && !demoActive() && (
                            <button type="button" onClick={() => setCropAt(i)} className="absolute bottom-1.5 start-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                              {lang === "ar" ? "قصّ" : "Crop"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setCropAt(null); setPhotos((cur) => cur.filter((x) => x !== u)); }}
                            aria-label={p.removeImage}
                            className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                          </button>
                        </div>
                      ))}
                      {photos.length < 6 && (
                        <button
                          id="p-images"
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          aria-invalid={!!errors.images}
                          aria-describedby={errors.images ? "p-images-err" : undefined}
                          className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-fg/20 text-center text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                        >
                          <span>
                            <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" />
                            </svg>
                            {p.addImage}
                          </span>
                        </button>
                      )}
                    </div>
                    {cropAt !== null && photos[cropAt] && (
                      <div className="mt-3">
                        <ImageCropper lang={lang} src={photos[cropAt]} shapes={["square", "tall", "wide", "original"]} out={900} type="image/jpeg" onLive={setPhotoLive} onCancel={() => { setCropAt(null); setPhotoLive(null); }} onDone={(url) => { const at = cropAt; setPhotos((cur) => cur.map((x, j) => (j === at ? url : x))); setCropAt(null); setPhotoLive(null); }} />
                      </div>
                    )}
                    <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
                    {errors.images && <p id="p-images-err" role="alert" className="mt-2 text-xs font-semibold text-rose-600">{errors.images}</p>}
                    <p className={`mt-2 text-xs ${photoBad ? "text-rose-600" : "text-muted"}`}>{photoBad ? p.imagesBad : p.imagesHint}</p>

                    {/* What stays visible: the store crops the picture to its shape, so he chooses the part that must always show */}
                    {photos.length > 0 && (
                      <div className="mt-4 rounded-xl bg-soft/70 p-4">
                        <p className="text-sm font-bold">{p.focusTitle}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{p.focusNote}</p>
                        <div className="mt-3">
                          <FocusPicker image={cropAt === 0 && photoLive ? photoLive : photos[0]} value={focus} onChange={setFocus} disabled={demoActive()} labels={{ tall: p.shapeTall, square: p.shapeSquare, wide: p.shapeWide, center: p.focusCenter, zoom: lang === "ar" ? "تكبير (قصّ أقرب)" : "Zoom (crop closer)" }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 [&>div]:border-b-2 [&>div]:border-fg/20 [&>div]:pb-5 [&>div]:flex [&>div]:flex-col">
                    <div>
                      <Label id="p-price" required>{p.price} ({p.currency})</Label>
                      <input id="p-price" required aria-invalid={!!errors.price} dir="ltr" inputMode="decimal" value={draft.price} onChange={(e) => { set("price", digits(e.target.value)); if (errors.price) setErrors((x) => ({ ...x, price: undefined })); }} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start ${errors.price ? bad : ""}`} />
                      {errors.price && <p className="mt-1.5 text-xs text-rose-600">{errors.price}</p>}
                      {/* Zero is allowed, but may be a slip */}
                      {!errors.price && draft.price !== "" && Number(draft.price) === 0 && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{p.priceZero}</p>}
                    </div>
                    <div>
                      <Label id="p-cost" hint={p.costHint}>{p.cost} ({p.currency})</Label>
                      <input id="p-cost" dir="ltr" inputMode="decimal" value={draft.cost} onChange={(e) => set("cost", digits(e.target.value))} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start`} />
                      {/* a soft warning, it still saves: the cost is more than he sells it for */}
                      {num(draft.cost) !== null && num(draft.price) !== null && (num(draft.cost) as number) > (num(draft.sale) ?? (num(draft.price) as number)) && <p role="status" className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">{p.costAbove}</p>}
                    </div>
                    <div>
                      <Label id="p-sale" hint={p.saleHint} peek={peek("sale")}>{p.sale} ({p.currency})</Label>
                      <input id="p-sale" aria-invalid={!!errors.sale} dir="ltr" inputMode="decimal" value={draft.sale} onChange={(e) => { set("sale", digits(e.target.value)); if (errors.sale) setErrors((x) => ({ ...x, sale: undefined })); }} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start ${errors.sale ? bad : ""}`} />
                      {errors.sale && <p className="mt-1.5 text-xs text-rose-600">{errors.sale}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <Label id="p-category" hint={p.catHint} peek={peek("category")}>{p.category}</Label>
                      <CategoryPicker value={draft.categories} products={items} words={p} onChange={(v) => set("categories", v)} onTyped={(v) => { typedCat.current = v; }} />
                      <RudeNote lang={lang} text={draft.categories.join(" ")} />
                    </div>
                    <div>
                      <Label id="p-brand">{p.brand}</Label>
                      <input id="p-brand" value={draft.brand} onChange={(e) => set("brand", e.target.value)} placeholder={p.brandPh} maxLength={40} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.brand} />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 [&>div]:border-b-2 [&>div]:border-fg/20 [&>div]:pb-5 [&>div]:flex [&>div]:flex-col">
                    <div>
                      <Label id="p-notes" hint={p.notesHint} peek={peek("notes")}>{p.notes}</Label>
                      <input id="p-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder={p.notesPh} maxLength={60} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.notes} />
                    </div>
                    <div>
                      <Label id="p-badge" hint={p.badgeHint} peek={peek("badge")}>{p.badge}</Label>
                      <input id="p-badge" value={draft.badge} onChange={(e) => set("badge", e.target.value)} placeholder={p.badgePh} maxLength={20} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.badge} />
                    </div>
                  </div>

                  <div>
                    <Label id="p-desc">{p.description}</Label>
                    <textarea id="p-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder={p.descriptionPh} rows={5} maxLength={2000} className={`${field} resize-y py-3`} />
                    <RudeNote lang={lang} text={draft.description} />
                  </div>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <h3 className="font-bold">{p.visibility}</h3>
                  <Toggle on={draft.hidden} onChange={(v) => set("hidden", v)} label={p.hidden} hint={p.hiddenHint} />
                  <Toggle on={draft.featured} onChange={(v) => set("featured", v)} label={p.featured} hint={p.featuredHint} />
                  <Blocked when={!kindShips(draft.kind)} why={kw.shipOff(kw.names[draft.kind])}>
                    <Toggle on={draft.shipping} onChange={(v) => set("shipping", v)} label={p.shipping} hint={p.shippingHint} />
                  </Blocked>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <h3 className="font-bold">{p.stock}</h3>
                  {/* clothing and shoes: each size with its own quantity */}
                  <div>
                    <Blocked when={!kindHasSizes(draft.kind)} why={kw.sizesOff(kw.names[draft.kind])}>
                      <SizesEditor lang={lang} kind={draft.kind} sizes={draft.sizes} chart={draft.sizeChart} onChart={(v) => set("sizeChart", v)} error={errors.sizes} inputClass={field} onChange={(sizes) => { set("sizes", sizes); if (errors.sizes) setErrors((x) => ({ ...x, sizes: undefined })); }} />
                    </Blocked>
                  </div>
                  <div>
                    <Blocked when={kindHasSizes(draft.kind)} why={kw.stockBySize}>
                    <StockChoice
                      lang={lang}
                      unlimited={draft.unlimited}
                      quantity={draft.quantity}
                      okFor={stockOk}
                      onUnlimited={(v) => { set("unlimited", v); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      onQuantity={(v) => { set("quantity", whole(v)); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      onConfirm={(q) => { setStockOk(q); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      inputId="p-qty"
                      inputClass={`${field} ${errors.quantity ? bad : ""}`}
                      error={errors.quantity}
                      required
                    />
                    </Blocked>
                  </div>
                </div>

                {/* the notifications (low stock, back in stock) were taken out until they work; the saved values keep their defaults */}

                <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-6">
                  <button type="submit" className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{p.save}</button>
                  <button type="button" onClick={close} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>

                  {typeof editing === "number" &&
                    (items.find((x) => x.id === editing)?.deletedAt ? (
                      confirmDelete ? (
                        <span className="ms-auto flex flex-wrap items-center gap-3">
                          <span className="text-sm text-rose-600">{p.foreverAsk}</span>
                          <button type="button" onClick={() => remove([editing])} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{p.foreverYes}</button>
                          <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>
                        </span>
                      ) : (
                        <span className="ms-auto flex flex-wrap gap-3">
                          <button type="button" onClick={() => restore([editing])} className="rounded-lg border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{p.restore}</button>
                          <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{p.deleteForever}</button>
                        </span>
                      )
                    ) : confirmDelete ? (
                      <span className="ms-auto flex flex-wrap items-center gap-3">
                        <span className="text-sm text-rose-600">{p.deleteAsk}</span>
                        <button type="button" onClick={() => trash([editing])} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{p.deleteYes}</button>
                        <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="ms-auto rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{p.delete}</button>
                    ))}
                </div>
              </form>
            )}
          </section>
        </div>
      </main>

      {/* The "saved" card drops in at the top of the screen, where the page goes back to after saving */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
        {flash && (
          <div key={flash.n} className="pointer-events-auto flex w-full max-w-sm animate-[savedIn_.35s_ease-out] items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card px-4 py-3 shadow-2xl ring-1 ring-black/5">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-emerald-700 dark:text-emerald-400">{p.saved}</span>
              {flash.name && <span className="block truncate text-xs text-muted">{flash.name}</span>}
            </span>
            <button type="button" onClick={() => setFlash(null)} aria-label={p.cancel} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
