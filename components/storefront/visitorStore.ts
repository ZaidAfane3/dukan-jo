"use client";

import { createContext, useContext } from "react";
import type { PublicStoreOpen } from "../publicStore";

/* The public store (app/[slug]): a visitor's browser shows a merchant's store from what Dukkan's server sent
   (server/publicStore.ts), not from this browser's storage. While this is set, the storefront (useStoreData,
   StorefrontTheme, the cart and the newsletter block) reads the store from here, and nothing about the store is
   read from or written to the visitor's own storage: a visitor who has a Dukkan store of their own never sees it
   mixed in, and nothing they do lands in it. The one thing kept there is the visitor's own basket for this store,
   under its own key (visitorBasket.ts). Null everywhere else (the merchant's own pages and the designer). */
export const VisitorStoreContext = createContext<PublicStoreOpen | null>(null);

/** The store sent by the server when the storefront is the public store, else null */
export const useVisitorStore = () => useContext(VisitorStoreContext);

/** The public store: reads the store from Dukkan's server again (after an order, so what just sold out shows as sold
    out). Null everywhere else. */
export const VisitorRefreshContext = createContext<(() => Promise<void>) | null>(null);
export const useVisitorRefresh = () => useContext(VisitorRefreshContext);
