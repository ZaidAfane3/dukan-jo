import { answer } from "@/server/auth";
import { ACCOUNT_BYTES, ACTIVE, documentId, documentsRoute, MERCHANT_KINDS, merchantDocument, PER_ACCOUNT, PER_PARTNER, RESTORE_MINUTES } from "@/server/documents";
import { inTransaction } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Undoes the removal of one of my documents (the Undo after "Proof removed", components/partnerProofs.tsx). Only the
    signed-in account's own, only the kinds a merchant sends, only one removed in the last RESTORE_MINUTES that still has
    its file, and only while the limits still have room for it (the same ones as sending a file: 409 "too-many" or
    "too-big"; a rejected one never counts toward them, so it always comes back). Anything else answers 404 "none". It comes back as it was: its number, its status and staff's note. */
export const POST = documentsRoute(async (_req, me, ctx) => {
  const id = documentId(ctx.params.id);
  if (!id) return answer({ result: "none" }, 404);
  const back = await inTransaction(async (c) => {
    /* one change at a time per account, as an upload, so a restore and an upload can't both slip under a limit */
    await c.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [me.id]);
    const { rows } = await c.query(
      `SELECT id, kind, bytes, status FROM documents
        WHERE public_id = $1 AND account_id = $2 AND kind = ANY($3::text[]) AND removed_at IS NOT NULL
          AND removed_at > now() - make_interval(mins => $4) AND data IS NOT NULL`,
      [id, me.id, MERCHANT_KINDS, RESTORE_MINUTES],
    );
    const doc = rows[0];
    if (!doc) return "none" as const;
    const n = (
      await c.query(
        `SELECT count(*) FILTER (WHERE ${ACTIVE})::int AS all_n,
                count(*) FILTER (WHERE kind = $2 AND ${ACTIVE})::int AS kind_n,
                COALESCE(sum(bytes) FILTER (WHERE ${ACTIVE}), 0)::bigint AS used
           FROM documents WHERE account_id = $1`,
        [me.id, doc.kind],
      )
    ).rows[0];
    if (doc.status !== "rejected") {
      if (n.kind_n >= PER_PARTNER || n.all_n >= PER_ACCOUNT) return "too-many" as const;
      if (Number(n.used) + Number(doc.bytes ?? 0) > ACCOUNT_BYTES) return "too-big" as const;
    }
    const upd = await c.query(
      `UPDATE documents SET removed_at = NULL WHERE id = $1
       RETURNING id, public_id, kind, name, partner, partner_kind, status, note, mime, bytes, data IS NOT NULL AS has_file, created_at, rejection_seen, seq`,
      [doc.id],
    );
    return upd.rows[0] as Record<string, unknown>;
  });
  if (back === "none") return answer({ result: "none" }, 404);
  if (back === "too-many" || back === "too-big") return answer({ result: back }, 409);
  return answer({ result: "ok", document: merchantDocument(back) });
});
