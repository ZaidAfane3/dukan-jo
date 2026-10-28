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

/** The cities a customer can choose. Anything else sent as a city is refused. */
export const CITIES = {
  ar: ["عمّان", "الزرقاء", "إربد", "السلط", "مادبا", "العقبة", "جرش", "عجلون", "المفرق", "الكرك", "الطفيلة", "معان"],
  en: ["Amman", "Zarqa", "Irbid", "Salt", "Madaba", "Aqaba", "Jerash", "Ajloun", "Mafraq", "Karak", "Tafilah", "Ma'an"],
};

/** How the order reaches the customer. Pickup is offered only when the store allows it. */
export const FULFILS = ["delivery", "pickup"] as const;
export type Fulfil = (typeof FULFILS)[number];

/** A city from the list (in either language). */
export const isCity = (s: unknown): s is string => typeof s === "string" && (CITIES.en.includes(s) || CITIES.ar.includes(s));

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

/** How many can be sold: the stock, or UNLIMITED_STOCK when it has no limit. */
export function sellableStock(p: { unlimited?: unknown; quantity?: unknown }): number {
  return isUnlimited(p) ? UNLIMITED_STOCK : stock(p.quantity);
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

export type Sellable = { id: number; name: string; price: number | null; sale: number | null; quantity: number };

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

export type PricedLine = { id: number; name: string; qty: number; price: number };

/** The cart rebuilt from the catalog: unknown, unsellable and sold out products are left out, quantities are cut to
    the stock, and every price is the catalog's. `changed` tells that what the visitor asked for could not all be kept,
    so he should look at his cart again before the order is placed. */
export function priceCart(lines: { id: unknown; qty: unknown }[], catalog: Sellable[]): { items: PricedLine[]; subtotal: number; changed: boolean } {
  const byId = new Map<number, Sellable>();
  for (const p of catalog) if (!byId.has(p.id)) byId.set(p.id, p);
  const wanted = new Map<number, number>();
  let changed = false;
  for (const l of Array.isArray(lines) ? lines : []) {
    const id = productId(l?.id);
    const q = typeof l?.qty === "number" && Number.isFinite(l.qty) ? Math.floor(l.qty) : 0;
    if (id === null || q <= 0) {
      changed = true;
      continue;
    }
    wanted.set(id, (wanted.get(id) ?? 0) + q);
  }
  const items: PricedLine[] = [];
  for (const [id, q] of Array.from(wanted)) {
    const p = byId.get(id);
    const price = p ? unitPrice(p) : null;
    const qty = p ? cartQty(q, p.quantity) : 0;
    if (!p || price === null || qty === 0 || items.length >= ORDER_LIMITS.lines) {
      changed = true;
      continue;
    }
    if (qty !== q) changed = true;
    items.push({ id, name: cleanText(p.name, 120), qty, price });
  }
  return { items, subtotal: toFils(items.reduce((s, it) => s + it.qty * it.price, 0)), changed };
}

/* ============================== checkout form ============================== */

/* Characters that take no space: they don't count as something written */
const INVISIBLE = /[\s\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g;
const visible = (s: string) => s.replace(INVISIBLE, "").length;

export type CheckoutField = "name" | "phone" | "city" | "address" | "note" | "pay";

export type CheckoutValue = { customer: string; phone: string; fulfil: Fulfil; city: string; address: string; note: string; pay: Payment };

/** Checks the checkout form. Returns the cleaned order details, or the fields that are wrong. The city and the
    address are asked only for delivery; "pickup" counts only when the store allows it (`pickup`). */
export function checkCheckout(f: Record<string, unknown>, opts: { pickup?: boolean } = {}): { ok: true; value: CheckoutValue } | { ok: false; errors: CheckoutField[] } {
  const errors: CheckoutField[] = [];
  const name = cleanText(f.name, ORDER_LIMITS.name).replace(/\s+/g, " ").trim();
  if (visible(name) < 2) errors.push("name");
  const mobile = typeof f.phone === "string" ? jordanMobile(f.phone) : "";
  if (!mobile) errors.push("phone");
  const fulfil: Fulfil = opts.pickup && f.fulfil === "pickup" ? "pickup" : "delivery";
  const delivered = fulfil === "delivery";
  const city = delivered && typeof f.city === "string" ? f.city : "";
  if (delivered && !isCity(city)) errors.push("city");
  const address = delivered ? cleanText(f.address, ORDER_LIMITS.address).replace(/\s+/g, " ").trim() : "";
  if (delivered && visible(address) < 3) errors.push("address");
  const note = cleanParagraph(f.note, ORDER_LIMITS.note).trim();
  const pay = PAYMENTS.find((p) => p === f.pay);
  if (!pay) errors.push("pay");
  if (errors.length || !pay) return { ok: false, errors };
  return { ok: true, value: { customer: name, phone: `+962${mobile}`, fulfil, city, address, note, pay } };
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
