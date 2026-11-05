import type { NextRequest } from "next/server";
import { answer, currentAccount, endSession, guarded, sameOrigin } from "@/server/auth";
import { db } from "@/server/db";
import { audit } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Ends a staff member's "log in as merchant" from the banner on the merchant's pages: the visit is marked ended (and
   logged in Diwan's activity log) and this browser is signed out of the store. */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  const a = await currentAccount(req);
  const imp = a?.impersonation;
  const res = answer({ result: "ok", shop: a?.id ?? null });
  if (a && imp) {
    const { rowCount } = await (await db()).query(`UPDATE impersonations SET ended_at = now() WHERE id = $1 AND ended_at IS NULL`, [imp.id]);
    if (rowCount) await audit(req, imp.staffId, "shop.impersonate.end", { type: "shop", id: a.id }, null, { impersonation: imp.id });
  }
  /* only a support session is ended here: a merchant's own session uses the normal sign-out */
  if (!a || imp) await endSession(res, req);
  return res;
});
