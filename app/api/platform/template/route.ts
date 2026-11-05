import { sanitizeDesign } from "@/components/safeDesign";
import { answer, guarded } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** The starter template every new store begins with, or null while Dukkan uses the original design written in the code */
export const GET = guarded(async () => {
  const { rows } = await (await db()).query(`SELECT value FROM platform_settings WHERE key = 'starter_template'`);
  return answer({ template: rows[0] ? sanitizeDesign(rows[0].value) : null });
});
