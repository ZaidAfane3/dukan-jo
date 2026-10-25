"use client";

/* Choose the part of a picture that stays visible when the store crops it (tall, square or wide). The merchant taps or drags on
   the picture; the three small pictures show the result. Used in the product form and in the store designer. */

export type Focus = { x: number; y: number };

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
  labels: { tall: string; square: string; wide: string; center: string };
}) {
  const at = (e: React.PointerEvent<HTMLDivElement>): Focus => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
    return { x: pct(((e.clientX - r.left) / r.width) * 100), y: pct(((e.clientY - r.top) / r.height) * 100) };
  };
  return (
    <div>
      <div className="grid items-start gap-4">
        <div
          className={`relative w-full max-w-xs touch-none overflow-hidden rounded-lg ring-1 ring-fg/15 ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
          onPointerDown={(e) => {
            if (disabled) return onBlocked?.();
            e.currentTarget.setPointerCapture(e.pointerId);
            onChange(at(e));
          }}
          onPointerMove={(e) => {
            if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
            onChange(at(e));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" draggable={false} className="block w-full select-none" />
          <span aria-hidden className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/10 shadow-[0_0_0_2px_rgba(0,0,0,0.45)]" style={{ left: `${value.x}%`, top: `${value.y}%` }} />
        </div>
        <div className="flex gap-3">
          {([[labels.tall, "4 / 5"], [labels.square, "1 / 1"], [labels.wide, "4 / 3"]] as const).map(([name, ratio]) => (
            <div key={name} className="w-16 text-center">
              <span className="block overflow-hidden rounded-md ring-1 ring-fg/15" style={{ aspectRatio: ratio }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${value.x}% ${value.y}%` }} />
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
            </div>
          ))}
        </div>
      </div>
      {(value.x !== 50 || value.y !== 50) && !disabled && (
        <button type="button" onClick={() => onChange({ x: 50, y: 50 })} className="mt-3 text-sm font-semibold text-primary hover:underline">{labels.center}</button>
      )}
    </div>
  );
}
