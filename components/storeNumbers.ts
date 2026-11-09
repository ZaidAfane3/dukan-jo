/* The numbers a real merchant sees on the home page and in Reports, worked out from his own orders and products (the
   ones saved under "seen-orders" and "seen-products"). The platform tour keeps its made-up numbers and never comes here.

   No React and no browser APIs: plain functions over cleaned records, so the home page and Reports always agree, and a
   small script can check them. Only types are imported, so the file runs on its own too.

   Money is in JOD and rounded to fils (3 decimals) at the end, never on the way, so totals don't drift. */

import type { Order, Product } from "./records";
import type { StatusKey } from "./ordersContent";

const DAY = 86_400_000;

/* A cancelled or refunded order brought no money in, so it never counts as a sale */
const NOT_SALES: readonly StatusKey[] = ["cancelled", "refunded"];
export const isSale = (o: Pick<Order, "status">) => !NOT_SALES.includes(o.status);

const fils = (n: number) => Math.round(n * 1000) / 1000;

/** A span of time in milliseconds: `from` is in it, `to` is not. */
export type Span = { from: number; to: number };

/* An order with no saved date (0) is in no span */
const inSpan = (o: Pick<Order, "created">, s: Span) => o.created > 0 && o.created >= s.from && o.created < s.to;

/** The ranges Reports offers, in the order of its menu: last 7 days, last 30 days, this month. */
export type RangeKind = 0 | 1 | 2;

/** The days a range covers, whole days in the browser's time zone, up to the end of today. Built from the calendar
    (not by adding 24 hours) so a clock change does not shift a day. */
export function rangeSpan(kind: RangeKind, now: Date): Span {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const to = new Date(y, m, d + 1).getTime();
  if (kind === 2) return { from: new Date(y, m, 1).getTime(), to };
  return { from: new Date(y, m, d - (kind === 0 ? 6 : 29)).getTime(), to };
}

/** The period just before, of the same number of days, so "% change" compares like with like. For "this month" it is
    the same days of last month (1 to 9 November is compared with 1 to 9 October), and never runs into this month. */
export function previousSpan(kind: RangeKind, now: Date): Span {
  const cur = rangeSpan(kind, now);
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = now.getDate();
  if (kind === 2) {
    const from = new Date(y, m - 1, 1).getTime();
    return { from, to: Math.min(new Date(y, m - 1, 1 + days).getTime(), cur.from) };
  }
  const n = kind === 0 ? 7 : 30;
  const start = new Date(cur.from);
  return { from: new Date(start.getFullYear(), start.getMonth(), start.getDate() - n).getTime(), to: cur.from };
}

/** Change from the previous period in percent (one decimal). null when there is nothing to compare with: a rise from 0
    has no percentage, and showing one would be made up. Both 0 is no change. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/* ============================== sales ============================== */

export type SalesFigures = {
  /** Orders that count as sales (not cancelled or refunded) */
  orders: number;
  /** What customers paid: the orders' totals, already after coupons */
  sales: number;
  /** The same orders before their coupons */
  gross: number;
  /** What coupons took off */
  discounts: number;
  /** What the products sold cost him, for the ones whose cost is known */
  cogs: number;
  /** Units sold whose cost is not known (no cost set, the product is gone, or an order added by hand without items) */
  cogsUnknown: number;
  /** Delivery fees the customers paid (saved on the orders), or null when no order in the period has one saved */
  shipping: number | null;
  /** The profit on the products: sales − the delivery fees customers paid − cost of goods. What the merchant pays the
      courier is not recorded anywhere, so it is not in this (the page says so); costs that are not known are left out. */
  profit: number;
  /** sales ÷ orders */
  average: number;
};

/** The product an order line was: by its id (it survives a rename, and is never given to another product, see
    productIds.ts), else by its exact name for lines saved without one. Products in the bin no longer exist for this. */
function productOf(line: { id?: number; name: string }, byId: Map<number, Product>, byName: Map<string, Product>) {
  return (line.id !== undefined ? byId.get(line.id) : undefined) ?? byName.get(line.name);
}

function productMaps(products: Product[]) {
  const live = products.filter((p) => !p.deletedAt);
  return { byId: new Map(live.map((p) => [p.id, p])), byName: new Map(live.map((p) => [p.name, p])) };
}

