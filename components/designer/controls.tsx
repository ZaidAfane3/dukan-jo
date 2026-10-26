"use client";

/* Form controls used by the designer's panels. */

export const input =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-fg/80">
        {/* a name that ends with * must be filled: the star is red */}
        {label.endsWith(" *") ? <>{label.slice(0, -2)}<span className="ms-1 text-rose-600">*</span></> : label}
      </p>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        dir="ltr"
        className="relative h-6 w-11 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]"
      >
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
      </span>
    </label>
  );
}

const swatches = ["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"];
export const HEX = /^#[0-9a-f]{6}$/i;

/** A row of color circles plus a hex field. `onChange` only gets valid colors. */
export function ColorPicker({ value, onChange, label, bad, list = swatches }: { value: string; onChange: (v: string) => void; label: string; bad: string; list?: string[] }) {
  const ok = HEX.test(value);
  return (
    <div data-color-picker>
      <div className="flex flex-wrap gap-2.5">
        {list.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            className={`grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-card transition hover:scale-110 ${value.toLowerCase() === c ? "ring-2 ring-fg" : "ring-1 ring-black/10"}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="mt-3 flex items-center gap-3">
        <span dir="ltr" className={`flex h-11 flex-1 items-center gap-3 rounded-xl border bg-card px-3 text-sm ${ok ? "border-fg/15" : "border-rose-500"}`}>
          <input
            type="color"
            value={ok ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          <input
            value={value}
            onChange={(e) => {
              const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              onChange(v.slice(0, 7));
            }}
            spellCheck={false}
            aria-label={label}
            className="w-full bg-transparent font-mono uppercase outline-none"
          />
        </span>
      </label>
      {!ok && <p className="mt-1.5 text-xs text-rose-600">{bad}</p>}
    </div>
  );
}

/** How many seconds between changes: quick choices, or any number from 1 to 60 typed in. */
export function SecondsPicker({ value, onChange, unit, presets = [3, 5, 8, 12] }: { value: number; onChange: (n: number) => void; unit: string; presets?: number[] }) {
  const clamp = (n: number) => Math.min(60, Math.max(1, Math.round(n)));
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {presets.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${value === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-card"}`}>
            {n}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          dir="ltr"
          type="number"
          min={1}
          max={60}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => e.target.value !== "" && onChange(clamp(Number(e.target.value)))}
          aria-label={unit}
          className={`${input} h-10 w-24 text-start`}
        />
        <span className="text-muted">{unit}</span>
      </label>
    </div>
  );
}
