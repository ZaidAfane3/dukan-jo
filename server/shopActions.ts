import type { NextRequest } from "next/server";
import { answer, readJson } from "./auth";
import { db } from "./db";

/* Shared by the shop action routes in app/api/diwan/shops/[id]/. */

/** The shop id from the route, or null when it is not one (or there is no such shop) */
export async function shopId(ctx: { params: Record<string, string> }): Promise<string | null> {
  const id = ctx.params.id;
  if (!/^\d{1,18}$/.test(id ?? "")) return null;
  const { rows } = await (await db()).query(`SELECT account_id FROM shops WHERE account_id = $1`, [id]);
  return rows[0] ? String(rows[0].account_id) : null;
}

export const notFound = () => answer({ result: "not-found" }, 404);

/** The store's name (else its link) as it is now, kept in the activity log's line about it ({ store }), so the line still
    names the store if its account is deleted later (server/activityDetail.ts) */
export async function shopNameOf(id: string): Promise<string> {
  const { rows } = await (await db()).query(`SELECT COALESCE(NULLIF(name, ''), slug, '') AS name FROM shops WHERE account_id = $1`, [id]);
  return String(rows[0]?.name ?? "");
}

/** A JSON body, at most 4 KB */
export const body = (req: NextRequest) => readJson(req, 4_000);

/** A reason staff typed: trimmed, one line, 5 to 500 characters, or null */
export function reasonOf(v: unknown, min = 5): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  return s.length >= min ? s : null;
}

/** A short text staff typed (reference, note), cleaned, possibly empty */
export const textOf = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";

/** An amount in JOD: 0 to 1,000,000 with at most 3 decimals, as a string for NUMERIC, or null */
export function jodOf(v: unknown): string | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(s) || Number(s) > 1_000_000) return null;
  return s;
}

/** A date typed as yyyy-mm-dd that exists, between 2020 and 2100, or null */
export function dayOf(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  return v >= "2020-01-01" && v <= "2100-12-31" ? v : null;
}
