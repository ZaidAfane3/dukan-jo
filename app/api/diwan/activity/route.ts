import type { NextRequest } from "next/server";
import { SHOWN_SQL, SIGN_IN_ACTIONS } from "@/components/diwan/activityWords";
import { cleanLine } from "@/components/safe";
import { answer } from "@/server/auth";
import { aboutShopSql, describeActivity } from "@/server/activityDetail";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,18}$/;

/* The activity log (Diwan's staff only: their sign-ins and what they changed), newest first, 50 at a time. "Load more"
   asks for the lines before the last id shown (?before=), so lines written meanwhile never show twice. Filters: ?staff=
   (an id), ?shop= (one store's lines), ?kind=signin (sign-ins only) or ?action=, ?from= and ?to= (days, both included). Every value is a parameter of
   the query. The old "opened a page" lines are left out (HIDDEN_ACTIONS), and only who, what, on what and why is sent:
   no addresses or inner details. The log can't be changed or deleted (a database trigger refuses it), here or anywhere. */
export const GET = staffRoute("audit.read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const where: string[] = [SHOWN_SQL("a")];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  const staff = q.get("staff") ?? "";
  if (ID.test(staff)) add("a.staff_id = ?", staff);
  const action = cleanLine(q.get("action") ?? "", 80);
  if (q.get("kind") === "signin") add("a.action = ANY(?)", SIGN_IN_ACTIONS);
  else if (action) add("a.action = ?", action);
  /* a day that exists (from 1970): "2026-02-31" has the right shape but no such day (the database would refuse it, a
     503), so it is answered 400 before any query; an empty value is no filter */
  const realDay = (v: string) =>
    DAY.test(v) && v >= "1970-01-01" && !isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if ((from && !realDay(from)) || (to && !realDay(to))) return answer({ result: "invalid" }, 400);
  if (from) add("a.at >= ?::date", from);
  if (to) add("a.at < ?::date + 1", to);
  /* one store's lines only: the store itself, its tickets, the reports about it and its documents (?shop=, its page's
     "See all") */
  const shop = q.get("shop") ?? "";
  if (ID.test(shop)) {
    params.push(shop);
    where.push(aboutShopSql("a", `$${params.length}`));
  }
  const before = q.get("before") ?? "";
  if (ID.test(before)) add("a.id < ?", before);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.at, a.staff_id, s.name AS staff_name, a.action, a.target_type, a.target_id, a.reason, a.meta
       FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.id DESC LIMIT ${PAGE + 1}`,
    params,
  );
  /* the choices of the filters, from what the log holds */
  const [people, actions, lines, shopRow] = await Promise.all([
    pool.query(`SELECT id, name, active FROM staff ORDER BY lower(name)`),
    pool.query(`SELECT DISTINCT a.action FROM audit_log a WHERE ${SHOWN_SQL("a")} ORDER BY a.action LIMIT 300`),
    /* each line in words: what changed, from what to what, and the store it is about (server/activityDetail.ts) */
    describeActivity(pool, rows.slice(0, PAGE)),
    ID.test(shop) ? pool.query(`SELECT COALESCE(NULLIF(s.name, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = $1`, [shop]) : null,
  ]);
  const page = rows.slice(0, PAGE);
  return answer({
    rows: lines,
    next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
    staff: people.rows.map((p) => ({ id: String(p.id), name: p.name, active: p.active })),
    actions: actions.rows.map((a) => a.action),
    shopName: shopRow?.rows[0]?.name ?? null,
  });
});
