import { signedInAs } from "./demoSandbox";
import { cleanLine, cleanLines, visibleLength } from "./safe";

/* Deleting an order needs a reason. The reason is kept with the deletion so it reaches Dukkan if anything goes wrong.

   FOR THE BACKEND: each deletion is one record { orderId, orderNo, reason, deletedAt, by }. Today the records are kept
   in this browser under "seen-orders-deleted", next to the orders ("seen-orders"), in the same per-account storage.
   On the server, deleting an order must require the same reason (checked with deleteReasonOk) and write this record
   in the same step, then send it to Dukkan (docs/forms-and-uploads-notes.md). */

export const DELETED_KEY = "seen-orders-deleted";
/** The reason must say something: at least `min` visible characters, at most `max` characters. */
export const DELETE_REASON = { min: 5, max: 500 };
/* Older records are dropped first so the browser storage never fills up */
const LOG_MAX = 500;

export type OrderDeletion = { orderId: number; orderNo: string; reason: string; deletedAt: number; by: string };

/** The reason as it is saved: cleaned, line breaks kept, invisible characters removed, cut to the maximum. */
export const cleanDeleteReason = (s: unknown): string => cleanLines(s, DELETE_REASON.max);

/** True when the reason can be saved: enough visible characters once cleaned. */
export const deleteReasonOk = (s: unknown): boolean => visibleLength(cleanDeleteReason(s)) >= DELETE_REASON.min;

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
  return true;
}
