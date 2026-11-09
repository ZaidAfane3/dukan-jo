/* A product's id is never given twice. Orders keep the id of each product they sold, and the reports find the product (its
   cost, its current name after a rename) by that id; if a product deleted for good gave its id to a new one, old sales
   would count with the new product's cost and name. So the highest id ever given is kept with the store ("seen-" keys
   are saved with the account), and ids already in orders are never handed out again either. */

const LAST_ID = "seen-product-last-id";
const ORDERS = "seen-orders";

/** The highest product id any saved order mentions */
function highestInOrders(): number {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(ORDERS) ?? "[]");
    if (!Array.isArray(list)) return 0;
    let high = 0;
    for (const o of list) {
      const items = (o as { items?: unknown } | null)?.items;
      if (!Array.isArray(items)) continue;
      for (const i of items) {
        const id = (i as { id?: unknown } | null)?.id;
        if (typeof id === "number" && Number.isSafeInteger(id)) high = Math.max(high, id);
      }
    }
    return high;
  } catch {
    return 0;
  }
}

/** The id for a new product: above every product saved (in the bin too), every id an order mentions and every id given
    before. Remembered, so deleting the newest product for good never frees its id. */
export function nextProductId(items: { id: number }[]): number {
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_ID)) || 0;
  } catch {
    /* storage blocked: the products and orders still keep it above every id in use */
  }
  const id = Math.max(last, highestInOrders(), ...items.map((x) => x.id), 0) + 1;
  try {
    localStorage.setItem(LAST_ID, String(id));
  } catch {
    /* storage blocked */
  }
  return id;
}
