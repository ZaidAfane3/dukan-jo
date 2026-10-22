"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { dc } from "./copy";

const BASE = 1100; /* the width of the store at 100% */
const MIN = 0.25;
const MAX = 1.5;
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));

const ic = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/**
 * The area that holds the store while it is edited. The store can be made smaller (or bigger) to see
 * the whole page at once, and moved by dragging the background, with the hand tool, or with the
 * scroll bars. Ctrl and the mouse wheel zoom too.
 */
export function Canvas({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const t = dc[lang].canvas;
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [height, setHeight] = useState(800);
  const [hand, setHand] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  /* Start at a size where the store fits the width of the screen */
  useEffect(() => {
    const b = box.current;
    if (b) setZoom(clamp(Math.floor(Math.min(1, (b.clientWidth - 40) / BASE) * 100) / 100));
  }, []);

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
      setZoom((z) => clamp(Math.round((z - e.deltaY * 0.002) * 100) / 100));
    };
    b.addEventListener("wheel", onWheel, { passive: false });
    return () => b.removeEventListener("wheel", onWheel);
  }, []);

  const fit = useCallback(() => {
    const b = box.current;
    if (!b) return;
    const z = Math.min((b.clientWidth - 40) / BASE, (b.clientHeight - 40) / height);
    setZoom(clamp(Math.floor(z * 100) / 100));
    b.scrollTo({ top: 0, left: 0 });
  }, [height]);

  const step = (d: number) => setZoom((z) => clamp(Math.round((z + d) * 100) / 100));

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
    <div className="relative min-h-0 flex-1 bg-soft">
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
        <div data-pan className="relative mx-auto" dir="ltr" style={{ width: BASE * zoom, height: height * zoom, minWidth: 0 }}>
          <div ref={frame} className="absolute start-0 top-0 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10" style={{ width: BASE, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            {children}
          </div>
          {/* With the hand tool on, a drag anywhere moves the page, and clicks do not edit */}
          {hand && <div className="absolute inset-0 z-20" data-pan />}
        </div>
        <div data-pan className="h-24" />
      </div>

      <div className="absolute bottom-4 start-4 z-20 flex items-center gap-1 rounded-xl bg-card p-1 shadow-lg ring-1 ring-fg/10">
        <button type="button" className={btn} onClick={() => step(-0.1)} disabled={zoom <= MIN} aria-label={t.out} title={t.out}>
          <svg {...ic}><path d="M5 12h14" /></svg>
        </button>
        <button type="button" onClick={() => setZoom(1)} title={t.reset} className="min-w-[3.25rem] rounded-lg px-1 py-2 text-center text-xs font-bold transition hover:bg-fg/10">
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
}
