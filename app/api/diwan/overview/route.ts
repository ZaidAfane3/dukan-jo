import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { CURRENT_SUB_SQL, prepareShops, STATUS_SQL } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's first page: the main numbers, what waits for staff in the other sections, and the newest shops. All live.
   Active: the merchant was seen in the last 14 days (signed in or used the dashboard). Dukkan has no plans for now, so
   nothing here is about paying: published counts the stores that published their store, on trial those in their free trial. */
export const GET = staffRoute("shops.read", async () => {
  await prepareShops();
  const pool = await db();
  const [shops, waiting, newest] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE s.created_at > now() - interval '7 days')::int AS new_week,
             count(*) FILTER (WHERE s.last_seen_at > now() - interval '14 days')::int AS active,
             count(*) FILTER (WHERE s.status = 'suspended')::int AS suspended,
             count(*) FILTER (WHERE s.published)::int AS published,
             count(*) FILTER (WHERE (${STATUS_SQL}) = 'trial')::int AS on_trial
        FROM shops s ${CURRENT_SUB_SQL}`),
    pool.query(`
      SELECT (SELECT count(*) FROM tickets WHERE status NOT IN ('resolved', 'closed'))::int AS tickets,
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
    published: k.published,
    onTrial: k.on_trial,
    waiting: waiting.rows[0],
    newest: newest.rows,
  });
});
