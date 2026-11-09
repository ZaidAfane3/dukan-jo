import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { planInput } from "@/server/plans";
import { body } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

const planRow = async (id: string | undefined) => {
  if (!/^\d{1,12}$/.test(id ?? "")) return null;
  const { rows } = await (await db()).query(`SELECT id, key, (SELECT count(*)::int FROM subscriptions WHERE plan_id = plans.id) AS subs FROM plans WHERE id = $1`, [id]);
  return rows[0] ?? null;
};

/** Changes a plan. Shops already on it keep it; the trial plan always stays on offer. */
export const PATCH = staffRoute("billing", async (req, staff, ctx) => {
  const plan = await planRow(ctx.params.id);
  if (!plan) return answer({ result: "not-found" }, 404);
  const p = planInput(await body(req));
  if (!p) return answer({ result: "invalid" }, 400);
  if (plan.key === "trial" && !p.active) return answer({ result: "trial-stays" }, 400);
  await (await db()).query(
    `UPDATE plans SET name_en = $2, name_ar = $3, price_month = $4, price_year = $5, max_products = $6, max_staff = $7, active = $8 WHERE id = $1`,
    [plan.id, p.nameEn, p.nameAr, p.priceMonth, p.priceYear, p.maxProducts, p.maxStaff, p.active],
  );
  await audit(req, staff.id, "plan.update", { type: "plan", id: plan.id }, null, { ...p });
  return answer({ result: "ok" });
});

/** Deletes a plan that no shop ever had. One with subscriptions (now or in the past) is switched off instead. */
export const DELETE = staffRoute("billing", async (req, staff, ctx) => {
  const plan = await planRow(ctx.params.id);
  if (!plan) return answer({ result: "not-found" }, 404);
  if (plan.key === "trial") return answer({ result: "trial-stays" }, 400);
  if (plan.subs > 0) return answer({ result: "in-use" }, 409);
  await (await db()).query(`DELETE FROM plans WHERE id = $1`, [plan.id]);
  await audit(req, staff.id, "plan.delete", { type: "plan", id: plan.id }, null, { key: plan.key });
  return answer({ result: "ok" });
});
