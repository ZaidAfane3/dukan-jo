"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { STATUS_DOT, STATUS_KEYS, ordersCopy, type StatusKey } from "./ordersContent";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";

type Order = {
  id: number;
  customer: string;
  phone: string;
  total: number;
  status: StatusKey;
  channel: 0 | 1;
  /* For orders added by hand: where the customer ordered (WhatsApp, Instagram, ...) */
  source?: number;
  /* What was ordered: the product name, how many, and the price of one */
  items?: { name: string; qty: number; price: number; image?: string }[];
  created: number;
};

/* Kept in this browser so orders are still there when he comes back. */
const KEY = "seen-orders";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function Orders() {
  const { lang } = usePrefs();
  const o = ordersCopy[lang];
  const locale = dateLocale(lang);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<StatusKey | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [total, setTotal] = useState("");
  const [status, setStatus] = useState<StatusKey>("pending");
  const [source, setSource] = useState(0);
  const [errors, setErrors] = useState<{ name?: string; total?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${o.title}`;
  }, [lang, o]);

  useEffect(() => {
    setOrders(loadOrders());
    setReady(true);
  }, []);

  /* A search result links here with ?open=ID. */
  useEffect(() => {
    if (!ready) return;
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    if (id && orders.some((x) => x.id === id)) setSelected(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(orders));
    } catch {
      /* storage unavailable */
    }
  }, [orders, ready]);

  useEffect(() => {
    if (!creating) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCreating(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  useEffect(() => setConfirmDelete(false), [selected]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<StatusKey, number>;
    orders.forEach((x) => (c[x.status] += 1));
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return orders
      .filter((x) => (filter === "all" ? true : x.status === filter))
      .filter((x) => !q || String(x.id).includes(q) || x.customer.toLowerCase().includes(q) || x.phone.includes(q))
      .sort((a, b) => b.created - a.created);
  }, [orders, filter, query]);

  const current = orders.find((x) => x.id === selected) ?? null;
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateOf = (t: number, time = false) => {
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(t));
    if (!time) return day;
    /* Date and time side by side, without the word "at" that some languages add between them */
    return `${day} ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(t))}`;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const amount = Number(total);
    if (name.trim().length < 2) next.name = o.errName;
    if (!(amount > 0)) next.total = o.errTotal;
    setErrors(next);
    if (Object.keys(next).length) return;

    const id = 1001 + orders.reduce((m, x) => Math.max(m, x.id - 1000), 0);
    setOrders((list) => [{ id, customer: name.trim(), phone: phone.trim(), total: amount, status, channel: 0, source, created: Date.now() }, ...list]);
    setSelected(id);
    setName("");
    setPhone("");
    setTotal("");
    setStatus("pending");
    setSource(0);
    setCreating(false);
  };

  const setOrderStatus = (id: number, s: StatusKey) => setOrders((list) => list.map((x) => (x.id === id ? { ...x, status: s } : x)));
  const remove = (id: number) => {
    setOrders((list) => list.filter((x) => x.id !== id));
    setSelected(null);
  };

  const statusList: { key: StatusKey | "all"; label: string; count: number; dot?: string }[] = [
    { key: "all", label: o.all, count: orders.length },
    ...STATUS_KEYS.map((k) => ({ key: k, label: o.statuses[k], count: counts[k], dot: STATUS_DOT[k] })),
  ];

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="orders"
        subtabs={o.tabs}
        subHrefs={["/orders", "/orders/invoices"]}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={o.searchPh} aria-label={o.searchPh} className={`${field} h-12 ps-12`} />
        </div>
          <button type="button" onClick={() => setCreating(true)} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {o.newOrder} </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,22rem)_minmax(0,1fr)]">
          {/* Statuses */}
          <section className={`${card} overflow-hidden`}>
            <ul className="max-lg:flex max-lg:overflow-x-auto">
              {statusList.map((s) => (
                <li key={s.key} className="max-lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(s.key)}
                    aria-pressed={filter === s.key}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors max-lg:whitespace-nowrap ${filter === s.key ? "bg-black/[0.07] font-bold dark:bg-white/[0.1]" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`}
                  >
                    {s.dot ? <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} /> : <span className="h-2 w-2 shrink-0" />}
                    <span className="flex-1 text-start">{s.label}</span>
                    <span dir="ltr" className="text-xs">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Orders */}
          <section className={`${card} overflow-hidden`}>
            {shown.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold">{orders.length === 0 ? o.listEmpty : o.noMatch}</p>
                {orders.length === 0 && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{o.listEmptyHint}</p>}
                {orders.length === 0 && (
                  <button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {o.newOrder}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-fg/10">
                {shown.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(x.id)}
                      aria-current={selected === x.id}
                      className={`w-full px-5 py-4 text-start transition-colors ${selected === x.id ? "bg-black/[0.07] dark:bg-white/[0.1]" : "hover:bg-fg/[0.05]"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-semibold">{x.customer}</span>
                        <span dir="ltr" className="shrink-0 text-xs text-muted">#{x.id}</span>
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[x.status]}`} />
                          {o.statuses[x.status]}
                        </span>
                        <span>{dateOf(x.created)}</span>
                      </span>
                      <span dir="ltr" className="mt-1 block text-start text-sm font-bold">
                        {fmt(x.total)} <small className="font-semibold opacity-70">{o.currency}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Details */}
          <section className={`${card} min-h-[20rem] p-5 sm:p-7`}>
            {!current ? (
              <p className="grid min-h-[16rem] place-items-center text-center text-sm text-muted">{o.pickOne}</p>
            ) : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold">{o.details}</h2>
                    <p className="mt-1 text-2xl font-extrabold">{current.customer}</p>
                    {current.phone && <p dir="ltr" className="mt-1 text-start text-sm text-muted">{current.phone}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${current.status === "pending" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-fg/10 text-fg"}`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[current.status]}`} />
                    {o.statuses[current.status]}
                  </span>
                </div>

                <dl className="mt-6 grid gap-5 border-t border-fg/10 pt-6 sm:grid-cols-3">
                  {[
                    [o.orderNo, <span key="n" dir="ltr">#{current.id}</span>],
                    [o.date, dateOf(current.created, true)],
                    [o.channel, current.source !== undefined && current.channel === 0 ? `${o.channels[0]} · ${o.sources[current.source]}` : o.channels[current.channel]],
                  ].map(([k, v], idx) => (
                    <div key={idx}>
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd className="mt-1 text-sm font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>

                {current.items && current.items.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold">{o.items}</h3>
                    <ul className="mt-3 divide-y divide-fg/10 rounded-xl ring-1 ring-fg/10">
                      {current.items.map((it, n) => (
                        <li key={n} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                          <span className="flex min-w-0 items-center gap-3 font-semibold">
                            {it.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                            )}
                            <span className="min-w-0">
                              {it.name} <span dir="ltr" className="whitespace-nowrap font-bold text-muted">×{it.qty}</span>
                            </span>
                          </span>
                          <span dir="ltr" className="shrink-0 font-bold">
                            {fmt(it.price * it.qty)} <small className="text-xs opacity-70">{o.currency}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-soft/70 px-4 py-4">
                  <div>
                    <p className="text-sm font-bold">{current.status === "pending" ? o.unpaid : o.paid}</p>
                    {current.status === "pending" && <p className="mt-0.5 text-xs text-muted">{o.paymentHint}</p>}
                  </div>
                  <p dir="ltr" className="text-xl font-extrabold">
                    {fmt(current.total)} <small className="text-xs font-bold opacity-70">{o.currency}</small>
                  </p>
                </div>

                <div className="mt-6 max-w-xs">
                  <label htmlFor="o-status" className="mb-2 block text-sm font-semibold">{o.status}</label>
                  <select id="o-status" value={current.status} onChange={(e) => setOrderStatus(current.id, e.target.value as StatusKey)} className={`${field} h-11`}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{o.statuses[k]}</option>)}
                  </select>
                </div>

                <div className="mt-8 border-t border-fg/10 pt-5">
                  {confirmDelete ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm text-rose-600">{o.deleteAsk}</p>
                      <button type="button" onClick={() => remove(current.id)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{o.deleteYes}</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{o.cancel}</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{o.delete}</button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={o.formTitle} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{o.formTitle}</h2>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="n-name" className="mb-2 block text-sm font-semibold">{o.customer}</label>
                <input id="n-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={o.namePh} maxLength={60} className={`${field} h-11`} />
                {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="n-phone" className="mb-2 block text-sm font-semibold">{o.phone}</label>
                <input id="n-phone" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(latin(e.target.value).replace(/[^\d+ ]/g, ""))} placeholder="+962 7X XXX XXXX" maxLength={20} className={`${field} h-11 text-start`} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="n-total" className="mb-2 block text-sm font-semibold">{o.total} ({o.currency})</label>
                  <input id="n-total" dir="ltr" inputMode="decimal" value={total} onChange={(e) => setTotal(latin(e.target.value).replace(/[^\d.]/g, ""))} placeholder="0.00" maxLength={10} className={`${field} h-11 text-start`} />
                  {errors.total && <p className="mt-1.5 text-xs text-rose-600">{errors.total}</p>}
                </div>
                <div>
                  <label htmlFor="n-status" className="mb-2 block text-sm font-semibold">{o.status}</label>
                  <select id="n-status" value={status} onChange={(e) => setStatus(e.target.value as StatusKey)} className={`${field} h-11`}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{o.statuses[k]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="n-source" className="mb-2 block text-sm font-semibold">{o.sourceLabel}</label>
                <select id="n-source" value={source} onChange={(e) => setSource(Number(e.target.value))} className={`${field} h-11`}>
                  {o.sources.map((s, i) => <option key={s} value={i}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{o.create}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{o.cancel}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
