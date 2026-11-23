/* What a merchant chose on Settings, Customize notifications: for each event, whether it should reach him by WhatsApp
   and whether by email. Shared by the page (components/NotificationPrefs.tsx) and the server
   (app/api/notification-prefs/route.ts, table notification_prefs in server/schema.ts). The email choice of the events in
   LIVE_EMAIL is read by server/notify.ts before it emails him; WhatsApp is not built yet, and the other events have no
   source yet (see LIVE_EMAIL), so their switches show "Coming soon". No browser or server code here, so both sides can
   use it. */

/** The events the page lists, in the page's order. The ids are stored in the database: never rename one. */
export const NOTIFY_EVENTS = ["newOrder", "storeRating", "productRating", "shippingRating", "customerQuestion", "lowStock", "outOfStock"] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];
export const NOTIFY_CHANNELS = ["whatsapp", "email"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export type NotifyChoice = Record<NotifyChannel, boolean>;
export type NotifyPrefs = Record<NotifyEvent, NotifyChoice>;

/** The events Dukkan really emails today (server/notify.ts), each only while its email switch is on:
    - newOrder    a customer placed an order on the store's page (server/storeOrders.ts placeStoreOrder);
    - lowStock    an order took a product's stock down to its "warn me at" number (the product's lowAt) or below;
    - outOfStock  an order took its last piece.
    Customers can't rate a store, a product or a shipping company on Dukkan yet, and "Ask about this product" on the
    store opens a WhatsApp chat with the merchant, so nothing of storeRating, productRating, shippingRating or
    customerQuestion ever reaches the server: those rows say "Coming soon". WhatsApp is not built, for any event: every
    WhatsApp switch says "Coming soon". The saved values of those switches are kept as they are, for when they come. */
export const LIVE_EMAIL: readonly NotifyEvent[] = ["newOrder", "lowStock", "outOfStock"];

/** Whether a switch does something today (the page shows the others as "Coming soon", and can't flip them) */
export const notifyLive = (event: NotifyEvent, channel: NotifyChannel): boolean => channel === "email" && LIVE_EMAIL.includes(event);

/** The default, for an account that never chose (and for any event missing from what was saved): every event by
    WhatsApp and by email, as the page always started. */
export const defaultNotifyPrefs = (): NotifyPrefs =>
  Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, { whatsapp: true, email: true }])) as NotifyPrefs;

const isEvent = (k: string): k is NotifyEvent => (NOTIFY_EVENTS as readonly string[]).includes(k);
const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Checks choices sent by a page, strictly: an object of known events only, each with exactly a true/false `whatsapp`
    and `email`. Events left out are simply not in the answer (the caller fills them in). Anything else: null. */
export function checkNotifyPrefs(v: unknown): Partial<NotifyPrefs> | null {
  if (!isPlain(v)) return null;
  const keys = Object.keys(v);
  if (keys.length > NOTIFY_EVENTS.length) return null;
  const out: Partial<NotifyPrefs> = {};
  for (const k of keys) {
    if (!isEvent(k)) return null;
    const c = v[k];
    if (!isPlain(c)) return null;
    const ck = Object.keys(c);
    if (ck.length !== NOTIFY_CHANNELS.length || !NOTIFY_CHANNELS.every((ch) => typeof c[ch] === "boolean")) return null;
    out[k] = { whatsapp: c.whatsapp as boolean, email: c.email as boolean };
  }
  return out;
}

/** The full set from whatever is saved (the database row, or this browser in the tour): known events with true/false
    values are kept, everything else becomes the default */
export function fullNotifyPrefs(v: unknown): NotifyPrefs {
  const out = defaultNotifyPrefs();
  if (!isPlain(v)) return out;
  for (const e of NOTIFY_EVENTS) {
    const c = v[e];
    if (!isPlain(c)) continue;
    for (const ch of NOTIFY_CHANNELS) if (typeof c[ch] === "boolean") out[e][ch] = c[ch] as boolean;
  }
  return out;
}

/** Reads what the page kept in the browser before the choices were saved on the server (localStorage
    "seen-notif-prefs"): { whatsapp: boolean[], email: boolean[] } in the events' order, or, from before WhatsApp was
    added, one list for email. Null when it is missing or not one of those shapes. */
export function fromOldLocal(raw: string | null): NotifyPrefs | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const n = NOTIFY_EVENTS.length;
  const list = (l: unknown): boolean[] | null => (Array.isArray(l) && l.length === n ? l.map((x) => x === true) : null);
  let wa: boolean[] | null, em: boolean[] | null;
  if (Array.isArray(v)) {
    wa = Array(n).fill(true);
    em = list(v);
  } else if (isPlain(v)) {
    wa = list(v.whatsapp);
    em = list(v.email);
  } else return null;
  if (!wa || !em) return null;
  return Object.fromEntries(NOTIFY_EVENTS.map((e, i) => [e, { whatsapp: wa[i], email: em[i] }])) as NotifyPrefs;
}

/** The browser key the page used before (and still uses in the tour, whose storage is its own copy) */
export const OLD_LOCAL_KEY = "seen-notif-prefs";
