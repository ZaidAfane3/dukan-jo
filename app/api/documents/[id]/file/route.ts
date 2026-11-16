import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { documentId, documentsRoute, fileResponse } from "@/server/documents";

export const dynamic = "force-dynamic";

/** The file of one of my documents (for the thumbnails on the setup and Delivery pages). Never another account's. */
export const GET = documentsRoute(async (_req, me, ctx) => {
  const id = documentId(ctx.params.id);
  if (!id) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(`SELECT data, mime, name FROM documents WHERE id = $1 AND account_id = $2`, [id, me.id]);
  return fileResponse(rows[0]);
});
