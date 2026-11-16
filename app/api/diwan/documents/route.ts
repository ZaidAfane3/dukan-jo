import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's papers queue: the documents shops sent for checking (courier proof, commercial registration), newest first.
   Filters from fixed lists: status (waiting, the default; approved; rejected; all) and kind, and shop (one store's
   account id). At most 200 rows.
   Merchants send their files from the setup's shipping step and the Delivery page (app/api/documents); each file is
   opened through /api/diwan/documents/[id]/file, never sent inside this list. */

const STATUSES = ["waiting", "approved", "rejected"];
const KINDS = ["courier_proof", "commercial_registration", "other"];

export const GET = staffRoute("documents", async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const asked = sp.get("status") ?? "waiting";
  const status = STATUSES.includes(asked) ? asked : "all";
  const kind = KINDS.includes(sp.get("kind") ?? "") ? sp.get("kind")! : "";
  const where: string[] = [];
  const args: unknown[] = [];
  if (STATUSES.includes(status)) where.push(`d.status = $${args.push(status)}`);
  if (KINDS.includes(kind)) where.push(`d.kind = $${args.push(kind)}`);
  /* one store's documents only (?shop=, from its page's "See all") */
  const shop = sp.get("shop") ?? "";
  if (/^\d{1,18}$/.test(shop)) where.push(`d.account_id = $${args.push(shop)}`);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT d.id, d.public_id, d.account_id, d.kind, d.name, d.seq, (d.data IS NOT NULL OR d.file_key IS NOT NULL) AS has_file, d.mime, d.bytes,
            d.partner, d.partner_kind, d.status, d.note, d.created_at,
            st.name AS reviewer, COALESCE(s.name, '') AS shop_name, a.name AS owner_name, s.slug AS shop_slug, a.email AS shop_email,
            a.phone AS owner_phone, s.phone AS store_phone
       FROM (SELECT *, row_number() OVER (PARTITION BY account_id, kind ORDER BY created_at, id)::int AS seq FROM documents) d
       JOIN accounts a ON a.id = d.account_id LEFT JOIN shops s ON s.account_id = d.account_id
       LEFT JOIN staff st ON st.id = d.reviewed_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.created_at DESC, d.id DESC LIMIT 200`,
    args,
  );
  /* the counts for the tabs, of this store only when the list is narrowed to it */
  const one = /^\d{1,18}$/.test(shop);
  const counts = await pool.query(`SELECT status, count(*)::int AS n FROM documents ${one ? "WHERE account_id = $1" : ""} GROUP BY status`, one ? [shop] : []);
  return answer({
    result: "ok",
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    documents: rows.map((r) => ({
      id: String(r.public_id),
      shopId: String(r.account_id),
      /* the store's own name ("" while it has none) and its owner's; the contact details are for the card's Contact
         pop-up only (components/diwan/Contact.tsx), never printed on the card */
      shopName: r.shop_name,
      ownerName: r.owner_name,
      shopSlug: r.shop_slug ?? null,
      shopEmail: r.shop_email,
      ownerPhone: r.owner_phone ?? "",
      storePhone: r.store_phone ?? "",
      kind: r.kind,
      /* this store's first, second... document of this kind, for the card's title ("Proof of delivery #001") */
      seq: r.seq,
      name: r.name,
      partner: r.partner ?? "",
      partnerKind: r.partner_kind ?? null,
      hasFile: r.has_file,
      mime: r.mime ?? null,
      bytes: r.bytes ?? null,
      status: r.status,
      note: r.note,
      reviewer: r.reviewer,
      createdAt: r.created_at,
    })),
  });
});
