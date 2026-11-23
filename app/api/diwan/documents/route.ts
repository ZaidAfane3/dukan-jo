import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { NO_COURIER } from "@/server/courierProof";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's papers queue: the documents shops sent for checking (courier proof, commercial registration), newest first.
   Filters from fixed lists: status (waiting, the default; approved; rejected; removed; all) and kind, and shop (one
   store's account id). At most 200 rows. A document its merchant removed keeps its row without the file (removed_at,
   schema.ts): it shows only under "removed" and "all", never as waiting, approved or rejected.
   Merchants send their files from the setup's shipping step and the Delivery page (app/api/documents); each file is
   opened through /api/diwan/documents/[id]/file, never sent inside this list. */

const STATUSES = ["waiting", "approved", "rejected"];
const FILTERS = [...STATUSES, "removed"];
const KINDS = ["courier_proof", "commercial_registration", "other"];

export const GET = staffRoute("documents", async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const asked = sp.get("status") ?? "waiting";
  const status = FILTERS.includes(asked) ? asked : "all";
  const kind = KINDS.includes(sp.get("kind") ?? "") ? sp.get("kind")! : "";
  /* a courier proof whose delivery choice isn't saved yet is the merchant's draft, not Diwan's to check */
  const where: string[] = ["NOT d.draft"];
  const args: unknown[] = [];
  if (STATUSES.includes(status)) where.push(`d.status = $${args.push(status)}`, "d.removed_at IS NULL");
  if (status === "removed") where.push("d.removed_at IS NOT NULL");
  if (KINDS.includes(kind)) where.push(`d.kind = $${args.push(kind)}`);
  /* one store's documents only (?shop=, from its page's "See all") */
  const shop = sp.get("shop") ?? "";
  if (/^\d{1,18}$/.test(shop)) where.push(`d.account_id = $${args.push(shop)}`);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT d.id, d.public_id, d.account_id, d.kind, d.name, d.seq, (d.data IS NOT NULL OR d.file_key IS NOT NULL) AS has_file, d.mime, d.bytes,
            d.partner, d.partner_kind, d.partner_phone, d.approved_phone, d.status, d.note, d.created_at, d.removed_at,
            st.name AS reviewer, COALESCE(s.name, '') AS shop_name, a.name AS owner_name, s.slug AS shop_slug, s.phone AS store_phone
       FROM documents d
       JOIN accounts a ON a.id = d.account_id LEFT JOIN shops s ON s.account_id = d.account_id
       LEFT JOIN staff st ON st.id = d.reviewed_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.created_at DESC, d.id DESC LIMIT 200`,
    args,
  );
  /* the counts for the tabs, of this store only when the list is narrowed to it */
  const one = /^\d{1,18}$/.test(shop);
  /* each status counts the documents still kept; the removed ones have a count of their own */
  const counts = await pool.query(
    `SELECT CASE WHEN removed_at IS NULL THEN status ELSE 'removed' END AS status, count(*)::int AS n
       FROM documents WHERE NOT draft${one ? " AND account_id = $1" : ""} GROUP BY 1`,
    one ? [shop] : [],
  );
  /* the store's name for "Only this store", known even when the chosen tab has no document of it */
  const named = one
    ? (await pool.query(`SELECT COALESCE(NULLIF(s.name, ''), a.name) AS name FROM accounts a LEFT JOIN shops s ON s.account_id = a.id WHERE a.id = $1`, [shop])).rows[0]
    : undefined;
  return answer({
    result: "ok",
    shopName: named?.name ?? null,
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    documents: rows.map((r) => ({
      id: String(r.public_id),
      shopId: String(r.account_id),
      /* the store's own name ("" while it has none) and its owner's. The owner's email and mobile are not in the list
         (security F08): the card's Contact button asks for them with the staff member's password
         (app/api/diwan/shops/[id]/contacts). The store's phone is the one its public page shows. */
      shopName: r.shop_name,
      ownerName: r.owner_name,
      shopSlug: r.shop_slug ?? null,
      storePhone: r.store_phone ?? "",
      kind: r.kind,
      /* this store's first, second... document of this kind, for the card's title ("Proof of delivery #001"); kept for
         good, so a removal never renumbers the others */
      seq: r.seq,
      name: r.name,
      partner: r.partner ?? "",
      partnerKind: r.partner_kind ?? null,
      /* a courier proof's courier, by phone (server/courierProof.ts), so staff see which courier they approve it for: the
         phone it was approved for once approved, otherwise the one it was sent for (opened from its sealed value by
         db.ts); "" when none is known (a proof from before phones were kept) */
      courierPhone: r.kind === "courier_proof" ? ((r.status === "approved" && r.approved_phone && r.approved_phone !== NO_COURIER ? r.approved_phone : r.partner_phone) ?? "") : "",
      hasFile: r.has_file,
      mime: r.mime ?? null,
      bytes: r.bytes ?? null,
      status: r.status,
      note: r.note,
      reviewer: r.reviewer,
      createdAt: r.created_at,
      /* when the merchant removed it (its file is gone), or null */
      removedAt: r.removed_at ? new Date(r.removed_at).toISOString() : null,
    })),
  });
});
