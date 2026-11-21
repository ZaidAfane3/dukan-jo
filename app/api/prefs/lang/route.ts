import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded, readJson, sameOrigin, tooMany } from "@/server/auth";
import { db } from "@/server/db";
import { langOf } from "@/server/lang";
import { currentStaff } from "@/server/staff";

export const dynamic = "force-dynamic";

/* The page's language changed (components/Prefs.tsx): POST { lang: "ar" | "en" }. Saved on the merchant account and on
   the Diwan staff member signed in on this browser (either, both or neither), so the emails sent to them later are in
   that language (server/lang.ts). Answers "ok", or "none" when nobody is signed in (nothing to save). */
export const POST = guarded(async (req: NextRequest) => {
  if (!sameOrigin(req)) return answer({ result: "forbidden" }, 403);
  if (tooMany(req, "prefs-lang", 30, 15)) return answer({ result: "slow-down" }, 429);
  const lang = langOf((await readJson(req, 200))?.lang);
  if (!lang) return answer({ result: "invalid" }, 400);
  const pool = await db();
  const a = await currentAccount(req);
  if (a) await pool.query(`UPDATE accounts SET lang = $2 WHERE id = $1 AND lang IS DISTINCT FROM $2`, [a.id, lang]);
  const s = await currentStaff(req);
  const staff = !!s?.verified;
  if (s && staff) await pool.query(`UPDATE staff SET lang = $2 WHERE id = $1 AND lang IS DISTINCT FROM $2`, [s.id, lang]);
  return answer({ result: a || staff ? "ok" : "none" });
});
