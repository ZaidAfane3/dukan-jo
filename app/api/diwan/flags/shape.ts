import type { Pool } from "pg";
import { cleanLine, visibleLength } from "@/components/safe";
import { db } from "@/server/db";

/* What a feature flag is made of, checked the same way when it is made and when it is changed */

export const FLAG_KEY = /^[a-z][a-z0-9_.-]{1,39}$/;
export const MAX_SHOPS = 500;

export type FlagInput = { name: string; description: string; mode: "off" | "some" | "all"; accountIds: string[] };

/** The flag's fields from a request body, or null. Shops that don't exist are left out. */
export async function cleanFlag(body: Record<string, unknown> | null): Promise<FlagInput | null> {
  const name = cleanLine(body?.name, 80);
  const description = cleanLine(body?.description ?? "", 300);
  const mode = body?.mode === "off" || body?.mode === "some" || body?.mode === "all" ? body.mode : null;
  const ids = body?.accountIds;
  if (visibleLength(name) < 2 || !mode || !Array.isArray(ids) || ids.length > MAX_SHOPS) return null;
  if (!ids.every((x) => typeof x === "string" && /^\d{1,18}$/.test(x))) return null;
  const pool: Pool = await db();
  const { rows } = await pool.query(`SELECT id FROM accounts WHERE id = ANY($1::bigint[]) ORDER BY id`, [ids]);
  return { name, description, mode, accountIds: rows.map((r) => String(r.id)) };
}

/** Each flag with the shops it is on for (their store name, or the account name, and email) */
export const FLAGS_SQL = `
  SELECT f.key, f.name, f.description, f.mode, f.updated_at, s.name AS by,
         COALESCE((SELECT json_agg(json_build_object('id', a.id::text, 'name', COALESCE(NULLIF(sh.name, ''), a.name), 'email', a.email) ORDER BY a.id)
                     FROM accounts a LEFT JOIN shops sh ON sh.account_id = a.id WHERE a.id = ANY(f.account_ids)), '[]') AS shops
    FROM feature_flags f LEFT JOIN staff s ON s.id = f.updated_by`;
