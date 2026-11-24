"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { serverMode } from "./notifications";
import { timeoutSignal } from "./timeoutSignal";

/* The red numbers of the merchant dashboard (server/merchantBadges.ts says what counts): beside Orders, Abandoned carts
   and Customer emails in the side menu, and the bell's (DashboardBar.tsx). Kept on the server per account, so his phone
   and his computer agree. Every page draws its own DashboardBar, so the numbers live here, outside it: a page that opens
   starts from the numbers already known (no badge blinking away and back on every page change). Asked for every minute
   while the page is in view, when it comes back to view, and on every page change; opening a page clears its number.
   Only a signed-in merchant, never in the tour (serverMode). */

export type MerchantBadgeTab = "orders" | "carts" | "signups";
type State = { counts: Partial<Record<MerchantBadgeTab, number>>; bellSeen: number | null };

/** The page that clears each number when opened */
export const BADGE_PAGE: Record<MerchantBadgeTab, string> = {
  orders: "/orders",
  carts: "/marketing/abandoned-carts",
  signups: "/marketing/emails",
};
/** The number a page clears when opened, if it has one */
export const tabOf = (path: string | null) => (Object.keys(BADGE_PAGE) as MerchantBadgeTab[]).find((t) => BADGE_PAGE[t] === path) ?? null;
/** The number for a page of the menu (0 for a page without one) */
export const countFor = (counts: State["counts"], href: string | null | undefined) => {
  const t = tabOf(href ?? null);
  return (t && counts[t]) || 0;
};

const URL = "/api/badges";
const EVENT = "dukkan-badges";
const EVERY_MS = 60_000;
let state: State = { counts: {}, bellSeen: null };
/* each ask gets a number, and only the latest one's answer is used: a slow answer from before a page was opened can't
   bring back the number it just cleared */
let asked = 0;
/* signed out (401): no more asking until the page changes or comes back to view */
let stopped = false;

function set(next: State) {
  state = next;
  window.dispatchEvent(new Event(EVENT));
}

function take(n: number, j: unknown) {
  const r = j as { counts?: Record<string, unknown>; bellSeen?: unknown } | null;
  if (n !== asked || !r?.counts) return;
  const counts: State["counts"] = {};
  for (const t of Object.keys(BADGE_PAGE) as MerchantBadgeTab[]) counts[t] = Math.max(0, Number(r.counts[t]) || 0);
  /* the bell's moment only moves forward here too (an older answer racing a newer "seen") */
  set({ counts, bellSeen: Math.max(state.bellSeen ?? 0, Number(r.bellSeen) || 0) });
}

async function call(method: "GET" | "POST", body?: unknown) {
  const n = ++asked;
  try {
    const r = await fetch(URL, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: timeoutSignal(15_000),
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 401) stopped = true;
    take(n, r.ok ? await r.json().catch(() => null) : null);
  } catch {
    /* no connection: the numbers stay as they were until the next ask */
  }
}

/** Asks the server for the numbers (nothing in the tour, signed out, or while the page is hidden) */
export function loadBadges() {
  if (!serverMode() || stopped || document.visibilityState === "hidden") return;
  void call("GET");
}

/** He opened this page: its number goes at once, and the server starts it again from now */
export function badgeSeen(tab: MerchantBadgeTab) {
  if (!serverMode()) return;
  stopped = false;
  set({ ...state, counts: { ...state.counts, [tab]: 0 } });
  void call("POST", { tab });
}

/** His bell's open panel showed the notifications up to `at` (the newest one's server time, ms) */
export function bellSeen(at: number) {
  if (!serverMode() || !(at > (state.bellSeen ?? 0))) return;
  set({ ...state, bellSeen: at });
  void call("POST", { tab: "bell", at });
}

/** The numbers, for the menu and the bell (the bar asks once for both). `path`: the page on screen; opening a page that has a number clears it,
    any other page just asks for the numbers again. */
export function useMerchantBadges(path: string | null) {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    const sync = () => setS(state);
    sync();
    window.addEventListener(EVENT, sync);
    const back = () => {
      if (document.visibilityState !== "visible") return;
      stopped = false;
      loadBadges();
    };
    const timer = window.setInterval(loadBadges, EVERY_MS);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);
  /* a layout effect, so the "seen" leaves before the page's own list is asked for (the page's effects run after this
     one): what arrives while the page loads is shown in the list and counted as new, never lost between the two */
  const here = tabOf(path);
  useLayoutEffect(() => {
    stopped = false;
    if (here) badgeSeen(here);
    else loadBadges();
  }, [path, here]);
  const seen = useCallback((tab: MerchantBadgeTab) => badgeSeen(tab), []);
  return { counts: s.counts, bellSeen: s.bellSeen, seen };
}
