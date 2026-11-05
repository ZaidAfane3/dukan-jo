import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, sameOrigin } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* Removes one of the account's domains. It is kept as "removed" (Dukkan's team still sees it, and a bought one may
   still be registered), and its name is free again for any shop. Answers "ok" or "not-found". */
export const DELETE = (req: NextRequest, ctx: { params: { id: string } }) =>
  guarded(async (r: NextRequest) => {
    if (!sameOrigin(r)) return answer({ result: "forbidden" }, 403);
    const a = await currentAccount(r);
    if (!a) return answer({ result: "none" }, 401);
    const id = ctx.params.id;
    if (!/^\d{1,18}$/.test(id)) return answer({ result: "not-found" }, 404);
    const { rowCount } = await (await db()).query(
      `UPDATE domains SET status = 'removed', updated_at = now() WHERE id = $1 AND account_id = $2 AND status <> 'removed'`,
      [id, a.id],
    );
    return rowCount ? answer({ result: "ok" }) : answer({ result: "not-found" }, 404);
  })(req);
