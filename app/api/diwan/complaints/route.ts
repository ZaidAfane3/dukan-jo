import type { NextRequest } from "next/server";
import { cleanLine, cleanLines, visibleLength } from "@/components/safe";
import { REPORT_LIMITS, REPORT_REASONS, type ReportReason } from "@/components/storeReports";
import { answer, readJson } from "@/server/auth";
import { emailKey, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan's store reports: what customers sent with "Report this store" and what staff found themselves.
   GET filters from fixed lists: status (open = new or checking, the default; one status; all), reason, from
   (customer / staff), and shop (one store's account id). Newest first, 100 at a time: "Load more" asks for the reports
   after the last one shown (?before=, its id), so a report sent meanwhile never shows one twice; `next` is the id to ask
   with, or null at the end. The counts per status are for the tabs.
   POST adds a report found by staff: { shop (the shop's number, its owner's email or its store link), reason, body }. */

const STATUSES = ["new", "checking", "closed"];
const PAGE = 100;

export const GET = staffRoute("complaints", async (req: NextRequest, me) => {
  const sp = req.nextUrl.searchParams;
  const asked = sp.get("status") ?? "open";
  const status = asked === "open" || STATUSES.includes(asked) ? asked : "all";
  const reason = REPORT_REASONS.includes(sp.get("reason") as ReportReason) ? sp.get("reason")! : "";
  const from = sp.get("from") === "customer" || sp.get("from") === "staff" ? sp.get("from")! : "";
  const where: string[] = [];
  const args: unknown[] = [];
  if (status === "open") where.push(`r.status IN ('new', 'checking')`);
  else if (STATUSES.includes(status)) where.push(`r.status = $${args.push(status)}`);
  if (REPORT_REASONS.includes(reason as ReportReason)) where.push(`r.reason = $${args.push(reason)}`);
  if (from === "customer" || from === "staff") where.push(`r.reporter_kind = $${args.push(from)}`);
  /* one store's reports only (?shop=, from its page's "See all") */
  const shop = sp.get("shop") ?? "";
  if (/^\d{1,18}$/.test(shop)) where.push(`r.account_id = $${args.push(shop)}`);
  /* the reports after the last one shown, in the list's own order (newest first, then by id) */
  const before = sp.get("before") ?? "";
  if (/^\d{1,18}$/.test(before)) where.push(`(r.created_at, r.id) < (SELECT b.created_at, b.id FROM store_reports b WHERE b.id = $${args.push(before)})`);

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT r.id, r.account_id, r.reporter_kind, r.reporter_contact, r.reason, r.body, r.status, r.notes, r.created_at, r.updated_at,
            st.name AS handler, COALESCE(s.name, '') AS shop_name, a.name AS owner_name, s.slug AS shop_slug, s.status AS shop_status,
            (SELECT count(*)::int FROM store_reports o WHERE o.account_id = r.account_id) AS shop_reports
       FROM store_reports r JOIN accounts a ON a.id = r.account_id LEFT JOIN shops s ON s.account_id = r.account_id
       LEFT JOIN staff st ON st.id = r.handled_by
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY r.created_at DESC, r.id DESC LIMIT ${PAGE + 1}`,
    args,
  );
  /* the counts for the tabs, of this store only when the list is narrowed to it */
  const one = /^\d{1,18}$/.test(shop);
  const counts = await pool.query(`SELECT status, count(*)::int AS n FROM store_reports ${one ? "WHERE account_id = $1" : ""} GROUP BY status`, one ? [shop] : []);
  const page = rows.slice(0, PAGE);
  return answer({
    result: "ok",
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
    next: rows.length > PAGE ? String(page[page.length - 1].id) : null,
    rows: page.map((r) => ({
      id: String(r.id),
      shopId: String(r.account_id),
      /* the store's own name ("" while it has none) and its owner's, shown together (ShopAndOwner) */
      shopName: r.shop_name,
      ownerName: r.owner_name,
      shopSlug: r.shop_slug,
      shopStatus: r.shop_status,
      shopReports: r.shop_reports,
      from: r.reporter_kind,
      contact: r.reporter_contact,
      reason: r.reason,
      body: r.body,
      status: r.status,
      notes: r.notes,
      handler: r.handler,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

export const POST = staffRoute("complaints", async (req: NextRequest, me) => {
  const body = await readJson(req, 6_000);
  const shop = cleanLine(body?.shop ?? "", 254).toLowerCase();
  const reason = REPORT_REASONS.includes(body?.reason as ReportReason) ? (body!.reason as ReportReason) : null;
  const text = cleanLines(body?.body, REPORT_LIMITS.body);
  if (!shop || !reason || visibleLength(text) < REPORT_LIMITS.min) return answer({ result: "invalid" }, 400);

  const pool = await db();
  /* all digits can be a store's number or a store link ("123"): the link is looked up too, and wins when both match
     (a link is what staff copy from a store's address) */
  const found = shop.includes("@")
    ? await pool.query(`SELECT id FROM accounts WHERE email_hash = $1`, [emailKey(shop)])
    : /^\d{1,18}$/.test(shop)
      ? await pool.query(
          `SELECT id FROM (SELECT account_id AS id, 1 AS rank FROM shops WHERE lower(slug) = $1 UNION ALL SELECT id, 2 FROM accounts WHERE id = $1::bigint) f
            ORDER BY rank LIMIT 1`,
          [shop],
        )
      : await pool.query(`SELECT account_id AS id FROM shops WHERE lower(slug) = $1`, [shop]);
  const accountId = found.rows[0]?.id;
  if (!accountId) return answer({ result: "no-shop" }, 404);
  const { rows } = await pool.query(
    `INSERT INTO store_reports (account_id, reporter_kind, reporter_contact, reason, body, handled_by) VALUES ($1, 'staff', $2, $3, $4, $5) RETURNING id`,
    [accountId, seal(me.email), reason, seal(text), me.id],
  );
  await audit(req, me.id, "complaint.add", { type: "store_report", id: rows[0].id }, null, { shop: String(accountId), reason });
  return answer({ result: "ok", id: String(rows[0].id) });
});
