import type { Pool } from "pg";
import { FREE_THEME_IDS } from "@/components/platformDefaults";
import { THEME_ID } from "@/components/themeListing";
import { THEME_PRICES } from "@/components/themePrices";

/* Which themes a store really has. The purchases Dukkan recorded (theme_purchases, written by app/api/themes/purchase) are
   the only proof: what a browser saves about itself (the "owned" list in its seen-themes) is checked against them here,
   because anything a browser sends can be made up.

   A theme needs a purchase only while it is for sale at a price: live in the theme store's list (catalog_themes, run from
   Diwan) with a price above zero, or a theme of the code that has no row there and a price in components/themePrices.ts
   (the same rule as server/catalog.ts livePrice). The free themes every store has, and a theme taken out of the store
   (whoever bought it keeps it, and its looks are open to everyone), never need one. */

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** The themes for sale at a price now */
export async function paidThemes(q: Query): Promise<Set<string>> {
  const { rows } = await q.query(`SELECT id, status, price::float AS price FROM catalog_themes`);
  const listed = new Map<string, { status: string; price: number }>(rows.map((r) => [String(r.id), { status: r.status, price: Number(r.price) }]));
  const paid = new Set<string>();
  listed.forEach((r, id) => r.status === "live" && r.price > 0 && paid.add(id));
  for (const [id, price] of Object.entries(THEME_PRICES)) if (!listed.has(id) && price > 0) paid.add(id);
  for (const id of FREE_THEME_IDS) paid.delete(id);
  return paid;
}

/** The themes this account bought */
export async function boughtThemes(q: Query, accountId: string | number): Promise<Set<string>> {
  const { rows } = await q.query(`SELECT theme_id FROM theme_purchases WHERE account_id = $1`, [accountId]);
  return new Set(rows.map((r) => String(r.theme_id)));
}

/* true once the themes stores already held were recorded as purchases (recordSavedThemes below). Until then nothing is
   held back: a store must never lose a theme because that one-time step has not run. */
let recorded = false;

/** For one account: whether it may use a theme (and the looks that come with it) */
export async function themeOwner(q: Query, accountId: string | number): Promise<(themeId: string) => boolean> {
  if (!recorded) return () => true;
  const [paid, bought] = await Promise.all([paidThemes(q), boughtThemes(q, accountId)]);
  return (id) => !paid.has(id) || bought.has(id);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A saved seen-themes value with everything it claims about a paid theme the account did not buy taken out: the theme in
    its "owned" list, a copy that says it comes from it (it stays, as a design he saved himself), and the theme as the one
    in use (the store's design itself is not touched). Null when there is nothing to change, or it is not such a value. */
export function cleanThemeState(value: string, owns: (themeId: string) => boolean): string | null {
  let s: unknown;
  try {
    s = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isObj(s)) return null;
  let changed = false;
  const out: Record<string, unknown> = { ...s };
  if (Array.isArray(s.owned)) {
    const kept = s.owned.filter((o) => !isObj(o) || typeof o.id !== "string" || owns(o.id));
    if (kept.length !== s.owned.length) {
      out.owned = kept;
      changed = true;
    }
  }
  if (Array.isArray(s.custom)) {
    out.custom = s.custom.map((c) => {
      if (!isObj(c) || typeof c.from !== "string" || owns(c.from)) return c;
      changed = true;
      const { from: _from, ...rest } = c;
      return rest;
    });
  }
  if (typeof s.active === "string" && !owns(s.active)) {
    out.active = "";
    changed = true;
  }
  return changed ? JSON.stringify(out) : null;
}

/* Run once, when the server first starts with this rule (from db(), marked done in start_seeds): every theme a store
   already holds in its saved "owned" list gets its purchase recorded, at the price and time the list has for it, so no
   store loses a theme it took before purchases became the proof. Themes taken after this are recorded by the checkout. */
const DONE = "theme-purchases-from-saved-1";

export async function recordSavedThemes(pool: Pool): Promise<number> {
  const done = await pool.query(`SELECT 1 FROM start_seeds WHERE key = $1`, [DONE]);
  if (done.rows.length) {
    recorded = true;
    return 0;
  }
  /* the values come back opened by db() */
  const { rows } = await pool.query(`SELECT account_id, value FROM store_data WHERE key = 'seen-themes'`);
  let added = 0;
  for (const r of rows) {
    let s: unknown;
    try {
      s = JSON.parse(r.value as string);
    } catch {
      continue;
    }
    if (!isObj(s) || !Array.isArray(s.owned)) continue;
    for (const o of s.owned.slice(0, 200)) {
      if (!isObj(o) || typeof o.id !== "string" || !THEME_ID.test(o.id) || o.id.startsWith("mine-")) continue;
      const paid = typeof o.paid === "number" && Number.isFinite(o.paid) && o.paid >= 0 && o.paid <= 1_000_000 ? Math.round(o.paid * 1000) / 1000 : 0;
      const at = typeof o.at === "number" && o.at > 946684800000 && o.at < 4102444800000 ? new Date(o.at) : new Date();
      const ins = await pool.query(
        `INSERT INTO theme_purchases (account_id, theme_id, price, paid_at) VALUES ($1, $2, $3, $4) ON CONFLICT (account_id, theme_id) DO NOTHING`,
        [r.account_id, o.id, paid, at],
      );
      added += ins.rowCount ?? 0;
    }
  }
  await pool.query(`INSERT INTO start_seeds (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [DONE]);
  recorded = true;
  if (added) console.log(`[themes] recorded ${added} themes stores already held as purchases`);
  return added;
}
