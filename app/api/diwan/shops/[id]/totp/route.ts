import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { body, notFound, reasonOf, shopId, shopNameOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* Turns a merchant's 2-step code off when they lost their phone ({ reason }, required). Only after checking who is
   asking, outside Diwan: there are no recovery codes yet. Their sessions stay; the next sign-in needs only the password.
   Needs the staff member's own password with it ({ myPassword }, server/staffConfirm.ts passwordAgain). */
export const POST = staffRoute("shops.status", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const reason = reasonOf(b?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const refused = await passwordAgain(req, staff, b?.myPassword, "shop.totp.off");
  if (refused) return refused;
  const { rowCount } = await (await db()).query(`UPDATE accounts SET totp_on = false, totp_secret = NULL WHERE id = $1 AND totp_on`, [id]);
  if (!rowCount) return answer({ result: "already" }, 409);
  await audit(req, staff.id, "shop.totp.off", { type: "shop", id }, reason, { store: await shopNameOf(id) });
  return answer({ result: "ok" });
});
