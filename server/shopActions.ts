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

type Client = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
export type Length = { until: string } | { days: number } | { months: number };

/** How long, from a body: { until: "yyyy-mm-dd" } or { days } (1 to 1000) or { months } (1 to 36), or null */
export function lengthOf(b: Record<string, unknown> | null): Length | null {
  const until = dayOf(b?.until);
  if (until) return { until };
  const days = Number(b?.days);
  if (Number.isInteger(days) && days >= 1 && days <= 1000) return { days };
  const months = Number(b?.months);
  if (Number.isInteger(months) && months >= 1 && months <= 36) return { months };
  return null;
}

/** Puts a shop on a plan until a date, or extends its current plan. planId null: the current plan (or the last one).
    The same plan as the current one moves its end (from the current end, or from now when that has passed); another
    plan ends the current subscription (cancelled, kept as history) and starts a new one from now. Run inside a
    transaction. Gives the subscription and its plan, or why it can't. */
export async function changeSubscription(
  c: Client,
  accountId: string,
  staffId: string,
  planId: string | null,
  len: Length,
  note: string,
): Promise<{ ok: true; subId: string; planEn: string; planAr: string; endsAt: string } | { ok: false; why: "plan" | "plan-needed" }> {
  const cur = (await c.query(`SELECT id, plan_id, ends_at FROM subscriptions WHERE account_id = $1 AND status IN ('trial', 'active') FOR UPDATE`, [accountId]))
    .rows[0];
  const last = cur ?? (await c.query(`SELECT plan_id FROM subscriptions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1`, [accountId])).rows[0];
  const pid = planId ?? (last ? String(last.plan_id) : null);
  if (!pid) return { ok: false, why: "plan-needed" };
  const plan = (await c.query(`SELECT id, key, name_en, name_ar, active FROM plans WHERE id = $1`, [pid])).rows[0];
  if (!plan) return { ok: false, why: "plan" };
  const same = !!cur && String(cur.plan_id) === String(plan.id);
  /* a plan that is no longer offered can still be extended, not newly given */
  if (!plan.active && !same) return { ok: false, why: "plan" };
  const status = plan.key === "trial" ? "trial" : "active";
  /* $1 is where a length in days or months counts from: the current end when extending the same plan, else now.
     A date ends at the end of that day in Jordan. */
  const end = (n: number) =>
    "until" in len
      ? `(($${n}::date + 1)::timestamp - interval '1 second') AT TIME ZONE 'Asia/Amman'`
      : `GREATEST($${n + 1}::timestamptz, now()) + make_interval(${"days" in len ? "days" : "months"} => $${n}::int)`;
  const value = "until" in len ? len.until : "days" in len ? len.days : len.months;
  const from = same ? cur.ends_at : new Date();
  let row;
  if (same) {
    const params = [cur.id, status, staffId, note, value, ...("until" in len ? [] : [from])];
    row = (
      await c.query(
        `UPDATE subscriptions SET status = $2, ends_at = ${end(5)}, set_by = $3, note = CASE WHEN $4 = '' THEN note ELSE $4 END
          WHERE id = $1 RETURNING id, ends_at`,
        params,
      )
    ).rows[0];
  } else {
    if (cur) await c.query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`, [cur.id]);
    const params = [accountId, plan.id, status, staffId, note, value, ...("until" in len ? [] : [from])];
    row = (
      await c.query(
        `INSERT INTO subscriptions (account_id, plan_id, status, starts_at, ends_at, set_by, note)
         VALUES ($1, $2, $3, now(), ${end(6)}, $4, NULLIF($5, '')) RETURNING id, ends_at`,
        params,
      )
    ).rows[0];
  }
  return { ok: true, subId: String(row.id), planEn: plan.name_en, planAr: plan.name_ar, endsAt: new Date(row.ends_at).toISOString() };
}
