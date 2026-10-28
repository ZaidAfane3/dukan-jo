/* The records a merchant keeps in his dashboard (products, orders, coupons, reminders, invoice settings), and the
   rules that make each one safe to save. Every record read back from storage goes through these too, because what is
   stored can be old, broken or changed by hand.

   No React and no browser APIs here: once Dukkan has a backend, the server runs the same rules on what it receives. */

import { STATUS_KEYS, defaultInvoice, type InvoiceSettings, type StatusKey } from "./ordersContent";
import { latin } from "./digits";
import { cleanCount, cleanDate, cleanLine, cleanLines, cleanMoney, safeColor, safeImage, visibleLength } from "./safe";
import { isUnlimited } from "./safeOrder";

/* ============================== shared ============================== */

/** The biggest amount of money anything in a store can cost or total, in JOD. */
export const MAX_MONEY = 1_000_000;
/** The biggest quantity, limit or count a merchant can type. */
export const MAX_COUNT = 1_000_000;

/** A number of money in JOD (at most 3 decimals, 0 to MAX_MONEY), or null. */
export function money(v: unknown): number | null {
  const s = cleanMoney(v, MAX_MONEY);
  return s === "" ? null : Number(s);
}

/** A whole number from `min` to `max`, or `fallback`. */
export function count(v: unknown, fallback = 0, max = MAX_COUNT, min = 0): number {
  const n = cleanCount(typeof v === "number" ? Math.trunc(v) : v, max);
  return n === null || n < min ? fallback : n;
}

/** An amount as he types it: Arabic digits become Latin, one dot, at most `decimals` decimals, no extra zeros in
    front ("007" becomes "7"). Letters, minus signs and exponents ("1e9") are dropped. */
export const typedMoney = (v: string, decimals = 2) =>
  latin(v).replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(new RegExp(`^(\\d*\\.\\d{0,${decimals}}).*$`), "$1").replace(/^0+(?=\d)/, "").slice(0, 10);

/** A whole number as he types it: what comes after a decimal point is dropped ("1.5" is 1, not 15), no extra zeros
    in front, and never above `max`. */
export const typedCount = (v: string, max?: number) => {
  const d = latin(v).split(".")[0].replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return max !== undefined && d && Number(d) > max ? String(max) : d;
};

export const oneOf =<T>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

/** A record's id: a whole number above 0, or null. */
export const recordId = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);

/** A point in time kept as milliseconds: a real date between 2000 and 2100, or `fallback`. */
export function time(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 946_684_800_000 && v <= 4_102_444_800_000 ? Math.trunc(v) : fallback;
}

/** A picture kept with a record: picture data, or a picture file of the site itself (the demo store's photos). */
export function picture(v: unknown): string {
  if (typeof v !== "string") return "";
  if (safeImage(v)) return v;
  return /^\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\/[a-z0-9_.-]+\.(jpe?g|png|webp|gif)$/i.test(v) && !v.includes("..") ? v : "";
}

const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** A saved list: each entry is cleaned, and the ones that can't be are dropped. Anything else gives an empty list. */
export function cleanList<T>(raw: unknown, clean: (x: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const r = record(x);
    const c = r && clean(r);
    return c ? [c] : [];
  });
}

