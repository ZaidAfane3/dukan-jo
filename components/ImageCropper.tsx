"use client";

/* Cropping a picture before it is kept: the merchant drags the picture inside a frame and zooms. The frame has the shape the
   picture is shown in (square for a tab icon, wide for a banner...). What he sees in the frame is exactly what is saved
   (components/designer/image.ts draws it with the same numbers). Used by every upload that keeps a cut picture: the store logo,
   the tab icon, icons, the setup logo and product picture, the invoice watermark and stamp. */

import { useEffect, useRef, useState } from "react";
import { cropBox, cropPicture, fitZoom, type Crop } from "./designer/image";

type Lang = "en" | "ar";
export type CropShape = "square" | "wide" | "tall" | "original";

const words = {
  en: { hint: "Drag the picture to move it, and zoom to cut closer.", zoom: "Zoom", use: "Use this picture", cancel: "Cancel", reset: "Reset", shape: "Shape", square: "Square", wide: "Wide", tall: "Tall", original: "As uploaded" },
  ar: { hint: "اسحب الصورة لتحريكها، وكبّر لقصّها أقرب.", zoom: "تكبير", use: "استخدم هذه الصورة", cancel: "إلغاء", reset: "إعادة", shape: "الشكل", square: "مربع", wide: "عريض", tall: "طولي", original: "كما رُفعت" },
};

const RATIO: Record<Exclude<CropShape, "original">, number> = { square: 1, wide: 3, tall: 4 / 5 };

export function ImageCropper({
  lang,
  src,
  shapes = ["square"],
  out,
  type = "image/png",
  round = false,
  onDone,
  onCancel,
}: {
  lang: Lang;
  /* the picture, already checked and redrawn (a data URL) */
  src: string;
  /* the frame shapes he can choose from; the first one is chosen at the start */
  shapes?: CropShape[];
  /* pixels of the result on its longer side */
  out: number;
  type?: "image/png" | "image/jpeg";
  /* the frame is shown round (it is shown round in the store) */
  round?: boolean;
  onDone: (url: string) => void;
  onCancel: () => void;
}) {
  const w = words[lang];
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [shape, setShape] = useState<CropShape>(shapes[0]);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const grab = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = onCancel;
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!size) return null;
  const ratio = shape === "original" ? size.w / size.h : RATIO[shape];
  const minZoom = Math.min(1, Math.round(fitZoom(size.w, size.h, ratio) * 100) / 100);
  const box = cropBox(size.w, size.h, ratio, crop);
  const set = (c: Crop) => {
    const b = cropBox(size.w, size.h, ratio, c);
    setCrop({ ...c, x: b.x, y: b.y });
  };

  const use = async () => {
    setBusy(true);
    const url = await cropPicture(src, ratio, crop, out, type);
    setBusy(false);
    if (url) onDone(url);
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-3" data-cropper>
      <p className="text-xs leading-relaxed text-muted">{w.hint}</p>
      {shapes.length > 1 && (
        <div role="radiogroup" aria-label={w.shape} className="flex flex-wrap gap-1.5">
          {shapes.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={s === shape} onClick={() => { setShape(s); setCrop({ x: 0, y: 0, zoom: 1 }); }} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${s === shape ? "border-primary bg-primary text-white" : "border-fg/20 hover:bg-soft"}`}>
              {w[s]}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative mx-auto w-full max-w-[16rem] touch-none select-none overflow-hidden ring-2 ring-primary/50"
        style={{
          aspectRatio: `${ratio}`,
          borderRadius: round ? "999px" : "10px",
          cursor: grab.current ? "grabbing" : "grab",
          /* a checkerboard shows the transparent parts */
          background: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 16px 16px",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          grab.current = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          const r = e.currentTarget.getBoundingClientRect();
          set({ ...crop, x: g.x + ((e.clientX - g.px) / r.width) * 100, y: g.y + ((e.clientY - g.py) / r.height) * 100 });
        }}
        onPointerUp={() => (grab.current = null)}
        onPointerCancel={() => (grab.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          const m = move[e.key];
          if (!m) return;
          e.preventDefault();
          set({ ...crop, x: box.x + m[0], y: box.y + m[1] });
        }}
        tabIndex={0}
        aria-label={w.hint}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }} />
      </div>
      <label className="flex items-center gap-3 text-xs font-semibold text-fg/80">
        {w.zoom}
        <input type="range" min={Math.round(minZoom * 100)} max={400} value={Math.round(crop.zoom * 100)} onChange={(e) => set({ ...crop, zoom: Number(e.target.value) / 100 })} aria-label={w.zoom} className="h-2 flex-1 accent-primary" />
        <span className="w-10 text-end tabular-nums" dir="ltr">{Math.round(crop.zoom * 100)}%</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void use()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{busy ? "…" : w.use}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
        {(crop.x !== 0 || crop.y !== 0 || crop.zoom !== 1) && (
          <button type="button" onClick={() => setCrop({ x: 0, y: 0, zoom: 1 })} className="text-sm font-semibold text-primary hover:underline">{w.reset}</button>
        )}
      </div>
    </div>
  );
}
