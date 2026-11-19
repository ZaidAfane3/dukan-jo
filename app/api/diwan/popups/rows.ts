import type { QueryResultRow } from "pg";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";

/* One pop-up as Diwan's list shows it, for the list (route.ts) and for the answer to a save (route.ts, [id]/route.ts), so
   the row a save answers with is the row the list will show. */

/** SQL true for a pop-up of the past: ended by staff, or released and its end has passed (Diwan's "Past" list) */
export const POPUP_PAST = `(a.status = 'ended' OR (a.status = 'live' AND a.ends_at IS NOT NULL AND a.ends_at <= now()))`;
/* when it stopped: "End now" says (ended_at); one ended before that column: its last change, which was the end unless it
   was edited after; one whose end passed: that end */
const POPUP_STOPPED = `CASE WHEN a.status = 'ended' THEN COALESCE(a.ended_at, a.updated_at) ELSE a.ends_at END`;

/** The list's query, for the pop-ups `where` picks (none: all of them); the caller adds its order and limit */
export const popupRowsSql = (where = "") =>
  `SELECT a.*, st.name AS by, eb.name AS ended_by_name, ${POPUP_STOPPED} AS stopped_at,
          CASE WHEN a.status <> 'live' THEN a.status
               WHEN a.starts_at > now() THEN 'scheduled'
               WHEN a.ends_at IS NOT NULL AND a.ends_at <= now() THEN 'expired'
               ELSE 'showing' END AS shown,
          (SELECT count(*)::int FROM popup_views v WHERE v.popup_id = a.id) AS seen,
          (SELECT count(*)::int FROM popup_views v WHERE v.popup_id = a.id AND v.clicked_at IS NOT NULL) AS clicked,
          (SELECT count(*)::int FROM accounts acc WHERE ${AUDIENCE_HAS("acc.id")}) AS reach
     FROM popups a LEFT JOIN staff st ON st.id = a.created_by LEFT JOIN staff eb ON eb.id = a.ended_by
    ${where}`;

/** A row of that query as the list sends it */
export const popupRow = (r: QueryResultRow) => ({
  id: String(r.id),
  template: r.template, slots: r.slots, placement: r.placement, titleEn: r.title_en, titleAr: r.title_ar,
  status: r.status, shown: r.shown, audience: r.audience, priority: r.priority,
  startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at, updatedAt: r.updated_at, by: r.by,
  /* when it stopped showing, and who pressed "End now" (when known) */
  stoppedAt: r.stopped_at ?? null, endedBy: (r.ended_by_name as string | null) ?? null,
  reach: r.reach, seen: r.seen, clicked: r.clicked,
});

/** One pop-up as the list shows it (null when it is gone) */
export async function onePopup(id: string) {
  const { rows } = await (await db()).query(popupRowsSql("WHERE a.id = $1"), [id]);
  return rows[0] ? popupRow(rows[0]) : null;
}
