import { answer } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** The one pop-up to show this shop now, or null: released, between its start and end, meant for this shop, and not seen
    by it before. The most important first (priority), then the newest. */
export const GET = merchantRoute(async (_req, me) => {
  const { rows } = await (await db()).query(
    `SELECT a.id, a.title_en, a.title_ar, a.body_en, a.body_ar, a.image, a.button_en, a.button_ar, a.button_link
       FROM popups a
      WHERE a.status = 'live' AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
        AND ${AUDIENCE_HAS("$1")}
        AND NOT EXISTS (SELECT 1 FROM popup_views v WHERE v.popup_id = a.id AND v.account_id = $1)
      ORDER BY a.priority DESC, a.starts_at DESC, a.id DESC
      LIMIT 1`,
    [me.id],
  );
  const r = rows[0];
  return answer({
    result: "ok",
    popup: r
      ? { id: String(r.id), titleEn: r.title_en, titleAr: r.title_ar, bodyEn: r.body_en, bodyAr: r.body_ar, image: r.image, buttonEn: r.button_en, buttonAr: r.button_ar, buttonLink: r.button_link }
      : null,
  });
});
