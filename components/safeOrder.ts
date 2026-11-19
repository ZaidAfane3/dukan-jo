/* The rules for what a store visitor sends: the cart, the checkout form and the newsletter email.

   Visitors are strangers, so nothing they send is trusted: the cart only says which products and how many,
   and the prices, the stock and the total always come from the store's own catalog. Today the browser runs
   these rules; once Dukkan has a backend, the server must run the same functions on its own catalog before
   it saves an order. No React and no browser APIs in this file, so the server can import it as it is. */

import { isJordanMobile, jordanMobile } from "./phone";
import { cleanParagraph, cleanText, visibleLength } from "./safe";

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

/** The cities a merchant with his own courier delivers to, from the list he saved (the English names of KNOWN_CITIES, as
    the Delivery page and the setup save them), in both languages. Nothing saved (stores from before he could choose), or
    nothing left that is on the list: every city. */
export function ownCities(saved: unknown): { en: string[]; ar: string[] } {
  const picked = Array.isArray(saved) ? KNOWN_CITIES.en.map((_, i) => i).filter((i) => saved.includes(KNOWN_CITIES.en[i])) : [];
  const at = picked.length ? picked : KNOWN_CITIES.en.map((_, i) => i);
  return { en: at.map((i) => KNOWN_CITIES.en[i]), ar: at.map((i) => KNOWN_CITIES.ar[i]) };
}

/** A merchant's delivery cities as they are saved: the English names of KNOWN_CITIES he picked, each once, in the list's
    order (an empty list is not a choice: the pages ask for at least one) */
export const savedCities = (v: unknown): string[] => (Array.isArray(v) ? KNOWN_CITIES.en.filter((c) => v.includes(c)) : []);

/** The cities a store's checkout offers for delivery. With Dukkan Ship: the cities Ship serves, as Dukkan's staff set
    them in Diwan. With his own courier: the cities he chose on the Delivery page or in setup (`own`, see ownCities; none
    saved: every city). No choice made yet: none (home delivery is not offered, see storeDelivery). The checkout
    (Cart.tsx) and the server (server/storeOrders.ts) take the list from here, so they accept the same cities; the
    add-order form (Orders.tsx) takes every city when he has no choice yet (he types his own order). An order already
    placed keeps its city when he takes that city off later. */
export const deliveryCities = (mode: "own" | "seen" | null | undefined, ship: { en: readonly string[]; ar: readonly string[] }, own?: unknown): { en: readonly string[]; ar: readonly string[] } =>
  mode === "own" ? ownCities(own) : mode === "seen" ? ship : { en: [], ar: [] };

/** What a store's checkout offers for home delivery, the same on the page (Cart.tsx) and on the server
    (server/storeOrders.ts). null: he has not chosen how he delivers yet, so home delivery is not offered at all (only
    pickup when he offers it; neither: no order can be placed, the server answers "no-delivery"). Otherwise the cities
    (deliveryCities) and the fee per order: his own courier's fee as saved (none ever set: null, the store confirms it,
    never "Free"), or Dukkan Ship's price from Diwan. */
export function storeDelivery(
  mode: "own" | "seen" | null | undefined,
  ship: { price: number; cities: { en: readonly string[]; ar: readonly string[] } },
  own: { fee?: number; cities?: unknown } = {},
): { cities: { en: readonly string[]; ar: readonly string[] }; fee: number | null } | null {
  if (mode !== "own" && mode !== "seen") return null;
  return {
    cities: deliveryCities(mode, ship.cities, own.cities),
    fee: mode === "own" ? (typeof own.fee === "number" && Number.isFinite(own.fee) ? toFils(own.fee) : null) : toFils(ship.price),
  };
}

/** The delivery way a store's checkout goes by: the merchant's own choice. A store with no choice saved is one from before
    a choice was asked for (the setup and the Delivery page always save one; a store can no longer open with neither a
    choice nor pickup: readyToSell), and it delivered with Dukkan Ship then; it still does, so it keeps taking orders
    until he chooses. Turning pickup on does not take that away: his customers can then choose Dukkan Ship's delivery or
    pickup (the owner's decision), never pickup only. His dashboard and Diwan say it delivers with Dukkan Ship by default
    (ReadyToSell shipsByDefault, server/shops.ts SHIP_SQL). The public store (server/publicStore.ts), the order
    (server/storeOrders.ts) and his own preview all ask this, so the checkout offers what the server accepts. */
export const checkoutShipMode = (setup: { pickup?: boolean; shipping?: { mode?: "own" | "seen" | null } | null } | null | undefined): "own" | "seen" => {
  const mode = setup?.shipping?.mode;
  return mode === "own" ? "own" : "seen";
};

