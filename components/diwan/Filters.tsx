"use client";

import { useId, useState } from "react";
import { ListBar, useT } from "./ui";

/* Diwan's filters: a "Filters" button that opens and closes the extra choices (lists, dates, ids), closed when the page
   opens. The button says how many are on, and "Clear" stays next to it while any is on, even when the panel is closed.
   A search box that is the page's main way to find things (`search`) stays in view, beside the button. They sit at the
   end of the list's top row, on the same line as the page's tabs (`tabs`, at the start: ListBar), and the panel opens
   under the whole row. */
export function FilterBar({
  count,
  onClear,
  search,
  tabs,
  children,
  className = "mb-5",
}: {
  /** how many filters are on now (the search box not counted) */
  count: number;
  /** puts every filter back (and the search, if the page wants); shown only while something is on */
  onClear?: () => void;
  search?: React.ReactNode;
  /** the list's status tabs or chips, shown at the start of the same row */
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className={className}>
      <ListBar
        className=""
        tabs={tabs}
        filters={
          <>
            {/* a fixed width, so the box keeps its place at the end of the row; wider when it has the row to itself, so a
                long hint ("Store name or link, owner's name, …") still shows whole. Beside tabs on one line (from xl,
                ListBar) it is narrower, so the tabs keep as much of the line as they can */}
            {search && <div className={`w-full min-w-0 ${tabs ? "sm:w-72 xl:w-56 2xl:w-64" : "sm:w-80 lg:w-[28rem]"}`}>{search}</div>}
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
          </>
        }
      />
      <div id={panel} hidden={!open} className="mt-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
        {children}
      </div>
    </div>
  );
}
