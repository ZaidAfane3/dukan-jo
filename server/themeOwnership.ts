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

/* The start-up code and the routes/pages are bundled apart, each with its own copy of this module (as server/shops.ts
   prep), so the copy that ran recordSavedThemes is not the one that serves merchants. Whether the step ran is therefore
   kept on the process, and a copy that has not seen it asks the database (its start_seeds mark): every copy agrees, and
   the rule is never off merely because this copy did not run the step. */
const shared = ((globalThis as { __dukkanThemesRecorded?: { done: boolean } }).__dukkanThemesRecorded ??= { done: false });
async function purchasesRecorded(q: Query): Promise<boolean> {
  if (recorded || shared.done) return true;
  const { rows } = await q.query(`SELECT 1 FROM start_seeds WHERE key = $1`, [DONE]);
  if (rows.length) shared.done = true;
  return shared.done;
}

/** The themes held back from stores that did not buy them: the paid ones (paidThemes), or none until the one-time
    recording below has run */
export async function enforcedPaidThemes(q: Query): Promise<Set<string>> {
  return (await purchasesRecorded(q)) ? paidThemes(q) : new Set();
}

/** THE RULE (owner's decision, QA 94), for one account, read once and asked as often as needed (one call per request):
    whether it may use a theme. A free theme, a theme not for sale at a price now, and a design of his own ("mine-...")
    always; a paid theme only with a purchase recorded for this account. Used by every path that puts a theme on a store:
    the save of the merchant's data (app/api/store PUT, through cleanThemeState), the public store
    (server/publicStore.ts), the merchant pages (app/api/themes/access) and Diwan's "theme in use". */
export async function themeOwner(q: Query, accountId: string | number): Promise<(themeId: string) => boolean> {
  if (!(await purchasesRecorded(q))) return () => true;
  const [paid, bought] = await Promise.all([paidThemes(q), boughtThemes(q, accountId)]);
  return (id) => !paid.has(id) || bought.has(id);
}

/** One question of the rule above (for a single check; ask themeOwner once when there are several) */
export async function mayUseTheme(q: Query, accountId: string | number, themeId: string): Promise<boolean> {
  return (await themeOwner(q, accountId))(themeId);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The theme a saved seen-themes value (its text, or read already) says the store uses: the theme in use, or for one of
    his copies of a theme (a customized copy, or "Make a copy") the theme it was made from, so a copy or edit of a theme
    counts as using that theme. "" for Dukkan's default (nothing chosen) or a design of his own with no theme under it.
    The same reading as server/shops.ts themeOf (Diwan's "theme in use"). */
export function themeInUse(value: unknown): string {
  let s = value;
  if (typeof s === "string") {
    try {
      s = JSON.parse(s);
    } catch {
      return "";
    }
  }
  if (!isObj(s) || typeof s.active !== "string" || !s.active) return "";
  const active = s.active;
  const copy = Array.isArray(s.custom) ? s.custom.find((c): c is Record<string, unknown> => isObj(c) && c.id === active) : undefined;
  const id = typeof copy?.from === "string" ? copy.from : active;
  return THEME_ID.test(id) && !id.startsWith("mine-") ? id : "";
}

/** A seen-themes value the merchant's page sent, checked with the rule (`owns`):
    - notBought: the paid theme it puts on the store without a purchase (the theme in use, or the theme under the copy in
      use), or "" when there is none. Such a save is refused for this key (app/api/store PUT): the store stays on the
      theme it had.
    - value: the value with the paid themes he did not buy taken out of his "owned" list (the list can't make up a
      purchase), or null when there is nothing to change or it is not such a value. His copies of a paid theme keep the
      theme they came from: they stay in My themes as drafts of his work, and can be used once he buys it. */
export function cleanThemeState(value: string, owns: (themeId: string) => boolean): { value: string | null; notBought: string } {
  let s: unknown;
  try {
    s = JSON.parse(value);
  } catch {
    return { value: null, notBought: "" };
  }
  if (!isObj(s)) return { value: null, notBought: "" };
  const inUse = themeInUse(s);
  const notBought = inUse && !owns(inUse) ? inUse : "";
  if (!Array.isArray(s.owned)) return { value: null, notBought };
  const kept = s.owned.filter((o) => !isObj(o) || typeof o.id !== "string" || owns(o.id));
  return { value: kept.length !== s.owned.length ? JSON.stringify({ ...s, owned: kept }) : null, notBought };
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
