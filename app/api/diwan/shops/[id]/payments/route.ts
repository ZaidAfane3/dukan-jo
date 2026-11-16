import { answer } from "@/server/auth";
import { seal } from "@/server/crypto";
import { db } from "@/server/db";
import { notify } from "@/server/notify";
import { body, dayOf, jodOf, notFound, shopId, textOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const METHODS = ["bank", "cliq", "cash", "card"];

/* Marks a payment as received: { amount (JOD), method, reference?, paidOn: "yyyy-mm-dd", note? }. Dukkan has no plans
   and no free trial, so a payment stands on its own: it is not linked to a subscription and extends nothing
   (payments.subscription_id stays empty). The merchant gets a message in their bell. */
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

  const { rows } = await (await db()).query(
    `INSERT INTO payments (account_id, amount, method, reference, paid_on, marked_by, note) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [id, amount, method, reference, paidOn, staff.id, seal(note)],
  );
  await audit(req, staff.id, "shop.payment", { type: "shop", id }, note || null, { payment: String(rows[0].id), amount, method });
  await notify(id, "paymentReceived", { amount, method });
  return answer({ result: "ok" });
});
