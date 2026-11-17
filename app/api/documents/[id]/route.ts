import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { documentId, documentsRoute, MERCHANT_KINDS } from "@/server/documents";

export const dynamic = "force-dynamic";

/** { action: "seen" }: the merchant read the pop-up about this rejected document (components/DocumentRejected.tsx) */
export const POST = documentsRoute(async (_req, me, ctx) => {
  const id = documentId(ctx.params.id);
  if (!id) return answer({ result: "none" }, 404);
  await (await db()).query(`UPDATE documents SET rejection_seen = true WHERE public_id = $1 AND account_id = $2 AND removed_at IS NULL`, [id, me.id]);
  return answer({ result: "ok" });
});

/** Removes one of my documents and its file. Only the signed-in account's own, and only the kinds a merchant sends. The
    row stays, marked removed, so Diwan keeps its number and what staff decided about it. The file is never served again;
    it is kept RESTORE_MINUTES so the merchant can undo the removal (./restore), then it goes (server/documents.ts
    purgeRemovedFiles). */
export const DELETE = documentsRoute(async (_req, me, ctx) => {
  const id = documentId(ctx.params.id);
  if (!id) return answer({ result: "none" }, 404);
  const { rowCount } = await (await db()).query(
    `UPDATE documents SET removed_at = now()
      WHERE public_id = $1 AND account_id = $2 AND kind = ANY($3::text[]) AND removed_at IS NULL`,
    [id, me.id, MERCHANT_KINDS],
  );
  return rowCount ? answer({ result: "ok" }) : answer({ result: "none" }, 404);
});
