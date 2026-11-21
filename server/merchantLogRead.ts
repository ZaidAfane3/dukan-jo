import { MERCHANT_ACTIONS } from "./merchantLog";

/* Reading the merchant log for Diwan (app/api/diwan/merchant-log and a store's page): each line with its store and its
   details, a theme's id given its name from the theme store. */

type Q = { query: (sql: string, v?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
export type Bi = { en: string; ar: string };
export type MerchantLine = { id: string; at: string; action: string; meta: Record<string, unknown>; shop: { id: string; name: string } | null; themes?: Record<string, Bi> };

export const MERCHANT_LOG_SELECT = `SELECT l.id, l.at, l.action, l.meta, l.account_id, COALESCE(NULLIF(s.name, ''), a.name) AS shop_name
  FROM merchant_log l JOIN accounts a ON a.id = l.account_id LEFT JOIN shops s ON s.account_id = l.account_id`;

const bi = (v: unknown): Bi | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const en = typeof o.en === "string" ? o.en : "";
  const ar = typeof o.ar === "string" ? o.ar : "";
  return en || ar ? { en: en || ar, ar: ar || en } : null;
};

/** The rows as Diwan shows them */
export async function merchantLines(pool: Q, rows: Record<string, unknown>[]): Promise<MerchantLine[]> {
  const lines: MerchantLine[] = rows.map((r) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = r.meta ? (JSON.parse(String(r.meta)) as Record<string, unknown>) : {};
    } catch {
      meta = {};
    }
    return {
      id: String(r.id),
      at: new Date(r.at as string).toISOString(),
      action: (MERCHANT_ACTIONS as readonly string[]).includes(String(r.action)) ? String(r.action) : "other",
      meta,
      shop: { id: String(r.account_id), name: String(r.shop_name ?? "") },
    };
  });
  /* the themes named in the lines, by their names in the theme store */
  const aboutTheme = (a: string) => a === "store.theme" || a === "theme.bought";
  const ids = new Set<string>();
  for (const l of lines) if (aboutTheme(l.action)) for (const k of ["from", "to", "theme"]) if (typeof l.meta[k] === "string") ids.add(l.meta[k] as string);
  if (!ids.size) return lines;
  const { rows: named } = await pool.query(`SELECT id, name FROM catalog_themes WHERE id = ANY($1::text[])`, [[...ids]]);
  const themes: Record<string, Bi> = {};
  for (const t of named) {
    const n = bi(t.name);
    if (n) themes[String(t.id)] = n;
  }
  return lines.map((l) => (aboutTheme(l.action) ? { ...l, themes } : l));
}
