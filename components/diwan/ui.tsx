"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "../Prefs";

/* Diwan's shared building blocks, so every page looks and behaves the same. Every page reads live data from
   /api/diwan/... with useApi; there is no sample data anywhere in Diwan. Merchant text is always shown as plain text
   (React escapes it); never use dangerouslySetInnerHTML here. */

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
  const loc = lang === "ar" ? "ar-JO" : "en-GB";
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

export const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
export const field =
  "h-10 w-full rounded-xl border border-fg/15 bg-card px-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
export const area =
  "w-full rounded-xl border border-fg/15 bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const tones = {
  grey: "bg-fg/10 text-fg",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  blue: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  primary: "bg-primary/15 text-primary",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "grey", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Btn({
  kind = "primary",
  className = "",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "danger" }) {
  const k =
    kind === "primary"
      ? "bg-primary text-white hover:bg-deep"
      : kind === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border border-fg/15 bg-card hover:bg-soft";
  return <button {...p} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${k} ${className}`} />;
}

/** A table that scrolls sideways on its own on small screens, never the page */
export function DataTable({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-fg/10 text-start text-xs uppercase tracking-wide text-muted">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-fg/10">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}

export const td = "px-4 py-3 align-top";

/** Loading / error / content, the same way on every page */
export function Loaded<T>({ s, children }: { s: ApiState<T>; children: (d: T) => React.ReactNode }) {
  const t = useT();
  if (s.error === "not-allowed") return <p className={`${card} text-sm text-muted`}>{t("Your role can't open this page. Ask an owner if you need it.", "دورك لا يسمح بفتح هذه الصفحة. اطلب من المالك إن احتجت إليها.")}</p>;
  if (s.error) return <p className={`${card} text-sm text-red-600`}>{t("Could not load this: ", "تعذر التحميل: ")}{s.error}</p>;
  if (!s.data) return <p className="py-10 text-center text-sm text-muted">{t("Loading…", "جارٍ التحميل…")}</p>;
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
