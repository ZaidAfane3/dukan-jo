import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's papers queue: the documents shops sent for checking (courier proof, commercial registration), newest first.
   Filters from fixed lists: status (waiting, the default; approved; rejected; all) and kind. At most 200 rows.
   Merchants can't send files yet (no file storage), so the list stays empty until uploads exist. */

const STATUSES = ["waiting", "approved", "rejected"];
const KINDS = ["courier_proof", "commercial_registration", "other"];

export const GET = staffRoute("documents", async (req: NextRequest, me) => {
  const sp = req.nextUrl.searchParams;
  const asked = sp.get("status") ?? "waiting";
  const status = STATUSES.includes(asked) ? asked : "all";
  const kind = KINDS.includes(sp.get("kind") ?? "") ? sp.get("kind")! : "";
  const where: string[] = [];
  const args: unknown[] = [];
  if (STATUSES.includes(status)) where.push(`d.status = $${args.push(status)}`);
  if (KINDS.includes(kind)) where.push(`d.kind = $${args.push(kind)}`);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT d.id, d.account_id, d.kind, d.name, d.file_key IS NOT NULL AS has_file, d.status, d.note, d.created_at,
            st.name AS reviewer, COALESCE(NULLIF(s.name, ''), a.name) AS shop_name, a.email AS shop_email
       FROM documents d JOIN accounts a ON a.id = d.account_id LEFT JOIN shops s ON s.account_id = d.account_id
       LEFT JOIN staff st ON st.id = d.reviewed_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.created_at DESC, d.id DESC LIMIT 200`,
    args,
  );
  const counts = await pool.query(`SELECT status, count(*)::int AS n FROM documents GROUP BY status`);
  await audit(req, me.id, "documents.view", undefined, null, { status, kind: kind || undefined });
  return answer({
    result: "ok",
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    documents: rows.map((r) => ({
      id: String(r.id),
      shopId: String(r.account_id),
      shopName: r.shop_name,
      shopEmail: r.shop_email,
      kind: r.kind,
      name: r.name,
      hasFile: r.has_file,
      status: r.status,
      note: r.note,
      reviewer: r.reviewer,
      createdAt: r.created_at,
    })),
  });
});
