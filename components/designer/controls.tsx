"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeHex } from "../safe";

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

/**
 * A setting that does nothing with the other choices: it stays in its place, greyed out and not pressable, with the reason
 * (and what to change) under it. Settings are never hidden for this, so nobody wonders where one went.
 */
export function Blocked({ when, why, children }: { when: boolean; why: string; children: React.ReactNode }) {
  /* not reachable with the keyboard either (set on the element: this React does not know the attribute) */
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.inert = when;
  }, [when]);
  if (!when) return <>{children}</>;
  return (
    <div>
      <div ref={box} aria-disabled className="pointer-events-none select-none opacity-45">
        {children}
      </div>
      <p className="mt-1 flex gap-1.5 text-[11px] leading-relaxed text-muted">
        <svg viewBox="0 0 24 24" className="mt-[3px] h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        <span>{why}</span>
      </p>
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

/* Whether a press (a mouse button or a finger) is under way, from the moment it goes down until its click. Leaving a field by
   pressing a button happens on the press, before the click (on a phone, even after the finger is lifted): anything that changes
   the layout at that moment would move the button away from under the pointer. */
let pressing = false;
let down = false; /* still held */
let released = 0;
const WAIT = 500; /* how long after the release a click may still come */
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => { pressing = down = true; clearTimeout(released); }, true);
  window.addEventListener("pointerup", () => { down = false; clearTimeout(released); released = window.setTimeout(() => (pressing = false), WAIT); }, true);
  window.addEventListener("pointercancel", () => (pressing = down = false), true);
  window.addEventListener("click", () => setTimeout(() => (pressing = false), 0), true);
}
/** Runs `fn` now, or, when a press is under way, just after its click (so the click lands where it was aimed). */
export function afterPress(fn: () => void) {
  if (!pressing) return fn();
  let id = 0;
  const done = () => {
    window.removeEventListener("click", done, true);
    window.removeEventListener("pointerup", wait, true);
    window.removeEventListener("pointercancel", done, true);
    clearTimeout(id);
    setTimeout(fn, 0);
  };
  /* no click after the release (the pointer was dragged away): run it anyway */
  const wait = () => { clearTimeout(id); id = window.setTimeout(done, WAIT); };
  window.addEventListener("click", done, true);
  window.addEventListener("pointerup", wait, true);
  window.addEventListener("pointercancel", done, true);
  /* a finger already lifted: its click is on its way */
  if (!down) id = window.setTimeout(done, WAIT);
}

const swatches = ["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"];
export const HEX = /^#[0-9a-f]{6}$/i;

/** A row of color circles plus a hex field. `onChange` only gets valid colors. */
export function ColorPicker({ value: given, onChange, label, bad, list = swatches }: { value: string; onChange: (v: string) => void; label: string; bad: string; list?: string[] }) {
  const value = given ?? "";
  /* what is written in the hex box: a color that is not finished or not right stays here, with the red note under it,
     and the store keeps its last good color until it is fixed */
  const [typed, setTyped] = useState(value);
  /* a code that was not a color was taken back when he left the box: the note stays until he writes or picks again */
  const [undone, setUndone] = useState(false);
  /* a new color from outside (a swatch, undo) is shown; the same color he is typing ("#abc" for #aabbcc) keeps his letters */
  useEffect(() => setTyped((t) => (normalizeHex(t) && normalizeHex(t) === normalizeHex(value) ? t : value)), [value]);
  const latest = useRef(value);
  latest.current = value;
  /* "#abc" and codes without "#" count too: the store gets the full code (#aabbcc) */
  const good = normalizeHex(typed);
  const ok = !!good;
  const pick = (v: string) => {
    setTyped(v);
    setUndone(false);
    onChange(v);
  };
  return (
    <div data-color-picker>
      {/* a little room around the row, so the ring of the picked color is never cut by the panel's edge */}
      <div className="flex flex-wrap gap-2.5 p-1">
        {list.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => pick(c)}
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            className={`grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-card transition hover:scale-110 ${value.toLowerCase() === c ? "ring-2 ring-fg" : "ring-1 ring-black/10"}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="mt-3 flex items-center gap-3">
        <span dir="ltr" className={`flex h-11 flex-1 items-center gap-3 rounded-xl border bg-card px-3 text-sm ${ok && !undone ? "border-fg/15" : "border-rose-500"}`}>
          <input
            type="color"
            value={good ?? normalizeHex(value) ?? "#000000"}
            onChange={(e) => pick(e.target.value)}
            aria-label={label}
            className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          <input
            value={typed}
            onChange={(e) => {
              /* one "#" in front, however it was typed or pasted ("##abc", "abc", " #ABC ") */
              const v = `#${e.target.value.replace(/\s/g, "").replace(/^#+/, "")}`.slice(0, 7);
              setTyped(v);
              setUndone(false);
              const full = normalizeHex(v);
              if (full) onChange(full);
            }}
            /* leaving the box: "#abc" is written out in full; a code that is not a color puts the last good color back (what shows
               is what gets saved) and the note stays, so the change back is never silent */
            onBlur={() => {
              if (good) { if (good !== typed.toLowerCase()) setTyped(good); return; }
              /* (leaving it by picking a swatch is not a change back: that new color is shown, with no note) */
              const before = latest.current;
              afterPress(() => { setTyped(latest.current); setUndone(latest.current === before); });
            }}
            spellCheck={false}
            aria-label={label}
            className="w-full bg-transparent font-mono uppercase outline-none"
          />
        </span>
      </label>
      {(!ok || undone) && <p role="alert" className="mt-1.5 text-xs text-rose-600">{bad}</p>}
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
