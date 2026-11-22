import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, notFound, reasonOf, shopId, shopNameOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* Turns a merchant's 2-step sign-in off when they can't get its codes any more: they lost access to their email (where
   the codes go) and to their recovery codes ({ reason }, required). Only after checking who is asking, outside Diwan,
   since whoever gets this through can sign in with the password alone. Their sessions stay; the next sign-in needs
   only the password. The merchant is told, in the bell and by email in their language (notify "twoStepOff"), so one who
   never asked for it knows at once.
   Needs the staff member's own password with it ({ myPassword }, server/staffConfirm.ts passwordAgain). */
export const POST = staffRoute("shops.status", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const reason = reasonOf(b?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const refused = await passwordAgain(req, staff, b?.myPassword, "shop.totp.off");
  if (refused) return refused;
  const { rowCount } = await (await db()).query(`UPDATE accounts SET totp_on = false, two_step_method = NULL, totp_secret = NULL, totp_recovery = '{}' WHERE id = $1 AND totp_on`, [id]);
  if (!rowCount) return answer({ result: "already" }, 409);
  await audit(req, staff.id, "shop.totp.off", { type: "shop", id }, reason, { store: await shopNameOf(id) });
  await notify(id, "twoStepOff");
  return answer({ result: "ok" });
});
