import type { NextRequest } from "next/server";
import { PAY_METHODS, type PayMethod } from "@/components/diwan/platformSettings";
import { cleanOrder } from "@/components/records";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* How much each way to pay was used, for the Payment methods card in Diwan's settings:
   - store checkouts: the orders customers placed in the stores (each store's orders are kept in store_data under
     "seen-orders", sealed; this connection opens them). Only orders paid through the checkout carry a way to pay;
     orders added by hand don't, so they are not counted. Cancelled and refunded orders are left out.
   - buying themes: theme_purchases, which records the way to pay since it was asked at checkout (older ones have none).
   ?days=30|90|365 limits it to that many days back; anything else means all time. */

type Use = { orders: number; ordersTotal: number; stores: number; themes: number; themesTotal: number; buyers: number };
const ORDER_PAY: Record<string, PayMethod> = { cash: "cod", cliq: "cliq", card: "card" };
const NOT_PAID = new Set(["cancelled", "refunded"]);
const round = (n: number) => Math.round(n * 1000) / 1000;

export const GET = staffRoute("settings", async (req: NextRequest) => {
  const days = Number(req.nextUrl.searchParams.get("days"));
  const since = [30, 90, 365].includes(days) ? Date.now() - days * 86_400_000 : 0;
  const use = Object.fromEntries(PAY_METHODS.map((m) => [m, { orders: 0, ordersTotal: 0, stores: 0, themes: 0, themesTotal: 0, buyers: 0 }])) as Record<PayMethod, Use>;
  const pool = await db();

  const stores = Object.fromEntries(PAY_METHODS.map((m) => [m, new Set<string>()])) as Record<PayMethod, Set<string>>;
  const { rows } = await pool.query(`SELECT account_id::text AS account, value FROM store_data WHERE key = 'seen-orders'`);
  for (const r of rows) {
    let list: unknown;
    try {
      list = JSON.parse(r.value as string);
    } catch {
      continue; // a store whose saved orders can't be read is skipped, not a failure for the whole page
    }
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const o = cleanOrder(raw as Record<string, unknown>);
      const m = o?.pay ? ORDER_PAY[o.pay] : undefined;
      if (!o || !m || NOT_PAID.has(o.status) || o.created < since) continue;
      use[m].orders += 1;
      use[m].ordersTotal += o.total;
      stores[m].add(r.account as string);
    }
  }
  for (const m of PAY_METHODS) {
    use[m].stores = stores[m].size;
    use[m].ordersTotal = round(use[m].ordersTotal);
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
