"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

/* The designer tells the preview which part of the store the open settings change, so the preview brings it into view and
   outlines it (and the store draws a dashed place for it while it is empty or hidden). Every open settings screen or part adds
   itself while it is open: the newest one is shown, and when it closes the one under it shows again.

   key: "identity", "nav", "search", "sidebar", "announcement", "cards", "footer", "footer:contact", "footer:phone"...
   or "sec:<section id>" and "sec:<section id>:<field>" for a block of the page and one of its texts.
   ring: false when the preview already outlines it (a block of the page being edited): it is only brought into view. */
export type Spot = { key: string; label: string; ring?: boolean };

let stack: { id: string; spot: Spot }[] = [];
let now: Spot[] = [];
const listeners = new Set<() => void>();

function publish() {
  const next = stack.map((e) => e.spot).reverse();
  if (next.length === now.length && next.every((s, i) => s.key === now[i].key && s.label === now[i].label && s.ring === now[i].ring)) return;
  now = next;
  listeners.forEach((f) => f());
}

export function spotOn(id: string, spot: Spot) {
  const was = stack.findIndex((e) => e.id === id);
  if (was >= 0 && stack[was].spot.key === spot.key && stack[was].spot.label === spot.label) return;
  stack = [...stack.filter((e) => e.id !== id), { id, spot }];
  publish();
}

export function spotOff(id: string) {
  if (!stack.some((e) => e.id === id)) return;
  stack = stack.filter((e) => e.id !== id);
  publish();
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};
const none: Spot[] = [];

/** What the open settings point at, newest first (empty: nothing) */
export function useSpots(): Spot[] {
  return useSyncExternalStore(subscribe, () => now, () => none);
}

/** While `spot` is given, the preview points at it */
export function useSpotWhile(spot: Spot | null | undefined) {
  const id = useId();
  const key = spot?.key;
  const label = spot?.label;
  const ring = spot?.ring;
  useEffect(() => {
    if (key) spotOn(id, { key, label: label ?? "", ring });
    else spotOff(id);
  }, [id, key, label, ring]);
  useEffect(() => () => spotOff(id), [id]);
}
