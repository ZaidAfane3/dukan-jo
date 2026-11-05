import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanLine, cleanLines } from "@/components/safe";

export const dynamic = "force-dynamic";

/* Ready answers staff put into the reply box: platform_settings 'canned_replies' = [{ title, body_en, body_ar }] */
type Canned = { title: string; body_en: string; body_ar: string };
const KEY = "canned_replies";

export const GET = staffRoute("tickets", async () => {
  const { rows } = await (await db()).query(`SELECT value FROM platform_settings WHERE key = $1`, [KEY]);
  return answer({ result: "ok", replies: Array.isArray(rows[0]?.value) ? rows[0].value : [] });
});

/** Saves the whole list: { replies: [{ title, body_en, body_ar }] } (at most 50; each needs a title and one text) */
export const PUT = staffRoute("tickets", async (req, staff) => {
  const body = await readJson(req, 300_000);
  if (!body || !Array.isArray(body.replies) || body.replies.length > 50) return answer({ result: "bad" }, 400);
  const replies: Canned[] = [];
  for (const r of body.replies as Record<string, unknown>[]) {
    const c = { title: cleanLine(r?.title, 80), body_en: cleanLines(r?.body_en, 3000), body_ar: cleanLines(r?.body_ar, 3000) };
    if (!c.title || (!c.body_en && !c.body_ar)) return answer({ result: "bad" }, 400);
    replies.push(c);
  }
  await (await db()).query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [KEY, JSON.stringify(replies), staff.id],
  );
  await audit(req, staff.id, "tickets.canned.save", { type: "setting", id: KEY }, null, { count: replies.length });
  return answer({ result: "ok", replies });
});
