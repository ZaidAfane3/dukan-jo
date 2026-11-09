import type { PoolClient } from "pg";
import { cleanSetup } from "@/components/safeAccount";
import { lookupKeys, seal } from "./crypto";
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
   - order_count: every order in seen-orders with a real id, whatever its status
   - total_sales: the totals of those orders, leaving out the cancelled and refunded ones
   - first_order_at: the date of the oldest order (or now, when no order has a date) */

/** The keys whose change can change the shops row */
export const SHOP_KEYS = new Set(["seen-setup", "seen-products", "seen-orders", "seen-storefront", "seen-maintenance", "seen-themes"]);

type Q = Pick<PoolClient, "query">;

/* The counts, worked out here from the opened values (store_data is encrypted, so SQL can't read inside it). Only
   the numbers leave this function. */
type Counts = { product_count: number; order_count: number; total_sales: string; first_at: Date | null; published: boolean; paused: boolean; theme_id: string };
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
  const real = Array.isArray(orders)
    ? orders.filter((x): x is Record<string, unknown> => isObj(x) && typeof x.id === "number" && /^[1-9][0-9]{0,15}$/.test(String(x.id)))
    : [];
  let sales = 0;
  let first: number | null = null;
  for (const o of real) {
    const total = typeof o.total === "number" || typeof o.total === "string" ? String(o.total) : "";
    if (o.status !== "cancelled" && o.status !== "refunded" && /^[0-9]{1,7}(\.[0-9]{1,3})?$/.test(total)) sales += Math.min(Number(total), 1_000_000);
    const c = o.created;
    if (typeof c === "number" && /^[0-9]{12,13}(\.[0-9]+)?$/.test(String(c)) && c >= 946684800000 && c <= 4102444800000) first = first == null ? c : Math.min(first, c);
  }
  return {
    product_count: productCount,
    order_count: real.length,
    total_sales: sales.toFixed(3),
    first_at: first == null ? null : new Date(first),
    published: data.has("seen-storefront"),
    paused: isObj(maint) && maint.on === true,
    theme_id: themeOf(parse(data.get("seen-themes"))),
  };
}

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
    setup?.name ?? "",
    setup?.slug || null,
    seal(setup?.phone ?? ""),
    setup?.color ?? "",
    setup ? setup.done.filter(Boolean).length : 0,
    !!k.published,
    !!k.paused,
    ship?.mode ?? "",
    ship?.mode === "seen" ? ship.city : "",
    seal(ship?.mode === "seen" ? ship.address : ""),
    k.product_count,
    k.order_count,
    k.total_sales,
    k.first_at,
    k.theme_id,
  ];
  const sql = `
    INSERT INTO shops (account_id, name, slug, phone, color, setup_done, published, paused, ship_mode, pickup_city, pickup_address,
                       product_count, order_count, total_sales, published_at, first_product_at, first_order_at, theme_id, updated_at)
    VALUES ($1, $2, $3::text, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            CASE WHEN $7 THEN now() END, CASE WHEN $12 > 0 THEN now() END, CASE WHEN $13 > 0 THEN COALESCE($15, now()) END, $16, now())
    ON CONFLICT (account_id) DO UPDATE SET
      name = EXCLUDED.name, slug = EXCLUDED.slug, phone = EXCLUDED.phone, color = EXCLUDED.color, setup_done = EXCLUDED.setup_done,
      published = EXCLUDED.published, paused = EXCLUDED.paused, ship_mode = EXCLUDED.ship_mode, pickup_city = EXCLUDED.pickup_city,
      pickup_address = EXCLUDED.pickup_address, product_count = EXCLUDED.product_count, order_count = EXCLUDED.order_count,
      total_sales = EXCLUDED.total_sales, theme_id = EXCLUDED.theme_id,
      published_at = COALESCE(shops.published_at, EXCLUDED.published_at),
      first_product_at = COALESCE(shops.first_product_at, EXCLUDED.first_product_at),
      first_order_at = COALESCE(shops.first_order_at, EXCLUDED.first_order_at),
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

/** Starts the free trial of a new shop: the 'trial' plan, for platform_settings.trial_days days from `from` */
export async function startTrial(accountId: string | number, q?: Q, from: Date | string = new Date()): Promise<void> {
  const c: Q = q ?? (await db());
  await c.query(
    `INSERT INTO subscriptions (account_id, plan_id, status, starts_at, ends_at)
     SELECT $1, p.id, 'trial', $2::timestamptz,
            $2::timestamptz + make_interval(days => COALESCE((SELECT (value #>> '{}')::int FROM platform_settings WHERE key = 'trial_days'), 14))
       FROM plans p WHERE p.key = 'trial'
        AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE account_id = $1)`,
    [accountId, from],
  );
}

/** Marks a subscription whose end has passed as expired. Cheap: run before Diwan reads subscriptions. */
export async function expireSubscriptions(q?: Q): Promise<void> {
  const c: Q = q ?? (await db());
  await c.query(`UPDATE subscriptions SET status = 'expired' WHERE status IN ('trial', 'active') AND ends_at IS NOT NULL AND ends_at < now()`);
}

/* at most once a minute per server: accounts made before the shops table (or by hand) get their row and trial */
let lastPrepared = 0;
/** Gets the shops table ready for Diwan: a row (and a trial from the sign-up date) for every account that has none,
    and subscriptions that ran out marked expired. */
export async function prepareShops(): Promise<void> {
  const pool = await db();
  await expireSubscriptions(pool);
  if (Date.now() - lastPrepared < 60_000) return;
  lastPrepared = Date.now();
  const { rows } = await pool.query(`SELECT a.id, a.created_at FROM accounts a WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.account_id = a.id) LIMIT 500`);
  for (const r of rows) {
    await pool.query(`INSERT INTO shops (account_id, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.id, r.created_at]);
    await syncShop(r.id, pool);
    await startTrial(r.id, pool, r.created_at);
  }
  if (rows.length) await expireSubscriptions(pool);
  if (rows.length === 500) lastPrepared = 0;
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

