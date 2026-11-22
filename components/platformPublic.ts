import { jordanNumber } from "./phone";
import { useEffect, useState, useSyncExternalStore } from "react";
import { arCount } from "./undo";
import { cleanSetting, PUBLIC_KEYS, SETTING_DEFAULTS, THEME_PAYS, type Bi, type PayMethod, type PublicSettings, type ThemePay } from "./diwan/platformSettings";
import { moneyText } from "./moneyText";

export { THEME_PAYS, type ThemePay };

/* The platform settings Dukkan's staff save in Diwan that the merchant pages and the stores read (GET
   /api/platform/settings): the ways to pay, Dukkan Ship, Dukkan support's contact and the legal pages a new
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
  /* the browser may answer from its own copy of under 30 s (the route says how long); a forced ask never does */
  return (asked = fetch("/api/platform/settings", { cache: force ? "no-store" : "default" })
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

/** A note staff wrote in both languages, in the visitor's language; the other language when his is empty ("" when both are) */
export const noteFor = (note: Bi, lang: "en" | "ar"): string => note[lang] || note[lang === "ar" ? "en" : "ar"];

/** The note Diwan wrote beside a way to pay, in the page's language ("" when none) */
export const payNote = (s: Pick<PublicSettings, "payment_methods">, m: PayMethod, lang: "en" | "ar" = "en"): string => noteFor(s.payment_methods[m].note, lang);

/** A price in JOD as the shipping pages write it: "JOD 3" / "3 د.أ" */
export const jod = (n: number, lang: "en" | "ar") => (lang === "ar" ? `${moneyText(n)} د.أ` : `JOD ${moneyText(n)}`);

/** Dukkan Ship in the page's language: its price, the pickup cities, the line under the price and its points. A price of 0
    reads "Free", the word the store's customers see at checkout, and `free` tells the page to leave out "per order". */
export function shipWords(s: Pick<PublicSettings, "dukkan_ship">, lang: "en" | "ar") {
  const d = s.dukkan_ship;
  const free = !(d.price > 0);
  return {
    free,
    price: free ? (lang === "ar" ? "مجاني" : "Free") : jod(d.price, lang),
    priceNote: d.policy[lang],
    cities: d.cities.map((c) => c[lang]),
    features: d.features.map((f) => f[lang]),
  };
}

/** Dukkan Ship's pickup cities in both languages, for turning a saved city into the page's language */
export const shipCityLists = (s: Pick<PublicSettings, "dukkan_ship">) => ({ en: s.dukkan_ship.cities.map((c) => c.en), ar: s.dukkan_ship.cities.map((c) => c.ar) });

/** Whether Dukkan Ship still picks up from a saved city (in either language); "" is no city, not a removed one */
export const shipServes = (s: Pick<PublicSettings, "dukkan_ship">, city: string) =>
  !city || s.dukkan_ship.cities.some((c) => c.en === city || c.ar === city);

/** A saved city as the city picker shows it: its name in the page's language from Dukkan Ship's list now, or "" when the
    list no longer has it (the picker then asks for a city) */
export const shipCityShown = (s: Pick<PublicSettings, "dukkan_ship">, city: string, lang: "en" | "ar") =>
  s.dukkan_ship.cities.find((c) => c.en === city || c.ar === city)?.[lang] ?? "";

/** True once this page heard the server's settings (or the ask failed), so a page never warns from the starting values
    or an old copy in this browser (a city they still list may be gone, or the other way round) */
export function useSettingsChecked(): boolean {
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let on = true;
    void refreshPublicSettings().then(() => on && setChecked(true));
    return () => {
      on = false;
    };
  }, []);
  return checked;
}

/** A WhatsApp link for a number: wa.me wants the country code and digits only, so a local Jordanian 07... number gets 962
    in front and a leading 00 is dropped; "" when it is too short to be a number */
export function waLink(n: string): string {
  /* a Jordan mobile in any of its forms ("+962 079…", "00962…", "07…", Arabic digits): 962 and the number without its 0 */
  const jo = jordanNumber(n);
  if (jo) return `https://wa.me/962${jo}`;
  let d = n.replace(/\D/g, "").replace(/^00/, "");
  if (/^07\d{8}$/.test(d)) d = `962${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : "";
}

/** Dukkan support's contact as Diwan has it now (platform setting support_contact), ready for links: each one "" when
    staff left it empty, so the page leaves it out */
export function supportLinks(s: Pick<PublicSettings, "support_contact">) {
  const c = s.support_contact;
  const tel = c.phone.replace(/[^\d+]/g, "");
  return { phone: c.phone, tel: tel ? `tel:${tel}` : "", whatsapp: waLink(c.whatsapp), email: c.email, mailto: c.email ? `mailto:${c.email}` : "" };
}

/** How soon Dukkan's support usually answers (platform setting support_reply_hours), as the merchant Support page says it:
    "We usually reply within 2 hours." / «نردّ عادةً خلال ساعتين.» (1 «ساعة واحدة», 2 «ساعتين», 3–10 «ساعات»). Diwan's
    settings page previews it with the same words. */
export function replyWithin(hours: number, lang: "en" | "ar"): string {
  if (lang === "ar") return `نردّ عادةً خلال ${arCount(hours, { one: "ساعة واحدة", two: "ساعتين", few: "ساعات", many: "ساعة" })}.`;
  return `We usually reply within ${hours} ${hours === 1 ? "hour" : "hours"}.`;
}
