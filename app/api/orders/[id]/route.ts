import { answer, currentAccount, readJson } from "@/server/auth";
import { setStoreOrderStatus } from "@/server/storeOrders";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant changes the status of one of his store orders: PATCH /api/orders/<id> { status }. Only an order of his
   own shop (any other id answers 404, as one that does not exist); from Dukkan's own pages only (merchantRoute). */
export const PATCH = merchantRoute(async (req, me, ctx) => {
  /* a store Dukkan suspended changes nothing, like its saves (PUT /api/store) */
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const body = await readJson(req, 1_000);
  if (!body) return answer({ result: "invalid" }, 400);
  /* { status, from }: only while the order still has `from` (an undo); 409 "changed" when it no longer has it */
  const r = await setStoreOrderStatus(me.id, String(ctx.params.id ?? ""), body.status, body.from);
  if (r === "invalid") return answer({ result: "invalid" }, 400);
  if (r === "changed") return answer({ result: "changed" }, 409);
  if (r === "none") return answer({ result: "none" }, 404);
  return answer({ result: "ok" });
});
