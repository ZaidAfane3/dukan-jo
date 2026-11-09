import type { NextRequest } from "next/server";
import { sanitizeDesign } from "@/components/safeDesign";
import { cleanBi, LISTING_LIMITS, themeIdOk } from "@/components/themeListing";
import { answer, readJson } from "@/server/auth";
import { readListings } from "@/server/catalog";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* A design with its pictures (as picture data) can be large, like the starter template: up to 6 MB */
const MAX = 6_000_000;

/** Every theme of the theme store's list (drafts too), each with its design, and for every theme (the free designs too)
    how many stores use it now, how many bought it and what that brought in */
export const GET = staffRoute("marketplace", async () => {
  const pool = await db();
  const [themes, use, sales] = await Promise.all([
    readListings("", [], true),
    pool.query(`SELECT theme_id AS id, count(*)::int AS n FROM shops GROUP BY theme_id`),
    pool.query(`SELECT theme_id AS id, count(*)::int AS n, COALESCE(sum(price), 0)::float AS total FROM theme_purchases GROUP BY theme_id`),
  ]);
  const nums: Record<string, { stores: number; bought: number; revenue: number }> = {};
  const one = (id: string) => (nums[id] ??= { stores: 0, bought: 0, revenue: 0 });
  for (const r of use.rows) one(r.id).stores = r.n;
  for (const r of sales.rows) Object.assign(one(r.id), { bought: r.n, revenue: r.total });
  return answer({ themes, nums });
});

/** A new theme, made from a copy of a design: { id, name: {en, ar}, design }. It starts hidden (only staff see it), free, at the end of
    the list. Answers "ok", "invalid", "taken" (the code name is used). */
export const POST = staffRoute("marketplace", async (req: NextRequest, me) => {
  const body = await readJson(req, MAX);
  const id = body?.id;
  const name = cleanBi(body?.name, LISTING_LIMITS.name);
  const design = body?.design && typeof body.design === "object" && !Array.isArray(body.design) ? sanitizeDesign(body.design) : null;
  if (!themeIdOk(id) || !name || !design || !Array.isArray(design.sections)) return answer({ result: "invalid" }, 400);
  const { rowCount } = await (await db()).query(
    `INSERT INTO catalog_themes (id, source, status, name, price, sort, design, created_by, updated_by)
     VALUES ($1, 'design', 'hidden', $2, 0, (SELECT COALESCE(max(sort), 0) + 10 FROM catalog_themes), $3, $4, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, JSON.stringify(name), JSON.stringify(design), me.id],
  );
  if (!rowCount) return answer({ result: "taken" }, 409);
  await audit(req, me.id, "theme.create", { type: "theme", id }, null, { name: name.en || name.ar });
  return answer({ result: "ok", id });
});
