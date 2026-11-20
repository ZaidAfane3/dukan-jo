import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { documentId, fileResponse } from "@/server/documents";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** One document's file, for staff who check documents. Pictures open in the browser, a PDF downloads (server/documents.ts
    fileResponse). Opening it is not written to the activity log, like opening a ticket picture: the log keeps changes.
    A document its merchant removed has no file any more. */
export const GET = staffRoute("documents", async (_req, _staff, ctx) => {
  const id = documentId(ctx.params.id);
  if (!id) return answer({ result: "none" }, 404);
  const { rows } = await (await db()).query(`SELECT data, mime, name FROM documents WHERE public_id = $1 AND removed_at IS NULL AND NOT draft`, [id]);
  return fileResponse(rows[0]);
});
