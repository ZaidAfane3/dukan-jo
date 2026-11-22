"use client";

import { useEffect, useRef } from "react";
import { moneyDecimals } from "./moneyText";

/* Small pieces the home page (Dashboard.tsx), Abandoned carts and Reports share. They live here, not in Reports.tsx, so
   the pages that only need a counting number or a refresh button don't load the whole Reports page with them. */

/** Small seeded random generator, so a given seed always gives the same numbers. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decimals for a percentage: one when it has a tenth, none when it is whole (0%, 25%, never 0.0% or 25.0%) */
export const pctDecimals = (v: number) => (Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);

/* how long a number takes to count to its new value */
const COUNT_MS = 800;

/** A number that counts from the one shown to its new value, slowing down at the end. Done with the browser's own
    animation frames (no animation library to load). */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  /* the number on screen now, so a new value counts on from there */
  const shown = useRef(0);
  const show = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  useEffect(() => {
    const from = shown.current;
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / COUNT_MS);
      /* ease out: fast at first, slow at the end */
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      shown.current = v;
      if (ref.current) ref.current.textContent = show(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);
  return <span ref={ref}>{show(0)}</span>;
}

export function Money({ value, currency }: { value: number; currency: string }) {
  return (
    <span dir="ltr" className="inline-flex items-baseline gap-1.5">
      <AnimatedNumber value={value} decimals={moneyDecimals(value)} />
      <small className="text-[0.45em] font-bold opacity-70">{currency}</small>
    </span>
  );
}

/** Refresh icon: spins while the widget reloads. */
export function RefreshButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full text-primary transition hover:bg-primary/10 disabled:cursor-progress"
    >
      <svg viewBox="0 0 24 24" className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12A9 9 0 0 1 18.5 5.8L21 8" />
        <path d="M21 3v5h-5M3 21v-5h5" />
      </svg>
    </button>
  );
}
