import type { PoolClient } from "pg";
import { STATUS_KEYS, type StatusKey } from "@/components/ordersContent";
import { checkCoupon, cleanCoupon, countCouponUse, money as recordMoney, parseList, type Coupon, type CouponRefusal } from "@/components/records";
import { safeStoredImage, SLUG_RULE } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import {
  checkCheckout, ORDER_LIMITS, priceCart, productId, productSizes, salePrice, sellableStock, takeStock, toFils, money,
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
   transaction that saves it, under a lock per shop, so two customers can't both buy the last piece. The merchant's
   browser keeps its own copy of those products and sends it back whole on every save (components/serverSync.ts); a
   save made from a copy older than some orders gets those orders taken again (mergeOnlineSales below), so his save
   can't put back stock that was sold in the meantime. */

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

export type PlaceResult =
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "closed" } }
  | { status: 400; body: { result: "invalid"; fields: (CheckoutField | "lines")[] } }
  | { status: 409; body: { result: "changed"; items: PricedLine[]; total?: number } }
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
    city, address, note, fulfil, pay }, coupon?, expect? } where `expect` is the total the customer was shown: when the
    store's prices changed since, nothing is placed and the cart is answered again. `client`: run inside that open
    transaction (for tests); otherwise the order has its own. */
export async function placeStoreOrder(slug: unknown, body: Record<string, unknown>, client?: PoolClient): Promise<PlaceResult> {
  const lines = Array.isArray(body.lines) ? body.lines : null;
  if (!lines || lines.length === 0 || lines.length > ORDER_LIMITS.lines) return { status: 400, body: { result: "invalid", fields: ["lines"] } };
  const customer = isObj(body.customer) ? body.customer : {};
  const couponCode = typeof body.coupon === "string" ? body.coupon.slice(0, 40) : "";
  const settings = await readSettings(["payment_methods", "dukkan_ship"] as const);

  return inTransaction(client, async (c) => {
    const found = await findShop(c, slug);
    if (!found) return { status: 404, body: { result: "none" } };
    /* one order at a time per shop: the stock read below is the stock this order takes from */
    await shopLock(c, found.account_id);
    /* read again under the lock: the merchant may have paused the store or Dukkan suspended it a moment ago */
    const shop = await findShop(c, slug);
    if (!shop || !isOpen(shop)) return { status: 409, body: { result: "closed" } };
    const id = shop.account_id;

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

    /* every price and the stock from the shop's saved products, never from the customer's browser */
    const products = parse(data.get("seen-products"));
    const { catalog, images } = catalogOf(products);
    const priced = priceCart(lines as { id: unknown; qty: unknown; size?: unknown }[], catalog);
    if (priced.changed || priced.items.length === 0) return { status: 409, body: { result: "changed", items: priced.items } };

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
    }

    /* delivery: free above the store's free delivery amount, for pickup and with a free delivery coupon; otherwise the
       merchant's own fee (his own courier) or Dukkan Ship's price from Diwan */
    const fd = parse(data.get("seen-freedelivery"));
    const fdMin = isObj(fd) ? recordMoney(fd.min) : null;
    const freeDelivery = { on: isObj(fd) && fd.on === true, min: fdMin !== null && fdMin > 0 ? fdMin : 25 };
    const fee = setup?.shipping?.mode === "own" ? setup.shipping.fee ?? 0 : ship.price;
    const v = checked.value;
    const delivery = (freeDelivery.on && priced.subtotal >= freeDelivery.min) || v.fulfil === "pickup" || freeByCoupon ? 0 : toFils(fee);
    const total = toFils(priced.subtotal - discount + delivery);
    /* the customer was shown another total (a price or the delivery changed since the page opened): he looks again */
    const expect = typeof body.expect === "number" && Number.isFinite(body.expect) ? body.expect : null;
    if (expect !== null && Math.abs(expect - total) > 0.0005) return { status: 409, body: { result: "changed", items: priced.items, total } };

    /* the order number goes on from the shop's own orders (those he added by hand or from his preview) and its earlier
       store orders, so the merchant never sees two orders with one number */
    const own = parse(data.get("seen-orders"));
    const ownMax = Array.isArray(own) ? own.reduce((m: number, x) => (isObj(x) && typeof x.id === "number" && Number.isSafeInteger(x.id) && x.id < 1e9 ? Math.max(m, x.id) : m), 1000) : 1000;
    const last = await c.query(`SELECT COALESCE(MAX(number), 0) AS n FROM store_orders WHERE account_id = $1`, [id]);
    const number = Math.max(ownMax, Number(last.rows[0].n)) + 1;

    const items = priced.items.map((it) => ({ ...it, ...(images.has(it.id) ? { image: images.get(it.id) } : {}) }));
    await c.query(
      `INSERT INTO store_orders (account_id, number, items, subtotal, discount, delivery_fee, total, coupon, fulfil,
                                 customer_name, customer_phone, customer_email, city, address, notes, payment_method, payment_status, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'test', 'storefront')`,
      [
        id, number, JSON.stringify(items), priced.subtotal, discount, delivery, total, couponUsed, v.fulfil,
        /* the customer's details are private: sealed, and opened again only for the shop's own owner (GET /api/orders) */
        seal(v.customer), v.phone ? seal(v.phone) : null, v.email ? seal(v.email) : null,
        v.city ? seal(v.city) : null, v.address ? seal(v.address) : null, v.note ? seal(v.note) : null, v.pay,
      ],
    );

    /* what was bought leaves the shop's saved stock, and the coupon counts one more use, in this same transaction */
    if (Array.isArray(products)) await writeKey(c, id, "seen-products", JSON.stringify(takeStock(products, items)));
    if (couponUsed) {
      const list = parse(data.get("seen-coupons"));
      if (Array.isArray(list)) await writeKey(c, id, "seen-coupons", JSON.stringify(countCouponUse(list, couponUsed)));
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
  const c = cp.coupon;
  /* only the terms the cart works the discount out from: no name, note, dates or how often it was used */
  const terms: Coupon = { id: "x", type: c.type, name: "", code: c.code, kind: c.kind, value: c.value, minOrder: c.minOrder, start: "", end: "", limit: 0, validDays: 0, used: 0, active: true };
  return { status: 200, body: { result: "ok", coupon: terms } };
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

/** The shop's store orders for its owner, newest first (at most 500), with the customer's details opened (db() opens them) */
export async function listStoreOrders(accountId: string): Promise<MerchantStoreOrder[]> {
  const { rows } = await (await db()).query(
    `SELECT id, number, created_at, status, items, subtotal, discount, delivery_fee, total, coupon, fulfil, customer_name, customer_phone,
            customer_email, city, address, notes, payment_method, payment_status
       FROM store_orders WHERE account_id = $1 ORDER BY id DESC LIMIT 500`,
    [accountId],
  );
  return rows.map((r) => ({
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
  }));
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

/** A merchant's save of his products or coupons, made from a copy that included the store orders up to `base` (the
    newest order his browser knew of): the orders placed since are taken again from it (their stock, their coupon
    uses), so his save does not put back what was sold in the meantime. Run under shopLock. Gives the value to keep and
    the newest order now. A value that is not a list is kept as it is. */
export async function mergeOnlineSales(c: { query: PoolClient["query"] }, accountId: string, key: OnlineKey, value: string, base: number): Promise<{ value: string; rev: number }> {
  const { rows } = await c.query(`SELECT id, items, coupon FROM store_orders WHERE account_id = $1 AND id > $2 AND stock_taken ORDER BY id`, [accountId, base]);
  const rev = await onlineRev(c, accountId);
  if (!rows.length) return { value, rev };
  const saved = parse(value);
  if (!Array.isArray(saved)) return { value, rev };
  let list: unknown[] = saved;
  for (const r of rows) {
    if (key === "seen-products") list = takeStock(list, Array.isArray(r.items) ? r.items : []);
    else if (r.coupon) list = countCouponUse(list, String(r.coupon));
  }
  return { value: JSON.stringify(list), rev };
}
