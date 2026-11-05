import type { NextRequest } from "next/server";
import { cleanLine } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanItemFields, NEXT, type ItemStatus } from "../../shape";

export const dynamic = "force-dynamic";

/* Changes an item, one of two ways:
     { status, note }                                         moves it to its next step (only the steps NEXT allows), with the reviewer's note
     { name, description, price, version, developerId }       edits what it is
   Answers: "ok", "invalid", "step" (that step can't follow this one), "missing". */
export const PATCH = staffRoute("marketplace", async (req: NextRequest, me, { params }) => {
  const id = /^\d{1,18}$/.test(params.id ?? "") ? params.id : null;
  const body = await readJson(req, 6_000);
  if (!id || !body) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const cur = await pool.query(
    `SELECT status, note, name, description, price::float AS price, version, developer_id::text AS "developerId" FROM marketplace_items WHERE id = $1`,
    [id],
  );
  const was = cur.rows[0];
  if (!was) return answer({ result: "missing" }, 404);

  if (typeof body.status === "string") {
    const to = body.status as ItemStatus;
    if (!(NEXT[was.status as ItemStatus] ?? []).includes(to)) return answer({ result: "step" }, 409);
    const note = cleanLine(body.note ?? "", 600);
    /* only moves on when nobody moved it meanwhile */
    const { rowCount } = await pool.query(
      `UPDATE marketplace_items SET status = $2, note = $3, reviewed_by = $4, updated_at = now() WHERE id = $1 AND status = $5`,
      [id, to, note, me.id, was.status],
    );
    if (!rowCount) return answer({ result: "step" }, 409);
    await audit(req, me.id, "marketplace.item_status", { type: "marketplace_item", id }, note || null, { before: was.status, after: to });
    return answer({ result: "ok" });
  }

  const f = cleanItemFields(body);
  if (!f) return answer({ result: "invalid" }, 400);
  if (f.developerId && !(await pool.query(`SELECT 1 FROM developers WHERE id = $1`, [f.developerId])).rowCount) return answer({ result: "invalid" }, 400);
  await pool.query(
    `UPDATE marketplace_items SET name = $2, description = $3, price = $4, version = $5, developer_id = $6, updated_at = now() WHERE id = $1`,
    [id, f.name, f.description, f.price, f.version, f.developerId],
  );
  await audit(req, me.id, "marketplace.item_change", { type: "marketplace_item", id }, null, {
    before: { name: was.name, description: was.description, price: was.price, version: was.version, developerId: was.developerId },
    after: f,
  });
  return answer({ result: "ok" });
});
