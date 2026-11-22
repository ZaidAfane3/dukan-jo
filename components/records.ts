/* The records a merchant keeps in his dashboard (products, orders, coupons, reminders, invoice settings), and the
   rules that make each one safe to save. Every record read back from storage goes through these too, because what is
   stored can be old, broken or changed by hand.

   No React and no browser APIs here: once Dukkan has a backend, the server runs the same rules on what it receives. */

import { STATUS_KEYS, defaultInvoice, type InvoiceSettings, type StatusKey } from "./ordersContent";
import { latin } from "./digits";
import { cleanCount, cleanDate, cleanLine, cleanLines, cleanMoney, isMediaUrl, safeColor, safeImage, visibleLength } from "./safe";
import { isKnownCity, isUnlimited, kindHasSizes, productKind, productSizes, soldOnline, visitorEmail, type ProductKind, type SizeStock } from "./safeOrder";

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

/** An amount as he types it: Arabic digits become Latin, one dot, at most `decimals` decimals (3 for JOD: its fils, the
    same as money() keeps), no extra zeros in front ("007" becomes "7"). Letters, minus signs and exponents ("1e9") are
    dropped. */
export const typedMoney = (v: string, decimals = 3) =>
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

/** A picture kept with a record: picture data, a picture kept on Dukkan's server (/media/..., server/media.ts), or a
    picture file of the site itself (the demo store's photos). */
export function picture(v: unknown): string {
  if (typeof v !== "string") return "";
  if (safeImage(v) || isMediaUrl(v)) return v;
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
  /* What kind of product it is (none: "standard"): clothing and shoes are sold in sizes, digital codes and services are not shipped */
  kind?: ProductKind;
  /* Clothing and shoes: each size and its own stock. The product's `quantity` is then all of them together */
  sizes?: SizeStock[];
  /* Clothing and shoes: a picture of his size chart, opened from the product page beside the sizes */
  sizeChart?: string;
  price: number | null;
  sale: number | null;
  cost: number | null;
  /* Optional, and a product can be in several: none means the store shows it under "Other" ("أخرى") */
  categories: string[];
  /* The first of them ("" when none): kept for whatever reads one category (old saved products had only this) */
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
  /* How many the public store sold online, per size ("" without sizes): kept as it is, so the server can tell how many
     orders his copy has not seen yet (safeOrder.ts SOLD_ONLINE) */
  soldOnline?: Record<string, number>;
};

/** The limits of each product field, shared by the form and the checks. */
export const PRODUCT_MAX = { name: 80, category: 40, categories: 10, brand: 40, notes: 60, badge: 20, description: 2000 };

export type ProductProblem = "name" | "price" | "sale" | "images" | "quantity" | "sizes";

/** What is wrong with a product before it is saved, field by field (empty when nothing is).
    The category is optional (an empty one shows under "Other" in the store). At least one photo is required: only
    pictures that are really there count (one still uploading or that failed to load is not in `images`).
    The quantity is required unless the stock is unlimited; `quantity` null means the field was left empty. */
