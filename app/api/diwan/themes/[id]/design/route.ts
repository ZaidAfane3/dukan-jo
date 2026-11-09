import type { NextRequest } from "next/server";
import { sanitizeDesign } from "@/components/safeDesign";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The design of a theme made in Diwan, edited in the store designer at /design?catalog=<id>. Checked by the same rules as
   every store design (safeDesign.ts). Up to 6 MB, like the starter template (its pictures are picture data). A code
   theme's look is in the code, so it has none here. */
const MAX = 6_000_000;

export const GET = staffRoute("marketplace", async (_req: NextRequest, _me, { params }) => {
  const { rows } = await (await db()).query(`SELECT source, design, name FROM catalog_themes WHERE id = $1`, [params.id]);
  const r = rows[0];
  if (!r) return answer({ result: "missing" }, 404);
  if (r.source !== "design") return answer({ result: "code" }, 409);
  return answer({ result: "ok", design: r.design ? sanitizeDesign(r.design) : null, name: r.name });
});

/** Saves the design: { config } */
export const PUT = staffRoute("marketplace", async (req: NextRequest, me, { params }) => {
  const body = await readJson(req, MAX);
  if (!body || typeof body.config !== "object" || body.config === null || Array.isArray(body.config)) return answer({ result: "invalid" }, 400);
  const config = sanitizeDesign(body.config);
  if (!Array.isArray(config.sections)) return answer({ result: "invalid" }, 400);
  const text = JSON.stringify(config);
  const { rowCount } = await (await db()).query(
    `UPDATE catalog_themes SET design = $2::jsonb, updated_by = $3, updated_at = now() WHERE id = $1 AND source = 'design'`,
    [params.id, text, me.id],
  );
  if (!rowCount) return answer({ result: "missing" }, 404);
  await audit(req, me.id, "theme.design", { type: "theme", id: params.id }, null, { bytes: text.length, sections: config.sections.length });
  return answer({ result: "ok" });
});
