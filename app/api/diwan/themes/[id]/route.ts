import type { NextRequest } from "next/server";
import { cleanBi, cleanBiList, cleanColor, cleanPrice, liveProblem, LISTING_LIMITS, NEXT_STATUS, THEME_STATUSES, type ListingRow, type ThemeStatus } from "@/components/themeListing";
import { answer, readJson } from "@/server/auth";
import { readListings } from "@/server/catalog";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* One theme of the theme store's list. Only what is sent changes:
   - words: name, tagline, about (English and Arabic), features and tags (lists of both); empty words on a code theme
     go back to the code's own
   - price (JOD), sort (its place in the store: smaller first), featured
   - demo: the made-up store it is shown with { name, about, color }
   - status: the next step (themeListing.ts NEXT_STATUS). Going live needs a design theme's name, tagline and design.
   Answers "ok", "invalid", "missing", "step" (not a step it can take from here), "not-ready" with what is missing. */
export const PATCH = staffRoute("marketplace", async (req: NextRequest, me, { params }) => {
  const body = await readJson(req, 40_000);
  if (!body) return answer({ result: "invalid" }, 400);
  const [cur] = await readListings(`WHERE id = $1`, [params.id], true);
  if (!cur) return answer({ result: "missing" }, 404);

  const set: Record<string, unknown> = {};
  const words = { name: LISTING_LIMITS.name, tagline: LISTING_LIMITS.tagline } as const;
  for (const [k, max] of Object.entries(words)) if (k in body) set[k] = cleanBi(body[k], max);
  if ("about" in body) set.about = cleanBi(body.about, LISTING_LIMITS.about, true);
  if ("features" in body) set.features = cleanBiList(body.features, LISTING_LIMITS.features, LISTING_LIMITS.feature);
  if ("tags" in body) set.tags = cleanBiList(body.tags, LISTING_LIMITS.tags, LISTING_LIMITS.tag);
  if ("price" in body) {
    const p = cleanPrice(body.price);
    if (p === null) return answer({ result: "invalid", field: "price" }, 400);
    set.price = p;
  }
  if ("sort" in body) {
    const n = Number(body.sort);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) return answer({ result: "invalid", field: "sort" }, 400);
    set.sort = n;
  }
  if ("featured" in body) set.featured = body.featured === true;
  if ("demo" in body) {
    const d = body.demo as Record<string, unknown> | null;
    set.demo = d && typeof d === "object" ? { name: cleanBi(d.name, LISTING_LIMITS.name) ?? { en: "", ar: "" }, about: cleanBi(d.about, LISTING_LIMITS.tagline) ?? { en: "", ar: "" }, color: cleanColor(d.color) } : null;
  }
  /* a design theme always has a name: it can't be emptied */
  if (cur.source === "design" && "name" in set && !set.name) return answer({ result: "invalid", field: "name" }, 400);

  let status: ThemeStatus | null = null;
  if ("status" in body) {
    status = THEME_STATUSES.includes(body.status as ThemeStatus) ? (body.status as ThemeStatus) : null;
    if (!status) return answer({ result: "invalid", field: "status" }, 400);
    if (status !== cur.status && !NEXT_STATUS[cur.source][cur.status].includes(status)) return answer({ result: "step" }, 409);
    if (status === "live") {
      const after = { ...cur, ...set } as ListingRow;
      const why = liveProblem(after);
      if (why) return answer({ result: "not-ready", missing: why }, 409);
    }
    if (status !== cur.status) set.status = status;
  }
  if (!Object.keys(set).length) return answer({ result: "ok" });

  const keys = Object.keys(set);
  const json = new Set(["name", "tagline", "about", "features", "tags", "demo"]);
  const sql = keys.map((k, i) => `${k} = $${i + 2}${json.has(k) ? "::jsonb" : ""}`).join(", ");
  const values = keys.map((k) => (json.has(k) ? (set[k] === null ? null : JSON.stringify(set[k])) : set[k]));
  await (await db()).query(
    `UPDATE catalog_themes SET ${sql}, updated_by = $${keys.length + 2}, updated_at = now()
       ${set.status === "live" ? ", released_at = COALESCE(released_at, now())" : ""}
     WHERE id = $1`,
    [params.id, ...values, me.id],
  );
  const before = Object.fromEntries(keys.map((k) => [k, (cur as Record<string, unknown>)[k] ?? null]));
  await audit(req, me.id, set.status ? "theme.status" : "theme.edit", { type: "theme", id: params.id }, null, { before, after: set });
  return answer({ result: "ok" });
});

/** Deletes a design theme that never reached a merchant: a draft (or one sent back to draft) nobody bought. A theme that was
    in the store is hidden instead, so the merchants who have it keep it. Answers "ok", "missing", "not-allowed". */
export const DELETE = staffRoute("marketplace", async (req: NextRequest, me, { params }) => {
  const pool = await db();
  const { rows } = await pool.query(
    `DELETE FROM catalog_themes c WHERE c.id = $1 AND c.source = 'design' AND c.status IN ('draft', 'review')
        AND NOT EXISTS (SELECT 1 FROM theme_purchases p WHERE p.theme_id = c.id)
     RETURNING id, name`,
    [params.id],
  );
  if (!rows[0]) {
    const exists = (await pool.query(`SELECT 1 FROM catalog_themes WHERE id = $1`, [params.id])).rowCount;
    return answer({ result: exists ? "not-allowed" : "missing" }, exists ? 409 : 404);
  }
  await audit(req, me.id, "theme.delete", { type: "theme", id: params.id }, null, { name: rows[0].name });
  return answer({ result: "ok" });
});
