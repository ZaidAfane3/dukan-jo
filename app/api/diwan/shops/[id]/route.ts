import { answer } from "@/server/auth";
import { aboutShopSql, describeActivity } from "@/server/activityDetail";
import { db } from "@/server/db";
import { notFound, shopId } from "@/server/shopActions";
import { ORDERS_SQL, prepareShops, SALES_SQL, STATUS_SQL, STORE_ORDERS_SQL, syncShop } from "@/server/shops";
import { SHOWN_SQL } from "@/components/diwan/activityWords";
import { can, staffRoute } from "@/server/staff";
import { shopVisitors30 } from "@/server/storeVisits";
import { FREE_THEME_IDS } from "@/components/platformDefaults";
import { CODE_THEME_IDS, type Bi } from "@/components/themeListing";
import { themePrice } from "@/components/themePrices";
import { enforcedPaidThemes } from "@/server/themeOwnership";
import { sellPlatform } from "@/server/storeOrders";
import { cleanSetup } from "@/components/safeAccount";
import { readyToSell, type SellNeed } from "@/components/safeOrder";

export const dynamic = "force-dynamic";

/** The theme the store uses now (shops.theme_id, worked out from its saved seen-themes by server/shops.ts themeOf, the same
    column the Themes page counts "stores use it" from). kind: "free" one of the free designs every store has (Dukkan, Mada),
    "listed" a theme in the theme store's list, "code" a code theme with no row in the list, "removed" a theme deleted from
    the list since. how: "free" it costs nothing, "bought" a purchase is recorded, "not_bought" it has a price (or had one)
    and no purchase is recorded. shownFree: it is a theme for sale at a price now with no purchase, so the public store
    shows the free theme in its place (server/publicStore.ts). When it was chosen is not saved anywhere, so it is not sent. */
export type ThemeInUse = { id: string; name: Bi | null; kind: "free" | "listed" | "code" | "removed"; how: "free" | "bought" | "not_bought"; shownFree?: boolean };

const biOf = (v: unknown): Bi | null =>
  v && typeof v === "object" && typeof (v as Bi).en === "string" && typeof (v as Bi).ar === "string" && ((v as Bi).en || (v as Bi).ar) ? { en: (v as Bi).en, ar: (v as Bi).ar } : null;