export function productProblems(p: Pick<Product, "name" | "price" | "sale"> & { images?: unknown[]; quantity: number | null; unlimited?: boolean; kind?: ProductKind; sizes?: { name: string; quantity: unknown }[] }): ProductProblem[] {
  const out: ProductProblem[] = [];
  if (visibleLength(cleanLine(p.name, PRODUCT_MAX.name)) < 2) out.push("name");
  if (p.price === null || money(p.price) === null) out.push("price");
  if (p.sale !== null && (p.price === null || money(p.sale) === null || !(p.sale < p.price))) out.push("sale");
  if (!(Array.isArray(p.images) && p.images.some((x) => !!picture(x)))) out.push("images");
  /* clothing and shoes need at least one size with a name (their stock is the sizes'); the others need their quantity */
  if (kindHasSizes(productKind(p.kind))) {
    if (!(p.sizes ?? []).some((s) => s.name.trim())) out.push("sizes");
  } else if (p.unlimited !== true && (p.quantity === null || count(p.quantity, -1) < 0)) out.push("quantity");
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
  const categories = productCategories(x);
  return {
    id,
    images,
    focus: f ? { x: percent(f.x), y: percent(f.y), ...(typeof f.zoom === "number" && Number.isFinite(f.zoom) ? { zoom: Math.max(1, Math.min(4, f.zoom)) } : {}) } : undefined,
    name: cleanLine(x.name, PRODUCT_MAX.name) || "—",
    ...(() => {
      const kind = productKind(x.kind);
      const sizes = productSizes(x);
      const chart = kindHasSizes(kind) ? picture(x.sizeChart) : "";
      return kind === "standard" ? {} : { kind, ...(kindHasSizes(kind) ? { sizes } : {}), ...(chart ? { sizeChart: chart } : {}) };
    })(),
    price,
    /* a sale price that is not below the price is no sale */
    sale: sale !== null && price !== null && sale < price ? sale : null,
    cost: money(x.cost),
    categories,
    category: categories[0] ?? "",
    brand: cleanLine(x.brand, PRODUCT_MAX.brand),
    description: cleanLines(x.description, PRODUCT_MAX.description),
    notes: cleanLine(x.notes, PRODUCT_MAX.notes),
    badge: cleanLine(x.badge, PRODUCT_MAX.badge),
    /* an old product whose 9999 meant "unlimited" keeps no fake count */
    /* a product in sizes counts all of its sizes, and is never "unlimited" */
    quantity: productSizes(x).length ? productSizes(x).reduce((n, s) => n + s.quantity, 0) : isUnlimited(x) && x.unlimited === undefined ? 0 : count(x.quantity),
    unlimited: kindHasSizes(productKind(x.kind)) ? false : isUnlimited(x),
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
    ...(Object.keys(soldOnline(x.soldOnline)).length ? { soldOnline: soldOnline(x.soldOnline) } : {}),
  };
}

/** A category name as it is saved, or "" when nothing is left of it. */
export const cleanCategory = (v: unknown) => cleanLine(v, PRODUCT_MAX.category);

/** A product's categories as they are saved: each one cleaned, once, at most 10. A product saved before it could have
    several has only `category`, which becomes a list of one. */
export function productCategories(x: { categories?: unknown; category?: unknown }): string[] {
  const raw = Array.isArray(x.categories) ? x.categories : [x.category];
  return Array.from(new Set(raw.map(cleanCategory).filter(Boolean))).slice(0, PRODUCT_MAX.categories);
}

/* ============================== orders ============================== */

export type OrderItem = { id?: number; name: string; qty: number; price: number; image?: string; /* the size chosen (clothing and shoes) */ size?: string; /* how many pieces it took out of the stock (safeOrder stockTaken): a cancel gives back exactly that. Older orders have none (their qty) */ took?: number };

