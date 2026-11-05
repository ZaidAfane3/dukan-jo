import type { NextRequest } from "next/server";
import { answer, currentAccount, guarded } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** The feature flags that are on for the signed-in merchant (on for all, or for some shops with his among them). Nobody
    signed in: none. Only the keys go out, never which other shops have a flag. */
export const GET = guarded(async (req: NextRequest) => {
  const a = await currentAccount(req);
  if (!a) return answer({ flags: [] });
  const { rows } = await (await db()).query(
    `SELECT key FROM feature_flags WHERE mode = 'all' OR (mode = 'some' AND $1::bigint = ANY(account_ids)) ORDER BY key`,
    [a.id],
  );
  return answer({ flags: rows.map((r) => r.key) });
});
