import type { NextRequest } from "next/server";
import { answer, readJson, tooManyFor } from "@/server/auth";
import { lookupKeys } from "@/server/crypto";
import { db } from "@/server/db";
import { dayOf } from "@/server/shopActions";
import { likeText } from "@/server/shops";
import { audit, staffRoute, type Staff } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

const PAGE = 50;
/* Marked payments use bank, cliq, cash and card; the theme checkout takes card and cliq */
const METHODS = ["bank", "cliq", "cash", "card"];
const KINDS = ["payment", "theme"];

/* Every payment to Dukkan in one list: the payments staff marked as received (a store's page, "Mark as paid") and the
   themes merchants bought in the theme store, which are the only thing they pay Dukkan for by themselves today. A free
   theme is no payment, so only purchases with a price count. A purchase's day is its day in Jordan, so it sorts and
   filters with the marked payments' paid-on days. Newest first.
   Filters: kind (payment or theme), shop (one store's account id), method, from/to (paid on, yyyy-mm-dd), q (store name, owner email or mobile, the
   payment's reference, or the theme). Gives the total of what matches, and how each method was used (payments, JOD and
   stores) over the same kind, dates and search but every method, so the summary shows the whole picture while the list
   is narrowed. The same list for a CSV file (up to 20,000 rows, with every owner's email) is the POST below. */
async function payments(req: NextRequest, staff: Staff, exporting: boolean) {
  const p = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => `$${params.push(v)}`;
  /* one store only (its page's "See all") */
  const shop = p.get("shop") ?? "";
  if (/^\d{1,18}$/.test(shop)) where.push(`x.account_id = ${add(shop)}`);
  const from = dayOf(p.get("from"));
  if (from) where.push(`x.paid_on >= ${add(from)}::date`);
  const to = dayOf(p.get("to"));
  if (to) where.push(`x.paid_on <= ${add(to)}::date`);
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    const like = add(likeText(q));
    const [e, m] = lookupKeys(q);
    /* the owner's email and mobile are encrypted: found only when typed in full. A theme is found by its code name or
       the name the theme store gives it. */
    where.push(`(s.name ILIKE ${like} OR s.slug ILIKE ${like} OR x.reference ILIKE ${like} OR x.theme_id ILIKE ${like}
                 OR x.theme_name->>'en' ILIKE ${like} OR x.theme_name->>'ar' ILIKE ${like} OR a.email_hash = ${add(e)} OR a.phone_hash = ${add(m)})`);
  }
  /* both kinds as one set of rows with the same columns; a purchase has no reference, note or staff member */
  const joins = `FROM (
        SELECT 'payment' AS kind, pay.id, pay.account_id, pay.amount, pay.method, pay.reference, pay.paid_on, pay.note,
               st.name AS marked_by, pay.created_at, NULL::text AS theme_id, NULL::jsonb AS theme_name
          FROM payments pay LEFT JOIN staff st ON st.id = pay.marked_by
        UNION ALL
        SELECT 'theme', tp.id, tp.account_id, tp.price, tp.method, '', (tp.paid_at AT TIME ZONE 'Asia/Amman')::date, '',
               NULL, tp.paid_at, tp.theme_id, ct.name
          FROM theme_purchases tp LEFT JOIN catalog_themes ct ON ct.id = tp.theme_id
         WHERE tp.price > 0
      ) x JOIN accounts a ON a.id = x.account_id LEFT JOIN shops s ON s.account_id = x.account_id`;
  /* how many of each kind match the rest of the filters, for the page's tabs (before the kind is chosen) */
  const kindSql = `SELECT x.kind, count(*)::int AS n ${joins} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} GROUP BY x.kind`;
  const kindParams = [...params];
  const kind = p.get("kind");
  if (kind && KINDS.includes(kind)) where.push(`x.kind = ${add(kind)}`);
  /* the summary by method (and, as the ROLLUP row, every method together: GROUPING tells it apart from purchases made
     before the way to pay was recorded, whose method is empty too): before the method filter is added, with the
     parameters as they are now */
  const methodSql = `SELECT x.method, GROUPING(x.method) = 1 AS every, count(*)::int AS n, COALESCE(sum(x.amount), 0)::numeric(14, 3) AS total,
                            count(DISTINCT x.account_id)::int AS stores
                       ${joins} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} GROUP BY ROLLUP (x.method)`;
  const methodParams = [...params];
  const method = p.get("method");
  if (method && METHODS.includes(method)) where.push(`x.method = ${add(method)}`);
  const fromSql = `${joins} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(p.get("page") ?? "1", 10) || 1));
  const pool = await db();
  const [rows, sum, byMethod, byKind, shopRow] = await Promise.all([
    pool.query(
      `SELECT x.kind, x.id, x.account_id AS shop_id, s.name AS shop, a.name AS owner, a.email, x.amount, x.method, x.reference,
              x.paid_on::text AS paid_on, x.note, x.marked_by, x.theme_id, x.theme_name, x.created_at
         ${fromSql} ORDER BY x.paid_on DESC, x.created_at DESC, x.kind, x.id DESC
         LIMIT ${exporting ? 20_000 : PAGE} OFFSET ${exporting ? 0 : (page - 1) * PAGE}`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS n, COALESCE(sum(x.amount), 0)::numeric(14, 3) AS total ${fromSql}`, params),
    exporting ? null : pool.query(methodSql, methodParams),
    exporting ? null : pool.query(kindSql, kindParams),
    /* the store's name, for the note above a list narrowed to it */
    /^\d{1,18}$/.test(shop) && !exporting
      ? pool.query(`SELECT COALESCE(NULLIF(s.name, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = $1`, [shop])
      : null,
  ]);
  if (exporting) await audit(req, staff.id, "payments.export", undefined, null, { rows: rows.rows.length, filters: Object.fromEntries(p) });
  const n = sum.rows[0].n;
  /* every method, in a fixed order, even one nobody has used yet */
  const methods = METHODS.map((m) => {
    const r = byMethod?.rows.find((x) => !x.every && x.method === m);
    return { method: m, count: r?.n ?? 0, total: r?.total ?? "0.000", stores: r?.stores ?? 0 };
  });
  const all = byMethod?.rows.find((x) => x.every);
  return answer({
    result: "ok",
    rows: rows.rows,
    count: n,
    total: sum.rows[0].total,
    page,
    pages: Math.max(1, Math.ceil(n / PAGE)),
    methods,
    all: { count: all?.n ?? 0, total: all?.total ?? "0.000", stores: all?.stores ?? 0 },
    kinds: Object.fromEntries(KINDS.map((k) => [k, byKind?.rows.find((r) => r.kind === k)?.n ?? 0])),
    shopName: shopRow?.rows[0]?.name ?? null,
  });
}

export const GET = staffRoute("billing", (req, staff) => payments(req, staff, false));

/* The list as rows for a CSV file, with the same filters (in the address). Like the store list's export
   (app/api/diwan/shops/export) it holds the owners' names and emails, so it needs the staff member's own password with
   it ({ myPassword }, server/staffConfirm.ts passwordAgain), a few an hour, and the activity log keeps who exported,
   when, how many rows and with which filters. */
export const POST = staffRoute("billing", async (req, staff) => {
  if (tooManyFor(`diwan-export:${staff.id}`, 10, 60)) return answer({ result: "slow-down" }, 429);
  const refused = await passwordAgain(req, staff, (await readJson(req, 1_000))?.myPassword, "payments.export");
  if (refused) return refused;
  return payments(req, staff, true);
});
