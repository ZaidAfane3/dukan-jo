import { POPUP_NEXT, type PopupStatus } from "@/components/popupRules";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanPopup } from "@/server/popups";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const MAX = 700_000;
const idOk = (v: string) => /^\d{1,15}$/.test(v);

/** Either { status } (the next step: draft → live → ended, and ended → live again) or the whole pop-up as the form sends it.
    A shop that already saw a pop-up does not see it again after an edit. Answers "ok", "bad" with the field, "missing",
    "step" (not a step it can take from here), "over" (its end has passed: change the end first). */
export const PATCH = staffRoute("announce", async (req, me, { params }) => {
  if (!idOk(params.id)) return answer({ result: "missing" }, 404);
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const pool = await db();
  const { rows } = await pool.query(`SELECT status, title_en, ends_at FROM popups WHERE id = $1`, [params.id]);
  const cur = rows[0];
  if (!cur) return answer({ result: "missing" }, 404);

  if ("status" in body) {
    const to = body.status as PopupStatus;
    if (!(POPUP_NEXT[cur.status as PopupStatus] ?? []).includes(to)) return answer({ result: "step" }, 409);
    if (to === "live" && cur.ends_at && new Date(cur.ends_at) <= new Date()) return answer({ result: "over" }, 409);
    await pool.query(`UPDATE popups SET status = $2, updated_by = $3, updated_at = now() WHERE id = $1`, [params.id, to, me.id]);
    await audit(req, me.id, "popup.status", { type: "popup", id: params.id }, null, { title: cur.title_en, from: cur.status, to });
    return answer({ result: "ok" });
  }

  const p = await cleanPopup(body);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);
  await pool.query(
    `UPDATE popups SET title_en = $2, title_ar = $3, body_en = $4, body_ar = $5, image = $6, button_en = $7, button_ar = $8, button_link = $9,
            audience = $10, starts_at = $11, ends_at = $12, priority = $13, updated_by = $14, updated_at = now()
      WHERE id = $1`,
    [params.id, p.titleEn, p.titleAr, p.bodyEn, p.bodyAr, p.image, p.buttonEn, p.buttonAr, p.buttonLink, JSON.stringify(p.audience), p.startsAt, p.endsAt, p.priority, me.id],
  );
  await audit(req, me.id, "popup.edit", { type: "popup", id: params.id }, null, { title: p.titleEn, audience: p.audience, status: cur.status });
  return answer({ result: "ok" });
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
