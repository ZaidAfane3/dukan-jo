import { answer, readJson } from "@/server/auth";
import { markShipOrder } from "@/server/shipOrders";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* PATCH /api/diwan/ship/orders/<id> { state: "delivered" | "failed" | "waiting", note? }: staff mark a Dukkan Ship
   order delivered, not delivered (note: why) or back to waiting (server/shipOrders.ts markShipOrder). 409 "cancelled":
   the store cancelled or refunded it; 409 "review": a big order the store has not reviewed yet. */
export const PATCH = staffRoute("ship.orders", async (req, me, ctx) => {
  const body = await readJson(req, 2_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const r = await markShipOrder(req, me, String(ctx.params.id ?? ""), body);
  if (r === "invalid") return answer({ result: "invalid" }, 400);
  if (r === "none") return answer({ result: "none" }, 404);
  if (r === "cancelled" || r === "review") return answer({ result: r }, 409);
  return answer({ result: "ok" });
});
