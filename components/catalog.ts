import { useEffect, useState } from "react";
import type { ListingRow } from "./themeListing";
import { setCatalog } from "./themes";

/* Keeps the theme store's list from Dukkan's server (/api/themes/catalog) for the merchant pages: the theme store, My
   themes, the designer and the store preview. A copy is kept in this browser so the pages can show it at once; it is
   brought up to date when a page that shows themes opens and when the tab comes back into view, at most once a minute,
   so a merchant moving between pages (without reloading) sees the prices and featured themes staff set in Diwan.
   Pages that show themes call useCatalog() to be drawn again when it changes. */

const CACHE = "dukkan-catalog";
const EVENT = "dukkan-catalog";
const MIN_GAP = 60_000;

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
let askedAt = 0;
/** Asks the server for the list (again only when the last answer is a minute old, or always with force). True when it came. */
export function refreshCatalog(force = false): Promise<boolean> {
  fromCache();
  if (asked && !force && Date.now() - askedAt < MIN_GAP) return asked;
  askedAt = Date.now();
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

/** Draws the page again whenever the theme store's list changes (the number only changes, it means nothing). Opening
    the page, and coming back to its tab, asks the server again (at most once a minute). */
export function useCatalog(): number {
  fromCache();
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = () => setV((n) => n + 1);
    const back = () => document.visibilityState === "visible" && void refreshCatalog();
    window.addEventListener(EVENT, on);
    document.addEventListener("visibilitychange", back);
    void refreshCatalog();
    return () => {
      window.removeEventListener(EVENT, on);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);
  return v;
}
