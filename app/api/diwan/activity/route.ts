import type { NextRequest } from "next/server";
import { cleanLine } from "@/components/safe";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{1,18}$/;

/* The activity log, newest first, 50 at a time. The next page starts before the last id shown (?before=), so lines written
   meanwhile never push a line onto two pages. Filters: ?staff= (an id), ?action=, ?target_type=, ?target_id=, ?from= and
   ?to= (days, both included). Every value is a parameter of the query. */
export const GET = staffRoute("audit.read", async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  const staff = q.get("staff") ?? "";
  if (ID.test(staff)) add("a.staff_id = ?", staff);
  const action = cleanLine(q.get("action") ?? "", 80);
  if (action) add("a.action = ?", action);
  const type = cleanLine(q.get("target_type") ?? "", 40);
  if (type) add("a.target_type = ?", type);
  const target = cleanLine(q.get("target_id") ?? "", 80);
  if (target) add("a.target_id = ?", target);
  const from = q.get("from") ?? "";
  if (DAY.test(from) && !isNaN(Date.parse(from))) add("a.at >= ?::date", from);
  const to = q.get("to") ?? "";
  if (DAY.test(to) && !isNaN(Date.parse(to))) add("a.at < ?::date + 1", to);
  const before = q.get("before") ?? "";
  if (ID.test(before)) add("a.id < ?", before);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.at, a.staff_id, s.name AS staff_name, a.action, a.target_type, a.target_id, a.reason, a.ip, a.meta
       FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.id DESC LIMIT ${PAGE + 1}`,
    params,
  );
  /* the choices of the filters, from what the log holds */
  const [people, actions, types] = await Promise.all([
    pool.query(`SELECT id, name, active FROM staff ORDER BY lower(name)`),
    pool.query(`SELECT DISTINCT action FROM audit_log ORDER BY action LIMIT 300`),
    pool.query(`SELECT DISTINCT target_type FROM audit_log WHERE target_type IS NOT NULL ORDER BY target_type LIMIT 100`),
  ]);
  const page = rows.slice(0, PAGE);
  return answer({
    rows: page.map((r) => ({
      id: String(r.id), at: r.at, staffId: r.staff_id ? String(r.staff_id) : null, staffName: r.staff_name, action: r.action,
      targetType: r.target_type, targetId: r.target_id, reason: r.reason, ip: r.ip, meta: r.meta,
    })),
    next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
    staff: people.rows.map((p) => ({ id: String(p.id), name: p.name, active: p.active })),
    actions: actions.rows.map((a) => a.action),
    targetTypes: types.rows.map((t) => t.target_type),
  });
});
