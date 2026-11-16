import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { notFound, shopId } from "@/server/shopActions";
import { prepareShops, STATUS_SQL } from "@/server/shops";
import { SHOWN_SQL } from "@/components/diwan/activityWords";
import { can, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* One shop, as Diwan shows it: the shop row, its owner, its status, and what the other tables hold about it.
   Never its products, orders or customers: only their counts and totals. Every opening is logged (shop.view). */
export const GET = staffRoute("shops.read", async (req, staff, ctx) => {
  await prepareShops();
  const id = await shopId(ctx);
  if (!id) return notFound();
  const pool = await db();
  const q = (sql: string) => pool.query(sql, [id]).then((r) => r.rows);
  const [shop, payments, themes, tickets, deletions, reports, documents, activity] = await Promise.all([
    q(`SELECT s.account_id AS id, s.name, s.slug, s.color, s.phone AS store_phone, s.setup_done, s.published, s.paused, s.ship_mode,
              s.pickup_city, s.pickup_address, s.status AS shop_status, s.suspend_reason, s.suspended_at, s.product_count, s.order_count,
              s.total_sales, s.first_product_at, s.published_at, s.first_order_at, s.last_seen_at, s.created_at,
              a.name AS owner, a.email, a.phone, a.last_login_at, a.login_count, a.totp_on, a.created_at AS signed_up,
              (${STATUS_SQL}) AS status
         FROM shops s JOIN accounts a ON a.id = s.account_id WHERE s.account_id = $1`),
    q(`SELECT pay.id, pay.amount, pay.method, pay.reference, pay.paid_on::text AS paid_on, pay.note, st.name AS marked_by, pay.created_at
         FROM payments pay LEFT JOIN staff st ON st.id = pay.marked_by WHERE pay.account_id = $1 ORDER BY pay.paid_on DESC, pay.id DESC LIMIT 100`),
    q(`SELECT id, theme_id, price, paid_at FROM theme_purchases WHERE account_id = $1 ORDER BY paid_at DESC LIMIT 100`),
    q(`SELECT number, subject, kind, status, created_at FROM tickets WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT order_no, reason, deleted_by, deleted_at FROM order_deletions WHERE account_id = $1 ORDER BY deleted_at DESC LIMIT 100`),
    q(`SELECT id, reason, status, created_at FROM store_reports WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT id, kind, name, status, created_at FROM documents WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100`),
    q(`SELECT l.id, l.at, l.action, l.reason, st.name AS staff
         FROM audit_log l LEFT JOIN staff st ON st.id = l.staff_id
        WHERE l.target_type = 'shop' AND l.target_id = $1::text AND ${SHOWN_SQL("l")} ORDER BY l.at DESC LIMIT 100`),
  ]);
  return answer({
    result: "ok",
    shop: shop[0],
    payments,
    themes,
    tickets,
    deletions,
    reports,
    documents,
    activity: can(staff, "audit.read") ? activity : [],
    can: {
      status: can(staff, "shops.status"),
      billing: can(staff, "billing"),
    },
  });
});
