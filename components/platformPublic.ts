import { useEffect, useSyncExternalStore } from "react";
import { cleanSetting, PUBLIC_KEYS, SETTING_DEFAULTS, THEME_PAYS, type PayMethod, type PublicSettings, type ThemePay } from "./diwan/platformSettings";

export { THEME_PAYS, type ThemePay };

/* The platform settings Dukkan's staff save in Diwan that the merchant pages and the stores read (GET
   /api/platform/settings): the domain prices, the ways to pay, the free themes, Dukkan Ship and the legal pages a new
   store starts with. Diwan is where they are decided; the pages only show them, and the server checks again whatever is
   charged or paid (never trusting what a page sends).

   A page has an answer at once: the copy kept in this browser from last time, or the starting values (what the code did
   before Diwan could change them). The server is asked once per page load, again when a page that shows them opens, and
   when the tab comes back into view, at most once a minute, so a change in Diwan reaches pages that stay open. */

const CACHE = "dukkan-platform";
const MIN_GAP = 60_000;

const DEFAULTS: PublicSettings = Object.fromEntries(PUBLIC_KEYS.map((k) => [k, SETTING_DEFAULTS[k]])) as PublicSettings;

/* each value passes its rules again, so a broken copy in this browser (or a bad answer) can't break a page */
function cleaned(raw: unknown): PublicSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, (k in o ? cleanSetting(k, o[k]) : null) ?? SETTING_DEFAULTS[k]])) as PublicSettings;
}

let current: PublicSettings = DEFAULTS;
let fromCacheDone = false;
function fromCache() {
  if (fromCacheDone || typeof window === "undefined") return;
  fromCacheDone = true;
  try {
    current = cleaned(JSON.parse(localStorage.getItem(CACHE) ?? "null")) ?? current;
  } catch {
    /* no copy yet, or storage blocked */
  }
}

const listeners = new Set<() => void>();
let asked: Promise<boolean> | null = null;
let askedAt = 0;

/** Asks the server for the settings: once per page load, then again only when the last answer is a minute old (or
    always with force). True when an answer came. */
export function refreshPublicSettings(force = false): Promise<boolean> {
  fromCache();
  if (typeof window === "undefined") return Promise.resolve(false);
  if (asked && !force && Date.now() - askedAt < MIN_GAP) return asked;
  askedAt = Date.now();
  return (asked = fetch("/api/platform/settings", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: unknown) => {
      const v = cleaned(j);
      if (!v) return false;
      const changed = JSON.stringify(v) !== JSON.stringify(current);
      current = v;
      try {
        localStorage.setItem(CACHE, JSON.stringify(v));
      } catch {
        /* a full storage only means no copy for next time */
      }
      if (changed) listeners.forEach((f) => f());
      return true;
    })
    .catch(() => false));
}

/** The settings as known now (the browser's copy or the starting values), for code that is not a component */
export function publicSettings(): PublicSettings {
  fromCache();
  return current;
}

/* one listener for the whole page: a tab brought back into view asks again (at most once a minute) */
let watching = false;
function watchVisibility() {
  if (watching || typeof document === "undefined") return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshPublicSettings();
  });
}

function subscribe(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The settings for a component: drawn with the starting values on the server, then this browser's copy, then again
    when the server's answer differs. Opening a page that uses it asks the server (at most once a minute). */
export function usePublicSettings(): PublicSettings {
  const v = useSyncExternalStore(subscribe, publicSettings, () => DEFAULTS);
  useEffect(() => {
    watchVisibility();
    void refreshPublicSettings();
  }, []);
  return v;
}

/* ---------------- what the pages need from them ---------------- */

/** A store's checkout's ways to pay (its own names: cash is Diwan's "cod"), in the order the checkout shows them */
export const STORE_PAYS = ["cliq", "cash", "card"] as const;
export type StorePay = (typeof STORE_PAYS)[number];
export const storePayKey = (p: StorePay): PayMethod => (p === "cash" ? "cod" : p);

/** The ways a store's customer can pay now: only the ones Diwan has on */
export const storePays = (s: Pick<PublicSettings, "payment_methods">): StorePay[] => STORE_PAYS.filter((p) => s.payment_methods[storePayKey(p)].on);

/** The ways a merchant can pay Dukkan for a theme now (the theme checkout's own three, the ones Diwan has on) */
export const themePays = (s: Pick<PublicSettings, "payment_methods">): ThemePay[] => THEME_PAYS.filter((p) => s.payment_methods[p].on);

/** The note Diwan wrote beside a way to pay ("" when none) */
export const payNote = (s: Pick<PublicSettings, "payment_methods">, m: PayMethod): string => s.payment_methods[m].note;

/** A price in JOD as the shipping pages write it: "JOD 3" / "3 د.أ" */
export const jod = (n: number, lang: "en" | "ar") => (lang === "ar" ? `${n} د.أ` : `JOD ${n}`);

/** Dukkan Ship in the page's language: its price, the pickup cities, the line under the price and its points */
export function shipWords(s: Pick<PublicSettings, "dukkan_ship">, lang: "en" | "ar") {
  const d = s.dukkan_ship;
  return {
    price: jod(d.price, lang),
    priceNote: d.policy[lang],
    cities: d.cities.map((c) => c[lang]),
    features: d.features.map((f) => f[lang]),
  };
}

/** Dukkan Ship's pickup cities in both languages, for turning a saved city into the page's language */
export const shipCityLists = (s: Pick<PublicSettings, "dukkan_ship">) => ({ en: s.dukkan_ship.cities.map((c) => c.en), ar: s.dukkan_ship.cities.map((c) => c.ar) });
