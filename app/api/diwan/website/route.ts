import type { NextRequest } from "next/server";
import { changedParts, cleanSiteContent, SITE_DEFAULTS } from "@/components/siteContent";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The landing page's content (Diwan > Website). One platform_settings row, 'site_content'; no row means the page shows
   today's texts (SITE_DEFAULTS). */

async function saved() {
  const { rows } = await (await db()).query(
    `SELECT p.value, p.updated_at, s.name AS by FROM platform_settings p LEFT JOIN staff s ON s.id = p.updated_by WHERE p.key = 'site_content'`,
  );
  const r = rows[0];
  return { content: cleanSiteContent(r?.value).content, saved: !!r, updatedAt: r?.updated_at ?? null, by: r?.by ?? null };
}

/** The saved content (or today's texts), the original texts for "Reset", and when and by whom it was last changed */
export const GET = staffRoute("settings", async () => answer({ ...(await saved()), defaults: SITE_DEFAULTS }));

/** Saves the whole content: { content }. A part that fails its check is not saved quietly as something else: the answer
    names the fields to fix and nothing changes. The activity log keeps which parts changed, not the words. */
export const PUT = staffRoute("settings", async (req: NextRequest, me) => {
  const body = await readJson(req, 200_000);
  if (!body || typeof body.content !== "object" || body.content === null) return answer({ result: "invalid", fields: ["content"] }, 400);
  const { content, bad } = cleanSiteContent(body.content);
  if (bad.length) return answer({ result: "invalid", fields: bad }, 400);
  const before = await saved();
  const changed = changedParts(before.content, content);
  await (await db()).query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('site_content', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [JSON.stringify(content), me.id],
  );
  if (changed.length) await audit(req, me.id, "website.change", { type: "setting", id: "site_content" }, null, { changed });
  return answer({ result: "ok", content, changed });
});

/** Puts every part of the page back to today's texts by removing the saved row */
export const DELETE = staffRoute("settings", async (req: NextRequest, me) => {
  const before = await saved();
  await (await db()).query(`DELETE FROM platform_settings WHERE key = 'site_content'`);
  if (before.saved) await audit(req, me.id, "website.reset", { type: "setting", id: "site_content" }, null, { changed: changedParts(before.content, SITE_DEFAULTS) });
  return answer({ result: "ok", content: SITE_DEFAULTS });
});
