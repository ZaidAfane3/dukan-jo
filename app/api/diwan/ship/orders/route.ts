import { answer } from "@/server/auth";
import { isShipTab, listShipOrders } from "@/server/shipOrders";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Diwan > Dukkan Ship > Orders: GET ?tab=waiting|delivered|failed|cancelled|all&q=<store or order number>&before=<id>.
   The orders Dukkan Ship delivers, with what the courier needs (server/shipOrders.ts). Owners only ("ship.orders"). */
export const GET = staffRoute("ship.orders", async (req) => {
  const p = req.nextUrl.searchParams;
  const tab = p.get("tab");
  const out = await listShipOrders(isShipTab(tab) ? tab : "waiting", p.get("q") ?? "", p.get("before"));
  return answer({ result: "ok", ...out });
});
