import { db } from "./db";
import { CART_IDLE_MINUTES } from "./storeCarts";

/* The red numbers of the merchant dashboard's side menu: how many things came in since the merchant last opened that page
   (merchant_seen, server/schema.ts). Kept per account on the server, so another device, or the page loaded again, shows
   the same. What counts on each page:
     orders:  orders customers placed on his store (Orders > Orders)
     carts:   carts that became abandoned (an hour with no change and no order, as the Abandoned carts page counts them)
              and still have no order
     signups: emails visitors left on his store, for the newsletter or "tell me when it is back" (Marketing > Customer emails)
   Only what arrived after he opened the page counts: what arrives while it is open counts as new too, until he opens it
   again. The bell has its own moment ("bell"): the newest notification its open panel showed, given back as bellSeen so
   the page counts the unread notifications after it (components/DashboardBar.tsx NotificationBell). */

export const MERCHANT_BADGE_TABS = ["orders", "carts", "signups"] as const;
export type MerchantBadgeTab = (typeof MERCHANT_BADGE_TABS)[number];
export const isMerchantBadgeTab = (v: unknown): v is MerchantBadgeTab => typeof v === "string" && (MERCHANT_BADGE_TABS as readonly string[]).includes(v);

/* one count per page, each from that page's own moment, seen.at ($1 is the account) */
const COUNT_SQL: Record<MerchantBadgeTab, string> = {
  orders: `SELECT count(*) FROM store_orders o WHERE o.account_id = $1 AND o.created_at > seen.at`,
  /* the moment a cart became abandoned is its last change plus the idle hour: counted once that moment has passed, and
     only if it came after his look (a cart he saw in the list, still waiting, is not new again) */
  carts: `SELECT count(*) FROM store_carts c WHERE c.account_id = $1 AND c.recovered_at IS NULL AND jsonb_array_length(c.items) > 0
            AND c.updated_at + make_interval(mins => ${CART_IDLE_MINUTES}) > seen.at
            AND c.updated_at + make_interval(mins => ${CART_IDLE_MINUTES}) <= now()`,
  signups: `SELECT count(*) FROM store_signups s WHERE s.account_id = $1 AND s.created_at > seen.at`,
};

/** What is new to the merchant on each page, and the bell's moment (ms; 0 when the bell was never opened: every unread
    notification counts). A page never opened starts from now. */
export async function merchantBadges(accountId: string): Promise<{ counts: Record<MerchantBadgeTab, number>; bellSeen: number }> {
  const pool = await db();
  /* the first time: every page starts from now, so the orders already there are not counted as new */
  await pool.query(`INSERT INTO merchant_seen (account_id, tab) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [accountId, MERCHANT_BADGE_TABS]);
  const { rows } = await pool.query(
    `SELECT ${MERCHANT_BADGE_TABS.map((t) => `(SELECT (${COUNT_SQL[t]}) FROM (SELECT seen_at AS at FROM merchant_seen WHERE account_id = $1 AND tab = '${t}') seen)::int AS "${t}"`).join(", ")},
            (SELECT floor(extract(epoch FROM seen_at) * 1000)::bigint FROM merchant_seen WHERE account_id = $1 AND tab = 'bell') AS bell`,
    [accountId],
  );
  const r = rows[0] ?? {};
  const counts = Object.fromEntries(MERCHANT_BADGE_TABS.map((t) => [t, Math.max(0, Number(r[t]) || 0)])) as Record<MerchantBadgeTab, number>;
  return { counts, bellSeen: Number(r.bell) || 0 };
}

/** He opened this page: what is there now is no longer new to him */
export async function markMerchantSeen(accountId: string, tab: MerchantBadgeTab): Promise<void> {
  await (await db()).query(
    `INSERT INTO merchant_seen (account_id, tab, seen_at) VALUES ($1, $2, now()) ON CONFLICT (account_id, tab) DO UPDATE SET seen_at = now()`,
    [accountId, tab],
  );
}

/** His bell's open panel showed the notifications up to this one (its time in ms, as /api/notifications gave it). It only
    moves forward (two devices) and never past now. */
export async function markBellSeen(accountId: string, at: number): Promise<void> {
  await (await db()).query(
    `INSERT INTO merchant_seen (account_id, tab, seen_at) VALUES ($1, 'bell', LEAST(to_timestamp($2::double precision / 1000), now()))
     ON CONFLICT (account_id, tab) DO UPDATE SET seen_at = GREATEST(merchant_seen.seen_at, EXCLUDED.seen_at)`,
    [accountId, at],
  );
}