/** How the order can reach the customer at this store: delivery when storeDelivery offers it, pickup when he allows it.
    Neither: the store hasn't set up delivery, no order is taken. */
export const storeFulfils = (delivery: boolean, pickup: boolean): Fulfil[] => [...(delivery ? (["delivery"] as const) : []), ...(pickup ? (["pickup"] as const) : [])];

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

/** The ways to pay a merchant chose for his store, as saved in his setup (`pays`): only known ways, each once, in the
    checkout's order. Not saved (undefined: a store from before he could choose): undefined, every way Dukkan has on. An
    empty list (a new store that has not chosen yet) stays empty. */
export const savedPays = (v: unknown): Payment[] | undefined => (Array.isArray(v) ? PAYMENTS.filter((p) => v.includes(p)) : undefined);

/** The ways a store's customer can pay now, the same on the page (Cart.tsx) and on the server (server/storeOrders.ts):
    the ones Dukkan has on (Diwan, `dukkanOn`) that the merchant chose (`chosen`, see savedPays; not saved: all of
    Dukkan's). None: the store can't take orders. */
export const orderPays = (dukkanOn: readonly Payment[], chosen: readonly Payment[] | undefined): Payment[] =>
  PAYMENTS.filter((p) => dukkanOn.includes(p) && (chosen === undefined || chosen.includes(p)));

/** What a store still needs before it can sell: "pay" (no way to pay is on: orderPays is empty) and "delivery" (no way
    for customers to get their orders: pickup is off and there is no valid delivery choice). */
export type SellNeed = "pay" | "delivery";

/** The parts of a saved setup (setup.ts SavedSetup, safeAccount cleanSetup) that decide whether the store can sell */
type SellSetup = {
  pays?: readonly Payment[];
  pickup?: boolean;
  shipping?: { mode?: "own" | "seen" | null; name?: string; phone?: string; fee?: number; cities?: unknown } | null;
} | null | undefined;

/** Whether a store is ready to sell, the same on every page and on the server: at least one way to pay is on (his
    choice of the ways Dukkan has on in Diwan, orderPays; no choice saved: every way Dukkan has on), and customers have
    a way to get their orders: pickup on, or a delivery choice storeDelivery offers with at least one city (Dukkan Ship:
    a city Ship serves in Diwan; his own courier: the courier's name and Jordan mobile as the Delivery page asks, and his
    cities; the fee may be left for the store to confirm). A store that is not ready can't be made live (the designer's
    first save, the profile menu's open switch, app/api/store PUT "not-ready"); a live one is never taken offline by it,
    but he can't make a change that leaves it so. `platform`: what Diwan has on now (platformPublic storePays and
    shipCityLists on the pages; server/storeOrders.ts sellPlatform on the server). */
export function readyToSell(setup: SellSetup, platform: { pays: readonly Payment[]; shipCities: { en: readonly string[]; ar: readonly string[] } }): { ok: boolean; missing: SellNeed[] } {
  const missing: SellNeed[] = [];
  if (orderPays(platform.pays, setup?.pays ? savedPays(setup.pays) : undefined).length === 0) missing.push("pay");
  const ship = setup?.shipping;
  const offer = storeDelivery(ship?.mode, { price: 0, cities: platform.shipCities }, { fee: ship?.fee, cities: ship?.cities });
  const courierOk = ship?.mode !== "own" || (visibleLength(ship.name ?? "") >= 2 && isJordanMobile(ship.phone ?? ""));
  const delivers = !!offer && offer.cities.en.length > 0 && courierOk;
  if (setup?.pickup !== true && !delivers) missing.push("delivery");
  return { ok: missing.length === 0, missing };
}

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
    /* a size counts only for a product sold in sizes: any other product is one line whatever size is sent with it, so
       two lines of it with different sizes can't each take its whole stock */
    const size = id !== null && byId.get(id)?.sizes?.length ? sizeName(l?.size) : "";
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

export type CheckoutField = "name" | "phone" | "email" | "city" | "address" | "note" | "pay" | "fulfil";

/* the customer gives both (the owner's rule, for delivery and pickup and any way to pay): `phone` a Jordan mobile
   (+962…) and `email`. Older orders kept only one of them (the other is "") and still show. */
export type CheckoutValue = { customer: string; phone: string; email: string; fulfil: Fulfil; city: string; address: string; note: string; pay: Payment };

/** Checks the checkout form. Returns the cleaned order details, or the fields that are wrong. Every order needs a Jordan
    mobile (`phone`) and an email (`email`). The city and the address are asked only for delivery; "pickup" counts only
    when the store allows it (`pickup`); `delivery: false` (no delivery choice yet, see storeDelivery) refuses a
    delivered order ("fulfil"). `pays`: the ways to pay this store takes now (orderPays: Dukkan's and his own choice); one
    that is off is refused like one that does not exist. */