/** A shop's status for Diwan: suspended wins, then the current subscription (none current: expired) */
export const STATUS_SQL = `CASE WHEN s.status = 'suspended' THEN 'suspended'
  WHEN cur.status = 'active' AND cur.plan_key <> 'trial' THEN 'active'
  WHEN cur.status IN ('trial', 'active') THEN 'trial'
  ELSE 'expired' END`;

/** The current subscription of shop `s` (LATERAL join, as `cur`) */
export const CURRENT_SUB_SQL = `LEFT JOIN LATERAL (
    SELECT sub.id, sub.status, sub.ends_at, p.key AS plan_key, p.name_en AS plan_en, p.name_ar AS plan_ar, p.id AS plan_id
      FROM subscriptions sub JOIN plans p ON p.id = sub.plan_id
     WHERE sub.account_id = s.account_id AND sub.status IN ('trial', 'active')
     ORDER BY sub.created_at DESC LIMIT 1) cur ON true`;

/** Escapes % _ and \ so a search finds them as typed */
export const likeText = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/* ---------------- the shop list (Diwan's Shops page and its CSV) ---------------- */

const SORTS: Record<string, string> = {
  newest: "s.created_at DESC",
  seen: "s.last_seen_at DESC NULLS LAST",
  name: "lower(s.name) ASC, s.created_at DESC",
  products: "s.product_count DESC",
  orders: "s.order_count DESC",
  sales: "s.total_sales DESC",
};
export const SHOP_SORTS = Object.keys(SORTS);
export const SHOP_STATUSES = ["trial", "active", "expired", "suspended"] as const;

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
    /* the owner's name, email and mobile are encrypted: email and mobile are found only when typed in full */
    where.push(`(s.name ILIKE ${like} OR s.slug ILIKE ${like} OR a.email_hash = ${add(e)} OR a.phone_hash = ${add(m)})`);
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
  const sql = `FROM shops s JOIN accounts a ON a.id = s.account_id ${CURRENT_SUB_SQL} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  return { sql, params, order: SORTS[p.get("sort") ?? ""] ?? SORTS.newest };
}

/* `domain`: the store's own domain when one is connected and working (the newest, if more than one); none: its
   dukkan.store address is what people open */
export const SHOP_LIST_COLUMNS = `s.account_id AS id, s.name, s.slug, a.name AS owner, a.email, a.phone,
  (SELECT d.name FROM domains d WHERE d.account_id = s.account_id AND d.status = 'active' ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS domain,
  (${STATUS_SQL}) AS status, s.setup_done, s.published, s.paused, s.ship_mode, s.product_count, s.order_count, s.total_sales,
  s.last_seen_at, s.created_at`;
