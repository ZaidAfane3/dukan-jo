"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dateLocale } from "../content";
import { usePrefs } from "../Prefs";
import { ArchOutline, type IconName } from "./icons";
import { DIWAN_NAV, NAV_GROUPS } from "./nav";
import type { Role } from "./perms";

/* Diwan's shared building blocks, so every page looks and behaves the same. Every page reads live data from
   /api/diwan/... with useApi; there is no sample data anywhere in Diwan. Merchant text is always shown as plain text
   (React escapes it); never use dangerouslySetInnerHTML here. */

/** Who is signed in to Diwan (given by the frame, DiwanShell), for a greeting */
export type SignedInStaff = { name: string; email: string; role: Role };
export const StaffContext = createContext<SignedInStaff | null>(null);
export const useStaff = () => useContext(StaffContext);

/** Picks the English or Arabic text for the current language */
export function useT() {
  const { lang } = usePrefs();
  return useCallback((en: string, ar: string) => (lang === "ar" ? ar : en), [lang]);
}

export type ApiState<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

/** Loads JSON from a Diwan API route. A signed-out answer sends the page to the sign-in. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/diwan/login";
          return;
        }
        const j = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok) setError(j?.result ?? `error ${r.status}`);
        else {
          setData(j as T);
          setError(null);
        }
      })
      .catch(() => alive && setError("offline"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, n]);
  return { data, error, loading, reload: () => setN((x) => x + 1) };
}

/** Sends a change to a Diwan API route. Resolves to the JSON answer and whether it worked. It never throws: with no
    connection it resolves to status 0 (like the sign-in form), so every page ends its "Saving…" and shows its message. */
export async function send(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, data: null };
  }
  if (r.status === 401) window.location.href = "/diwan/login";
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

/* ---------------- formatting ---------------- */

/** The Arabic forms of a counted noun for f.count: one and two are whole phrases (no number), few (3–10, and 0) and many
    (11 and more) follow the number */
export type ArForms = { one: string; two: string; few: string; many: string };

