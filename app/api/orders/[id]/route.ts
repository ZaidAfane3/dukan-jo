import { answer, currentAccount, readJson } from "@/server/auth";
import { setStoreOrderStatus } from "@/server/storeOrders";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant changes the status of one of his store orders: PATCH /api/orders/<id> { status, from }. Only an order of
   his own shop (any other id answers 404, as one that does not exist); from Dukkan's own pages only (merchantRoute).
   Answers: "ok" (with `notBack`: lines whose pieces could not go back to the stock, a size renamed or removed since),
   409 "changed" (the order no longer has `from`), 409 "no-stock" with `short` (brought back out of cancelled or refunded
   while a product no longer has enough stock for it: nothing changed). */
export const PATCH = merchantRoute(async (req, me, ctx) => {
  /* a store Dukkan suspended changes nothing, like its saves (PUT /api/store) */
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const r = await setStoreOrderStatus(me.id, String(ctx.params.id ?? ""), body.status, body.from);
  if (r.result === "invalid") return answer({ result: "invalid" }, 400);
  if (r.result === "changed") return answer({ result: "changed" }, 409);
  if (r.result === "no-stock") return answer({ result: "no-stock", short: r.short }, 409);
  if (r.result !== "ok") return answer({ result: "none" }, 404);
  return answer({ result: "ok", ...(r.notBack.length ? { notBack: r.notBack } : {}) });
});
