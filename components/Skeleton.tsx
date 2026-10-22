"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** A shimmering placeholder block. Size and shape come from className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl ${className}`} />;
}

/** Mirrors the top of the real page: nav and hero with the dashboard card. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="bg-page">
      {/* Nav */}
      <div className="h-16 bg-soft/70">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
          <Skeleton className="h-8 w-24" />
          <div className="hidden gap-8 md:flex">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-soft">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
          <div>
            <Skeleton className="h-14 w-full max-w-md" />
            <Skeleton className="mt-3 h-14 w-2/3 max-w-xs" />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full max-w-lg" />
              <Skeleton className="h-4 w-11/12 max-w-lg" />
              <Skeleton className="h-4 w-3/4 max-w-lg" />
            </div>
            <div className="mt-8 flex gap-3">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-12 w-36" />
            </div>
          </div>
          <div className="rounded-3xl bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-8 w-48" />
            <div className="mt-6 flex h-28 items-end gap-2">
              {[40, 55, 45, 70, 60, 85, 75, 95].map((h, i) => (
                <Skeleton key={i} className="flex-1 !rounded-t-md !rounded-b-none" />
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Covers the page until fonts and saved preferences are ready, then fades out.
 * The real content stays in the DOM underneath, so nothing is hidden from
 * search engines or from visitors without JavaScript (see the noscript rule).
 */
export function SkeletonOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const minimum = new Promise((r) => setTimeout(r, 700));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.all([minimum, fonts]).then(() => {
      if (!cancelled) setVisible(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The skeleton mirrors the home page, so only show it there. */
  if (!mounted || pathname !== "/") return null;

  return (
    <div
      data-skeleton-overlay
      onTransitionEnd={() => !visible && setMounted(false)}
      className={`fixed inset-0 z-[100] overflow-hidden bg-page transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <PageSkeleton />
    </div>
  );
}
