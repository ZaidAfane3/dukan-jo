"use client";

import { demoActive } from "./demoSandbox";
import { useEffect, useMemo, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { pushNotification } from "./notifications";
import { usePrefs } from "./Prefs";
import { AnimatedNumber, Money, mulberry32 } from "./Reports";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const RANGE_SCALE = [1, 3.6, 2.4];

type Row = {
  id: number;
  name: string;
  createdDays: number;
  items: number;
  total: number;
  updatedDays: number;
  sent: boolean;
  color: string;
};

const SWATCHES = ["#73e7cb", "#96edd9", "#348d9c", "#d9c9b5", "#4a9e8a", "#c1fdf6", "#e0806e", "#5b8dd6"];

export function AbandonedCarts() {
  const { lang } = usePrefs();
  const m = content[lang].marketing;
  const r = content[lang].reports;
  const cur = r.currency;

  const [sample, setSample] = useState(false);
  /* In the platform tour the carts are already there, so there is no switch */
  const [tour, setTour] = useState(false);
  /* In the tour the carts belong to the same customers as the orders */
  const [tourNames, setTourNames] = useState<string[]>([]);
  const [range, setRange] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(0);
  const [visible, setVisible] = useState([true, true, true, true, true, true]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [reminded, setReminded] = useState<Record<number, number>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = `${brandName(lang)} | ${m.menu[0]}`;
  }, [m]);

  useEffect(() => {
    if (demoActive()) {
      setSample(true);
      setTour(true);
      try {
        const orders = JSON.parse(localStorage.getItem("seen-orders") ?? "[]") as { customer: string }[];
        setTourNames(orders.map((o) => o.customer).slice(0, 9));
      } catch {
        /* the sample names stay */
      }
    }
  }, []);

  /* A fixed set of sample carts (empty for a store with no abandoned carts). */
  const rows: Row[] = useMemo(() => {
    if (!sample) return [];
    const rnd = mulberry32(range * 91 + 7);
    const names = tourNames.length ? m.names.map((n, i) => tourNames[i] ?? n) : m.names;
    return names.map((name, i) => ({
      id: i,
      name,
      createdDays: Math.round((3 + rnd() * 40) * RANGE_SCALE[range]),
      items: 1 + Math.floor(rnd() * 4),
      total: Math.round((12 + rnd() * 170) * 100) / 100,
      updatedDays: Math.round((1 + rnd() * 25) * RANGE_SCALE[range]),
      sent: rnd() < 0.35,
      color: SWATCHES[Math.floor(rnd() * SWATCHES.length)],
    }));
  }, [sample, range, m.names, tourNames]);

  /* A cart can be reminded again and again: this counts every reminder sent, including the one already sent before */
  const timesSent = (row: Row) => (row.sent ? 1 : 0) + (reminded[row.id] ?? 0);
  const isSent = (row: Row) => timesSent(row) > 0;

  const shown = rows.filter((row) => {
    if (status === 1 && !isSent(row)) return false;
    if (status === 2 && isSent(row)) return false;
    return query.trim() === "" || row.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const count = rows.length;
  const recovered = count ? Math.round((rows.filter((x) => x.sent).length / count) * 1000) / 10 : 0;
  const average = count ? rows.reduce((a, b) => a + b.total, 0) / count : 0;

  const remind = (id: number, name: string) => {
    pushNotification("reminderSent", { name });
    setReminded((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));
    setToast(m.notice);
    window.setTimeout(() => setToast(""), 2600);
  };

  /* Download exactly what the table currently shows, as a spreadsheet file. */
  const exportCsv = () => {
    const cols = m.cols.filter((_, i) => i < 5 && visible[i]);
    const lines = [cols.join(",")];
    for (const row of shown) {
      const all = [row.name, String(row.items), row.total.toFixed(2), String(row.updatedDays), isSent(row) ? m.sent : m.notSent];
      lines.push(all.filter((_, i) => visible[i]).map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "abandoned-carts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="marketing" subtabs={m.tabs} subHrefs={["/marketing/abandoned-carts", "/marketing/reminders"]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        {/* Summary */}
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-extrabold">{m.title}</h1>
              <p className="mt-1 text-sm text-muted">{m.sub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{m.viewFull}<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></a>
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                aria-label={r.ranges[range]}
                className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary"
              >
                {r.ranges.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { title: m.cards[0], node: <AnimatedNumber value={count} />, ico: <path d="M3 4h2l2.4 11h11l2-8H6.2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01" /> },
              { title: m.cards[1], node: <span dir="ltr"><AnimatedNumber value={recovered} decimals={1} />%</span>, ico: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /> },
              { title: m.cards[2], node: <Money value={average} currency={cur} />, glyph: cur },
            ].map((c) => (
              <div key={c.title} className="flex items-center gap-4 rounded-xl border border-fg/10 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-primary">
                  {"glyph" in c ? <span className="text-xs font-bold leading-none">{c.glyph}</span> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{c.ico}</svg>}
                </span>
                <div>
                  <p className="text-sm font-semibold text-muted">{c.title}</p>
                  <p className="text-2xl font-bold">{c.node}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Table */}
        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.search}
              aria-label={m.search}
              className="h-11 min-w-[14rem] flex-1 rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <select value={status} onChange={(e) => setStatus(Number(e.target.value))} aria-label={m.cols[4]} className="h-11 rounded-xl border border-fg/15 bg-card px-3 text-sm font-medium outline-none focus:border-primary">
              {m.status.map((s, i) => (
                <option key={s} value={i}>{s}</option>
              ))}
            </select>
            <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50">
              {m.export}
            </button>
            <div className="relative">
              <button type="button" aria-expanded={columnsOpen} onClick={() => setColumnsOpen((o) => !o)} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">
                {m.columns}
              </button>
              {columnsOpen && (
                <div className="absolute end-0 top-full z-20 mt-2 w-56 rounded-xl border border-fg/10 bg-card p-3 shadow-2xl">
                  {m.cols.slice(0, 5).map((col, i) => (
                    <label key={col} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${i === 0 ? "opacity-60" : "cursor-pointer hover:bg-soft"}`}>
                      <input
                        type="checkbox"
                        checked={visible[i]}
                        disabled={i === 0}
                        onChange={() => setVisible((v) => v.map((x, k) => (k === i ? !x : x)))}
                        className="h-4 w-4 accent-[rgb(var(--primary))]"
                      />
                      {col}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {!tour && <label className="ms-auto flex cursor-pointer items-center gap-3 text-sm font-medium">
              {r.sampleToggle}
              <button
                type="button"
                role="switch"
                aria-checked={sample}
                onClick={() => setSample((s) => !s)}
                className={`relative h-6 w-11 rounded-full transition-colors ${sample ? "bg-primary" : "bg-fg/20"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sample ? "start-[1.375rem]" : "start-0.5"}`} />
              </button>
            </label>}
          </div>

          {sample && !tour && <p className="mt-4 rounded-xl bg-primary/15 px-4 py-2 text-center text-sm font-medium text-deep dark:text-primary">{r.sampleNote}</p>}

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>
                  {m.cols.map((col, i) => (i === 5 || visible[i]) && <th key={col} className={th}>{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {shown.map((row) => {
                  const sent = isSent(row);
                  const times = timesSent(row);
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-soft/40">
                      {visible[0] && (
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">{row.name.charAt(0)}</span>
                            <div>
                              <p className="font-semibold">{row.name}</p>
                              <p className="text-xs text-muted">{m.created.replace("{n}", String(row.createdDays))}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      {visible[1] && (
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 shrink-0 rounded-lg" style={{ backgroundColor: row.color }} />
                            <span className="text-muted">{lang === "en" && row.items === 1 ? "1 item" : m.items.replace("{n}", String(row.items))}</span>
                          </div>
                        </td>
                      )}
                      {visible[2] && <td className={`${td} font-semibold`}><span dir="ltr">{row.total.toFixed(2)} {cur}</span></td>}
                      {visible[3] && <td className={`${td} text-muted`}>{m.ago.replace("{n}", String(row.updatedDays))}</td>}
                      {visible[4] && (
                        <td className={td}>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${sent ? "bg-primary/15 text-deep dark:text-primary" : "bg-fg/10 text-muted"}`}>
                            <span className={`h-2 w-2 rounded-full ${sent ? "bg-primary" : "bg-fg/40"}`} />
                            {sent ? m.sent : m.notSent}
                            {times > 1 && <span dir="ltr" className="font-extrabold">×{times}</span>}
                          </span>
                        </td>
                      )}
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => remind(row.id, row.name)}
                          className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                        >
                          {sent ? (lang === "ar" ? "إرسال تذكير آخر" : "Send another reminder") : m.remind}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="px-4 py-14 text-center">
                <p className="font-bold">{m.empty}</p>
                <p className="mt-1 text-sm text-muted">{m.emptyHint}</p>
              </div>
            )}
            {rows.length > 0 && shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{m.noMatch}</p>}
          </div>
        </section>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
