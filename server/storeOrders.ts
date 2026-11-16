import type { PoolClient } from "pg";
import { STATUS_KEYS, type StatusKey } from "@/components/ordersContent";
import { checkCoupon, cleanCoupon, countCouponUse, mergeUsedOnline, money as recordMoney, parseList, type Coupon, type CouponRefusal } from "@/components/records";
import { safeStoredImage, SLUG_RULE } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import {
  checkCheckout, mergeSoldOnline, ORDER_LIMITS, priceCart, productId, productSizes, salePrice, sellableStock, takeStock, toFils, money,
  type CheckoutField, type Payment, type PricedLine, type Sellable,
} from "@/components/safeOrder";
import { seal } from "./crypto";
import { db } from "./db";
import { notify } from "./notify";
import { readSettings } from "./settings";

/* Orders customers place on a store's public page (app/[slug], POST /api/public/store/<slug>/orders), kept in
   store_orders so they reach the merchant (GET /api/orders) wherever he signs in.

   Nothing the customer's browser sends is trusted: it only says which products, how many of each, the size, the
   customer's details, the way to pay and a coupon code. Every price, the stock, the coupon, the delivery fee and the
   total are worked out here from the shop's own saved data, with the same rules the merchant's preview runs
   (components/safeOrder.ts, components/records.ts). No payment is taken yet: every order is saved as a test order
   (payment_status 'test') and the checkout tells the customer nothing is charged.

   Stock: the order takes what it bought out of the shop's saved products (and counts a coupon's use) in the same
   transaction that saves it, under a lock per shop, so two customers can't both buy the last piece. Each product it
   took from counts how many the store sold online (soldOnline) and each coupon its online uses (usedOnline). The
   merchant's browser keeps its own copy of the products and coupons and sends it back whole on every save
   (components/serverSync.ts); the counts in that copy say which orders it has seen, so a save from an older copy
   (another tab, a page left open) gets the orders it has not seen taken again (mergeOnlineSales below), and his save
   can't put back stock that was sold in the meantime.

   A checkout sends a key of its own (`attempt`) and keeps it until it is told the order is in: sent again (the answer
   was lost on the way), the order already saved for it is answered, and nothing is placed or taken twice. */

/* the per-shop lock shared by placing an order and the merchant's saves of his products and coupons (two int keys) */
export const shopLock = (q: { query: PoolClient["query"] }, accountId: string | number) =>
  q.query(`SELECT pg_advisory_xact_lock(71002, ($1::bigint % 2147483647)::int)`, [accountId]);

/* the keys whose saved copy an order changes */
export const ONLINE_KEYS = ["seen-products", "seen-coupons"] as const;
export type OnlineKey = (typeof ONLINE_KEYS)[number];

const parse = (v: string | undefined): unknown => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

type Shop = { account_id: string; slug: string; status: string; paused: boolean; published: boolean };

/** The shop at this link name, or null */
async function findShop(q: { query: PoolClient["query"] }, slug: unknown): Promise<Shop | null> {
  const name = String(slug ?? "").toLowerCase();
  if (!SLUG_RULE.test(name)) return null;
  const { rows } = await q.query(`SELECT account_id, slug, status, paused, published FROM shops WHERE lower(slug) = $1 LIMIT 1`, [name]);
  return (rows[0] as Shop | undefined) ?? null;
}

/* only an open store takes orders: not suspended by Dukkan, published, not paused by the merchant */
const isOpen = (s: Shop) => s.status !== "suspended" && s.published && !s.paused;

/** The products customers can buy (not in the bin, not hidden), as the cart prices them */
function catalogOf(products: unknown): { catalog: Sellable[]; images: Map<number, string> } {
  const list = Array.isArray(products) ? products.filter(isObj) : [];
  const catalog: Sellable[] = [];
  const images = new Map<number, string>();
  const seen = new Set<number>();
  for (const p of list) {
    if (p.deletedAt || p.hidden) continue;
    const id = productId(p.id);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    const price = money(p.price);
    const sizes = productSizes(p);
    catalog.push({ id, name: String(p.name ?? ""), price, sale: salePrice(price, p.sale), quantity: sellableStock(p), ...(sizes.length ? { sizes } : {}) });
    /* the picture the merchant sees on the order: a file's address only, never picture data kept inside the product */
    const img = Array.isArray(p.images) ? safeStoredImage(p.images[0]) : "";
    if (img && !img.startsWith("data:") && img.length <= 300) images.set(id, img);
  }
  return { catalog, images };
}

