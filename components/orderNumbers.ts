/* An order's number is never given twice. Orders come from three places: the ones he adds by hand (Orders.tsx), the
   ones from his own store preview (storefront/Cart.tsx saveOrder) and the ones customers place on his public store
   (server/storeOrders.ts placeStoreOrder). Each takes the next number after the highest one ever given, kept with the
   store ("seen-" keys are saved with the account), so deleting the newest order never frees its number, and the record
   of a deleted order (orderDeletions.ts, by number) can't be mistaken for a later one. The server raises it with every
   store order and never lets a save lower it (app/api/store PUT), as productIds.ts does for product ids. */

export const ORDER_NUMBER_KEY = "seen-order-last-number";

/** The numbers start after this one: the first order is #1001 */
export const ORDER_NUMBER_START = 1000;

/** A last number as saved: a whole number below a billion (order numbers are shown and kept as such), else 0 */
export function lastOrderNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n < 1e9 ? n : 0;
}

/** The highest number of these orders (only real order numbers count) */
export const highestOrderNumber = (orders: unknown[]): number =>
  orders.reduce<number>((m, x) => {
    const id = x && typeof x === "object" ? (x as { id?: unknown }).id : undefined;
    return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id < 1e9 ? Math.max(m, id) : m;
  }, 0);

/** The number for a new order: after every order in use (`inUse`, his store's orders too when the page has them) and
    every number given before. Remembered, so it is never given again. */
export function nextOrderNumber(inUse: unknown[]): number {
  let last = 0;
  try {
    last = lastOrderNumber(localStorage.getItem(ORDER_NUMBER_KEY));
  } catch {
    /* storage blocked: the orders in use still keep it above every number in use */
  }
  const id = Math.max(ORDER_NUMBER_START, last, highestOrderNumber(inUse)) + 1;
  try {
    localStorage.setItem(ORDER_NUMBER_KEY, String(id));
  } catch {
    /* storage blocked */
  }
  return id;
}
