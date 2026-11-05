import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { FOR_ACCOUNT } from "@/server/announce";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Marks bell items as read: { ids: [...] } or { all: true }. Only the shop's own notifications and the live
    announcements meant for it can be marked (an announcement read here counts in Diwan's "read by"). */
export const POST = merchantRoute(async (req, me) => {
  const body = await readJson(req, 5000);
  const all = body?.all === true;
  const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((v): v is string => typeof v === "string" && /^\d{1,15}$/.test(v)).slice(0, 100) : [];
  if (!all && !ids.length) return answer({ result: "bad" }, 400);
  const { rowCount } = await (await db()).query(
    `INSERT INTO notification_reads (notification_id, account_id)
     SELECT n.id, $1 FROM notifications n
      WHERE ($2::boolean OR n.id = ANY($3::bigint[]))
        AND (n.account_id = $1
             OR (n.account_id IS NULL AND EXISTS (SELECT 1 FROM announcements a WHERE a.id = n.announcement_id AND ${FOR_ACCOUNT(1)})))
     ON CONFLICT DO NOTHING`,
    [me.id, all, ids],
  );
  return answer({ result: "ok", marked: rowCount ?? 0 });
});
