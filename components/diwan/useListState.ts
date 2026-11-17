"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* A Diwan list's search, filters, tab and sort, kept in the page's address (?q=...&status=...), so Back from a store or
   a ticket brings the list back exactly as it was, and a filtered list can be linked. Only the keys a page names are
   touched: the others (?shop=, ?ticket=, a #doc- jump) stay as they are.

   - The address is rewritten in place (no new history entry, no page load) a moment after the last change, so typing
     doesn't add an entry per key.
   - Values read from the address are checked: anything not allowed is the field's default.
   - A value equal to its default is left out of the address, so the plain page address still means "as it starts". */

export type ListField = { def: string; clean: (raw: string) => string | null };

/** A choice from a fixed list (the first one, or `def`, when nothing or something unknown is given) */
export const oneOf = <T extends string>(values: readonly T[], def: T = values[0]): ListField => ({
  def,
  clean: (raw) => ((values as readonly string[]).includes(raw) ? raw : null),
});
/** A typed search: control characters dropped, cut at `max` */
export const typedText = (max = 100): ListField => ({ def: "", clean: (raw) => raw.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) });
/** A value of a fixed shape (a date, an id); empty is allowed and means "none" */
export const shaped = (re: RegExp, def = ""): ListField => ({ def, clean: (raw) => (raw === "" || re.test(raw) ? raw : null) });

type Values<S> = { [K in keyof S]: string };

function readAll<S extends Record<string, ListField>>(spec: S, sp: URLSearchParams | null): Values<S> {
  const out = {} as Values<S>;
  for (const k of Object.keys(spec) as (keyof S & string)[]) {
    const raw = sp?.get(k);
    out[k] = raw == null ? spec[k].def : (spec[k].clean(raw) ?? spec[k].def);
  }
  return out;
}
/* this page's keys as they would be written to the address, to tell its own changes from someone else's */
function ownPart<S extends Record<string, ListField>>(spec: S, v: Values<S>): string {
  return (Object.keys(spec) as (keyof S & string)[])
    .filter((k) => v[k] !== spec[k].def)
    .map((k) => `${k}=${encodeURIComponent(v[k])}`)
    .join("&");
}

/** The list's state from the address, and a way to change part of it. `spec` must be the same object on every render
    (a constant outside the component). */
export function useListState<S extends Record<string, ListField>>(spec: S, delay = 300): [Values<S>, (patch: Partial<Values<S>>) => void] {
  const sp = useSearchParams();
  const [v, setV] = useState<Values<S>>(() => readAll(spec, sp));
  /* what this page last wrote (or read): an address change that differs comes from elsewhere (a link to the same page
     with other filters) and is taken in */
  const known = useRef(ownPart(spec, v));
  const spText = sp?.toString() ?? "";
  useEffect(() => {
    const fromUrl = readAll(spec, new URLSearchParams(spText));
    const part = ownPart(spec, fromUrl);
    if (part === known.current) return;
    known.current = part;
    setV(fromUrl);
  }, [spText, spec]);

  useEffect(() => {
    const part = ownPart(spec, v);
    if (part === known.current) return;
    const h = setTimeout(() => {
      known.current = part;
      const url = new URL(window.location.href);
      for (const k of Object.keys(spec)) {
        if (v[k] === spec[k].def) url.searchParams.delete(k);
        else url.searchParams.set(k, v[k]);
      }
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
    }, delay);
    return () => clearTimeout(h);
  }, [v, spec, delay]);

  const set = useCallback(
    (patch: Partial<Values<S>>) =>
      setV((x) => {
        const n = { ...x };
        for (const k of Object.keys(patch) as (keyof S & string)[]) {
          const raw = patch[k];
          if (raw !== undefined) n[k] = spec[k].clean(raw) ?? spec[k].def;
        }
        return n;
      }),
    [spec],
  );
  return [v, set];
}

/* ---------------- the scroll position, and how much of a growing list was loaded ---------------- */

/* when the browser last went Back or Forward: a list opened right after it is put back where it was; a list opened
   from a link or the menu starts at the top */
let lastPop = 0;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (lastPop = Date.now()));

type Kept = { y: number; rows: number };
const keyOf = (path: string) => `diwan-list:${path}`;
function readKept(path: string): Kept | null {
  try {
    const k = JSON.parse(sessionStorage.getItem(keyOf(path)) ?? "null");
    return k && typeof k.y === "number" && typeof k.rows === "number" ? k : null;
  } catch {
    return null;
  }
}

/** What useListScroll needs of a list: useApi's or useMore's state */
type ListLike = { data: { rows?: unknown[] } | unknown | null; hasMore?: boolean; moreLoading?: boolean; moreFailed?: boolean; more?: () => void };
const rowsOf = (s: ListLike) => {
  const d = s.data as { rows?: unknown[] } | null;
  return Array.isArray(d?.rows) ? d.rows.length : 0;
};

/** Remembers how far down the list was scrolled (and, for a "Load more" list, how many rows were loaded) for this
    address; Back to it loads that many rows again (a few batches at most) and scrolls there once they are in. */
export function useListScroll(s: ListLike) {
  const path = usePathname() ?? "";
  const [restore] = useState(() => (Date.now() - lastPop < 3000 ? 1 : 0));
  const done = useRef(!restore);
  const asked = useRef(0);
  const rows = rowsOf(s);

  /* saved while scrolling, only while this page is the one in the address (not once a store page has opened over it) */
  useEffect(() => {
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.location.pathname !== path || !done.current) return;
        try {
          sessionStorage.setItem(keyOf(path + window.location.search), JSON.stringify({ y: Math.round(window.scrollY), rows }));
        } catch {
          /* storage off: Back starts at the top */
        }
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    /* also when rows come in (a list opened fresh replaces what an older visit left) */
    if (rows) save();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
    };
  }, [path, rows]);

  /* coming back: the rows first, then the scroll */
  useEffect(() => {
    if (done.current || !s.data) return;
    const kept = readKept(path + window.location.search);
    if (!kept) {
      done.current = true;
      return;
    }
    if (rows < kept.rows && s.hasMore && s.more && !s.moreFailed && asked.current < 8) {
      if (!s.moreLoading) {
        asked.current += 1;
        s.more();
      }
      return;
    }
    if (s.moreLoading) return;
    done.current = true;
    requestAnimationFrame(() => window.scrollTo({ top: kept.y }));
  }, [s, s.data, rows, path]);
}