export type Order = {
  id: number;
  customer: string;
  phone: string;
  /* The customer's email: every store order now has a phone and an email; older ones may have only one of them */
  email?: string;
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
  /* The coupon used at checkout: its code and what it took off (the total is already after it) */
  coupon?: { code: string; discount: number };
  /* Orders from the store: the delivery fee the customer paid (already in the total; 0 when delivery was free). Older
     orders and orders added by hand have none, so Reports leaves their delivery out instead of guessing it */
  delivery?: number;
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
    const size = cleanLine(i.size, 12);
    const qty = count(i.qty, 1, 9999, 1);
    const took = typeof i.took === "number" && Number.isSafeInteger(i.took) && i.took >= 0 ? Math.min(i.took, qty) : null;
    return name && price !== null ? { ...(id ? { id } : {}), name, qty, price, ...(image ? { image } : {}), ...(size ? { size } : {}), ...(took !== null ? { took } : {}) } : null;
  });
  return {
    id,
    customer: cleanLine(x.customer, ORDER_MAX.customer) || "—",
    phone: cleanLine(x.phone, 20).replace(/[^\d+ ]/g, ""),
    ...(visitorEmail(x.email) ? { email: visitorEmail(x.email) } : {}),
    total: money(x.total) ?? 0,
    status: oneOf(x.status, STATUS_KEYS, "pending"),
    channel: x.channel === 1 ? 1 : 0,
    ...(x.source !== undefined ? { source: count(x.source, 0, 20) } : {}),
    ...(items.length ? { items } : {}),
    ...(x.fulfil === "pickup" || x.fulfil === "delivery" ? { fulfil: x.fulfil } : {}),
    /* a city of the list (in either language), or one staff added to Dukkan Ship's cities in Diwan: a short plain name,
       kept only when it needs no cleaning */
    ...(isKnownCity(x.city) || (typeof x.city === "string" && x.city !== "" && cleanLine(x.city, 40) === x.city) ? { city: x.city } : {}),
    ...(typeof x.address === "string" ? { address: cleanLine(x.address, 200) } : {}),
    ...(typeof x.note === "string" ? { note: cleanLines(x.note, 500) } : {}),
    ...(x.pay !== undefined ? { pay: oneOf(x.pay, ["cliq", "cash", "card"] as const, "cash") } : {}),
    ...(couponOf(x.coupon) ? { coupon: couponOf(x.coupon) } : {}),
    ...(money(x.delivery) !== null ? { delivery: money(x.delivery) as number } : {}),
    created: time(x.created, 0),
  };
}

/** The Orders page's search: an order whose number, customer name, phone or email has what was typed. A phone is found
    however it is typed (079…, 79… or +962 79…). The server searches its store orders with this too (server/storeOrders.ts). */
export function orderMatches(x: { id: number; customer: string; phone: string; email?: string }, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return true;
  const digitsOf = (v: string) => latin(v).replace(/\D/g, "").replace(/^(00962|962|0)/, "");
  const qd = digitsOf(q);
  return String(x.id).includes(q) || x.customer.toLowerCase().includes(q) || x.phone.includes(q) || !!x.email?.includes(q) || (qd.length >= 3 && digitsOf(x.phone).includes(qd));
}

