import type { NextRequest } from "next/server";
import { sanitizeDesign } from "@/components/safeDesign";
import { answer, readJson } from "@/server/auth";
import { db } from "@/server/db";
import { audit, staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The starter template: the design every new store begins with (edited at /design?template=1). It is kept on the server as
   platform_settings 'starter_template', checked by the same rules as every store design (safeDesign.ts). Pictures in it are
   picture data, so a template can be large: up to 6 MB. */
const MAX = 6_000_000;

/** Saves the starter template: { config } */
export const PUT = staffRoute("settings", async (req: NextRequest, me) => {
  const body = await readJson(req, MAX);
  if (!body || typeof body.config !== "object" || body.config === null || Array.isArray(body.config)) return answer({ result: "invalid" }, 400);
  const config = sanitizeDesign(body.config);
  if (!Array.isArray(config.sections)) return answer({ result: "invalid" }, 400);
  const text = JSON.stringify(config);
  await (await db()).query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('starter_template', $1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [text, me.id],
  );
  await audit(req, me.id, "settings.template", { type: "setting", id: "starter_template" }, null, { bytes: text.length, sections: config.sections.length });
  return answer({ result: "ok" });
});

/** Goes back to the original design written in the code: new stores start from it again */
export const DELETE = staffRoute("settings", async (req: NextRequest, me) => {
  const { rowCount } = await (await db()).query(`DELETE FROM platform_settings WHERE key = 'starter_template'`);
  if (rowCount) await audit(req, me.id, "settings.template_cleared", { type: "setting", id: "starter_template" });
  return answer({ result: "ok" });
});
