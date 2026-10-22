import { Skeleton } from "./Skeleton";

/* Loading placeholders that match the page being opened: the dashboard frame
   (sidebar and header) stays the same, and only the content area changes. */

export type DashVariant = "home" | "reports" | "table" | "split" | "invoice" | "form" | "carts";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";

function Frame({ tabs = 1, children }: { tabs?: number; children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" className="dash min-h-screen bg-page">
      {/* Sidebar */}
      <aside aria-hidden className="fixed inset-y-0 start-0 z-40 hidden w-[var(--side-w)] flex-col border-e border-fg/10 bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-fg/10 px-4">
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="mx-4 mt-4 h-12" />
        <div className="mt-6 space-y-2 px-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      </aside>

      {/* Header strip */}
      <div className="sticky top-0 z-30 border-b border-fg/10 bg-card/90">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 md:px-10">
          <div className="flex gap-6">
            {Array.from({ length: tabs }, (_, i) => (
              <Skeleton key={i} className="my-5 h-4 w-24 !rounded-md" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9 !rounded-full" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}

const Search = () => <Skeleton className="h-12 w-full" />;

function Stat() {
  return (
    <div className={card}>
      <Skeleton className="h-4 w-28 !rounded-md" />
      <Skeleton className="mt-4 h-9 w-32" />
      <Skeleton className="mt-4 h-2 w-full !rounded-full" />
    </div>
  );
}

function Rows({ n, h = "h-14" }: { n: number; h?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={`${h} w-full`} />
      ))}
    </div>
  );
}

function Home() {
  return (
    <>
      <div className={`${card} flex items-center justify-between gap-4`}>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-44 !rounded-md" />
          <Skeleton className="h-3 w-32 !rounded-md" />
          <Skeleton className="h-2 w-full max-w-md !rounded-full" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <Skeleton className="h-5 w-40 !rounded-md" />
          <div className="mt-6 flex h-44 items-end gap-2">
            {[40, 55, 45, 70, 60, 85, 75, 95, 65, 80, 50, 70].map((h, i) => (
              <Skeleton key={i} className="flex-1 !rounded-b-none !rounded-t-md" />
            ))}
          </div>
        </div>
        <div className={card}>
          <Skeleton className="h-5 w-32 !rounded-md" />
          <div className="mt-5">
            <Rows n={4} h="h-12" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={card}>
          <Skeleton className="h-5 w-36 !rounded-md" />
          <div className="mt-5">
            <Rows n={3} />
          </div>
        </div>
        <div className={card}>
          <Skeleton className="h-5 w-36 !rounded-md" />
          <div className="mt-5">
            <Rows n={3} />
          </div>
        </div>
      </div>
    </>
  );
}

function Reports() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className={`${card} space-y-3`}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="space-y-5">
        <div className="flex gap-3">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-11 w-36" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Stat key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Table() {
  return (
    <div className={card}>
      <Skeleton className="h-6 w-44 !rounded-md" />
      <Skeleton className="mt-5 h-12 w-full" />
      <Skeleton className="mt-5 h-11 w-full" />
      <div className="mt-3">
        <Rows n={5} h="h-16" />
      </div>
    </div>
  );
}

function Carts() {
  return (
    <>
      <div className={card}>
        <Skeleton className="h-5 w-40 !rounded-md" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
      <Table />
    </>
  );
}

function Split() {
  return (
    <>
      <Search />
      <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,24rem)_minmax(0,1fr)]">
        <div className={`${card} space-y-3 !p-3`}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className={`${card} space-y-3`}>
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 !rounded-md" />
                <Skeleton className="h-3 w-1/2 !rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className={`${card} space-y-5`}>
          <Skeleton className="h-6 w-40 !rounded-md" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </>
  );
}

function Invoice() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      <div className="space-y-5">
        {[4, 5, 3].map((n, i) => (
          <div key={i} className={card}>
            <Skeleton className="h-5 w-44 !rounded-md" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: n }, (_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 shrink-0 !rounded-md" />
                  <Skeleton className="h-4 w-2/3 !rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={card}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-12 w-full" />
        <Skeleton className="mt-3 h-[34rem] w-full" />
      </div>
    </div>
  );
}

function Form() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className={`${card} hidden space-y-3 lg:block`}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className={`${card} space-y-5`}>
        <Skeleton className="h-6 w-40 !rounded-md" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-4 w-28 !rounded-md" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-32" />
      </div>
    </div>
  );
}

const bodies: Record<DashVariant, () => React.JSX.Element> = { home: Home, reports: Reports, table: Table, carts: Carts, split: Split, invoice: Invoice, form: Form };

export function DashSkeleton({ variant, tabs = 1 }: { variant: DashVariant; tabs?: number }) {
  const Body = bodies[variant];
  return (
    <Frame tabs={tabs}>
      <Body />
    </Frame>
  );
}
