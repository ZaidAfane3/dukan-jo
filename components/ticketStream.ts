"use client";

import { useEffect, useRef } from "react";

/* A live ticket stream on a page (server/ticketEvents.ts): while the page is in view it keeps a Server-Sent Events
   stream open and calls `changed` the moment the server says the ticket (or one of the tickets) changed, so the page
   loads it again through its usual route. A tab out of view closes it; coming back loads once and opens it again.

   It also keeps the page's own checks going, as a safety net: every `slowMs` while the stream is open (an announcement
   can be lost), every `fastMs` while it is not (it failed, the browser has no EventSource, the server answered 429). A
   failed stream is opened again after 1, 2, 4 ... up to 60 seconds. `poll: false` leaves the checks to the page (the
   bell, the sidebar's numbers, which have their own). */

const MAX_WAIT_MS = 60_000;
/* a stream that ended within this long of opening counts as a failure, so one closed again at once by a proxy doesn't
   reopen every second forever */
const SHORT_MS = 10_000;

export function useTicketStream(
  url: string | null,
  changed: () => void,
  { fastMs = 3_000, slowMs = 30_000, poll = true, catchUp = true }: { fastMs?: number; slowMs?: number; poll?: boolean; catchUp?: boolean } = {},
) {
  const changedRef = useRef(changed);
  changedRef.current = changed;

  useEffect(() => {
    if (!url) return;
    const supported = typeof window.EventSource !== "undefined";
    const inView = () => document.visibilityState === "visible";
    let es: EventSource | null = null;
    let live = false;
    let openedAt = 0;
    let fails = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let soon: ReturnType<typeof setTimeout> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    /* several announcements together (a status change and its line) load once */
    const kick = () => {
      clearTimeout(soon);
      soon = setTimeout(() => inView() && changedRef.current(), 60);
    };
    const checks = () => {
      clearInterval(timer);
      if (poll) timer = setInterval(() => inView() && changedRef.current(), live ? slowMs : fastMs);
    };
    const shut = () => {
      clearTimeout(retry);
      if (es) es.close();
      es = null;
      live = false;
    };
    const open = () => {
      clearTimeout(retry);
      if (!supported || es || !inView()) return;
      const s = new EventSource(url, { withCredentials: true });
      es = s;
      s.onopen = () => {
        if (es !== s) return;
        live = true;
        openedAt = Date.now();
        checks();
        /* what changed while it was not open (the first time: between the page's load and now) */
        if (catchUp) kick();
      };
      s.addEventListener("ticket", kick);
      s.addEventListener("resync", kick);
      s.onerror = () => {
        if (es !== s) return;
        /* the browser would retry by itself; this page decides when instead */
        const was = live && Date.now() - openedAt > SHORT_MS;
        shut();
        fails = was ? 0 : fails + 1;
        checks();
        if (!inView()) return;
        const wait = was ? 1000 : Math.min(MAX_WAIT_MS, 1000 * 2 ** Math.min(fails - 1, 6));
        retry = setTimeout(open, wait + Math.floor(Math.random() * 500));
      };
    };
    const onShow = () => {
      if (inView()) {
        /* back in view: loaded once at once (a page with poll: false does that itself) */
        if (poll) changedRef.current();
        open();
      } else shut();
      checks();
    };

    open();
    checks();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      shut();
      clearTimeout(soon);
      clearInterval(timer);
    };
  }, [url, fastMs, slowMs, poll, catchUp]);
}
