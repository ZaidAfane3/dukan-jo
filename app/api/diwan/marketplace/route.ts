import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** The marketplace as it is: developers (with how many items each sent), every item with its step, and for each of Dukkan's
    own themes how many stores use it now, how many bought it and what it brought in */
export const GET = staffRoute("marketplace", async () => {
  const pool = await db();
  const [devs, items, use, sales] = await Promise.all([
    pool.query(
      `SELECT d.id::text AS id, d.name, d.email, d.company, d.status, d.share_pct::float AS "sharePct", d.created_at AS "createdAt",
              (SELECT count(*) FROM marketplace_items i WHERE i.developer_id = d.id)::int AS items
         FROM developers d ORDER BY d.created_at DESC`,
    ),
    pool.query(
      `SELECT i.id::text AS id, i.kind, i.key, i.name, i.description, i.price::float AS price, i.version, i.status, i.note,
              i.developer_id::text AS "developerId", d.name AS "developerName", s.name AS "reviewedBy",
              i.created_at AS "createdAt", i.updated_at AS "updatedAt"
         FROM marketplace_items i LEFT JOIN developers d ON d.id = i.developer_id LEFT JOIN staff s ON s.id = i.reviewed_by
        ORDER BY i.updated_at DESC`,
    ),
    pool.query(`SELECT theme_id AS id, count(*)::int AS n FROM shops GROUP BY theme_id`),
    pool.query(`SELECT theme_id AS id, count(*)::int AS n, COALESCE(sum(price), 0)::float AS total FROM theme_purchases GROUP BY theme_id`),
  ]);
  const themes: Record<string, { stores: number; bought: number; revenue: number }> = {};
  const one = (id: string) => (themes[id] ??= { stores: 0, bought: 0, revenue: 0 });
  for (const r of use.rows) one(r.id).stores = r.n;
  for (const r of sales.rows) Object.assign(one(r.id), { bought: r.n, revenue: r.total });
  return answer({ developers: devs.rows, items: items.rows, themes });
});
