import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops, SHOP_LIST_COLUMNS, shopListSql } from "@/server/shops";
import { can, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 25;

/* The shop list: search (store name, owner, email, phone, link), filters, sort and pages, all done by the database. */
export const GET = staffRoute("shops.read", async (req, staff) => {
  await prepareShops();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(p.get("page") ?? "1", 10) || 1));
  const { sql, params, order } = shopListSql(p);
  const pool = await db();
  const [rows, count] = await Promise.all([
    pool.query(`SELECT ${SHOP_LIST_COLUMNS} ${sql} ORDER BY ${order}, s.account_id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params),
    pool.query(`SELECT count(*)::int AS n ${sql}`, params),
  ]);
  const total = count.rows[0].n;
  return answer({ result: "ok", rows: rows.rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), canExport: can(staff, "shops.export") });
});
