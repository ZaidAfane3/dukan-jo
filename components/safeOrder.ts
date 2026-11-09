/* The rules for what a store visitor sends: the cart, the checkout form and the newsletter email.

   Visitors are strangers, so nothing they send is trusted: the cart only says which products and how many,
   and the prices, the stock and the total always come from the store's own catalog. Today the browser runs
   these rules; once Dukkan has a backend, the server must run the same functions on its own catalog before
   it saves an order. No React and no browser APIs in this file, so the server can import it as it is. */

import { jordanMobile } from "./phone";
import { cleanParagraph, cleanText } from "./safe";

export const ORDER_LIMITS = {
  name: 80,
  address: 200,
  note: 300,
  email: 120,
  /* the most of one product in a single order, and the most different products */
  qty: 99,
  lines: 50,
  /* no price in JOD can be higher than this */
  price: 100_000,
};

/** The cities orders are delivered to today. Anything else sent as a city for a new order is refused. */
export const CITIES = {
  ar: ["إربد", "عمّان", "السلط"],
  en: ["Irbid", "Amman", "Salt"],
};

/** Every city an order may have been saved with (orders placed when more cities were offered keep theirs) */
export const KNOWN_CITIES = {
  ar: ["عمّان", "الزرقاء", "إربد", "السلط", "مادبا", "العقبة", "جرش", "عجلون", "المفرق", "الكرك", "الطفيلة", "معان"],
  en: ["Amman", "Zarqa", "Irbid", "Salt", "Madaba", "Aqaba", "Jerash", "Ajloun", "Mafraq", "Karak", "Tafilah", "Ma'an"],
};

/** A city saved on an order (in either language) */
export const isKnownCity = (s: unknown): s is string => typeof s === "string" && (KNOWN_CITIES.en.includes(s) || KNOWN_CITIES.ar.includes(s));

/** How the order reaches the customer. Pickup is offered only when the store allows it. */
export const FULFILS = ["delivery", "pickup"] as const;
export type Fulfil = (typeof FULFILS)[number];

/** A city orders are delivered to now (in either language): Dukkan Ship's cities from Diwan when given, else the list above. */
export const isCity = (s: unknown, list: { en: readonly string[]; ar: readonly string[] } = CITIES): s is string =>
  typeof s === "string" && (list.en.includes(s) || list.ar.includes(s));

/** A choice from a list kept in two languages (a city) in the language of the page. It is saved in the language it was chosen
    in, so it is found in either; a value that is not on the list comes back as it was. */
export function inLang(v: string, list: { en: readonly string[]; ar: readonly string[] }, lang: "en" | "ar"): string {
  const i = list.en.includes(v) ? list.en.indexOf(v) : list.ar.indexOf(v);
  return i < 0 ? v : list[lang][i] ?? v;
}

export const PAYMENTS = ["cliq", "cash", "card"] as const;
export type Payment = (typeof PAYMENTS)[number];

/* ============================== catalog ============================== */

/** Amounts in JOD are kept to the fils (3 decimals). */
export const toFils = (n: number) => Math.round(n * 1000) / 1000;

/** A price that can be charged: a finite amount from 0 up to the limit, otherwise null. */
export function money(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= ORDER_LIMITS.price ? toFils(v) : null;
}

/** How many the store has: a whole number of 0 or more. Anything else counts as none. */
export function stock(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1_000_000) : 0;
}

/** The stock a product with no limit counts as: never sold out and never "only a few left". A visitor can still
    order at most ORDER_LIMITS.qty of it at a time. */
export const UNLIMITED_STOCK = 1_000_000;

/** The stock had no limit. Saved products say so with `unlimited: true`. Products saved before that flag existed
    used a quantity of exactly 9999 to mean "unlimited" (the old setup choice), so a product without the flag and
    with that quantity is read as unlimited too. Once saved again it carries the flag, and 9999 is a real count. */
export function isUnlimited(p: { unlimited?: unknown; quantity?: unknown }): boolean {
  if (typeof p.unlimited === "boolean") return p.unlimited;
  return p.unlimited === undefined && Number(p.quantity) === 9999;
}

/** What kind of product it is. It decides what the product form asks: clothing and shoes have sizes (with a stock for
    each size), digital codes / gift cards and services are not shipped. Old products have none: "standard". */
