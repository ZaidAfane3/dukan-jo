"use client";

/* Cropping a picture before it is kept: the merchant drags the picture inside a frame and zooms. The frame has the shape the
   picture is shown in (square for a tab icon, wide for a banner...), and he can turn it. What he sees in the frame is exactly what is saved
   (components/designer/image.ts draws it with the same numbers). Used by every upload that keeps a cut picture: the store logo,
   the tab icon, icons, the setup logo and product picture, the invoice watermark and stamp.
   While he moves and zooms, `onLive` gets the cut picture again and again, so the page can show it where it will really be used
   (the avatar, the store preview, the invoice...) before he presses "Use this picture". */

import { useEffect, useRef, useState } from "react";
import { cropBox, cropPicture, fitZoom, type Crop } from "./designer/image";

type Lang = "en" | "ar";
export type CropShape = "square" | "wide" | "tall" | "original";

const words = {
  en: { hint: "Drag the picture to move it, zoom to cut closer, and turn it. Your store shows it as you go.", zoom: "Zoom", turn: "Turn", turn90: "Turn a quarter", use: "Use this picture", done: "Done", cancel: "Cancel", reset: "Reset", shape: "Shape", square: "Square", wide: "Wide", tall: "Tall", original: "As uploaded" },
  ar: { hint: "اسحب الصورة لتحريكها، وكبّر لقصّها أقرب، ودوّرها. متجرك يعرضها وأنت تعدّل.", zoom: "تكبير", turn: "تدوير", turn90: "تدوير ربع دورة", use: "استخدم هذه الصورة", done: "تم", cancel: "إلغاء", reset: "إعادة", shape: "الشكل", square: "مربع", wide: "عريض", tall: "طولي", original: "كما رُفعت" },
};

const RATIO: Record<Exclude<CropShape, "original">, number> = { square: 1, wide: 3, tall: 4 / 5 };

/* What every cut picture was cut from, and how: cropping it again starts from the ORIGINAL picture at the same place, zoom
   and turn, never from the cut one (which would only get smaller and blurrier each time). Kept while the page is open
   (a few at most); after a reload a picture is cropped from what was saved. With a backend, the original is kept with it. */
type Cut = { src: string; shape: CropShape; crop: Crop };
const cuts = new Map<string, Cut>();
const remember = (url: string, cut: Cut) => {
  cuts.set(url, cut);
  if (cuts.size > 24) cuts.delete(cuts.keys().next().value as string);
};

