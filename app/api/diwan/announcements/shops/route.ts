import { answer } from "@/server/auth";
import { lookupKeys } from "@/server/crypto";
import { db } from "@/server/db";
import { staffRoute } from "@/server/staff";
import { likeOf } from "@/server/tickets";

export const dynamic = "force-dynamic";

/** Shops to pick for an announcement: ?q= matches the store name or link, or the owner's full email or mobile (at most 20) */
export const GET = staffRoute("announce", async (req) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return answer({ result: "ok", shops: [] });
  const { rows } = await (await db()).query(
    `SELECT a.id, COALESCE(NULLIF(s.name, ''), a.name) AS name, a.email
       FROM accounts a LEFT JOIN shops s ON s.account_id = a.id
      WHERE s.name ILIKE $1 OR s.slug ILIKE $1 OR a.email_hash = $2 OR a.phone_hash = $3
      ORDER BY a.created_at DESC LIMIT 20`,
    [likeOf(q), ...lookupKeys(q)],
  );
  return answer({ result: "ok", shops: rows.map((r) => ({ id: String(r.id), name: r.name, email: r.email })) });
});
