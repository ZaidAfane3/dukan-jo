import type { QueryResultRow } from "pg";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";

/* One announcement as Diwan's list shows it, for the list (route.ts) and for the answer to a save (route.ts, [id]/route.ts),
   so the row a save answers with is the row the list will show. */

/** SQL true for an announcement of the past: ended by "End now" or by its own end (Diwan's "Past" list) */
export const ANNOUNCEMENT_ENDED = `(a.ends_at IS NOT NULL AND a.ends_at <= now())`;

/** The list's query, for the announcements `where` picks (none: all of them); the caller adds its order and limit */
export const announcementRowsSql = (where = "") =>
  `SELECT a.*, st.name AS by,
          CASE WHEN a.starts_at > now() THEN 'scheduled' WHEN ${ANNOUNCEMENT_ENDED} THEN 'ended' ELSE 'live' END AS status,
          /* who pressed "End now": the column, or for one ended before it existed, the activity log's line for it */
          COALESCE(eb.name, (SELECT s2.name FROM audit_log l JOIN staff s2 ON s2.id = l.staff_id
                              WHERE a.ended_by IS NULL AND a.ended_at IS NULL AND l.action = 'announcement.end'
                                AND l.target_type = 'announcement' AND l.target_id = a.id::text AND l.at >= a.starts_at
                              ORDER BY l.at DESC LIMIT 1)) AS ended_by_name,
          (SELECT count(*)::int FROM notification_reads r JOIN notifications n ON n.id = r.notification_id
            WHERE n.announcement_id = a.id AND n.account_id IS NULL) AS reads,
          (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id")}) AS reach
     FROM announcements a LEFT JOIN staff st ON st.id = a.created_by LEFT JOIN staff eb ON eb.id = a.ended_by
    ${where}`;

/** A row of that query as the list sends it */
export const announcementRow = (r: QueryResultRow) => ({
  id: String(r.id),
  titleEn: r.title_en, titleAr: r.title_ar, bodyEn: r.body_en, bodyAr: r.body_ar,
  audience: r.audience,
  banner: r.banner,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  createdAt: r.created_at,
  by: r.by,
  status: r.status,
  /* true when staff ended it early; false when it ran to the end it was given */
  endedEarly: !!r.ended_at || !!r.ended_by_name,
  endedBy: (r.ended_by_name as string | null) ?? null,
  reads: r.reads,
  reach: r.reach,
});

/** One announcement as the list shows it (null when it is gone) */
export async function oneAnnouncement(id: string) {
  const { rows } = await (await db()).query(announcementRowsSql("WHERE a.id = $1"), [id]);
  return rows[0] ? announcementRow(rows[0]) : null;
}
