"use client";

/* The sizes of clothing and shoes with a stock for each: the product form (Products.tsx) and the setup's first product
   (Onboarding.tsx) use this one editor */

import { useRef, useState } from "react";
import type { Lang } from "./content";
import { latin } from "./digits";
import { readPhoto } from "./designer/image";
import { keepPicture } from "./media";
import { kindWords, productsCopy, sizePresets } from "./productsContent";
import { RequiredMark } from "./Required";
import { SIZE_MAX, type ProductKind } from "./safeOrder";

/** The sizes of a piece of clothing or a pair of shoes: one press adds a usual size, each size has its own quantity.
    Without `onChart` the size chart part is left out (setup leaves it for the Products page). */
export function SizesEditor({ id = "p-sizes", lang, kind, sizes, onChange, chart = "", onChart, error, inputClass }: { id?: string; lang: Lang; kind: ProductKind; sizes: { name: string; quantity: string }[]; onChange: (v: { name: string; quantity: string }[]) => void; chart?: string; onChart?: (v: string) => void; error?: string; inputClass: string }) {
  const w = kindWords[lang];
  /* the size chart: a picture he uploads (a file that is not a picture says so) */
  const chartInput = useRef<HTMLInputElement>(null);
  const [chartBad, setChartBad] = useState(false);
  const [chartBusy, setChartBusy] = useState(false);
  const pickChart = async (f?: File) => {
    if (!f) return;
    setChartBusy(true);
    const read = f.size <= 8_000_000 ? await readPhoto(f, 1400) : null;
    /* a signed-in store keeps it on the server (components/media.ts); otherwise, or if it can't be sent now, it stays here */
    const url = read && (await keepPicture(read, "product"));
    setChartBusy(false);
    setChartBad(!url);
    if (url) onChart?.(url);
  };
  const has = (n: string) => sizes.some((z) => z.name.trim().toLowerCase() === n.toLowerCase());
  const presets = (sizePresets[kind] ?? sizePresets.clothing ?? []).filter((n) => !has(n));
  const total = sizes.reduce((n, z) => n + Math.max(0, Math.floor(Number(z.quantity) || 0)), 0);
  const edit = (i: number, patch: Partial<{ name: string; quantity: string }>) => onChange(sizes.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <div id={id} tabIndex={-1} className="space-y-3 outline-none">
      <div>
        <p className="text-sm font-semibold">{w.sizes}<RequiredMark /></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{w.sizesHint}</p>
      </div>
      {presets.length > 0 && sizes.length < SIZE_MAX.count && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted">{w.quick}</span>
          {presets.map((n) => (
            <button key={n} type="button" onClick={() => onChange([...sizes, { name: n, quantity: "0" }])} className="h-8 min-w-[2.5rem] rounded-lg border border-fg/15 px-2.5 text-xs font-bold transition hover:border-primary hover:bg-primary/10" dir="ltr">
              {n}
            </button>
          ))}
        </div>
      )}
      {sizes.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_2.25rem] gap-2 text-xs font-semibold text-muted">
            <span>{w.sizeName}</span>
            <span>{w.sizeQty}</span>
            <span />
          </div>
          {sizes.map((z, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2.25rem] items-center gap-2">
              <input value={z.name} onChange={(e) => edit(i, { name: e.target.value })} maxLength={SIZE_MAX.name} aria-label={w.sizeName} dir="auto" className={`${inputClass} h-10`} />
              <input value={z.quantity} onChange={(e) => edit(i, { quantity: latin(e.target.value).replace(/[^0-9]/g, "").slice(0, 6) })} inputMode="numeric" dir="ltr" aria-label={`${w.sizeQty} ${z.name}`} className={`${inputClass} h-10 text-start`} />
              <button type="button" onClick={() => onChange(sizes.filter((_, j) => j !== i))} aria-label={`${w.removeSize} ${z.name}`} title={w.removeSize} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {sizes.length < SIZE_MAX.count && (
        <button type="button" onClick={() => onChange([...sizes, { name: "", quantity: "0" }])} className="text-sm font-semibold text-primary hover:underline">{w.addSize}</button>
      )}
      {sizes.length > 0 && <p className="text-xs font-semibold">{w.total}: {productsCopy[lang].pieces(total)}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      {/* the size chart: optional, a picture customers open from the product page beside the sizes */}
      {onChart && (
      <div className="rounded-xl bg-soft/70 p-3">
        <p className="text-sm font-semibold">{w.chart} <span className="text-xs font-normal text-muted">{w.optional}</span></p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{w.chartHint}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {chart ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chart} alt={w.chart} className="h-20 w-28 rounded-lg bg-white object-contain ring-1 ring-fg/10" />
              <button type="button" onClick={() => chartInput.current?.click()} className="text-sm font-semibold text-primary hover:underline">{w.chartChange}</button>
              <button type="button" onClick={() => onChart("")} className="text-sm font-semibold text-rose-600 hover:underline">{w.chartRemove}</button>
            </>
          ) : (
            <button type="button" onClick={() => chartInput.current?.click()} disabled={chartBusy} className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-dashed border-fg/20 px-4 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary disabled:opacity-60">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" /></svg>
              {chartBusy ? w.chartBusy : w.chartUpload}
            </button>
          )}
        </div>
        {chartBad && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{w.chartBad}</p>}
        <input ref={chartInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void pickChart(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      )}
    </div>
  );
}
