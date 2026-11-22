import { starterLegalPages } from "@/components/diwan/platformSettings";
import { seal } from "./crypto";
import { readSetting } from "./settings";

/* A live store's return, terms and privacy pages are its own: when it goes live (its first design save, app/api/store),
   or for a store already live from before this rule the first time it is served or saved, a store that has not saved
   pages of its own gets a copy of Diwan's templates as they are now, kept on the server as its saved pages
   ("seen-pages"). A later change of the templates in Diwan then reaches only stores that go live after it; before that
   the store's customers saw whatever the templates said that day, as each visitor's browser built them. The text comes
   from the server's settings, never from what a browser sends. A store that already has its pages is never touched. */

type Query = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/** Keeps the starting legal pages for this account when it has no saved pages: the saved value now (the copy just made,
    or the one it had), or null when it could not be read */
export async function keepLegalPages(q: Query, accountId: string | number): Promise<string | null> {
  const has = await q.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-pages'`, [accountId]);
  if (has.rows.length) return has.rows[0].value as string;
  const value = JSON.stringify(starterLegalPages(await readSetting("store_legal_templates")));
  const ins = await q.query(
    `INSERT INTO store_data (account_id, key, value, plain_len) VALUES ($1, 'seen-pages', $2, $3) ON CONFLICT (account_id, key) DO NOTHING`,
    [accountId, seal(value), value.length],
  );
  if (ins.rowCount) return value;
  /* saved by him at the same moment: his copy stays */
  const again = await q.query(`SELECT value FROM store_data WHERE account_id = $1 AND key = 'seen-pages'`, [accountId]);
  return (again.rows[0]?.value as string | undefined) ?? null;
}
