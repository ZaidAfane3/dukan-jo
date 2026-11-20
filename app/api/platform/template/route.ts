import { sanitizeDesign } from "@/components/safeDesign";
import { answer, guarded } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/* the same for everyone and changed only from Diwan: browsers may keep it 30 s and shared caches a minute (served a little
   longer while they fetch a fresh copy), so a change reaches every page within about a minute */
const SHARED = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

/** The starter template every new store begins with, or null while Dukkan uses the original design written in the code */
export const GET = guarded(async () => {
  const { rows } = await (await db()).query(`SELECT value FROM platform_settings WHERE key = 'starter_template'`);
  const r = answer({ template: rows[0] ? sanitizeDesign(rows[0].value) : null });
  r.headers.set("Cache-Control", SHARED);
  return r;
});
