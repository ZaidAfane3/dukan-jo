import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanAnnouncement } from "@/server/announce";
import { cleanWhen } from "@/server/audience";
import { audit, staffRoute } from "@/server/staff";
import { plainParams } from "@/server/crypto";
import { oneAnnouncement } from "../rows";

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
    `UPDATE announcements SET title_en = $2, title_ar = $3, body_en = $4, body_ar = $5, audience = $6, banner = $7, starts_at = $8, ends_at = $9,
            /* an edit that puts its end back in the future makes it current again: no longer "ended early" */
            ended_at = CASE WHEN $9::timestamptz IS NULL OR $9::timestamptz > now() THEN NULL ELSE ended_at END,
            ended_by = CASE WHEN $9::timestamptz IS NULL OR $9::timestamptz > now() THEN NULL ELSE ended_by END
      WHERE id = $1`,
    plainParams([id, a.titleEn, a.titleAr, a.bodyEn, a.bodyAr, JSON.stringify(a.audience), a.banner, a.startsAt, a.endsAt]),
  );
  if (!rowCount) return answer({ result: "none" }, 404);
  await audit(req, staff.id, "announcement.edit", { type: "announcement", id }, null, { title: a.titleEn, audience: a.audience, banner: a.banner });
  /* the row as the list shows it now, so Diwan can update it in the list at once */
  return answer({ result: "ok", row: await oneAnnouncement(id) });
});

/** Ends an announcement now: { end: true }. The row stays (Diwan's "Past" list), with when and by whom.
    Or starts an ended one again: { restart: true, endsAt } (endsAt: a new end, or null for none). It goes out again
    from now, so it is at the top of the bell; the shops that already read or closed it keep their read, so they are not
    told again. Answers "ok", "bad" (with field "endsAt"), "none" (not found, or not in a state for that). */
export const PATCH = staffRoute("announce", async (req, staff, ctx) => {
  const id = idOf(ctx.params.id);
  const body = await readJson(req, 500);
  if (!id || (body?.end !== true && body?.restart !== true)) return answer({ result: "bad" }, 400);
  const pool = await db();

  if (body.restart === true) {
    const endsAt = cleanWhen(body.endsAt);
    if (endsAt === undefined || (endsAt && endsAt <= new Date())) return answer({ result: "bad", field: "endsAt" }, 400);
    /* only one that has ended: a live or scheduled one is changed with Edit */
    const { rows } = await pool.query(
      `UPDATE announcements n SET starts_at = now(), ends_at = $2, ended_at = NULL, ended_by = NULL
         FROM announcements o
        WHERE n.id = $1 AND o.id = n.id AND n.ends_at IS NOT NULL AND n.ends_at <= now()
        RETURNING n.title_en, o.starts_at AS was_start, o.ends_at AS was_end`,
      [id, endsAt],
    );
    if (!rows[0]) return answer({ result: "none" }, 404);
    /* the run before, so the activity log keeps when it ran the first time */
    await audit(req, staff.id, "announcement.restart", { type: "announcement", id }, null, {
      title: rows[0].title_en, before: { startsAt: rows[0].was_start, endsAt: rows[0].was_end }, endsAt,
    });
    return answer({ result: "ok" });
  }

  const { rows } = await pool.query(
    `UPDATE announcements SET ends_at = now(), starts_at = LEAST(starts_at, now()), ended_at = now(), ended_by = $2
      WHERE id = $1 AND (ends_at IS NULL OR ends_at > now()) RETURNING title_en`,
    [id, staff.id],
  );
  if (!rows[0]) return answer({ result: "none" }, 404);
  /* the title, so the activity log says which announcement ended */
  await audit(req, staff.id, "announcement.end", { type: "announcement", id }, null, { title: rows[0].title_en });
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
