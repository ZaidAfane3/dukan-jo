import { answer } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, changeSubscription, dayOf, jodOf, lengthOf, notFound, shopId, textOf } from "@/server/shopActions";
import { expireSubscriptions } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const METHODS = ["bank", "cliq", "cash", "card"];

/* Marks a payment as received: { amount (JOD), method, reference?, paidOn: "yyyy-mm-dd", note?, and optionally
   months (with planId when the shop is on its trial) to extend the subscription by }. The payment is linked to the
   subscription it pays for. The merchant gets a message in their bell. */
export const POST = staffRoute("billing", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const amount = jodOf(b?.amount);
  const method = typeof b?.method === "string" && METHODS.includes(b.method) ? b.method : null;
  const paidOn = dayOf(b?.paidOn);
  if (!amount || !method || !paidOn) return answer({ result: "invalid" }, 400);
  const reference = textOf(b?.reference, 100);
  const note = textOf(b?.note, 300);
  const wantsMonths = b?.months !== undefined && b?.months !== null && b?.months !== "" && Number(b?.months) !== 0;
  const extend = wantsMonths ? lengthOf({ months: Number(b?.months) }) : null;
  if (wantsMonths && !extend) return answer({ result: "invalid" }, 400);
  const planId = (typeof b?.planId === "string" || typeof b?.planId === "number") && String(b.planId) !== "" ? String(b.planId) : null;
  if (planId !== null && !/^\d{1,12}$/.test(planId)) return answer({ result: "invalid" }, 400);

  const pool = await db();
  await expireSubscriptions(pool);
  const client = await pool.connect();
  let paymentId: string;
  let sub: Awaited<ReturnType<typeof changeSubscription>> | null = null;
  try {
    await client.query("BEGIN");
    if (extend) {
      /* a payment pays for a paid plan: extending a trial needs the plan it becomes */
      const cur = (
        await client.query(`SELECT p.key FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.account_id = $1 AND s.status IN ('trial', 'active')`, [id])
      ).rows[0];
      if (!planId && (!cur || cur.key === "trial")) {
        await client.query("ROLLBACK");
        return answer({ result: "plan-needed" }, 400);
      }
      sub = await changeSubscription(client, id, staff.id, planId, extend, note);
      if (!sub.ok) {
        await client.query("ROLLBACK");
        return answer({ result: sub.why }, 400);
      }
    }
    const subId = sub?.ok
      ? sub.subId
      : ((await client.query(`SELECT id FROM subscriptions WHERE account_id = $1 AND status IN ('trial', 'active')`, [id])).rows[0]?.id ?? null);
    const { rows } = await client.query(
      `INSERT INTO payments (account_id, subscription_id, amount, method, reference, paid_on, marked_by, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [id, subId, amount, method, reference, paidOn, staff.id, seal(note)],
    );
    paymentId = String(rows[0].id);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await audit(req, staff.id, "shop.payment", { type: "shop", id }, note || null, {
    payment: paymentId,
    amount,
    method,
    ...(sub?.ok ? { plan: sub.planEn, ends: sub.endsAt } : {}),
  });
  await notify(id, "paymentReceived", { amount, method });
  if (sub?.ok) await notify(id, "planChanged", { plan: sub.planEn, planAr: sub.planAr, ends: sub.endsAt });
  return answer({ result: "ok" });
});