/** The ways to pay the store checkout offers now (Diwan's platform settings), as the cart names them */
function storePaysFrom(methods: Record<string, { on: boolean }>): Payment[] {
  return (["cliq", "cash", "card"] as const).filter((p) => methods[p === "cash" ? "cod" : p]?.on);
}

export type PlacedOrder = {
  number: number;
  items: PricedLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: string | null;
  fulfil: "delivery" | "pickup";
  pay: Payment;
};

/** What the cart works the delivery and the discount out from, as the store has them now: sent back with a "changed"
    answer, so a customer whose page has older ones (a new delivery fee, offer or coupon) sees the right total */
export type Terms = { fee: number; freeDelivery: { on: boolean; min: number }; coupon?: Coupon | null };

/* a coupon's terms for the cart: no name, note, dates or how often it was used */
const couponTerms = (c: Coupon): Coupon => ({ id: "x", type: c.type, name: "", code: c.code, kind: c.kind, value: c.value, minOrder: c.minOrder, start: "", end: "", limit: 0, validDays: 0, used: 0, active: true });

/* a checkout's own key: letters, digits and dashes (a random UUID in the cart) */
const ATTEMPT = /^[A-Za-z0-9-]{16,64}$/;

export type PlaceResult =
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "closed" } }
  | { status: 400; body: { result: "invalid"; fields: (CheckoutField | "lines")[] } }
  | { status: 409; body: { result: "changed"; items: PricedLine[]; total?: number; terms: Terms } }
  | { status: 409; body: { result: "coupon"; why: CouponRefusal } }
  | { status: 200; body: { result: "ok"; order: PlacedOrder } };

/** Runs fn in a transaction: on the client given (a caller's transaction, left open), else on a new one */
async function inTransaction<T>(client: PoolClient | undefined, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (client) return fn(client);
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Places a customer's order on the store at `slug`. `body`: { lines: [{ id, qty, size }], customer: { name, phone,
    city, address, note, fulfil, pay }, coupon?, expect?, attempt? } where `expect` is the total the customer was shown:
    when the store's prices or terms changed since, nothing is placed and the cart is answered again; `attempt` is the
    checkout's own key (see above). `client`: run inside that open transaction (for tests); otherwise the order has its
    own. */
