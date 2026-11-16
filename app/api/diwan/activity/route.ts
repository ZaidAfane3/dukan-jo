import type { NextRequest } from "next/server";
import { SHOWN_SQL, SIGN_IN_ACTIONS } from "@/components/diwan/activityWords";
import { cleanLine } from "@/components/safe";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,18}$/;

/* The activity log (Diwan's staff only: their sign-ins and what they changed), newest first, 50 at a time. "Load more"
   asks for the lines before the last id shown (?before=), so lines written meanwhile never show twice. Filters: ?staff=
   (an id), ?kind=signin (sign-ins only) or ?action=, ?from= and ?to= (days, both included). Every value is a parameter of
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
  const from = q.get("from") ?? "";
  if (DAY.test(from) && !isNaN(Date.parse(from))) add("a.at >= ?::date", from);
  const to = q.get("to") ?? "";
  if (DAY.test(to) && !isNaN(Date.parse(to))) add("a.at < ?::date + 1", to);
  const before = q.get("before") ?? "";
  if (ID.test(before)) add("a.id < ?", before);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.at, a.staff_id, s.name AS staff_name, a.action, a.target_type, a.target_id, a.reason, sh.name AS shop_name
       FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id
       LEFT JOIN shops sh ON a.target_type = 'shop' AND sh.account_id::text = a.target_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.id DESC LIMIT ${PAGE + 1}`,
    params,
  );
  /* the choices of the filters, from what the log holds */
  const [people, actions] = await Promise.all([
    pool.query(`SELECT id, name, active FROM staff ORDER BY lower(name)`),
    pool.query(`SELECT DISTINCT a.action FROM audit_log a WHERE ${SHOWN_SQL("a")} ORDER BY a.action LIMIT 300`),
  ]);
  const page = rows.slice(0, PAGE);
  return answer({
    rows: page.map((r) => ({
      id: String(r.id), at: r.at, staffId: r.staff_id ? String(r.staff_id) : null, staffName: r.staff_name, action: r.action,
      targetType: r.target_type, targetId: r.target_id, reason: r.reason, shopName: r.shop_name ?? null,
    })),
    next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
    staff: people.rows.map((p) => ({ id: String(p.id), name: p.name, active: p.active })),
    actions: actions.rows.map((a) => a.action),
  });
});
