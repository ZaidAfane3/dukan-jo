import { answer } from "@/server/auth";
import { plainText, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { emailNotice, notify } from "@/server/notify";
import { body, dayOf, jodOf, notFound, shopId, shopNameOf, textOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

const METHODS = ["bank", "cliq", "cash", "card"];

/* Marks a payment as received: { amount (JOD), method, reference?, paidOn: "yyyy-mm-dd", note? }. Dukkan has no plans
   and no free trial, so a payment stands on its own: it is not linked to a subscription and extends nothing
   (payments.subscription_id stays empty). The merchant gets a message in their bell. Needs the staff member's own
   password with it ({ myPassword }, server/staffConfirm.ts passwordAgain). */
export const POST = staffRoute("billing", async (req, staff, ctx) => {
  const id = await shopId(ctx);
  if (!id) return notFound();
  const b = await body(req);
  const amount = jodOf(b?.amount);
  const method = typeof b?.method === "string" && METHODS.includes(b.method) ? b.method : null;
  const paidOn = dayOf(b?.paidOn);
  /* a payment of 0 isn't a payment (QA 31) */
  if (!amount || !(Number(amount) > 0) || !method || !paidOn) return answer({ result: "invalid" }, 400);
  /* the form's own key: the same press sent twice saves one payment */
  const key = typeof b?.key === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(b.key) ? b.key : null;
  const reference = textOf(b?.reference, 100);
  const note = textOf(b?.note, 300);
  const refused = await passwordAgain(req, staff, b?.myPassword, "shop.payment");
  if (refused) return refused;

  /* the payment, its line in the activity log and the merchant's message are kept together or not at all, so a retry
     after a failure never finds the payment saved without them */
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      `INSERT INTO payments (account_id, amount, method, reference, paid_on, marked_by, note, request_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id, request_key) WHERE request_key IS NOT NULL DO NOTHING RETURNING id`,
      [id, amount, method, plainText(reference), paidOn, staff.id, seal(note), key],
    );
    if (!rows.length) {
      await c.query("ROLLBACK");
      /* already saved by an earlier press of this form: the same payment answers as the first one did (no second log
         line or message). Sent again with another amount, way, date or reference (the first answer was lost and he
         corrected it), it is not answered "ok" as if the new details were kept: he is told the first one is saved. */
      const { rows: was } = await c.query(
        `SELECT amount = $3::numeric AND method = $4 AND paid_on = $5::date AS same, reference FROM payments WHERE account_id = $1 AND request_key = $2`,
        [id, key, amount, method, paidOn],
      );
      const first = was[0] as { same: boolean; reference: string | null } | undefined;
      return first && (!first.same || (first.reference ?? "") !== reference) ? answer({ result: "key-used" }, 409) : answer({ result: "ok" });
    }
    await audit(req, staff.id, "shop.payment", { type: "shop", id }, note || null, { payment: String(rows[0].id), amount, method, store: await shopNameOf(id) }, c);
    await notify(id, "paymentReceived", { amount, method }, c);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  emailNotice(id, "paymentReceived", { amount, method });
  return answer({ result: "ok" });
});
