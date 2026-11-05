import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { FOR_ACCOUNT } from "@/server/announce";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant's bell from the server: what Dukkan sent this shop (server/notify.ts) and the live announcements meant for
   it, newest first, at most 50, each with whether it was read. The page words each one from its kind and params. */

export const GET = merchantRoute(async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT x.id, x.kind, x.params, x.ts,
            EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = x.id AND r.account_id = $1) AS read
       FROM (
         SELECT n.id, n.kind, n.params, n.created_at AS ts FROM notifications n WHERE n.account_id = $1
         UNION ALL
         SELECT n.id, 'announcement', jsonb_build_object('id', a.id::text, 'titleEn', a.title_en, 'titleAr', a.title_ar,
                  'bodyEn', a.body_en, 'bodyAr', a.body_ar, 'banner', a.banner), a.starts_at
           FROM announcements a JOIN notifications n ON n.announcement_id = a.id AND n.account_id IS NULL
          WHERE ${FOR_ACCOUNT(1)}
       ) x
      ORDER BY x.ts DESC
      LIMIT 50`,
    [me.id],
  );
  return answer({
    result: "ok",
    items: rows.map((r) => ({ id: String(r.id), kind: r.kind, params: r.params ?? {}, ts: new Date(r.ts).getTime(), read: r.read })),
  });
});
