import { answer, currentAccount } from "@/server/auth";
import { remindStoreCart } from "@/server/storeCarts";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant reminds the customer of one of his store's abandoned carts by email: POST /api/abandoned-carts/<id>/remind.
   Only a cart of his own shop (any other id answers 404, as one that does not exist); from Dukkan's own pages only
   (merchantRoute). server/storeCarts.ts holds every limit (one a day per cart, at most 3, only an abandoned cart with
   an email). Answers: 200 { result: "ok", reminders, nextAt, stub? }, 404 "none", 409 "recovered" / "no-email" /
   "max" / "wait" (with nextAt) / "active" / "closed", 423 "suspended", 429 "slow-down", 503 "no-sender" / "failed". */
export const POST = merchantRoute(async (req, me, ctx) => {
  /* a store Dukkan suspended sends nothing, like its saves (PUT /api/store) */
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  const r = await remindStoreCart(me.id, String(ctx.params.id ?? ""));
  return answer(r.body, r.status);
});
