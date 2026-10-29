/* What he has filled in during setup, kept in this browser so the
   home page can greet him by store name and show how far along he is.
   Nothing is sent anywhere, and uploaded files are never stored. */

import { cleanProfile, cleanSetup, savedPhone } from "./safeAccount";
import { cleanProduct, money, parseList, productProblems, type Product } from "./records";

export type SavedSetup = {
  name: string;
  description: string;
  color: string;
  phone: string;
  slug: string;
  done: boolean[];
  pickup?: boolean;
  /* The store logo he uploaded in setup, shrunk to a small data URL kept in this browser */
  logo?: string;
  /* `quantity`: how many are for sale; left out when the stock is unlimited */
  /* `image`: its cropped picture (a small data URL); `id`: the product it became in the product list */
  product: { type: number; name: string; price: string; quantity?: number; image?: string; id?: number } | null;
  shipping: { mode: "own" | "seen"; kind: number; name: string; phone: string; city: string; address: string } | null;
};

const KEY = "seen-setup";

/* The name he signed up with, kept for this browser session by the sign-up page. */
export function accountName(): string {
  try {
    const raw = sessionStorage.getItem("seen-account-profile");
    return raw ? cleanProfile(JSON.parse(raw)).name : "";
  } catch {
    return "";
  }
}

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

/** Puts the product made in setup into the product list (or updates the one it made before), through the same checks as a
    product saved on the Products page, so it shows in Products and in the store with its picture. Returns its id. */
export function syncSetupProduct(p: { name: string; price: string; quantity?: number; image?: string | null }, id?: number): number | null {
  try {
    const KEY_PRODUCTS = "seen-products";
    const items = parseList(localStorage.getItem(KEY_PRODUCTS), cleanProduct);
    const old = id ? items.find((x) => x.id === id && !x.deletedAt) : undefined;
    const next = cleanProduct({
      ...(old ?? { created: Date.now(), shipping: true }),
      id: old?.id ?? items.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      name: p.name,
      price: money(p.price),
      /* no quantity in setup means the stock has no limit (said with `unlimited`, never with a made-up count) */
      quantity: p.quantity ?? old?.quantity ?? 0,
      unlimited: p.quantity === undefined,
      images: p.image ? [p.image, ...(old?.images ?? []).slice(1)] : (old?.images ?? []).slice(1),
    });
    /* the same rules as the Products page: no product is made without a photo, a name or a price */
    if (!next || productProblems(next).length) return null;
    const list: Product[] = old ? items.map((x) => (x.id === old.id ? next : x)) : [...items, next];
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(list));
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
