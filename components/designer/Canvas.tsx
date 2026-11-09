"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { dc } from "./copy";
import { useSpots, type Spot } from "../storefront/spotSignal";

const BASE = 1100; /* the width of the store at 100% */
/* the store at a phone's width (the phone view of the preview): the store draws its phone layout there, as customers on phones see it */
const PHONE = 390;
const MIN = 0.25; /* the smallest zoom of the buttons and the wheel */
const FIT_MIN = 0.05; /* "Whole page" goes lower when a long page needs it */
const MAX = 1.5;
/* A zoom chosen by hand stays usable, but a smaller one already shown (from "Whole page") is not pushed back up by a zoom out */
const clamp = (z: number, now = MIN) => Math.min(MAX, Math.max(Math.min(MIN, now), z));
/* On a narrow screen the whole store is too small to read: a part being edited there is shown at this zoom */
const READ = 0.6;

/* Where each part the settings point at is drawn in the store (see spotSignal): the first one of these that is seen. A part
   of its own carries data-spot; a block of the page is its data-sf, and one of its texts the data-pick inside it. */
/* (in order: the first selector that finds something seen wins) */
const SPOT_AT: Record<string, string[]> = {
  /* the header's links, or with the sidebar style its button */
  nav: ['header [data-spot="nav"]', "header nav", '[data-spot="menu"]'],
  search: ['[data-spot="search"]', "[data-search-zone]", "header label:has(input)", "header button[aria-expanded]"],
  sidebar: ['[role="dialog"] > nav'],
  cards: ["main article"],
  footer: ['footer[data-sf="footer"]'],
};
const seen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
function spotEl(frame: HTMLElement, key: string): HTMLElement | null {
  const sec = /^sec:([^:]+)(?::(.+))?$/.exec(key);
  const inSec = sec ? `[data-sf="${CSS.escape(sec[1])}"]` : "";
  /* a block's title drawn as its usual heading has no data-pick of its own: its h2 */
  const at = SPOT_AT[key] ?? (sec ? (sec[2] ? [`${inSec} [data-pick="${CSS.escape(sec[2])}"]`, ...(sec[2] === "title" ? [`${inSec} h2`] : [])] : [inSec]) : [`[data-spot="${CSS.escape(key)}"]`]);
  for (const sel of at) {
    try {
      const el = Array.from(frame.querySelectorAll<HTMLElement>(sel)).find(seen);
      if (el) return el;
    } catch {
      /* a selector this browser does not know (:has) */
    }
  }
  return null;
}
/* the newest settings that point at something the store shows (an older one when the newest has no place of its own) */
function findSpot(frame: HTMLElement, spots: Spot[]): { el: HTMLElement; spot: Spot } | null {
  for (const spot of spots) {
    const el = spotEl(frame, spot.key);
    if (el) return { el, spot };
  }
  return null;
}
/* the room between the outline and what it marks */
const SPOT_GAP = 6;

const ic = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/**
 * The area that holds the store while it is edited. The store can be made smaller (or bigger) to see
 * the whole page at once, and moved by dragging the background, with the hand tool, or with the
 * scroll bars. Ctrl and the mouse wheel zoom too.
 */