function themeInUse(r: Record<string, unknown>): ThemeInUse {
  const id = typeof r.theme_id === "string" && r.theme_id ? r.theme_id : "dukkan";
  const free = (FREE_THEME_IDS as readonly string[]).includes(id);
  const listed = r.theme_source != null;
  const kind = free ? "free" : listed ? "listed" : CODE_THEME_IDS.includes(id) ? "code" : "removed";
  /* its price now: the list's, or the code's for a code theme with no row there; unknown for a removed one */
  const price = listed ? Number(r.theme_list_price) : kind === "code" ? themePrice(id) : null;
  const how =
    free ? "free"
    : r.theme_paid != null ? (Number(r.theme_paid) > 0 ? "bought" : "free")
    : kind === "removed" || (price ?? 0) > 0 ? "not_bought"
    : "free";
  /* the list's name; for a removed theme the name it had when it was deleted (kept in the activity log); else none (the
     page names the code themes and the free designs itself) */
  return { id, name: biOf(listed ? r.theme_listed_name : r.theme_deleted_name), kind, how };
}

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
    q(`SELECT s.account_id AS id, s.name, s.slug, s.color, s.phone AS store_phone, s.setup_done, s.published, s.paused, s.ship_mode, s.ship_name, s.pickup, s.store_pays,
              s.pickup_city, s.pickup_address, s.status AS shop_status, s.suspend_reason, s.suspended_at, s.product_count,
              /* its orders and sales as the merchant's Home shows them: its own and its store page's, without the card
                 and CliQ test orders (server/shops.ts STORE_ORDERS_SQL) */
              ${ORDERS_SQL} AS order_count, ${SALES_SQL} AS total_sales, s.first_product_at, s.published_at, s.last_seen_at, s.created_at,
              /* the oldest order: the one the merchant's saved orders give, or an older one customers placed on its page */
              LEAST(s.first_order_at, (SELECT min(o.created_at) FROM store_orders o WHERE o.account_id = s.account_id)) AS first_order_at,
              a.name AS owner, a.email, a.phone, a.last_login_at, a.login_count, a.totp_on, a.created_at AS signed_up,
              /* how many orders customers placed on its public page (in order_count too), and the card/CliQ test orders
                 left out of both: counts only, never the orders (they are the shop's) */
              so.n AS storefront_orders, so.test AS storefront_test,
              (${STATUS_SQL}) AS status,
              /* the theme in use (themeInUse above): its row in the theme store's list, the store's purchase of it, and for
                 one deleted from the list the name the activity log kept */
              s.theme_id, ct.name AS theme_listed_name, ct.source AS theme_source, ct.price::float AS theme_list_price,
              tp.price::float AS theme_paid,
              CASE WHEN ct.id IS NULL THEN (SELECT l.meta->'name' FROM audit_log l WHERE l.action = 'theme.delete' AND l.target_type = 'theme'
                                              AND l.target_id = s.theme_id ORDER BY l.at DESC LIMIT 1) END AS theme_deleted_name
         FROM shops s JOIN accounts a ON a.id = s.account_id
         LEFT JOIN LATERAL ${STORE_ORDERS_SQL("s")} so ON true
         LEFT JOIN catalog_themes ct ON ct.id = s.theme_id
         LEFT JOIN theme_purchases tp ON tp.account_id = s.account_id AND tp.theme_id = s.theme_id
        WHERE s.account_id = $1`),
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
    /* what each document is and where it stands, its number among the store's documents of its kind, and when the
       merchant removed it (the row stays as a record); never its file */
    part(
      can(staff, "documents"),
      `SELECT public_id, kind, status, created_at, seq, removed_at FROM documents WHERE account_id = $1 ORDER BY created_at DESC, id DESC`,
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
  /* a store whose row counts products or orders without the date of the first one (counted before those dates were
     worked out from the saved data): worked out again now, once, from its saved products' and orders' own times */
  const sh0 = shop[0];
  if (sh0 && ((sh0.product_count > 0 && !sh0.first_product_at) || (sh0.order_count > 0 && !sh0.first_order_at))) {
    await syncShop(id, pool).catch((e) => console.error("[shops] sync", id, e));
    const again = await q(
      `SELECT s.first_product_at, LEAST(s.first_order_at, (SELECT min(o.created_at) FROM store_orders o WHERE o.account_id = s.account_id)) AS first_order_at
         FROM shops s WHERE s.account_id = $1`,
    );
    if (again[0]) Object.assign(sh0, again[0]);
  }
  /* the activity lines in words (server/activityDetail.ts: only safe facts leave the server) */
  const activity = activityRaw && { rows: await describeActivity(pool, activityRaw.rows), count: activityRaw.count };
  /* visitors of its store at its link over the last 30 days: a count only (server/storeVisits.ts) */
  const visitors30 = shop[0] ? await shopVisitors30(pool, id) : 0;
  /* what the store still needs before it can sell (safeOrder readyToSell, the rule the merchant's pages and his saves
     follow): only "pay" / "delivery" leave the server, never his setup */
  let notReady: SellNeed[] = [];
  if (shop[0]) {
    const saved = await q(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-setup'`);
    let setup = null;
    try {
      setup = saved[0] ? cleanSetup(JSON.parse(saved[0].value)) : null;
    } catch {
      setup = null;
    }
    notReady = readyToSell(setup, await sellPlatform()).missing;
  }
  /* the theme columns leave the shop row: they go out as one "theme" */
  const { theme_id, theme_listed_name, theme_source, theme_list_price, theme_paid, theme_deleted_name, ...shopRow } = shop[0] ?? {};
  const inUse = shop[0] ? themeInUse({ theme_id, theme_listed_name, theme_source, theme_list_price, theme_paid, theme_deleted_name }) : null;
  /* a paid theme with no purchase is not shown to its customers: the store shows the free theme (server/themeOwnership.ts,
     the same rule as the public store) */
  const theme = inUse && { ...inUse, shownFree: inUse.how === "not_bought" && (await enforcedPaidThemes(pool)).has(inUse.id) };
  const paymentsTotal = billing ? ((await q(`SELECT COALESCE(sum(amount), 0)::numeric(14, 3) AS t FROM payments WHERE account_id = $1`))[0]?.t ?? "0") : null;
  return answer({
    result: "ok",
    shop: shop[0] && { ...shopRow, visitors_30: visitors30, not_ready: notReady },
    theme,
    payments: payments && { ...payments, total: paymentsTotal },
    themes,
    tickets,
    documents: documents && {
      ...documents,
      rows: documents.rows.map((d) => ({
        id: String(d.public_id), kind: d.kind, status: d.status, created_at: d.created_at, seq: d.seq,
        removed_at: d.removed_at ? new Date(d.removed_at).toISOString() : null,
      })),
    },
    reports,
    deletions,
    activity,
    can: {
      status: can(staff, "shops.status"),
      billing,
      /* the Themes page (the theme in use links to it) */
      themes: can(staff, "marketplace"),
    },
  });
});
