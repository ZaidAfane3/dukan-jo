import type { PoolClient } from "pg";
import { cleanSetup } from "@/components/safeAccount";
import { db } from "./db";

/* The shops table: one row per merchant account, worked out on the server from what the merchant's pages sync to
   store_data. Diwan reads only this row (names, counts and totals), never the products, orders or customers
   themselves: the counting happens in SQL and only the numbers come back.

   What counts:
   - setup_done: how many of the 6 setup steps are ticked in seen-setup
   - published: the store has a saved design (a seen-storefront row); published_at is the first time it was seen so
   - paused: seen-maintenance says {on: true}
   - product_count: products in seen-products that are not in the bin (no deletedAt)
   - order_count: every order in seen-orders with a real id, whatever its status
   - total_sales: the totals of those orders, leaving out the cancelled and refunded ones
   - first_order_at: the date of the oldest order (or now, when no order has a date) */

/** The keys whose change can change the shops row */
export const SHOP_KEYS = new Set(["seen-setup", "seen-products", "seen-orders", "seen-storefront", "seen-maintenance"]);

type Q = Pick<PoolClient, "query">;

/* store_data.value as jsonb, or NULL when it is not valid JSON (pg_input_is_valid: PostgreSQL 16 and later) */
const J = (key: string) =>
  `(SELECT CASE WHEN pg_input_is_valid(value, 'jsonb') THEN value::jsonb END FROM store_data WHERE account_id = $1 AND key = '${key}')`;

/* The counts, done in SQL so the contents never reach this code */
const COUNTS = `
  WITH v AS (SELECT ${J("seen-products")} AS products, ${J("seen-orders")} AS orders, ${J("seen-maintenance")} AS maint,
                    EXISTS (SELECT 1 FROM store_data WHERE account_id = $1 AND key = 'seen-storefront') AS published),
       p AS (SELECT count(*)::int AS n FROM v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.products) = 'array' THEN v.products ELSE '[]' END) x
              WHERE jsonb_typeof(x) = 'object' AND COALESCE(jsonb_typeof(x -> 'deletedAt'), 'null') = 'null'),
       o AS (SELECT x FROM v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.orders) = 'array' THEN v.orders ELSE '[]' END) x
              WHERE jsonb_typeof(x) = 'object' AND jsonb_typeof(x -> 'id') = 'number' AND (x ->> 'id') ~ '^[1-9][0-9]{0,15}$'),
       t AS (SELECT
               count(*)::int AS n,
               COALESCE(sum(CASE
                 WHEN (x ->> 'status') IN ('cancelled', 'refunded') THEN 0
                 WHEN jsonb_typeof(x -> 'total') IN ('number', 'string') AND (x ->> 'total') ~ '^[0-9]{1,7}(\\.[0-9]{1,3})?$'
                   THEN LEAST((x ->> 'total')::numeric, 1000000)
                 ELSE 0 END), 0)::numeric(14, 3) AS sales,
               min(CASE WHEN jsonb_typeof(x -> 'created') = 'number' AND (x ->> 'created') ~ '^[0-9]{12,13}(\\.[0-9]+)?$'
                         AND (x ->> 'created')::numeric BETWEEN 946684800000 AND 4102444800000
                        THEN to_timestamp((x ->> 'created')::numeric / 1000) END) AS first_at
             FROM o)
  SELECT p.n AS product_count, t.n AS order_count, t.sales AS total_sales, t.first_at, v.published,
         COALESCE(jsonb_typeof(v.maint) = 'object' AND v.maint -> 'on' = 'true'::jsonb, false) AS paused
    FROM v, p, t`;

/** Works the shops row out again from the account's saved data, and saves it. */
export async function syncShop(accountId: string | number, q?: Q): Promise<void> {
  const c: Q = q ?? (await db());
  const [{ rows: setupRows }, { rows: countRows }] = await Promise.all([
    c.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-setup'`, [accountId]),
    c.query(COUNTS, [accountId]),
  ]);
  let setup = null;
  try {
    setup = setupRows[0] ? cleanSetup(JSON.parse(setupRows[0].value)) : null;
  } catch {
    setup = null;
  }
  const k = countRows[0];
  const ship = setup?.shipping;
  const values = [
    accountId,
    setup?.name ?? "",
    setup?.slug || null,
    setup?.phone ?? "",
    setup?.color ?? "",
    setup ? setup.done.filter(Boolean).length : 0,
    !!k.published,
    !!k.paused,
    ship?.mode ?? "",
    ship?.mode === "seen" ? ship.city : "",
    ship?.mode === "seen" ? ship.address : "",
    k.product_count,
    k.order_count,
    k.total_sales,
    k.first_at,
  ];
  const sql = `
    INSERT INTO shops (account_id, name, slug, phone, color, setup_done, published, paused, ship_mode, pickup_city, pickup_address,
                       product_count, order_count, total_sales, published_at, first_product_at, first_order_at, updated_at)
    VALUES ($1, $2, $3::text, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            CASE WHEN $7 THEN now() END, CASE WHEN $12 > 0 THEN now() END, CASE WHEN $13 > 0 THEN COALESCE($15, now()) END, now())
    ON CONFLICT (account_id) DO UPDATE SET
      name = EXCLUDED.name, slug = EXCLUDED.slug, phone = EXCLUDED.phone, color = EXCLUDED.color, setup_done = EXCLUDED.setup_done,
      published = EXCLUDED.published, paused = EXCLUDED.paused, ship_mode = EXCLUDED.ship_mode, pickup_city = EXCLUDED.pickup_city,
      pickup_address = EXCLUDED.pickup_address, product_count = EXCLUDED.product_count, order_count = EXCLUDED.order_count,
      total_sales = EXCLUDED.total_sales,
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
    where.push(`(s.name ILIKE ${like} OR a.name ILIKE ${like} OR a.email ILIKE ${like} OR a.phone ILIKE ${like} OR s.slug ILIKE ${like})`);
  }
  const status = p.get("status");
  if (status && (SHOP_STATUSES as readonly string[]).includes(status)) where.push(`(${STATUS_SQL}) = ${add(status)}`);
  const plan = p.get("plan");
  if (plan && /^\d{1,12}$/.test(plan)) where.push(`cur.plan_id = ${add(plan)}`);
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

export const SHOP_LIST_COLUMNS = `s.account_id AS id, s.name, s.slug, a.name AS owner, a.email, a.phone, cur.plan_en, cur.plan_ar, cur.ends_at,
  (${STATUS_SQL}) AS status, s.setup_done, s.published, s.paused, s.ship_mode, s.product_count, s.order_count, s.total_sales,
  s.last_seen_at, s.created_at`;
