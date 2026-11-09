import type { NextRequest } from "next/server";
import { PAGE_NEXT, PAGE_STATUSES, type PageStatus } from "@/components/dukkanPageRules";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { cleanPage, PAGE_COLUMNS, type PageInput } from "@/server/dukkanPages";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const MAX = 120_000;
const idOk = (id: string) => /^\d{1,15}$/.test(id);

/* One page. PATCH changes only what is sent: its words, address (slug), place, "in the menu", audience, and/or
   { status } (the next step: draft → live → hidden; hidden → live or back to draft). Going live needs its text in both
   languages. Answers "ok", "bad" with the field, "missing", "taken", "step", "not-ready" with the field. */
export const PATCH = staffRoute("announce", async (req: NextRequest, me, { params }) => {
  if (!idOk(params.id)) return answer({ result: "missing" }, 404);
  const body = await readJson(req, MAX);
  if (!body) return answer({ result: "bad" }, 400);
  const pool = await db();
  const { rows } = await pool.query(`SELECT * FROM dukkan_pages WHERE id = $1`, [params.id]);
  const cur = rows[0];
  if (!cur) return answer({ result: "missing" }, 404);

  const p = await cleanPage(body, true);
  if ("bad" in p) return answer({ result: "bad", field: p.bad }, 400);

  let status: PageStatus | null = null;
  if ("status" in body) {
    status = PAGE_STATUSES.includes(body.status as PageStatus) ? (body.status as PageStatus) : null;
    if (!status) return answer({ result: "bad", field: "status" }, 400);
    if (status === cur.status) status = null;
    else if (!PAGE_NEXT[cur.status as PageStatus].includes(status)) return answer({ result: "step" }, 409);
  }
  if (status === "live") {
    const bodyEn = p.bodyEn ?? cur.body_en;
    const bodyAr = p.bodyAr ?? cur.body_ar;
    if (!bodyEn) return answer({ result: "not-ready", field: "bodyEn" }, 409);
    if (!bodyAr) return answer({ result: "not-ready", field: "bodyAr" }, 409);
  }

  const keys = Object.keys(p) as (keyof PageInput)[];
  if (!keys.length && !status) return answer({ result: "ok" });
  const sets = keys.map((k, i) => `${PAGE_COLUMNS[k]} = $${i + 2}`);
  const values: unknown[] = keys.map((k) => (k === "audience" ? JSON.stringify(p[k]) : p[k]));
  if (status) {
    values.push(status);
    sets.push(`status = $${values.length + 1}`);
    if (status === "live") sets.push(`published_at = COALESCE(published_at, now())`);
  }
  values.push(me.id);
  sets.push(`updated_by = $${values.length + 1}`, `updated_at = now()`);
  try {
    await pool.query(`UPDATE dukkan_pages SET ${sets.join(", ")} WHERE id = $1`, [params.id, ...values]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken", field: "slug" }, 409);
    throw e;
  }
  if (keys.length) await audit(req, me.id, "page.edit", { type: "page", id: params.id }, null, { slug: p.slug ?? cur.slug, changed: keys });
  if (status) await audit(req, me.id, "page.status", { type: "page", id: params.id }, null, { slug: p.slug ?? cur.slug, from: cur.status, to: status });
  return answer({ result: "ok" });
});

/** Deletes a draft that was never published (one merchants may have read is hidden instead). Answers "ok", "missing",
    "not-allowed". */
export const DELETE = staffRoute("announce", async (req: NextRequest, me, { params }) => {
  if (!idOk(params.id)) return answer({ result: "missing" }, 404);
  const pool = await db();
  const { rows } = await pool.query(
    `DELETE FROM dukkan_pages WHERE id = $1 AND status = 'draft' AND published_at IS NULL RETURNING slug, title_en`,
    [params.id],
  );
  if (!rows[0]) {
    const exists = (await pool.query(`SELECT 1 FROM dukkan_pages WHERE id = $1`, [params.id])).rowCount;
    return answer({ result: exists ? "not-allowed" : "missing" }, exists ? 409 : 404);
  }
  await audit(req, me.id, "page.delete", { type: "page", id: params.id }, null, { slug: rows[0].slug, title: rows[0].title_en });
  return answer({ result: "ok" });
});
