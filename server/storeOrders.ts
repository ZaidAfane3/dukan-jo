import type { PoolClient } from "pg";
import { STATUS_KEYS, type StatusKey } from "@/components/ordersContent";
import { checkCoupon, cleanCoupon, countCouponUse, mergeUsedOnline, money as recordMoney, orderMatches, parseList, PRODUCT_MAX, type Coupon, type CouponRefusal } from "@/components/records";
import { cleanLine, safeStoredImage, SLUG_RULE } from "@/components/safe";
import { cleanSetup } from "@/components/safeAccount";
import {
  checkCheckout, checkoutShipMode, mergeSoldOnline, orderPays, storeDelivery, ORDER_LIMITS, priceCart, productId, productShips, productSizes, salePrice, sellableStock, stockNotBack, stockTaken, takeStock, toFils, money,
  type CheckoutField, type Payment, type PricedLine, type Sellable,
} from "@/components/safeOrder";
import { highestOrderNumber, lastOrderNumber, ORDER_NUMBER_KEY, ORDER_NUMBER_START } from "@/components/orderNumbers";
import { reserveTry } from "./auth";
import { plainDeep, plainText, seal } from "./crypto";
import { db } from "./db";
import { emailNotice, notify } from "./notify";
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

/** The products customers can buy (not in the bin, not hidden), as the cart prices them. `noShip`: the ones that are not
    delivered to an address (safeOrder productShips: a digital product, a service, or "Needs shipping" off). */
function catalogOf(products: unknown): { catalog: Sellable[]; images: Map<number, string>; noShip: Set<number> } {
  const list = Array.isArray(products) ? products.filter(isObj) : [];
  const catalog: Sellable[] = [];
  const images = new Map<number, string>();
  const noShip = new Set<number>();
  const seen = new Set<number>();
  for (const p of list) {
    if (p.deletedAt || p.hidden) continue;
    const id = productId(p.id);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    const price = money(p.price);
    const sizes = productSizes(p);
    catalog.push({ id, name: cleanLine(p.name, PRODUCT_MAX.name) || "—", price, sale: salePrice(price, p.sale), quantity: sellableStock(p), ...(sizes.length ? { sizes } : {}) });
    if (!productShips(p)) noShip.add(id);
    /* the picture the merchant sees on the order: a file's address only, never picture data kept inside the product */
    const img = Array.isArray(p.images) ? safeStoredImage(p.images[0]) : "";
    if (img && !img.startsWith("data:") && img.length <= 300) images.set(id, img);
  }
  return { catalog, images, noShip };
}

/** The ways to pay the store checkout offers now (Diwan's platform settings), as the cart names them */
export function storePaysFrom(methods: Record<string, { on: boolean }>): Payment[] {
  return (["cliq", "cash", "card"] as const).filter((p) => methods[p === "cash" ? "cod" : p]?.on);
}

/** What Diwan has on now that decides whether a store can sell (safeOrder readyToSell): the ways to pay and the cities
    Dukkan Ship serves. Read by the store save (app/api/store PUT, "not-ready") and Diwan's store page. */
export async function sellPlatform(): Promise<{ pays: Payment[]; shipCities: { en: string[]; ar: string[] } }> {
  const s = await readSettings(["payment_methods", "dukkan_ship"] as const);
  return {
    pays: storePaysFrom(s.payment_methods as unknown as Record<string, { on: boolean }>),
    shipCities: { en: s.dukkan_ship.cities.map((x) => x.en), ar: s.dukkan_ship.cities.map((x) => x.ar) },
  };
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
  /* delivered by his own courier with no fee set: none is in the total and the receipt says the store confirms it (never
     "Free"). Left out on an order sent again after its answer was lost (the cart then keeps what it showed). */
  feeOpen?: boolean;
  /* a big order (more than BIG_ORDER_ITEMS pieces): it waits for the store to confirm it ("review"), its stock held */
  review?: boolean;
};

