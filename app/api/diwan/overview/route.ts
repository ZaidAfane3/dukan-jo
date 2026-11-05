import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { CURRENT_SUB_SQL, prepareShops, STATUS_SQL } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's first page: the main numbers, what waits for staff in the other sections, and the newest shops. All live.
   Active: the merchant was seen in the last 14 days (signed in or used the dashboard). */
export const GET = staffRoute("shops.read", async () => {
  await prepareShops();
  const pool = await db();
  const [shops, subs, waiting, newest] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new_week,
             count(*) FILTER (WHERE last_seen_at > now() - interval '14 days')::int AS active,
             count(*) FILTER (WHERE status = 'suspended')::int AS suspended
        FROM shops`),
    pool.query(`
      SELECT count(DISTINCT sub.account_id) FILTER (WHERE sub.status = 'active' AND p.key <> 'trial')::int AS paying,
             count(*) FILTER (WHERE sub.ends_at BETWEEN now() AND now() + interval '14 days')::int AS expiring,
             count(*) FILTER (WHERE sub.ends_at BETWEEN now() AND now() + interval '14 days' AND p.key = 'trial')::int AS expiring_trials
        FROM subscriptions sub JOIN plans p ON p.id = sub.plan_id
       WHERE sub.status IN ('trial', 'active')`),
    pool.query(`
      SELECT (SELECT count(*) FROM tickets WHERE status NOT IN ('resolved', 'closed'))::int AS tickets,
             (SELECT count(*) FROM domains WHERE status = 'awaiting')::int AS domains,
             (SELECT count(*) FROM store_reports WHERE status = 'new')::int AS reports,
             (SELECT count(*) FROM documents WHERE status = 'waiting')::int AS documents`),
    pool.query(`
      SELECT s.account_id AS id, s.name, s.slug, a.name AS owner, s.created_at, s.setup_done, (${STATUS_SQL}) AS status
        FROM shops s JOIN accounts a ON a.id = s.account_id ${CURRENT_SUB_SQL}
       ORDER BY s.created_at DESC LIMIT 8`),
  ]);
  const k = shops.rows[0];
  return answer({
    result: "ok",
    total: k.total,
    newWeek: k.new_week,
    active: k.active,
    inactive: k.total - k.active,
    suspended: k.suspended,
    paying: subs.rows[0].paying,
    expiring: subs.rows[0].expiring,
    expiringTrials: subs.rows[0].expiring_trials,
    waiting: waiting.rows[0],
    newest: newest.rows,
  });
});