export async function placeStoreOrder(slug: unknown, body: Record<string, unknown>, client?: PoolClient): Promise<PlaceResult> {
  const lines = Array.isArray(body.lines) ? body.lines : null;
  if (!lines || lines.length === 0 || lines.length > ORDER_LIMITS.lines) return { status: 400, body: { result: "invalid", fields: ["lines"] } };
  const customer = isObj(body.customer) ? body.customer : {};
  const couponCode = typeof body.coupon === "string" ? body.coupon.slice(0, 40) : "";
  const attempt = typeof body.attempt === "string" && ATTEMPT.test(body.attempt) ? body.attempt : null;
  const settings = await readSettings(["payment_methods", "dukkan_ship"] as const);

  return inTransaction(client, async (c) => {
    const found = await findShop(c, slug);
    if (!found) return { status: 404, body: { result: "none" } };
    /* one order at a time per shop: the stock read below is the stock this order takes from */
    await shopLock(c, found.account_id);
    /* read again under the lock: the merchant may have paused the store or Dukkan suspended it a moment ago */
    const shop = await findShop(c, slug);
    if (!shop) return { status: 404, body: { result: "none" } };
    const id = shop.account_id;
    /* this checkout's order is already in (its answer was lost): the same order again, whatever changed since */
    if (attempt) {
      const done = await c.query(
        `SELECT number, items, subtotal, discount, delivery_fee, total, coupon, fulfil, payment_method FROM store_orders WHERE account_id = $1 AND attempt_key = $2`,
        [id, attempt],
      );
      const o = done.rows[0];
      if (o) {
        const items = (Array.isArray(o.items) ? o.items : []).map((it: Record<string, unknown>) => ({ id: Number(it.id), name: String(it.name ?? ""), qty: Number(it.qty), price: Number(it.price), ...(typeof it.size === "string" && it.size ? { size: it.size } : {}) }));
        return { status: 200, body: { result: "ok", order: { number: Number(o.number), items, subtotal: Number(o.subtotal), discount: Number(o.discount), delivery: Number(o.delivery_fee), total: Number(o.total), coupon: o.coupon ?? null, fulfil: o.fulfil === "pickup" ? "pickup" : "delivery", pay: o.payment_method as Payment } } };
      }
    }
    if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };

    const keys = ["seen-setup", "seen-products", "seen-freedelivery", "seen-orders", ...(couponCode ? ["seen-coupons"] : [])];
    const saved = await c.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[]) FOR UPDATE`, [id, keys]);
    const data = new Map<string, string>(saved.rows.map((r: { key: string; value: string }) => [r.key, r.value]));

    /* the customer's details, checked with the same rules as the cart: a Jordan mobile or an email, a city Dukkan Ship
       delivers to, pickup only when the store offers it, and a way to pay that is on */
    const setup = cleanSetup(parse(data.get("seen-setup")));
    const ship = settings.dukkan_ship;
    const cities = { en: ship.cities.map((x) => x.en), ar: ship.cities.map((x) => x.ar) };
    const pays = storePaysFrom(settings.payment_methods as unknown as Record<string, { on: boolean }>);
    const checked = checkCheckout(customer, { pickup: setup?.pickup === true, pays, cities });
    if (!checked.ok) return { status: 400, body: { result: "invalid", fields: checked.errors } };

    /* delivery: free above the store's free delivery amount, for pickup and with a free delivery coupon; otherwise the
       merchant's own fee (his own courier) or Dukkan Ship's price from Diwan */
    const fd = parse(data.get("seen-freedelivery"));
    const fdMin = isObj(fd) ? recordMoney(fd.min) : null;
    const freeDelivery = { on: isObj(fd) && fd.on === true, min: fdMin !== null && fdMin > 0 ? fdMin : 25 };
    const fee = toFils(setup?.shipping?.mode === "own" ? setup.shipping.fee ?? 0 : ship.price);
    const terms: Terms = { fee, freeDelivery };

    /* every price and the stock from the shop's saved products, never from the customer's browser */
    const products = parse(data.get("seen-products"));
    const { catalog, images } = catalogOf(products);
    const priced = priceCart(lines as { id: unknown; qty: unknown; size?: unknown }[], catalog);
    if (priced.changed || priced.items.length === 0) return { status: 409, body: { result: "changed", items: priced.items, terms } };

    /* the coupon, checked against the shop's own coupons and this subtotal */
    let discount = 0;
    let freeByCoupon = false;
    let couponUsed: string | null = null;
    if (couponCode.trim()) {
      const coupons = parseList(data.get("seen-coupons") ?? null, cleanCoupon);
      const cp = checkCoupon(couponCode, coupons, priced.subtotal);
      if (!cp.ok) return { status: 409, body: { result: "coupon", why: cp.why } };
      discount = cp.discount;
      freeByCoupon = cp.freeDelivery;
      couponUsed = cp.coupon.code;
      terms.coupon = couponTerms(cp.coupon);
    } else terms.coupon = null;

    const v = checked.value;
    const delivery = (freeDelivery.on && priced.subtotal >= freeDelivery.min) || v.fulfil === "pickup" || freeByCoupon ? 0 : fee;
    const total = toFils(priced.subtotal - discount + delivery);
    /* the customer was shown another total (a price or the delivery changed since the page opened): he looks again */
    const expect = typeof body.expect === "number" && Number.isFinite(body.expect) ? body.expect : null;
    if (expect !== null && Math.abs(expect - total) > 0.0005) return { status: 409, body: { result: "changed", items: priced.items, total, terms } };

    /* the order number goes on from the shop's own orders (those he added by hand or from his preview) and its earlier
       store orders, so the merchant never sees two orders with one number */
    const own = parse(data.get("seen-orders"));
    const ownMax = Array.isArray(own) ? own.reduce((m: number, x) => (isObj(x) && typeof x.id === "number" && Number.isSafeInteger(x.id) && x.id < 1e9 ? Math.max(m, x.id) : m), 1000) : 1000;
    const last = await c.query(`SELECT COALESCE(MAX(number), 0) AS n FROM store_orders WHERE account_id = $1`, [id]);
    const number = Math.max(ownMax, Number(last.rows[0].n)) + 1;

    const items = priced.items.map((it) => ({ ...it, ...(images.has(it.id) ? { image: images.get(it.id) } : {}) }));
    await c.query(
      `INSERT INTO store_orders (account_id, number, items, subtotal, discount, delivery_fee, total, coupon, fulfil,
                                 customer_name, customer_phone, customer_email, city, address, notes, payment_method, payment_status, source, attempt_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'test', 'storefront', $17)`,
      [
        id, number, JSON.stringify(items), priced.subtotal, discount, delivery, total, couponUsed, v.fulfil,
        /* the customer's details are private: sealed, and opened again only for the shop's own owner (GET /api/orders) */
        seal(v.customer), v.phone ? seal(v.phone) : null, v.email ? seal(v.email) : null,
        v.city ? seal(v.city) : null, v.address ? seal(v.address) : null, v.note ? seal(v.note) : null, v.pay, attempt,
      ],
    );

    /* what was bought leaves the shop's saved stock, and the coupon counts one more use, in this same transaction; both
       are counted as online sales too (see above) */
    if (Array.isArray(products)) await writeKey(c, id, "seen-products", JSON.stringify(takeStock(products, items, { online: true })));
    if (couponUsed) {
      const list = parse(data.get("seen-coupons"));
      if (Array.isArray(list)) await writeKey(c, id, "seen-coupons", JSON.stringify(countCouponUse(list, couponUsed, { online: true })));
    }

    /* the merchant's bell: kept only if the order is */
    await notify(id, "orderPlaced", { number, total: total.toFixed(3), name: v.customer }, c);

    return { status: 200, body: { result: "ok", order: { number, items: priced.items, subtotal: priced.subtotal, discount, delivery, total, coupon: couponUsed, fulfil: v.fulfil, pay: v.pay } } };
  });
}

/* saves one key of the shop's data the way PUT /api/store does: sealed, with its plain length for the size limit */
async function writeKey(c: PoolClient, accountId: string, key: string, value: string) {
  await c.query(`UPDATE store_data SET value = $3, plain_len = $4, updated_at = now() WHERE account_id = $1 AND key = $2`, [accountId, key, seal(value), value.length]);
}

/** A coupon code a customer types on the store's page, checked against the shop's coupons (switched on, inside its
    dates, not used up). Its minimum order is not checked here: the cart checks it against the basket as it changes,
    and placing the order checks everything again. Answers what the cart needs to show the discount, or why not. */
export async function checkStoreCoupon(slug: unknown, code: unknown): Promise<{ status: 404 | 409 | 200; body: Record<string, unknown> }> {
  const pool = await db();
  const shop = await findShop(pool, slug);
  if (!shop) return { status: 404, body: { result: "none" } };
  if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };
  const { rows } = await pool.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-coupons'`, [shop.account_id]);
  const coupons = parseList((rows[0]?.value as string | undefined) ?? null, cleanCoupon);
  const cp = checkCoupon(code, coupons, Number.MAX_SAFE_INTEGER);
  if (!cp.ok) return { status: 200, body: { result: "refused", why: cp.why } };
  /* only the terms the cart works the discount out from */
  return { status: 200, body: { result: "ok", coupon: couponTerms(cp.coupon) } };
}

