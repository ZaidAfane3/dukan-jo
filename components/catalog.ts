import { useEffect, useState } from "react";
import type { ListingRow } from "./themeListing";
import { setCatalog } from "./themes";

/* Keeps the theme store's list from Dukkan's server (/api/themes/catalog) for the merchant pages: the theme store, My
   themes, the designer and the store preview. A copy is kept in this browser so the pages can show it at once; it is
   brought up to date once per page load. Pages that show themes call useCatalog() to be drawn again when it changes. */

const CACHE = "dukkan-catalog";
const EVENT = "dukkan-catalog";

let loaded = false;
function fromCache() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const rows = JSON.parse(localStorage.getItem(CACHE) ?? "null");
    if (Array.isArray(rows)) setCatalog(rows as ListingRow[]);
  } catch {
    /* no copy yet, or storage blocked */
  }
}

let asked: Promise<boolean> | null = null;
/** Asks the server for the list (once per page load, or again with force). True when it came. */
export function refreshCatalog(force = false): Promise<boolean> {
  fromCache();
  if (asked && !force) return asked;
  return (asked = fetch("/api/themes/catalog", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { themes?: unknown } | null) => {
      if (!j || !Array.isArray(j.themes)) return false;
      setCatalog(j.themes as ListingRow[]);
      try {
        localStorage.setItem(CACHE, JSON.stringify(j.themes));
      } catch {
        /* a full storage only means no copy for next time */
      }
      window.dispatchEvent(new Event(EVENT));
      return true;
    })
    .catch(() => false));
}

/** Draws the page again whenever the theme store's list changes (the number only changes, it means nothing) */
export function useCatalog(): number {
  fromCache();
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((n) => n + 1);
    window.addEventListener(EVENT, on);
    void refreshCatalog();
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return v;
}