export const PRODUCT_KINDS = ["standard", "clothing", "shoes", "digital", "service"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
export const productKind = (v: unknown): ProductKind => (PRODUCT_KINDS.includes(v as ProductKind) ? (v as ProductKind) : "standard");
/** The kind is sold in sizes, each with its own stock */
export const kindHasSizes = (k: ProductKind) => k === "clothing" || k === "shoes";
/** The kind is something delivered to an address (a code, a gift card or a service is not) */
export const kindShips = (k: ProductKind) => k !== "digital" && k !== "service";

/** One size of a product and how many of it the store has */
export type SizeStock = { name: string; quantity: number };
export const SIZE_MAX = { name: 12, count: 30 };
/** A size's name as it is saved: one short line, or "" */
export const sizeName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, SIZE_MAX.name) : "");
/** The sizes of a product (only a kind sold in sizes has them): each named once, with a whole stock */
export function productSizes(p: { kind?: unknown; sizes?: unknown }): SizeStock[] {
  if (!kindHasSizes(productKind(p.kind)) || !Array.isArray(p.sizes)) return [];
  const seen = new Set<string>();
  const out: SizeStock[] = [];
  for (const x of p.sizes) {
    if (!x || typeof x !== "object") continue;
    const name = sizeName((x as { name?: unknown }).name);
    if (!name || seen.has(name.toLowerCase()) || out.length >= SIZE_MAX.count) continue;
    seen.add(name.toLowerCase());
    out.push({ name, quantity: stock((x as { quantity?: unknown }).quantity) });
  }
  return out;
}

/** How many can be sold: the stock, or UNLIMITED_STOCK when it has no limit. A product in sizes: all its sizes together. */
export function sellableStock(p: { unlimited?: unknown; quantity?: unknown; kind?: unknown; sizes?: unknown }): number {
  const sizes = productSizes(p);
  if (sizes.length) return sizes.reduce((n, s) => n + s.quantity, 0);
  return isUnlimited(p) ? UNLIMITED_STOCK : stock(p.quantity);
}

/** How many of one size can be sold (0 for a size it does not have) */
export function sizeStock(p: { kind?: unknown; sizes?: unknown }, size: string): number {
  return productSizes(p).find((s) => s.name === size)?.quantity ?? 0;
}

/** A product id: a whole number (sample products use negative ones). */
export function productId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isSafeInteger(n) ? n : null;
}

/** The sale price counts only when it is a real price below the normal one. */
export function salePrice(price: number | null, sale: unknown): number | null {
  const s = money(sale);
  return price !== null && s !== null && s < price ? s : null;
}

export type Sellable = { id: number; name: string; price: number | null; sale: number | null; quantity: number; /* clothing and shoes: each size and its stock */ sizes?: SizeStock[] };

/** What one piece costs: the sale price when there is a valid one, otherwise the price. null: it cannot be sold. */
export function unitPrice(p: { price: unknown; sale?: unknown }): number | null {
  const price = money(p.price);
  return salePrice(price, p.sale) ?? price;
}

/** A quantity a visitor asks for, cut to what can be sold: a whole number from 0 to the stock (and the per order limit). */
export function cartQty(n: unknown, available: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, Math.min(v, stock(available), ORDER_LIMITS.qty));
}

export type PricedLine = { id: number; name: string; qty: number; price: number; /* the size chosen (clothing and shoes) */ size?: string };

/** The cart rebuilt from the catalog: unknown, unsellable and sold out products are left out, quantities are cut to
    the stock, and every price is the catalog's. `changed` tells that what the visitor asked for could not all be kept,
    so he should look at his cart again before the order is placed. */