/** An order with more pieces than this waits for the merchant to confirm it: it is placed as "review" (Awaiting review),
    its stock is taken (held) as for any order, and goes back if he cancels it (cancelling gives stock back). */
export const BIG_ORDER_ITEMS = 7;

/** What the cart works the delivery and the discount out from, as the store has them now: sent back with a "changed"
    answer, so a customer whose page has older ones (a new delivery fee, offer or coupon) sees the right total */
/* `fee` null: his own courier and no fee was ever set: the checkout says the store confirms it, and the total has none */
export type Terms = { fee: number | null; freeDelivery: { on: boolean; min: number }; coupon?: Coupon | null };

/* a coupon's terms for the cart: no name, note, dates or how often it was used */
const couponTerms = (c: Coupon): Coupon => ({ id: "x", type: c.type, name: "", code: c.code, kind: c.kind, value: c.value, minOrder: c.minOrder, start: "", end: "", limit: 0, validDays: 0, used: 0, active: true });

/* a checkout's own key: letters, digits and dashes (a random UUID in the cart) */
const ATTEMPT = /^[A-Za-z0-9-]{16,64}$/;

/** The store's delivery cities (null: no home delivery), pickup and ways to pay now, sent with a refusal so the cart can offer them */
export type StoreChoices = { cities: { en: readonly string[]; ar: readonly string[] } | null; pickup: boolean; pays: Payment[] };

export type PlaceResult =
  | { status: 404; body: { result: "none" } }
  | { status: 409; body: { result: "closed" } }
  | { status: 400; body: { result: "invalid"; fields: (CheckoutField | "lines")[]; choices?: StoreChoices } }
  | { status: 409; body: { result: "no-delivery"; pickup: boolean; choices: StoreChoices } }
  | { status: 409; body: { result: "changed"; items: PricedLine[]; total?: number; terms: Terms } }
  | { status: 409; body: { result: "coupon"; why: CouponRefusal } }
  | { status: 200; body: { result: "ok"; order: PlacedOrder } };

/** The order a checkout's key placed at this store, as the checkout shows it, or null */
async function orderByAttempt(c: PoolClient, account: string, key: string): Promise<PlacedOrder | null> {
  const done = await c.query(
    `SELECT number, items, subtotal, discount, delivery_fee, total, coupon, fulfil, payment_method, status FROM store_orders WHERE account_id = $1 AND attempt_key = $2`,
    [account, key],
  );
  const o = done.rows[0];
  if (!o) return null;
  const items = (Array.isArray(o.items) ? o.items : []).map((it: Record<string, unknown>) => ({ id: Number(it.id), name: String(it.name ?? ""), qty: Number(it.qty), price: Number(it.price), ...(typeof it.size === "string" && it.size ? { size: it.size } : {}) }));
  return { number: Number(o.number), items, subtotal: Number(o.subtotal), discount: Number(o.discount), delivery: Number(o.delivery_fee), total: Number(o.total), coupon: o.coupon ?? null, fulfil: o.fulfil === "pickup" ? "pickup" : "delivery", pay: o.payment_method as Payment, ...(o.status === "review" ? { review: true } : {}) };
}

/** Whether the order a checkout's key was sent with got in (a page reloaded while it was on its way: Cart keptAttempt).
    Only reads: nothing is placed. */
