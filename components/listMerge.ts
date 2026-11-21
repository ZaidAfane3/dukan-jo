/* The store's lists that two devices (or a device and the public store) can both change: kept item by item, never as
   one piece. Each device remembers, per list, a short mark (hash) of every item as the server had it when its copy was
   taken (its "base"). When its save finds the server's list changed since (serverSync.ts, app/api/store "stale"), the
   three are merged by item id:

   - an item only one side changed takes that side's version; both changed it: the one saved now wins, for that item only;
   - an item only one side added is kept (both added one with the same id but not the same: both are kept, this one gets
     a new id; unless both were made at the same moment: that is this side's own addition saved before, kept once);
   - an item one side deleted and the other did not touch is deleted;
   - one side deleted it and the other changed it: in a list with a bin (products), the delete wins but the item goes
     to the bin with the change in it, so one click brings it back; in a list without one, the changed item is kept
     (losing an edit is worse than keeping an item).

   O(n) by id: one pass over each list, Maps, one hash of each item. No React and no browser APIs. */

/** The lists merged item by item; any other key is saved whole, the last save winning */
export const LIST_KEYS = new Set([
  "seen-products",
  "seen-orders",
  "seen-coupons",
  "seen-pages",
  "seen-reminders",
  "seen-repurchase",
  "seen-categories",
  "seen-orders-deleted",
  "seen-subscribers",
]);

/** Keys that are not lists but carry a version too (the setup, the design, the pause, the themes): a change of one left
    waiting in the browser's outbox names the version it was made from when it is sent later, and the server does not
    keep it when another device saved the key since (app/api/store "stale"; the browser then takes the server's copy) */
export const VERSION_KEYS = new Set(["seen-setup", "seen-storefront", "seen-maintenance", "seen-themes"]);

/* lists whose deleted items go to a bin first (a "deletedAt" date), from which they can be put back */
const BIN_KEYS = new Set(["seen-products"]);

/** id of a list item -> mark of the item, as the server had the list */
export type ItemMarks = Record<string, number>;

/* An item's id: its id (or an email or a code for lists keyed by those), or the item itself for a list of names */
function itemId(x: unknown): string | null {
  if (typeof x === "string" || typeof x === "number") return `v:${x}`;
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const id = o.id ?? o.email ?? o.code;
  return typeof id === "string" || typeof id === "number" ? `i:${id}` : null;
}

/* FNV-1a over the item's text: enough to tell whether an item changed */
function mark(x: unknown): number {
  const s = JSON.stringify(x) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* id -> item, or null when an item has no id or two share one (such a list is saved whole) */
function byId(list: unknown[]): Map<string, unknown> | null {
  const m = new Map<string, unknown>();
  for (const x of list) {
    const id = itemId(x);
    if (id === null || m.has(id)) return null;
    m.set(id, x);
  }
  return m;
}

const asList = (text: string | null | undefined): unknown[] | null => {
  if (typeof text !== "string") return null;
  try {
    const v = JSON.parse(text) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};

/** The marks of a saved list's items (null: not a list that can be merged) */
export function listMarks(text: string | null | undefined): ItemMarks | null {
  const list = asList(text);
  const m = list && byId(list);
  if (!m) return null;
  const out: ItemMarks = {};
  m.forEach((x, id) => (out[id] = mark(x)));
  return out;
}

const withDeleted = (x: unknown, at: number): unknown => {
  const o = x as Record<string, unknown>;
  return o && typeof o === "object" && !o.deletedAt ? { ...o, deletedAt: at } : x;
};

/* both sides changed it: the change saved now wins, but a delete (into the bin) wins over an edit, carrying the edit */
function bothChanged(mine: unknown, theirs: unknown, bin: boolean): unknown {
  if (!bin) return mine;
  const m = mine as Record<string, unknown>;
  const t = theirs as Record<string, unknown>;
  if (m?.deletedAt && !t?.deletedAt) return { ...t, deletedAt: m.deletedAt };
  if (t?.deletedAt && !m?.deletedAt) return { ...m, deletedAt: t.deletedAt };
  return mine;
}

/* Two items with the same id made at the same moment (their "created" time, to the millisecond): one item, saved twice.
   Ids count up, so two devices can each add a different item under the same id, but not at the same millisecond. */
function sameMaking(a: unknown, b: unknown): boolean {
  const x = (a as Record<string, unknown> | null)?.created;
  return typeof x === "number" && x === (b as Record<string, unknown> | null)?.created;
}

/* the biggest number id in the lists (worked out once, only when two new items share an id) */
function topId(lists: Map<string, unknown>[]): number {
  let top = 0;
  for (const m of lists)
    m.forEach((v) => {
      const n = (v as Record<string, unknown>)?.id;
      if (typeof n === "number" && n > top) top = n;
    });
  return top;
}

/** This device's list (`mine`) merged with the server's (`theirs`), both changed since `base`. The text to save, or null
    when the lists can't be merged item by item (then this device's list is saved whole, as before). */
export function mergeList(key: string, base: ItemMarks, mineText: string, theirsText: string | null, now = Date.now()): string | null {
  const mineList = asList(mineText);
  const theirsList = theirsText === null ? [] : asList(theirsText);
  const mine = mineList && byId(mineList);
  const theirs = theirsList && byId(theirsList);
  if (!mineList || !mine || !theirs) return null;
  const bin = BIN_KEYS.has(key);
  const out: unknown[] = [];
  let top: number | null = null;
  /* both sides added an item with the same id, not the same item: both are kept, this side's under a new id */
  const renamed = (x: unknown): unknown => {
    const o = x as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    if (typeof o.id === "number") {
      top = (top ?? topId([mine, theirs])) + 1;
      return { ...o, id: top };
    }
    if (typeof o.id === "string") return { ...o, id: `${o.id}-${Math.random().toString(36).slice(2, 7)}` };
    return null;
  };
  for (const [id, m] of mine) {
    const b = base[id];
    if (theirs.has(id)) {
      const t = theirs.get(id);
      const mh = mark(m);
      const th = mark(t);
      if (b === undefined) {
        /* this side's own earlier addition, which reached the server though its reply was lost (and maybe was edited
           since, or had its pictures made files there): the same item, not a second one. Merged as one both sides
           changed: this side's newer copy, but a delete into the bin carries the other side's edit */
        if (mh === th || sameMaking(m, t)) out.push(bothChanged(m, t, bin));
        else {
          out.push(t);
          const again = renamed(m);
          if (again) out.push(again);
        }
      } else if (mh === b) out.push(t);
      else if (th === b) out.push(m);
      else out.push(bothChanged(m, t, bin));
    } else if (b === undefined) out.push(m);
    /* they deleted it: gone, unless this side changed it */
    else if (mark(m) !== b) out.push(bin ? withDeleted(m, now) : m);
  }
  for (const [id, t] of theirs) {
    if (mine.has(id)) continue;
    const b = base[id];
    if (b === undefined) out.push(t);
    /* this side deleted it: gone, unless they changed it */
    else if (mark(t) !== b) out.push(bin ? withDeleted(t, now) : t);
  }
  return JSON.stringify(out);
}
