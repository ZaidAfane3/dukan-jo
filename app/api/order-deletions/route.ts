import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { cleanDeleteReason, deleteReasonOk } from "@/components/orderDeleteRule";
import { cleanLine } from "@/components/safe";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* A deleted order, as Dukkan keeps it: the order's number, why it was deleted, who deleted it and when. Never the
   order itself (docs/forms-and-uploads-notes.md, "Deleting an order (decision C8)"). The reason follows the same rule
   as the delete dialog (deleteReasonOk); who deleted it comes from the session, never from the page. One record per
   order: sending the same deletion again changes nothing. Answers: "ok", "invalid", "none" (signed out). */

/** Who is deleting: the account's email, or the Dukkan staff member using "Log in as merchant" on it */
async function deletedBy(req: NextRequest, email: string): Promise<string> {
  const token = req.cookies.get("dukkan-session")?.value;
  if (!token) return email;
  const { rows } = await (await db()).query(
    `SELECT st.email FROM sessions s JOIN impersonations i ON i.id = s.impersonation_id JOIN staff st ON st.id = i.staff_id
      WHERE s.token_hash = $1`,
    [createHash("sha256").update(token).digest("hex")],
  );
  return rows[0] ? `${email} (Dukkan: ${rows[0].email})` : email;
}

export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "order-deletions", 300, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const body = await readJson(req, 4_000);
  const orderId = Number(body?.orderId);
  const reason = cleanDeleteReason(body?.reason);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !deleteReasonOk(reason)) return answer({ result: "invalid" }, 400);
  const orderNo = cleanLine(body?.orderNo, 20) || `#${orderId}`;
  await (await db()).query(
    `INSERT INTO order_deletions (account_id, order_id, order_no, reason, deleted_by) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, order_id) DO NOTHING`,
    [a.id, orderId, orderNo, seal(reason), seal(await deletedBy(req, a.email))],
  );
  return answer({ result: "ok" });
});

/** The account's own deletions, newest first */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const { rows } = await (await db()).query(
    `SELECT order_id, order_no, reason, deleted_by, deleted_at FROM order_deletions WHERE account_id = $1 ORDER BY deleted_at DESC LIMIT 500`,
    [a.id],
  );
  return answer({
    result: "ok",
    deletions: rows.map((r) => ({ orderId: Number(r.order_id), orderNo: r.order_no, reason: r.reason, by: r.deleted_by, deletedAt: r.deleted_at })),
  });
});
