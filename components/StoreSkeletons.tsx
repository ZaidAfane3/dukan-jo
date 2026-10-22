import { Skeleton } from "./Skeleton";

/* Placeholders shaped like the storefront and the store designer, shown while they open. */

export function StoreSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="min-h-screen bg-[#eef0f0]">
      <div className="mx-auto max-w-[1180px] bg-white/60 px-4 pb-16 sm:px-6">
        {/* Header */}
        <div className="flex h-16 items-center gap-4">
          <Skeleton className="h-9 w-9 !rounded-full" />
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9 !rounded-full" />
          <Skeleton className="h-9 w-16" />
        </div>
        {/* Hero */}
        <Skeleton className="mt-2 h-64 w-full !rounded-3xl sm:h-80" />
        {/* Perks */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        {/* Products */}
        <Skeleton className="mt-10 h-7 w-40" />
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="aspect-square w-full !rounded-2xl" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DesignerSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="dash flex h-screen flex-col bg-page">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-fg/10 bg-card px-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-36" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <div className="hidden w-12 shrink-0 flex-col items-center gap-3 border-e border-fg/10 bg-card py-3 lg:flex">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-9" />
          ))}
        </div>
        {/* Panel */}
        <div className="hidden w-80 shrink-0 space-y-3 border-e border-fg/10 bg-card p-4 lg:block">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        {/* Canvas */}
        <div className="min-w-0 flex-1 p-6">
          <Skeleton className="mx-auto h-full max-w-4xl !rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
