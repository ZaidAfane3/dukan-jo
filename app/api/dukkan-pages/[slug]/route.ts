import { PAGE_SLUG } from "@/components/dukkanPageRules";
import { answer } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** One of Dukkan's live pages meant for this shop, with its text. Opening it counts once per shop (Diwan's "views"). */
export const GET = merchantRoute(async (_req, me, { params }) => {
  if (!PAGE_SLUG.test(params.slug ?? "")) return answer({ result: "missing" }, 404);
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT a.id, a.slug, a.title_en, a.title_ar, a.summary_en, a.summary_ar, a.body_en, a.body_ar, a.in_menu, a.published_at
       FROM dukkan_pages a
      WHERE a.slug = $2 AND a.status = 'live' AND ${AUDIENCE_HAS("$1")}`,
    [me.id, params.slug],
  );
  const r = rows[0];
  if (!r) return answer({ result: "missing" }, 404);
  await pool.query(`INSERT INTO dukkan_page_views (page_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.id, me.id]);
  return answer({
    result: "ok",
    page: {
      slug: r.slug, titleEn: r.title_en, titleAr: r.title_ar, summaryEn: r.summary_en, summaryAr: r.summary_ar,
      bodyEn: r.body_en, bodyAr: r.body_ar, inMenu: r.in_menu, publishedAt: r.published_at, seen: true,
    },
  });
});
