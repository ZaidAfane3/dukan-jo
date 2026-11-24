import { answer, readJsonOr, tooManyFor, unreadable } from "@/server/auth";
import { HOLD_MAX_MINUTES, HOLD_MINUTES } from "@/server/courierProof";
import { db } from "@/server/db";
import { documentId, documentsRoute } from "@/server/documents";
import { logMerchant } from "@/server/merchantLog";

export const dynamic = "force-dynamic";

/** { ids }: the Undo toast for these just-uploaded proofs ran out without an undo (components/partnerProofs.tsx), so
    they go to Diwan's Documents queue now. Only the signed-in account's own, still held back and not removed; a proof
    already sent or taken out is left as it is, so sending twice changes nothing.
    { ids, hold: true }: their toast still counts (it stops while the mouse is on it or the tab is hidden), so they stay
    back HOLD_MINUTES more (documents.hold_until) instead of going on their own (server/courierProof.ts
    releaseHeldProofs), but never past HOLD_MAX_MINUTES from their upload (owner decision: a proof is held at most that
    long). Answers `held`: the ones still kept back; one missing from it already went (or was taken out, or its longest
    hold is over), and the page closes its toast, so Undo is never offered for a proof Diwan may already be checking.
    `left`: the seconds until the first of them reaches that longest hold, so the page asks again (and closes its toast)
    then, not up to 30 seconds later. */
export const POST = documentsRoute(async (req, me) => {
  const read = await readJsonOr(req, 4_000);
  if (!("body" in read)) return unreadable(read.why);
  const hold = read.body.hold === true;
  /* the page asks to hold every 30 seconds or so while a toast shows: its own count, so it never uses up the sends' */
  if (hold ? tooManyFor(`document-hold:${me.id}`, 120, 10) : tooManyFor(`document-send:${me.id}`, 60, 10)) return answer({ result: "too-many-tries" }, 429);
  const raw: unknown[] = Array.isArray(read.body.ids) ? read.body.ids.slice(0, 20) : [];
  const ids = raw.map((x) => documentId(typeof x === "string" ? x : "")).filter((x): x is string => !!x);
  if (!ids.length) return answer({ result: "invalid" }, 400);
  if (hold) {
    /* kept back HOLD_MINUTES from now, cut at HOLD_MAX_MINUTES from the upload; one already past that is not held */
    const { rows } = await (await db()).query(
      `UPDATE documents SET hold_until = LEAST(now() + make_interval(mins => $3), created_at + make_interval(mins => $4))
        WHERE public_id = ANY($1::text[]) AND account_id = $2 AND draft AND removed_at IS NULL
          AND created_at > now() - make_interval(mins => $4)
        RETURNING public_id, EXTRACT(EPOCH FROM created_at + make_interval(mins => $4) - now())::float8 AS left_s`,
      [ids, me.id, HOLD_MINUTES, HOLD_MAX_MINUTES],
    );
    const left = rows.length ? Math.max(0, Math.ceil(Math.min(...rows.map((r) => Number(r.left_s) || 0)))) : 0;
    return answer({ result: "ok", held: rows.map((r) => String(r.public_id)), left });
  }
  const { rows } = await (await db()).query(
    `UPDATE documents SET draft = false, sent_at = now()
      WHERE public_id = ANY($1::text[]) AND account_id = $2 AND draft AND removed_at IS NULL
      RETURNING kind`,
    [ids, me.id],
  );
  for (const r of rows) logMerchant(me.id, "document.sent", { kind: String(r.kind ?? "") });
  return answer({ result: "ok", sent: rows.length });
});