export function checkCheckout(f: Record<string, unknown>, opts: { pickup?: boolean; delivery?: boolean; pays?: readonly Payment[]; cities?: { en: readonly string[]; ar: readonly string[] } } = {}): { ok: true; value: CheckoutValue } | { ok: false; errors: CheckoutField[] } {
  const errors: CheckoutField[] = [];
  const name = cleanText(f.name, ORDER_LIMITS.name).replace(/\s+/g, " ").trim();
  if (visible(name) < 2) errors.push("name");
  const mobile = jordanMobile(typeof f.phone === "string" ? f.phone.trim() : "");
  if (!mobile) errors.push("phone");
  const email = visitorEmail(f.email);
  if (!email) errors.push("email");
  const fulfil: Fulfil = opts.pickup && f.fulfil === "pickup" ? "pickup" : "delivery";
  const delivered = fulfil === "delivery";
  const deliverable = delivered && opts.delivery !== false;
  if (delivered && !deliverable) errors.push("fulfil");
  const city = deliverable && typeof f.city === "string" ? f.city : "";
  if (deliverable && !isCity(city, opts.cities)) errors.push("city");
  const address = deliverable ? cleanText(f.address, ORDER_LIMITS.address).replace(/\s+/g, " ").trim() : "";
  if (deliverable && visible(address) < 3) errors.push("address");
  const note = cleanParagraph(f.note, ORDER_LIMITS.note).trim();
  const pay = (opts.pays ?? PAYMENTS).find((p) => p === f.pay);
  if (!pay) errors.push("pay");
  if (errors.length || !pay) return { ok: false, errors };
  return { ok: true, value: { customer: name, phone: `+962${mobile}`, email, fulfil, city, address, note, pay } };
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

/* ============================== stock taken by an order ============================== */

/** The saved products after an order took what it bought: each size bought leaves its own stock (and a product in
    sizes has all its sizes again as its stock), a product with a stock leaves what was bought, and a product with no
    limit stays as it is. Every other part of each product is kept exactly as saved. The merchant's preview (Cart.tsx)
    and the server (server/storeOrders.ts) both take stock with this. */
export function takeStock(list: unknown[], items: { id?: unknown; qty: number; size?: string }[], o: { online?: boolean } = {}): unknown[] {
  return list.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const id = productId((raw as Record<string, unknown>).id);
    const mine = items.filter((x) => id !== null && productId(x.id) === id);
    if (!mine.length) return raw;
    let p = raw as Record<string, unknown>;
    const sizes = productSizes(p);
    /* an order from the public store also counts, on the product, how many it sold online (per size): see SOLD_ONLINE */
    if (o.online) {
      const sold = { ...soldOnline(p.soldOnline) };
      /* a line with a quantity below zero gives stock back (an order cancelled: server/storeOrders.ts), and the count
         goes down with it; a count that reaches zero is left out */
      for (const x of mine) {
        const k = sizes.length ? sizeName(x.size) : "";
        const n = (sold[k] ?? 0) + x.qty;
        if (n > 0) sold[k] = n;
        else delete sold[k];
      }
      if (Object.keys(sold).length) p = { ...p, soldOnline: sold };
      else {
        /* nothing sold online any more: the product is as it was before its first online order */
        const { soldOnline: _none, ...rest } = p as Record<string, unknown>;
        p = rest as typeof p;
      }
    }
    if (sizes.length) {
      const left = sizes.map((z) => ({ ...z, quantity: Math.max(0, z.quantity - mine.filter((x) => x.size === z.name).reduce((n, x) => n + x.qty, 0)) }));
      /* the saved sizes keep anything else they carry; only their stock changes */
      const saved = Array.isArray(p.sizes) ? p.sizes : [];
      const sizesOut = saved.map((z) => {
        if (!z || typeof z !== "object") return z;
        const hit = left.find((l) => l.name === sizeName((z as { name?: unknown }).name));
        return hit ? { ...(z as Record<string, unknown>), quantity: hit.quantity } : z;
      });
      return { ...p, sizes: sizesOut, quantity: left.reduce((n, z) => n + z.quantity, 0) };
    }
    if (isUnlimited(p)) return p;
    return { ...p, quantity: Math.max(0, stock(p.quantity) - mine.reduce((n, x) => n + x.qty, 0)) };
  });
}

/** How many pieces each order line really takes out of the saved products (`took`): what it asks for, as far as the
    product (or its size) has them; none for a product with no limit, and none for a product or size that is not there.
    It is kept on each line of the order, so cancelling it gives back exactly that and nothing else (a product that had no
    limit when it was ordered gets nothing added, whatever it has now). `short`: a line that could not have all it asks
    for from a product that is still there (a product with no limit never is; one deleted for good has nothing to take). */
