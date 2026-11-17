/* What the dashboard search (GlobalSearch.tsx) looks through besides the dashboard's own pages: the orders and products
   kept in this browser, the orders customers placed on his public store (from the server), his info pages and his
   coupons. Everything kept in this browser is read at once; the store orders arrive later, so their state is kept here
   for the whole visit (one list per account) and the search shows "Searching…" until they are in. */

import { useSyncExternalStore } from "react";
import { signedInAs } from "./demoSandbox";
import { serverMode } from "./notifications";
import { publicSettings } from "./platformPublic";
import { cleanCoupon, cleanOrder, parseList, type Coupon, type Order } from "./records";

type Bi = { en: string; ar: string };

/* ---------------------------------------------------------------- the store's orders (server) */

/** off: there are none to fetch (the tour, or signed out); loading: the first list is on its way; ready: in (a later
    refresh keeps it while it runs); failed: the first list could not be fetched */
export type SourceStatus = "off" | "loading" | "ready" | "failed";

type StoreOrders = {
  account: string | null;
  status: SourceStatus;
  orders: Order[];
  /* older orders exist than those fetched: a number not among them is asked for on its own */
  more: boolean;
  at: number;
  /* orders asked for by their number: the order, none, still on its way, or the question failed */
  numbers: Record<string, Order | "none" | "loading" | "failed">;
};

/* The newest pages are enough for the names; a number older than them is asked for by itself (findStoreOrder) */
const PAGES = 5;
/* a list younger than this is used as it is; an older one is shown while a new one is fetched */
const FRESH_MS = 30_000;

const empty = (account: string | null, status: SourceStatus): StoreOrders => ({ account, status, orders: [], more: false, at: 0, numbers: {} });
let state: StoreOrders = empty(null, "off");
let running: string | null = null;
const listeners = new Set<() => void>();

const set = (next: StoreOrders) => {
  state = next;
  listeners.forEach((f) => f());
};

/* The list belongs to the account it was fetched for: another account (or the tour) starts again */
function current(): StoreOrders {
  if (!serverMode()) return state.status === "off" && state.account === null ? state : empty(null, "off");
  const account = signedInAs();
  return state.account === account ? state : empty(account, "loading");
}

function rows(list: unknown): Order[] {
  if (!Array.isArray(list)) return [];
  const out: Order[] = [];
  for (const x of list) {
    const o = x && typeof x === "object" ? cleanOrder(x as Record<string, unknown>) : null;
    if (o) out.push({ ...o, channel: 1 });
  }
  return out;
}

/** Fetches the store's orders when the search opens: at once the first time, again in the background when the list
    is older than half a minute. Does nothing in the tour or signed out, and never runs twice at once. */
export function loadStoreOrders(): void {
  const s = current();
  if (s !== state) set(s);
  if (s.status === "off") return;
  const account = s.account;
  if (running === account) return;
  if (s.status === "ready" && Date.now() - s.at < FRESH_MS) return;
  const background = s.status === "ready";
  if (s.status === "failed") set({ ...s, status: "loading" });
  running = account;
  void (async () => {
    let url = "/api/orders";
    const got: Order[] = [];
    let more = false;
    try {
      for (let page = 0; page < PAGES; page++) {
        const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { orders?: unknown; next?: unknown };
        if (state.account !== account) return;
        got.push(...rows(j.orders));
        more = typeof j.next === "string";
        /* the newest page is shown as soon as it is in; the older ones join it */
        if (page === 0 || !more) set({ ...state, status: "ready", orders: got.slice(), more, at: Date.now() });
        if (!more) break;
        url = `/api/orders?before=${encodeURIComponent(j.next as string)}`;
      }
      if (state.account === account) set({ ...state, status: "ready", orders: got.slice(), more, at: Date.now() });
    } catch {
      if (state.account !== account) return;
      /* what was already in stays (an older list, or the first pages of this one) */
      if (got.length) set({ ...state, status: "ready", orders: got.slice(), more: true, at: Date.now() });
      else if (!background) set({ ...state, status: "failed" });
    } finally {
      if (running === account) running = null;
    }
  })();
}

/** An order number older than the pages fetched is asked for by itself (once per number per visit) */
export function findStoreOrder(number: string): void {
  const s = state;
  if (s.status !== "ready" || !s.more || !/^\d{1,12}$/.test(number)) return;
  if (s.numbers[number] !== undefined && s.numbers[number] !== "failed") return;
  if (s.orders.some((o) => String(o.id) === number)) return;
  const account = s.account;
  set({ ...s, numbers: { ...s.numbers, [number]: "loading" } });
  void fetch(`/api/orders?number=${encodeURIComponent(number)}`, { credentials: "same-origin", cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const found = rows(((await r.json()) as { orders?: unknown }).orders)[0];
      if (state.account === account) set({ ...state, numbers: { ...state.numbers, [number]: found ?? "none" } });
    })
    .catch(() => {
      if (state.account === account) set({ ...state, numbers: { ...state.numbers, [number]: "failed" } });
    });
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
const offState = empty(null, "off");

/** The store's orders as the search sees them now */
export function useStoreOrders(): StoreOrders {
  return useSyncExternalStore(subscribe, () => state, () => offState);
}

/* ---------------------------------------------------------------- kept in this browser */

/** His info pages, as the Info pages dashboard (InfoPages.tsx) keeps them; before he saved any, the three every store
    starts with (the same ids, 1 to 3, the Info pages dashboard gives them). Only the text the search needs is taken. */
export type SearchPage = { id: number; type: 0 | 1 | 2; published: boolean; title: Bi; content: Bi };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const bi = (v: unknown, max: number): Bi => {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return { en: text(o.en, max), ar: text(o.ar, max) };
};
/* The pages a ready theme brings (9100 to 9299) belong to the theme, not to his list (as in InfoPages.tsx) */
const themePage = (id: number) => id >= 9100 && id < 9300;

export function readInfoPages(): SearchPage[] {
  try {
    const raw = localStorage.getItem("seen-pages");
    if (raw !== null) {
      const list: unknown = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.slice(0, 200).flatMap((x): SearchPage[] => {
        if (!x || typeof x !== "object") return [];
        const p = x as Record<string, unknown>;
        if (typeof p.id !== "number" || !Number.isInteger(p.id) || themePage(p.id)) return [];
        const type = p.type === 1 || p.type === 2 ? p.type : 0;
        return [{ id: p.id, type, published: p.published !== false, title: bi(p.title, 200), content: bi(p.content, 20000) }];
      });
    }
  } catch {
    return [];
  }
  const t = publicSettings().store_legal_templates;
  return [
    { id: 1, type: 1, published: true, title: { ...t.returns.title }, content: { ...t.returns.body } },
    { id: 2, type: 2, published: true, title: { ...t.terms.title }, content: { ...t.terms.body } },
    { id: 3, type: 2, published: true, title: { ...t.privacy.title }, content: { ...t.privacy.body } },
  ];
}

/* The sample coupons an older version loaded are not his (as in Coupons.tsx) */
const OLD_SAMPLES = new Set(["s1", "s2", "s3", "s4"]);

/** His coupons, as the Coupons page (Coupons.tsx) keeps them */
export function readCoupons(): Coupon[] {
  try {
    return parseList(localStorage.getItem("seen-coupons") ?? sessionStorage.getItem("seen-coupons"), cleanCoupon).filter((c) => !OLD_SAMPLES.has(c.id));
  } catch {
    return [];
  }
}
