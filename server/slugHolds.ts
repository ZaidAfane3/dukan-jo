import { db } from "./db";

/* A live store that changes its link keeps the old one for HOLD_DAYS (slug_holds, server/schema.ts; owner decision,
   testing S-2): no other store can take it meanwhile (the link checks below: app/api/shop/slug answers "reserved", and a
   save with it is refused "slug-reserved"), and a visit to it shows "this store moved" with the new address
   (app/[slug]), so the links and QR codes his customers have still lead to him for a while. Then it is free again. The
   store itself may take its old link back at any time. */

export const HOLD_DAYS = 2;

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** The store's link changed from `from` to `to` (either may be empty): its old link is held for it, and a link of its own
    it takes back is no longer held */
export async function holdOldSlug(q: Query, accountId: string | number, from: string, to: string | null): Promise<void> {
  const old = from.toLowerCase();
  const now = (to ?? "").toLowerCase();
  await q.query(`DELETE FROM slug_holds WHERE until <= now() OR (account_id = $1 AND slug = $2)`, [accountId, now]);
  if (!old || old === now) return;
  await q.query(
    `INSERT INTO slug_holds (slug, account_id, until) VALUES ($1, $2, now() + make_interval(days => $3))
     ON CONFLICT (slug) DO UPDATE SET until = EXCLUDED.until WHERE slug_holds.account_id = EXCLUDED.account_id`,
    [old, accountId, HOLD_DAYS],
  );
}

/** True when this link is still held for another store that gave it up less than HOLD_DAYS ago */
export async function slugHeld(slug: string, accountId: string | number | null): Promise<boolean> {
  const { rows } = await (await db()).query(`SELECT 1 FROM slug_holds WHERE slug = lower($1) AND until > now() AND account_id IS DISTINCT FROM $2 LIMIT 1`, [slug, accountId]);
  return rows.length > 0;
}

/** Where the store that gave up this link (less than HOLD_DAYS ago) is now: its new link and name, or null (no such
    store, it has no link now, or Dukkan suspended it) */
export async function movedStore(slug: string): Promise<{ slug: string; name: string } | null> {
  const { rows } = await (await db()).query(
    `SELECT s.slug, s.name FROM slug_holds h JOIN shops s ON s.account_id = h.account_id
      WHERE h.slug = lower($1) AND h.until > now() AND s.status <> 'suspended' AND s.slug IS NOT NULL AND s.slug <> '' AND lower(s.slug) <> h.slug
      LIMIT 1`,
    [slug],
  );
  return rows[0] ? { slug: String(rows[0].slug), name: String(rows[0].name ?? "") } : null;
}
