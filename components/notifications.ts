import { content, type Lang } from "./content";
import { demoActive, signedInAs } from "./demoSandbox";
import { bounceIfSuspended } from "./suspended";

/* The bell's list. Two sources, shown as one list:
   - this browser session: pages add to it when something happens here (a task is finished, a coupon is created, ...).
     Kept in sessionStorage; nothing leaves the browser.
   - the server, when a merchant is signed in (never in the tour): what Dukkan sent this shop (a ticket answered, a
     paper checked, a payment received, ... see server/notify.ts) and Dukkan's announcements meant for it. Fetched
     from /api/notifications when the bell opens and every minute while the page is in view; read marks go back to the
     server. Their ids start with "s:". */

export type LocalKind = "taskDone" | "couponCreated" | "reminderSent" | "ticketCreated" | "orderCreated";
/* supportViewed is no longer sent ("Log in as merchant" was removed on 2026-11-16); kept so older messages still read */
export type ServerKind =
  | "ticketReplied" | "ticketStatus" | "documentStatus" | "shopSuspended" | "shopReactivated"
  | "paymentReceived" | "supportViewed" | "announcement" | "orderPlaced" | "shipDelivered" | "shipFailed" | "shipCityGone" | "payOff" | "twoStepOff";
export type NotificationKind = LocalKind | ServerKind;

/** Which filter tab a notification belongs to (matches the tab order in content.ts). */
export const NOTIFICATION_TAB: Record<NotificationKind, 1 | 2 | 3 | 4 | 5> = {
  taskDone: 5, /* Store activity */
  couponCreated: 5,
  ticketCreated: 5,
  reminderSent: 3, /* Abandoned carts */
  orderCreated: 1, /* Important */
  ticketReplied: 1,
  ticketStatus: 5,
  documentStatus: 1,
  shopSuspended: 1,
  shopReactivated: 1,
  paymentReceived: 4, /* Payments */
  orderPlaced: 1, /* a customer's order on the public store */
  shipDelivered: 1, /* Dukkan Ship delivered one of his orders */
  shipFailed: 1, /* Dukkan Ship could not deliver it */
  shipCityGone: 1, /* Dukkan Ship no longer picks up from his city */
  payOff: 1, /* Dukkan switched off the last way to pay his store had */
  twoStepOff: 1, /* Dukkan turned his 2-step sign-in off */
  supportViewed: 1,
  announcement: 1,
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

function localList(): AppNotification[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    /* the old local welcome is now an announcement from Diwan: one saved before has no words any more, so it is left out */
    return raw ? (JSON.parse(raw) as AppNotification[]).filter((n) => (n.kind as string) !== "welcome") : [];
  } catch {
    return [];
  }
}

/* ---------------- from the server ---------------- */

const SERVER_KINDS = new Set<string>(["ticketReplied", "ticketStatus", "documentStatus", "shopSuspended", "shopReactivated", "paymentReceived", "supportViewed", "announcement", "orderPlaced", "shipDelivered", "shipFailed", "shipCityGone", "payOff", "twoStepOff"]);
let serverList: AppNotification[] = [];
let loading: Promise<void> | null = null;

/** True when the bell (and Support) talk to the server: a merchant is signed in and the tour is not running */
export const serverMode = () => typeof window !== "undefined" && !demoActive() && !!signedInAs();

const changed = () => window.dispatchEvent(new Event(EVENT));

/** Fetches the server's part of the list (at most one request at a time). Does nothing in the tour or signed out. */
export function refreshServerNotifications(): Promise<void> {
  if (!serverMode()) return Promise.resolve();
  loading ??= fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" })
    .then(async (r) => {
      /* signed out while the page was open: if Dukkan suspended the store, the merchant is shown why */
      if (r.status === 401) void bounceIfSuspended();
      if (!r.ok) return;
      const j = (await r.json()) as { items?: { id: string; kind: string; params: Record<string, unknown>; ts: number; read: boolean }[] };
      serverList = (j.items ?? [])
        .filter((x) => SERVER_KINDS.has(x.kind))
        .map((x) => ({
          id: `s:${x.id}`,
          kind: x.kind as ServerKind,
          /* shown as plain text only */
          params: Object.fromEntries(Object.entries(x.params ?? {}).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "1" : "") : String(v ?? "")])),
          /* the server dates an announcement from when it reached this store (never before the store joined); a
             clock here behind the server's must not show it "in" the future either */
          ts: Math.min(Number(x.ts) || 0, Date.now()),
          read: !!x.read,
        }));
      changed();
    })
    .catch(() => {
      /* offline: the bell keeps what it has */
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function markServer(body: { ids: string[] } | { all: true }) {
  fetch("/api/notifications/read", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    /* offline: it shows as unread again on the next fetch */
  });
}

/* ---------------- the list ---------------- */

/** Everything the bell shows, newest first */
export function getNotifications(): AppNotification[] {
  const local = localList();
  if (!serverList.length) return local;
  return [...local, ...serverList].sort((a, b) => b.ts - a.ts).slice(0, 80);
}

/** The live announcements from the server that are not read yet (the dashboard shows those with a banner) */
export const unreadAnnouncements = () => serverList.filter((n) => n.kind === "announcement" && !n.read);

function save(list: AppNotification[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable: notifications just won't persist */
  }
  changed();
}

export function pushNotification(kind: LocalKind, params: Record<string, string> = {}) {
  const note: AppNotification = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, params, ts: Date.now(), read: false };
  save([note, ...localList()]);
}

