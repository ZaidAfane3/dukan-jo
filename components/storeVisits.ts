"use client";

import { useCallback, useEffect, useState } from "react";
import { merchantCall, onServer } from "./merchantApi";
import type { VisitKind, VisitStats } from "./visitStats";

/* The merchant's pages read his store's visitor numbers here (components/visitStats.ts has what they mean), and the public
   store tells the server about each page a visitor opens. */

/** The signed-in merchant's visitor numbers, read again every minute while the page is open and in view. null while
    they load, or when there is nothing to read (signed out, the tour, the server not reachable). `on`: the store is a
    signed-in one, so its visitors are counted. */
export function useStoreVisits(): { stats: VisitStats | null; on: boolean; loaded: boolean; reload: () => Promise<void> } {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [on, setOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!onServer()) return;
    const r = await merchantCall("/api/visits", "GET");
    if (r?.status === 200 && r.data.result === "ok" && r.data.stats) setStats(r.data.stats as VisitStats);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!onServer()) return;
    setOn(true);
    void reload();
    const inView = () => document.visibilityState === "visible" && void reload();
    const timer = window.setInterval(inView, 60_000);
    document.addEventListener("visibilitychange", inView);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", inView);
    };
  }, [reload]);
  return { stats, on, loaded, reload };
}

/** Tells Dukkan's server a visitor opened a page of the public store (POST /api/public/store/<slug>/visit). Sent after
    the page has loaded, with sendBeacon when the browser has it (it never holds the page up), else a fetch that may
    outlive the page. Nothing comes back and nothing waits for it. */
export function sendVisit(slug: string, kind: VisitKind, productId?: number | null) {
  try {
    let ref = "";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      /* only the name of the site the visitor came from, never the page; a page of this site counts as direct */
      if (host !== window.location.hostname) ref = host.slice(0, 100);
    }
    const utm = (new URLSearchParams(window.location.search).get("utm_source") ?? "").slice(0, 40);
    const body = JSON.stringify({ kind, ...(productId ? { product: productId } : {}), ...(ref ? { ref } : {}), ...(utm ? { utm } : {}) });
    const url = `/api/public/store/${encodeURIComponent(slug)}/visit`;
    const go = () => {
      const blob = new Blob([body], { type: "text/plain" });
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) return;
      void fetch(url, { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "text/plain" } }).catch(() => {});
    };
    if (document.readyState === "complete") window.setTimeout(go, 0);
    else window.addEventListener("load", () => window.setTimeout(go, 0), { once: true });
  } catch {
    /* a page that can't be counted still works */
  }
}
