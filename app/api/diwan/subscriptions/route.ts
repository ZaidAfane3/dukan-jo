import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { expireSubscriptions } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Subscriptions for the Plans page. view=ending: current ones that end in the next `days` days (default 14);
   view=expired: shops with no current subscription, with the one that ran out last; view=all: every subscription,
   newest first. export=1 gives up to 20,000 rows for a CSV file and is logged. */
export const GET = staffRoute("billing", async (req, staff) => {
  const pool = await db();
  await expireSubscriptions(pool);
  const p = req.nextUrl.searchParams;
  const view = p.get("view") === "expired" ? "expired" : p.get("view") === "all" ? "all" : "ending";
  const days = Math.max(1, Math.min(365, Number.parseInt(p.get("days") ?? "14", 10) || 14));
  const exporting = p.get("export") === "1";
  const limit = exporting ? 20_000 : 200;
  const cols = `sub.id, sub.account_id AS shop_id, s.name AS shop, s.slug, a.name AS owner, a.email, pl.name_en, pl.name_ar, pl.key AS plan_key,
                sub.status, sub.starts_at, sub.ends_at, st.name AS set_by, sub.note`;
  const from = `FROM subscriptions sub JOIN plans pl ON pl.id = sub.plan_id JOIN accounts a ON a.id = sub.account_id
                LEFT JOIN shops s ON s.account_id = sub.account_id LEFT JOIN staff st ON st.id = sub.set_by`;
  const sql =
    view === "ending"
      ? `SELECT ${cols} ${from} WHERE sub.status IN ('trial', 'active') AND sub.ends_at BETWEEN now() AND now() + make_interval(days => $1)
          ORDER BY sub.ends_at LIMIT ${limit}`
      : view === "expired"
        ? `SELECT * FROM (SELECT DISTINCT ON (sub.account_id) ${cols} ${from}
             WHERE NOT EXISTS (SELECT 1 FROM subscriptions c WHERE c.account_id = sub.account_id AND c.status IN ('trial', 'active'))
             ORDER BY sub.account_id, sub.ends_at DESC NULLS LAST) x
           WHERE $1::int IS NOT NULL ORDER BY ends_at DESC NULLS LAST LIMIT ${limit}`
        : `SELECT ${cols} ${from} WHERE $1::int IS NOT NULL ORDER BY sub.created_at DESC LIMIT ${limit}`;
  const { rows } = await pool.query(sql, [days]);
  if (exporting) await audit(req, staff.id, "subscriptions.export", undefined, null, { view, days, rows: rows.length });
  return answer({ result: "ok", rows });
});
