import type { NextRequest } from "next/server";
import { cleanLine } from "@/components/safe";
import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";

export const dynamic = "force-dynamic";

/** Shops whose store name, account name or email holds ?q= (at least 2 letters), to turn a flag on for them. At most 20. */
export const GET = staffRoute("flags", async (req: NextRequest) => {
  const q = cleanLine(req.nextUrl.searchParams.get("q") ?? "", 80);
  if (q.length < 2) return answer({ shops: [] });
  /* % and _ typed in the search are letters, not wildcards */
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { rows } = await (await db()).query(
    `SELECT a.id::text AS id, COALESCE(NULLIF(sh.name, ''), a.name) AS name, a.email
       FROM accounts a LEFT JOIN shops sh ON sh.account_id = a.id
      WHERE sh.name ILIKE $1 OR a.name ILIKE $1 OR a.email ILIKE $1
      ORDER BY a.id DESC LIMIT 20`,
    [like],
  );
  return answer({ shops: rows });
});
