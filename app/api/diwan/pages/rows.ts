import type { QueryResultRow } from "pg";
import { AUDIENCE_REACH, PAGE_SINCE } from "@/server/announce";
import { db } from "@/server/db";

/* One of Dukkan's pages as Diwan's list shows it, for the list (route.ts) and for the answer to a save (route.ts,
   [id]/route.ts), so the row a save answers with is the row the list will show. */

/** The list's query, for the pages `where` picks (none: all of them); the caller adds its order and limit */
export const pageRowsSql = (where = "") =>
  `SELECT a.*, st.name AS by,
          (SELECT count(*)::int FROM dukkan_page_views v WHERE v.page_id = a.id) AS views,
          ${AUDIENCE_REACH(PAGE_SINCE)} AS reach
     FROM dukkan_pages a LEFT JOIN staff st ON st.id = a.updated_by
    ${where}`;

/** A row of that query as the list sends it */
export const pageRow = (r: QueryResultRow) => ({
  id: String(r.id), slug: r.slug,
  titleEn: r.title_en, titleAr: r.title_ar, summaryEn: r.summary_en, summaryAr: r.summary_ar, bodyEn: r.body_en, bodyAr: r.body_ar,
  status: r.status, inMenu: r.in_menu, sort: r.sort, audience: r.audience,
  publishedAt: r.published_at, updatedAt: r.updated_at, createdAt: r.created_at, by: r.by,
  views: r.views, reach: r.reach,
});

/** One page as the list shows it (null when it is gone) */
export async function onePage(id: string) {
  const { rows } = await (await db()).query(pageRowsSql("WHERE a.id = $1"), [id]);
  return rows[0] ? pageRow(rows[0]) : null;
}
