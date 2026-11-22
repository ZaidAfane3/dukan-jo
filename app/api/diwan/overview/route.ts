import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { prepareShops, STATUS_SQL } from "@/server/shops";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's first page: the main numbers, what waits for staff in the other sections, and the newest shops. All live.
   Active: the merchant was seen in the last 14 days (signed in or used the dashboard). Dukkan has no plans and no free
   trial, so nothing here is about paying: published counts the stores that published their store. */
export const GET = staffRoute("shops.read", async () => {
  await prepareShops();
  const pool = await db();
  const [shops, waiting, newest] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE s.created_at > now() - interval '7 days')::int AS new_week,
             /* active: a store that isn't suspended and whose owner came in during the last 14 days (a suspended store is
                never counted as active, QA 169) */
             count(*) FILTER (WHERE s.last_seen_at > now() - interval '14 days' AND s.status <> 'suspended')::int AS active,
             count(*) FILTER (WHERE s.status = 'suspended')::int AS suspended,
             count(*) FILTER (WHERE s.published)::int AS published
        FROM shops s`),
    pool.query(`
      /* tickets: the support tickets that wait on Dukkan, the same kind the Tickets page lists (bug reports and ideas
         have their own board), and not the ones already answered that wait for the merchant, solved or closed */
      SELECT (SELECT count(*) FROM tickets WHERE kind = 'support' AND status IN ('new', 'open', 'waiting_dukkan'))::int AS tickets,
             (SELECT count(*) FROM store_reports WHERE status = 'new')::int AS reports,
             (SELECT count(*) FROM documents WHERE status = 'waiting' AND removed_at IS NULL AND NOT draft)::int AS documents`),
    pool.query(`
      SELECT s.account_id AS id, s.name, s.slug, a.name AS owner, s.created_at, s.setup_done, (${STATUS_SQL}) AS status
        FROM shops s JOIN accounts a ON a.id = s.account_id
       ORDER BY s.created_at DESC LIMIT 8`),
  ]);
  const k = shops.rows[0];
  return answer({
    result: "ok",
    total: k.total,
    newWeek: k.new_week,
    active: k.active,
    /* quiet: not suspended, and no visit from the owner for 14 days or more */
    inactive: k.total - k.suspended - k.active,
    suspended: k.suspended,
    published: k.published,
    waiting: waiting.rows[0],
    newest: newest.rows,
  });
});