/** Today's date in the store's time zone (yyyy-mm-dd). Coupon dates are compared with this, on the server too. */
export function storeToday(now = new Date(), timeZone = "Asia/Amman"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/* ============================== products ============================== */

export type SendBy = "whatsapp" | "email" | "both";
const SEND_BY: readonly SendBy[] = ["whatsapp", "email", "both"];

export type Product = {
  id: number;
  /* Photos of the product (small pictures kept with it), the first one is the main one */
  images?: string[];
  /* The part of the main picture that stays visible when the store crops it (percent from the left and the top) */
  focus?: { x: number; y: number; zoom?: number };
  name: string;
  price: number | null;
  sale: number | null;
  cost: number | null;
  /* Optional: "" means no category, and the store shows the product under "Other" ("أخرى") */
  category: string;
  brand: string;
  description: string;
  /* Shown on the store's product card: a short notes line, and a small label on the picture */
  notes?: string;
  badge?: string;
  /* How many are in stock. Not used while `unlimited` is on (it keeps the last count he typed) */
  quantity: number;
  /* The stock has no limit: never sold out, never low. Old products saved 9999 for this; they are read as unlimited */
  unlimited?: boolean;
  hidden: boolean;
  featured: boolean;
  shipping: boolean;
  lowAt: number;
  restockMin: number;
  restockPct: number;
  /* how the notifications go out: to him when it runs low, and to the customers waiting for it */
  lowBy?: SendBy;
  restockBy?: SendBy;
  created: number;
  deletedAt?: number;
};

/** The limits of each product field, shared by the form and the checks. */
export const PRODUCT_MAX = { name: 80, category: 40, brand: 40, notes: 60, badge: 20, description: 2000 };

export type ProductProblem = "name" | "price" | "sale" | "images" | "quantity";

/** What is wrong with a product before it is saved, field by field (empty when nothing is).
    The category is optional (an empty one shows under "Other" in the store). At least one photo is required: only
    pictures that are really there count (one still uploading or that failed to load is not in `images`).
    The quantity is required unless the stock is unlimited; `quantity` null means the field was left empty. */
export function productProblems(p: Pick<Product, "name" | "price" | "sale"> & { images?: unknown[]; quantity: number | null; unlimited?: boolean }): ProductProblem[] {
  const out: ProductProblem[] = [];
  if (visibleLength(cleanLine(p.name, PRODUCT_MAX.name)) < 2) out.push("name");
  if (p.price === null || money(p.price) === null) out.push("price");
  if (p.sale !== null && (p.price === null || money(p.sale) === null || !(p.sale < p.price))) out.push("sale");
  if (!(Array.isArray(p.images) && p.images.some((x) => !!picture(x)))) out.push("images");
  if (p.unlimited !== true && (p.quantity === null || count(p.quantity, -1) < 0)) out.push("quantity");
  return out;
}

const percent = (v: unknown) => Math.max(0, Math.min(100, typeof v === "number" && Number.isFinite(v) ? v : 50));

export function cleanProduct(x: Record<string, unknown>): Product | null {
  const id = recordId(x.id);
  if (id === null) return null;
  const price = money(x.price);
  const sale = money(x.sale);
  const f = record(x.focus);
  const images = Array.isArray(x.images) ? x.images.map(picture).filter(Boolean).slice(0, 6) : [];
  return {
    id,
    images,
    focus: f ? { x: percent(f.x), y: percent(f.y), ...(typeof f.zoom === "number" && Number.isFinite(f.zoom) ? { zoom: Math.max(1, Math.min(4, f.zoom)) } : {}) } : undefined,
    name: cleanLine(x.name, PRODUCT_MAX.name) || "—",
    price,
    /* a sale price that is not below the price is no sale */
    sale: sale !== null && price !== null && sale < price ? sale : null,
    cost: money(x.cost),
    category: cleanLine(x.category, PRODUCT_MAX.category),
    brand: cleanLine(x.brand, PRODUCT_MAX.brand),
    description: cleanLines(x.description, PRODUCT_MAX.description),
    notes: cleanLine(x.notes, PRODUCT_MAX.notes),
    badge: cleanLine(x.badge, PRODUCT_MAX.badge),
    /* an old product whose 9999 meant "unlimited" keeps no fake count */
    quantity: isUnlimited(x) && x.unlimited === undefined ? 0 : count(x.quantity),
    unlimited: isUnlimited(x),
    hidden: x.hidden === true,
    featured: x.featured === true,
    shipping: x.shipping !== false,
    lowAt: count(x.lowAt, 5),
    restockMin: count(x.restockMin, 15),
    restockPct: count(x.restockPct, 100, 100),
    lowBy: oneOf(x.lowBy, SEND_BY, "both"),
    restockBy: oneOf(x.restockBy, SEND_BY, "both"),
    created: time(x.created, 0),
    ...(x.deletedAt !== undefined && x.deletedAt !== null ? { deletedAt: time(x.deletedAt, Date.now()) } : {}),
  };
}

/** A category name as it is saved, or "" when nothing is left of it. */
export const cleanCategory = (v: unknown) => cleanLine(v, PRODUCT_MAX.category);

/* ============================== orders ============================== */

export type OrderItem = { id?: number; name: string; qty: number; price: number; image?: string };

export type Order = {
  id: number;
  customer: string;
  phone: string;
  total: number;
  status: StatusKey;
  channel: 0 | 1;
  /* For orders added by hand: where the customer ordered (WhatsApp, Instagram, ...) */
  source?: number;
  /* What was ordered: the product name, how many, and the price of one */
  items?: OrderItem[];
  /* Orders placed in the store also carry where to deliver, a note and how the customer pays */
  /* "pickup": the customer collects it from the store, so there is no city or address */
  fulfil?: "delivery" | "pickup";
  city?: string;
  address?: string;
  note?: string;
  pay?: "cliq" | "cash" | "card";
  created: number;
};

export const ORDER_MAX = { customer: 60 };

export function cleanOrder(x: Record<string, unknown>): Order | null {
  const id = recordId(x.id);
  if (id === null) return null;
  const items = cleanList(x.items, (i) => {
    const name = cleanLine(i.name, 80);
    const price = money(i.price);
    const image = picture(i.image);
    const id = recordId(i.id);
    return name && price !== null ? { ...(id ? { id } : {}), name, qty: count(i.qty, 1, 9999, 1), price, ...(image ? { image } : {}) } : null;
  });
  return {
    id,
    customer: cleanLine(x.customer, ORDER_MAX.customer) || "—",
    phone: cleanLine(x.phone, 20).replace(/[^\d+ ]/g, ""),
    total: money(x.total) ?? 0,
    status: oneOf(x.status, STATUS_KEYS, "pending"),
    channel: x.channel === 1 ? 1 : 0,
    ...(x.source !== undefined ? { source: count(x.source, 0, 20) } : {}),
    ...(items.length ? { items } : {}),
    ...(x.fulfil === "pickup" || x.fulfil === "delivery" ? { fulfil: x.fulfil } : {}),
    ...(typeof x.city === "string" ? { city: cleanLine(x.city, 60) } : {}),
    ...(typeof x.address === "string" ? { address: cleanLine(x.address, 200) } : {}),
    ...(typeof x.note === "string" ? { note: cleanLines(x.note, 500) } : {}),
    ...(x.pay !== undefined ? { pay: oneOf(x.pay, ["cliq", "cash", "card"] as const, "cash") } : {}),
    created: time(x.created, 0),
  };
}

/* ============================== coupons ============================== */

export type CouponType = 0 | 1 | 2 | 3; /* discount, free shipping, custom, next order */
export type CouponKind = "percent" | "fixed" | "shipping";

export type Coupon = {
  id: string;
  type: CouponType;
  /* Optional: "" means none, and the code is shown in its place (use `couponName`) */
  name: string;
  code: string;
  /* Optional note about the coupon, a few lines */
  description?: string;
  kind: CouponKind;
  value: number;
  minOrder: number;
  start: string; /* YYYY-MM-DD, or "" for "starts now" */
  end: string; /* YYYY-MM-DD, or "" for "no end date" */
  limit: number; /* 0 = unlimited */
  validDays: number; /* only for next-order coupons */
  used: number;
  active: boolean;
};

/** A coupon code: 3 to 16 Latin capital letters and digits. */
export const COUPON_CODE = /^[A-Z0-9]{3,16}$/;

/** The limits of the coupon's text fields. */
export const COUPON_MAX = { name: 50, description: 300 };

/** A coupon's name as it is saved: "" when nothing visible is left (only spaces or invisible characters). */
export const cleanCouponName = (v: unknown) => {
  const s = cleanLine(v, COUPON_MAX.name);
  return visibleLength(s) ? s : "";
};

/** A coupon's description as it is saved: "" when nothing visible is left. */
export const cleanCouponDescription = (v: unknown) => {
  const s = cleanLines(v, COUPON_MAX.description);
  return visibleLength(s) ? s : "";
};

/** What a coupon is called wherever it is shown: its name, or its code when it has none. */
export const couponName = (c: { name: string; code: string }) => cleanCouponName(c.name) || c.code;

/* The name is optional, so it is not checked: an empty one shows the code (couponName) */
export type CouponProblem = "code" | "dup" | "value" | "percent" | "overMin" | "past" | "dates" | "days";

/** What is wrong with a coupon before it is saved. `taken` are the codes of his other coupons; `keepEnd` is the end
    date it already had (an expired coupon can be edited without moving its date). */
export function couponProblems(c: Omit<Coupon, "id" | "used" | "active">, taken: string[], keepEnd = "", today = storeToday()): CouponProblem[] {
  const out: CouponProblem[] = [];
  if (!COUPON_CODE.test(c.code)) out.push("code");
  else if (taken.some((t) => t.toUpperCase() === c.code)) out.push("dup");
  if (c.kind !== "shipping") {
    if (!(c.value > 0) || money(c.value) === null) out.push("value");
    else if (c.kind === "percent" && c.value > 100) out.push("percent");
    /* A fixed discount bigger than the smallest allowed order would make the order free */
    else if (c.kind === "fixed" && c.minOrder > 0 && c.value > c.minOrder) out.push("overMin");
  }
  if ((c.start && !cleanDate(c.start)) || (c.end && !cleanDate(c.end))) out.push("dates");
  else if (c.end && c.end < today && c.end !== keepEnd) out.push("past");
  /* both dates count, so a coupon may start and end on the same day */
  else if (c.start && c.end && c.end < c.start) out.push("dates");
  if (c.type === 3 && !(c.validDays >= 1 && c.validDays <= 365)) out.push("days");
  return out;
}

const KINDS: readonly CouponKind[] = ["percent", "fixed", "shipping"];

export function cleanCoupon(x: Record<string, unknown>): Coupon | null {
  const code = typeof x.code === "string" ? x.code.toUpperCase() : "";
  if (typeof x.id !== "string" || !x.id || !COUPON_CODE.test(code)) return null;
  const type = oneOf(x.type, [0, 1, 2, 3] as const, 0);
  const kind = type === 1 ? "shipping" : oneOf(x.kind, KINDS, "percent");
  const value = kind === "shipping" ? 0 : money(x.value) ?? 0;
  return {
    id: cleanLine(x.id, 60),
    type,
    name: cleanCouponName(x.name),
    code,
    description: cleanCouponDescription(x.description),
    kind,
    value: kind === "percent" ? Math.min(100, value) : value,
    minOrder: money(x.minOrder) ?? 0,
    start: cleanDate(x.start),
    end: cleanDate(x.end),
    limit: count(x.limit),
    validDays: type === 3 ? count(x.validDays, 30, 365, 1) : 0,
    used: count(x.used),
    active: x.active !== false,
  };
}

/* ============================== reminders ============================== */

export type Reminder = {
  id: number;
  name: string;
  amount: number;
  unit: 0 | 1; /* hours, days */
  channel: 0 | 1; /* email, SMS */
  discount: number; /* percent, 0 = none */
  active: boolean;
};

export const REMINDER_MAX = { name: 50, amount: 999, discount: 90 };

export function cleanReminder(x: Record<string, unknown>): Reminder | null {
  const id = recordId(x.id);
  const amount = count(x.amount, 0, REMINDER_MAX.amount);
  const name = cleanLine(x.name, REMINDER_MAX.name);
  if (id === null || amount < 1 || !name) return null;
  return { id, name, amount, unit: x.unit === 1 ? 1 : 0, channel: x.channel === 1 ? 1 : 0, discount: count(x.discount, 0, REMINDER_MAX.discount), active: x.active !== false };
}

/* ============================== invoice settings ============================== */

const POS = ["right", "center", "left"] as const;

/** Invoice settings from storage: each field keeps its saved value only when it is the right kind, else the default. */
/** A sales tax number: digits only (Arabic digits become Latin), at most 15. */
export const taxNumber = (v: unknown): string => (typeof v === "string" ? latin(v).replace(/\D/g, "").slice(0, 15) : "");

export function cleanInvoice(raw: unknown): InvoiceSettings {
  const x = record(raw) ?? {};
  const d = defaultInvoice;
  const out = { ...d } as Record<string, unknown>;
  for (const [k, def] of Object.entries(d)) if (typeof def === "boolean") out[k] = typeof x[k] === "boolean" ? x[k] : def;
  const pct = (v: unknown, def: number) => count(typeof v === "number" ? Math.round(v) : v, def, 100);
  return {
    ...(out as InvoiceSettings),
    titleMode: oneOf(x.titleMode, ["default", "custom"] as const, d.titleMode),
    customTitle: cleanLine(x.customTitle, 30),
    invoiceLang: oneOf(x.invoiceLang, ["ar", "en"] as const, d.invoiceLang),
    storeName: cleanLine(x.storeName, 50),
    taxNumber: taxNumber(x.taxNumber),
    sendStatuses: Array.isArray(x.sendStatuses) ? Array.from(new Set(x.sendStatuses.filter((s): s is StatusKey => STATUS_KEYS.includes(s)))) : d.sendStatuses,
    logoSize: pct(x.logoSize, d.logoSize),
    logoPos: oneOf(x.logoPos, POS, d.logoPos),
    primaryColor: safeColor(x.primaryColor, d.primaryColor),
    secondaryColor: safeColor(x.secondaryColor, d.secondaryColor),
    watermarkOpacity: pct(x.watermarkOpacity, d.watermarkOpacity),
    stampOpacity: pct(x.stampOpacity, d.stampOpacity),
    stampPos: oneOf(x.stampPos, POS, d.stampPos),
  };
}

/** Reads a saved list and cleans it. Broken JSON gives an empty list. */
export function parseList<T>(json: string | null, clean: (x: Record<string, unknown>) => T | null): T[] {
  if (!json) return [];
  try {
    return cleanList(JSON.parse(json), clean);
  } catch {
    return [];
  }
}
