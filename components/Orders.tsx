"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { accountName, loadSetup } from "./setup";
import { fillMessage, loadMessages, messageIn, whatsappLink } from "./messageTemplates";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { STATUS_DOT, STATUS_KEYS, ordersCopy, type StatusKey } from "./ordersContent";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { isJordanMobile, phoneError, savedMobile, typedAnyPhone } from "./phone";
import { ORDER_MAX, cleanOrder, money, parseList, typedMoney, type Order } from "./records";
import { cleanLine, visibleLength } from "./safe";
import { CITIES, KNOWN_CITIES, ORDER_LIMITS, inLang, isCity, type Fulfil } from "./safeOrder";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { DELETE_REASON, cleanDeleteReason, deleteReasonOk, logDeletion } from "./orderDeletions";


/* Kept in this browser so orders are still there when he comes back. */
const KEY = "seen-orders";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";
/* Changing to these statuses is asked first */
const ASK_FIRST: StatusKey[] = ["cancelled", "refunded"];

/* What is saved is checked again when it is read: storage can hold old, broken or hand-changed orders */
function loadOrders(): Order[] {
  try {
    return parseList(localStorage.getItem(KEY), cleanOrder);
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
  /* why the order is deleted: required, and sent to Dukkan with the deletion */
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  /* one deletion per dialog, even on a double click */
  const deleting = useRef(false);
  const [askStatus, setAskStatus] = useState<StatusKey | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [total, setTotal] = useState("");
  const [status, setStatus] = useState<StatusKey>("pending");
  const [source, setSource] = useState(0);
  const [fulfil, setFulfil] = useState<Fulfil>("delivery");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; city?: string; address?: string; total?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${o.title}`;
  }, [lang, o]);

  useEffect(() => {
    setOrders(loadOrders());
    setReady(true);
    /* A new order from the store, or a change in another tab: take that list, so this tab never writes back an old one */
    const onStorage = (e: StorageEvent) => e.key === KEY && setOrders(loadOrders());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  useEffect(() => {
    setConfirmDelete(false);
    setAskStatus(null);
  }, [selected]);

  useEffect(() => {
    setReason("");
    deleting.current = false;
    if (!confirmDelete) return;
    reasonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirmDelete(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<StatusKey, number>;
    orders.forEach((x) => (c[x.status] += 1));
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    /* a phone is found however it is typed: 079…, 79… or +962 79… */
    const digitsOf = (v: string) => latin(v).replace(/\D/g, "").replace(/^(00962|962|0)/, "");
    const qd = digitsOf(q);
    return orders
      .filter((x) => (filter === "all" ? true : x.status === filter))
      .filter((x) => !q || String(x.id).includes(q) || x.customer.toLowerCase().includes(q) || x.phone.includes(q) || !!x.email?.includes(q) || (qd.length >= 3 && digitsOf(x.phone).includes(qd)))
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
    const amount = money(total) ?? NaN;
    if (visibleLength(cleanLine(name, ORDER_MAX.customer)) < 2) next.name = o.errName;
    /* In Jordan the mobile is how an order is confirmed, delivered and paid in cash, so it is required */
    if (!isJordanMobile(phone)) next.phone = phoneError[lang];
    /* where to deliver, unless the customer collects it */
    if (fulfil === "delivery" && !isCity(city)) next.city = o.errCity;
    if (fulfil === "delivery" && visibleLength(address) < 3) next.address = o.errAddress;
    if (!(amount > 0)) next.total = o.errTotal;
    setErrors(next);
    /* the cursor goes to the first field with a mistake */
    const first = (["name", "phone", "city", "address", "total"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`n-${first}`)?.focus();
      return;
    }

    const id = 1001 + orders.reduce((m, x) => Math.max(m, x.id - 1000), 0);
    setOrders((list) => [{ id, customer: cleanLine(name, ORDER_MAX.customer), phone: savedMobile(phone), total: amount, status, channel: 0, source, fulfil, ...(fulfil === "delivery" ? { city, address: cleanLine(address, ORDER_LIMITS.address) } : {}), created: Date.now() }, ...list]);
    setSelected(id);
    setName("");
    setPhone("");
    setTotal("");
    setFulfil("delivery");
    setCity("");
    setAddress("");
    setStatus("pending");
    setSource(0);
    setCreating(false);
  };

  const setOrderStatus = (id: number, s: StatusKey) => setOrders((list) => list.map((x) => (x.id === id ? { ...x, status: s } : x)));
  /* Cancelling or refunding is asked first, other statuses change right away */
  const pickStatus = (id: number, s: StatusKey) => {
    if (ASK_FIRST.includes(s)) setAskStatus(s);
    else {
      setAskStatus(null);
      setOrderStatus(id, s);
    }
  };
  /* Deleting needs a reason; the reason is kept with the deletion (orderDeletions.ts) */
  const remove = (id: number) => {
    if (deleting.current || !deleteReasonOk(reason)) return;
    deleting.current = true;
    logDeletion(id, cleanDeleteReason(reason));
    setOrders((list) => list.filter((x) => x.id !== id));
    setSelected(null);
    setConfirmDelete(false);
  };
  const reasonOk = deleteReasonOk(reason);

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
                    {(current.phone || current.email) && <p dir="ltr" className="mt-1 text-start text-sm text-muted">{current.phone || current.email}</p>}
                    {/* the confirmation from Customer messages, opened in WhatsApp for this customer: he only presses send */}
                    {(() => {
                      const msgs = loadMessages();
                      if (!msgs.whatsapp.on || !current.phone) return null;
                      const text = fillMessage(messageIn(msgs.whatsapp.text, lang), {
                        name: current.customer,
                        order: String(current.id),
                        total: `${fmt(current.total)} ${o.currency}`,
                        store: loadSetup()?.name?.trim() || accountName() || (lang === "ar" ? "متجرنا" : "our store"),
                      });
                      const href = whatsappLink(current.phone, text);
                      return href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#25d366] px-4 text-sm font-bold text-[#08361c] transition hover:brightness-95">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm4.4 12.6c-.2.5-1.1 1-1.6 1-.4.1-.9.1-1.5-.1-1.3-.4-2.9-1.4-4-2.8-.8-1-1.3-2-1.4-2.6-.1-.8.3-1.5.6-1.8.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .4.3l.6 1.4c0 .1.1.3 0 .4l-.3.5-.3.3c-.1.1-.2.3-.1.4.3.6.8 1.2 1.3 1.6.5.5 1.1.8 1.6 1 .2.1.3 0 .4-.1l.6-.7c.1-.2.3-.2.4-.1l1.4.7c.2.1.3.2.3.3 0 .2 0 .7-.2 1Z" /></svg>
                          {lang === "ar" ? "أرسل التأكيد عبر واتساب" : "Send confirmation on WhatsApp"}
                        </a>
                      ) : null;
                    })()}
                    {current.fulfil === "pickup" ? <p className="mt-1 text-sm text-muted">{o.pickedUp}</p> : (current.city || current.address) && <p dir="auto" className="mt-1 text-sm text-muted">{[current.city && inLang(current.city, KNOWN_CITIES, lang), current.address].filter(Boolean).join(" · ")}</p>}
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
                              {/* the size the customer chose (clothing and shoes) */}
                              {it.size && <span className="mt-0.5 block text-xs font-semibold text-muted">{o.size}: <bdi>{it.size}</bdi></span>}
                            </span>
                          </span>
                          <span dir="ltr" className="shrink-0 font-bold">
                            {fmt(it.price * it.qty)} <small className="text-xs opacity-70">{o.currency}</small>
                          </span>
                        </li>
                      ))}
                      {/* the coupon the customer used at checkout (the total is already after it) */}
                      {current.coupon && (
                        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          <span>{lang === "ar" ? "كود الخصم" : "Coupon"} <span dir="ltr" className="font-bold">{current.coupon.code}</span></span>
                          <span dir="ltr" className="shrink-0 font-bold">−{fmt(current.coupon.discount)} <small className="text-xs opacity-70">{o.currency}</small></span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-soft/70 px-4 py-4">
                  <div>
                    {/* A cancelled order was never paid, a refunded one was paid back */}
                    <p className="text-sm font-bold">{current.status === "pending" ? o.unpaid : current.status === "cancelled" ? o.cancelledPay : current.status === "refunded" ? o.refundedPay : o.paid}</p>
                    {current.status === "pending" && <p className="mt-0.5 text-xs text-muted">{o.paymentHint}</p>}
                  </div>
                  <p dir="ltr" className="text-xl font-extrabold">
                    {fmt(current.total)} <small className="text-xs font-bold opacity-70">{o.currency}</small>
                  </p>
                </div>

                <div className="mt-6 max-w-xs">
                  <label htmlFor="o-status" className="mb-2 block text-sm font-semibold">{o.changeStatus}</label>
                  <select id="o-status" value={askStatus ?? current.status} onChange={(e) => pickStatus(current.id, e.target.value as StatusKey)} className={`${field} h-11`}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{o.statuses[k]}</option>)}
                  </select>
                </div>
                {askStatus && (
                  <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-rose-600">{o.statusAsk.replace("{status}", o.statuses[askStatus])}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderStatus(current.id, askStatus);
                        setAskStatus(null);
                      }}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                      {o.statusYes}
                    </button>
                    <button type="button" onClick={() => setAskStatus(null)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{o.statusNo}</button>
                  </div>
                )}

                <div className="mt-8 border-t border-fg/10 pt-5">
                  <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{o.delete}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {confirmDelete && current && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              remove(current.id);
            }}
            noValidate
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="d-title"
            aria-describedby="d-ask"
            className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10"
          >
            <h2 id="d-title" className="text-lg font-bold">{o.delete} <span dir="ltr">#{current.id}</span></h2>
            <p id="d-ask" className="mt-2 text-sm text-rose-600">{o.deleteAsk}</p>
            <label htmlFor="d-reason" className="mb-2 mt-5 block text-sm font-semibold">{o.deleteReason}<RequiredMark /></label>
            <textarea
              id="d-reason"
              ref={reasonRef}
              rows={4}
              dir="auto"
              aria-required
              aria-describedby="d-hint"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={o.deleteReasonPh}
              maxLength={DELETE_REASON.max}
              className={`${field} block resize-y py-3 leading-relaxed`}
            />
            <p id="d-hint" className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
              <span>{o.deleteReasonHint.replace("{min}", String(DELETE_REASON.min))}</span>
              <span dir="ltr">{reason.length}/{DELETE_REASON.max}</span>
            </p>
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={!reasonOk} className="h-12 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-600">{o.deleteYes}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{o.cancel}</button>
            </div>
          </form>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={o.formTitle} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{o.formTitle}</h2>
            {hasErrors(errors) && <div className="mt-2"><RequiredNote text={requiredNote[lang]} show /></div>}
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="n-name" className="mb-2 block text-sm font-semibold">{o.customer}<RequiredMark /></label>
                <input id="n-name" ref={nameRef} aria-required aria-invalid={!!errors.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={o.namePh} maxLength={60} className={`${field} h-11 ${errors.name ? bad : ""}`} />
                {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="n-phone" className="mb-2 block text-sm font-semibold">{o.phone}<RequiredMark /></label>
                <input id="n-phone" dir="ltr" inputMode="tel" aria-required aria-invalid={!!errors.phone} value={phone} onChange={(e) => setPhone(typedAnyPhone(e.target.value))} placeholder="07X XXX XXXX" maxLength={20} className={`${field} h-11 text-start ${errors.phone ? bad : ""}`} />
                {errors.phone && <p className="mt-1.5 text-xs text-rose-600">{errors.phone}</p>}
              </div>
              <div role="radiogroup" aria-label={o.fulfil}>
                <p className="mb-2 text-sm font-semibold">{o.fulfil}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={fulfil === k} onClick={() => { setFulfil(k); setErrors((x) => ({ ...x, city: undefined, address: undefined })); }} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${fulfil === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                      {k === "delivery" ? o.fulfilDelivery : o.fulfilPickup}
                    </button>
                  ))}
                </div>
              </div>
              {fulfil === "delivery" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="n-city" className="mb-2 block text-sm font-semibold">{o.city}<RequiredMark /></label>
                    <select id="n-city" aria-required aria-invalid={!!errors.city} value={city} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: undefined })); }} className={`${field} h-11 ${errors.city ? bad : ""}`}>
                      <option value="">{o.cityPh}</option>
                      {CITIES[lang].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.city && <p className="mt-1.5 text-xs text-rose-600">{errors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="n-address" className="mb-2 block text-sm font-semibold">{o.address}<RequiredMark /></label>
                    <input id="n-address" aria-required aria-invalid={!!errors.address} value={address} onChange={(e) => { setAddress(e.target.value); setErrors((x) => ({ ...x, address: undefined })); }} placeholder={o.addressPh} maxLength={ORDER_LIMITS.address} className={`${field} h-11 ${errors.address ? bad : ""}`} />
                    {errors.address && <p className="mt-1.5 text-xs text-rose-600">{errors.address}</p>}
                  </div>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="n-total" className="mb-2 block text-sm font-semibold">{o.total} ({o.currency})<RequiredMark /></label>
                  <input id="n-total" dir="ltr" inputMode="decimal" aria-required aria-invalid={!!errors.total} value={total} onChange={(e) => setTotal(typedMoney(e.target.value, 3))} placeholder="0.00" maxLength={10} className={`${field} h-11 text-start ${errors.total ? bad : ""}`} />
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