/** Sales, discounts, cost of goods, delivery and profit of the orders placed in `span`. */
export function salesFigures(orders: Order[], products: Product[], span: Span): SalesFigures {
  const { byId, byName } = productMaps(products);
  const list = orders.filter((o) => isSale(o) && inSpan(o, span));
  let sales = 0;
  let discounts = 0;
  let cogs = 0;
  let cogsUnknown = 0;
  let shipping = 0;
  let shippingSaved = false;
  for (const o of list) {
    sales += o.total;
    discounts += o.coupon?.discount ?? 0;
    if (o.delivery !== undefined) {
      shipping += o.delivery;
      shippingSaved = true;
    }
    /* an order added by hand with only a total: what it cost is not known */
    if (!o.items?.length) cogsUnknown += 1;
    for (const line of o.items ?? []) {
      const p = productOf(line, byId, byName);
      if (p && p.cost !== null) cogs += p.cost * line.qty;
      else cogsUnknown += line.qty;
    }
  }
  const ship = shippingSaved ? fils(shipping) : null;
  return {
    orders: list.length,
    sales: fils(sales),
    gross: fils(sales + discounts),
    discounts: fils(discounts),
    cogs: fils(cogs),
    cogsUnknown,
    shipping: ship,
    profit: fils(sales - cogs - (ship ?? 0)),
    average: list.length ? fils(sales / list.length) : 0,
  };
}

/* ============================== home page ============================== */

export type Series = { sales: number[]; orders: number[] };

/** The home page's chart: each day of this month ("daily"), or each month of this year ("monthly"). */
export function salesSeries(orders: Order[], now: Date, mode: "daily" | "monthly"): Series {
  const y = now.getFullYear();
  const m = now.getMonth();
  const length = mode === "daily" ? new Date(y, m + 1, 0).getDate() : 12;
  const sales = Array<number>(length).fill(0);
  const count = Array<number>(length).fill(0);
  for (const o of orders) {
    if (!isSale(o) || !o.created) continue;
    const d = new Date(o.created);
    if (d.getFullYear() !== y || (mode === "daily" && d.getMonth() !== m)) continue;
    const i = mode === "daily" ? d.getDate() - 1 : d.getMonth();
    sales[i] += o.total;
    count[i] += 1;
  }
  return { sales: sales.map(fils), orders: count };
}

/** The newest orders first, whatever their status (a cancelled one is still news to him). */
export function latestOrders(orders: Order[], n = 3): Order[] {
  return [...orders].sort((a, b) => b.created - a.created || b.id - a.id).slice(0, n);
}

/* ============================== orders ============================== */

export type OrdersReport = {
  /** Every order placed in the period, whatever its status */
  all: number;
  byStatus: Record<StatusKey, number>;
  /** One entry per day of the period, oldest first: its start, its orders, and what they sold */
  byDay: { day: number; orders: number; sales: number }[];
  delivery: number;
  pickup: number;
  /** channel 1 is the online store, 0 an order he added by hand */
  online: number;
  manual: number;
  /** cancelled ÷ all, in percent (one decimal) */
  cancelRate: number;
};

export function ordersReport(orders: Order[], span: Span): OrdersReport {
  const list = orders.filter((o) => inSpan(o, span));
  const byStatus = { pending: 0, review: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, refunded: 0 } as Record<StatusKey, number>;
  for (const o of list) byStatus[o.status] += 1;
  const byDay: OrdersReport["byDay"] = [];
  const start = new Date(span.from);
  for (let i = 0; ; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime();
    if (day >= span.to || i > 366) break;
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1).getTime();
    const those = list.filter((o) => o.created >= day && o.created < next);
    byDay.push({ day, orders: those.length, sales: fils(those.filter(isSale).reduce((s, o) => s + o.total, 0)) });
  }
  return {
    all: list.length,
    byStatus,
    byDay,
    pickup: list.filter((o) => o.fulfil === "pickup").length,
    /* an order with no way saved was delivered: pickup is always saved */
    delivery: list.filter((o) => o.fulfil !== "pickup").length,
    online: list.filter((o) => o.channel === 1).length,
    manual: list.filter((o) => o.channel !== 1).length,
    cancelRate: list.length ? Math.round((byStatus.cancelled / list.length) * 1000) / 10 : 0,
  };
}

/* ============================== customers ============================== */

/** Who placed an order: the phone's last 9 digits (so 07…, +962 7… and 9627… are the same person), else the email. "" when
    the order has neither. */
export function customerKey(o: Pick<Order, "phone" | "email">): string {
  const digits = (o.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) return `p:${digits.slice(-9)}`;
  const email = (o.email ?? "").trim().toLowerCase();
  return email ? `e:${email}` : "";
}

