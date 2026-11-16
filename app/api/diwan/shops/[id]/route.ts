import { answer } from "@/server/auth";
import { aboutShopSql, describeActivity } from "@/server/activityDetail";
import { db } from "@/server/db";
import { notFound, shopId } from "@/server/shopActions";
import { prepareShops, STATUS_SQL, syncShop } from "@/server/shops";
import { SHOWN_SQL } from "@/components/diwan/activityWords";
import { can, staffRoute } from "@/server/staff";
import { shopVisitors30 } from "@/server/storeVisits";

export const dynamic = "force-dynamic";

/* how many rows of each part of the store's history the page shows; "See all" opens the whole list, filtered to it */
const FEW = 5;

/* One shop, as Diwan shows it: the shop row, its owner, its status, and its whole history with Dukkan, each part with
   its count and newest rows: payments and themes bought, tickets (support, bugs and ideas), documents, reports about it,
   deleted orders and the activity log's lines about it. A part comes only to staff whose role may open its own page
   (payments: billing, tickets: tickets, and so on); for the others it is null and the page leaves it out.
   Never its products, orders or customers: only their counts and totals. Never a document's file: only what it is. */
export const GET = staffRoute("shops.read", async (req, staff, ctx) => {
  await prepareShops();
  let id = await shopId(ctx);
  const pool = await db();
  /* a merchant who signed up a moment ago may have no shop row yet (they are made once a minute): make his now, so a
     link from a payment or a ticket never lands on "not found" */
  if (!id && /^\d{1,18}$/.test(ctx.params.id ?? "")) {
    const { rows } = await pool.query(`SELECT id, created_at FROM accounts WHERE id = $1`, [ctx.params.id]);
    if (rows[0]) {
      await pool.query(`INSERT INTO shops (account_id, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [rows[0].id, rows[0].created_at]);
      await syncShop(rows[0].id, pool);
      id = String(rows[0].id);
    }
  }
  if (!id) return notFound();
  const q = (sql: string) => pool.query(sql, [id]).then((r) => r.rows);
  /* a part of the history: its newest rows and how many there are, or null when this staff member's role can't see it */
  const part = async (allowed: boolean, rowsSql: string, countSql: string) =>
    allowed ? { rows: await q(`${rowsSql} LIMIT ${FEW}`), count: Number((await q(countSql))[0]?.n ?? 0) } : null;
  const billing = can(staff, "billing");
  const [shop, payments, themes, tickets, documents, reports, deletions, activityRaw] = await Promise.all([
    q(`SELECT s.account_id AS id, s.name, s.slug, s.color, s.phone AS store_phone, s.setup_done, s.published, s.paused, s.ship_mode,
              s.pickup_city, s.pickup_address, s.status AS shop_status, s.suspend_reason, s.suspended_at, s.product_count, s.order_count,
              s.total_sales, s.first_product_at, s.published_at, s.first_order_at, s.last_seen_at, s.created_at,
              a.name AS owner, a.email, a.phone, a.last_login_at, a.login_count, a.totp_on, a.created_at AS signed_up,
              /* how many orders customers placed on its public page: a count only, never the orders (they are the shop's) */
              (SELECT count(*)::int FROM store_orders o WHERE o.account_id = s.account_id) AS storefront_orders,
              (${STATUS_SQL}) AS status
         FROM shops s JOIN accounts a ON a.id = s.account_id WHERE s.account_id = $1`),
    part(
      billing,
      `SELECT pay.id, pay.amount, pay.method, pay.reference, pay.paid_on::text AS paid_on, pay.note, st.name AS marked_by, pay.created_at
         FROM payments pay LEFT JOIN staff st ON st.id = pay.marked_by WHERE pay.account_id = $1 ORDER BY pay.paid_on DESC, pay.id DESC`,
      `SELECT count(*)::int AS n, COALESCE(sum(amount), 0)::numeric(14, 3) AS total FROM payments WHERE account_id = $1`,
    ),
    /* every theme it holds, free ones too (a free theme is no payment, so the Payments page lists only the paid ones) */
    part(
      billing,
      `SELECT tp.id, tp.theme_id, ct.name AS theme_name, tp.price, tp.method, tp.paid_at
         FROM theme_purchases tp LEFT JOIN catalog_themes ct ON ct.id = tp.theme_id WHERE tp.account_id = $1 ORDER BY tp.paid_at DESC, tp.id DESC`,
      `SELECT count(*)::int AS n FROM theme_purchases WHERE account_id = $1`,
    ),
    part(
      can(staff, "tickets"),
      `SELECT number, subject, kind, status, priority, created_at, updated_at FROM tickets WHERE account_id = $1 ORDER BY updated_at DESC, number DESC`,
      `SELECT count(*)::int AS n FROM tickets WHERE account_id = $1`,
    ),
    /* what each document is and where it stands, and its number among the store's documents of its kind; never its file */
    part(
      can(staff, "documents"),
      `SELECT d.public_id, d.kind, d.status, d.created_at, d.seq
         FROM (SELECT public_id, kind, status, created_at, id, row_number() OVER (PARTITION BY kind ORDER BY created_at, id)::int AS seq
                 FROM documents WHERE account_id = $1) d
        ORDER BY d.created_at DESC, d.id DESC`,
      `SELECT count(*)::int AS n FROM documents WHERE account_id = $1`,
    ),
    part(
      can(staff, "complaints"),
      `SELECT id, reason, status, reporter_kind, created_at FROM store_reports WHERE account_id = $1 ORDER BY created_at DESC, id DESC`,
      `SELECT count(*)::int AS n FROM store_reports WHERE account_id = $1`,
    ),
    part(
      true,
      `SELECT order_no, reason, deleted_by, deleted_at FROM order_deletions WHERE account_id = $1 ORDER BY deleted_at DESC`,
      `SELECT count(*)::int AS n FROM order_deletions WHERE account_id = $1`,
    ),
    part(
      can(staff, "audit.read"),
      `SELECT l.id, l.at, l.staff_id, st.name AS staff_name, l.action, l.target_type, l.target_id, l.reason, l.meta
         FROM audit_log l LEFT JOIN staff st ON st.id = l.staff_id
        WHERE ${aboutShopSql("l", "$1")} AND ${SHOWN_SQL("l")} ORDER BY l.at DESC, l.id DESC`,
      `SELECT count(*)::int AS n FROM audit_log l WHERE ${aboutShopSql("l", "$1")} AND ${SHOWN_SQL("l")}`,
    ),
  ]);
  /* the activity lines in words (server/activityDetail.ts: only safe facts leave the server) */
  const activity = activityRaw && { rows: await describeActivity(pool, activityRaw.rows), count: activityRaw.count };
  /* visitors of its store at its link over the last 30 days: a count only (server/storeVisits.ts) */
  const visitors30 = shop[0] ? await shopVisitors30(pool, id) : 0;
  const paymentsTotal = billing ? ((await q(`SELECT COALESCE(sum(amount), 0)::numeric(14, 3) AS t FROM payments WHERE account_id = $1`))[0]?.t ?? "0") : null;
  return answer({
    result: "ok",
    shop: shop[0] && { ...shop[0], visitors_30: visitors30 },
    payments: payments && { ...payments, total: paymentsTotal },
    themes,
    tickets,
    documents: documents && {
      ...documents,
      rows: documents.rows.map((d) => ({ id: String(d.public_id), kind: d.kind, status: d.status, created_at: d.created_at, seq: d.seq })),
    },
    reports,
    deletions,
    activity,
    can: {
      status: can(staff, "shops.status"),
      billing,
    },
  });
});
