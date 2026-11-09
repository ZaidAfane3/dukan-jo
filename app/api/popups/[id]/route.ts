import { answer, readJson } from "@/server/auth";
import { AUDIENCE_HAS } from "@/server/announce";
import { db } from "@/server/db";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** The shop saw a pop-up ({ action: "seen" }: it is not shown to it again) or pressed its button ({ action: "clicked" }).
    Only a pop-up that is showing now and meant for this shop is counted. Answers "ok" or "bad". */
export const POST = merchantRoute(async (req, me, { params }) => {
  if (!/^\d{1,15}$/.test(params.id)) return answer({ result: "bad" }, 400);
  const body = await readJson(req, 200);
  const action = body?.action;
  if (action !== "seen" && action !== "clicked") return answer({ result: "bad" }, 400);
  await (await db()).query(
    `INSERT INTO popup_views (popup_id, account_id, clicked_at)
     SELECT a.id, $2, ${action === "clicked" ? "now()" : "NULL"} FROM popups a
      WHERE a.id = $1 AND a.status = 'live' AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now()) AND ${AUDIENCE_HAS("$2")}
     ON CONFLICT (popup_id, account_id) DO UPDATE SET clicked_at = COALESCE(popup_views.clicked_at, EXCLUDED.clicked_at)`,
    [params.id, me.id],
  );
  return answer({ result: "ok" });
});
