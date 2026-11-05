import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops, SHOP_LIST_COLUMNS, shopListSql } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const MAX = 20_000;

/* The shop list as rows for a CSV file, with the same search and filters as the page. Logged in the activity log. */
export const GET = staffRoute("shops.export", async (req, staff) => {
  await prepareShops();
  const p = req.nextUrl.searchParams;
  const { sql, params, order } = shopListSql(p);
  const { rows } = await (await db()).query(`SELECT ${SHOP_LIST_COLUMNS} ${sql} ORDER BY ${order}, s.account_id DESC LIMIT ${MAX}`, params);
  await audit(req, staff.id, "shops.export", undefined, null, { rows: rows.length, filters: Object.fromEntries(p) });
  return answer({ result: "ok", rows });
});
