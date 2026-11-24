import { answer, readJsonOr, tooManyFor, unreadable } from "@/server/auth";
import { db } from "@/server/db";
import { documentId, documentsRoute } from "@/server/documents";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

/** { ids }: the Undo toast for these just-uploaded proofs ran out without an undo (components/partnerProofs.tsx), so
    they go to Diwan's Documents queue now. Only the signed-in account's own, still held back and not removed; a proof
    already sent or taken out is left as it is, so sending twice changes nothing. */
export const POST = documentsRoute(async (req, me) => {
  if (tooManyFor(`document-send:${me.id}`, 60, 10)) return answer({ result: "too-many-tries" }, 429);
  const read = await readJsonOr(req, 4_000);
  if (!("body" in read)) return unreadable(read.why);
  const raw: unknown[] = Array.isArray(read.body.ids) ? read.body.ids.slice(0, 20) : [];
  const ids = raw.map((x) => documentId(typeof x === "string" ? x : "")).filter((x): x is string => !!x);
  if (!ids.length) return answer({ result: "invalid" }, 400);
  const { rows } = await (await db()).query(
    `UPDATE documents SET draft = false, sent_at = now()
      WHERE public_id = ANY($1::text[]) AND account_id = $2 AND draft AND removed_at IS NULL
      RETURNING kind`,
    [ids, me.id],
  );
  for (const r of rows) logMerchant(me.id, "document.sent", { kind: String(r.kind ?? "") });
  return answer({ result: "ok", sent: rows.length });
});
