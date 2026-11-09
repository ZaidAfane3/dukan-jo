import { answer } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** The one pop-up to show this shop now, or null: released, between its start and end, meant for this shop, not seen by
    it before, and made for this page (?at=home: the dashboard home, which shows home and any-page pop-ups; otherwise
    any-page pop-ups only). The most important first (priority), then the newest. It comes as its template and slots. */
export const GET = merchantRoute(async (req, me) => {
  const home = new URL(req.url).searchParams.get("at") === "home";
  const { rows } = await (await db()).query(
    `SELECT a.id, a.template, a.slots, a.placement
       FROM popups a
      WHERE a.status = 'live' AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
        AND (a.placement = 'any' OR $2::boolean)
        AND ${AUDIENCE_HAS("$1")}
        AND NOT EXISTS (SELECT 1 FROM popup_views v WHERE v.popup_id = a.id AND v.account_id = $1)
      ORDER BY a.priority DESC, a.starts_at DESC, a.id DESC
      LIMIT 1`,
    [me.id, home],
  );
  const r = rows[0];
  return answer({ result: "ok", popup: r ? { id: String(r.id), template: r.template, slots: r.slots ?? {}, placement: r.placement } : null });
});
