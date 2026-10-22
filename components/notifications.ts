/* A tiny notification list kept for this browser session. Pages add to it
   when something happens (a task is finished, a coupon is created, ...) and
   the bell in the dashboard header shows it. Nothing leaves the browser. */

export type NotificationKind = "welcome" | "taskDone" | "couponCreated" | "reminderSent" | "ticketCreated";

/** Which filter tab a notification belongs to (matches the tab order in content.ts). */
export const NOTIFICATION_TAB: Record<NotificationKind, 1 | 2 | 3 | 4 | 5> = {
  welcome: 1, /* Important */
  taskDone: 5, /* Store activity */
  couponCreated: 5,
  ticketCreated: 5,
  reminderSent: 3, /* Abandoned carts */
};

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  params: Record<string, string>;
  ts: number;
  read: boolean;
};

const KEY = "seen-notifications";
const EVENT = "seen-notifications";

export function getNotifications(): AppNotification[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function save(list: AppNotification[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable: notifications just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function pushNotification(kind: NotificationKind, params: Record<string, string> = {}) {
  const note: AppNotification = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, params, ts: Date.now(), read: false };
  save([note, ...getNotifications()]);
}

export function markRead(id: string) {
  save(getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead() {
  save(getNotifications().map((n) => ({ ...n, read: true })));
}

/** Run a callback whenever the list changes (from this page or another tab). */
export function onNotificationsChange(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
