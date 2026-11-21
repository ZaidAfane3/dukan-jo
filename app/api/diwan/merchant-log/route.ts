import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { MERCHANT_ACTIONS } from "@/server/merchantLog";
import { MERCHANT_LOG_SELECT, merchantLines } from "@/server/merchantLogRead";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,18}$/;

/* The merchant log (server/merchantLog.ts): what merchants did with their accounts and stores, newest first, 50 at a
   time ("Load more" asks for the lines before the last one shown, ?before=). Filters: ?shop= (one store), ?action=
   (one kind of line, or ?kind=account / ?kind=store for a group), ?from= and ?to= (days, both included). Every value
   is a parameter of the query. */
export const GET = staffRoute("shops.read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  const shop = q.get("shop") ?? "";
  if (ID.test(shop)) add("l.account_id = ?", shop);
  const action = q.get("action") ?? "";
  const kind = q.get("kind") ?? "";
  if ((MERCHANT_ACTIONS as readonly string[]).includes(action)) add("l.action = ?", action);
  else if (kind === "store") add("l.action = ANY(?)", MERCHANT_ACTIONS.filter((a) => a.startsWith("store.")));
  else if (kind === "account") add("l.action = ANY(?)", MERCHANT_ACTIONS.filter((a) => !a.startsWith("store.")));
  const realDay = (v: string) =>
    DAY.test(v) && v >= "1970-01-01" && !isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if ((from && !realDay(from)) || (to && !realDay(to))) return answer({ result: "invalid" }, 400);
  if (from) add("l.at >= ?::date", from);
  if (to) add("l.at < ?::date + 1", to);
  const before = q.get("before") ?? "";
  if (ID.test(before)) add("l.id < ?", before);

  const pool = await db();
  const { rows } = await pool.query(`${MERCHANT_LOG_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.id DESC LIMIT ${PAGE + 1}`, params);
  const page = rows.slice(0, PAGE);
  const [lines, shopRow] = await Promise.all([
    merchantLines(pool, page),
    ID.test(shop) ? pool.query(`SELECT COALESCE(NULLIF(s.name, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = $1`, [shop]) : null,
  ]);
  return answer({
    rows: lines,
    next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
    actions: MERCHANT_ACTIONS,
    shopName: shopRow?.rows[0]?.name ?? null,
  });
});
