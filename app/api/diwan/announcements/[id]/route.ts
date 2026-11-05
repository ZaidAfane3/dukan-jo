import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanAnnouncement } from "@/server/announce";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const idOf = (v: string | undefined) => (/^\d{1,15}$/.test(v ?? "") ? v! : null);

/** Edits an announcement (the shops that already read it keep their read) */
export const PUT = staffRoute("announce", async (req, staff, ctx) => {
  const id = idOf(ctx.params.id);
  const body = await readJson(req, 50_000);
  if (!id || !body) return answer({ result: "bad" }, 400);
  const a = await cleanAnnouncement(body);
  if ("bad" in a) return answer({ result: "bad", field: a.bad }, 400);
  const { rowCount } = await (await db()).query(
    `UPDATE announcements SET title_en = $2, title_ar = $3, body_en = $4, body_ar = $5, audience = $6, banner = $7, starts_at = $8, ends_at = $9
      WHERE id = $1`,
    [id, a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, JSON.stringify(a.audience), a.banner, a.startsAt, a.endsAt],
  );
  if (!rowCount) return answer({ result: "none" }, 404);
  await audit(req, staff.id, "announcement.edit", { type: "announcement", id }, null, { title: a.titleEn, audience: a.audience, banner: a.banner });
  return answer({ result: "ok" });
});

/** Ends an announcement now: { end: true } */
export const PATCH = staffRoute("announce", async (req, staff, ctx) => {
  const id = idOf(ctx.params.id);
  const body = await readJson(req, 500);
  if (!id || body?.end !== true) return answer({ result: "bad" }, 400);
  const { rowCount } = await (await db()).query(
    `UPDATE announcements SET ends_at = now(), starts_at = LEAST(starts_at, now()) WHERE id = $1 AND (ends_at IS NULL OR ends_at > now())`,
    [id],
  );
  if (!rowCount) return answer({ result: "none" }, 404);
  await audit(req, staff.id, "announcement.end", { type: "announcement", id });
  return answer({ result: "ok" });
});

/** Deletes an announcement (its bell row and reads go with it) */
export const DELETE = staffRoute("announce", async (req, staff, ctx) => {
  const id = idOf(ctx.params.id);
  if (!id) return answer({ result: "bad" }, 400);
  const { rows } = await (await db()).query(`DELETE FROM announcements WHERE id = $1 RETURNING title_en`, [id]);
  if (!rows[0]) return answer({ result: "none" }, 404);
  await audit(req, staff.id, "announcement.delete", { type: "announcement", id }, null, { title: rows[0].title_en });
  return answer({ result: "ok" });
});
