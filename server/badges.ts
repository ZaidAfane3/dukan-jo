import { BADGE_TABS, DIWAN_NAV, type BadgeTab } from "@/components/diwan/nav";
import { db } from "./db";
import { can, type Staff } from "./staff";

/* The red number beside a page in Diwan's sidebar: how many things came in since this staff member last opened that
   page (staff_seen, server/schema.ts). Each staff member has their own: opening the page clears it for them only. Only
   what someone outside (a merchant, a customer) or another staff member did counts, never the staff member's own work.
   What counts on each page:
     shops:      stores made (a new merchant account)
     payments:   themes bought with a price, and payments another staff member marked as received
     ship:       orders for Dukkan Ship to deliver (not the ones the merchant still has to confirm, nor cancelled ones)
     tickets:    support tickets opened, or that the merchant wrote in again (a ticket counts once however many messages)
     complaints: reports a customer sent about a store
     documents:  papers sent for checking and still waiting (a courier proof from when it reached Diwan)
     feedback:   bug reports and ideas opened, or that the merchant wrote in again
   Totals are never shown beside the pages; this is only what is new to this person. */

/* what each number needs, beyond the page's own permission */
const EXTRA_PERM: Partial<Record<BadgeTab, Parameters<typeof can>[1]>> = { ship: "ship.orders" };
/** The pages whose number this staff member may see: those their role opens (all of them, while Diwan has no roles) */
const tabsFor = (staff: Staff): BadgeTab[] =>
  BADGE_TABS.filter((t) => {
    const item = DIWAN_NAV.find((i) => i.badge === t);
    const extra = EXTRA_PERM[t];
    return !!item && can(staff, item.perm) && (!extra || can(staff, extra));
  });

/* one count per page, each from that page's own moment: seen.at, this staff member's last look at it ($1 is their id) */
const TICKETS_SQL = (kinds: string) => `SELECT count(DISTINCT m.ticket_id) FROM ticket_messages m JOIN tickets t ON t.id = m.ticket_id
   WHERE m.author = 'merchant' AND m.created_at > seen.at AND t.kind IN (${kinds})`;
const COUNT_SQL: Record<BadgeTab, string> = {
  shops: `SELECT count(*) FROM shops s WHERE s.created_at > seen.at`,
  payments: `SELECT (SELECT count(*) FROM payments p WHERE p.created_at > seen.at AND p.marked_by IS DISTINCT FROM $1)
                  + (SELECT count(*) FROM theme_purchases tp WHERE tp.price > 0 AND tp.paid_at > seen.at)`,
  /* as the Orders list's "Waiting" (server/shipOrders.ts) */
  ship: `SELECT count(*) FROM store_orders o WHERE o.ship_by = 'dukkan' AND o.created_at > seen.at
           AND o.ship_state = 'waiting' AND o.status NOT IN ('review', 'cancelled', 'refunded')`,
  /* a new ticket's first message is the merchant's, so new tickets and replies are both "a merchant wrote" */
  tickets: TICKETS_SQL(`'support'`),
  complaints: `SELECT count(*) FROM store_reports r WHERE r.reporter_kind = 'customer' AND r.created_at > seen.at`,
  documents: `SELECT count(*) FROM documents d WHERE d.status = 'waiting' AND NOT d.draft AND d.removed_at IS NULL AND d.sent_at > seen.at`,
  feedback: TICKETS_SQL(`'bug', 'idea'`),
};

/** What is new to this staff member on each page they may open, by page. A page they never opened starts from now. */
export async function badgeCounts(staff: Staff): Promise<Partial<Record<BadgeTab, number>>> {
  const tabs = tabsFor(staff);
  if (!tabs.length) return {};
  const pool = await db();
  /* the first time: every page starts from now, so what was there before isn't counted as new */
  const had = await pool.query(`SELECT tab FROM staff_seen WHERE staff_id = $1 AND tab = ANY($2::text[])`, [staff.id, tabs]);
  if (had.rows.length < tabs.length)
    await pool.query(`INSERT INTO staff_seen (staff_id, tab) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [staff.id, tabs]);
  /* one query: each page's count runs with that page's own moment */
  const { rows } = await pool.query(
    `SELECT ${tabs.map((t) => `(SELECT (${COUNT_SQL[t]}) FROM (SELECT seen_at AS at FROM staff_seen WHERE staff_id = $1 AND tab = '${t}') seen)::int AS "${t}"`).join(", ")}`,
    [staff.id],
  );
  const out: Partial<Record<BadgeTab, number>> = {};
  for (const t of tabs) out[t] = Math.max(0, Number(rows[0]?.[t]) || 0);
  return out;
}

/** The staff member opened this page: what is there now is no longer new to them */
export async function markSeen(staff: Staff, tab: BadgeTab): Promise<void> {
  if (!tabsFor(staff).includes(tab)) return;
  await (await db()).query(
    `INSERT INTO staff_seen (staff_id, tab, seen_at) VALUES ($1, $2, now()) ON CONFLICT (staff_id, tab) DO UPDATE SET seen_at = now()`,
    [staff.id, tab],
  );
}
