/* The numbers a real merchant sees on the home page and in Reports, worked out from his own orders and products (the
   ones saved under "seen-orders" and "seen-products"). The platform tour keeps its made-up numbers and never comes here.

   No React and no browser APIs: plain functions over cleaned records, so the home page and Reports always agree, and a
   small script can check them. Only types are imported, so the file runs on its own too.

   Money is in JOD and rounded to fils (3 decimals) at the end, never on the way, so totals don't drift. */

import type { Order, Product } from "./records";
import type { StatusKey } from "./ordersContent";

const DAY = 86_400_000;

/* A cancelled or refunded order was not bought: it is not a sale, a customer's purchase or a unit sold */
const NOT_SALES: readonly StatusKey[] = ["cancelled", "refunded"];
/** The order still stands (not cancelled or refunded). Customers, units sold and payment methods count these. */
export const isSale = (o: Pick<Order, "status">) => !NOT_SALES.includes(o.status);

/** An order as the merchant's pages count it: kept in his browser, or placed on his public store and kept on the server
    (`payment` "test": placed while payment is not open, so nothing was charged; "paid": a card or CliQ store order whose
    payment he marked received on the Orders page). */
export type CountedOrder = Order & { payment?: "test" | "unpaid" | "paid" };

/** What an order is worth to the sales numbers (the home page and Reports share this):
    - "none": cancelled or refunded; or placed on the store and paid by card or CliQ, which no payment takes yet (a test
      order: nothing was charged), so no money came in and none is coming, until he marks its payment received
    - "sale": a store order delivered (or picked up): the money is in; a card or CliQ store order he marked "Payment
      received" (whatever its status); an order he added himself as soon as the Orders page calls it "Paid" (any status
      after pending), so the two pages agree
    - "expected": a store order still on its way (pending, in review, being prepared, out for delivery: cash on
      delivery), or an order he added himself that is still pending */
export type SaleState = "sale" | "expected" | "none";
/** A test order: placed on the store (or its preview) and paid by card or CliQ, which no payment takes yet, so nothing
    was charged, and he has not marked its payment received. Never a sale, never "expected", never in a money total;
    counted apart only ("test orders not counted"). */
export const isTestOrder = (o: Pick<CountedOrder, "channel" | "pay" | "payment">) =>
  (o.channel === 1 || o.payment === "test") && (o.pay === "card" || o.pay === "cliq") && o.payment !== "paid";
export function saleState(o: Pick<CountedOrder, "status" | "channel" | "pay" | "payment">): SaleState {
  if (!isSale(o)) return "none";
  if (isTestOrder(o)) return "none";
  /* a card or CliQ order whose payment he marked received: the money is in */
  if (o.payment === "paid" && (o.pay === "card" || o.pay === "cliq")) return "sale";
  /* added by hand: the Orders page shows it "Paid" from the first status after pending (Orders.tsx payment line) */
  if (o.channel === 0 && o.payment === undefined) return o.status === "pending" ? "expected" : "sale";
  return o.status === "delivered" ? "sale" : "expected";
}
const countsAsSale = (o: CountedOrder) => saleState(o) === "sale";

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
  /** Orders that count as sales (delivered, see saleState) */
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
  /** The profit on the products that have a cost price: for each line of those, what the customer paid for it (its share
      of the order after the coupon, without the delivery fee) − its cost. Lines with no known cost are left out
      entirely (counting their price as profit would read as 100% profit). null when nothing sold has a cost, so there
      is no profit to show. What the merchant pays the courier is not recorded anywhere, so it is not in this. */
  profit: number | null;
  /** What customers paid (after coupons, without delivery fees) for what has no known cost: lines whose product has no
      cost price (or is gone), and orders added by hand with only a total. Left out of the profit, so that
      sales − (cogs + shipping) − costless = profit, and the cards can say so */
  costless: number;
  /** The different products sold in the period, and how many of them have a cost price (the profit's "N of M") */
  products: { all: number; withCost: number };
  /** sales ÷ orders */
  average: number;
  /** Orders still on their way (saleState "expected") and what they will bring in once delivered */
  expected: { orders: number; sales: number };
  /** Store orders paid by card or CliQ while payment is not open: nothing was charged, so they are not sales */
  notCharged: number;
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
export function salesFigures(orders: CountedOrder[], products: Product[], span: Span): SalesFigures {
  const { byId, byName } = productMaps(products);
  const inPeriod = orders.filter((o) => inSpan(o, span));
  const list = inPeriod.filter(countsAsSale);
  let sales = 0;
  let discounts = 0;
  let cogs = 0;
  let cogsUnknown = 0;
  let shipping = 0;
  let shippingSaved = false;
  let profit = 0;
  /* what was paid for the lines with a cost (the profit's own sales) */
  let costedPaid = 0;
  /* the products sold, and those of them with a cost: by the product's id, else the line's name */
  const sold = new Set<string>();
  const costed = new Set<string>();
  for (const o of list) {
    sales += o.total;
    discounts += o.coupon?.discount ?? 0;
    if (o.delivery !== undefined) {
      shipping += o.delivery;
      shippingSaved = true;
    }
    /* an order added by hand with only a total: what it cost is not known */
    if (!o.items?.length) cogsUnknown += 1;
    /* what the customer paid for the products (the total after the coupon, without the delivery fee), shared over the
       lines by their prices, so a coupon lowers each line's part */
    const lines = o.items ?? [];
    const listed = lines.reduce((n, l) => n + l.price * l.qty, 0);
    const paid = Math.max(0, o.total - (o.delivery ?? 0));
    for (const line of lines) {
      const p = productOf(line, byId, byName);
      const key = p ? `p:${p.id}` : `n:${line.name}`;
      sold.add(key);
      if (p && p.cost !== null) {
        costed.add(key);
        cogs += p.cost * line.qty;
        const part = listed > 0 ? (paid * line.price * line.qty) / listed : 0;
        costedPaid += part;
        profit += part - p.cost * line.qty;
      } else cogsUnknown += line.qty;
    }
  }
  /* what is still on its way, and the store's card and CliQ test orders that are never sales */
  let expectedOrders = 0;
  let expectedSales = 0;
  let notCharged = 0;
  for (const o of inPeriod) {
    const s = saleState(o);
    if (s === "expected") {
      expectedOrders += 1;
      expectedSales += o.total;
    } else if (s === "none" && isSale(o)) notCharged += 1;
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
    /* nothing sold: no profit (0); things sold but none with a cost: not known */
    profit: sold.size === 0 && list.length === 0 ? 0 : costed.size ? fils(profit) : null,
    /* everything paid that is not a delivery fee nor a line with a cost (worked out from the same sums, so it closes) */
    costless: fils(Math.max(0, sales - shipping - costedPaid)),
    products: { all: sold.size, withCost: costed.size },
    average: list.length ? fils(sales / list.length) : 0,
    expected: { orders: expectedOrders, sales: fils(expectedSales) },
    notCharged,
  };
}

