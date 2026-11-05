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

async function call<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<Sent<T>> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
export const createTicket = (t: { subject: string; category: number; message: string; pictures: string[]; kind?: "support" | "bug" | "idea"; where?: string }) =>
  call<{ number: number }>("/api/tickets", "POST", t);
export const replyTicket = (n: number, message: string, pictures: string[]) => call<{ status: MerchantStatus }>(`/api/tickets/${n}/reply`, "POST", { message, pictures });
export const setTicketOpen = (n: number, open: boolean) => call<{ status: MerchantStatus }>(`/api/tickets/${n}`, "PATCH", { action: open ? "reopen" : "close" });
export const pictureUrl = (n: number, id: string) => `/api/tickets/${n}/pictures/${id}`;

/** Only pictures the server takes (JPEG, PNG, WebP): an animated GIF is kept as a GIF by the picture reader, so it is left out */
export const sendable = (urls: string[]) => urls.filter((u) => /^data:image\/(jpeg|png|webp);base64,/.test(u));
