import type { NextRequest } from "next/server";
import { cleanLines } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Approves or rejects a paper: { status: "approved" | "rejected", note }. Rejecting needs a note (the merchant is told
   what to send instead). The merchant's bell gets a documentStatus message; the activity log keeps the change. */
export const POST = staffRoute("documents", async (req: NextRequest, me, { params }) => {
  const id = params.id ?? "";
  const body = await readJson(req, 4_000);
  const status = body?.status;
  const note = cleanLines(body?.note ?? "", 500);
  if (!/^\d{1,18}$/.test(id) || (status !== "approved" && status !== "rejected")) return answer({ result: "invalid" }, 400);
  if (status === "rejected" && !note.trim()) return answer({ result: "note-needed" }, 400);

  const pool = await db();
  const before = await pool.query(`SELECT account_id, name, status, note FROM documents WHERE id = $1`, [id]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  await pool.query(`UPDATE documents SET status = $2, note = $3, reviewed_by = $4 WHERE id = $1`, [id, status, seal(note), me.id]);
  await notify(b.account_id, "documentStatus", { name: b.name, status, note });
  await audit(req, me.id, "document.review", { type: "document", id }, note || null, {
    shop: String(b.account_id),
    before: { status: b.status, note: b.note },
    after: { status, note },
  });
  return answer({ result: "ok" });
});
