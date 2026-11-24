"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Badge } from "../Badge";
import { timeoutSignal } from "../timeoutSignal";
import type { BadgeTab, NavItem } from "./nav";
import { BACKGROUND } from "./signInAgain";
import { DIWAN_CHANGED, useFmt, useT } from "./ui";

/* The red numbers beside the sidebar's pages: what is new to this staff member since they last opened each page
   (server/badges.ts says what counts). Kept on the server per staff member, so another browser or another member of the
   team has their own. The sidebar asks for them every 45 seconds while the window is in front, when it comes back to
   the front, and right after a change made in Diwan; opening a page clears its number. */

const EVERY_MS = 45_000;
const URL = "/api/diwan/badges";
export type BadgeCounts = Partial<Record<BadgeTab, number>>;

/** The numbers, and `seen(tab)` for a page just opened. `path`: the page on screen; opening a page's own list (not one
    ticket or one store inside it) is what clears it. */
export function useBadges(path: string, items: NavItem[]) {
  const [counts, setCounts] = useState<BadgeCounts>({});
  /* each ask gets a number, and only the latest one's answer is used: a slow answer from before a page was opened can't
     bring back the number it just cleared */
  const asked = useRef(0);
  const stopped = useRef(false);

  const load = useCallback(async () => {
    if (stopped.current || document.visibilityState === "hidden") return;
    const n = ++asked.current;
    try {
      const r = await fetch(URL, { credentials: "same-origin", cache: "no-store", headers: BACKGROUND, signal: timeoutSignal(15_000) });
      /* signed out: the page's own requests take the staff member to the sign-in; the numbers just stop */
      if (r.status === 401) stopped.current = true;
      const j = r.ok ? await r.json().catch(() => null) : null;
      if (n === asked.current && j?.counts) setCounts(j.counts);
    } catch {
      /* no connection: the numbers stay as they were until the next ask */
    }
  }, []);

  const seen = useCallback(async (tab: BadgeTab) => {
    const n = ++asked.current;
    setCounts((c) => ({ ...c, [tab]: 0 }));
    try {
      const r = await fetch(URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab }),
        signal: timeoutSignal(15_000),
      });
      /* signed in again (in another tab): the numbers start asking again */
      if (r.ok) stopped.current = false;
      const j = r.ok ? await r.json().catch(() => null) : null;
      if (n === asked.current && j?.counts) setCounts(j.counts);
    } catch {
      /* not saved: the number comes back at the next ask, and goes when the page is opened again */
    }
  }, []);

  /* every 45 seconds, when the window comes back to the front, and a moment after a change made in Diwan (several
     changes at once ask once) */
  useEffect(() => {
    let soon: ReturnType<typeof setTimeout> | undefined;
    /* a change that worked, or the window coming back, means the staff member may be signed in again after a 401 stopped
       the numbers (signed in again in another tab): they ask once more, and stop again if still signed out */
    const later = () => {
      stopped.current = false;
      clearTimeout(soon);
      soon = setTimeout(load, 400);
    };
    const back = () => {
      if (document.visibilityState !== "visible") return;
      stopped.current = false;
      load();
    };
    const timer = setInterval(load, EVERY_MS);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    window.addEventListener(DIWAN_CHANGED, later);
    return () => {
      clearTimeout(soon);
      clearInterval(timer);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener(DIWAN_CHANGED, later);
    };
  }, [load]);

  /* opening a page's list clears its number; any other page just asks for the numbers again. A layout effect, so the
     "seen" leaves before the page's own list is asked for (the page's effects run after this one): what arrives while
     the page loads is then shown in the list and counted as new, never lost between the two */
  const tabHere = items.find((i) => i.badge && i.href === path)?.badge;
  useLayoutEffect(() => {
    if (tabHere) seen(tabHere);
    else load();
  }, [path, tabHere, seen, load]);

  return { counts, seen };
}

/** The words for a number, for screen readers and tooltips: "3 new items", «3 عناصر جديدة» */
export function useNewWords() {
  const f = useFmt();
  return (n: number) => f.count(n, ["new item", "new items"], { one: "عنصر جديد واحد", two: "عنصران جديدان", few: "عناصر جديدة", many: "عنصرًا جديدًا" });
}

/** The red circle with how many are new (the shared Badge, components/Badge.tsx: the same look as the merchant
    dashboard's, a phone's app-icon badge, "99+" past 99). Its words for screen readers ("3 new items") sit beside the
    number, which is only drawn; `quiet` leaves them out where the link's own label already says them (the slim sidebar).
    `corner`: placed on the corner of an icon. */
export function NewBadge({ n, corner = false, quiet = false }: { n: number | undefined; corner?: boolean; quiet?: boolean }) {
  const t = useT();
  const f = useFmt();
  const words = useNewWords();
  if (!n || n < 1) return null;
  return (
    <Badge
      n={n}
      num={f.num}
      corner={corner}
      at="-top-1 end-0.5"
      ring="ring-[#f6f2ea] dark:ring-page"
      label={quiet ? null : t(`, ${words(n)}`, `، ${words(n)}`)}
    />
  );
}