export function useFmt() {
  const { lang } = usePrefs();
  /* the same dates as the rest of Dukkan: يناير … ديسمبر, Western digits (components/content.ts) */
  const loc = dateLocale(lang);
  return {
    date: (v: string | number | null | undefined) => (v ? new Date(v).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" }) : "—"),
    dateTime: (v: string | number | null | undefined) =>
      v ? new Date(v).toLocaleString(loc, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
    /** An amount the way the store pages write one (components/storefront/parts.tsx money): each amount on its own, a
        whole one without decimals ("22"), any other with at least two ("12.50", never "12.5"; fils kept: "4.125") */
    jod: (v: number | string | null | undefined) => {
      const n = Number(v ?? 0) || 0;
      const whole = Math.round(n * 1000) % 1000 === 0;
      return `${n.toLocaleString(loc, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 3 })} ${lang === "ar" ? "د.أ" : "JOD"}`;
    },
    num: (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString(loc),
    /** A counted noun in the page's language, the one way every Diwan count is written: English "1 store" / "2 stores";
        Arabic by its own forms, 1 «متجر واحد», 2 «متجران», 3–10 «3 متاجر», 11 and more «11 متجرًا», 0 «0 متاجر» (the
        rule of components/undo.ts arCount, with the number written as f.num writes it). A form can carry the words
        that go with it ("store matches" / "stores match", «متجر واحد مطابق» …). */
    count: (n: number, en: readonly [one: string, many: string], ar: ArForms) => {
      const num = Number(n).toLocaleString(loc);
      if (lang !== "ar") return `${n === 1 ? "1" : num} ${n === 1 ? en[0] : en[1]}`;
      if (n === 1) return ar.one;
      if (n === 2) return ar.two;
      const r = Math.abs(n) % 100;
      return `${num} ${n === 0 || (r >= 3 && r <= 10) ? ar.few : ar.many}`;
    },
    ago: (v: string | number | null | undefined) => {
      if (!v) return "—";
      const s = (Date.now() - new Date(v).getTime()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
      if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
      if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
      return rtf.format(-Math.round(s / 86400), "day");
    },
  };
}

/* ---------------- pieces ---------------- */

/* a surface on Diwan's paper: white (or the dark card colour), a hairline edge, no heavy shadow */
export const card = "rounded-xl bg-card p-5 ring-1 ring-fg/[0.08] shadow-[0_1px_2px_rgba(60,40,10,0.04)]";
export const field =
  "h-10 w-full rounded-xl border border-fg/15 bg-card px-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
export const area =
  "w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The one warm colour: saffron, only for what needs someone (open tickets, new reports). Calm things have no colour. */
export const ATTENTION = "text-amber-700 dark:text-amber-300";

/* the section a page belongs to (Stores, Support, Marketing...), found by its address, for the line above its title */
function groupOf(path: string) {
  const item = DIWAN_NAV.filter((i) => i.href !== "/diwan").find((i) => path === i.href || path.startsWith(i.href + "/"));
  return item?.group ? NAV_GROUPS[item.group] : null;
}

/** A page's title: the part of Diwan it is in (a quiet line above), the title itself, large and tight, a line about the
    page, and its buttons. `icon` is kept for older callers; titles no longer carry pictures. */
export function PageHead({ title, sub, actions, eyebrow }: { title: string; sub?: string; actions?: React.ReactNode; icon?: IconName; eyebrow?: string }) {
  const t = useT();
  const path = usePathname() ?? "";
  const g = groupOf(path);
  const over = eyebrow ?? (g ? t(g.en, g.ar) : "");
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {over && <p className="mb-1 text-[13px] font-medium text-muted [font-variant-caps:all-small-caps] tracking-[0.05em]">{over}</p>}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** One number on a card: a quiet label, the number large. (`icon` and `tone` are kept for older callers and not drawn.) */
export function Stat({ label, value, hint, children }: { label: string; value: React.ReactNode; hint?: string; icon?: IconName; tone?: string; children?: React.ReactNode }) {
  return (
    <div className={card}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export type Figure = { label: string; value: React.ReactNode; note?: React.ReactNode; attention?: boolean; extra?: React.ReactNode };

/** A row of figures, like the masthead of a paper: big numbers with a small label, split by hairlines, no boxes. Wraps to
    two columns on a phone. */
export function Figures({ items }: { items: Figure[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-6 border-y border-fg/10 py-6 sm:grid-cols-3 lg:flex lg:divide-x lg:divide-fg/10 lg:py-7 rtl:lg:divide-x-reverse">
      {items.map((f, i) => (
        <div key={i} className="min-w-0 px-1 sm:px-4 lg:flex-1 lg:px-6 lg:first:ps-0 lg:last:pe-0">
          <dt className="text-[13px] text-muted">{f.label}</dt>
          <dd className={`mt-1 text-[34px] font-extrabold leading-none tabular-nums tracking-tight sm:text-[40px] ${f.attention ? ATTENTION : ""}`}>{f.value}</dd>
          {f.note && <dd className="mt-2 text-xs leading-snug text-muted">{f.note}</dd>}
          {f.extra}
        </div>
      ))}
    </dl>
  );
}

/** Nothing to show yet: an empty arch (Diwan's doorway) and a line, instead of an empty box */
export function Empty({ title, sub, action }: { icon?: IconName; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <ArchOutline className="h-12 w-10 text-fg/25" />
      <p className="mt-4 text-[15px] font-semibold">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-muted">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* a status is a word with a small mark before it (a tiny diamond, as in the geometry of the arch), not a pill */
const tones = {
  grey: { text: "text-fg/75", mark: "bg-fg/35" },
  green: { text: "text-emerald-800 dark:text-emerald-300", mark: "bg-emerald-500" },
  red: { text: "text-red-700 dark:text-red-300", mark: "bg-red-500" },
  amber: { text: "text-amber-800 dark:text-amber-300", mark: "bg-amber-500" },
  blue: { text: "text-sky-800 dark:text-sky-300", mark: "bg-sky-500" },
  primary: { text: "text-primary", mark: "bg-primary" },
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "grey", children }: { tone?: Tone; children: React.ReactNode }) {
  const c = tones[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${c.text}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] ${c.mark}`} />
      {children}
    </span>
  );
}

export function Btn({
  kind = "primary",
  className = "",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "danger" }) {
  const k =
    kind === "primary"
      ? "bg-primary text-white hover:bg-deep dark:text-page dark:hover:text-white"
      : kind === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-card ring-1 ring-fg/15 hover:bg-fg/[0.04]";
  return <button {...p} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-50 ${k} ${className}`} />;
}

/** A table that scrolls sideways on its own on small screens, never the page. Airy rows, soft lines between them. */
/** dense: narrower cell padding (use tdDense in its rows), for a table with many columns that must fit its card */
/** fit: no smallest width, for a small table in a narrow column (a few rows on the overview): its cells truncate
    instead, so it never scrolls sideways */
export function DataTable({ head, children, empty, dense = false, fit = false }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string | false; dense?: boolean; fit?: boolean }) {
  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className={`w-full text-sm ${fit ? "" : "min-w-[640px]"}`}>
        <thead>
          <tr className="border-b border-fg/10 text-start text-[13px] text-muted [font-variant-caps:all-small-caps] tracking-[0.04em]">
            {head.map((h, i) => (
              <th key={i} className={`${dense ? "whitespace-nowrap px-3" : "px-5"} py-3.5 text-start font-medium`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-fg/[0.06]">{children}</tbody>
      </table>
      {empty && <Empty title={empty} />}
    </div>
  );
}

export const td = "px-5 py-4 align-top";
export const tdDense = "px-3 py-3.5 align-top";

/** Loading / error / content, the same way on every page. `skeleton`: the page's own shape while it loads (built from the
    pieces below: SkelTable, SkelCards, SkelList, SkelForm, SkelFigures...), so nothing jumps when the data arrives;
    without one, a plain block (never number boxes a page doesn't have). */
export function Loaded<T>({ s, children, skeleton }: { s: ApiState<T>; children: (d: T) => React.ReactNode; skeleton?: React.ReactNode }) {
  const t = useT();
  if (s.error === "not-allowed") return <p className={`${card} text-sm text-muted`}>{t("You can't open this page.", "لا يمكنك فتح هذه الصفحة.")}</p>;
  if (s.error) return <p className={`${card} text-sm text-red-600`}>{t("Could not load this: ", "تعذر التحميل: ")}{s.error}</p>;
  if (!s.data) return <Busy>{skeleton ?? <SkelBlock />}</Busy>;
  return <>{children(s.data)}</>;
}

/* ---------------- skeletons: a loading page shaped like itself ----------------
   Grey bars (bg-fg/10) where the words and numbers will be, pulsing gently (not at all with reduced motion). Loaded
   shows a page's own skeleton while its data loads, and each Diwan route's loading.tsx shows the same one (SkelPage,
   in place of the page's heading) while the route itself loads, so the page keeps one shape from the first frame. */

/** One grey bar */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-fg/10 ${className}`} />;
}

/** Marks a skeleton as loading for screen readers, and makes it pulse */
export function Busy({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <div role="status" aria-label={t("Loading…", "جارٍ التحميل…")} className={`animate-pulse motion-reduce:animate-none ${className}`}>
      {children}
    </div>
  );
}

/** The place of a page's heading (PageHead): its group, its title, the line under it, and a button's place (`actions`) */
export function SkelHead({ actions = false }: { actions?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Bone className="mb-2 h-3 w-20" />
        <Bone className="h-8 w-56 max-w-full" />
        <Bone className="mt-3 h-3.5 w-80 max-w-full" />
      </div>
      {actions && <Bone className="h-10 w-32 !rounded-lg" />}
    </div>
  );
}

/** A whole page while its route loads (a route's loading.tsx): the heading's place, a row of filters when the page has
    them, then the page's own skeleton, the same one its Loaded shows */
export function SkelPage({ children, filters = false, actions = false, head = true }: { children?: React.ReactNode; filters?: boolean; actions?: boolean; head?: boolean }) {
  return (
    <Busy>
      {head && <SkelHead actions={actions} />}
      {filters && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Bone className="h-10 w-64 max-w-full !rounded-xl" />
          <Bone className="h-10 w-28 !rounded-xl" />
          <Bone className="h-10 w-28 !rounded-xl" />
        </div>
      )}
      {children ?? <SkelBlock />}
    </Busy>
  );
}

/** A conversation (a ticket, a bug report): the heading, messages from both sides and the reply box, and the side panel */
export function SkelChat() {
  return (
    <>
      <SkelHead />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={`${card} space-y-5`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
              <div aria-hidden className={`h-16 rounded-2xl bg-fg/10 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            </div>
          ))}
          <div aria-hidden className="h-24 w-full rounded-xl bg-fg/10" />
        </div>
        <aside className="space-y-4">
          <SkelBlock lines={3} />
          <SkelBlock lines={2} />
        </aside>
      </div>
    </>
  );
}

/** A plain block of lines, for a page with no better shape */
export function SkelBlock({ lines = 5 }: { lines?: number }) {
  return (
    <div className={`${card} space-y-3`}>
      <Bone className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={`h-3 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** The row of big figures (Figures) */
export function SkelFigures({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-y-6 border-y border-fg/10 py-6 sm:grid-cols-3 lg:flex lg:divide-x lg:divide-fg/10 lg:py-7 rtl:lg:divide-x-reverse">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="min-w-0 px-1 sm:px-4 lg:flex-1 lg:px-6 lg:first:ps-0 lg:last:pe-0">
          <Bone className="h-3 w-20" />
          <Bone className="mt-2 h-9 w-16" />
          <Bone className="mt-3 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Number boxes (Stat cards), only for a page that has them */
export function SkelStats({ n = 4, className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" }: { n?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={card}>
          <Bone className="h-3 w-1/2" />
          <Bone className="mt-3 h-8 w-1/3" />
          <Bone className="mt-3 h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** A DataTable with its columns: the heading's labels when given (they don't change while it loads), and `rows` rows */
export function SkelTable({ cols, rows = 8, dense = false }: { cols: number | React.ReactNode[]; rows?: number; dense?: boolean }) {
  const head = typeof cols === "number" ? null : cols;
  const n = typeof cols === "number" ? cols : cols.length;
  const cell = dense ? "px-3 py-3.5" : "px-5 py-4";
  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-fg/10 text-start text-[13px] text-muted [font-variant-caps:all-small-caps] tracking-[0.04em]">
            {Array.from({ length: n }, (_, i) => (
              <th key={i} className={`${dense ? "whitespace-nowrap px-3" : "px-5"} py-3.5 text-start font-medium`}>
                {head ? head[i] : <Bone className="h-3 w-16" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-fg/[0.06]">
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: n }, (_, c) => (
                <td key={c} className={`${cell} align-top`}>
                  <Bone className={`h-3.5 ${c === 0 ? "w-28" : (r + c) % 3 === 0 ? "w-12" : "w-20"}`} />
                  {c === 0 && <Bone className="mt-2 h-2.5 w-20" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cards in a grid (themes, feedback, the ways to pay...): a title line and `lines` lines each; `picture`: a preview
    picture on top (theme cards) */
export function SkelCards({ n = 6, lines = 3, className = "grid gap-4 md:grid-cols-2 xl:grid-cols-3", picture = false }: { n?: number; lines?: number; className?: string; picture?: boolean }) {
  return (
    <div className={className}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`${card} space-y-3`}>
          {picture && <div aria-hidden className="aspect-[4/3] w-full rounded-lg bg-fg/10" />}
          <div className="flex items-center gap-2">
            <Bone className="h-3 w-16" />
            <Bone className="ms-auto h-3 w-12" />
          </div>
          <Bone className="h-4 w-2/3" />
          {Array.from({ length: lines }, (_, l) => (
            <Bone key={l} className={`h-3 ${l === lines - 1 ? "w-1/2" : "w-full"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Cards one under the other (announcements, documents, reports...): a title, lines, and room for its buttons (`side`) */
export function SkelList({ n = 4, lines = 2, side = false }: { n?: number; lines?: number; side?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`${card} flex flex-wrap items-start gap-3`}>
          <div className="min-w-0 flex-1 space-y-3">
            <Bone className="h-3 w-24" />
            <Bone className="h-4 w-1/2" />
            {Array.from({ length: lines }, (_, l) => (
              <Bone key={l} className={`h-3 ${l === lines - 1 ? "w-2/3" : "w-full"}`} />
            ))}
          </div>
          {side && <Bone className="h-9 w-24 !rounded-lg" />}
        </div>
      ))}
    </div>
  );
}

/** A settings form: cards with a title and labelled fields */
export function SkelForm({ cards = 2, fields = 3, className = "grid items-start gap-6 xl:grid-cols-2" }: { cards?: number; fields?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className={`${card} space-y-4 p-6`}>
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-2/3" />
          {Array.from({ length: fields }, (_, f) => (
            <div key={f} className="space-y-2">
              <Bone className="h-3 w-24" />
              <div aria-hidden className="h-10 w-full rounded-xl bg-fg/10" />
            </div>
          ))}
          <Bone className="h-10 w-28 !rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ---------------- long lists: "Load more" instead of pages ---------------- */

export type MoreState<T> = ApiState<T> & { more: () => void; hasMore: boolean; moreLoading: boolean; moreFailed: boolean };

/** A list that grows: the first batch from `url`, then each "Load more" asks for the next one (nextOf gives its query,
    `page=2` or `before=123`, or null when there is no more) and adds its rows below the ones shown, so the page stays
    where it is. New filters or a reload start again from the first batch. data.rows is every row loaded so far; the
    rest of data comes from the newest batch. */
export function useMore<T extends { rows: unknown[] }>(url: string | null, nextOf: (d: T, loaded: number) => string | null): MoreState<T> {
  const first = useApi<T>(url);
  /* the batches after the first, kept only while the first batch they follow is the one shown */
  const [extra, setExtra] = useState<{ base: T | null; rows: T["rows"]; last: T | null; loaded: number }>({ base: null, rows: [], last: null, loaded: 1 });
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const fresh = !!first.data && extra.base === first.data;
  const last = fresh && extra.last ? extra.last : first.data;
  const loaded = fresh ? extra.loaded : 1;
  const data = useMemo(
    () => (first.data && last ? ({ ...last, rows: [...first.data.rows, ...(fresh ? extra.rows : [])] } as T) : null),
    [first.data, last, fresh, extra.rows],
  );
  const next = last ? nextOf(last, loaded) : null;
  const more = () => {
    const base = first.data;
    if (!url || !base || !next || moreLoading) return;
    setMoreLoading(true);
    setMoreFailed(false);
    fetch(`${url}${url.includes("?") ? "&" : "?"}${next}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/diwan/login";
          return;
        }
        const j = (await r.json().catch(() => null)) as T | null;
        if (!r.ok || !j?.rows) return setMoreFailed(true);
        setExtra((e) => {
          const prev = e.base === base ? e : { base, rows: [] as T["rows"], last: null, loaded: 1 };
          return { base, rows: [...prev.rows, ...j.rows] as T["rows"], last: j, loaded: prev.loaded + 1 };
        });
      })
      .catch(() => setMoreFailed(true))
      .finally(() => setMoreLoading(false));
  };
  return { ...first, data, more, hasMore: !!next, moreLoading, moreFailed };
}

/** The button under a growing list, and how many are shown of how many */
export function LoadMore({ s, total }: { s: MoreState<{ rows: unknown[] }>; total?: number }) {
  const t = useT();
  const f = useFmt();
  const shown = s.data?.rows.length ?? 0;
  if (!shown) return null;
  return (
    <div className="mt-5 flex flex-col items-center gap-2 text-sm">
      {total != null && <p className="text-xs text-muted">{t(`Showing ${f.num(shown)} of ${f.num(total)}`, `يظهر ${f.num(shown)} من ${f.num(total)}`)}</p>}
      {s.hasMore && (
        <Btn kind="ghost" onClick={s.more} disabled={s.moreLoading}>
          {s.moreLoading ? t("Loading…", "جارٍ التحميل…") : t("Load more", "عرض المزيد")}
        </Btn>
      )}
      {s.moreFailed && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("Couldn't load more. Try again.", "تعذّر تحميل المزيد. حاول مجددًا.")}</p>}
    </div>
  );
}

/** Downloads rows as a CSV file (Excel-friendly: UTF-8 with BOM so Arabic shows correctly) */
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    /* a cell starting with = + - @ would run as a formula in Excel */
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- right after a save: the saved row in the list at once ---------------- */

export type SavedNoteState = { id: string; text: string; step: 0 | 1 | 2; n: number };

/** For a list a form saves into (announcements, pop-ups, pages). After the server confirms a save, `show` puts the saved
    row in the list at once (the row the server answered with, or one built from what was sent), until the list's next
    load (started with the save) brings the server's copy in its place: same key, so nothing flickers or jumps. The row is
    lit for a moment (`ring`, on an element with id `row-<id>`), brought into view if the closed form left it off screen,
    and a line above the list (SavedNote) says what happened. `data` is the list's useApi data. */
export function useJustSaved<D, R extends { id: string }>(data: D | null) {
  const [fresh, setFresh] = useState<{ base: D | null; row: R; names?: Record<string, { name: string; email: string }> } | null>(null);
  const [note, setNote] = useState<SavedNoteState | null>(null);
  const n = note?.n;
  const id = note?.id;
  useEffect(() => {
    if (n === undefined || id === undefined) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`row-${id}`);
      const box = el?.getBoundingClientRect();
      if (el && box && (box.top < 72 || box.bottom > window.innerHeight))
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    /* lit, then the light fades (its transition), then the line fades and goes */
    const at = (ms: number, step: SavedNoteState["step"] | null) =>
      setTimeout(() => setNote((x) => (!x || x.n !== n ? x : step === null ? null : { ...x, step })), ms);
    const timers = [at(1600, 1), at(4000, 2), at(4600, null)];
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [n, id]);
  const now = fresh && fresh.base === data ? fresh : null;
  return {
    /** the saved row, the confirmation's words, and the names of shops chosen in it that the list may not know yet */
    show: (row: R, text: string, names?: Record<string, { name: string; email: string }>) => {
      setFresh({ base: data, row, names });
      setNote((x) => ({ id: row.id, text, step: 0, n: (x?.n ?? 0) + 1 }));
    },
    /** the list with the saved row in it (in place on an edit, else first, then in `order` when given) */
    rows: (rows: R[], order?: (a: R, b: R) => number) => {
      const r = now?.row;
      if (!r) return rows;
      const out = rows.some((x) => x.id === r.id) ? rows.map((x) => (x.id === r.id ? r : x)) : [r, ...rows];
      return order ? out.sort(order) : out;
    },
    /** the list's shop names with the saved row's */
    names: <N extends Record<string, { name: string; email: string }>>(base: N): N => (now?.names ? { ...base, ...now.names } : base),
    /** the classes of a row: a soft ring while it is lit, fading in and out (no fade with reduced motion) */
    ring: (rowId: string) => `transition-shadow duration-700 motion-reduce:transition-none ${note?.id === rowId && note.step === 0 ? "!ring-2 !ring-primary/45" : ""}`,
    note,
  };
}

/** The line above the list after a save, inside an element with `relative` around the list. It takes no room (it sits in
    the space above the list), so nothing moves when it comes and goes. */
export function SavedNote({ note }: { note: SavedNoteState | null }) {
  return (
    <p
      role="status"
      className={`pointer-events-none absolute bottom-full start-0 mb-2 flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-emerald-700 transition-opacity duration-500 motion-reduce:transition-none dark:text-emerald-300 ${note && note.step < 2 ? "opacity-100" : "opacity-0"}`}
    >
      {note && (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {note.text}
        </>
      )}
    </p>
  );
}

type SavedAudience = { all: true } | { newStores: true } | { accounts: (number | string)[] };

/** How many stores a row built in the page after a save reaches, until the server counts it: as before when its audience
    did not change, the stores chosen, every store (as any row for everyone says), none yet for new stores from a time
    still to come; null when only the server can tell. `since` is when it goes out (a start, or a page's first publish). */
export function reachOf(
  a: SavedAudience, since: string | null, rows: { audience: SavedAudience; reach: number | null }[],
  prev?: { audience: SavedAudience; reach: number | null }, prevSince?: string | null,
): number | null {
  const key = (x: SavedAudience | undefined) =>
    !x || typeof x !== "object" ? "" : "accounts" in x && Array.isArray(x.accounts) ? `a:${x.accounts.map(String).sort().join(",")}` : "newStores" in x ? "new" : "all" in x ? "all" : "";
  const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);
  if (prev && key(prev.audience) === key(a) && (key(a) !== "new" || time(since) === time(prevSince))) return prev.reach;
  if ("accounts" in a) return new Set(a.accounts.map(String)).size;
  if ("all" in a) return rows.find((r) => key(r.audience) === "all")?.reach ?? null;
  return !since || new Date(since).getTime() >= Date.now() - 60_000 ? 0 : null;
}
