import { answer, readJson, tooManyFor } from "@/server/auth";
import { cleanSetup } from "@/components/safeAccount";
import { seal, sealBytes } from "@/server/crypto";
import { db } from "@/server/db";
import { ACCOUNT_BYTES, BODY_MAX, checkUpload, documentName, documentsRoute, MERCHANT_KINDS, merchantDocument, partnerKind, partnerName, PER_ACCOUNT, PER_PARTNER, type MerchantKind } from "@/server/documents";
import { storageFull } from "@/server/media";
import { inTransaction } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The papers a merchant sends Dukkan's staff to check: today, proof for their own delivery partner (the setup's shipping
   step and the Delivery page). Each file arrives on its own and lands in Diwan's Documents queue as "waiting". Only the
   signed-in account's own rows are ever read or changed. Refused changes: 423 "suspended" (see
   server/documents.ts documentsRoute), 409 "too-many" or "too-big" (a limit is reached), 400 "invalid" (the file is
   not an image or PDF we accept, or a field is wrong). */

/* seq: this account's first, second... document of its kind (its title: "Proof of delivery #001"), kept from when it
   was sent (schema.ts documents.seq), so removing one never renumbers the others */
const SELECT = `SELECT id, public_id, kind, name, partner, partner_kind, status, note, mime, bytes, data IS NOT NULL AS has_file, created_at,
  rejection_seen, seq FROM documents`;

/** My documents, oldest first (the order they were added), at most what an account can keep. The ones I removed stay
    only as a record for Diwan, never here. */
export const GET = documentsRoute(async (_req, me) => {
  const { rows } = await (await db()).query(`${SELECT} WHERE account_id = $1 AND removed_at IS NULL ORDER BY created_at, id LIMIT ${PER_ACCOUNT * 2}`, [me.id]);
  return answer({ result: "ok", documents: rows.map(merchantDocument), limits: { perPartner: PER_PARTNER, perAccount: PER_ACCOUNT } });
});

/** Sends one file: { kind: "courier_proof", data (base64), type (the browser's type, may be ""), name (the file's name),
    partner (who delivers), partnerKind (0 company, 1 person) } */
export const POST = documentsRoute(async (req, me) => {
  if (tooManyFor(`document:${me.id}`, 30, 10)) return answer({ result: "too-many-tries" }, 429);
  const body = await readJson(req, BODY_MAX);
  if (!body) return answer({ result: "too-big" }, 413);
  const kind = MERCHANT_KINDS.includes(body.kind as MerchantKind) ? (body.kind as MerchantKind) : null;
  const file = checkUpload(body.data, body.type);
  if (!kind || !file) return answer({ result: "invalid" }, 400);
  const name = documentName(body.name);
  const partner = partnerName(body.partner);
  const pKind = partnerKind(body.partnerKind);
  const saved = await inTransaction(async (c) => {
    /* one upload at a time per account, so two sent together can't both slip under a limit */
    await c.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [me.id]);
    /* a courier proof is a draft (Diwan doesn't see it) until his delivery choice is saved with his own courier: already
       saved so (the Delivery page of a store that uses its courier), it goes to Diwan at once. Read under the account's
       save lock (app/api/store PUT takes it to save the setup, and hands drafts over after): a save running now either
       finished before this read (own: not a draft) or waits for this row and then hands it over. */
    let draft = false;
    if (kind === "courier_proof") {
      await c.query(`SELECT pg_advisory_xact_lock(71004, ($1::bigint % 2147483647)::int)`, [me.id]);
      const r = await c.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-setup'`, [me.id]);
      let mode: string | null | undefined = null;
      try {
        mode = r.rows[0] ? cleanSetup(JSON.parse(r.rows[0].value as string))?.shipping?.mode : null;
      } catch {
        mode = null;
      }
      draft = mode !== "own";
    }
    /* the counts are of what the merchant still keeps; the bytes also count a removed file whose bytes are still stored
       (the few minutes it can be restored in, until purgeRemovedFiles clears data and file_key), so removing and sending
       again can't store more than the limit; the next number counts removed ones too, so it is never reused */
    const { rows } = await c.query(
      `SELECT count(*) FILTER (WHERE removed_at IS NULL)::int AS all_n,
              count(*) FILTER (WHERE kind = $2 AND removed_at IS NULL)::int AS kind_n,
              COALESCE(sum(bytes) FILTER (WHERE removed_at IS NULL OR data IS NOT NULL OR file_key IS NOT NULL), 0)::bigint AS used,
              COALESCE(max(seq) FILTER (WHERE kind = $2), 0)::int + 1 AS next_seq
         FROM documents WHERE account_id = $1`,
      [me.id, kind],
    );
    const n = rows[0];
    /* the merchant has one delivery partner at a time, so the account's courier proofs are that partner's proofs */
    if (n.kind_n >= PER_PARTNER || n.all_n >= PER_ACCOUNT) return "too-many" as const;
    if (Number(n.used) + file.size > ACCOUNT_BYTES) return "too-big" as const;
    /* the platform's own ceiling, shared by every account's files (server/media.ts storageFull) */
    if (await storageFull(c, file.size)) return "storage-full" as const;
    const ins = await c.query(
      `INSERT INTO documents (account_id, kind, name, partner, partner_kind, data, mime, bytes, status, seq, draft)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting', $9, $10)
       RETURNING id, public_id, rejection_seen, seq, kind, name, partner, partner_kind, status, note, mime, bytes, true AS has_file, created_at`,
      [me.id, kind, seal(name), seal(partner), pKind, sealBytes(file.bytes), file.mime, file.size, n.next_seq, draft],
    );
    return ins.rows[0] as Record<string, unknown>;
  });
  if (saved === "too-many" || saved === "too-big") return answer({ result: saved }, 409);
  if (saved === "storage-full") return answer({ result: saved }, 503);
  /* the row came back from a transaction client, whose answers are opened like the pool's (server/db.ts) */
  return answer({ result: "ok", document: merchantDocument(saved) });
});

/** The partner was renamed or changed: { partner, partnerKind }. Only the proofs still waiting for a check follow it; a
    proof staff already approved or rejected keeps the partner it was checked for. */
export const PUT = documentsRoute(async (req, me) => {
  const body = await readJson(req, 2_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const partner = partnerName(body.partner);
  const pKind = partnerKind(body.partnerKind);
  await (await db()).query(
    `UPDATE documents SET partner = $2, partner_kind = $3 WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'waiting' AND removed_at IS NULL`,
    [me.id, seal(partner), pKind],
  );
  return answer({ result: "ok" });
});
