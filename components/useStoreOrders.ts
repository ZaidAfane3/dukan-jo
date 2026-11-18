"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoActive } from "./demoSandbox";
import { serverMode } from "./notifications";
import { cleanOrder, cleanProduct, parseList, type Product } from "./records";
import type { CountedOrder } from "./storeNumbers";

/* The orders and products the merchant's numbers are worked out from (the home page and Reports, storeNumbers.ts): the
   orders kept in his browser ("seen-orders": added by hand, or from his own store preview) and, for a signed-in store,
   the orders customers placed on his public store, kept on Dukkan's server (GET /api/orders, the same list the Orders
   page shows). Without the server's ones the home page and Reports showed 0 orders while the Orders page had them. */

/** A store order as the Orders page and the numbers read it: serverId is its id on the server, payment "test" means it
    was placed while payment is not open (nothing was charged). */
export type StoreOrderRow = CountedOrder & { serverId?: string };

/** The server's answer, checked like the orders read from storage (cleanOrder). Every one is a store order (channel 1). */
export function serverRows(list: unknown): StoreOrderRow[] {
  if (!Array.isArray(list)) return [];
  const out: StoreOrderRow[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const o = cleanOrder(r);
    if (o && typeof r.serverId === "string" && /^\d+$/.test(r.serverId)) out.push({ ...o, channel: 1, serverId: r.serverId, payment: r.payment === "unpaid" ? "unpaid" : "test" });
  }
  return out;
}

/* The numbers need every store order, a page of 100 at a time; past this many pages (10,000 orders) the oldest are left
   out rather than holding the page up */
const MAX_PAGES = 100;

/** Every store order of the signed-in merchant, newest first. Throws when the server can't be reached or says no. */
async function fetchStoreOrders(signal: AbortSignal): Promise<StoreOrderRow[]> {
  const all: StoreOrderRow[] = [];
  let url = "/api/orders";
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
    if (!r.ok) throw new Error(`orders ${r.status}`);
    const j = (await r.json()) as { orders?: unknown; next?: unknown };
    all.push(...serverRows(j.orders));
    if (typeof j.next !== "string") break;
    url = `/api/orders?before=${encodeURIComponent(j.next)}`;
  }
  return all;
}

function readLocal(): { orders: CountedOrder[]; products: Product[] } {
  try {
    return { orders: parseList(localStorage.getItem("seen-orders"), cleanOrder), products: parseList(localStorage.getItem("seen-products"), cleanProduct) };
  } catch {
    /* storage blocked: nothing to count */
    return { orders: [], products: [] };
  }
}

export type StoreOrders = {
  /** His browser's orders and the store's orders together */
  orders: StoreOrderRow[];
  products: Product[];
  /** "loading" until the first answer (the server's, for a signed-in store), "failed" when that first answer did not
      come (a later check that fails keeps the numbers it has: "ready") */
  state: "loading" | "ready" | "failed";
  /** When the numbers were last read */
  at: Date | null;
  /** Reads both again (a refresh button, "Try again"); resolves once the answer is in */
  reload: () => Promise<void>;
};

/** The orders and products a real store's numbers come from: read when the page opens, every minute while it is in
    view, when he comes back to the tab, and when another tab changes them. Does nothing in the platform tour (its pages
    show their made-up numbers). */
export function useStoreOrders(): StoreOrders {
  const [local, setLocal] = useState<{ orders: CountedOrder[]; products: Product[] }>({ orders: [], products: [] });
  const [server, setServer] = useState<StoreOrderRow[]>([]);
  const [state, setState] = useState<StoreOrders["state"]>("loading");
  const [at, setAt] = useState<Date | null>(null);
  /* the check on its way: one at a time, aborted when the page closes or a reload starts a new one */
  const live = useRef<AbortController | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async (fresh: boolean) => {
    if (demoActive()) return;
    setLocal(readLocal());
    if (!serverMode()) {
      loaded.current = true;
      setState("ready");
      setAt(new Date());
      return;
    }
    if (live.current && !fresh) return;
    live.current?.abort();
    const req = new AbortController();
    live.current = req;
    try {
      const rows = await fetchStoreOrders(req.signal);
      if (live.current !== req) return;
      setServer(rows);
      loaded.current = true;
      setState("ready");
      setAt(new Date());
    } catch {
      /* offline, refused or aborted: the numbers keep what they have; with none yet, the page offers "Try again" */
      if (live.current === req && !loaded.current) setState("failed");
    } finally {
      if (live.current === req) live.current = null;
    }
  }, []);

  useEffect(() => {
    if (demoActive()) return;
    void load(false);
    const inView = () => document.visibilityState === "visible" && void load(false);
    const timer = window.setInterval(inView, 60_000);
    document.addEventListener("visibilitychange", inView);
    /* an order or product changed in another tab (a new order from his store preview, a cost price added) */
    const onStorage = (e: StorageEvent) => (e.key === "seen-orders" || e.key === "seen-products") && setLocal(readLocal());
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", inView);
      window.removeEventListener("storage", onStorage);
      live.current?.abort();
      live.current = null;
    };
  }, [load]);

  const reload = useCallback(async () => {
    if (!loaded.current) setState("loading");
    await load(true);
  }, [load]);

  const orders = useMemo<StoreOrderRow[]>(() => [...local.orders, ...server], [local.orders, server]);
  return { orders, products: local.products, state, at, reload };
}
