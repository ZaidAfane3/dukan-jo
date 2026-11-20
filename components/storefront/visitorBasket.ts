import { priceCart } from "../safeOrder";
import type { LostLine } from "./Cart";
import { basketKey } from "./sections";
import type { StoreProduct } from "./useStoreData";

/* The public store (app/[slug]) keeps a visitor's basket in the visitor's own browser, one per store, so a reload or
   coming back later finds it again. Only what he chose is kept (product ids, sizes and how many), never a price: the
   basket is always priced from the store as it is now, and the server prices the order again anyway. This is the
   visitor's own data, not the store's: nothing of the store itself is read from this browser (see visitorStore.ts). */

/* a basket left this long is not brought back (the store has likely changed a lot since) */
const KEEP_DAYS = 30;

/** Where one store's basket is kept in this browser */
export const basketStorageKey = (slug: string) => `dukkan-cart:${slug.trim().toLowerCase()}`;

/* The kept basket as written: { at, items: { "<id>" or "<id>|<size>": qty } } */
function readItems(key: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as { at?: unknown; items?: unknown } | null;
    if (!v || typeof v !== "object" || !v.items || typeof v.items !== "object" || Array.isArray(v.items)) return null;
    if (typeof v.at !== "number" || Date.now() - v.at > KEEP_DAYS * 86_400_000) return null;
    return v.items as Record<string, unknown>;
  } catch {
    /* storage turned off (private mode) or a damaged entry: an empty basket */
    return null;
  }
}

/** The kept basket, checked against the store's products now: a product gone, hidden, with no price, sold out or in a
    size it no longer has is left out, and quantities are cut to the stock and the order limits (the same rules as
    placing the order, safeOrder.ts priceCart). `lost`: each line that could not be kept as it was (gone, sold out, or
    cut to the stock), so the cart can say which and why (Cart.tsx LostLine). */
export function readBasket(key: string, products: StoreProduct[]): { qty: Record<string, number>; lost: LostLine[] } {
  const items = key ? readItems(key) : null;
  if (!items) return { qty: {}, lost: [] };
  const lines = Object.entries(items).map(([k, qty]) => {
    const bar = k.indexOf("|");
    return { id: bar < 0 ? k : k.slice(0, bar), qty, ...(bar < 0 ? {} : { size: k.slice(bar + 1) }) };
  });
  const out: Record<string, number> = {};
  for (const it of priceCart(lines, products).items) out[basketKey(it.id, it.size)] = it.qty;
  const lost: LostLine[] = [];
  for (const l of lines) {
    const was = typeof l.qty === "number" && Number.isFinite(l.qty) ? Math.floor(l.qty) : 0;
    if (was <= 0) continue;
    const p = products.find((x) => String(x.id) === l.id);
    /* a product in sizes is kept by size; any other one by its id alone (priceCart does the same) */
    const now = out[p?.sizes?.length ? basketKey(Number(l.id), l.size) : String(l.id)] ?? 0;
    if (now < was) lost.push({ name: p?.name ?? "", ...(p?.sizes?.length && l.size ? { size: l.size } : {}), qty: now });
  }
  return { qty: out, lost };
}

/** Keeps the basket (an empty one is removed). Unchanged items are not written again, so another tab of the same
    store that follows this one never answers with a write of its own. */
export function writeBasket(key: string, qty: Record<string, number>) {
  if (!key) return;
  try {
    const items = Object.fromEntries(Object.entries(qty).filter(([, n]) => n > 0));
    if (!Object.keys(items).length) return void localStorage.removeItem(key);
    const old = readItems(key);
    if (old && JSON.stringify(old) === JSON.stringify(items)) return;
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* storage full or turned off: the basket still works until the page is left */
  }
}