/* ---------------- the merchant's side ---------------- */

export type MerchantStoreOrder = {
  serverId: string;
  id: number;
  customer: string;
  phone: string;
  email?: string;
  total: number;
  status: StatusKey;
  items: { id?: number; name: string; qty: number; price: number; size?: string; image?: string }[];
  fulfil: "delivery" | "pickup";
  city?: string;
  address?: string;
  note?: string;
  pay: Payment;
  coupon?: { code: string; discount: number };
  delivery: number;
  created: number;
  payment: "test" | "unpaid";
};

/* one store order as the merchant's Orders page reads it */
function merchantRow(r: Record<string, any>): MerchantStoreOrder {
  return {
    serverId: String(r.id),
    id: Number(r.number),
    customer: String(r.customer_name ?? ""),
    phone: String(r.customer_phone ?? ""),
    ...(r.customer_email ? { email: String(r.customer_email) } : {}),
    total: Number(r.total),
    status: r.status as StatusKey,
    items: Array.isArray(r.items) ? r.items : [],
    fulfil: r.fulfil === "pickup" ? "pickup" : "delivery",
    ...(r.city ? { city: String(r.city) } : {}),
    ...(r.address ? { address: String(r.address) } : {}),
    ...(r.notes ? { note: String(r.notes) } : {}),
    pay: r.payment_method as Payment,
    ...(r.coupon ? { coupon: { code: String(r.coupon), discount: Number(r.discount) } } : {}),
    delivery: Number(r.delivery_fee),
    created: new Date(r.created_at).getTime(),
    payment: r.payment_status === "unpaid" ? "unpaid" : "test",
  };
}

