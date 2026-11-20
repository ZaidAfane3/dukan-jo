import type { NextRequest } from "next/server";
import { cleanLine, visibleLength } from "@/components/safe";
import { seal } from "./crypto";
import { db } from "./db";
import { emailNotice, notify } from "./notify";
import { audit, type Staff } from "./staff";
import { paidSet, type ShipState } from "./storeOrders";

/* Diwan > Dukkan Ship > Orders: the store orders Dukkan Ship takes to the customer (store_orders.ship_by = 'dukkan',
   set when the order is placed, server/storeOrders.ts). Unlike the rest of Diwan, these show the customer's name,
   phone and address and what was bought, because Dukkan's couriers need them to pick the order up at the store and
   deliver it; only staff with "ship.orders" (owners) can open them. Staff mark each one delivered or not delivered
   (with the reason): the merchant sees it on his order and in his bell, and a delivered order is delivered on his
   Orders page too. Every mark is written to the activity log. */

export type ShipTab = "waiting" | "delivered" | "failed" | "cancelled" | "all";
const TABS: ShipTab[] = ["waiting", "delivered", "failed", "cancelled", "all"];
export const isShipTab = (v: unknown): v is ShipTab => typeof v === "string" && (TABS as string[]).includes(v);

/* an order the merchant cancelled or refunded is not taken to anyone */
const STOPPED = `o.status IN ('cancelled', 'refunded')`;
const TAB_SQL: Record<ShipTab, string> = {
  /* a big order waiting for the merchant to confirm it (status "review") isn't Dukkan's to deliver yet */
  waiting: `o.ship_state = 'waiting' AND o.status <> 'review' AND NOT ${STOPPED}`,
  delivered: `o.ship_state = 'delivered'`,
  failed: `o.ship_state = 'failed'`,
  cancelled: `o.ship_state = 'waiting' AND ${STOPPED}`,
  all: `TRUE`,
};

const PAGE = 50;

export type ShipOrder = {
  id: string;
  number: number;
  createdAt: string;
  status: string;
  ship: { state: ShipState; note: string | null; at: string | null; by: string | null };
  store: { id: string; name: string; slug: string | null; phone: string; pickupCity: string; pickupAddress: string };
  customer: { name: string; phone: string | null; email: string | null; city: string | null; address: string | null; note: string | null };
  items: { name: string; qty: number; size?: string }[];
  total: number;
  delivery: number;
  pay: "cliq" | "cash" | "card";
  payment: "test" | "unpaid" | "paid";
};

