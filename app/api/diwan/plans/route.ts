import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { planInput, planKey } from "@/server/plans";
import { body } from "@/server/shopActions";
import { expireSubscriptions } from "@/server/shops";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** The plans, each with how many shops are on it now and how many subscriptions it ever had */
export const GET = staffRoute("billing", async () => {
  const pool = await db();
  await expireSubscriptions(pool);
  const { rows } = await pool.query(`
    SELECT p.id, p.key, p.name_en, p.name_ar, p.price_month, p.price_year, p.max_products, p.custom_domain, p.max_staff, p.active, p.created_at,
           count(s.id) FILTER (WHERE s.status IN ('trial', 'active'))::int AS current, count(s.id)::int AS ever
      FROM plans p LEFT JOIN subscriptions s ON s.plan_id = p.id
     GROUP BY p.id ORDER BY p.price_month, p.id`);
  return answer({ result: "ok", plans: rows });
});

/** A new plan */
export const POST = staffRoute("billing", async (req, staff) => {
  const p = planInput(await body(req));
  if (!p) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const base = planKey(p.nameEn);
  /* the key is made from the English name; a number is added when it is taken */
  const { rows: taken } = await pool.query(`SELECT key FROM plans WHERE key = $1 OR key LIKE $2`, [base, `${base}-%`]);
  const used = new Set(taken.map((r) => r.key));
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  const { rows } = await pool.query(
    `INSERT INTO plans (key, name_en, name_ar, price_month, price_year, max_products, custom_domain, max_staff, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [key, p.nameEn, p.nameAr, p.priceMonth, p.priceYear, p.maxProducts, p.customDomain, p.maxStaff, p.active],
  );
  await audit(req, staff.id, "plan.create", { type: "plan", id: rows[0].id }, null, { key, ...p });
  return answer({ result: "ok", id: String(rows[0].id) });
});
