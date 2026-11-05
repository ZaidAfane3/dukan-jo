import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, changeSubscription, lengthOf, notFound, shopId, textOf } from "@/server/shopActions";
import { expireSubscriptions } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* Changes a shop's plan or extends its trial or subscription: { planId?, until: "yyyy-mm-dd" | days | months, note? }.
   Without planId the current plan is extended. The merchant gets a message in their bell. */
export const POST = staffRoute("billing", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const len = lengthOf(b);
  if (!len) return answer({ result: "length-needed" }, 400);
  const planId = typeof b?.planId === "string" || typeof b?.planId === "number" ? String(b.planId) || null : null;
  if (planId !== null && !/^\d{1,12}$/.test(planId)) return answer({ result: "invalid" }, 400);
  const note = textOf(b?.note, 300);
  const pool = await db();
  await expireSubscriptions(pool);
  const client = await pool.connect();
  let r;
  try {
    await client.query("BEGIN");
    r = await changeSubscription(client, id, staff.id, planId, len, note);
    if (!r.ok) {
      await client.query("ROLLBACK");
      return answer({ result: r.why }, 400);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await audit(req, staff.id, "shop.plan", { type: "shop", id }, note || null, { subscription: r.subId, plan: r.planEn, ends: r.endsAt });
  await notify(id, "planChanged", { plan: r.planEn, planAr: r.planAr, ends: r.endsAt });
  return answer({ result: "ok", endsAt: r.endsAt });
});
