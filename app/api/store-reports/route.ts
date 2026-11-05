import type { NextRequest } from "next/server";
import { cleanLine, cleanLines, visibleLength } from "@/components/safe";
import { REPORT_LIMITS, REPORT_REASONS, type ReportReason } from "@/components/storeReports";
import { answer, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { ipOf } from "@/server/staff";

export const dynamic = "force-dynamic";

/* "Report this store", from a store's footer: { slug, reason, body, contact }. Anyone can send one (no account), so it
   is limited per visitor and must come from Dukkan's own pages. The store link (slug) finds the shop; Dukkan's team
   sees the report in Diwan (Store reports).

   A store link that belongs to no shop gets the same "ok" and the report is dropped: there is no shop to attach it
   to, and a different answer would let anyone test which store links exist. Answers "ok", "invalid", "slow-down". */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "store-report", 5, 60)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 6_000);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const reason = REPORT_REASONS.includes(body?.reason as ReportReason) ? (body!.reason as ReportReason) : null;
  const text = cleanLines(body?.body, REPORT_LIMITS.body);
  const contact = cleanLine(body?.contact ?? "", REPORT_LIMITS.contact);
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !reason || visibleLength(text) < REPORT_LIMITS.min) return answer({ result: "invalid" }, 400);

  const pool = await db();
  const { rows } = await pool.query(`SELECT account_id FROM shops WHERE lower(slug) = $1`, [slug]);
  if (rows[0]) {
    await pool.query(
      `INSERT INTO store_reports (account_id, reporter_kind, reporter_contact, reason, body, ip) VALUES ($1, 'customer', $2, $3, $4, $5)`,
      [rows[0].account_id, seal(contact), reason, seal(text), seal(ipOf(req))],
    );
  }
  return answer({ result: "ok" });
});
