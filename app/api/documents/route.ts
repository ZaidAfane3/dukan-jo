import { answer, readJson, tooMany } from "@/server/auth";
import { seal, sealBytes } from "@/server/crypto";
import { db } from "@/server/db";
import { ACCOUNT_BYTES, BODY_MAX, checkUpload, documentName, documentsRoute, MERCHANT_KINDS, merchantDocument, partnerKind, partnerName, PER_ACCOUNT, PER_PARTNER, type MerchantKind } from "@/server/documents";
import { inTransaction } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The papers a merchant sends Dukkan's staff to check: today, proof for their own delivery partner (the setup's shipping
   step and the Delivery page). Each file arrives on its own and lands in Diwan's Documents queue as "waiting". Only the
   signed-in account's own rows are ever read or changed. Refused changes: 423 "suspended" (see
   server/documents.ts documentsRoute), 409 "too-many" or "too-big" (a limit is reached), 400 "invalid" (the file is
   not an image or PDF we accept, or a field is wrong). */

/* seq: this account's first, second... document of its kind (its title: "Proof of delivery #001") */
const SELECT = `SELECT id, public_id, kind, name, partner, partner_kind, status, note, mime, bytes, data IS NOT NULL AS has_file, created_at,
  rejection_seen, row_number() OVER (PARTITION BY account_id, kind ORDER BY created_at, id)::int AS seq FROM documents`;

/** My documents, oldest first (the order they were added), at most what an account can keep */
export const GET = documentsRoute(async (_req, me) => {
  const { rows } = await (await db()).query(`${SELECT} WHERE account_id = $1 ORDER BY created_at, id LIMIT ${PER_ACCOUNT * 2}`, [me.id]);
  return answer({ result: "ok", documents: rows.map(merchantDocument), limits: { perPartner: PER_PARTNER, perAccount: PER_ACCOUNT } });
});

/** Sends one file: { kind: "courier_proof", data (base64), type (the browser's type, may be ""), name (the file's name),
    partner (who delivers), partnerKind (0 company, 1 person) } */
export const POST = documentsRoute(async (req, me) => {
  if (tooMany(req, `document:${me.id}`, 30, 10)) return answer({ result: "too-many-tries" }, 429);
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
    const { rows } = await c.query(
      `SELECT count(*)::int AS all_n, count(*) FILTER (WHERE kind = $2)::int AS kind_n, COALESCE(sum(bytes), 0)::bigint AS used
         FROM documents WHERE account_id = $1`,
      [me.id, kind],
    );
    const n = rows[0];
    /* the merchant has one delivery partner at a time, so the account's courier proofs are that partner's proofs */
    if (n.kind_n >= PER_PARTNER || n.all_n >= PER_ACCOUNT) return "too-many" as const;
    if (Number(n.used) + file.size > ACCOUNT_BYTES) return "too-big" as const;
    const ins = await c.query(
      `INSERT INTO documents (account_id, kind, name, partner, partner_kind, data, mime, bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting')
       RETURNING id, public_id, rejection_seen, 0 AS seq, kind, name, partner, partner_kind, status, note, mime, bytes, true AS has_file, created_at`,
      [me.id, kind, seal(name), seal(partner), pKind, sealBytes(file.bytes), file.mime, file.size],
    );
    return ins.rows[0] as Record<string, unknown>;
  });
  if (saved === "too-many" || saved === "too-big") return answer({ result: saved }, 409);
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
    `UPDATE documents SET partner = $2, partner_kind = $3 WHERE account_id = $1 AND kind = 'courier_proof' AND status = 'waiting'`,
    [me.id, seal(partner), pKind],
  );
  return answer({ result: "ok" });
});
