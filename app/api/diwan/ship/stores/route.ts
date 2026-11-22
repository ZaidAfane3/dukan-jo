import { cleanSetting, SETTING_DEFAULTS, type DukkanShip } from "@/components/diwan/platformSettings";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { ORDERS_SQL, prepareShops, shopListSql, STATUS_SQL } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;

/* The stores that deliver with Dukkan Ship (shops SHIP_SQL: chosen, or by default), newest first, 50 at a time, with the shop list's
   own search (store name or link; an owner's email or mobile only when typed in full). Each row: the store's name, its
   owner's name, link, pickup city, status, how many orders it has and how many of them Dukkan Ship delivers (ship_orders; like the orders count, a card or CliQ test order
   from the merchant's preview is left out, so it is never more than the orders). Never an email, a phone or an address. The shops
   row has no date for when Dukkan Ship was chosen, so none is given. `served`: false when its pickup city is no longer on
   Dukkan Ship's list (taken off in Diwan since it was saved), so the page marks it instead of listing it as usual. */
export const GET = staffRoute("shops.read", async (req) => {
  await prepareShops();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(p.get("page") ?? "1", 10) || 1));
  const { sql, params } = shopListSql(new URLSearchParams({ q: p.get("q") ?? "", ship: "yes" }));
  const pool = await db();
  const [rows, count, setting] = await Promise.all([
    pool.query(
      `SELECT s.account_id AS id, s.name, s.slug, a.name AS owner, s.pickup_city AS city, (${STATUS_SQL}) AS status, s.published, ${ORDERS_SQL} AS order_count,
              (SELECT count(*)::int FROM store_orders o
                WHERE o.account_id = s.account_id AND o.ship_by = 'dukkan' AND o.payment_method NOT IN ('card', 'cliq')) AS ship_orders
       ${sql} ORDER BY s.created_at DESC, s.account_id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS n ${sql}`, params),
    pool.query(`SELECT value FROM platform_settings WHERE key = 'dukkan_ship'`),
  ]);
  const total = count.rows[0].n;
  const ship = (setting.rows[0] ? (cleanSetting("dukkan_ship", setting.rows[0].value) as DukkanShip | null) : null) ?? SETTING_DEFAULTS.dukkan_ship;
  const served = (city: unknown) => {
    const name = typeof city === "string" ? city.trim() : "";
    return !name || ship.cities.some((c) => c.en === name || c.ar === name);
  };
  return answer({ result: "ok", rows: rows.rows.map((r: { city: unknown }) => ({ ...r, served: served(r.city) })), total, page, pages: Math.max(1, Math.ceil(total / PAGE)) });
});
