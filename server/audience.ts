import { db } from "./db";
import type { Audience } from "./announce";

/* Who something Dukkan's team sends to merchants is for, and when, as Diwan's forms send it: the same rules as
   announcements (server/announce.ts cleanAnnouncement), shared by pop-ups. The SQL side (AUDIENCE_HAS) is in announce.ts. */

/** A time from a form: null when empty, undefined when it is not a sensible date */
export function cleanWhen(v: unknown): Date | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.length > 40) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100 ? undefined : d;
}

/** Every shop, chosen shops (checked to exist) or the shops on chosen plans (checked to exist); null when it is none of these */
export async function cleanAudience(v: unknown): Promise<Audience | null> {
  const aud = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (aud?.all === true) return { all: true };
  const pool = await db();
  if (Array.isArray(aud?.accounts)) {
    const ids = Array.from(new Set((aud!.accounts as unknown[]).map((x) => String(x)).filter((x) => /^\d{1,15}$/.test(x)))).slice(0, 2000);
    if (!ids.length) return null;
    const { rows } = await pool.query(`SELECT id FROM accounts WHERE id = ANY($1::bigint[])`, [ids]);
    return rows.length === ids.length ? { accounts: ids.map(Number) } : null;
  }
  if (Array.isArray(aud?.plans)) {
    const keys = Array.from(new Set((aud!.plans as unknown[]).filter((x): x is string => typeof x === "string" && x.length <= 60))).slice(0, 50);
    if (!keys.length) return null;
    const { rows } = await pool.query(`SELECT key FROM plans WHERE key = ANY($1::text[])`, [keys]);
    return rows.length === keys.length ? { plans: keys } : null;
  }
  return null;
}