export function ImageCropper({
  lang,
  src: given,
  shapes = ["square"],
  out,
  type = "image/png",
  round = false,
  onDone,
  onCancel,
  onLive,
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
  /* the picture as it is cut right now (smaller, to stay quick), to show it in its real place while he crops */
  onLive?: (url: string) => void;
}) {
  const w = words[lang];
  /* a picture cut here before: start again from its original, as it was cut */
  const [before] = useState(() => cuts.get(given));
  const src = before?.src ?? given;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [shape, setShape] = useState<CropShape>(before && shapes.includes(before.shape) ? before.shape : shapes[0]);
  /* a photo (JPEG) always fills its frame: zoomed out, the empty room around it would be saved as white bars. A PNG (a logo)
     may be smaller than its frame, the room around it stays see-through. */
  const fills = type === "image/jpeg";
  const [crop, setCrop] = useState<Crop>(() => (before ? { ...before.crop, zoom: fills ? Math.max(1, before.crop.zoom) : before.crop.zoom } : { x: 0, y: 0, zoom: 1 }));
  const [busy, setBusy] = useState(false);
  const grab = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const live = useRef(onLive);
  live.current = onLive;

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = onCancel;
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  /* The live result follows his hand: while one cut is being drawn the newest position waits, and is drawn as soon as it is
     done (small, so it keeps up). Never after the cropper is closed. */
  const latest = useRef({ crop, shape });
  latest.current = { crop, shape };
  const drawing = useRef(false);
  const sharp = useRef<ReturnType<typeof setTimeout>>();
  const again = useRef(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => { open.current = false; clearTimeout(sharp.current); };
  }, []);
  useEffect(() => {
    if (!size || !live.current) return;
    if (drawing.current) {
      again.current = true;
      return;
    }
    drawing.current = true;
    void (async () => {
      do {
        again.current = false;
        const { crop: c, shape: sh } = latest.current;
        const url = await cropPicture(src, sh === "original" ? size.w / size.h : RATIO[sh], c, Math.min(out, 320), type);
        if (open.current && url) live.current?.(url);
      } while (again.current && open.current);
      drawing.current = false;
      /* once his hand stops, the store gets the picture at its full size, so leaving without pressing Done keeps it sharp */
      clearTimeout(sharp.current);
      sharp.current = setTimeout(() => {
        if (drawing.current || !open.current) return;
        const { crop: c, shape: sh } = latest.current;
        void cropPicture(src, sh === "original" ? size.w / size.h : RATIO[sh], c, out, type).then((url) => {
          if (!open.current || !url || drawing.current) return;
          remember(url, { src, shape: sh, crop: c });
          live.current?.(url);
        });
      }, 400);
    })();
  }, [size, shape, crop, src, out, type]);

  if (!size) return null;
  const ratio = shape === "original" ? size.w / size.h : RATIO[shape];
  const minZoom = fills ? 1 : Math.min(1, Math.round(fitZoom(size.w, size.h, ratio) * 100) / 100);
  const box = cropBox(size.w, size.h, ratio, crop);
  const set = (c: Crop) => {
    const b = cropBox(size.w, size.h, ratio, c);
    setCrop({ ...c, x: b.x, y: b.y });
  };
  /* degrees kept between -180 and 180 */
  const turn = (r: number) => set({ ...crop, r: Math.round(((((r % 360) + 540) % 360) - 180)) });
  const r = crop.r ?? 0;

  const use = async () => {
    setBusy(true);
    const url = await cropPicture(src, ratio, crop, out, type);
    setBusy(false);
    if (url) {
      remember(url, { src, shape, crop });
      onDone(url);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-3 rounded-xl border border-primary/40 bg-card p-3" data-cropper>
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
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, rotate: `${r}deg` }} />
      </div>
      <label className="flex items-center gap-3 text-xs font-semibold text-fg/80">
        {w.zoom}
        <input type="range" min={Math.round(minZoom * 100)} max={400} value={Math.round(crop.zoom * 100)} onChange={(e) => set({ ...crop, zoom: Number(e.target.value) / 100 })} aria-label={w.zoom} className="h-2 min-w-0 flex-1 accent-primary" />
        <span className="w-10 text-end tabular-nums" dir="ltr">{Math.round(crop.zoom * 100)}%</span>
      </label>
      {/* the turn: a slider, the degrees to type, and a quarter turn at a press */}
      <div className="flex items-center gap-3 text-xs font-semibold text-fg/80">
        <span>{w.turn}</span>
        <input type="range" min={-180} max={180} value={r} onChange={(e) => turn(Number(e.target.value))} aria-label={w.turn} className="h-2 min-w-0 flex-1 accent-primary" />
        <span className="flex items-center rounded-md border border-fg/15 pe-1.5" dir="ltr">
          <input type="number" min={-180} max={180} value={r} onChange={(e) => { const n = Number(e.target.value); if (e.target.value.trim() !== "" && Number.isFinite(n)) turn(n); }} aria-label={w.turn} className="w-10 bg-transparent py-1 text-end tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span>°</span>
        </span>
        <button type="button" onClick={() => turn(r + 90)} title={w.turn90} aria-label={w.turn90} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-fg/15 transition hover:bg-soft">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void use()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{busy ? "…" : onLive ? w.done : w.use}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
        {(crop.x !== 0 || crop.y !== 0 || crop.zoom !== 1 || r !== 0) && (
          <button type="button" onClick={() => setCrop({ x: 0, y: 0, zoom: 1 })} className="text-sm font-semibold text-primary hover:underline">{w.reset}</button>
        )}
      </div>
    </div>
  );
}
