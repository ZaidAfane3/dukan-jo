import type { PoolClient } from "pg";
import { STATUS_KEYS, type StatusKey } from "@/components/ordersContent";
import { cleanSetup } from "@/components/safeAccount";
import { isTestOrder, saleState } from "@/components/storeNumbers";
import { lookupKeys, NAME_KEYS_VERSION, nameKeys, nameSearchKeys, plainText, seal } from "./crypto";
import { db } from "./db";
import { logMerchant, type MerchantAction, type MerchantMeta } from "./merchantLog";
import { holdOldSlug } from "./slugHolds";
import { SETUP_STEPS } from "@/components/safeOrder";

/* The shops table: one row per merchant account, worked out on the server from what the merchant's pages sync to
   store_data. Diwan reads only this row (names, counts and totals), never the products, orders or customers
   themselves: the counting happens in countShop and only the numbers are saved. The shop's phone and pickup address
   are stored encrypted.

   What counts:
   - setup_done: how many of the 6 setup steps are ticked in seen-setup
   - published: the store has a saved design (a seen-storefront row); published_at is the first time it was seen so
   - paused: seen-maintenance says {on: true}
   - product_count: products in seen-products that are not in the bin (no deletedAt)
   - order_count: every order in seen-orders with a real id, whatever its status, but a card or CliQ test order
     (components/storeNumbers.ts isTestOrder)
   - total_sales: the totals of those that are sales by the merchant's own rule (storeNumbers.ts saleState: not
     cancelled or refunded, not a test order, and paid: one he added past "pending", one from his store delivered)
   These are the orders kept in store_data only. The orders customers placed on the store's page (store_orders) are
   added when Diwan reads the row (STORE_ORDERS_SQL below), so Diwan's numbers are the ones the merchant's Home shows.
   - first_product_at / first_order_at: the date of the oldest product (bin included: it was added) / order, from their
     saved "created" times; when none has a date, the moment a sync first saw one (a store whose row already counted some
     without a date keeps none: Diwan says "Not recorded" rather than a made-up date). An older date found later wins. */

/** The keys whose change can change the shops row */
export const SHOP_KEYS = new Set(["seen-setup", "seen-products", "seen-orders", "seen-storefront", "seen-maintenance", "seen-themes"]);

type Q = Pick<PoolClient, "query">;

/* The counts, worked out here from the opened values (store_data is encrypted, so SQL can't read inside it). Only
   the numbers leave this function. */
