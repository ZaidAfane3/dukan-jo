import { cleanLines } from "./safe";

/* The store paused for maintenance: while it is on, visitors of the store see a short "back soon" page with his message
   instead of the store. He turns it on and off on the dashboard's home page. Kept with the store's other data (and on the
   server with his account, see serverSync.ts). */

export type Maintenance = { on: boolean; message: { en: string; ar: string } };

const KEY = "seen-maintenance";
export const MAINTENANCE_MAX = 300;

/** What the page says when he wrote nothing of his own */
export const maintenanceDefault = {
  en: { title: "Back soon", message: "We're making some improvements to the store. We'll be back soon." },
  ar: { title: "سنعود قريبًا", message: "نجري بعض التحسينات على المتجر، وسنعود قريبًا." },
};

export function loadMaintenance(): Maintenance {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Maintenance> | null;
    const m = v && typeof v === "object" ? v.message : undefined;
    return {
      on: v?.on === true,
      message: { en: cleanLines(m?.en, MAINTENANCE_MAX), ar: cleanLines(m?.ar, MAINTENANCE_MAX) },
    };
  } catch {
    return { on: false, message: { en: "", ar: "" } };
  }
}

export function saveMaintenance(m: Maintenance) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on: m.on, message: { en: cleanLines(m.message.en, MAINTENANCE_MAX), ar: cleanLines(m.message.ar, MAINTENANCE_MAX) } }));
  } catch {
    /* storage unavailable */
  }
}
