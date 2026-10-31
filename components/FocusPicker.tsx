"use client";

import { useRef } from "react";

/* Choose the part of a picture that stays visible when the store crops it (tall, square or wide), and how much to zoom in on it
   (to crop closer). The merchant taps (or with a mouse, drags) on the picture and moves the zoom; the three small pictures
   show the result. On a touch screen a swipe over the picture scrolls the page as anywhere else, and only a tap moves the
   point, so a tall picture never traps the page.
   Used in the product form and in the store designer. */

export type Focus = { x: number; y: number; /* 1 = the whole picture; up to 3 = zoomed in on the point */ zoom?: number };

/** How a picture sits in its frame for a focus: the point stays visible, and with a zoom the picture grows around that point */
export const focusStyle = (f?: Focus): React.CSSProperties | undefined =>
  f ? { objectPosition: `${f.x}% ${f.y}%`, ...(f.zoom && f.zoom > 1 ? { transform: `scale(${f.zoom})`, transformOrigin: `${f.x}% ${f.y}%` } : {}) } : undefined;

export function FocusPicker({
  image,
  value,
  onChange,
  disabled = false,
  onBlocked,
  labels,
}: {
  image: string;
  value: Focus;
  onChange: (f: Focus) => void;
  disabled?: boolean;
  /* Called when he tries to change it while it is switched off (the platform tour) */
  onBlocked?: () => void;
  labels: { tall: string; square: string; wide: string; center: string; zoom?: string };
}) {
  const zoom = value.zoom ?? 1;
  /* where a finger went down: it is a tap (the point moves there) only if it lifts without moving away */
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const at = (e: React.PointerEvent<HTMLDivElement>): Focus => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
    return { x: pct(((e.clientX - r.left) / r.width) * 100), y: pct(((e.clientY - r.top) / r.height) * 100), zoom: value.zoom };
  };
  return (
    <div>
      <div className="grid items-start gap-4">
        {/* as big as the picture itself (so a spot on it is a spot on the picture), and never taller than about half the screen */}
        <div
          className={`relative w-fit max-w-full touch-pan-y justify-self-start overflow-hidden rounded-lg ring-1 ring-fg/15 sm:max-w-xs ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
          onPointerDown={(e) => {
            if (disabled) return onBlocked?.();
            if (e.pointerType === "touch") {
              touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            onChange(at(e));
          }}
          onPointerMove={(e) => {
            if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
            onChange(at(e));
          }}
          onPointerUp={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!disabled && t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) onChange(at(e));
          }}
          /* the finger moved on and the page scrolled */
          onPointerCancel={() => (touch.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" draggable={false} className="block h-auto max-h-[min(55vh,26rem)] w-auto max-w-full select-none" />
          <span aria-hidden className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/10 shadow-[0_0_0_2px_rgba(0,0,0,0.45)]" style={{ left: `${value.x}%`, top: `${value.y}%` }} />
        </div>
        <div className="flex gap-3">
          {([[labels.tall, "4 / 5"], [labels.square, "1 / 1"], [labels.wide, "4 / 3"]] as const).map(([name, ratio]) => (
            <div key={name} className="w-16 text-center">
              <span className="block overflow-hidden rounded-md ring-1 ring-fg/15" style={{ aspectRatio: ratio }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-full w-full object-cover" style={focusStyle(value)} />
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* zoom in to crop closer around the point */}
      <label className="mt-4 block max-w-xs">
        <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-fg/80">
          <span>{labels.zoom ?? "Zoom"}</span>
          <span dir="ltr" className="tabular-nums text-muted">{zoom.toFixed(1)}×</span>
        </span>
        <input type="range" min={1} max={3} step={0.1} value={zoom} disabled={disabled} onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })} aria-label={labels.zoom ?? "Zoom"} className="h-1.5 w-full cursor-pointer accent-[rgb(var(--primary))] disabled:cursor-not-allowed" />
      </label>
      {(value.x !== 50 || value.y !== 50 || zoom !== 1) && !disabled && (
        <button type="button" onClick={() => onChange({ x: 50, y: 50, zoom: 1 })} className="mt-3 text-sm font-semibold text-primary hover:underline">{labels.center}</button>
      )}
    </div>
  );
}
