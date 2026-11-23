import type { PoolClient } from "pg";
import { cleanProduct } from "@/components/records";
import { productId } from "@/components/safeOrder";
import { notify } from "./notify";

/* Telling the merchant when an order takes a product's stock down: "almost out" (lowStock) once it reaches the number
   he set on the product ("Warn me when the quantity reaches", lowAt) or goes below it, and "run out" (outOfStock) once
   none is left. Settings, Customize notifications has a switch for each (components/notifyPrefs.ts).

   It is worked out from the stock before and after one change, never stored: a notice is written only when that change
   crosses the line (more than lowAt before, lowAt or less after; or some before, none after). So the next orders that
   take the same product lower again tell him nothing, and he hears again only after the stock went back above the line
   (he added stock on Products, or a cancelled order gave pieces back) and an order took it down once more. An order that
   takes a product from above lowAt straight to 0 sends only "run out": that says all of it.

   The stock is taken by store orders only when they are really on (server/storeOrders.ts moveOrderStock: a cash order
   the merchant confirms, a card or CliQ order whose payment is confirmed, an order Dukkan Ship delivered), and those
   are the changes checked here. Stock he types himself on Products, or an order he adds by hand in his dashboard, is
   his own doing and tells him nothing. A product with no limit, or in the bin, never does either. A product in sizes
   counts all its sizes together, as Reports does (one size running out while others are left is not "run out"). */

export type StockAlert = { kind: "lowStock" | "outOfStock"; id: number; name: string; left: number };

/* id, name, stock and lowAt of the products that count (a list as saved in seen-products), by id */
function stockById(list: readonly unknown[]): Map<number, { name: string; left: number; lowAt: number }> {
  const out = new Map<number, { name: string; left: number; lowAt: number }>();
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const p = cleanProduct(raw as Record<string, unknown>);
    if (!p || out.has(p.id) || p.unlimited || p.deletedAt !== undefined) continue;
    out.set(p.id, { name: p.name, left: p.quantity, lowAt: p.lowAt });
  }
  return out;
}

/** The products whose stock crossed a line between `before` and `after` (the saved product list on each side of one
    change), among `ids` (the products the change took from). See the top of this file. */
export function stockCrossings(before: readonly unknown[], after: readonly unknown[], ids: readonly unknown[]): StockAlert[] {
  const was = stockById(before);
  const now = stockById(after);
  const seen = new Set<number>();
  const out: StockAlert[] = [];
  for (const raw of ids) {
    const id = productId(raw);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    const a = was.get(id);
    const b = now.get(id);
    if (!a || !b || b.left >= a.left) continue;
    if (b.left <= 0 && a.left > 0) out.push({ kind: "outOfStock", id, name: b.name, left: 0 });
    else if (b.left > 0 && b.left <= b.lowAt && a.left > b.lowAt) out.push({ kind: "lowStock", id, name: b.name, left: b.left });
  }
  return out;
}

/** Writes each crossing to the merchant's bell, inside the caller's transaction (kept only if the change is). The email
    goes after the caller's COMMIT: server/notify.ts emailStockNotices with the same list. */
export async function noteStockAlerts(c: Pick<PoolClient, "query">, accountId: string | number, alerts: readonly StockAlert[]): Promise<void> {
  for (const a of alerts)
    await notify(accountId, a.kind, a.kind === "lowStock" ? { id: a.id, name: a.name, left: a.left } : { id: a.id, name: a.name }, c);
}