/* the search: a store's name or link, or an order number */
function searchSql(q: string, params: unknown[]): string {
  const text = q.trim().slice(0, 80);
  if (!text) return "";
  params.push(`%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const like = `$${params.length}`;
  const parts = [`s.name ILIKE ${like}`, `s.slug ILIKE ${like}`];
  if (/^#?\d{1,9}$/.test(text)) {
    params.push(Number(text.replace("#", "")));
    parts.push(`o.number = $${params.length}`);
  }
  return ` AND (${parts.join(" OR ")})`;
}

/** One batch of the orders in a tab, newest first; `before`: the `next` of the batch before. With every tab's count
    (for the same search). The private details come opened (db() opens them). */
export async function listShipOrders(tab: ShipTab, q: string, before: string | null) {
  const pool = await db();
  const params: unknown[] = [];
  const search = searchSql(q, params);
  const from = `FROM store_orders o JOIN shops s ON s.account_id = o.account_id`;
  const where = `WHERE o.ship_by = 'dukkan'${search}`;
  const older = before && /^\d{1,18}$/.test(before) ? before : null;
  const listParams = [...params, ...(older ? [older] : [])];
  const [rows, counts] = await Promise.all([
    pool.query(
      `SELECT o.id, o.number, o.created_at, o.status, o.items, o.delivery_fee, o.total, o.payment_method, o.payment_status,
              o.customer_name, o.customer_phone, o.customer_email, o.city, o.address, o.notes,
              o.ship_state, o.ship_note, o.ship_at, st.name AS ship_by_name,
              s.account_id AS shop_id, s.name AS shop_name, s.slug, s.phone AS shop_phone, s.pickup_city, s.pickup_address
         ${from} LEFT JOIN staff st ON st.id = o.ship_staff ${where} AND ${TAB_SQL[tab]}${older ? ` AND o.id < $${listParams.length}` : ""}
        ORDER BY o.id DESC LIMIT ${PAGE + 1}`,
      listParams,
    ),
    pool.query(
      `SELECT ${TABS.map((t) => `count(*) FILTER (WHERE ${TAB_SQL[t]})::int AS ${t}`).join(", ")} ${from} ${where}`,
      params,
    ),
  ]);
  const more = rows.rows.length > PAGE;
  const page = rows.rows.slice(0, PAGE);
  const c = counts.rows[0] as Record<ShipTab, number>;
  return {
    rows: page.map(shipRow),
    next: more ? String(page[page.length - 1].id) : null,
    total: c[tab],
    counts: c,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shipRow(r: Record<string, any>): ShipOrder {
  const text = (v: unknown) => (v == null || v === "" ? null : String(v));
  const items = (Array.isArray(r.items) ? r.items : []).map((it: Record<string, unknown>) => ({
    name: String(it.name ?? ""),
    qty: Number(it.qty) || 0,
    ...(typeof it.size === "string" && it.size ? { size: it.size } : {}),
  }));
  return {
    id: String(r.id),
    number: Number(r.number),
    createdAt: new Date(r.created_at).toISOString(),
    status: String(r.status),
    ship: {
      state: (["waiting", "delivered", "failed"].includes(r.ship_state) ? r.ship_state : "waiting") as ShipState,
      note: r.ship_state === "failed" ? text(r.ship_note) : null,
      at: r.ship_at ? new Date(r.ship_at).toISOString() : null,
      by: text(r.ship_by_name),
    },
    store: {
      id: String(r.shop_id),
      name: String(r.shop_name ?? ""),
      slug: text(r.slug),
      phone: String(r.shop_phone ?? ""),
      pickupCity: String(r.pickup_city ?? ""),
      pickupAddress: String(r.pickup_address ?? ""),
    },
    customer: { name: String(r.customer_name ?? ""), phone: text(r.customer_phone), email: text(r.customer_email), city: text(r.city), address: text(r.address), note: text(r.notes) },
    items,
    total: Number(r.total),
    delivery: Number(r.delivery_fee),
    pay: r.payment_method,
    payment: r.payment_status === "paid" ? "paid" : r.payment_status === "unpaid" ? "unpaid" : "test",
  };
}

export const SHIP_NOTE_MAX = 300;

/** Marks one Dukkan Ship order: "delivered" (the merchant's order becomes delivered too), "failed" (not delivered:
    `note` says why, 1 to 300 letters) or "waiting" (undoes a mark: a delivered order goes back to shipping). An order
    the merchant cancelled or refunded is not marked. The merchant's bell hears of a delivered or failed one. */
export async function markShipOrder(req: NextRequest, me: Staff, id: string, body: Record<string, unknown>): Promise<"ok" | "none" | "invalid" | "cancelled"> {
  if (!/^\d{1,18}$/.test(id)) return "none";
  const state = body.state;
  if (state !== "delivered" && state !== "failed" && state !== "waiting") return "invalid";
  const note = state === "failed" ? cleanLine(typeof body.note === "string" ? body.note : "", SHIP_NOTE_MAX) : "";
  if (state === "failed" && visibleLength(note) < 1) return "invalid";

  const c = await (await db()).connect();
  let done: { account: string; number: number; from: string } | null = null;
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(`SELECT account_id, number, status, ship_state FROM store_orders WHERE id = $1 AND ship_by = 'dukkan' FOR UPDATE`, [id]);
    const o = rows[0] as { account_id: string; number: number; status: string; ship_state: string } | undefined;
    if (!o) {
      await c.query("ROLLBACK");
      return "none";
    }
    if (o.status === "cancelled" || o.status === "refunded") {
      await c.query("ROLLBACK");
      return "cancelled";
    }
    /* the merchant's own status follows: delivered when Dukkan delivered it; back to shipping when a delivery Dukkan had
       marked is undone or changed to "not delivered" (so a cash order no longer reads as paid either: paidSet) */
    const status = state === "delivered" ? "delivered" : o.ship_state === "delivered" && o.status === "delivered" ? "shipping" : o.status;
    await c.query(
      `UPDATE store_orders SET ship_state = $2, ship_note = $3, ship_at = $4, ship_staff = $5, status = $6, ${paidSet("$6")}, updated_at = now() WHERE id = $1`,
      [id, state, state === "failed" ? seal(note) : null, state === "waiting" ? null : new Date(), state === "waiting" ? null : me.id, status],
    );
    if (state === "delivered" && o.ship_state !== "delivered") await notify(o.account_id, "shipDelivered", { number: o.number }, c);
    if (state === "failed") await notify(o.account_id, "shipFailed", { number: o.number, note }, c);
    await c.query("COMMIT");
    if (state === "failed") emailNotice(o.account_id, "shipFailed", { number: o.number, note });
    done = { account: o.account_id, number: Number(o.number), from: o.ship_state };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await audit(req, me.id, "ship.order.mark", { type: "store_order", id }, state === "failed" ? note : null, { shop: done.account, number: done.number, from: done.from, to: state });
  return "ok";
}
