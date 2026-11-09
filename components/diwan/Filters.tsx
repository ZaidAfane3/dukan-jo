"use client";

import { useId, useState } from "react";
import { useT } from "./ui";

/* Diwan's filters: a "Filters" button that opens and closes the extra choices (lists, dates, ids), closed when the page
   opens. The button says how many are on, and "Clear" stays next to it while any is on, even when the panel is closed.
   A search box that is the page's main way to find things (`search`) stays in view, beside the button. */
export function FilterBar({
  count,
  onClear,
  search,
  children,
  className = "mb-5",
}: {
  /** how many filters are on now (the search box not counted) */
  count: number;
  /** puts every filter back (and the search, if the page wants); shown only while something is on */
  onClear?: () => void;
  search?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {search && <div className="min-w-0 flex-1 basis-56">{search}</div>}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            open || count > 0 ? "bg-primary/10 text-primary ring-1 ring-primary/30 hover:bg-primary/15" : "border border-fg/15 bg-card hover:bg-soft"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          {t("Filters", "التصفية")}
          {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-white">{count}</span>}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {count > 0 && onClear && (
          <button type="button" onClick={onClear} className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg">
            {t("Clear", "مسح")}
          </button>
        )}
      </div>
      <div id={panel} hidden={!open} className="mt-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
        {children}
      </div>
    </div>
  );
}