export function markRead(id: string) {
  if (id.startsWith("s:")) {
    const item = serverList.find((n) => n.id === id);
    if (!item || item.read) return;
    serverList = serverList.map((n) => (n.id === id ? { ...n, read: true } : n));
    markServer({ ids: [id.slice(2)] });
    changed();
    return;
  }
  save(localList().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead() {
  if (serverList.some((n) => !n.read)) {
    serverList = serverList.map((n) => ({ ...n, read: true }));
    markServer({ all: true });
  }
  save(localList().map((n) => ({ ...n, read: true })));
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

/* ---------------- wording ---------------- */

/** Where clicking a notification takes the merchant, if anywhere */
export function notificationLink(item: AppNotification): string | null {
  if ((item.kind === "ticketReplied" || item.kind === "ticketStatus") && /^\d+$/.test(item.params.number ?? "")) return `/support?ticket=${item.params.number}`;
  /* an order a customer placed on the public store: the Orders page opens it */
  if ((item.kind === "orderPlaced" || item.kind === "shipDelivered" || item.kind === "shipFailed") && /^\d+$/.test(item.params.number ?? "")) return `/orders?open=${item.params.number}`;
  /* his Dukkan Ship pickup city was taken off the list: Delivery options, where he chooses another */
  if (item.kind === "shipCityGone") return "/delivery";
  /* the last way to pay his store had was switched off by Dukkan: the Ways to pay card, where he turns on another */
  if (item.kind === "payOff") return "/delivery#ways-to-pay";
  /* Dukkan turned his 2-step sign-in off: Settings, where he turns it on again */
  if (item.kind === "twoStepOff") return "/settings#two-step";
  return null;
}

/** The text of a notification from the server, in the merchant's language (content.ts, notifications.server) */
export function serverNotificationText(item: AppNotification, lang: Lang): string {
  const w = content[lang].notifications.server;
  const p = item.params;
  const fill = (t: string, extra: Record<string, string> = {}) =>
    Object.entries({ ...p, ...extra }).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), t);
  const note = p.note ? `${w.sep}${p.note}` : "";
  switch (item.kind) {
    case "announcement":
      return (lang === "ar" ? p.titleAr : p.titleEn) || p.titleEn || p.titleAr || "";
    case "ticketReplied":
      return fill(w.ticketReplied);
    case "ticketStatus":
      return fill(p.status === "closed" ? w.ticketClosed : w.ticketSolved);
    case "documentStatus":
      return fill(p.status === "approved" ? w.documentApproved : p.status === "rejected" ? w.documentRejected : w.documentOther, { note, status: w.statusWords[p.status] ?? p.status ?? "" });
    case "shopSuspended":
      return fill(w.shopSuspended, { reason: p.reason ? `${w.sep}${p.reason}` : "" });
    case "shopReactivated":
      return w.shopReactivated;
    case "paymentReceived":
      return fill(w.paymentReceived, { method: w.methods[p.method as keyof typeof w.methods] ?? p.method ?? "" });
    case "supportViewed":
      return w.supportViewed;
    case "orderPlaced":
      return fill(w.orderPlaced);
    case "shipDelivered":
      return fill(w.shipDelivered);
    case "shipFailed":
      return fill(w.shipFailed, { note });
    case "shipCityGone":
      return fill(w.shipCityGone);
    case "payOff":
      return w.payOff;
    case "twoStepOff":
      return w.twoStepOff;
    default:
      return "";
  }
}
