import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { demoSeed, DEMO_SEED_VERSION } from "./demoData";

/* The platform tour. While it runs, the dashboard reads and writes a separate copy of the browser's
   storage that starts filled with made-up data. A visitor's (or merchant's) real saved data is never
   read or changed. The tour's copy lives in this tab only (sessionStorage), so it survives moving
   between pages and disappears when the tab closes or the tour ends. */

const FLAG = "dukkan-demo";
const DATA = "dukkan-demo-data";
/* Preferences are the visitor's own, so the language and theme switches keep working normally */
const PASS = new Set([FLAG, DATA, "seen-lang", "seen-theme", "seen-sidebar", "seen-signed-in"]);

type Maps = { local: Record<string, string>; session: Record<string, string>; v?: number };

const proto = typeof Storage !== "undefined" ? Storage.prototype : null;
const orig = proto && { get: proto.getItem, set: proto.setItem, remove: proto.removeItem, clear: proto.clear, key: proto.key };

let maps: Maps | null = null;

const realGet = (k: string) => { try { return orig ? orig.get.call(window.sessionStorage, k) : null; } catch { return null; } };
const realSet = (k: string, v: string) => { try { orig?.set.call(window.sessionStorage, k, v); } catch { /* storage full or blocked */ } };
const realRemove = (k: string) => { try { orig?.remove.call(window.sessionStorage, k); } catch { /* storage blocked */ } };

export function demoActive(): boolean {
  return typeof window !== "undefined" && realGet(FLAG) === "1";
}

/* Set while Saad's own copy of a theme is open in the designer (/saad): it is his page, so nothing in it is locked by the tour */
let ownCopy = false;
export const setOwnCopy = (v: boolean) => {
  ownCopy = v;
};
export const isOwnCopy = () => ownCopy;
/** Whether the designer must refuse changes: only in the tour, and never in Saad's own copies */
export const editLocked = () => demoActive() && !ownCopy;

/** Starts the tour with fresh made-up data, in the given language. */
export function startDemo(lang: Lang) {
  realSet(FLAG, "1");
  realSet(DATA, JSON.stringify({ ...demoSeed(lang), v: DEMO_SEED_VERSION }));
  maps = null;
}

/** Writes the tour's data again in another language (the visitor switched language). Edits made in the tour are dropped. */
export function reseedDemo(lang: Lang) {
  const seed = demoSeed(lang);
  if (maps) {
    maps.local = seed.local;
    maps.session = seed.session;
    maps.v = DEMO_SEED_VERSION;
    realSet(DATA, JSON.stringify(maps));
  } else {
    realSet(DATA, JSON.stringify({ ...seed, v: DEMO_SEED_VERSION }));
  }
}

/** Ends the tour: the made-up data is dropped and the real storage is used again after the reload. */
export function endDemo(to = "/") {
  realRemove(FLAG);
  realRemove(DATA);
  window.location.href = to;
}

/** Called before any page reads its data. Does nothing unless the tour is running. */
export function installDemoIfActive() {
  if (maps || !proto || !orig || !demoActive()) return;
  try {
    const saved = realGet(DATA);
    maps = saved ? (JSON.parse(saved) as Maps) : { local: {}, session: {} };
    /* A tab opened before the demo's data changed still holds the old copy: write the current one (in the language in use) */
    if (maps.v !== DEMO_SEED_VERSION) {
      let lang: Lang = "ar";
      try { lang = orig.get.call(window.localStorage, "seen-lang") === "en" ? "en" : "ar"; } catch { /* storage blocked */ }
      const seed = demoSeed(lang);
      maps = { local: seed.local, session: seed.session, v: DEMO_SEED_VERSION };
      realSet(DATA, JSON.stringify(maps));
    }
  } catch {
    maps = { local: {}, session: {} };
  }
  const m = maps;
  const pick = (s: Storage) => (s === window.localStorage ? m.local : m.session);
  const persist = () => realSet(DATA, JSON.stringify(m));

  proto.getItem = function (this: Storage, k: string) {
    if (PASS.has(k)) return orig.get.call(this, k);
    const v = pick(this)[k];
    return v === undefined ? null : v;
  };
  proto.setItem = function (this: Storage, k: string, v: string) {
    if (PASS.has(k)) return orig.set.call(this, k, v);
    pick(this)[k] = String(v);
    persist();
  };
  proto.removeItem = function (this: Storage, k: string) {
    if (PASS.has(k)) return orig.remove.call(this, k);
    delete pick(this)[k];
    persist();
  };
  proto.clear = function (this: Storage) {
    const t = pick(this);
    Object.keys(t).forEach((k) => delete t[k]);
    persist();
  };
  proto.key = function (this: Storage, i: number) {
    return Object.keys(pick(this))[i] ?? null;
  };
}

/** True while the platform tour runs. False on the first render, so the page matches what the server sent. */
export function useDemo(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(demoActive()), []);
  return on;
}

/** The look of a button the tour switches off */
export const demoOff = "disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline disabled:hover:bg-transparent disabled:hover:text-inherit";
export const demoOffText = (lang: Lang) => (lang === "ar" ? "تجربة وهمية: غير متاح" : "Fake demo: not available");
