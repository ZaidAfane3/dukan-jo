import type { Pool } from "pg";
import { isSealed, OPEN_DEPTH, openedAs, seal } from "./crypto";

/* The one-time repair of store orders whose lines were kept unprotected (F06). Until 2026-11-22, undoing a cancel
   (server/storeOrders.ts setStoreOrderStatus) wrote an order's lines back as they were read, already opened, without
   plainDeep. A product name typed as "e1:..." was then kept as that bare text, and every read opens it (db.ts openDeep):
   it either opens to something else (a sealed value copied from another row) or can't be opened at all, which stops
   every answer that carries the order in production.

   A text in an order's lines that starts with the mark is right only when it is a sealed one that opens to a text
   starting with the mark itself (that is what plainDeep makes of such a name), or one too short to be a sealed value
   (it reads back as it is). Any other is a bare name: it is sealed now, so it reads back exactly as it was typed. Every
   other text, and every order without such a text, is left exactly as it is.

   It runs in the background once the database is ready (server/db.ts), on one server at a time (an advisory lock), and
   is marked done in start_seeds once a pass went through, so later starts skip it. Running it again is harmless: a
   repaired text is one of the right ones. An order changed in the meantime is not written over (it is checked on the
   next start). It never runs with a key that can't open the orders' sealed customer names: with a wrong key every
   sealed name would look bare. */
const DONE = "store-order-items-sealed-1";
const LOCK = 71021;
/* how deep db.ts opens texts inside a column's JSON (crypto.ts plainDeep counts the same way) */
const DEEPEST = OPEN_DEPTH - 2;

/** A text the read would get wrong: starts with the mark, and is neither a sealed form of such a text nor too short to open */
function bare(v: string): boolean {
  if (!isSealed(v)) return false;
  const out = openedAs(v);
  if (out === v) return false;
  return out === null || !isSealed(out);
}

/** The lines with every bare text sealed, or null when none needed it */
export function repairedItems(items: unknown): unknown | null {
  let changed = false;
  const walk = (v: unknown, depth: number): unknown => {
    if (typeof v === "string") {
      if (depth > DEEPEST || !bare(v)) return v;
      changed = true;
      return seal(v);
    }
    if (v == null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, depth + 1)]));
  };
  const out = walk(items, 0);
  return changed ? out : null;
}

export async function repairOrderItems(pool: Pool): Promise<{ checked: number; repaired: number } | null> {
  const lockClient = await pool.connect();
  let locked = false;
  try {
    locked = (await lockClient.query(`SELECT pg_try_advisory_lock($1) AS ok`, [LOCK])).rows[0]?.ok === true;
    /* another server is doing it */
    if (!locked) return null;
    const done = await pool.query(`SELECT 1 FROM start_seeds WHERE key = $1`, [DONE]);
    if (done.rows.length) return null;
    /* the key must open what it sealed: a customer's name is always sealed (read with a letter in front, so db.ts leaves
       it as it is) */
    const probe = await pool.query(`SELECT 'x' || customer_name AS v FROM store_orders WHERE customer_name LIKE 'e1:%' LIMIT 1`);
    const sample = probe.rows[0]?.v as string | undefined;
    if (sample && openedAs(sample.slice(1)) === null) {
      console.error("[orders] the data key can't open the store orders' customer names: the order lines repair waits for the next start");
      return null;
    }
    /* the lines as text (db.ts opens only texts that start with the mark, and this one starts with "["), only for orders
       that have a text starting with the mark somewhere in them */
    const { rows } = await pool.query(`SELECT id, items::text AS raw FROM store_orders WHERE items::text LIKE '%"e1:%' ORDER BY id`);
    let repaired = 0;
    /* orders that changed between the read and the write: not repaired now, so the repair is not marked done and looks
       again at the next start */
    let missed = 0;
    for (const r of rows) {
      let items: unknown;
      try {
        items = JSON.parse(r.raw as string);
      } catch {
        continue;
      }
      const fixed = repairedItems(items);
      if (fixed === null) continue;
      /* only while the order still has the lines read here */
      const up = await pool.query(`UPDATE store_orders SET items = $2::jsonb WHERE id = $1 AND items = $3::jsonb`, [r.id, JSON.stringify(fixed), r.raw]);
      repaired += up.rowCount ?? 0;
      if (!up.rowCount) missed += 1;
    }
    if (!missed) await pool.query(`INSERT INTO start_seeds (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [DONE]);
    else console.log(`[orders] order lines repair: ${missed} orders changed while being repaired, looked at again at the next start`);
    console.log(`[orders] order lines repair: ${repaired} of ${rows.length} orders with a marked text needed it`);
    return { checked: rows.length, repaired };
  } finally {
    if (locked) await lockClient.query(`SELECT pg_advisory_unlock($1)`, [LOCK]).catch(() => {});
    lockClient.release();
  }
}