/* ============================== home page ============================== */

/** sales: what the day's (or month's) sales brought in (saleState "sale"); orders: every order placed in it, whatever its
    status, like the Orders report counts them, so a new order shows at once even before it is delivered. Card or CliQ
    test orders (isTestOrder) are in neither, like everywhere else on the home page and in Reports */
export type Series = { sales: number[]; orders: number[] };

/** The home page's chart: each day of this month ("daily"), or each month of this year ("monthly"). */
export function salesSeries(orders: CountedOrder[], now: Date, mode: "daily" | "monthly"): Series {
  const y = now.getFullYear();
  const m = now.getMonth();
  const length = mode === "daily" ? new Date(y, m + 1, 0).getDate() : 12;
  const sales = Array<number>(length).fill(0);
  const count = Array<number>(length).fill(0);
  for (const o of orders) {
    if (!o.created) continue;
    const d = new Date(o.created);
    if (d.getFullYear() !== y || (mode === "daily" && d.getMonth() !== m)) continue;
    if (isTestOrder(o)) continue;
    const i = mode === "daily" ? d.getDate() - 1 : d.getMonth();
    count[i] += 1;
    if (countsAsSale(o)) sales[i] += o.total;
  }
  return { sales: sales.map(fils), orders: count };
}

/** The newest orders first, whatever their status (a cancelled one is still news to him). */
export function latestOrders(orders: Order[], n = 3): Order[] {
  return [...orders].sort((a, b) => b.created - a.created || b.id - a.id).slice(0, n);
}

/* ============================== orders ============================== */

export type OrdersReport = {
  /** Every order placed in the period, whatever its status, except card or CliQ test orders (counted apart in `test`).
      Every count below leaves them out too */
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
  /** The period's card or CliQ test orders (isTestOrder: nothing was charged), whatever their status: not in `all` */
  test: number;
};

export function ordersReport(orders: CountedOrder[], span: Span): OrdersReport {
  const placed = orders.filter((o) => inSpan(o, span));
  const list = placed.filter((o) => !isTestOrder(o));
  const byStatus = { pending: 0, review: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, refunded: 0 } as Record<StatusKey, number>;
  for (const o of list) byStatus[o.status] += 1;
  const byDay: OrdersReport["byDay"] = [];
  const start = new Date(span.from);
  for (let i = 0; ; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime();
    if (day >= span.to || i > 366) break;
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1).getTime();
    const those = list.filter((o) => o.created >= day && o.created < next);
    byDay.push({ day, orders: those.length, sales: fils(those.filter(countsAsSale).reduce((s, o) => s + o.total, 0)) });
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
    test: placed.length - list.length,
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

export function customersReport(orders: CountedOrder[], span: Span): CustomersReport {
  /* a card or CliQ test order (nothing was charged) is not a purchase */
  const sales = orders.filter((o) => isSale(o) && !isTestOrder(o));
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

export function paymentsReport(orders: CountedOrder[], span: Span): Record<PayKey, { count: number; sum: number }> {
  const out = { card: { count: 0, sum: 0 }, cliq: { count: 0, sum: 0 }, cash: { count: 0, sum: 0 }, none: { count: 0, sum: 0 } };
  for (const o of orders) {
    /* paid, or to be paid on delivery: a card or CliQ test order (nothing charged) is not a payment */
    if (saleState(o) === "none" || !inSpan(o, span)) continue;
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

export function inventoryReport(products: Product[], orders: CountedOrder[], span: Span): InventoryReport {
  const live = products.filter((p) => !p.deletedAt);
  const counted = live.filter((p) => !p.unlimited);
  const low = counted.filter((p) => p.quantity > 0 && p.quantity <= p.lowAt);
  const out = counted.filter((p) => p.quantity <= 0);
  const { byId, byName } = productMaps(products);
  const sold = new Map<string, number>();
  let units = 0;
  for (const o of orders) {
    /* a card or CliQ test order (nothing was charged) sold nothing */
    if (!isSale(o) || isTestOrder(o) || !inSpan(o, span)) continue;
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
