import type { ListingRow } from "@/components/themeListing";
import { themePrice } from "@/components/themePrices";
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

/** The price of a theme a merchant can buy now, or null. The theme store's list (run from Diwan) decides: a theme live
    there at its price, one in any other step not at all. Only a theme of the code that has no row in the list falls back
    to the price written in the code (components/themePrices.ts), the same one the pages show until the list arrives. */
export async function livePrice(id: unknown): Promise<number | null> {
  if (typeof id !== "string" || id.length > 40) return null;
  const { rows } = await (await db()).query(`SELECT status, price::float AS price FROM catalog_themes WHERE id = $1`, [id]);
  if (rows[0]) return rows[0].status === "live" ? Number(rows[0].price) : null;
  return themePrice(id);
}
