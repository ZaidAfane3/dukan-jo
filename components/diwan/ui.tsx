"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

/** Sends a change to a Diwan API route. Resolves to the JSON answer and whether it worked. */
export async function send(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) window.location.href = "/diwan/login";
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

/* ---------------- formatting ---------------- */

export function useFmt() {
  const { lang } = usePrefs();
  /* the same dates as the rest of Dukkan: يناير … ديسمبر, Western digits (components/content.ts) */
  const loc = dateLocale(lang);
  return {
    date: (v: string | number | null | undefined) => (v ? new Date(v).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" }) : "—"),
    dateTime: (v: string | number | null | undefined) =>
      v ? new Date(v).toLocaleString(loc, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
    jod: (v: number | string | null | undefined) =>
      `${Number(v ?? 0).toLocaleString(loc, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${lang === "ar" ? "د.أ" : "JOD"}`,
    num: (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString(loc),
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

/* the group a page belongs to (Shops, Support, Developer portal, Platform), found by its address, for the line above its title */
function groupOf(path: string) {
  const item = DIWAN_NAV.filter((i) => i.href !== "/diwan").find((i) => path === i.href || path.startsWith(i.href + "/"));
  return item ? NAV_GROUPS[item.group] : null;
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
export function DataTable({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-fg/10 text-start text-[13px] text-muted [font-variant-caps:all-small-caps] tracking-[0.04em]">
            {head.map((h, i) => (
              <th key={i} className="px-5 py-3.5 text-start font-medium">
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

/** Loading / error / content, the same way on every page */
export function Loaded<T>({ s, children }: { s: ApiState<T>; children: (d: T) => React.ReactNode }) {
  const t = useT();
  if (s.error === "not-allowed") return <p className={`${card} text-sm text-muted`}>{t("Your role can't open this page. Ask an owner if you need it.", "دورك لا يسمح بفتح هذه الصفحة. اطلب من المالك إن احتجت إليها.")}</p>;
  if (s.error) return <p className={`${card} text-sm text-red-600`}>{t("Could not load this: ", "تعذر التحميل: ")}{s.error}</p>;
  if (!s.data)
    return (
      <div role="status" aria-label={t("Loading…", "جارٍ التحميل…")} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${card} h-28 animate-pulse motion-reduce:animate-none`}>
              <div className="h-3 w-1/2 rounded-full bg-fg/10" />
              <div className="mt-4 h-6 w-1/3 rounded-full bg-fg/10" />
            </div>
          ))}
        </div>
        <div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} />
      </div>
    );
  return <>{children(s.data)}</>;
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
