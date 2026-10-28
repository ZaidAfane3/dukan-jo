/* The "free delivery above ..." offer from the Marketing menu. When it is on, an order whose total
   reaches the amount gets free delivery by itself. Kept in this browser like the rest of the store.

   OPEN QUESTION: this feature is not finished and needs studying with merchants before we build
   more (see docs/open-questions.md). */

import { money } from "./records";

export type FreeDelivery = { on: boolean; min: number };

const KEY = "seen-freedelivery";

export function loadFreeDelivery(): FreeDelivery {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<FreeDelivery>) : {};
    const min = money(v.min);
    return { on: v.on === true, min: min !== null && min > 0 ? min : 25 };
  } catch {
    return { on: false, min: 25 };
  }
}

export function saveFreeDelivery(v: FreeDelivery): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
