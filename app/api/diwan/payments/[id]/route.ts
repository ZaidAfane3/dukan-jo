import type { NextRequest } from "next/server";
import { answer } from "@/server/auth";
import { plainText, seal } from "@/server/crypto";
import { db } from "@/server/db";
import { body, dayOf, jodOf, reasonOf, shopNameOf, textOf } from "@/server/shopActions";
import { audit, staffRoute } from "@/server/staff";
import { passwordAgain } from "@/server/staffConfirm";

export const dynamic = "force-dynamic";

/* One payment staff marked as received (a store's page, "Mark a payment as received"), to correct it when it was
   recorded wrong (testing D-5). A theme bought in the theme store is not one of these and can't be changed here.
   - GET: the payment as it is now (with its version) and its history: when it was recorded and each correction, by whom,
     why, and the values before and after (from the activity log).
   - PATCH { version, amount, method, paidOn, reference?, note?, reason, myPassword }: saves the new values, only from the
     version the form showed (two staff correcting it at once: the second is told it changed meanwhile, "changed" with
     the payment as it is now, and saves nothing). Needs the staff member's own password with it (server/staffConfirm.ts
     passwordAgain) and a reason (5 characters or more). The values before are kept in the activity-log line
     ("shop.payment_edit"), written in the same step as the change. The store's totals are counted from the payments
     themselves, so they follow at once. The merchant is not told (a correction of Dukkan's own record).
   Answers: "ok" { payment }, "invalid", "reason-needed", "same" (nothing changed), "changed" (409), "not-found",
   "password" (403), "slow-down" (429). */

const METHODS = ["bank", "cliq", "cash", "card"];
const idOf = (v: string | undefined) => (/^\d{1,18}$/.test(v ?? "") ? v! : null);

type Row = { id: string; account_id: string; amount: string; method: string; reference: string; paid_on: string; note: string; version: number };
const SELECT = `SELECT id, account_id, amount::text AS amount, method, reference, paid_on::text AS paid_on, note, version FROM payments WHERE id = $1`;
/* what is shown and kept of a payment (its amount always with 3 decimals, as the database gives it back) */
const shown = (r: Row) => ({ id: String(r.id), amount: Number(r.amount).toFixed(3), method: r.method, reference: r.reference ?? "", paidOn: r.paid_on, note: r.note ?? "", version: r.version });

export const GET = staffRoute("billing", async (_req, _staff, ctx) => {
  const id = idOf(ctx.params.id);
  if (!id) return answer({ result: "not-found" }, 404);
  const pool = await db();
  const { rows } = await pool.query(SELECT, [id]);
  if (!rows[0]) return answer({ result: "not-found" }, 404);
  const p = rows[0] as Row;
  /* the lines about this store's payments; the payment each is about is in its (opened) details */
  const { rows: lines } = await pool.query(
    `SELECT l.at, l.action, l.reason, l.meta, st.name AS staff_name FROM audit_log l LEFT JOIN staff st ON st.id = l.staff_id
      WHERE l.target_type = 'shop' AND l.target_id = $1 AND l.action IN ('shop.payment', 'shop.payment_edit') ORDER BY l.at, l.id`,
    [String(p.account_id)],
  );
  const history = lines
    .filter((l) => String(l.meta?.payment ?? "") === id)
    .map((l) => ({
      at: l.at,
      by: l.staff_name ?? null,
      kind: l.action === "shop.payment" ? "recorded" : "edited",
      reason: l.action === "shop.payment_edit" ? (l.reason ?? "") : "",
      before: l.action === "shop.payment_edit" ? l.meta?.before ?? null : null,
      after: l.action === "shop.payment_edit" ? l.meta?.after ?? null : { amount: l.meta?.amount ?? null, method: l.meta?.method ?? null },
    }));
  return answer({ result: "ok", payment: shown(p), history });
});

export const PATCH = staffRoute("billing", async (req: NextRequest, staff, ctx) => {
  const id = idOf(ctx.params.id);
  if (!id) return answer({ result: "not-found" }, 404);
  const b = await body(req);
  const version = typeof b?.version === "number" && Number.isInteger(b.version) && b.version > 0 ? b.version : null;
  /* "12,5" typed with a comma is 12.5 */
  const amount = jodOf(typeof b?.amount === "string" ? b.amount.replace(",", ".") : b?.amount);
  const method = typeof b?.method === "string" && METHODS.includes(b.method) ? b.method : null;
  const paidOn = dayOf(b?.paidOn);
  /* a payment of 0 isn't a payment (QA 31), as when it is recorded */
  if (!version || !amount || !(Number(amount) > 0) || !method || !paidOn) return answer({ result: "invalid" }, 400);
  const reference = textOf(b?.reference, 100);
  const note = textOf(b?.note, 300);
  const reason = reasonOf(b?.reason);
  if (!reason) return answer({ result: "reason-needed" }, 400);
  const refused = await passwordAgain(req, staff, b?.myPassword, "shop.payment_edit");
  if (refused) return refused;

  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(`${SELECT} FOR UPDATE`, [id]);
    const was = rows[0] as Row | undefined;
    if (!was) {
      await c.query("ROLLBACK");
      return answer({ result: "not-found" }, 404);
    }
    const before = shown(was);
    /* changed by someone else since this form was opened: nothing is saved, the form gets what is there now */
    if (was.version !== version) {
      await c.query("ROLLBACK");
      return answer({ result: "changed", payment: before }, 409);
    }
    const after = { amount: Number(amount).toFixed(3), method, reference, paidOn, note };
    const same = (Object.keys(after) as (keyof typeof after)[]).every((k) => after[k] === before[k]);
    if (same) {
      await c.query("ROLLBACK");
      return answer({ result: "same" }, 400);
    }
    const { rows: now } = await c.query(
      `UPDATE payments SET amount = $2, method = $3, reference = $4, paid_on = $5, note = $6, version = version + 1, edited_at = now(), edited_by = $7
        WHERE id = $1 RETURNING id, account_id, amount::text AS amount, method, reference, paid_on::text AS paid_on, note, version`,
      [id, amount, method, plainText(reference), paidOn, seal(note), staff.id],
    );
    const { version: _v, id: _id, ...old } = before;
    /* the payment is named by its number (kept as a number, so it stays readable for its history); the old and new values
       are the line's details (sealed like every text in them) */
    await audit(req, staff.id, "shop.payment_edit", { type: "shop", id: String(was.account_id) }, reason, { payment: Number(id), before: old, after, store: await shopNameOf(String(was.account_id)) }, c);
    await c.query("COMMIT");
    return answer({ result: "ok", payment: shown(now[0] as Row) });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
});
