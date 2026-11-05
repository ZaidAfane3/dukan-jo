import type { NextRequest } from "next/server";
import { cleanLines } from "@/components/safe";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Moves a domain along: { status: "checking" | "active" | "failed", note }. Failed needs a note (the merchant is told
   why). The merchant's bell gets a domainStatus message, and the activity log keeps what it was and what it became.
   A removed domain can't be changed. */
export const POST = staffRoute("domains", async (req: NextRequest, me, { params }) => {
  const id = params.id ?? "";
  const body = await readJson(req, 4_000);
  const status = body?.status;
  const note = cleanLines(body?.note ?? "", 500);
  if (!/^\d{1,18}$/.test(id) || (status !== "checking" && status !== "active" && status !== "failed")) return answer({ result: "invalid" }, 400);
  if (status === "failed" && !note.trim()) return answer({ result: "note-needed" }, 400);

  const pool = await db();
  const before = await pool.query(`SELECT account_id, name, status, note FROM domains WHERE id = $1`, [id]);
  const b = before.rows[0];
  if (!b) return answer({ result: "missing" }, 404);
  if (b.status === "removed") return answer({ result: "removed" }, 409);
  await pool.query(`UPDATE domains SET status = $2, note = $3, updated_at = now() WHERE id = $1`, [id, status, note]);
  await notify(b.account_id, "domainStatus", { domain: b.name, status, note });
  await audit(req, me.id, "domain.status", { type: "domain", id }, note || null, {
    shop: String(b.account_id),
    domain: b.name,
    before: { status: b.status, note: b.note },
    after: { status, note },
  });
  return answer({ result: "ok" });
});
