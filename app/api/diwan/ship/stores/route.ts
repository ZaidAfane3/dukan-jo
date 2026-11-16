import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops, shopListSql, STATUS_SQL } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;

/* The stores that deliver with Dukkan Ship (shops.ship_mode = 'seen'), newest first, 50 at a time, with the shop list's
   own search (store name or link; an owner's email or mobile only when typed in full). Each row: the store's name, its
   owner's name, link, pickup city, status and how many orders it has. Never an email, a phone or an address. The shops
   row has no date for when Dukkan Ship was chosen, so none is given. */
export const GET = staffRoute("shops.read", async (req) => {
  await prepareShops();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(p.get("page") ?? "1", 10) || 1));
  const { sql, params } = shopListSql(new URLSearchParams({ q: p.get("q") ?? "", ship: "yes" }));
  const pool = await db();
  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT s.account_id AS id, s.name, s.slug, a.name AS owner, s.pickup_city AS city, (${STATUS_SQL}) AS status, s.published, s.order_count
       ${sql} ORDER BY s.created_at DESC, s.account_id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS n ${sql}`, params),
  ]);
  const total = count.rows[0].n;
  return answer({ result: "ok", rows: rows.rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) });
});