export const Canvas = memo(function Canvas({ lang, reveal, frameOn = null, phone = false, onPhone, children }: { lang: Lang; /* the store shown at a phone's width, and the switch between computer and phone */ phone?: boolean; onPhone?: (on: boolean) => void; /* an element just added: the store scrolls down to it */ reveal?: { id: string; n: number } | null; /* a part of the store (its data-sf) being edited: on a narrow screen it is zoomed to a readable size */ frameOn?: string | null; children: React.ReactNode }) {
  const t = dc[lang].canvas;
  /* the store's width now: a computer's or a phone's (read by the effects through baseNow, so they follow a switch) */
  const base = phone ? PHONE : BASE;
  const baseNow = useRef(base);
  baseNow.current = base;
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [height, setHeight] = useState(800);
  const [hand, setHand] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  /* Start at a size where the store fits the width of the screen, and keep fitting it when the window changes size,
     until the merchant picks a zoom of his own */
  const autoZoom = useRef(true);
  /* the zoom was raised to read the part being edited (see frameOn below) */
  const framed = useRef(false);
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const fitWidth = () => { if (autoZoom.current && !framed.current) setZoom(clamp(Math.floor(Math.min(1, (b.clientWidth - 40) / baseNow.current) * 100) / 100)); };
    fitWidth();
    const ro = new ResizeObserver(fitWidth);
    ro.observe(b);
    return () => ro.disconnect();
  }, []);

  /* switching between computer and phone fits the new width again, from the top of the page */
  const firstSwitch = useRef(true);
  useEffect(() => {
    if (firstSwitch.current) { firstSwitch.current = false; return; }
    const b = box.current;
    if (!b) return;
    autoZoom.current = true;
    framed.current = false;
    setZoom(clamp(Math.floor(Math.min(1, (b.clientWidth - 40) / base) * 100) / 100));
    b.scrollTo({ top: 0, left: 0 });
  }, [base]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Ctrl (or Cmd) and the wheel zoom the store, not the whole browser page */
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      autoZoom.current = false;
      framed.current = false;
      setZoom((z) => clamp(Math.round((z - e.deltaY * 0.002) * 100) / 100, z));
    };
    b.addEventListener("wheel", onWheel, { passive: false });
    return () => b.removeEventListener("wheel", onWheel);
  }, []);

  /* A new element appears at the end of the page: bring it into view, with a little room above it for its name tag */
  useEffect(() => {
    if (!reveal) return;
    let tries = 0;
    let id = 0;
    const go = () => {
      const b = box.current;
      const el = frame.current?.querySelector<HTMLElement>(`[data-sf="${reveal.id}"]`);
      if (!b || !el) {
        if (tries++ < 20) id = requestAnimationFrame(go);
        return;
      }
      const top = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 40;
      b.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    id = requestAnimationFrame(go);
    return () => cancelAnimationFrame(id);
  }, [reveal]);

  /* What the open settings change (spotSignal), and the part being edited on a phone (frameOn): the preview brings it into
     view and outlines it with its name, like a selected block. */
  const spots = useSpots();
  const aims: Spot[] = frameOn ? [...spots, { key: frameOn === "footer" ? "footer" : `sec:${frameOn}`, label: "", ring: false }] : spots;
  const aimKey = aims.map((s) => s.key).join("|");
  const aimsNow = useRef(aims);
  aimsNow.current = aims;
  const zoomNow = useRef(zoom);
  zoomNow.current = zoom;
  /* the canvas hidden (a phone showing the settings) has no size: it brings the part into view once it shows again */
  const [shownN, setShownN] = useState(0);
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    let was = b.clientWidth > 0;
    const ro = new ResizeObserver(() => {
      const is = b.clientWidth > 0;
      if (is && !was) setShownN((n) => n + 1);
      was = is;
    });
    ro.observe(b);
    return () => ro.disconnect();
  }, []);

  /* On a narrow screen (a phone) the part is made big enough to read and kept in view while the store settles; on a wide one it
     is scrolled into view once, only when it is not already seen. When nothing is pointed at, a narrow store goes back to
     fitting the width, unless the merchant picked a zoom of his own meanwhile. */
  useEffect(() => {
    const b = box.current;
    if (!b || b.clientWidth === 0) return;
    const narrow = (b.clientWidth - 40) / baseNow.current < READ - 0.1;
    if (!aimKey) {
      if (framed.current && autoZoom.current) setZoom(clamp(Math.floor(Math.min(1, (b.clientWidth - 40) / baseNow.current) * 100) / 100));
      framed.current = false;
      return;
    }
    if (narrow) {
      framed.current = true;
      setZoom((z) => Math.max(z, READ));
    }
    const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    /* The panel and the store change size for a moment after the part opens (the zoom, the panel's new form, a dashed place
       for an empty part): it is looked for a little while, until the merchant scrolls or touches the canvas himself */
    let frames = 0;
    let done = false;
    let id = 0;
    const go = () => {
      const f = frame.current;
      const hit = f ? findSpot(f, aimsNow.current) : null;
      if (hit) {
        const r = hit.el.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (narrow) {
          /* the store is laid out left to right in the canvas: an Arabic store starts on the right. It stays at its start
             edge when the part shows from there; a part further along (the links at the far end of the header, a "view
             all") is brought in, its start first when it is wider than the screen */
          const rtl = getComputedStyle(hit.el).direction === "rtl";
          /* where the part would be with the canvas at its start edge (scroll 0: the left in English, the right in Arabic) */
          const x0 = r.left - rb.left + b.scrollLeft;
          const x1 = r.right - rb.left + b.scrollLeft;
          const w = b.clientWidth;
          const left = x1 - x0 > w - 32 ? (rtl ? x1 - (w - 16) : x0 - 16) : x1 > w - 16 ? x1 - (w - 16) : x0 < 16 ? x0 - 16 : 0;
          b.scrollTo({ top: Math.max(0, r.top - rb.top + b.scrollTop - 40), left });
        } else if (!done && frames > 2) {
          done = true;
          const seen = r.top >= rb.top + 8 && r.bottom <= rb.bottom - 8;
          if (!seen) {
            /* in the middle of the view, or its top a little under the view's top when it is taller than the view */
            const room = rb.height - r.height;
            const top = r.top - rb.top + b.scrollTop - (room > 120 ? room / 2 : 48);
            b.scrollTo({ top: Math.max(0, top), behavior: smooth });
          }
        }
      }
      if (frames++ < 45 && !(done && !narrow)) id = requestAnimationFrame(go);
    };
    const stop = () => cancelAnimationFrame(id);
    id = requestAnimationFrame(go);
    b.addEventListener("wheel", stop, { passive: true });
    b.addEventListener("pointerdown", stop);
    b.addEventListener("touchstart", stop, { passive: true });
    return () => {
      stop();
      b.removeEventListener("wheel", stop);
      b.removeEventListener("pointerdown", stop);
      b.removeEventListener("touchstart", stop);
    };
  }, [aimKey, shownN]);

  /* The outline and name tag of what is pointed at, measured in the store's own pixels (the store may be shown smaller), and
     measured again while it is pointed at: the store changes as he edits */
  const [mark, setMark] = useState<{ top: number; left: number; width: number; height: number; label: string } | null>(null);
  useEffect(() => {
    if (!aimKey) return setMark(null);
    const measure = () => {
      const f = frame.current;
      const hit = f ? findSpot(f, aimsNow.current) : null;
      if (!f || !hit || hit.spot.ring === false) return setMark((m) => (m ? null : m));
      const z = zoomNow.current || 1;
      const r = hit.el.getBoundingClientRect();
      const rf = f.getBoundingClientRect();
      const left = Math.max(3, Math.round((r.left - rf.left) / z) - SPOT_GAP);
      const right = Math.min(baseNow.current - 3, Math.round((r.right - rf.left) / z) + SPOT_GAP);
      const top = Math.max(3, Math.round((r.top - rf.top) / z) - SPOT_GAP);
      const bottom = Math.round((r.bottom - rf.top) / z) + SPOT_GAP;
      const next = { top, left, width: right - left, height: bottom - top, label: hit.spot.label };
      setMark((m) => (m && m.top === next.top && m.left === next.left && m.width === next.width && m.height === next.height && m.label === next.label ? m : next));
    };
    const first = requestAnimationFrame(measure);
    const every = setInterval(measure, 200);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(every);
    };
  }, [aimKey, zoom, shownN]);

  const fit = useCallback(() => {
    const b = box.current;
    if (!b) return;
    const z = Math.min((b.clientWidth - 40) / baseNow.current, (b.clientHeight - 40) / height);
    autoZoom.current = false;
    framed.current = false;
    /* the whole page, however long it is: only a hard floor so the store never vanishes */
    setZoom(Math.min(MAX, Math.max(FIT_MIN, Math.floor(z * 100) / 100)));
    b.scrollTo({ top: 0, left: 0 });
  }, [height]);

  const step = (d: number) => {
    autoZoom.current = false;
    framed.current = false;
    setZoom((z) => clamp(Math.round((z + d) * 100) / 100, z));
  };

  const down = (e: React.MouseEvent) => {
    const b = box.current;
    if (!b) return;
    const onBackground = (e.target as HTMLElement).dataset.pan !== undefined;
    if (!(hand || e.button === 1 || onBackground)) return;
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, left: b.scrollLeft, top: b.scrollTop };
    setDragging(true);
  };
  const move = (e: React.MouseEvent) => {
    const d = drag.current;
    const b = box.current;
    if (!d || !b) return;
    b.scrollLeft = d.left - (e.clientX - d.x);
    b.scrollTop = d.top - (e.clientY - d.y);
  };
  const up = () => {
    drag.current = null;
    setDragging(false);
  };

  const btn = "grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30";

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-soft">
      <div
        ref={box}
        data-pan
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={up}
        className={`h-full overflow-auto p-5 [background-image:radial-gradient(rgb(var(--fg)/0.14)_1px,transparent_1px)] [background-size:16px_16px] ${dragging ? "cursor-grabbing select-none" : hand ? "cursor-grab" : ""}`}
      >
        {/* The box has the size of the scaled store, so the scroll bars match what is shown */}
        <div data-pan className="relative mx-auto" dir="ltr" style={{ width: base * zoom, height: height * zoom, minWidth: 0 }}>
          {/* The name tag of a selected element sits over the store's header, so the first element's tag is not hidden under it */}
          <div ref={frame} className={`absolute start-0 top-0 overflow-hidden bg-white shadow-2xl ${phone ? "rounded-[2rem] ring-[6px] ring-[#1c1a17]" : "rounded-2xl ring-1 ring-black/10"} [&_[data-sf]>div>span:last-child]:z-30`} style={{ width: base, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            {children}
            {/* what the open settings change: the same teal outline and name tag as a selected block */}
            {mark && (
              <>
                <span aria-hidden data-spot-mark className="pointer-events-none absolute z-40 rounded-[10px] ring-2 ring-[#14b8a6] transition-[top,left,width,height] duration-200" style={{ top: mark.top, left: mark.left, width: mark.width, height: mark.height }} />
                {mark.label && (
                  <span aria-hidden dir={lang === "ar" ? "rtl" : "ltr"} className="pointer-events-none absolute z-40 max-w-[60%] -translate-y-1/2 truncate rounded-md bg-[#14b8a6] px-2.5 py-1 text-[11px] font-bold text-white shadow" style={{ /* at the very top of the page the tag would cover what it names: it sits on the outline's lower edge instead */ top: mark.top >= 14 ? mark.top : mark.top + mark.height, /* at the reading start of the outline, unless that would push it off the page's edge */ ...((lang === "ar" ? mark.left + mark.width > 240 : mark.left > base - 240) ? { right: base - mark.left - mark.width + 8 } : { left: mark.left + 8 }) }}>
                    {mark.label}
                  </span>
                )}
              </>
            )}
          </div>
          {/* With the hand tool on, a drag anywhere moves the page, and clicks do not edit */}
          {hand && <div className="absolute inset-0 z-20" data-pan />}
        </div>
        <div data-pan className="h-24" />
      </div>

      <div className="absolute bottom-4 start-4 z-20 flex items-center gap-1 rounded-xl bg-card p-1 shadow-lg ring-1 ring-fg/10">
        {/* computer or phone: how the store looks on each */}
        {onPhone && (
          <>
            <div role="group" aria-label={t.view} className="flex items-center gap-0.5">
              <button type="button" className={`${btn} ${!phone ? "bg-primary/15 !text-primary" : ""}`} onClick={() => onPhone(false)} aria-pressed={!phone} aria-label={t.desktop} title={t.desktop}>
                <svg {...ic}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></svg>
              </button>
              <button type="button" className={`${btn} ${phone ? "bg-primary/15 !text-primary" : ""}`} onClick={() => onPhone(true)} aria-pressed={phone} aria-label={t.phone} title={t.phone}>
                <svg {...ic}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></svg>
              </button>
            </div>
            <span className="mx-1 h-6 w-px bg-fg/10" />
          </>
        )}
        <button type="button" className={btn} onClick={() => step(-0.1)} disabled={zoom <= MIN} aria-label={t.out} title={t.out}>
          <svg {...ic}><path d="M5 12h14" /></svg>
        </button>
        <button type="button" onClick={() => { autoZoom.current = false; framed.current = false; setZoom(1); }} title={t.reset} className="min-w-[3.25rem] rounded-lg px-1 py-2 text-center text-xs font-bold transition hover:bg-fg/10">
          <span dir="ltr">{Math.round(zoom * 100)}%</span>
        </button>
        <button type="button" className={btn} onClick={() => step(0.1)} disabled={zoom >= MAX} aria-label={t.in} title={t.in}>
          <svg {...ic}><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <span className="mx-1 h-6 w-px bg-fg/10" />
        <button type="button" className={`${btn} w-auto gap-1.5 px-2.5 text-xs font-semibold`} onClick={fit} title={t.fit}>
          <svg {...ic} className="h-4 w-4"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>
          {t.fit}
        </button>
        <button type="button" className={`${btn} ${hand ? "bg-primary/15 !text-primary" : ""}`} onClick={() => setHand((h) => !h)} aria-pressed={hand} aria-label={t.hand} title={t.hand}>
          <svg {...ic}><path d="M8 12V6a1.500 1.500 0 0 1 3 0v5M11 11V4.500a1.500 1.500 0 0 1 3 0V11M14 11V6a1.500 1.500 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2-3a1.500 1.500 0 0 1 2.500-1.600L8 15" /></svg>
        </button>
      </div>
    </div>
  );
});
