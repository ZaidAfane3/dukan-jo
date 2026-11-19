/* The merchant's tickets on the server (app/api/tickets). Used by Support and the designer's "Bug or idea?" button when a
   merchant is signed in (notifications.ts serverMode); in the tour or signed out they keep tickets in this browser. */

export type MerchantStatus = "open" | "reply" | "solved" | "closed";

export type ServerTicket = {
  number: number;
  kind: "support" | "bug" | "idea";
  category: number;
  subject: string;
  status: MerchantStatus;
  created: number;
  updated: number;
  preview: string;
  pictures: string[];
  unread: boolean;
};

export type ThreadMessage = { id: string; from: "me" | "dukkan" | "system"; body: string; at: number; pictures: string[] };
export type Thread = Omit<ServerTicket, "preview" | "pictures" | "unread"> & { where: string; messages: ThreadMessage[] };

/** "ok", or why it failed: "bad" (refused: field says which), "too-many", "signed-out", "error" (offline or server down) */
export type Sent<T> = { ok: true; data: T } | { ok: false; why: "bad" | "too-many" | "signed-out" | "none" | "error"; field?: string };

/* opts.keepalive: the request may finish after the page is closed (browsers allow it only for small bodies: 64 KiB
   for all of them together, so a large one goes as a normal request) */
async function call<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown, opts: { keepalive?: boolean } = {}): Promise<Sent<T>> {
  try {
    const text = body ? JSON.stringify(body) : undefined;
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: text,
      keepalive: !!opts.keepalive && !!text && new TextEncoder().encode(text).length < 32_000,
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data: j as T };
    const why = r.status === 401 ? "signed-out" : r.status === 429 ? "too-many" : r.status === 404 ? "none" : r.status === 400 ? "bad" : "error";
    return { ok: false, why, field: j?.field };
  } catch {
    return { ok: false, why: "error" };
  }
}

export const fetchTickets = () => call<{ tickets: ServerTicket[] }>("/api/tickets");
export const fetchThread = (n: number) => call<{ ticket: Thread }>(`/api/tickets/${n}`);
/* The same ticket sent twice (a double click, a retry after a lost answer) carries the same key, made from what it says,
   so the server keeps one (server/onceKey.ts) */
function ticketKey(t: { subject: string; category: number; message: string; pictures: string[]; kind?: string; where?: string }): string {
  const text = JSON.stringify([t.subject, t.category, t.message, t.kind ?? "", t.where ?? "", t.pictures.length, t.pictures.map((p) => p.length)]);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0;
    b = Math.imul(b + text.charCodeAt(i), 2246822507) >>> 0;
  }
  return `t${a.toString(36)}${b.toString(36)}${text.length.toString(36)}`;
}
/* opts.leaving: the page is being closed, so the ticket is sent to outlive it when it is small enough (with pictures it
   rarely is: the caller keeps a draft for that) */
export const createTicket = (t: { subject: string; category: number; message: string; pictures: string[]; kind?: "support" | "bug" | "idea"; where?: string }, opts: { leaving?: boolean } = {}) =>
  call<{ number: number }>("/api/tickets", "POST", { ...t, requestKey: ticketKey(t) }, { keepalive: opts.leaving });
export const replyTicket = (n: number, message: string, pictures: string[]) => call<{ status: MerchantStatus }>(`/api/tickets/${n}/reply`, "POST", { message, pictures });
export const setTicketOpen = (n: number, open: boolean) => call<{ status: MerchantStatus }>(`/api/tickets/${n}`, "PATCH", { action: open ? "reopen" : "close" });
export const pictureUrl = (n: number, id: string) => `/api/tickets/${n}/pictures/${id}`;

/** Only pictures the server takes (JPEG, PNG, WebP): an animated GIF is kept as a GIF by the picture reader, so it is left out */
export const sendable = (urls: string[]) => urls.filter((u) => /^data:image\/(jpeg|png|webp);base64,/.test(u));
