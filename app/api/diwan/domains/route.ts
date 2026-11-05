import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's domain queue: every shop's domains with their status, newest first. Filters (all optional, each from a fixed
   list): status (open = awaiting or checking, the default; or one status; or all), kind (connect / bought),
   papers=1 (only .jo / .com.jo that need the commercial registration), q (part of the domain or the shop's name),
   sort (new / old / updated). At most 200 rows; the counts per status are for the tabs. */

const STATUSES = ["awaiting", "checking", "active", "failed", "removed"];
const SORTS: Record<string, string> = { new: "d.created_at DESC, d.id DESC", old: "d.created_at, d.id", updated: "d.updated_at DESC, d.id DESC" };

export const GET = staffRoute("domains", async (req: NextRequest, me) => {
  const sp = req.nextUrl.searchParams;
  const asked = sp.get("status") ?? "open";
  const status = asked === "open" || STATUSES.includes(asked) ? asked : "all";
  const kind = sp.get("kind") === "connect" || sp.get("kind") === "bought" ? sp.get("kind")! : "";
  const papers = sp.get("papers") === "1";
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  const order = SORTS[sp.get("sort") ?? "new"] ?? SORTS.new;

  const where: string[] = [];
  const args: unknown[] = [];
  if (status === "open") where.push(`d.status IN ('awaiting', 'checking')`);
  else if (STATUSES.includes(status)) where.push(`d.status = $${args.push(status)}`);
  if (kind === "connect" || kind === "bought") where.push(`d.kind = $${args.push(kind)}`);
  if (papers) where.push(`d.papers_needed`);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(d.name ILIKE $${args.push(like)} OR s.name ILIKE $${args.length} OR a.name ILIKE $${args.length} OR a.email ILIKE $${args.length})`);
  }

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT d.id, d.account_id, d.name, d.kind, d.status, d.note, d.years, d.renews_at, d.auto_renew, d.paid, d.papers_needed,
            d.created_at, d.updated_at, COALESCE(NULLIF(s.name, ''), a.name) AS shop_name, a.email AS shop_email
       FROM domains d JOIN accounts a ON a.id = d.account_id LEFT JOIN shops s ON s.account_id = d.account_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${order} LIMIT 200`,
    args,
  );
  const counts = await pool.query(`SELECT status, count(*)::int AS n FROM domains GROUP BY status`);
  await audit(req, me.id, "domains.view", undefined, null, { status, kind, papers, q: q || undefined });
  return answer({
    result: "ok",
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    domains: rows.map((r) => ({
      id: String(r.id),
      shopId: String(r.account_id),
      shopName: r.shop_name,
      shopEmail: r.shop_email,
      name: r.name,
      kind: r.kind,
      status: r.status,
      note: r.note,
      years: r.years,
      renewsAt: r.renews_at,
      autoRenew: r.auto_renew,
      paid: Number(r.paid),
      papersNeeded: r.papers_needed,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});
