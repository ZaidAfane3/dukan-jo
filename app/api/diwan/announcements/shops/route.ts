import { answer } from "@/server/auth";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";
import { likeOf } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Shops to pick for an announcement: ?q= matches the store name, the owner's name or email (at most 20) */
export const GET = staffRoute("announce", async (req) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return answer({ result: "ok", shops: [] });
  const { rows } = await (await db()).query(
    `SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email
       FROM accounts a LEFT JOIN shops s ON s.account_id = a.id
      WHERE s.name ILIKE $1 OR a.name ILIKE $1 OR a.email ILIKE $1
      ORDER BY a.created_at DESC LIMIT 20`,
    [likeOf(q)],
  );
  return answer({ result: "ok", shops: rows.map((r) => ({ id: String(r.id), name: r.name, email: r.email })) });
});
