import type { ListingRow } from "@/components/themeListing";
import { db } from "./db";

/* The theme store's list in the database (catalog_themes; the rules are in components/themeListing.ts) */

const COLS = `id, source, status, name, tagline, about, features, tags, price::float AS price, sort, featured, demo,
  released_at AS "releasedAt", updated_at AS "updatedAt"`;

/** The listings, with the design of the design themes when `withDesign` */
export async function readListings(where: string, params: unknown[] = [], withDesign = false): Promise<ListingRow[]> {
  const { rows } = await (await db()).query(
    `SELECT ${COLS}${withDesign ? ", CASE WHEN source = 'design' THEN design END AS design" : ""} FROM catalog_themes ${where} ORDER BY sort, created_at`,
    params,
  );
  return rows as ListingRow[];
}

/** The price of a theme a merchant can buy now (live in the theme store), or null */
export async function livePrice(id: unknown): Promise<number | null> {
  if (typeof id !== "string" || id.length > 40) return null;
  const { rows } = await (await db()).query(`SELECT price::float AS price FROM catalog_themes WHERE id = $1 AND status = 'live'`, [id]);
  return rows[0] ? Number(rows[0].price) : null;
}
