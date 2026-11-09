import { answer } from "@/server/auth";
import { lookupKeys } from "@/server/crypto";
import { db } from "@/server/db";
import { dayOf } from "@/server/shopActions";
import { likeText } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const PAGE = 50;
const METHODS = ["bank", "cliq", "cash", "card"];

/* Payments marked as received, newest first. Filters: method, from/to (paid on, yyyy-mm-dd), q (store name, owner,
   email or the payment's reference). Gives the total of what matches, and how each method was used (payments, JOD and
   stores) over the same dates and search but every method, so the summary shows the whole picture while the list is
   narrowed. export=1 gives up to 20,000 rows for a CSV file and is logged. */
export const GET = staffRoute("billing", async (req, staff) => {
  const p = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => `$${params.push(v)}`;
  const from = dayOf(p.get("from"));
  if (from) where.push(`pay.paid_on >= ${add(from)}::date`);
  const to = dayOf(p.get("to"));
  if (to) where.push(`pay.paid_on <= ${add(to)}::date`);
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const like = add(likeText(q));
    const [e, m] = lookupKeys(q);
    /* the owner's email and mobile are encrypted: found only when typed in full */
    where.push(`(s.name ILIKE ${like} OR s.slug ILIKE ${like} OR pay.reference ILIKE ${like} OR a.email_hash = ${add(e)} OR a.phone_hash = ${add(m)})`);
  }
  const joins = `FROM payments pay JOIN accounts a ON a.id = pay.account_id LEFT JOIN shops s ON s.account_id = pay.account_id
                 LEFT JOIN staff st ON st.id = pay.marked_by`;
  /* the summary by method (and, as the ROLLUP row with no method, every method together): before the method filter is
     added, with the parameters as they are now */
  const methodSql = `SELECT pay.method, count(*)::int AS n, COALESCE(sum(pay.amount), 0)::numeric(14, 3) AS total, count(DISTINCT pay.account_id)::int AS stores
                       ${joins} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} GROUP BY ROLLUP (pay.method)`;
  const methodParams = [...params];
  const method = p.get("method");
  if (method && METHODS.includes(method)) where.push(`pay.method = ${add(method)}`);
  const fromSql = `${joins} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const exporting = p.get("export") === "1";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(p.get("page") ?? "1", 10) || 1));
  const pool = await db();
  const [rows, sum, byMethod] = await Promise.all([
    pool.query(
      `SELECT pay.id, pay.account_id AS shop_id, s.name AS shop, a.name AS owner, a.email, pay.amount, pay.method, pay.reference, pay.paid_on::text AS paid_on,
              pay.note, st.name AS marked_by, pay.created_at
         ${fromSql} ORDER BY pay.paid_on DESC, pay.id DESC LIMIT ${exporting ? 20_000 : PAGE} OFFSET ${exporting ? 0 : (page - 1) * PAGE}`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS n, COALESCE(sum(pay.amount), 0)::numeric(14, 3) AS total ${fromSql}`, params),
    exporting ? null : pool.query(methodSql, methodParams),
  ]);
  if (exporting) await audit(req, staff.id, "payments.export", undefined, null, { rows: rows.rows.length, filters: Object.fromEntries(p) });
  const n = sum.rows[0].n;
  /* every method, in a fixed order, even one nobody has used yet */
  const methods = METHODS.map((m) => {
    const r = byMethod?.rows.find((x) => x.method === m);
    return { method: m, count: r?.n ?? 0, total: r?.total ?? "0.000", stores: r?.stores ?? 0 };
  });
  const all = byMethod?.rows.find((x) => x.method === null);
  return answer({
    result: "ok",
    rows: rows.rows,
    count: n,
    total: sum.rows[0].total,
    page,
    pages: Math.max(1, Math.ceil(n / PAGE)),
    methods,
    all: { count: all?.n ?? 0, total: all?.total ?? "0.000", stores: all?.stores ?? 0 },
  });
});
