import type { NextRequest } from "next/server";
import { cleanDeleteReason, deleteReasonOk } from "@/components/orderDeleteRule";
import { cleanLine } from "@/components/safe";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { plainText, seal } from "@/server/crypto";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* A deleted order, as Dukkan keeps it: the order's number, why it was deleted, who deleted it and when. Never the
   order itself (docs/forms-and-uploads-notes.md, "Deleting an order (decision C8)"). The reason follows the same rule
   as the delete dialog (deleteReasonOk); who deleted it comes from the session, never from the page. One record per
   order: sending the same deletion again changes nothing. Answers: "ok", "invalid", "none" (signed out). */

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
    [a.id, orderId, plainText(orderNo), seal(reason), seal(a.email)],
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

/** Takes back the record of a deletion the merchant undid (the order is back in his list): DELETE ?orderId=<id>. Only
    the signed-in account's own record, and only one made in the last 5 minutes (the page offers the undo for 30
    seconds): an older record stays, since it is what Dukkan keeps "in case anything goes wrong". Answers "ok" with how
    many went (0 when there was none, or it was too old), "invalid", "none" (signed out). */
export const DELETE = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "order-deletions", 300, 60)) return answer({ result: "slow-down" }, 429);
  const a = await currentAccount(req);
  if (!a) return answer({ result: "none" }, 401);
  const orderId = Number(req.nextUrl.searchParams.get("orderId"));
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return answer({ result: "invalid" }, 400);
  const { rowCount } = await (await db()).query(
    `DELETE FROM order_deletions WHERE account_id = $1 AND order_id = $2 AND deleted_at > now() - interval '5 minutes'`,
    [a.id, orderId],
  );
  return answer({ result: "ok", removed: rowCount ?? 0 });
});
