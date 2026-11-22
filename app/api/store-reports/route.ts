import type { NextRequest } from "next/server";
import { cleanLine, cleanLines, visibleLength } from "@/components/safe";
import { REPORT_LIMITS, REPORT_REASONS, reportContact, type ReportReason } from "@/components/storeReports";
import { answer, guarded, readJson, reserveTry, sameOrigin, tooMany } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { audit, ipOf } from "@/server/staff";

export const dynamic = "force-dynamic";

/* "Report this store", from a store's footer: { slug, reason, body, contact }. Anyone can send one (no account), so it
   is limited per visitor and must come from Dukkan's own pages. The store link (slug) finds the shop; Dukkan's team
   sees the report in Diwan (Store reports).

   A store link that belongs to no shop gets the same "ok" and the report is dropped: there is no shop to attach it
   to, and a different answer would let anyone test which store links exist. Answers "ok", "invalid", "slow-down".

   Per store too, from everyone together: at most STORE_CAP reports kept in an hour, so one store's reports can't be
   flooded from many addresses. Only reports really kept count (a refused or broken one uses nothing up), and the
   ones over the cap get the same "ok" but are never dropped without a trace: Diwan's activity log says, once an hour
   for that store, that its reports passed the cap. */
const STORE_CAP = 30;
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "store-report", 5, 60)) return answer({ result: "slow-down" }, 429);
  const body = await readJson(req, 6_000);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const reason = REPORT_REASONS.includes(body?.reason as ReportReason) ? (body!.reason as ReportReason) : null;
  const text = cleanLines(body?.body, REPORT_LIMITS.body);
  /* an email or a Jordan mobile, or nothing (the form checks the same: storeReports reportContact) */
  const contact = reportContact(cleanLine(body?.contact ?? "", REPORT_LIMITS.contact));
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !reason || visibleLength(text) < REPORT_LIMITS.min) return answer({ result: "invalid" }, 400);
  if (contact === null) return answer({ result: "invalid", field: "contact" }, 400);

  const pool = await db();
  const { rows } = await pool.query(`SELECT account_id FROM shops WHERE lower(slug) = $1`, [slug]);
  if (!rows[0]) return answer({ result: "ok" });
  const shop = String(rows[0].account_id);
  /* taken before the report is written (reports sent at the same moment can't all pass), given back if it isn't */
  const giveBack = reserveTry(`store-report:${shop}`, STORE_CAP, 60);
  if (!giveBack) {
    if (reserveTry(`store-report-full:${shop}`, 1, 60)) await audit(req, null, "store_report.over_cap", { type: "shop", id: shop });
    return answer({ result: "ok" });
  }
  try {
    await pool.query(
      `INSERT INTO store_reports (account_id, reporter_kind, reporter_contact, reason, body, ip) VALUES ($1, 'customer', $2, $3, $4, $5)`,
      [shop, seal(contact), reason, seal(text), seal(ipOf(req))],
    );
  } catch (e) {
    giveBack();
    throw e;
  }
  return answer({ result: "ok" });
});
