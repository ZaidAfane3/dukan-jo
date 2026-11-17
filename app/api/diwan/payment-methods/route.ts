import type { NextRequest } from "next/server";
import { PAY_METHODS, type PayMethod } from "@/components/diwan/platformSettings";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* How much each way to pay was used, for the Payment methods card in Diwan's settings:
   - store checkouts: the orders customers placed on the stores' public pages (store_orders, where every checkout is
     saved with its way to pay, its status, its total and when it was placed). Cancelled and refunded orders are left out.
     (Until 2026-11-17 this read every store's whole saved order list, "seen-orders" in store_data, opened and parsed
     store by store: that took seconds once there were many stores, and those lists hold only the orders the merchant
     keeps in his browser, his preview's test orders among them, never the customers' checkouts. One grouped query over
     store_orders counts the real ones, in milliseconds.)
   - buying themes: theme_purchases, which records the way to pay since it was asked at checkout (older ones have none).
   ?days=30|90|365 limits it to that many days back; anything else means all time.
   A store checkout paid by card or CliQ is a test order while no payment is taken (payment_status 'test', the same rule
   as the merchant's numbers, components/storeNumbers.ts isTestOrder): nothing was charged, so `ordersTest` says its
   total is not money received. Cash is paid to the courier, so its total is real. */

type Use = { orders: number; ordersTotal: number; ordersTest: boolean; stores: number; themes: number; themesTotal: number; buyers: number };
const ORDER_PAY: Record<string, PayMethod> = { cash: "cod", cliq: "cliq", card: "card" };
const round = (n: number) => Math.round(n * 1000) / 1000;

export const GET = staffRoute("settings", async (req: NextRequest) => {
  const days = Number(req.nextUrl.searchParams.get("days"));
  const since = [30, 90, 365].includes(days) ? Date.now() - days * 86_400_000 : 0;
  const use = Object.fromEntries(PAY_METHODS.map((m) => [m, { orders: 0, ordersTotal: 0, ordersTest: m === "card" || m === "cliq", stores: 0, themes: 0, themesTotal: 0, buyers: 0 }])) as Record<PayMethod, Use>;
  const pool = await db();

  const orders = await pool.query(
    `SELECT payment_method AS method, count(*)::int AS n, COALESCE(sum(total), 0)::float AS total, count(DISTINCT account_id)::int AS stores
       FROM store_orders WHERE status NOT IN ('cancelled', 'refunded') AND created_at >= to_timestamp($1 / 1000.0) GROUP BY payment_method`,
    [since],
  );
  for (const r of orders.rows) {
    const m = ORDER_PAY[r.method as string];
    if (!m || !use[m]) continue;
    use[m].orders = r.n;
    use[m].ordersTotal = round(r.total);
    use[m].stores = r.stores;
  }

  const themes = await pool.query(
    `SELECT method, count(*)::int AS n, COALESCE(sum(price), 0)::float AS total, count(DISTINCT account_id)::int AS buyers
       FROM theme_purchases WHERE method IS NOT NULL AND price > 0 AND paid_at >= to_timestamp($1 / 1000.0) GROUP BY method`,
    [since],
  );
  for (const r of themes.rows) {
    const m = r.method as PayMethod;
    if (!use[m]) continue;
    use[m].themes = r.n;
    use[m].themesTotal = round(r.total);
    use[m].buyers = r.buyers;
  }
  return answer({ result: "ok", use });
});
