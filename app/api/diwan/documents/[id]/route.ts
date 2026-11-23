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
   what to send instead). The merchant's bell gets a documentStatus message; the activity log keeps the change. A
   document its merchant removed can't be checked any more: 409 "removed", and nothing changes. `from` is the status
   the staff member saw on the page: the change only goes through while the document still has it, so when two staff
   check the same document at once one wins and the other gets 409 "reviewed" (no second change, no second email). */
export const POST = staffRoute("documents", async (req: NextRequest, me, { params }) => {
  const publicId = documentId(params.id);
  const body = await readJson(req, 4_000);
  const status = body?.status;
  const note = cleanLines(body?.note ?? "", 500);
  const from = body?.from;
  if (!publicId || (status !== "approved" && status !== "rejected")) return answer({ result: "invalid" }, 400);
  if (from !== undefined && from !== "waiting" && from !== "approved" && from !== "rejected") return answer({ result: "invalid" }, 400);
  if (status === "rejected" && !note.trim()) return answer({ result: "note-needed" }, 400);

  const pool = await db();
  const before = await pool.query(`SELECT id, account_id, name, status, note, removed_at FROM documents WHERE public_id = $1 AND NOT draft`, [publicId]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  if (b.removed_at) return answer({ result: "removed" }, 409);
  const id = String(b.id);
  /* the status the change starts from: the one the page showed, or (no `from` sent) the one just read */
  const seen = from ?? b.status;
  if (b.status !== seen) return answer({ result: "reviewed" }, 409);
  /* a rejection is shown to the merchant in a pop-up, again even if an earlier one was already seen. The removal and
     the status are checked again here, for a change that lands between the read above and this one. */
  const changed = await pool.query(
    `UPDATE documents SET status = $2, note = $3, reviewed_by = $4, rejection_seen = false
      WHERE id = $1 AND removed_at IS NULL AND status = $5`,
    [id, status, seal(note), me.id, seen],
  );
  if (!changed.rowCount) {
    const now = await pool.query(`SELECT removed_at FROM documents WHERE id = $1`, [id]);
    return answer({ result: now.rows[0] && !now.rows[0].removed_at ? "reviewed" : "removed" }, 409);
  }
  await notify(b.account_id, "documentStatus", { name: b.name, status, note });
  await audit(req, me.id, "document.review", { type: "document", id }, note || null, {
    shop: String(b.account_id),
    before: { status: b.status, note: b.note },
    after: { status, note },
  });
  return answer({ result: "ok" });
});
