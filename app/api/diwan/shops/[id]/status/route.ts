import { answer } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, notFound, reasonOf, shopId } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Suspends a shop ({ action: "suspend", reason }) or brings it back ({ action: "reactivate", reason? }). Suspending
   signs the merchant out everywhere, refuses their sign-in and their saves. The merchant is told the reason: at sign-in
   (after the right password) and in any tab they had open. So their own sessions are kept, though they count as
   signed out (server/auth.ts sessionRow), only to tell that tab why; support sessions and ones still waiting for a
   2-step code are deleted at once. Reactivating deletes every session, so nothing from before comes back to life and
   the merchant signs in again. The merchant gets a message in their bell either way. */
export const POST = staffRoute("shops.status", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const action = b?.action;
  const pool = await db();
  if (action === "suspend") {
    const reason = reasonOf(b?.reason);
    if (!reason) return answer({ result: "reason-needed" }, 400);
    const { rowCount } = await pool.query(
      `UPDATE shops SET status = 'suspended', suspend_reason = $2, suspended_at = now(), updated_at = now() WHERE account_id = $1 AND status <> 'suspended'`,
      /* staff-written text about the merchant: stored encrypted, like the other reasons (server/encryptData.ts) */
      [id, seal(reason)],
    );
    if (!rowCount) return answer({ result: "already" }, 409);
    await pool.query(`DELETE FROM sessions WHERE account_id = $1 AND (impersonation_id IS NOT NULL OR pending_totp)`, [id]);
    await pool.query(`UPDATE impersonations SET ended_at = now() WHERE account_id = $1 AND ended_at IS NULL`, [id]);
    await audit(req, staff.id, "shop.suspend", { type: "shop", id }, reason);
    await notify(id, "shopSuspended", { reason });
    return answer({ result: "ok" });
  }
  if (action === "reactivate") {
    const reason = reasonOf(b?.reason, 0) ?? "";
    const { rowCount } = await pool.query(
      `UPDATE shops SET status = 'active', suspend_reason = NULL, suspended_at = NULL, updated_at = now() WHERE account_id = $1 AND status = 'suspended'`,
      [id],
    );
    if (!rowCount) return answer({ result: "already" }, 409);
    /* the sessions kept while suspended (to tell open tabs why) end now */
    await pool.query(`DELETE FROM sessions WHERE account_id = $1`, [id]);
    await audit(req, staff.id, "shop.reactivate", { type: "shop", id }, reason || null);
    await notify(id, "shopReactivated", {});
    return answer({ result: "ok" });
  }
  return answer({ result: "invalid" }, 400);
});
