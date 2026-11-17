import type { PoolClient } from "pg";
import { STATUS_KEYS, type StatusKey } from "@/components/ordersContent";
import { cleanSetup } from "@/components/safeAccount";
import { isTestOrder, saleState } from "@/components/storeNumbers";
import { lookupKeys, NAME_KEYS_VERSION, nameKeys, nameSearchKeys, plainText, seal } from "./crypto";
import { db } from "./db";

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

/** Works the shops row out again from the account's saved data, and saves it. */
export async function syncShop(accountId: string | number, q?: Q): Promise<void> {
  const c: Q = q ?? (await db());
  /* the values come back opened by db() */
  const { rows } = await c.query(`SELECT key, value FROM store_data WHERE account_id = $1 AND key = ANY($2::text[])`, [accountId, Array.from(SHOP_KEYS)]);
  const data = new Map<string, string>(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
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
  try {
    await c.query(sql, values);
  } catch (e) {
    /* the link belongs to another shop (saved before links were checked, or two saves at once): kept without it */
    if ((e as { code?: string }).code !== "23505") throw e;
    await c.query(sql, [...values.slice(0, 2), null, ...values.slice(3)]);
  }
}

/** True when another shop already uses this store link (case does not matter) */
export async function slugTaken(slug: string, accountId: string | number | null): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT 1 FROM shops WHERE lower(slug) = lower($1) AND account_id IS DISTINCT FROM $2 LIMIT 1`, [
    slug,
    accountId,
  ]);
  return rows.length > 0;
}

/* at most once a minute per server: accounts made before the shops table (or by hand) get their row. Dukkan has no plans
   and no free trial, so nothing about a subscription is made here (the old plans and subscriptions tables are unused). */
let lastPrepared = 0;
/** Gets the shops table ready for Diwan: a row for every account that has none */
export async function prepareShops(): Promise<void> {
  if (Date.now() - lastPrepared < 60_000) return;
  lastPrepared = Date.now();
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
  if (rows.length === 500 || named.rows.length === 500 || stale.rows.length === 200) lastPrepared = 0;
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
    CliQ is a test order (no payment is taken yet: isTestOrder) and is not counted; a cash one is an order whatever its
    status, and a sale once delivered (saleState). n: its orders; test: the test orders left out; sales: what the
    delivered ones brought in. Only counts and a total leave the database, never the orders. */
export const STORE_ORDERS_SQL = (s = "s") => `(SELECT count(*) FILTER (WHERE o.payment_method NOT IN ('card', 'cliq'))::int AS n,
         count(*) FILTER (WHERE o.payment_method IN ('card', 'cliq'))::int AS test,
         COALESCE(sum(o.total) FILTER (WHERE o.payment_method NOT IN ('card', 'cliq') AND o.status = 'delivered'), 0) AS sales
    FROM store_orders o WHERE o.account_id = ${s}.account_id)`;
/** A shop's orders and sales as the merchant's Home shows them: the shops row's (the orders kept in store_data) and its
    store page's (STORE_ORDERS_SQL, joined as `so`) together */
export const ORDERS_SQL = `(s.order_count + so.n)`;
export const SALES_SQL = `(s.total_sales + so.sales)::numeric(14, 3)`;

/* ---------------- the shop list (Diwan's Shops page and its CSV) ---------------- */

const SORTS: Record<string, string> = {
  newest: "s.created_at DESC",
  seen: "s.last_seen_at DESC NULLS LAST",
  name: "lower(s.name) ASC, s.created_at DESC",
  products: "s.product_count DESC",
  orders: `${ORDERS_SQL} DESC`,
  sales: `${SALES_SQL} DESC`,
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
  if (ship === "yes") where.push(`s.ship_mode = 'seen'`);
  else if (ship === "no") where.push(`s.ship_mode <> 'seen'`);
  const sql = `FROM shops s JOIN accounts a ON a.id = s.account_id LEFT JOIN LATERAL ${STORE_ORDERS_SQL("s")} so ON true ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  return { sql, params, order: SORTS[p.get("sort") ?? ""] ?? SORTS.newest };
}

export const SHOP_LIST_COLUMNS = `s.account_id AS id, s.name, s.slug, a.name AS owner, a.email, a.phone,
  (${STATUS_SQL}) AS status, s.setup_done, s.published, s.paused, s.ship_mode, s.product_count, ${ORDERS_SQL} AS order_count,
  ${SALES_SQL} AS total_sales, s.last_seen_at, s.created_at`;
