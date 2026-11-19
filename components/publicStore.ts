/* What anyone may see of a store at its address (Dukkan's address followed by its link name, served by app/[slug]).
   server/publicStore.ts reads it from the merchant's saved data and sends only these parts; the storefront in the
   visitor's browser shows them (components/storefront/visitorStore.ts) and never reads or writes the visitor's own
   storage for them. Plain types only, so the server and the browser share them. */

/** The parts of the store's setup a visitor sees: its name, words, colour, logo, contact numbers it shows, and how it
    delivers. Never the courier's phone, the pickup address, the setup steps or anything about the account. */
export type PublicSetup = {
  name: string;
  description: string;
  color: string;
  /* the store's contact phone, shown in the store's footer ("" for none) */
  phone: string;
  /* left out until the setup step was answered, like the saved setup ("" then means no WhatsApp) */
  whatsapp?: string;
  slug: string;
  logo: string;
  pickup: boolean;
  /* only how the store delivers and, with its own courier, its fee per order and the cities it delivers to (left out: all) */
  shipping: { mode: "own" | "seen"; fee?: number; cities?: string[] } | null;
  /* the ways to pay the merchant chose (left out: an older store, every way Dukkan has on) */
  pays?: ("cliq" | "cash" | "card")[];
};

/** An open store: what its storefront needs to draw itself */
export type PublicStoreOpen = {
  status: "open";
  setup: PublicSetup;
  /* the store's own saved design, checked; null when it never saved one (then `template` is used) */
  design: unknown;
  /* Dukkan's starter design, only sent when the store has no design of its own; null for the original one in the code */
  template: unknown;
  /* the products customers can see (not in the bin, not hidden), with only the parts the storefront shows */
  products: Record<string, unknown>[];
  /* the store's published pages, checked; null when it never saved its pages (then it has the starting ones) */
  pages: unknown[] | null;
  freeDelivery: { on: boolean; min: number };
};

/** What a store's address shows: the store, its "back soon" page, a store that is not open yet, or one Dukkan suspended */
export type PublicStore =
  | PublicStoreOpen
  | { status: "paused"; name: string; logo: string; color: string; message: { en: string; ar: string } }
  | { status: "soon"; name: string }
  | { status: "unavailable" };

/** The parts of a saved product a visitor's storefront reads (useStoreData.ts toStoreProduct). Anything else saved with
    a product (its cost, notes for himself, dates, the bin) never leaves the server. `kind` and `shipping` tell the cart
    whether it is delivered to an address (safeOrder productShips). */
export const PUBLIC_PRODUCT_FIELDS = [
  "id", "name", "category", "categories", "price", "sale", "featured", "quantity", "unlimited", "kind", "shipping", "sizes", "sizeChart",
  "images", "notes", "badge", "description", "brand", "focus",
] as const;