export function priceCart(lines: { id: unknown; qty: unknown; size?: unknown }[], catalog: Sellable[]): { items: PricedLine[]; subtotal: number; changed: boolean } {
  const byId = new Map<number, Sellable>();
  for (const p of catalog) if (!byId.has(p.id)) byId.set(p.id, p);
  /* one line per product, and per size for a product in sizes */
  const wanted = new Map<string, { id: number; size: string; q: number }>();
  let changed = false;
  for (const l of Array.isArray(lines) ? lines : []) {
    const id = productId(l?.id);
    const q = typeof l?.qty === "number" && Number.isFinite(l.qty) ? Math.floor(l.qty) : 0;
    const size = sizeName(l?.size);
    if (id === null || q <= 0) {
      changed = true;
      continue;
    }
    const key = `${id}|${size}`;
    wanted.set(key, { id, size, q: (wanted.get(key)?.q ?? 0) + q });
  }
  const items: PricedLine[] = [];
  for (const { id, size, q } of Array.from(wanted.values())) {
    const p = byId.get(id);
    const price = p ? unitPrice(p) : null;
    /* a product in sizes is sold by size (a size it does not have, or none chosen, cannot be bought); the others ignore a size */
    const sized = !!p?.sizes?.length;
    const has = sized ? p?.sizes?.find((z) => z.name === size) : undefined;
    const qty = !p ? 0 : sized ? (has ? cartQty(q, has.quantity) : 0) : cartQty(q, p.quantity);
    if (!p || price === null || qty === 0 || items.length >= ORDER_LIMITS.lines) {
      changed = true;
      continue;
    }
    if (qty !== q) changed = true;
    items.push({ id, name: cleanText(p.name, 120), qty, price, ...(sized ? { size } : {}) });
  }
  return { items, subtotal: toFils(items.reduce((s, it) => s + it.qty * it.price, 0)), changed };
}

/* ============================== checkout form ============================== */

/* Characters that take no space: they don't count as something written */
const INVISIBLE = /[\s\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g;
const visible = (s: string) => s.replace(INVISIBLE, "").length;

export type CheckoutField = "name" | "phone" | "city" | "address" | "note" | "pay";

/* `phone` or `email`: the customer gives one of them (the receipt goes there); the other is "" */
export type CheckoutValue = { customer: string; phone: string; email: string; fulfil: Fulfil; city: string; address: string; note: string; pay: Payment };

/** Checks the checkout form. Returns the cleaned order details, or the fields that are wrong. The city and the
    address are asked only for delivery; "pickup" counts only when the store allows it (`pickup`). `pays`: the ways to
    pay Dukkan offers now (platform settings in Diwan); one that is switched off is refused like one that does not exist. */
export function checkCheckout(f: Record<string, unknown>, opts: { pickup?: boolean; pays?: readonly Payment[]; cities?: { en: readonly string[]; ar: readonly string[] } } = {}): { ok: true; value: CheckoutValue } | { ok: false; errors: CheckoutField[] } {
  const errors: CheckoutField[] = [];
  const name = cleanText(f.name, ORDER_LIMITS.name).replace(/\s+/g, " ").trim();
  if (visible(name) < 2) errors.push("name");
  /* one contact field: a Jordan mobile or an email address, where the receipt is sent */
  const contact = typeof f.phone === "string" ? f.phone.trim() : "";
  const mobile = jordanMobile(contact);
  const email = mobile ? "" : visitorEmail(contact);
  if (!mobile && !email) errors.push("phone");
  const fulfil: Fulfil = opts.pickup && f.fulfil === "pickup" ? "pickup" : "delivery";
  const delivered = fulfil === "delivery";
  const city = delivered && typeof f.city === "string" ? f.city : "";
  if (delivered && !isCity(city, opts.cities)) errors.push("city");
  const address = delivered ? cleanText(f.address, ORDER_LIMITS.address).replace(/\s+/g, " ").trim() : "";
  if (delivered && visible(address) < 3) errors.push("address");
  const note = cleanParagraph(f.note, ORDER_LIMITS.note).trim();
  const pay = (opts.pays ?? PAYMENTS).find((p) => p === f.pay);
  if (!pay) errors.push("pay");
  if (errors.length || !pay) return { ok: false, errors };
  return { ok: true, value: { customer: name, phone: mobile ? `+962${mobile}` : "", email, fulfil, city, address, note, pay } };
}

/* ============================== newsletter ============================== */

/** An email a visitor leaves: plain letters, digits and the usual signs, exactly as typed (only case and outer
    spaces change). Anything that would have to be cleaned to fit is refused rather than quietly changed. */
export function visitorEmail(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim();
  if (!t || t.length > ORDER_LIMITS.email) return "";
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(t) && !/\.\.|^\.|\.@|@-|-\./.test(t) ? t.toLowerCase() : "";
}