/** An order's coupon as saved: a valid code and a discount, or nothing */
function couponOf(v: unknown): Order["coupon"] {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code.toUpperCase() : "";
  const discount = money(o.discount);
  return COUPON_CODE.test(code) && discount !== null ? { code, discount } : undefined;
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
  /* next-order coupons: the day it was made (YYYY-MM-DD), from which its days are counted when it has no start date */
  from?: string;
  used: number;
  /* How many of those uses were orders on the public store, counted by the server: kept as it is, so a save of an older
     copy of the coupons gets the uses it has not seen added again (mergeUsedOnline) */
  usedOnline?: number;
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

/** Where a coupon is in its dates today, in Jordan time with both days counting: before its start day ("soon"), after
    its end day ("ended"), or inside them ("now"). The checkout (checkCoupon, here and on the server) and the merchant's
    coupons list (Coupons.tsx) both go by this. */
export function couponDates(c: { start: string; end: string }, today = storeToday()): "soon" | "ended" | "now" {
  if (c.start && today < c.start) return "soon";
  if (c.end && today > c.end) return "ended";
  return "now";
}

/** A next-order coupon past its days: counted from its start date, or the day it was made, both days included */
export function nextOrderEnded(c: { type?: CouponType; validDays?: number; start?: string; from?: string }, today = storeToday()): boolean {
  if (c.type !== 3 || !c.validDays || c.validDays <= 0) return false;
  const base = c.start || c.from;
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return false;
  const last = new Date(`${base}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + c.validDays - 1);
  return today > last.toISOString().slice(0, 10);
}

/** Why a code typed at checkout is not taken */
export type CouponRefusal = "unknown" | "off" | "soon" | "ended" | "usedUp" | "min";

/** A coupon code typed at checkout, checked against the store's coupons. The server must do the same with its own list:
    found whatever its case and spaces, switched on, inside its dates (Jordan time, both days count), not used up, and the
    order reaching its minimum. The discount is worked out from the subtotal and never goes over it. */
export function checkCoupon(code: unknown, coupons: Coupon[], subtotal: number, today = storeToday()): { ok: true; coupon: Coupon; discount: number; freeDelivery: boolean } | { ok: false; why: CouponRefusal } {
  const typed = typeof code === "string" ? latin(code).replace(/\s+/g, "").toUpperCase() : "";
  const c = COUPON_CODE.test(typed) ? coupons.find((x) => x.code.toUpperCase() === typed) : undefined;
  if (!c) return { ok: false, why: "unknown" };
  if (!c.active) return { ok: false, why: "off" };
  const when = couponDates(c, today);
  if (when !== "now") return { ok: false, why: when };
  if (nextOrderEnded(c, today)) return { ok: false, why: "ended" };
  if (c.limit > 0 && c.used >= c.limit) return { ok: false, why: "usedUp" };
  if (c.minOrder > 0 && subtotal < c.minOrder) return { ok: false, why: "min" };
  const off = c.kind === "percent" ? (subtotal * c.value) / 100 : c.kind === "fixed" ? c.value : 0;
  return { ok: true, coupon: c, discount: Math.round(Math.min(subtotal, Math.max(0, off)) * 1000) / 1000, freeDelivery: c.kind === "shipping" };
}

/** The saved coupons after an order used one: that code counts one more use (its limit is checked against this).
    Every other part of each coupon is kept exactly as saved. Used by the merchant's preview (Cart.tsx) and the server
    (server/storeOrders.ts). `by: -1`: an order that used it was cancelled or refunded, so the use is given back (never
    below zero); it counts again (+1) when the order comes back, even past the coupon's limit (that order already had
    its discount). */
export function countCouponUse(list: unknown[], code: string, o: { online?: boolean; by?: 1 | -1 } = {}): unknown[] {
  const typed = code.toUpperCase();
  const by = o.by ?? 1;
  return list.map((c) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return c;
    const x = c as Record<string, unknown>;
    if (typeof x.code !== "string" || x.code.toUpperCase() !== typed) return x;
    const used = Math.max(0, (typeof x.used === "number" && x.used >= 0 ? x.used : 0) + by);
    if (!o.online) return { ...x, used };
    /* an order on the public store also counts as an online use (see mergeUsedOnline); none left: left out */
    const online = Math.max(0, count(x.usedOnline) + by);
    const { usedOnline: _was, ...rest } = x;
    return online > 0 ? { ...rest, used, usedOnline: online } : { ...rest, used };
  });
}

/** The merchant's coupons as he saves them (`incoming`), with their online uses brought to the server's count, from the
    coupons as the server has them (`stored`), matched by their id: uses his copy has not seen yet are added, and uses
    given back since (an order cancelled or refunded) are taken off, so his copy ends on the server's count and saving it
    again changes nothing more (as safeOrder.ts mergeSoldOnline does for stock). A coupon the server does not have yet
    (new in his copy) is kept as it is. Every other part is kept. */
export function mergeUsedOnline(incoming: unknown[], stored: unknown[]): unknown[] {
  const server = new Map<string, number>();
  for (const s of stored) if (s && typeof s === "object" && typeof (s as Record<string, unknown>).id === "string") server.set((s as Record<string, unknown>).id as string, count((s as Record<string, unknown>).usedOnline));
  return incoming.map((c) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return c;
    const x = c as Record<string, unknown>;
    const known = typeof x.id === "string" ? server.get(x.id) : undefined;
    if (known === undefined) return x;
    const mine = count(x.usedOnline);
    if (known === mine) return x;
    const { usedOnline: _was, ...rest } = x;
    const used = Math.max(0, count(x.used) + (known - mine));
    return known > 0 ? { ...rest, used, usedOnline: known } : { ...rest, used };
  });
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
    ...(type === 3 && cleanDate(x.from) ? { from: cleanDate(x.from) } : {}),
    used: count(x.used),
    ...(count(x.usedOnline) > 0 ? { usedOnline: count(x.usedOnline) } : {}),
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
