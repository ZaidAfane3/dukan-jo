/* What he has filled in during setup, kept in this browser so the
   home page can greet him by store name and show how far along he is.
   Nothing is sent anywhere, and uploaded files are never stored. */

import { cleanProfile, cleanSetup, savedPhone } from "./safeAccount";
import { nextProductId } from "./productIds";
import { cleanProduct, money, parseList, productProblems, type Product } from "./records";
import { kindHasSizes, kindShips, type ProductKind, type SizeStock } from "./safeOrder";

export type SavedSetup = {
  name: string;
  description: string;
  color: string;
  phone: string;
  /* The store's WhatsApp number from setup (+9627XXXXXXXX), or "" for none. The footer shows it until the design has its own. */
  whatsapp?: string;
  slug: string;
  done: boolean[];
  pickup?: boolean;
  /* The store logo he uploaded in setup, shrunk to a small data URL kept in this browser */
  logo?: string;
  /* `quantity`: how many are for sale; left out when the stock is unlimited */
  /* `image`: its cropped picture (a small data URL); `id`: the product it became in the product list */
  /* `description`: the product's description (optional, the same rule as the product editor's) */
  /* `kind`: the product form's kinds (safeOrder PRODUCT_KINDS); `sizes`: clothing and shoes, each size and its stock;
     `shipping`: false when he said it needs no delivery (a digital product or a service never ships) */
  product: { kind: ProductKind; name: string; price: string; quantity?: number; image?: string; description?: string; id?: number; sizes?: SizeStock[]; shipping?: boolean } | null;
  /* `fee`: with his own courier, what a customer pays for delivery per order in JOD (left out or 0: free). Dukkan Ship
     has no fee of his: the price Dukkan's staff set in Diwan is charged */
  /* `cities`: with his own courier, the cities he delivers to (English names of safeOrder KNOWN_CITIES); left out: all */
  shipping: { mode: "own" | "seen"; kind: number; name: string; phone: string; city: string; address: string; fee?: number; cities?: string[] } | null;
  /* The ways to pay he takes (safeOrder savedPays/orderPays). Left out: a store from before he could choose, every way
     Dukkan has on. A new store starts with [] (no orders until he turns one on). */
  pays?: ("cliq" | "cash" | "card")[];
};

const KEY = "seen-setup";
/** The key the setup is kept under (serverSync saveNow sends it on its own) */
export const SETUP_KEY = KEY;

/* The name he signed up with, kept for this browser session by the sign-up page. */
export function accountName(): string {
  try {
    const raw = sessionStorage.getItem("seen-account-profile");
    return raw ? cleanProfile(JSON.parse(raw)).name : "";
  } catch {
    return "";
  }
}

/* The name a store shows while he has not typed one: the designer's own default (designer/panels.tsx). Never his own
   name from signup: that is the account's name, not the store's. */
export const defaultStoreName = (lang: "en" | "ar") => (lang === "ar" ? "متجرك" : "Your store");

/* The phone number he registered with (without +962), kept for this browser session by the sign-up page. */
export function accountPhone(): string {
  try {
    const raw = sessionStorage.getItem("seen-account-profile");
    const fromProfile = raw ? cleanProfile(JSON.parse(raw)).phone : "";
    return fromProfile || savedPhone(sessionStorage.getItem("seen-account-phone") ?? "");
  } catch {
    return "";
  }
}

