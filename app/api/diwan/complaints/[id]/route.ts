import type { NextRequest } from "next/server";
import { cleanLines } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Works on one store report: { status: "new" | "checking" | "closed", notes }. The notes are staff's own (the
   reporter and the shop never see them). Whoever changes it becomes the one handling it. Suspending the store is done
   on the shop's page. The activity log keeps what it was and what it became. */
export const PATCH = staffRoute("complaints", async (req: NextRequest, me, { params }) => {
  const id = params.id ?? "";
  const body = await readJson(req, 6_000);
  const status = body?.status;
  const notes = cleanLines(body?.notes ?? "", 2_000);
  if (!/^\d{1,18}$/.test(id) || (status !== "new" && status !== "checking" && status !== "closed")) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const before = await pool.query(`SELECT account_id, status, notes FROM store_reports WHERE id = $1`, [id]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  await pool.query(`UPDATE store_reports SET status = $2, notes = $3, handled_by = $4, updated_at = now() WHERE id = $1`, [id, status, seal(notes), me.id]);
  await audit(req, me.id, "complaint.update", { type: "store_report", id }, null, {
    shop: String(b.account_id),
    before: { status: b.status, notes: b.notes },
    after: { status, notes },
  });
  return answer({ result: "ok" });
});
