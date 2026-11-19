import { POPUP_NEXT, type PopupStatus } from "@/components/popupRules";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanWhen } from "@/server/audience";
import { cleanPopup } from "@/server/popups";
import { audit, staffRoute } from "@/server/staff";
import { plainParams } from "@/server/crypto";
import { onePopup } from "../rows";

export const dynamic = "force-dynamic";

const MAX = 700_000;
const idOk = (v: string) => /^\d{1,15}$/.test(v);

/** Either { status } (the next step: draft → live → ended, and ended → live again), { restart: true, endsAt } (one of the
    past, ended or with its end passed, shows again from now: endsAt is a new end or null for none), or the whole pop-up
    as the form sends it. A shop that already saw a pop-up does not see it again after an edit or a restart. Answers
    "ok", "bad" with the field, "missing", "step" (not a step it can take from here), "over" (its end has passed: change
    the end first). */
export const PATCH = staffRoute("announce", async (req, me, { params }) => {
  if (!idOk(params.id)) return answer({ result: "missing" }, 404);
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const pool = await db();
  const { rows } = await pool.query(`SELECT status, title_en, starts_at, ends_at FROM popups WHERE id = $1`, [params.id]);
  const cur = rows[0];
  if (!cur) return answer({ result: "missing" }, 404);

  if (body.restart === true) {
    const over = !!cur.ends_at && new Date(cur.ends_at) <= new Date();
    if (!(cur.status === "ended" || (cur.status === "live" && over))) return answer({ result: "step" }, 409);
    const endsAt = cleanWhen(body.endsAt);
    if (endsAt === undefined || (endsAt && endsAt <= new Date())) return answer({ result: "bad", field: "endsAt" }, 400);
    /* its start stays (so "new stores" still means the ones made since it first went out), unless it was ended before
       it began: then it starts now */
    await pool.query(
      `UPDATE popups SET status = 'live', starts_at = LEAST(starts_at, now()), ends_at = $2, ended_at = NULL, ended_by = NULL,
              updated_by = $3, updated_at = now()
        WHERE id = $1`,
      [params.id, endsAt, me.id],
    );
    await audit(req, me.id, "popup.restart", { type: "popup", id: params.id }, null, {
      title: cur.title_en, from: cur.status, before: { startsAt: cur.starts_at, endsAt: cur.ends_at }, endsAt,
    });
    return answer({ result: "ok" });
  }

  if ("status" in body) {
    const to = body.status as PopupStatus;
    if (!(POPUP_NEXT[cur.status as PopupStatus] ?? []).includes(to)) return answer({ result: "step" }, 409);
    if (to === "live" && cur.ends_at && new Date(cur.ends_at) <= new Date()) return answer({ result: "over" }, 409);
    /* ending says when and by whom (Diwan's "Past" list); showing it again clears that */
    await pool.query(
      `UPDATE popups SET status = $2, updated_by = $3, updated_at = now(),
              ended_at = CASE WHEN $2 = 'ended' THEN now() END, ended_by = CASE WHEN $2 = 'ended' THEN $3::bigint END
        WHERE id = $1`,
      [params.id, to, me.id],
    );
    await audit(req, me.id, "popup.status", { type: "popup", id: params.id }, null, { title: cur.title_en, from: cur.status, to });
    return answer({ result: "ok" });
  }

  const p = await cleanPopup(body);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);
  const c = p.columns;
  await pool.query(
    `UPDATE popups SET template = $2, slots = $3, placement = $4, title_en = $5, title_ar = $6, body_en = $7, body_ar = $8, image = $9,
            button_en = $10, button_ar = $11, button_link = $12, audience = $13, starts_at = $14, ends_at = $15, priority = $16,
            updated_by = $17, updated_at = now()
      WHERE id = $1`,
    plainParams([params.id, p.template, JSON.stringify(p.slots), p.placement, c.titleEn, c.titleAr, c.bodyEn, c.bodyAr, c.image, c.buttonEn, c.buttonAr, c.buttonLink, JSON.stringify(p.audience), p.startsAt, p.endsAt, p.priority, me.id]),
  );
  await audit(req, me.id, "popup.edit", { type: "popup", id: params.id }, null, { title: c.titleEn, template: p.template, placement: p.placement, audience: p.audience, status: cur.status });
  /* the row as the list shows it now, so Diwan can update it in the list at once */
  return answer({ result: "ok", row: await onePopup(params.id) });
});

/** Deletes a draft. A pop-up that was shown is ended instead, so its numbers stay. Answers "ok", "missing", "not-allowed". */
export const DELETE = staffRoute("announce", async (req, me, { params }) => {
  if (!idOk(params.id)) return answer({ result: "missing" }, 404);
  const pool = await db();
  const { rows } = await pool.query(`DELETE FROM popups WHERE id = $1 AND status = 'draft' RETURNING title_en`, [params.id]);
  if (!rows[0]) {
    const exists = (await pool.query(`SELECT 1 FROM popups WHERE id = $1`, [params.id])).rowCount;
    return answer({ result: exists ? "not-allowed" : "missing" }, exists ? 409 : 404);
  }
  await audit(req, me.id, "popup.delete", { type: "popup", id: params.id }, null, { title: rows[0].title_en });
  return answer({ result: "ok" });
});