export async function findStoreAttempt(slug: unknown, key: unknown): Promise<{ status: 200; body: { result: "ok"; order: PlacedOrder } | { result: "not-placed" } } | { status: 400 | 404; body: { result: "invalid" | "none" } }> {
  if (typeof key !== "string" || !ATTEMPT.test(key)) return { status: 400, body: { result: "invalid" } };
  const c = await (await db()).connect();
  try {
    const shop = await findShop(c, slug);
    if (!shop) return { status: 404, body: { result: "none" } };
    const o = await orderByAttempt(c, shop.account_id, key);
    return { status: 200, body: o ? { result: "ok", order: o } : { result: "not-placed" } };
  } finally {
    c.release();
  }
}

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
  /* the key of an order that was on its way when the page was reloaded (Cart keptAttempt). The basket may have changed
     since (the stock it took makes the reloaded page cut it), so this send has a new key: if that earlier order got in,
     it is the answer, never a second order */
  const previous = typeof body.previous === "string" && ATTEMPT.test(body.previous) && body.previous !== attempt ? body.previous : null;
  const settings = await readSettings(["payment_methods", "dukkan_ship"] as const);

  /* the owner's email about the order: sent once the order is committed (on a caller's client, the caller's COMMIT
     comes later, so no email from here) */
  const after: { notice?: () => void } = {};
  const placed = await inTransaction(client, async (c): Promise<PlaceResult> => {
    const found = await findShop(c, slug);
    if (!found) return { status: 404, body: { result: "none" } };
    /* one order at a time per shop: the stock read below is the stock this order takes from */
    await shopLock(c, found.account_id);
    /* read again under the lock: the merchant may have paused the store or Dukkan suspended it a moment ago */
    const shop = await findShop(c, slug);
    if (!shop) return { status: 404, body: { result: "none" } };
    const id = shop.account_id;
    /* this checkout's order is already in (its answer was lost): the same order again, whatever changed since */
    for (const key of [attempt, previous]) {
      const o = key ? await orderByAttempt(c, id, key) : null;
      if (o) return { status: 200, body: { result: "ok", order: o } };
    }
    if (!isOpen(shop)) return { status: 409, body: { result: "closed" } };

    const keys = ["seen-setup", "seen-products", "seen-freedelivery", "seen-orders", ORDER_NUMBER_KEY, ...(couponCode ? ["seen-coupons"] : [])];
    const saved = await c.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[]) FOR UPDATE`, [id, keys]);
    const data = new Map<string, string>(saved.rows.map((r: { key: string; value: string }) => [r.key, r.value]));

    /* the customer's details, checked with the same rules as the cart: a Jordan mobile and an email, a city the store
       delivers to (storeDelivery), pickup only when the store offers it, and a way to pay that Dukkan has on and he
       chose (orderPays) */
    const setup = cleanSetup(parse(data.get("seen-setup")));
    const ship = settings.dukkan_ship;
    /* no delivery choice saved (a store from before one was asked for): Dukkan Ship, as it did then (checkoutShipMode) */
    const offer = storeDelivery(checkoutShipMode(setup), { price: ship.price, cities: { en: ship.cities.map((x) => x.en), ar: ship.cities.map((x) => x.ar) } }, setup?.shipping ?? {});
    const pickup = setup?.pickup === true;
    const pays = orderPays(storePaysFrom(settings.payment_methods as unknown as Record<string, { on: boolean }>), setup?.pays);
    /* the store's choices as they are now, sent with a refusal: he may have changed his cities, delivery, pickup or ways
       to pay while the customer had the page open, so the cart offers these instead and the next try can go through
       (cities null: no home delivery) */
    const choices = { cities: offer ? offer.cities : null, pickup, pays };
    /* every price and the stock from the shop's saved products, never from the customer's browser */
    const products = parse(data.get("seen-products"));
    const { catalog, images, noShip } = catalogOf(products);
    /* a cart of only products that are not delivered (codes, gift cards, services: safeOrder productShips) has no
       delivery: no fee, no city or address, and no delivery choice needed. One product that ships: as usual. */
    const ships = (lines as { id?: unknown }[]).some((l) => {
      const pid = productId(l?.id);
      return pid === null || !noShip.has(pid);
    });
    if (ships && !offer && !(pickup && customer.fulfil === "pickup")) return { status: 409, body: { result: "no-delivery", pickup, choices } };
    const checked = checkCheckout(customer, { pickup, delivery: !!offer, pays, cities: offer?.cities, ships });
    if (!checked.ok) return { status: 400, body: { result: "invalid", fields: checked.errors, ...(checked.errors.some((f) => f === "city" || f === "pay" || f === "fulfil") ? { choices } : {}) } };

    /* delivery: free above the store's free delivery amount, for pickup and with a free delivery coupon; otherwise the
       merchant's own fee (his own courier) or Dukkan Ship's price from Diwan */
    const fd = parse(data.get("seen-freedelivery"));
    const fdMin = isObj(fd) ? recordMoney(fd.min) : null;
    const freeDelivery = { on: isObj(fd) && fd.on === true, min: fdMin !== null && fdMin > 0 ? fdMin : 25 };
    /* his own courier with no fee ever set (setup leaves it out): no fee is charged and the checkout says the store
       confirms it, never "Free"; a fee he set (0 included) is charged as set */
    /* (sent as the store has it also with a cart that is not delivered: the cart charges it only when something ships) */
    const fee = offer ? offer.fee : 0;
    const terms: Terms = { fee, freeDelivery };

    const priced = priceCart(lines as { id: unknown; qty: unknown; size?: unknown }[], catalog);
    if (priced.changed || priced.items.length === 0) return { status: 409, body: { result: "changed", items: priced.items, terms } };

    /* the coupon, checked against the shop's own coupons and this subtotal */
    let discount = 0;
    let freeByCoupon = false;
    let couponUsed: string | null = null;
    if (couponCode.trim()) {
      const coupons = parseList(data.get("seen-coupons") ?? null, cleanCoupon);
      const cp = checkCoupon(couponCode, coupons, priced.subtotal);
      if (!cp.ok) return { status: 409, body: { result: "coupon", why: publicRefusal(cp.why) } };
      discount = cp.discount;
      freeByCoupon = cp.freeDelivery;
      couponUsed = cp.coupon.code;
      terms.coupon = couponTerms(cp.coupon);
    } else terms.coupon = null;

    const v = checked.value;
    const delivery = !ships || (freeDelivery.on && priced.subtotal >= freeDelivery.min) || v.fulfil === "pickup" || freeByCoupon ? 0 : fee ?? 0;
    const total = toFils(priced.subtotal - discount + delivery);
    /* the customer was shown another total (a price or the delivery changed since the page opened): he looks again */
    const expect = typeof body.expect === "number" && Number.isFinite(body.expect) ? body.expect : null;
    if (expect !== null && Math.abs(expect - total) > 0.0005) return { status: 409, body: { result: "changed", items: priced.items, total, terms } };

    /* the order number goes on from the last number the shop ever gave (components/orderNumbers.ts: never lowered by a
       deletion), the shop's own orders (those he added by hand or from his preview) and its earlier store orders, so the
       merchant never sees two orders with one number, and the last number is raised with it */
    const own = parse(data.get("seen-orders"));
    const last = await c.query(`SELECT COALESCE(MAX(number), 0) AS n FROM store_orders WHERE account_id = $1`, [id]);
    const number = Math.max(ORDER_NUMBER_START, lastOrderNumber(parse(data.get(ORDER_NUMBER_KEY))), Array.isArray(own) ? highestOrderNumber(own) : 0, Number(last.rows[0].n)) + 1;

    /* each line keeps how many pieces it really took out of the stock (none from a product with no limit), so a cancel
       gives back exactly that (setStoreOrderStatus) */
    const items = stockTaken(Array.isArray(products) ? products : [], priced.items.map((it) => ({ ...it, ...(images.has(it.id) ? { image: images.get(it.id) } : {}) }))).lines;
    /* who takes it to the customer, kept as it is now (the merchant may change his delivery later): the same rule as the
       fee above (checkoutShipMode), so an order charged Dukkan Ship's price is one Dukkan Ship delivers (Diwan > Dukkan
       Ship > Orders) */
    /* who takes it to the customer; nothing to deliver (A2: only codes, services...): nobody, so it never reaches
       Dukkan Ship's To deliver list */
    const big = items.reduce((n, it) => n + Number(it.qty || 0), 0) > BIG_ORDER_ITEMS;
    const shipBy = !ships ? "none" : v.fulfil === "pickup" ? "pickup" : checkoutShipMode(setup) === "own" ? "own" : "dukkan";
    await c.query(
      `INSERT INTO store_orders (account_id, number, items, subtotal, discount, delivery_fee, total, coupon, fulfil,
                                 customer_name, customer_phone, customer_email, city, address, notes, payment_method, payment_status, source, attempt_key, ship_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'test', 'storefront', $17, $18, $19)`,
      [
        /* the lines (product names, sizes) and the coupon code are the shop's own words, kept unsealed: made safe first */
        id, number, JSON.stringify(plainDeep(items)), priced.subtotal, discount, delivery, total, plainText(couponUsed), v.fulfil,
        /* the customer's details are private: sealed, and opened again only for the shop's own owner (GET /api/orders) */
        seal(v.customer), v.phone ? seal(v.phone) : null, v.email ? seal(v.email) : null,
        v.city ? seal(v.city) : null, v.address ? seal(v.address) : null, v.note ? seal(v.note) : null, v.pay, attempt, shipBy, big ? "review" : "pending",
      ],
    );

    /* what was bought leaves the shop's saved stock, and the coupon counts one more use, in this same transaction; both
       are counted as online sales too (see above) */
    if (Array.isArray(products)) await writeKey(c, id, "seen-products", JSON.stringify(takeStock(products, items.map((it) => ({ ...it, qty: it.took })), { online: true })));
    if (couponUsed) {
      const list = parse(data.get("seen-coupons"));
      if (Array.isArray(list)) await writeKey(c, id, "seen-coupons", JSON.stringify(countCouponUse(list, couponUsed, { online: true })));
    }

    await c.query(
      `INSERT INTO store_data (account_id, key, value, plain_len) VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value, plain_len = EXCLUDED.plain_len, updated_at = now()`,
      [id, ORDER_NUMBER_KEY, seal(String(number)), String(number).length],
    );

    /* the merchant's bell: kept only if the order is */
    await notify(id, "orderPlaced", { number, total: total.toFixed(3), name: v.customer }, c);
    after.notice = () => emailNotice(id, "orderPlaced", { number, total: total.toFixed(3) });

    const feeOpen = ships && fee === null && delivery === 0 && v.fulfil === "delivery" && !freeByCoupon && !(freeDelivery.on && priced.subtotal >= freeDelivery.min);
    return { status: 200, body: { result: "ok", order: { number, items: priced.items, subtotal: priced.subtotal, discount, delivery, total, coupon: couponUsed, fulfil: v.fulfil, pay: v.pay, feeOpen, ...(big ? { review: true } : {}) } } };
  });
  if (!client && placed.status === 200) after.notice?.();
  return placed;
}

/* saves one key of the shop's data the way PUT /api/store does: sealed, with its plain length for the size limit */
async function writeKey(c: PoolClient, accountId: string, key: string, value: string) {
  await c.query(`UPDATE store_data SET value = $3, plain_len = $4, updated_at = now() WHERE account_id = $1 AND key = $2`, [accountId, key, seal(value), value.length]);
}

/** Why a code is refused, as a customer may be told: a code that does not exist, is paused, not started, ended or
    used up all answer "unknown", so trying codes can't find which ones are real. Only "min" stays apart: the cart
    needs it, and it comes only after a code that works. */
function publicRefusal(why: CouponRefusal): CouponRefusal {
  return why === "min" ? "min" : "unknown";
}

/* Wrong coupon codes per store, from every visitor together: many addresses can't share out the guessing. Both places
   that tell whether a code exists draw on this one allowance: the cart's coupon box (app/api/public/store/<slug>/coupon)
   and placing an order with a code (…/orders). */
export const COUPON_GUESSES = { max: 300, minutes: 15 };
/** Takes one try of the store's allowance for wrong coupon codes, before the code is checked: null when it is used up
    (answer "slow-down"), else the function to call when the code turned out not to be a wrong one (the try is given
    back) */
export const reserveCouponGuess = (slug: unknown) =>
  reserveTry(`store-coupon-shop:${String(slug ?? "").toLowerCase().slice(0, 64)}`, COUPON_GUESSES.max, COUPON_GUESSES.minutes);

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
  if (!cp.ok) return { status: 200, body: { result: "refused", why: publicRefusal(cp.why) } };
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
  /* "paid": a cash order marked delivered; "test": nothing paid yet (cash still to come, or card/CliQ: nothing charged) */
  payment: "test" | "unpaid" | "paid";
  /* only on an order Dukkan Ship delivers: where its delivery is (staff mark it in Diwan), why not delivered, and when */
  ship?: { state: ShipState; note?: string; at?: number };
};

export type ShipState = "waiting" | "delivered" | "failed";
const SHIP_STATES: ShipState[] = ["waiting", "delivered", "failed"];

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
    /* worked out from the status and the way to pay, so a cash order delivered before 'paid' was kept reads paid too */
    payment: r.payment_method === "cash" && r.status === "delivered" ? "paid" : r.payment_status === "unpaid" ? "unpaid" : "test",
    ...(r.ship_by === "dukkan"
      ? { ship: { state: (SHIP_STATES.includes(r.ship_state) ? r.ship_state : "waiting") as ShipState, ...(r.ship_state === "failed" && r.ship_note ? { note: String(r.ship_note) } : {}), ...(r.ship_at ? { at: new Date(r.ship_at).getTime() } : {}) } }
      : {}),
  };
}

const ROW = `id, number, created_at, status, items, subtotal, discount, delivery_fee, total, coupon, fulfil, customer_name, customer_phone,
             customer_email, city, address, notes, payment_method, payment_status, ship_by, ship_state, ship_note, ship_at`;

/** How many store orders the Orders page asks for at a time */
export const ORDERS_PAGE = 100;

/** The shop's store orders for its owner, newest first, a page at a time: the newest ORDERS_PAGE, or those older than
    the order `before` (its server id). `next`: what to ask for the page after, or null when there is none; `total`:
    how many store orders the shop has, so the page can say how many it has not loaded yet. The customer's details come
    opened (db() opens them). `q`: a client inside a transaction (tests), else the pool. */
export async function listStoreOrders(accountId: string, before: string | null = null, q?: { query: PoolClient["query"] }): Promise<{ orders: MerchantStoreOrder[]; next: string | null; total?: number }> {
  const pool = q ?? (await db());
  const older = before && /^\d{1,18}$/.test(before) ? before : null;
  const { rows } = await pool.query(
    `SELECT ${ROW} FROM store_orders WHERE account_id = $1${older ? " AND id < $3" : ""} ORDER BY id DESC LIMIT $2`,
    older ? [accountId, ORDERS_PAGE + 1, older] : [accountId, ORDERS_PAGE + 1],
  );
  const more = rows.length > ORDERS_PAGE;
  const page = rows.slice(0, ORDERS_PAGE);
  /* the total only with the first page (later pages leave it out, and the page keeps the one it has) */
  const total = older ? undefined : Number((await pool.query(`SELECT count(*)::int AS n FROM store_orders WHERE account_id = $1`, [accountId])).rows[0].n);
  return { orders: page.map(merchantRow), next: more ? String(page[page.length - 1].id) : null, total };
}

/** Every store order of the shop at once, newest first, at most `max`: one query (the home page and Reports count them all) */
export async function allStoreOrders(accountId: string, max = 10_000): Promise<MerchantStoreOrder[]> {
  const { rows } = await (await db()).query(`SELECT ${ROW} FROM store_orders WHERE account_id = $1 ORDER BY id DESC LIMIT $2`, [accountId, max]);
  return rows.map(merchantRow);
}

/** How many store orders the shop has in each status (the Orders page counts every order, not only the pages loaded) */
export async function storeOrderCounts(accountId: string, q?: { query: PoolClient["query"] }): Promise<Record<string, number>> {
  const { rows } = await (q ?? (await db())).query(`SELECT status, count(*)::int AS n FROM store_orders WHERE account_id = $1 GROUP BY status`, [accountId]);
  return Object.fromEntries(rows.map((r: { status: string; n: number }) => [r.status, Number(r.n)]));
}

/** The shop's store orders that match a search (records.ts orderMatches: number, name, phone, email) and/or are in one
    status, newest first, at most ORDERS_PAGE: the Orders page asks for them when it has not loaded every order. The
    customer's details are sealed, so they are matched here after they are opened, over the shop's newest 5,000. */
export async function findStoreOrders(accountId: string, query: string, status: string | null, q?: { query: PoolClient["query"] }): Promise<MerchantStoreOrder[]> {
  const st = status && STATUS_KEYS.includes(status as StatusKey) ? status : null;
  const text = query.trim().slice(0, 60);
  const { rows } = await (q ?? (await db())).query(
    `SELECT ${ROW} FROM store_orders WHERE account_id = $1${st ? " AND status = $3" : ""} ORDER BY id DESC LIMIT $2`,
    st ? [accountId, text ? 5000 : ORDERS_PAGE, st] : [accountId, text ? 5000 : ORDERS_PAGE],
  );
  return rows.map(merchantRow).filter((x: MerchantStoreOrder) => orderMatches(x, text)).slice(0, ORDERS_PAGE);
}

/** One of the shop's store orders by its number (a link to an order that is not on the first page), or null */
export async function storeOrderByNumber(accountId: string, number: string, q?: { query: PoolClient["query"] }): Promise<MerchantStoreOrder | null> {
  if (!/^\d{1,9}$/.test(number)) return null;
  const { rows } = await (q ?? (await db())).query(`SELECT ${ROW} FROM store_orders WHERE account_id = $1 AND number = $2`, [accountId, number]);
  return rows[0] ? merchantRow(rows[0]) : null;
}

/* a cash order is paid once it is delivered (the courier took the cash, or the customer paid at pickup): marked 'paid'
   with the status, and back to 'test' when the status changes again (his undo included). Card and CliQ stay 'test'. */
/** The SET part that keeps payment_status with a new status `p` (the query's parameter holding it): a cash order that is
    delivered is paid; one that leaves delivered is not paid any more. Diwan's Dukkan Ship marks (server/shipOrders.ts) use it too. */
export const paidSet = (p: string) => `payment_status = CASE WHEN payment_method = 'cash' AND ${p}::text = 'delivered' THEN 'paid'
                                        WHEN payment_status = 'paid' THEN 'test' ELSE payment_status END`;
const PAID_SET = paidSet("$3");

/* an order holds the stock it took, unless it is cancelled or refunded */
const holdsStock = (status: string) => status !== "cancelled" && status !== "refunded";

/** A line of an order, as the merchant is told about it (a product short of stock, or pieces that could not go back) */
export type StockLine = { name: string; qty: number; size?: string };

export type StatusResult =
  | { result: "ok"; notBack: StockLine[] }
  | { result: "none" | "invalid" | "changed" }
  | { result: "no-stock"; short: StockLine[] };

/** Changes the status of one of the shop's store orders. "none" when the shop has no such order.
    `from` (optional): the status the order must still have, or nothing changes ("changed"). The Orders page sends it
    with every change, so a change (or an undo) never overwrites one made since (another tab, another device).
    Stock: an order took its products out of the shop's stock when it was placed, and each line keeps how many it really
    took (`took`, safeOrder stockTaken). Cancelling or refunding it gives back exactly that (and takes it off the
    products' online sales count); a size renamed or removed since can't take it back, so nothing is added anywhere and
    the answer names those lines (`notBack`) for the merchant to put right by hand. Moving it out of cancelled or refunded
    again (an undo, a mistake put right) takes the stock again, and is refused ("no-stock", nothing changes) when a
    product still in the shop no longer has enough (per size) for it. The coupon it used gives its use back and counts it
    again the same way (records.ts countCouponUse). Done in one transaction with the status, under the shop's order lock,
    so a customer's order placed at the same moment sees the stock either before or after it, never half. */
export async function setStoreOrderStatus(accountId: string, serverId: string, status: unknown, from?: unknown): Promise<StatusResult> {
  if (!/^\d{1,18}$/.test(serverId)) return { result: "none" };
  if (typeof status !== "string" || !STATUS_KEYS.includes(status as StatusKey)) return { result: "invalid" };
  if (from !== undefined && (typeof from !== "string" || !STATUS_KEYS.includes(from as StatusKey))) return { result: "invalid" };
  return inTransaction(undefined, async (c): Promise<StatusResult> => {
    await shopLock(c, accountId);
    const cur = await c.query(`SELECT status, items, coupon FROM store_orders WHERE id = $1 AND account_id = $2 FOR UPDATE`, [serverId, accountId]);
    const o = cur.rows[0] as { status: string; items: unknown; coupon: string | null } | undefined;
    if (!o) return { result: "none" };
    if (from !== undefined && o.status !== from) return { result: "changed" };
    const held = holdsStock(o.status);
    const holds = holdsStock(status);
    let notBack: StockLine[] = [];
    if (held !== holds) {
      const items = Array.isArray(o.items) ? o.items : [];
      const lines = items.flatMap((it: unknown, at: number) => {
        if (!isObj(it)) return [];
        const qty = typeof it.qty === "number" && Number.isSafeInteger(it.qty) && it.qty > 0 ? it.qty : 0;
        /* an order placed before lines kept what they took: what it asked for (the stock it took then) */
        const took = typeof it.took === "number" && Number.isSafeInteger(it.took) && it.took >= 0 ? Math.min(it.took, qty) : qty;
        return qty > 0 ? [{ at, id: it.id, name: String(it.name ?? ""), qty, took, ...(typeof it.size === "string" && it.size ? { size: it.size } : {}) }] : [];
      });
      const saved = await c.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-products' FOR UPDATE`, [accountId]);
      const products = parse(saved.rows[0]?.value as string | undefined);
      const told = (it: { name: string; qty: number; size?: string }): StockLine => ({ name: it.name, qty: it.qty, ...(it.size ? { size: it.size } : {}) });
      if (Array.isArray(products) && lines.length) {
        if (holds) {
          /* taken again, as when the order was placed: only while every product still in the shop has enough */
          const taken = stockTaken(products, lines);
          if (taken.short.length) return { result: "no-stock", short: taken.short.map(told) };
          await writeKey(c, accountId, "seen-products", JSON.stringify(takeStock(products, taken.lines.map((it) => ({ ...it, qty: it.took })), { online: true })));
          /* each line keeps what it took this time, for the next cancel */
          const next = items.map((it: unknown, at: number) => {
            const t = taken.lines.find((x) => x.at === at);
            return t && isObj(it) ? { ...it, took: t.took } : it;
          });
          await c.query(`UPDATE store_orders SET items = $3 WHERE id = $1 AND account_id = $2`, [serverId, accountId, JSON.stringify(next)]);
        } else {
          /* given back with a quantity below zero (safeOrder takeStock): exactly what each line took */
          notBack = stockNotBack(products, lines).map((it) => told({ ...it, qty: it.took }));
          await writeKey(c, accountId, "seen-products", JSON.stringify(takeStock(products, lines.map((it) => ({ ...it, qty: -it.took })), { online: true })));
        }
      }
      if (o.coupon) {
        const kept = await c.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-coupons' FOR UPDATE`, [accountId]);
        const list = parse(kept.rows[0]?.value as string | undefined);
        if (Array.isArray(list)) await writeKey(c, accountId, "seen-coupons", JSON.stringify(countCouponUse(list, o.coupon, { online: true, by: holds ? 1 : -1 })));
      }
    }
    await c.query(`UPDATE store_orders SET status = $3, ${PAID_SET}, updated_at = now() WHERE id = $1 AND account_id = $2`, [serverId, accountId, status]);
    return { result: "ok", notBack };
  });
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
