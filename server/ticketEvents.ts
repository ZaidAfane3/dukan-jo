import { NextResponse, type NextRequest } from "next/server";
import { Client } from "pg";
import { answer } from "./auth";
import { db } from "./db";

/* Live ticket conversations (owner 2026-11-24: the support chat between a merchant and Dukkan's team should be instant,
   like a real chat). Each change to a ticket (a message, a status) is announced on a Postgres channel once it is saved
   (pg_notify, after the transaction's COMMIT), and every server process keeps ONE connection listening to that channel,
   whatever the number of open pages. That connection hands each announcement to the pages' open streams (Server-Sent
   Events, eventStream below); a page told "something changed" loads the conversation again through its usual route, with
   its usual checks. So an announcement never carries anything private: only the ticket's number, its account and who
   wrote (kind). The account never reaches a browser.

   kind: "merchant" the merchant wrote, opened, closed or reopened a ticket
         "staff"    Dukkan's team wrote to him or solved / closed it (what he sees, and his bell)
         "note"     a change only staff see (an internal note, priority, assignee, a status he isn't shown) */

export type TicketEventKind = "merchant" | "staff" | "note";
export type TicketEvent = { n: number; a: string; k: TicketEventKind };

const CHANNEL = "ticket_events";

/** Announces a saved change to a ticket. Called after the change's transaction committed (never inside it: a page told
    too early would load the conversation without it). Never throws: a lost announcement only means the pages see the
    change at their next slow check (components/ticketStream.ts). */
export async function ticketChanged(number: number, accountId: string | number, kind: TicketEventKind): Promise<void> {
  try {
    await (await db()).query(`SELECT pg_notify($1, $2)`, [CHANNEL, JSON.stringify({ n: number, a: String(accountId), k: kind })]);
  } catch (e) {
    console.error("[tickets] live announcement not sent", (e as Error).message);
  }
}

/* ---------------- the one listening connection (per server process) ---------------- */

type Sub = { match: (e: TicketEvent) => boolean; send: (e: TicketEvent | null) => void };
type Hub = {
  subs: Set<Sub>;
  client: Client | null;
  connecting: boolean;
  /* the wait before the next try after the connection was lost: 1 s, doubling up to 30 s */
  retryMs: number;
  retry?: ReturnType<typeof setTimeout>;
  check?: ReturnType<typeof setInterval>;
  /* open streams, per account or staff member, and in all */
  open: Map<string, number>;
  total: number;
};

/* kept on globalThis, so the dev server's reloads keep the same connection and streams instead of opening new ones */
const g = globalThis as unknown as { dukkanTicketHub?: Hub };
const hub: Hub = (g.dukkanTicketHub ??= { subs: new Set(), client: null, connecting: false, retryMs: 1000, open: new Map(), total: 0 });

const parse = (payload: string | undefined): TicketEvent | null => {
  try {
    const v = JSON.parse(payload ?? "");
    return Number.isInteger(v?.n) && typeof v?.a === "string" && ["merchant", "staff", "note"].includes(v?.k) ? (v as TicketEvent) : null;
  } catch {
    return null;
  }
};

/* null tells every stream "announcements may have been missed" (the connection was lost and is back): its page loads
   the conversation again */
function fanOut(e: TicketEvent | null) {
  for (const s of hub.subs) {
    if (e && !s.match(e)) continue;
    try {
      s.send(e);
    } catch {
      /* a stream that just closed: it takes itself off */
    }
  }
}

function retryLater() {
  clearTimeout(hub.retry);
  if (!hub.subs.size) return;
  hub.retry = setTimeout(() => void listen(), hub.retryMs + Math.floor(Math.random() * 250));
  hub.retryMs = Math.min(30_000, hub.retryMs * 2);
}

/** Opens the listening connection, if none is open and some page is waiting. Lost (Postgres restarted, the connection
    ended by hand, the network), it is opened again with a growing wait, and the pages are told to look again. */
