import { answer } from "@/server/auth";
import { AUDIENCE_HAS, PAGE_SINCE } from "@/server/announce";
import { db } from "@/server/db";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Dukkan's live pages meant for this shop (without their text), pages in the menu first, with whether he opened each */
export const GET = merchantRoute(async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT a.slug, a.title_en, a.title_ar, a.summary_en, a.summary_ar, a.in_menu, a.published_at,
            EXISTS (SELECT 1 FROM dukkan_page_views v WHERE v.page_id = a.id AND v.account_id = $1) AS seen
       FROM dukkan_pages a
      WHERE a.status = 'live' AND ${AUDIENCE_HAS("$1", PAGE_SINCE)}
      ORDER BY a.in_menu DESC, a.sort, a.published_at DESC
      LIMIT 200`,
    [me.id],
  );
  return answer({
    result: "ok",
    pages: rows.map((r) => ({
      slug: r.slug, titleEn: r.title_en, titleAr: r.title_ar, summaryEn: r.summary_en, summaryAr: r.summary_ar,
      inMenu: r.in_menu, publishedAt: r.published_at, seen: r.seen,
    })),
  });
});
