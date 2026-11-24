import { answer, currentAccount } from "@/server/auth";
import { deleteSignup } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant deletes one of his store's back-in-stock requests: DELETE /api/store-signups/<id>. Only one of his own
   shop's (any other id, and any newsletter subscriber, answers 404 as one that does not exist: he doesn't see who his
   subscribers are); from Dukkan's own pages only (merchantRoute). */
export const DELETE = merchantRoute(async (req, me, ctx) => {
  /* a store Dukkan suspended changes nothing, like its saves (PUT /api/store) */
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  if (!(await deleteSignup(me.id, String(ctx.params.id ?? "")))) return answer({ result: "none" }, 404);
  return answer({ result: "ok" });
});
