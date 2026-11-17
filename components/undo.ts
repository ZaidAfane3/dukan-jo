/* Undo for the merchant's own changes (a product deleted, a coupon added, a page removed…). A page offers an undo right
   after the change; <UndoToast /> (mounted once by the dashboard bar) shows it with an "Undo" button for a few seconds,
   and Ctrl+Z (Cmd+Z on a Mac) runs it while it shows and for a while after.

   - The last few changes are kept (UNDO_KEEP), each one for UNDO_FOR after it was made, so Ctrl+Z can go back step by step.
   - An undo goes through the same save as the change itself (the page's own list, saved like any edit).
   - An undo never overwrites something that changed since: it answers false and the merchant is told so.
   - A page drops its undos when it closes (dropUndos), since only it can put its list back. */

import { useSyncExternalStore } from "react";
import type { Lang } from "./content";

export type UndoOffer = {
  /** what was done, in his language ("3 products moved to Deleted products") */
  label: (lang: Lang) => string;
  /** puts things back; false when it can't, because what it would put back changed since */
  undo: () => boolean | void | Promise<boolean | void>;
  /** the page that made it, to drop its undos when that page closes */
  scope: string;
};

type Entry = UndoOffer & { id: number; at: number };
export type UndoNote = { id: number; kind: "undone" | "changed" };
type State = { toast: Entry | null; note: UndoNote | null };

/** how long the toast shows (the ring fills up in this time) */
export const UNDO_TOAST_MS = 6000;
/** how long Ctrl+Z can still undo a change after it was made */
export const UNDO_FOR = 30_000;
/** how many changes back Ctrl+Z can go */
const UNDO_KEEP = 5;

let stack: Entry[] = [];
let state: State = { toast: null, note: null };
let seq = 0;
let running = false;
const listeners = new Set<() => void>();

const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
const fresh = () => {
  const now = Date.now();
  stack = stack.filter((e) => now - e.at < UNDO_FOR);
  return stack;
};

/** Offers to undo a change just made. A new one takes the toast's place; the earlier ones can still be undone with Ctrl+Z. */
export function offerUndo(o: UndoOffer): void {
  const e: Entry = { ...o, id: ++seq, at: Date.now() };
  stack = [...fresh(), e].slice(-UNDO_KEEP);
  emit({ toast: e, note: null });
}

/** Undoes the newest change still kept (or the one with this id). */
export async function runUndo(id?: number): Promise<boolean> {
  if (running) return false;
  const list = fresh();
  const e = id === undefined ? list[list.length - 1] : list.find((x) => x.id === id);
  if (!e) return false;
  running = true;
  stack = stack.filter((x) => x.id !== e.id);
  let ok = false;
  try {
    ok = (await e.undo()) !== false;
  } catch {
    ok = false;
  } finally {
    running = false;
  }
  /* a change it could not undo can't be undone later either */
  emit({ toast: null, note: { id: ++seq, kind: ok ? "undone" : "changed" } });
  return ok;
}

/** Hides the toast; the change can still be undone with Ctrl+Z for a while. */
export function hideUndo(id?: number): void {
  if (!state.toast || (id !== undefined && state.toast.id !== id)) return;
  emit({ toast: null });
}

export function hideUndoNote(id: number): void {
  if (state.note?.id === id) emit({ note: null });
}

/** Whether Ctrl+Z has something to undo right now */
export const canUndo = () => fresh().length > 0;

/** A page that closes drops its undos (and its toast): only that page could put its list back. */
export function dropUndos(scope: string): void {
  stack = stack.filter((e) => e.scope !== scope);
  if (state.toast?.scope === scope) emit({ toast: null });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const empty: State = { toast: null, note: null };
export const useUndo = (): State => useSyncExternalStore(subscribe, () => state, () => empty);

/* ---------------- lists ---------------- */

/** A value written the same way whatever the order of its keys, to tell whether a saved item changed */
export const sameJson = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));

/** The undo of a change to a list kept by a page: every item the change added, removed or changed goes back to how it
    was in `before`, and every other item stays as it is now. It does nothing (and answers false) when one of those items
    changed since (`now()` no longer has it as `after` left it). `put` saves the list the way the page saves any change. */
export function listUndo<T, K extends string | number>(o: { before: T[]; after: T[]; key: (x: T) => K; now: () => T[]; put: (list: T[]) => void }): () => boolean {
  const { before, after, key } = o;
  const was = new Map(before.map((x) => [key(x), x] as const));
  const became = new Map(after.map((x) => [key(x), x] as const));
  const touched = [...new Set([...was.keys(), ...became.keys()])].filter((k) => {
    const a = was.get(k);
    const b = became.get(k);
    return !a || !b || sameJson(a) !== sameJson(b);
  });
  return () => {
    const cur = o.now();
    const curBy = new Map(cur.map((x) => [key(x), x] as const));
    for (const k of touched) {
      const c = curBy.get(k);
      const b = became.get(k);
      if (!c !== !b || (c && b && sameJson(c) !== sameJson(b))) return false;
    }
    const gone = new Set(touched.filter((k) => !was.has(k)));
    let next = cur.filter((x) => !gone.has(key(x))).map((x) => (touched.includes(key(x)) && was.has(key(x)) ? (was.get(key(x)) as T) : x));
    /* the ones the change took out come back where they were */
    before.forEach((x, i) => {
      const k = key(x);
      if (touched.includes(k) && !curBy.has(k)) next = [...next.slice(0, i), x, ...next.slice(i)];
    });
    o.put(next);
    return true;
  };
}

/** The undo of a saved value (a settings form, a switch): `put` saves `before` again the way the page saves it, unless
    the value changed since (`now()` is no longer `after`). Null when the save changed nothing (no undo is offered). */
export function valueUndo<T>(o: { before: T; after: T; now: () => T; put: (v: T) => void | boolean }): (() => boolean) | null {
  const after = sameJson(o.after);
  if (sameJson(o.before) === after) return null;
  return () => {
    if (sameJson(o.now()) !== after) return false;
    return o.put(o.before) !== false;
  };
}

/** What this browser's storage holds under each key (null: nothing), for storageUndo */
export function snapshot(keys: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of keys) {
    try {
      out[k] = localStorage.getItem(k);
    } catch {
      out[k] = null;
    }
  }
  return out;
}

/** The undo of a change a page saved straight into this browser's storage (several keys at once, as My themes does): every
    key goes back to what it held `before`, unless one of them changed since the change (`after`). `then` lets the page
    show it again. Null when the change wrote nothing. */
export function storageUndo(before: Record<string, string | null>, after: Record<string, string | null>, then?: () => void): (() => boolean) | null {
  const keys = Object.keys(before);
  if (keys.every((k) => before[k] === after[k])) return null;
  return () => {
    const now = snapshot(keys);
    if (keys.some((k) => now[k] !== after[k])) return false;
    try {
      for (const k of keys) {
        if (before[k] === after[k]) continue;
        const v = before[k];
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      }
    } catch {
      return false;
    }
    then?.();
    return true;
  };
}

/* ---------------- words ---------------- */

/** Arabic counted noun: 1 «منتج واحد», 2 «منتجان», 3–10 «3 منتجات», 11 and more «11 منتجًا» */
export function arCount(n: number, w: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} ${w.few}`;
  return `${n} ${w.many}`;
}