export function loadSetup(): SavedSetup | null {
  try {
    const raw = localStorage.getItem(KEY);
    /* anything can be written into this browser storage: a wrong or missing field becomes a safe empty one */
    return raw ? cleanSetup(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The setup step's product, as the step fills its fields */
export type SetupProduct = { kind: ProductKind; name: string; price: string; quantity?: number; image?: string | null; description?: string; sizes?: SizeStock[]; shipping?: boolean };

const PRODUCTS_KEY = "seen-products";

/** The product the setup made, as it is now in the product list (it may have sold, or been changed on the Products page
    since), in the step's own shape; null when it is no longer there (deleted, or in the bin): the step then makes a new one */
export function setupProductNow(id: number): (SetupProduct & { id: number }) | null {
  try {
    const x = parseList(localStorage.getItem(PRODUCTS_KEY), cleanProduct).find((it) => it.id === id && !it.deletedAt);
    if (!x) return null;
    const kind = x.kind ?? "standard";
    return {
      id: x.id,
      kind,
      name: x.name,
      price: x.price === null ? "" : String(x.price),
      ...(kindHasSizes(kind) ? { sizes: x.sizes ?? [] } : x.unlimited ? {} : { quantity: x.quantity }),
      ...(kindShips(kind) && !x.shipping ? { shipping: false } : {}),
      image: x.images?.[0] ?? null,
      description: x.description,
    };
  } catch {
    return null;
  }
}

/** Puts the product made in setup into the product list (or updates the one it made before), through the same checks as a
    product saved on the Products page, so it shows in Products and in the store with its picture. Returns its id.
    `opened`: the product as the step showed it when it opened (setupProductNow). Updating, only what he changed in the
    step is written: a field he left as it was keeps the product's own value, so stock sold since or a change made on the
    Products page is never put back (the stock is written only when he edited it here, or changed the kind). */
export function syncSetupProduct(p: SetupProduct, id?: number, opened?: SetupProduct): number | null {
  try {
    const items = parseList(localStorage.getItem(PRODUCTS_KEY), cleanProduct);
    const old = id ? items.find((x) => x.id === id && !x.deletedAt) : undefined;
    const was = old ? opened : undefined;
    const kindChanged = !was || was.kind !== p.kind;
    const stockChanged = kindChanged || JSON.stringify(p.sizes ?? []) !== JSON.stringify(was?.sizes ?? []) || p.quantity !== was?.quantity;
    const shipChanged = kindChanged || (p.shipping !== false) !== (was?.shipping !== false);
    const stock = stockChanged || !old
      ? {
          /* the kind picked in setup, as on the Products page: clothing and shoes keep their sizes (their stock is the sizes',
             cleanProduct adds them up). No quantity in setup means the stock has no limit (said with `unlimited`, never
             with a made-up count) */
          sizes: kindHasSizes(p.kind) ? (p.sizes ?? []) : [],
          quantity: p.quantity ?? old?.quantity ?? 0,
          unlimited: !kindHasSizes(p.kind) && p.quantity === undefined,
        }
      : {};
    const next = cleanProduct({
      ...(old ?? { created: Date.now(), shipping: true }),
      id: old?.id ?? nextProductId(items),
      /* a size chart added on the Products page stays; a kind that is not shipped is never shipped */
      kind: kindChanged || !old ? p.kind : old.kind,
      ...stock,
      ...(shipChanged || !old ? { shipping: kindShips(p.kind) && p.shipping !== false } : {}),
      ...(!was || p.name !== was.name ? { name: p.name } : {}),
      ...(!was || money(p.price) !== money(was.price) ? { price: money(p.price) } : {}),
      /* the description written in setup; none given keeps the one the product has */
      ...(!was || p.description !== was.description ? { description: p.description ?? old?.description ?? "" } : {}),
      ...(!was || (p.image ?? null) !== (was.image ?? null) ? { images: p.image ? [p.image, ...(old?.images ?? []).slice(1)] : (old?.images ?? []).slice(1) } : {}),
    });
    /* the same rules as the Products page: no product is made without a photo, a name or a price */
    if (!next || productProblems(next).length) return null;
    const list: Product[] = old ? items.map((x) => (x.id === old.id ? next : x)) : [...items, next];
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
    return next.id;
  } catch {
    return null;
  }
}

export function saveSetup(setup: SavedSetup) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cleanSetup(setup, setup.done.length) ?? setup));
    window.dispatchEvent(new Event("seen-setup"));
  } catch {
    /* storage unavailable: the home page just won't know his progress */
  }
}
