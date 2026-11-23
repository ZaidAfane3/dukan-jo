import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { FOR_ACCOUNT } from "@/server/announce";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant's bell from the server: what Dukkan sent this shop (server/notify.ts), its newest 50, and every live
   announcement meant for it (never pushed out by a busy store's own notices: the home page's banner and the bell need
   them all), newest first, each with whether it was read. The page words each one from its kind and params.
   Old "domainStatus" notices (from when Dukkan connected merchants' own domains) stay in the table but are left out:
   every store now lives at the site address/<its link>, so they would point to something that no longer exists. Old
   "planChanged" notices ("Your plan is now ...") are left out the same way: Dukkan has no plans or free trial.
   An announcement is dated from when it reached the store (its start, or when "Start again" sent it out again): never
   before the store existed. */

export const GET = merchantRoute(async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT x.id, x.kind, x.params, x.ts,
            EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = x.id AND r.account_id = $1) AS read
       FROM (
         (SELECT n.id, n.kind, n.params, n.created_at AS ts FROM notifications n WHERE n.account_id = $1 AND n.kind NOT IN ('domainStatus', 'planChanged')
           ORDER BY n.created_at DESC LIMIT 50)
         UNION ALL
         SELECT n.id, 'announcement', jsonb_build_object('id', a.id::text, 'titleEn', a.title_en, 'titleAr', a.title_ar,
                  'bodyEn', a.body_en, 'bodyAr', a.body_ar, 'banner', a.banner),
                /* dated when it reached this store: its start (or its restart), or when the store joined if that was
                   later (GREATEST skips a null restarted_at) */
                GREATEST(a.starts_at, a.restarted_at, (SELECT ac.created_at FROM accounts ac WHERE ac.id = $1))
           FROM announcements a JOIN notifications n ON n.announcement_id = a.id AND n.account_id IS NULL
          WHERE ${FOR_ACCOUNT(1)}
       ) x
      ORDER BY x.ts DESC`,
    [me.id],
  );
  return answer({
    result: "ok",
    items: rows.map((r) => ({ id: String(r.id), kind: r.kind, params: r.params ?? {}, ts: new Date(r.ts).getTime(), read: r.read })),
  });
});