export function stockTaken<T extends { id?: unknown; qty: number; size?: string }>(list: unknown[], items: T[]): { lines: (T & { took: number })[]; short: T[] } {
  const byId = new Map<number, Record<string, unknown>>();
  for (const raw of list) {
    const id = raw && typeof raw === "object" && !Array.isArray(raw) ? productId((raw as Record<string, unknown>).id) : null;
    if (id !== null && !byId.has(id)) byId.set(id, raw as Record<string, unknown>);
  }
  /* what earlier lines of the same product (and size) already took */
  const used = new Map<string, number>();
  const short: T[] = [];
  const lines = items.map((it) => {
    const id = productId(it.id);
    const p = id === null ? undefined : byId.get(id);
    if (!p) return { ...it, took: 0 };
    const sizes = productSizes(p);
    if (!sizes.length && isUnlimited(p)) return { ...it, took: 0 };
    const k = `${id}|${sizes.length ? sizeName(it.size) : ""}`;
    const has = sizes.length ? sizes.find((z) => z.name === sizeName(it.size))?.quantity ?? 0 : stock(p.quantity);
    const took = Math.max(0, Math.min(it.qty, has - (used.get(k) ?? 0)));
    used.set(k, (used.get(k) ?? 0) + took);
    if (took < it.qty) short.push(it);
    return { ...it, took };
  });
  return { lines, short };
}

/** The lines of an order whose pieces can't go back to the saved stock when it is cancelled: the product is now sold in
    sizes and the line's size is no longer one of them (renamed or removed since), so nothing is added anywhere for it and
    the merchant is told instead. A product with no limit now needs nothing back; one deleted for good is gone. */
export function stockNotBack<T extends { id?: unknown; size?: string; took: number }>(list: unknown[], items: T[]): T[] {
  return items.filter((it) => {
    if (it.took <= 0) return false;
    const id = productId(it.id);
    const p = list.find((raw) => raw && typeof raw === "object" && !Array.isArray(raw) && productId((raw as Record<string, unknown>).id) === id) as Record<string, unknown> | undefined;
    const sizes = p ? productSizes(p) : [];
    return sizes.length > 0 && !sizes.some((z) => z.name === sizeName(it.size));
  });
}

/* ============================== stock sold on the public store ==============================
   SOLD_ONLINE: every product an order from the public store took stock from carries `soldOnline`, how many the store
   sold online, per size ("" for a product without sizes). The merchant's own copy of his products (in his browser)
   keeps that count as it was when his copy was made, so when he saves a copy older than some orders, the server sees
   by how much its count is behind and takes that many again from the copy (mergeSoldOnline): his save never puts back
   stock that was sold since, however old the screen he saved from, and a copy that already has them is kept as it is. */

/** A product's online sales as saved: size (or "") -> a whole count */
export function soldOnline(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    const key = k === "" ? "" : sizeName(k);
    if ((key || k === "") && typeof n === "number" && Number.isSafeInteger(n) && n > 0) out[key] = Math.min(n, 1_000_000_000);
  }
  return out;
}

/** The merchant's products as he saves them (`incoming`), with what the store sold online since his copy was made taken
    out of their stock, from the products as the server has them (`stored`). Every other part of his copy is kept. */
export function mergeSoldOnline(incoming: unknown[], stored: unknown[]): unknown[] {
  const server = new Map<number, Record<string, number>>();
  for (const s of stored) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const id = productId((s as Record<string, unknown>).id);
    const sold = soldOnline((s as Record<string, unknown>).soldOnline);
    /* every product the server has, also one with no online sales left (all of them cancelled since) */
    if (id !== null) server.set(id, sold);
  }
  if (!server.size) return incoming;
  return incoming.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const p = raw as Record<string, unknown>;
    const id = productId(p.id);
    const known = id !== null ? server.get(id) : undefined;
    if (!known) return p;
    const mine = soldOnline(p.soldOnline);
    /* the server's count is the one that holds. Where his copy is behind it (orders placed since), that many are taken
       again; where it is ahead of it (orders cancelled or refunded since, whose stock went back), that many are given
       back. Either way his copy ends on the server's count, so saving it again changes nothing more. */
    const sizes = Array.from(new Set([...Object.keys(known), ...Object.keys(mine)]));
    const diff = sizes.map((size) => ({ id, size: size || undefined, qty: (known[size] ?? 0) - (mine[size] ?? 0) })).filter((x) => x.qty !== 0);
    if (!diff.length) return p;
    const { soldOnline: _was, ...moved } = takeStock([p], diff)[0] as Record<string, unknown>;
    return Object.keys(known).length ? { ...moved, soldOnline: known } : moved;
  });
}