async function listen(): Promise<void> {
  if (hub.client || hub.connecting || !hub.subs.size) return;
  hub.connecting = true;
  /* its own connection, not one of the pool's: it stays open and only listens (keepAlive: a dead network is noticed) */
  const c = new Client({ connectionString: process.env.DATABASE_URL, keepAlive: true });
  let gone = false;
  const lost = (why: string) => {
    if (gone) return;
    gone = true;
    if (hub.client === c) hub.client = null;
    c.removeAllListeners("notification");
    c.end().catch(() => {});
    console.error("[tickets] live connection lost:", why);
    retryLater();
  };
  c.on("error", (e) => lost(e.message));
  c.on("end", () => lost("ended"));
  c.on("notification", (m) => {
    if (m.channel !== CHANNEL) return;
    const e = parse(m.payload);
    if (e) fanOut(e);
  });
  try {
    await c.connect();
    await c.query(`LISTEN ${CHANNEL}`);
    if (gone) return;
    hub.client = c;
    hub.retryMs = 1000;
    /* what was announced while nobody listened (before this connection, or while it was down) is caught up */
    fanOut(null);
  } catch (e) {
    lost((e as Error).message);
  } finally {
    hub.connecting = false;
  }
  /* a connection whose network silently went away can look open for a long time: asked something every minute, one
     that doesn't answer within 10 s is dropped and opened again */
  hub.check ??= setInterval(() => {
    const live = hub.client;
    if (!live) return;
    const t = setTimeout(() => live.emit("error", new Error("no answer in 10 s")), 10_000);
    live.query("SELECT 1").then(
      () => clearTimeout(t),
      () => clearTimeout(t),
    );
  }, 60_000);
}

/* ---------------- one page's stream ---------------- */

/* open streams at most, per account or staff member (his tabs and devices; only tabs in view keep one open) and on
   this server in all. Above it the page is answered 429 and keeps checking every few seconds instead. */
const PER_PERSON = 6;
const IN_ALL = 2000;
/* a comment line this often, so Cloudflare's tunnel (and any proxy) never sees the stream idle and closes it */
const HEARTBEAT_MS = 20_000;
/* every third heartbeat (a minute) the person is checked again: signed out, the stream ends */
const RECHECK_EVERY = 3;
/* and a stream ends after 30 minutes anyway; the page opens a new one at once, checked from the start */
const LIFETIME_MS = 30 * 60_000;

export const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  /* no-transform: neither Next's own compression nor a proxy may hold the stream back to squeeze it */
  "Cache-Control": "no-cache, no-transform",
  /* nginx-style proxies: don't buffer */
  "X-Accel-Buffering": "no",
};

/** A Server-Sent Events stream for one page: an `event: ticket` line ({ n: number, k: kind }) for each announcement
    `match` lets through, `event: resync` when some may have been missed, a heartbeat comment every 20 s. `who` names
    the person (for the per-person ceiling); `still` checks every minute that they may still listen. The caller has
    already checked who is asking and that the ticket is theirs. */
export function eventStream(req: NextRequest, who: string, match: (e: TicketEvent) => boolean, still: () => Promise<boolean>): NextResponse {
  if ((hub.open.get(who) ?? 0) >= PER_PERSON || hub.total >= IN_ALL) return answer({ result: "too-many" }, 429);
  hub.open.set(who, (hub.open.get(who) ?? 0) + 1);
  hub.total++;

  const enc = new TextEncoder();
  let done = false;
  let beat: ReturnType<typeof setInterval> | undefined;
  let end: ReturnType<typeof setTimeout> | undefined;
  let ctl: ReadableStreamDefaultController<Uint8Array> | null = null;
  const write = (text: string) => {
    if (done || !ctl) return;
    try {
      ctl.enqueue(enc.encode(text));
    } catch {
      stop();
    }
  };
  const sub: Sub = {
    match,
    send: (e) => write(e ? `event: ticket\ndata: ${JSON.stringify({ n: e.n, k: e.k })}\n\n` : `event: resync\ndata: {}\n\n`),
  };
  function stop() {
    if (done) return;
    done = true;
    clearInterval(beat);
    clearTimeout(end);
    hub.subs.delete(sub);
    const n = (hub.open.get(who) ?? 1) - 1;
    if (n > 0) hub.open.set(who, n);
    else hub.open.delete(who);
    hub.total = Math.max(0, hub.total - 1);
    try {
      ctl?.close();
    } catch {
      /* already closed by the browser leaving */
    }
  }

  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
      /* the browser waits 5 s before opening a stream that ended on its own again (the page's own code decides
         after an error, components/ticketStream.ts) */
      write(`retry: 5000\n: open\n\n`);
      hub.subs.add(sub);
      void listen();
      let beats = 0;
      beat = setInterval(() => {
        write(`: hb\n\n`);
        if (++beats % RECHECK_EVERY) return;
        still().then(
          (ok) => ok || stop(),
          () => {
            /* the database didn't answer: the next check tries again */
          },
        );
      }, HEARTBEAT_MS);
      end = setTimeout(stop, LIFETIME_MS);
    },
    cancel() {
      stop();
    },
  });
  /* the page closed or the connection dropped */
  req.signal.addEventListener("abort", stop, { once: true });
  return new NextResponse(body, { headers: STREAM_HEADERS });
}