const ROW = `id, number, created_at, status, items, subtotal, discount, delivery_fee, total, coupon, fulfil, customer_name, customer_phone,
             customer_email, city, address, notes, payment_method, payment_status`;

/** How many store orders the Orders page asks for at a time */
export const ORDERS_PAGE = 100;

/** The shop's store orders for its owner, newest first, a page at a time: the newest ORDERS_PAGE, or those older than
    the order `before` (its server id). `next`: what to ask for the page after, or null when there is none; `total`:
    how many store orders the shop has, so the page can say how many it has not loaded yet. The customer's details come
    opened (db() opens them). `q`: a client inside a transaction (tests), else the pool. */
export async function listStoreOrders(accountId: string, before: string | null = null, q?: { query: PoolClient["query"] }): Promise<{ orders: MerchantStoreOrder[]; next: string | null; total: number }> {
  const pool = q ?? (await db());
  const older = before && /^\d{1,18}$/.test(before) ? before : null;
  const { rows } = await pool.query(
    `SELECT ${ROW} FROM store_orders WHERE account_id = $1${older ? " AND id < $3" : ""} ORDER BY id DESC LIMIT $2`,
    older ? [accountId, ORDERS_PAGE + 1, older] : [accountId, ORDERS_PAGE + 1],
  );
  const more = rows.length > ORDERS_PAGE;
  const page = rows.slice(0, ORDERS_PAGE);
  const count = await pool.query(`SELECT count(*)::int AS n FROM store_orders WHERE account_id = $1`, [accountId]);
  return { orders: page.map(merchantRow), next: more ? String(page[page.length - 1].id) : null, total: Number(count.rows[0].n) };
}

/** One of the shop's store orders by its number (a link to an order that is not on the first page), or null */
export async function storeOrderByNumber(accountId: string, number: string, q?: { query: PoolClient["query"] }): Promise<MerchantStoreOrder | null> {
  if (!/^\d{1,9}$/.test(number)) return null;
  const { rows } = await (q ?? (await db())).query(`SELECT ${ROW} FROM store_orders WHERE account_id = $1 AND number = $2`, [accountId, number]);
  return rows[0] ? merchantRow(rows[0]) : null;
}

/** Changes the status of one of the shop's store orders. False when the shop has no such order. */
export async function setStoreOrderStatus(accountId: string, serverId: string, status: unknown): Promise<"ok" | "none" | "invalid"> {
  if (!/^\d{1,18}$/.test(serverId)) return "none";
  if (typeof status !== "string" || !STATUS_KEYS.includes(status as StatusKey)) return "invalid";
  const r = await (await db()).query(`UPDATE store_orders SET status = $3, updated_at = now() WHERE id = $1 AND account_id = $2`, [serverId, accountId, status]);
  return r.rowCount ? "ok" : "none";
}

/** The newest store order of the shop (0 for none): the merchant's browser keeps the number its copy of the products
    and coupons already includes (see mergeOnlineSales) */
export async function onlineRev(q: { query: PoolClient["query"] }, accountId: string): Promise<number> {
  const { rows } = await q.query(`SELECT COALESCE(MAX(id), 0) AS rev FROM store_orders WHERE account_id = $1`, [accountId]);
  return Number(rows[0].rev);
}

/** A merchant's save of his products or coupons: the online sales (or coupon uses) his copy has not seen yet are taken
    again from it, from the counts the copy carries and those of the copy the server has (safeOrder.ts mergeSoldOnline,
    records.ts mergeUsedOnline). Run under shopLock, inside the save's transaction. Gives the value to keep. A value that
    is not a list, or a key the server has no list for, is kept as it is. */
export async function mergeOnlineSales(c: { query: PoolClient["query"] }, accountId: string, key: OnlineKey, value: string): Promise<string> {
  const incoming = parse(value);
  if (!Array.isArray(incoming)) return value;
  const { rows } = await c.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = $2 FOR UPDATE`, [accountId, key]);
  const stored = parse(rows[0]?.value as string | undefined);
  if (!Array.isArray(stored)) return value;
  const merged = key === "seen-products" ? mergeSoldOnline(incoming, stored) : mergeUsedOnline(incoming, stored);
  const out = JSON.stringify(merged);
  /* nothing to take again: the value exactly as he sent it */
  return out === JSON.stringify(incoming) ? value : out;
}
