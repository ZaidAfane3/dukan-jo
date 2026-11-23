"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { merchantCall, onServer } from "./merchantApi";

/* The home page and Reports show a signed-in store's abandoned carts in short: the sums of the list on Marketing >
   Abandoned carts (GET /api/abandoned-carts, server/storeCarts.ts listStoreCarts). */

export type CartSums = {
  /** every abandoned cart in the range, recovered or not */
  count: number;
  /** the share of them an order ended, in percent */
  recovered: number;
  /** the carts still open (no order yet), and the value left in them */
  open: number;
  openValue: number;
  recoveredCarts: number;
  remindersSent: number;
};

/** The signed-in store's abandoned carts for a range (0: last 7 days, 1: last 30 days, 2: this month), read when the
    page opens, when the range changes and when he comes back to the tab. `on`: a signed-in store outside the tour (only
    such a store's carts are kept). sums is null while they load, or when the server did not answer (`failed`). */
export function useCartSums(range: number): { on: boolean; sums: CartSums | null; failed: boolean; reload: () => Promise<void> } {
  const [on, setOn] = useState(false);
  const [sums, setSums] = useState<CartSums | null>(null);
  const [failed, setFailed] = useState(false);
  /* the latest read wins: an older answer (another range) arriving late is dropped */
  const reading = useRef(0);
  const reload = useCallback(async () => {
    if (!onServer()) return;
    const n = ++reading.current;
    const res = await merchantCall(`/api/abandoned-carts?range=${range}`, "GET");
    if (n !== reading.current) return;
    if (res?.status === 200 && res.data.result === "ok") {
      const d = res.data;
      setSums({
        count: Number(d.count) || 0,
        recovered: Number(d.recovered) || 0,
        open: Number(d.open) || 0,
        openValue: Number(d.openValue) || 0,
        recoveredCarts: Number(d.recoveredCarts) || 0,
        remindersSent: Number(d.remindersSent) || 0,
      });
      setFailed(false);
    } else setFailed(true);
  }, [range]);
  useEffect(() => {
    if (!onServer()) return;
    setOn(true);
    void reload();
    const inView = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", inView);
    return () => document.removeEventListener("visibilitychange", inView);
  }, [reload]);
  return { on, sums, failed, reload };
}