type Counts = { product_count: number; order_count: number; total_sales: string; first_at: Date | null; first_product: Date | null; published: boolean; paused: boolean; theme_id: string };
const parse = (v: string | undefined): unknown => {
  if (v == null) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
/* The theme in use: seen-themes.active, or for a design he saved from a theme ("mine-..."), the theme it came from. Only an
   id from a fixed shape is kept (it is shown in Diwan and counted); anything else counts as Dukkan's default design. */
function themeOf(v: unknown): string {
  if (!isObj(v) || typeof v.active !== "string") return "dukkan";
  const custom = Array.isArray(v.custom) ? v.custom.find((c): c is Record<string, unknown> => isObj(c) && c.id === v.active) : undefined;
  const id = typeof custom?.from === "string" ? custom.from : v.active;
  return /^[a-z0-9-]{1,40}$/.test(id) && !id.startsWith("mine-") ? id : "dukkan";
}

export function countShop(data: Map<string, string>): Counts {
  const products = parse(data.get("seen-products"));
  const orders = parse(data.get("seen-orders"));
  const maint = parse(data.get("seen-maintenance"));
  const productCount = Array.isArray(products) ? products.filter((x) => isObj(x) && x.deletedAt == null).length : 0;
  /* a real time: milliseconds between 2000 and 2100 (an old product saved without one reads as 0) */
  const when = (c: unknown): c is number => typeof c === "number" && /^[0-9]{12,13}(\.[0-9]+)?$/.test(String(c)) && c >= 946684800000 && c <= 4102444800000;
  let firstProduct: number | null = null;
  if (Array.isArray(products)) for (const x of products) if (isObj(x) && when(x.created)) firstProduct = firstProduct == null ? x.created : Math.min(firstProduct, x.created);
  const real = Array.isArray(orders)
    ? orders.filter((x): x is Record<string, unknown> => isObj(x) && typeof x.id === "number" && /^[1-9][0-9]{0,15}$/.test(String(x.id)))
    : [];
  let sales = 0;
  let counted = 0;
  let first: number | null = null;
  for (const o of real) {
    const total = typeof o.total === "number" || typeof o.total === "string" ? String(o.total) : "";
    /* read the way the merchant's pages read it (components/records.ts cleanOrder), then counted by the merchant's own
       rule (storeNumbers.ts): a card or CliQ test order from his preview is no order, and a sale is what his Home calls one */
    const status = (STATUS_KEYS as readonly string[]).includes(o.status as string) ? (o.status as StatusKey) : "pending";
    const pay: "card" | "cliq" | "cash" | undefined = o.pay === undefined ? undefined : o.pay === "card" || o.pay === "cliq" ? o.pay : "cash";
    const read = { status, channel: o.channel === 1 ? (1 as const) : (0 as const), pay };
    if (!isTestOrder(read)) counted += 1;
    if (saleState(read) === "sale" && /^[0-9]{1,7}(\.[0-9]{1,3})?$/.test(total)) sales += Math.min(Number(total), 1_000_000);
    const c = o.created;
    if (when(c)) first = first == null ? c : Math.min(first, c);
  }
  return {
    product_count: productCount,
    order_count: counted,
    total_sales: sales.toFixed(3),
    first_at: first == null ? null : new Date(first),
    first_product: firstProduct == null ? null : new Date(firstProduct),
    published: data.has("seen-storefront"),
    paused: isObj(maint) && maint.on === true,
    theme_id: themeOf(parse(data.get("seen-themes"))),
  };
}

/** The rule order_count and total_sales are counted by (schema.ts shops.counts_v): a row counted by an older one is
    counted again by prepareShops. 1: the merchant's own rule (storeNumbers.ts isTestOrder / saleState); also fills
    ship_name and pickup. */
export const SHOP_COUNTS_VERSION = 1;

/** Works the shops row out again from the account's saved data, and saves it. `fresh`: what a save just wrote (the
    values, plain) and removed, so those keys are not read and opened again (the products and orders can be megabytes). */
export async function syncShop(
  accountId: string | number,
  q?: Q,
  fresh?: { set: Map<string, string>; removed: Set<string> },
  /* the merchant's own save: what changed goes to the merchant log (not a recount or Diwan opening the store) */
  opts?: { log?: boolean },
): Promise<void> {
  const c: Q = q ?? (await db());
  const was = opts?.log
    ? ((await c.query(`SELECT name, slug, setup_done, published, paused, ship_mode, theme_id, product_count, order_count FROM shops WHERE account_id = $1`, [accountId])).rows[0] as ShopWas | undefined)
    : undefined;
  const known = (k: string) => !!fresh && (fresh.set.has(k) || fresh.removed.has(k));
  const ask = Array.from(SHOP_KEYS).filter((k) => !known(k));
  /* the values come back opened by db() */
  const { rows } = ask.length ? await c.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [accountId, ask]) : { rows: [] };
  const data = new Map<string, string>(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  if (fresh) for (const [k, v] of fresh.set) if (SHOP_KEYS.has(k)) data.set(k, v);
  let setup = null;
  try {
    setup = data.has("seen-setup") ? cleanSetup(JSON.parse(data.get("seen-setup")!)) : null;
  } catch {
    setup = null;
  }
  const k = countShop(data);
  const ship = setup?.shipping;
  const values = [
    accountId,
    /* the name and the pickup city are kept unsealed (Diwan searches them): made safe first (server/crypto.ts) */
    plainText(setup?.name ?? ""),
    setup?.slug || null,
    seal(setup?.phone ?? ""),
    setup?.color ?? "",
    setup ? setup.done.filter(Boolean).length : 0,
    !!k.published,
    !!k.paused,
    ship?.mode ?? "",
    plainText(ship?.mode === "seen" ? ship.city : ""),
    seal(ship?.mode === "seen" ? ship.address : ""),
    k.product_count,
    k.order_count,
    k.total_sales,
    k.first_at,
    k.theme_id,
    k.first_product,
    /* the ways to pay he chose, for Diwan's store page (null: never chosen, every way Dukkan has on) */
    setup?.pays ? setup.pays.join(",") : null,
    SHOP_COUNTS_VERSION,
    /* its own courier's name and whether customers may pick up, for Diwan's store page (its delivery way) */
    plainText(ship?.mode === "own" ? ship.name : ""),
    !!setup?.pickup,
  ];
  const sql = `
    INSERT INTO shops (account_id, name, slug, phone, color, setup_done, published, paused, ship_mode, pickup_city, pickup_address,
                       product_count, order_count, total_sales, published_at, first_product_at, first_order_at, theme_id, store_pays, counts_v, ship_name, pickup, updated_at)
    VALUES ($1, $2, $3::text, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            CASE WHEN $7 THEN now() END, COALESCE($17::timestamptz, CASE WHEN $12 > 0 THEN now() END),
            COALESCE($15::timestamptz, CASE WHEN $13 > 0 THEN now() END), $16, $18::text, $19, $20, $21, now())
    ON CONFLICT (account_id) DO UPDATE SET
      name = EXCLUDED.name, slug = EXCLUDED.slug, phone = EXCLUDED.phone, color = EXCLUDED.color, setup_done = EXCLUDED.setup_done,
      published = EXCLUDED.published, paused = EXCLUDED.paused, ship_mode = EXCLUDED.ship_mode, pickup_city = EXCLUDED.pickup_city,
      pickup_address = EXCLUDED.pickup_address, product_count = EXCLUDED.product_count, order_count = EXCLUDED.order_count,
      total_sales = EXCLUDED.total_sales, theme_id = EXCLUDED.theme_id, store_pays = EXCLUDED.store_pays, counts_v = EXCLUDED.counts_v,
      ship_name = EXCLUDED.ship_name, pickup = EXCLUDED.pickup,
      published_at = COALESCE(shops.published_at, EXCLUDED.published_at),
      /* the oldest of: what was kept, the oldest saved time, and now when this is the first time it has any (LEAST skips
         nulls); a row that already counted some with no date stays without one */
      first_product_at = LEAST(shops.first_product_at, $17::timestamptz, CASE WHEN shops.product_count = 0 AND EXCLUDED.product_count > 0 THEN now() END),
      first_order_at = LEAST(shops.first_order_at, $15::timestamptz, CASE WHEN shops.order_count = 0 AND EXCLUDED.order_count > 0 THEN now() END),
      updated_at = now()`;
  let slugKept = values[2] as string | null;
  try {
    await c.query(sql, values);
  } catch (e) {
    /* the link belongs to another shop (saved before links were checked, or two saves at once): kept without it */
    if ((e as { code?: string }).code !== "23505") throw e;
    await c.query(sql, [...values.slice(0, 2), null, ...values.slice(3)]);
    slugKept = null;
  }
  /* a live store's old link is held for it for a while (server/slugHolds.ts): a problem there never fails the save */
  if (was?.published && (was.slug ?? "").toLowerCase() !== (slugKept ?? "").toLowerCase())
    await holdOldSlug(c, accountId, was.slug ?? "", slugKept).catch((e) => console.error("[shops] holding old link", accountId, e));
  if (was)
    logShopChanges(accountId, was, {
      name: values[1] as string,
      slug: slugKept,
      done: setup ? setup.done.slice(0, SETUP_STEPS).map((d) => d === true) : [],
      setup_done: values[5] as number,
      published: values[6] as boolean,
      paused: values[7] as boolean,
      ship_mode: values[8] as string,
      theme_id: (values[15] as string | null) ?? null,
      product_count: Number(values[11]),
      order_count: Number(values[12]),
    });
}

type ShopWas = { name: string; slug: string | null; setup_done: number; published: boolean; paused: boolean; ship_mode: string; theme_id: string | null; product_count: number; order_count: number };

/* what a merchant's save changed in his store, as merchant log lines (server/merchantLog.ts) */
function logShopChanges(id: string | number, was: ShopWas, now: Omit<ShopWas, "setup_done"> & { setup_done: number; done: boolean[] }) {
  const log = (a: MerchantAction, meta?: MerchantMeta) => logMerchant(id, a, meta);
  if ((was.name ?? "") !== now.name && now.name) log("store.name", { from: was.name || null, to: now.name });
  if ((was.slug ?? "") !== (now.slug ?? "") && now.slug) log("store.link", { from: was.slug || null, to: now.slug });
  if (now.setup_done > Number(was.setup_done ?? 0)) {
    /* which steps: the saved setup says which are done; the row only kept how many */
    if (now.setup_done >= SETUP_STEPS) log("store.setup-done");
    else log("store.setup-step", { done: now.setup_done, of: SETUP_STEPS, steps: now.done.map((d, i) => (d ? i + 1 : 0)).filter(Boolean).join(",") });
  }
  if (!was.published && now.published) log("store.live");
  if (was.published && !now.published) log("store.offline");
  if (!was.paused && now.paused) log("store.paused");
  if (was.paused && !now.paused) log("store.resumed");
  if ((was.ship_mode ?? "") !== now.ship_mode && now.ship_mode) log("store.delivery", { from: was.ship_mode || null, to: now.ship_mode });
  if ((was.theme_id ?? null) !== now.theme_id && now.theme_id) log("store.theme", { from: was.theme_id, to: now.theme_id });
  if (!Number(was.product_count) && now.product_count > 0) log("store.first-product");
  if (!Number(was.order_count) && now.order_count > 0) log("store.first-order");
}

/** True when another shop already uses this store link (case does not matter) */
export async function slugTaken(slug: string, accountId: string | number | null): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT 1 FROM shops WHERE lower(slug) = lower($1) AND account_id IS DISTINCT FROM $2 LIMIT 1`, [
    slug,
    accountId,
  ]);
  return rows.length > 0;
}

/* One-time data fixes: accounts made before the shops table (or by hand) get their row (sign-up makes it for every new
   one), older accounts get their name's fingerprints, and rows counted by an older rule are counted again. They run once
   when the server starts (instrumentation.ts), not inside staff requests: Diwan's pages still call prepareShops, which
   costs nothing once they are done, and runs them (once, shared) only when the start-up run has not finished or failed
   (the database was not reachable yet). Dukkan has no plans and no free trial, so nothing about a subscription is made
   here. */
/* kept on the process, not this module: the start-up code and the routes are bundled apart, each with its own copy */
const prep = ((globalThis as { __dukkanShopsPrep?: { done: boolean; running: Promise<void> | null } }).__dukkanShopsPrep ??= { done: false, running: null });
/** Gets the shops table ready for Diwan (see above) */
export function prepareShops(): Promise<void> {
  if (prep.done) return Promise.resolve();
  prep.running ??= (async () => {
    while (await prepareBatch());
    prep.done = true;
  })().finally(() => {
    prep.running = null;
  });
  return prep.running;
}

/* one round of the fixes; true when there may be more to do */
async function prepareBatch(): Promise<boolean> {
  const pool = await db();
  const { rows } = await pool.query(`SELECT a.id, a.created_at FROM accounts a WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.account_id = a.id) LIMIT 500`);
  for (const r of rows) {
    await pool.query(`INSERT INTO shops (account_id, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.id, r.created_at]);
    await syncShop(r.id, pool);
  }
  /* accounts from before owners could be found by name: the fingerprints of their name's words, 500 at a time (the
     names come back opened by db()) */
  const named = await pool.query(`SELECT id, name FROM accounts WHERE name_keys_v < $1 LIMIT 500`, [NAME_KEYS_VERSION]);
  for (const r of named.rows)
    await pool.query(`UPDATE accounts SET name_keys = $2, name_keys_v = $3 WHERE id = $1 AND name_keys_v < $3`, [r.id, nameKeys(r.name ?? ""), NAME_KEYS_VERSION]);
  /* rows counted by an older rule (SHOP_COUNTS_VERSION): counted again, 200 at a time */
  const stale = await pool.query(`SELECT account_id FROM shops WHERE counts_v < $1 LIMIT 200`, [SHOP_COUNTS_VERSION]);
  for (const r of stale.rows) await syncShop(r.account_id, pool).catch((e) => console.error("[shops] recount", r.account_id, e));
  return rows.length === 500 || named.rows.length === 500 || stale.rows.length === 200;
}

