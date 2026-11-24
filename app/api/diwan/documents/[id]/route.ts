import type { NextRequest } from "next/server";
import { cleanLines } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { documentId } from "@/server/documents";
import { NEXT_COURIER, ownCourierPhone } from "@/server/courierProof";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Approves or rejects a paper: { status: "approved" | "rejected", note }. Rejecting needs a note (the merchant is told
   what to send instead). The merchant's bell gets a documentStatus message; the activity log keeps the change. A
   document its merchant removed can't be checked any more: 409 "removed", and nothing changes. `from` is the status
   the staff member saw on the page: the change only goes through while the document still has it, so when two staff
   check the same document at once one wins and the other gets 409 "reviewed" (no second change, no second email).
   Approving a courier proof keeps the courier it is approved for (approved_phone, server/courierProof.ts): the courier
   it reached Diwan for, or (a proof sent before that was kept) the courier his saved delivery choice has now, or when
   neither has a phone (sent with the phone box empty by a store with no own courier saved) the own courier he saves
   next (NEXT_COURIER), never none. A merchant who changes to another courier later needs a new proof (owner decision
   2026-11-23). */
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
  const before = await pool.query(`SELECT id, account_id, kind, name, status, note, removed_at, partner_phone FROM documents WHERE public_id = $1 AND NOT draft`, [publicId]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  if (b.removed_at) return answer({ result: "removed" }, 409);
  const id = String(b.id);
  /* the status the change starts from: the one the page showed, or (no `from` sent) the one just read */
  const seen = from ?? b.status;
  if (b.status !== seen) return answer({ result: "reviewed" }, 409);
  /* a rejection is shown to the merchant in a pop-up, again even if an earlier one was already seen. The removal and
     the status are checked again here, for a change that lands between the read above and this one. */
  let approvedPhone: string | null = null;
  if (status === "approved" && b.kind === "courier_proof") {
    approvedPhone = (b.partner_phone as string | null) || null;
    if (!approvedPhone) {
      const setup = await pool.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-setup'`, [b.account_id]);
      approvedPhone = ownCourierPhone(setup.rows[0]?.value ?? null) || NEXT_COURIER;
    }
  }
  const changed = await pool.query(
    `UPDATE documents SET status = $2, note = $3, reviewed_by = $4, rejection_seen = false,
            approved_phone = CASE WHEN $2 = 'approved' THEN $6 ELSE approved_phone END
      WHERE id = $1 AND removed_at IS NULL AND status = $5`,
    [id, status, seal(note), me.id, seen, seal(approvedPhone)],
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
