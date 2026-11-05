import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { body, notFound, reasonOf, shopId } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Turns a merchant's 2-step code off when they lost their phone ({ reason }, required). Only after checking who is
   asking, outside Diwan: there are no recovery codes yet. Their sessions stay; the next sign-in needs only the password. */
export const POST = staffRoute("shops.status", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const reason = reasonOf((await body(req))?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const { rowCount } = await (await db()).query(`UPDATE accounts SET totp_on = false, totp_secret = NULL WHERE id = $1 AND totp_on`, [id]);
  if (!rowCount) return answer({ result: "already" }, 409);
  await audit(req, staff.id, "shop.totp.off", { type: "shop", id }, reason);
  return answer({ result: "ok" });
});