export type CustomersReport = {
  /** Different customers who bought in the period */
  customers: number;
  /** Of them, the ones who bought more than once in the period */
  repeat: number;
  /** Of them, the ones whose first purchase ever is in the period */
  newCustomers: number;
  /** Orders in the period with no phone or email, so they belong to no one */
  unknown: number;
  /** Most orders first (then most spent) */
  top: { name: string; orders: number; spent: number }[];
};

export function customersReport(orders: Order[], span: Span): CustomersReport {
  const sales = orders.filter(isSale);
  const first = new Map<string, number>();
  for (const o of sales) {
    const k = customerKey(o);
    if (k && o.created > 0) first.set(k, Math.min(first.get(k) ?? Infinity, o.created));
  }
  const people = new Map<string, { name: string; orders: number; spent: number; last: number }>();
  let unknown = 0;
  for (const o of sales.filter((x) => inSpan(x, span))) {
    const k = customerKey(o);
    if (!k) {
      unknown += 1;
      continue;
    }
    const p = people.get(k) ?? { name: o.customer, orders: 0, spent: 0, last: 0 };
    /* the name on his newest order is the one shown */
    if (o.created >= p.last) {
      p.name = o.customer;
      p.last = o.created;
    }
    p.orders += 1;
    p.spent += o.total;
    people.set(k, p);
  }
  const list = Array.from(people.entries());
  return {
    customers: list.length,
    repeat: list.filter(([, p]) => p.orders > 1).length,
    newCustomers: list.filter(([k]) => (first.get(k) ?? 0) >= span.from).length,
    unknown,
    top: list
      .map(([, p]) => ({ name: p.name, orders: p.orders, spent: fils(p.spent) }))
      .sort((a, b) => b.orders - a.orders || b.spent - a.spent)
      .slice(0, 10),
  };
}

/* ============================== payments ============================== */

/** "none": an order added by hand, where no way of paying was saved */
export type PayKey = "card" | "cliq" | "cash" | "none";
export const PAY_KEYS: readonly PayKey[] = ["card", "cliq", "cash", "none"];

export function paymentsReport(orders: Order[], span: Span): Record<PayKey, { count: number; sum: number }> {
  const out = { card: { count: 0, sum: 0 }, cliq: { count: 0, sum: 0 }, cash: { count: 0, sum: 0 }, none: { count: 0, sum: 0 } };
  for (const o of orders) {
    if (!isSale(o) || !inSpan(o, span)) continue;
    const row = out[o.pay ?? "none"];
    row.count += 1;
    row.sum += o.total;
  }
  for (const k of PAY_KEYS) out[k].sum = fils(out[k].sum);
  return out;
}

/* ============================== inventory ============================== */

export type InventoryReport = {
  /** Products not in the bin (hidden ones too: they are still his stock) */
  products: number;
  /** Units in stock, over the products with a counted stock */
  stock: number;
  /** Products whose stock has no limit (never low, never out) */
  unlimited: number;
  /** At or under the product's own "low stock" amount, but not 0 */
  low: number;
  out: number;
  inStock: number;
  /** Units sold in the period */
  sold: number;
  /** Best sellers in the period, by units */
  topSold: { name: string; qty: number }[];
  /** Products running low or out, fewest first, to restock */
  lowList: { name: string; quantity: number; lowAt: number }[];
};

export function inventoryReport(products: Product[], orders: Order[], span: Span): InventoryReport {
  const live = products.filter((p) => !p.deletedAt);
  const counted = live.filter((p) => !p.unlimited);
  const low = counted.filter((p) => p.quantity > 0 && p.quantity <= p.lowAt);
  const out = counted.filter((p) => p.quantity <= 0);
  const { byId, byName } = productMaps(products);
  const sold = new Map<string, number>();
  let units = 0;
  for (const o of orders) {
    if (!isSale(o) || !inSpan(o, span)) continue;
    for (const line of o.items ?? []) {
      /* a product still in the list goes by its name today (it may have been renamed since) */
      const name = productOf(line, byId, byName)?.name ?? line.name;
      sold.set(name, (sold.get(name) ?? 0) + line.qty);
      units += line.qty;
    }
  }
  return {
    products: live.length,
    stock: counted.reduce((n, p) => n + Math.max(0, p.quantity), 0),
    unlimited: live.length - counted.length,
    low: low.length,
    out: out.length,
    inStock: live.length - low.length - out.length,
    sold: units,
    topSold: Array.from(sold.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).slice(0, 10),
    lowList: [...out, ...low].map((p) => ({ name: p.name, quantity: Math.max(0, p.quantity), lowAt: p.lowAt })).sort((a, b) => a.quantity - b.quantity).slice(0, 10),
  };
}
