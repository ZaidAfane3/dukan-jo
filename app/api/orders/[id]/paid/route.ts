import { answer, currentAccount } from "@/server/auth";
import { confirmStoreOrderPayment } from "@/server/storeOrders";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant says the customer paid a card or CliQ store order ("Payment received" on the Orders page):
   POST /api/orders/<id>/paid. No payment is taken online yet, so this is how such an order becomes paid: its stock is
   taken then (server/storeOrders.ts confirmStoreOrderPayment). Only an order of his own shop (any other id answers 404,
   as one that does not exist); from Dukkan's own pages only (merchantRoute); a store Dukkan suspended changes nothing.
   Answers: "ok" (`moved`: the order took its stock now; marked again: "ok", nothing taken twice), 409 "no-stock" with
   `short` (a product no longer has enough stock for it: nothing changed), 400 "invalid" (a cash order, or one cancelled
   or refunded). */
export const POST = merchantRoute(async (req, me, ctx) => {
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const r = await confirmStoreOrderPayment(me.id, String(ctx.params.id ?? ""));
  if (r.result === "invalid") return answer({ result: "invalid" }, 400);
  if (r.result === "no-stock") return answer({ result: "no-stock", short: r.short }, 409);
  if (r.result !== "ok") return answer({ result: "none" }, 404);
  return answer({ result: "ok", moved: r.moved });
});
