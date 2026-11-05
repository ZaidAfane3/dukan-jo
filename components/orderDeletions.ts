import { signedInAs } from "./demoSandbox";
import { merchantCall, onServer } from "./merchantApi";
import { cleanDeleteReason, deleteReasonOk } from "./orderDeleteRule";
import { cleanLine } from "./safe";

/* the reason's rule lives in orderDeleteRule.ts, so the server can use it too */
export { DELETE_REASON, cleanDeleteReason, deleteReasonOk } from "./orderDeleteRule";

/* Deleting an order needs a reason. The reason is kept with the deletion so it reaches Dukkan if anything goes wrong.

   FOR THE BACKEND: each deletion is one record { orderId, orderNo, reason, deletedAt, by }. Today the records are kept
   in this browser under "seen-orders-deleted", next to the orders ("seen-orders"), in the same per-account storage.
   On the server, deleting an order must require the same reason (checked with deleteReasonOk) and write this record
   in the same step, then send it to Dukkan (docs/forms-and-uploads-notes.md).
   For a signed-in account the record is also sent to /api/order-deletions (the order number and the reason only; the
   server takes "by" from the session), where Dukkan can see it on the shop's page in Diwan. */

export const DELETED_KEY = "seen-orders-deleted";
/* Older records are dropped first so the browser storage never fills up */
const LOG_MAX = 500;

export type OrderDeletion = { orderId: number; orderNo: string; reason: string; deletedAt: number; by: string };

function cleanDeletion(x: unknown): OrderDeletion | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const orderId = Number(r.orderId);
  const deletedAt = Number(r.deletedAt);
  const reason = cleanDeleteReason(r.reason);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isFinite(deletedAt) || deletedAt <= 0 || !deleteReasonOk(reason)) return null;
  return { orderId, orderNo: cleanLine(r.orderNo, 20) || `#${orderId}`, reason, deletedAt, by: cleanLine(r.by, 254) };
}

/** The deletions kept in this browser, oldest first. Broken or hand-changed records are left out. */
export function loadDeletions(): OrderDeletion[] {
  try {
    const list = JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]");
    return Array.isArray(list) ? list.map(cleanDeletion).filter((x): x is OrderDeletion => !!x) : [];
  } catch {
    return [];
  }
}

/** Keeps the record of a deleted order. Returns false when the reason is not good enough (nothing is saved). */
export function logDeletion(orderId: number, reason: string): boolean {
  const rec = cleanDeletion({ orderId, orderNo: `#${orderId}`, reason, deletedAt: Date.now(), by: signedInAs() ?? "" });
  if (!rec) return false;
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...loadDeletions(), rec].slice(-LOG_MAX)));
  } catch {
    /* storage unavailable: the order is still deleted */
  }
  if (onServer()) void sendDeletion(rec);
  return true;
}

/* Sends one deletion to Dukkan. The server keeps one record per order, so sending it twice does no harm: when the
   server could not be reached, it is tried again a little later (twice at most). */
async function sendDeletion(rec: OrderDeletion, tries = 0): Promise<void> {
  const r = await merchantCall("/api/order-deletions", "POST", { orderId: rec.orderId, orderNo: rec.orderNo, reason: rec.reason });
  if ((r === null || r.status >= 500) && tries < 2) setTimeout(() => void sendDeletion(rec, tries + 1), 5_000 * (tries + 1));
}
