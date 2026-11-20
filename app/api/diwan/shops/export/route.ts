import { answer, readJson, tooManyFor } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops, SHOP_LIST_COLUMNS, shopListSql } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

const MAX = 20_000;

/* The shop list as rows for a CSV file, with the same search and filters as the page (in the address). It holds every
   merchant's contacts, so it is a POST that needs the staff member's own password with it ({ myPassword },
   server/staffConfirm.ts passwordAgain), and the activity log keeps who exported, when, how many rows and with which
   filters. */
export const POST = staffRoute("shops.export", async (req, staff) => {
  /* every export holds thousands of merchants' contacts: a few an hour per staff member */
  if (tooManyFor(`diwan-export:${staff.id}`, 10, 60)) return answer({ result: "slow-down" }, 429);
  const refused = await passwordAgain(req, staff, (await readJson(req, 1_000))?.myPassword, "shops.export");
  if (refused) return refused;
  await prepareShops();
  const p = req.nextUrl.searchParams;
  const { sql, params, order } = shopListSql(p);
  const { rows } = await (await db()).query(`SELECT ${SHOP_LIST_COLUMNS} ${sql} ORDER BY ${order}, s.account_id DESC LIMIT ${MAX}`, params);
  await audit(req, staff.id, "shops.export", undefined, null, { rows: rows.length, filters: Object.fromEntries(p) });
  return answer({ result: "ok", rows });
});
