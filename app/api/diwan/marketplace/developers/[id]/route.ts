import type { NextRequest } from "next/server";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";
import { cleanDeveloper } from "../../shape";

export const dynamic = "force-dynamic";

/** Changes a developer (all fields at once, as the form sends them). Answers: "ok", "taken", "invalid", "missing". */
export const PATCH = staffRoute("marketplace", async (req: NextRequest, me, { params }) => {
  const id = /^\d{1,18}$/.test(params.id ?? "") ? params.id : null;
  const d = cleanDeveloper(await readJson(req, 4_000));
  if (!id || !d) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const before = await pool.query(`SELECT name, email, company, status, share_pct::float AS "sharePct" FROM developers WHERE id = $1`, [id]);
  if (!before.rows[0]) return answer({ result: "missing" }, 404);
  try {
    await pool.query(`UPDATE developers SET name = $2, email = $3, company = $4, status = $5, share_pct = $6 WHERE id = $1`, [
      id, d.name, d.email, d.company, d.status, d.sharePct,
    ]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return answer({ result: "taken" }, 409);
    throw e;
  }
  await audit(req, me.id, "marketplace.developer_change", { type: "developer", id }, null, { before: before.rows[0], after: d });
  return answer({ result: "ok" });
});
