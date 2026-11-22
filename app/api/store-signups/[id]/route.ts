import { answer, currentAccount } from "@/server/auth";
import { deleteSignup } from "@/server/storeSignups";
import { merchantRoute } from "@/server/tickets";

export const dynamic = "force-dynamic";

/* The merchant deletes one email from his store's lists (newsletter or back in stock): DELETE /api/store-signups/<id>.
   Only one of his own shop's (any other id answers 404, as one that does not exist); from Dukkan's own pages only
   (merchantRoute). */
export const DELETE = merchantRoute(async (req, me, ctx) => {
  /* a store Dukkan suspended changes nothing, like its saves (PUT /api/store) */
  if ((await currentAccount(req))?.suspended) return answer({ result: "suspended" }, 423);
  if (!(await deleteSignup(me.id, String(ctx.params.id ?? "")))) return answer({ result: "none" }, 404);
  return answer({ result: "ok" });
});
