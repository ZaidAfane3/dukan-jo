import { cleanLines } from "./safe";

/* The store paused for maintenance: while it is on, visitors of the store see a short "back soon" page with his message
   instead of the store. He turns it on and off on the dashboard's home page. Kept with the store's other data (and on the
   server with his account, see serverSync.ts). */

export type Maintenance = { on: boolean; message: { en: string; ar: string } };

/* the pause switch sends this key on its own, at once (StoreStatus.tsx) */
export const MAINTENANCE_KEY = "seen-maintenance";
const KEY = MAINTENANCE_KEY;
export const MAINTENANCE_MAX = 300;

/** What the visitors' page says (MaintenancePage.tsx): Dukkan's words, then his own message when one is kept. Only
    visitors are told "maintenance"; to him his store is "not live" (StoreStatus.tsx). */
export const maintenanceDefault = {
  en: { title: "This store is under maintenance", message: "We'll be back soon." },
  ar: { title: "المتجر تحت الصيانة", message: "سنعود قريبًا." },
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

/** How it is saved */
export const maintenanceText = (m: Maintenance) => JSON.stringify({ on: m.on, message: { en: cleanLines(m.message.en, MAINTENANCE_MAX), ar: cleanLines(m.message.ar, MAINTENANCE_MAX) } });

export function saveMaintenance(m: Maintenance) {
  try {
    localStorage.setItem(KEY, maintenanceText(m));
  } catch {
    /* storage unavailable */
  }
}
