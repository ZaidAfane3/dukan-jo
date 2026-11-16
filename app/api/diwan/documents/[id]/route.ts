import type { NextRequest } from "next/server";
import { cleanLines } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { documentId } from "@/server/documents";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Approves or rejects a paper: { status: "approved" | "rejected", note }. Rejecting needs a note (the merchant is told
   what to send instead). The merchant's bell gets a documentStatus message; the activity log keeps the change. */
export const POST = staffRoute("documents", async (req: NextRequest, me, { params }) => {
  const publicId = documentId(params.id);
  const body = await readJson(req, 4_000);
  const status = body?.status;
  const note = cleanLines(body?.note ?? "", 500);
  if (!publicId || (status !== "approved" && status !== "rejected")) return answer({ result: "invalid" }, 400);
  if (status === "rejected" && !note.trim()) return answer({ result: "note-needed" }, 400);

  const pool = await db();
  const before = await pool.query(`SELECT id, account_id, name, status, note FROM documents WHERE public_id = $1`, [publicId]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  const id = String(b.id);
  /* a rejection is shown to the merchant in a pop-up, again even if an earlier one was already seen */
  await pool.query(`UPDATE documents SET status = $2, note = $3, reviewed_by = $4, rejection_seen = false WHERE id = $1`, [id, status, seal(note), me.id]);
  await notify(b.account_id, "documentStatus", { name: b.name, status, note });
  await audit(req, me.id, "document.review", { type: "document", id }, note || null, {
    shop: String(b.account_id),
    before: { status: b.status, note: b.note },
    after: { status, note },
  });
  return answer({ result: "ok" });
});