/** Notes that the merchant was here, at most once every 5 minutes */
export function touchShop(accountId: string | number): void {
  db()
    .then((pool) =>
      pool.query(`UPDATE shops SET last_seen_at = now() WHERE account_id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes')`, [
        accountId,
      ]),
    )
    .catch(() => {});
}

/* ---------------- what Diwan shows ---------------- */

/** A shop's status for Diwan. Dukkan has no plans and no free trial, so it says nothing about paying: suspended (by
    Dukkan) wins, then paused (the merchant closed the store for a while), else open */
export const STATUS_SQL = `CASE WHEN s.status = 'suspended' THEN 'suspended' WHEN s.paused THEN 'paused' ELSE 'open' END`;

/** Escapes % _ and \ so a search finds them as typed */
export const likeText = (s: string) => `%${s.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The orders customers placed on the store's page (store_orders) of the shop `s`, as a LATERAL subquery: counted the
    way the merchant's Home counts them (components/storeNumbers.ts). Every one is a store order, so one paid by card or
    CliQ is a test order (no payment is taken online yet: isTestOrder) and is not counted, until the merchant marks its
    payment received (payment_status 'paid'): then it is an order, and a sale while not cancelled or refunded; a cash one
    is an order whatever its status, and a sale once delivered (saleState). n: its orders; test: the test orders left
    out; sales: what the sales brought in. Only counts and a total leave the database, never the orders. */
export const REAL_STORE_ORDER = (o = "o") => `(${o}.payment_method NOT IN ('card', 'cliq') OR ${o}.payment_status = 'paid')`;
export const STORE_ORDERS_SQL = (s = "s") => `(SELECT count(*) FILTER (WHERE ${REAL_STORE_ORDER()})::int AS n,
         count(*) FILTER (WHERE NOT ${REAL_STORE_ORDER()})::int AS test,
         COALESCE(sum(o.total) FILTER (WHERE (o.payment_method NOT IN ('card', 'cliq') AND o.status = 'delivered')
           OR (o.payment_method IN ('card', 'cliq') AND o.payment_status = 'paid' AND o.status NOT IN ('cancelled', 'refunded'))), 0) AS sales
    FROM store_orders o WHERE o.account_id = ${s}.account_id)`;
/** A shop's orders and sales as the merchant's Home shows them: the shops row's (the orders kept in store_data) and its
    store page's (STORE_ORDERS_SQL, joined as `so`) together */
export const ORDERS_SQL = `(s.order_count + so.n)`;
export const SALES_SQL = `(s.total_sales + so.sales)::numeric(14, 3)`;
/** The same apart, as Diwan shows them (two figures, each labelled): the orders and sales that came through the store's
    page, counted by the server from store_orders, and the ones the merchant added himself (his saved orders, by hand or
    from his own preview: countShop), which the server cannot check. Platform figures go by the store page's only. */
export const STORE_PAGE_SQL = `so.n AS store_orders, so.sales::numeric(14, 3) AS store_sales, s.order_count AS hand_orders, s.total_sales AS hand_sales`;

/** A shop that delivers with Dukkan Ship: it chose it, or it is live (published) with no delivery choice saved, a store
    from before one was asked for, which delivers with Dukkan Ship by default (safeOrder checkoutShipMode). Diwan's
    Dukkan Ship list and count go by this, and the store page says "default, not chosen" for the second. */
export const SHIP_SQL = (s = "s") => `(${s}.ship_mode = 'seen' OR (${s}.ship_mode = '' AND ${s}.published))`;

/* ---------------- the shop list (Diwan's Shops page and its CSV) ---------------- */

const SORTS: Record<string, string> = {
  newest: "s.created_at DESC",
  seen: "s.last_seen_at DESC NULLS LAST",
  name: "lower(s.name) ASC, s.created_at DESC",
  products: "s.product_count DESC",
  /* by what came through the store page (STORE_PAGE_SQL), then what the merchant added */
  orders: `so.n DESC, s.order_count DESC`,
  sales: `so.sales DESC, s.total_sales DESC`,
};
export const SHOP_SORTS = Object.keys(SORTS);
export const SHOP_STATUSES = ["open", "paused", "suspended"] as const;

/** The WHERE and ORDER BY of the shop list from the page's search and filters. Only values from fixed lists are put in
    the SQL; everything typed goes in as a parameter. */
export function shopListSql(p: URLSearchParams): { sql: string; params: unknown[]; order: string } {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => `$${params.push(v)}`;
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const like = add(likeText(q));
    const [e, m] = lookupKeys(q);
    /* the owner's name, email and mobile are encrypted: email and mobile are found only when typed in full, the name by
       its full words (every word typed must be one of the name's words, in any order) */
    const words = nameSearchKeys(q).slice(0, 6);
    const byName = words.length ? ` OR a.name_keys @> ${add(words)}::text[]` : "";
    where.push(`(s.name ILIKE ${like} OR s.slug ILIKE ${like} OR a.email_hash = ${add(e)} OR a.phone_hash = ${add(m)}${byName})`);
  }
  const status = p.get("status");
  if (status && (SHOP_STATUSES as readonly string[]).includes(status)) where.push(`(${STATUS_SQL}) = ${add(status)}`);
  const setup = p.get("setup");
  if (setup === "done") where.push(`s.setup_done >= 6`);
  else if (setup === "partial") where.push(`s.setup_done BETWEEN 1 AND 5`);
  else if (setup === "none") where.push(`s.setup_done = 0`);
  const pub = p.get("published");
  if (pub === "yes") where.push(`s.published`);
  else if (pub === "no") where.push(`NOT s.published`);
  const ship = p.get("ship");
  if (ship === "yes") where.push(SHIP_SQL("s"));
  else if (ship === "no") where.push(`NOT ${SHIP_SQL("s")}`);
  const sql = `FROM shops s JOIN accounts a ON a.id = s.account_id LEFT JOIN LATERAL ${STORE_ORDERS_SQL("s")} so ON true ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  return { sql, params, order: SORTS[p.get("sort") ?? ""] ?? SORTS.newest };
}

/** The shop list's columns. Never the owner's email or mobile (security F08): the paged list could be walked for every
    merchant's contacts with no password and no trace. They come one store at a time behind the staff member's password
    (app/api/diwan/shops/[id]/contacts), or all together in the export (SHOP_EXPORT_COLUMNS), which needs it too. The
    search still finds an owner by the full email or mobile typed (their fingerprints, shopListSql). */
export const SHOP_LIST_COLUMNS = `s.account_id AS id, s.name, s.slug, a.name AS owner,
  (${STATUS_SQL}) AS status, s.setup_done, s.published, s.paused, s.ship_mode, s.product_count, ${STORE_PAGE_SQL},
  s.last_seen_at, s.created_at`;
/** The same with the owner's email and mobile, for the password-protected CSV export only */
export const SHOP_EXPORT_COLUMNS = `${SHOP_LIST_COLUMNS}, a.email, a.phone`;
