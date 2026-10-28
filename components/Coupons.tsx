"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { pushNotification } from "./notifications";
import { demoOff, demoOffText, useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { COUPON_MAX, cleanCoupon, cleanCouponDescription, cleanCouponName, couponName, couponProblems, parseList, storeToday, typedMoney, type Coupon, type CouponKind, type CouponType } from "./records";

/* ====================================================================
   Types
   ==================================================================== */

/** Dukkan offers four kinds of coupon, in this order: discount, free shipping, custom, next order.
    The coupon itself and its rules are in records.ts, shared with the server. */
type Kind = CouponKind;

const KEY = "seen-coupons";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const field =
  "h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const icon = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* One icon per coupon type */
const typeIcons = [
  <svg key="0" {...icon}><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3v3ZM9 9l6 6M9.5 9.5h.01M14.5 14.5h.01" /></svg>,
  <svg key="1" {...icon}><path d="M2 6h11v10H2zM13 9h5l3 3v4h-8" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>,
  <svg key="2" {...icon}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></svg>,
  <svg key="3" {...icon}><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z" /><path d="m3 7 9 4 9-4M12 11v10M8.5 14l2 2 3.5-4" /></svg>,
];

/* ====================================================================
   Helpers
   ==================================================================== */

/* Today in the store's time zone, so a coupon ends at midnight in Jordan and not at midnight in London */
const isoToday = () => storeToday();

/** Random code without look-alike characters (no 0/O, 1/I). */
function randomCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function statusOf(c: Coupon): 1 | 2 | 3 | 4 {
  /* 1 active, 2 disabled, 3 expired, 4 used up (matches the statuses list) */
  if (c.end && c.end < isoToday()) return 3;
  if (c.limit > 0 && c.used >= c.limit) return 4;
  return c.active ? 1 : 2;
}

/* The sample coupons an older version could load (s1 to s4): they are not his, so they are dropped */
const OLD_SAMPLES = new Set(["s1", "s2", "s3", "s4"]);

function loadCoupons(): Coupon[] {
  try {
    /* What is saved is checked again when it is read: storage can hold old, broken or hand-changed coupons */
    return parseList(sessionStorage.getItem(KEY), cleanCoupon).filter((c) => !OLD_SAMPLES.has(c.id));
  } catch {
    return [];
  }
}

/* ====================================================================
   Create / edit dialog
   ==================================================================== */

function CouponDialog({
  type,
  initial,
  taken,
  onSave,
  onClose,
}: {
  type: CouponType;
  initial: Coupon | null;
  /* the codes of his other coupons, so the same code isn't used twice */
  taken: string[];
  onSave: (c: Coupon) => void;
  onClose: () => void;
}) {
  const { lang } = usePrefs();
  const m = content[lang].coupons;
  const f = m.form;
  const currency = content[lang].reports.currency;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [code, setCode] = useState(initial?.code ?? (type === 3 ? "NEXT" : ""));
  const [kind, setKind] = useState<Kind>(type === 1 ? "shipping" : initial?.kind === "fixed" ? "fixed" : "percent");
  const [value, setValue] = useState(initial && initial.kind !== "shipping" ? String(initial.value) : "");
  const [minOrder, setMinOrder] = useState(initial?.minOrder ? String(initial.minOrder) : "");
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [limit, setLimit] = useState(initial?.limit ? String(initial.limit) : "");
  const [validDays, setValidDays] = useState(initial?.validDays ? String(initial.validDays) : "30");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const cleanCode = latin(code).trim().toUpperCase();
    const amount = Number(value);
    const min = Number(minOrder) > 0 ? Number(minOrder) : 0;
    const days = parseInt(validDays, 10);
    /* The same rules the server will use (records.ts) */
    const bad = couponProblems({ type, name, code: cleanCode, kind, value: kind === "shipping" ? 0 : amount, minOrder: min, start, end, limit: 0, validDays: days }, taken, initial?.end, isoToday());
    const say: Record<string, [string, string]> = { code: ["code", f.errCode], dup: ["code", f.errDup], value: ["value", f.errValue], percent: ["value", f.errPercent], overMin: ["value", f.errOverMin], past: ["end", f.errPast], dates: ["end", f.errDates], days: ["validDays", f.errDays] };
    for (const b of bad) if (!next[say[b][0]]) next[say[b][0]] = say[b][1];
    setErrors(next);
    /* the first field with a mistake comes into view with the cursor in it */
    const firstBad = (["code", "value", "validDays", "end"] as const).find((k) => next[k]);
    if (firstBad) {
      const el = document.getElementById({ code: "c-code", value: "c-value", validDays: "c-days", end: "c-end" }[firstBad]);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    onSave({
      id: initial?.id ?? `${Date.now()}-${cleanCode}`,
      type,
      /* optional: an empty name (or only spaces) shows the code instead */
      name: cleanCouponName(name),
      code: cleanCode,
      description: cleanCouponDescription(description),
      kind,
      value: kind === "shipping" ? 0 : amount,
      minOrder: min,
      start,
      end,
      limit: parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 0,
      validDays: type === 3 ? days : 0,
      used: initial?.used ?? 0,
      active: initial?.active ?? true,
    });
  };

  const err = (key: string) => (errors[key] ? <p className="mt-1.5 text-xs text-rose-600">{errors[key]}</p> : null);
  const label = "mb-2 block text-sm font-semibold";
  const req = <span className="ms-1 text-rose-600" aria-hidden>*</span>;
  /* a field's mistake goes away as soon as he edits it */
  const fix = (key: string) => errors[key] && setErrors((x) => ({ ...x, [key]: "" }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={initial ? f.editTitle : m.types[type].title} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-primary">{typeIcons[type]}</span>
          <div>
            <h2 className="text-lg font-bold">{initial ? f.editTitle : f.createTitle.replace("{type}", m.types[type].title)}</h2>
            <p className="text-sm text-muted">{m.types[type].desc}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className={label} htmlFor="c-name">{f.name}</label>
            <input id="c-name" ref={first} value={name} onChange={(e) => setName(e.target.value)} placeholder={f.namePh} maxLength={COUPON_MAX.name} aria-describedby="c-name-hint" className={field} />
            <p id="c-name-hint" className="mt-1.5 text-xs text-muted">{f.nameHint}</p>
          </div>

          <div>
            <label className={label} htmlFor="c-code">{type === 3 ? f.prefix : f.code}{req}</label>
            <div dir="ltr" className="flex gap-2">
              <input id="c-code" aria-invalid={!!errors.code} value={code} onChange={(e) => { setCode(latin(e.target.value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16)); fix("code"); }} placeholder={`${f.example} SUMMER10`} spellCheck={false} className={`${field} font-semibold tracking-wider placeholder:font-normal placeholder:tracking-normal ${errors.code ? bad : ""}`} />
              <button type="button" onClick={() => { setCode(randomCode()); fix("code"); }} className="shrink-0 rounded-xl border border-primary/50 px-4 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                {f.generate}
              </button>
            </div>
            {err("code")}
            {type === 3 && <p className="mt-1.5 text-xs text-muted">{f.nextNote}</p>}
          </div>

          {type === 1 ? (
            <p className="rounded-xl bg-soft px-4 py-3 text-sm text-muted">{f.shipNote}</p>
          ) : (
            <div>
              {type !== 3 && (
                <>
                  <span className={label}>{f.kind}</span>
                  <div role="radiogroup" className="mb-4 grid grid-cols-2 gap-3">
                    {(["percent", "fixed"] as const).map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`h-11 rounded-xl border text-sm font-semibold transition ${kind === k ? "border-primary bg-primary/10" : "border-fg/15 hover:border-primary/50"}`}>
                        {k === "percent" ? f.percent : f.fixed}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label className={label} htmlFor="c-value">{f.value}{req}</label>
              <div dir="ltr" className="relative">
                <input id="c-value" aria-invalid={!!errors.value} value={value} onChange={(e) => { setValue(typedMoney(e.target.value, 3)); fix("value"); }} inputMode="decimal" placeholder={`${f.example} 10`} className={`${field} pe-16 ${errors.value ? bad : ""}`} />
                <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">{kind === "percent" ? "%" : currency}</span>
              </div>
              {err("value")}
            </div>
          )}

          {type === 3 && (
            <div>
              <label className={label} htmlFor="c-days">{f.validDays}{req}</label>
              <input id="c-days" dir="ltr" aria-invalid={!!errors.validDays} value={validDays} onChange={(e) => { setValidDays(latin(e.target.value).replace(/\D/g, "").slice(0, 3)); fix("validDays"); }} inputMode="numeric" className={`${field} ${errors.validDays ? bad : ""}`} />
              {err("validDays")}
            </div>
          )}

          <div>
            <label className={label} htmlFor="c-min">{f.min}</label>
            <input id="c-min" dir="ltr" value={minOrder} onChange={(e) => { setMinOrder(typedMoney(e.target.value, 3)); fix("value"); }} inputMode="decimal" placeholder={currency} className={field} />
            <p className="mt-1.5 text-xs text-muted">{f.minHint}</p>
          </div>

          {type !== 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="c-start">{f.start}</label>
                <input id="c-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="c-end">{f.end}</label>
                <input id="c-end" type="date" aria-invalid={!!errors.end} value={end} onChange={(e) => { setEnd(e.target.value); fix("end"); }} className={`${field} ${errors.end ? bad : ""}`} />
                {err("end")}
              </div>
            </div>
          )}

          <div>
            <label className={label} htmlFor="c-desc">{f.description}</label>
            <textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={f.descriptionPh} rows={3} maxLength={COUPON_MAX.description} aria-describedby="c-desc-hint" className={`${field} !h-auto resize-y py-3`} />
            <p id="c-desc-hint" className="mt-1.5 text-xs text-muted">{f.descriptionHint}</p>
          </div>

          <div>
            <label className={label} htmlFor="c-limit">{f.limit}</label>
            <input id="c-limit" dir="ltr" value={limit} onChange={(e) => setLimit(latin(e.target.value).replace(/\D/g, "").slice(0, 7))} inputMode="numeric" placeholder="∞" className={field} />
            <p className="mt-1.5 text-xs text-muted">{f.limitHint}</p>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{f.save}</button>
          <button type="button" onClick={onClose} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{f.cancel}</button>
        </div>
      </form>
    </div>
  );
}

/* ====================================================================
   Page
   ==================================================================== */

export function Coupons() {
  const { lang } = usePrefs();
  const tour = useDemo();
  const m = content[lang].coupons;
  const currency = content[lang].reports.currency;
  const locale = dateLocale(lang);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<{ type: CouponType; coupon: Coupon | null } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${m.title}`;
  }, [lang, m]);

  useEffect(() => {
    setCoupons(loadCoupons());
    setReady(true);
  }, []);

  /* Coupons are kept for this browser session only. */
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(coupons));
    } catch {
      /* storage unavailable: coupons just won't survive a reload */
    }
  }, [coupons, ready]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  };

  const shown = useMemo(
    () =>
      coupons.filter((c) => {
        if (tab > 0 && statusOf(c) !== tab) return false;
        const q = query.trim().toLowerCase();
        return q === "" || couponName(c).toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      }),
    [coupons, tab, query],
  );

  const save = (c: Coupon) => {
    if (!coupons.some((x) => x.id === c.id)) pushNotification("couponCreated", { code: c.code });
    setCoupons((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list]));
    setDialog(null);
    flash(m.form.saved);
  };

  const copyCode = async (code: string) => {
    if (tour) return;
    try {
      await navigator.clipboard.writeText(code);
      flash(m.copied);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const exportCsv = () => {
    const header = m.cols.slice(0, 5).join(",");
    const rows = shown.map((c) =>
      [couponName(c), c.code, discountText(c), c.start || m.startsNow, c.end || m.noEnd, m.statuses[statusOf(c)]]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coupons.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const discountText = (c: Coupon) => (c.kind === "shipping" ? m.freeShipping : c.kind === "percent" ? `${c.value}%` : `${c.value} ${currency}`);
  const dateText = (iso: string, fallback: string) => (iso ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso + "T00:00:00")) : fallback);

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";
  const pill = ["", "bg-primary/15 text-deep dark:text-primary", "bg-fg/10 text-muted", "bg-rose-500/15 text-rose-600 dark:text-rose-400", "bg-fg/10 text-muted"];

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="marketing"
        subtabs={m.tabs}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-extrabold">{m.title}</h1>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep"
            >
              <span aria-hidden>+</span>
              {m.newCoupon}
              <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute end-0 top-full z-30 mt-2 w-80 max-w-[85vw] animate-[fadeIn_0.2s_ease] overflow-hidden rounded-xl border border-fg/10 bg-card text-fg shadow-2xl">
                {m.types.map((t, i) => (
                  <button
                    key={t.title}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setDialog({ type: i as CouponType, coupon: null });
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-soft"
                  >
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft text-primary">{typeIcons[i]}</span>
                    <span>
                      <span className="block text-sm font-bold">{t.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{t.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={m.search} aria-label={m.search} className={`${field} min-w-[14rem] flex-1`} />
            <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="h-11 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50">
              {m.export}
            </button>
          </div>

          <div role="tablist" className="mt-5 flex flex-wrap gap-5 border-b border-fg/10 text-sm font-medium">
            {m.statuses.map((s, i) => (
              <button key={s} role="tab" aria-selected={tab === i} type="button" onClick={() => setTab(i)} className={`-mb-px border-b-2 pb-3 transition-colors ${tab === i ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-fg"}`}>
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[46rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>
                  {m.cols.map((col) => (
                    <th key={col} className={th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {shown.map((c) => {
                  const st = statusOf(c);
                  const on = c.active && st !== 3;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-soft/40">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft text-primary">{typeIcons[c.type]}</span>
                          <div>
                            <button type="button" onClick={() => copyCode(c.code)} disabled={tour} title={tour ? demoOffText(lang) : m.copy} className={`flex items-center gap-2 font-bold tracking-wide hover:text-primary ${demoOff}`} dir="ltr">
                              {c.code}
                              <svg {...icon} className="h-3.5 w-3.5 text-muted"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                            </button>
                            {/* the name only when it says more than the code (an empty name means the code is the name) */}
                            {(couponName(c) !== c.code || c.used > 0) && <p className="text-xs text-muted">{[couponName(c) !== c.code ? couponName(c) : "", c.used > 0 ? m.used.replace("{n}", String(c.used)) : ""].filter(Boolean).join(" · ")}</p>}
                            {c.description && <p className="mt-0.5 max-w-xs whitespace-pre-line break-words text-xs text-muted/80 line-clamp-2" title={c.description}>{c.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} font-semibold`}><span dir="ltr">{discountText(c)}</span></td>
                      <td className={`${td} text-muted`}>{dateText(c.start, m.startsNow)}</td>
                      <td className={`${td} text-muted`}>{dateText(c.end, m.noEnd)}</td>
                      <td className={td}>
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${pill[st]}`}>
                          <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                          {m.statuses[st]}
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          {/* An expired coupon can't run, so its switch shows off and can't be pressed */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={(on ? m.turnOff : m.turnOn).replace("{code}", c.code)}
                            title={st === 3 ? m.expiredOff : undefined}
                            disabled={st === 3}
                            onClick={() => setCoupons((list) => list.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)))}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-primary" : "bg-fg/20"}`}
                          >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`} />
                          </button>
                          <button type="button" onClick={() => setDialog({ type: c.type, coupon: c })} aria-label={m.edit} title={m.edit} className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15 text-fg transition hover:bg-soft">
                            <svg {...icon} className="h-4 w-4"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
                          </button>
                          {deleting === c.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCoupons((list) => list.filter((x) => x.id !== c.id));
                                setDeleting(null);
                              }}
                              onBlur={() => setDeleting(null)}
                              autoFocus
                              className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white"
                            >
                              {m.confirmDel}
                            </button>
                          ) : (
                            <button type="button" onClick={() => setDeleting(c.id)} aria-label={m.del} title={m.del} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-500/40 text-rose-500 transition hover:bg-rose-500/10">
                              <svg {...icon} className="h-4 w-4"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {coupons.length === 0 && (
              <div className="px-4 py-14 text-center">
                <p className="font-bold">{m.empty}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{m.emptyHint}</p>
              </div>
            )}
            {coupons.length > 0 && shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{m.noMatch}</p>}
          </div>
        </section>
      </main>

      {dialog && <CouponDialog type={dialog.type} initial={dialog.coupon} taken={coupons.filter((x) => x.id !== dialog.coupon?.id).map((x) => x.code)} onSave={save} onClose={() => setDialog(null)} />}

      {toast && (
        <div role="status" className="fixed bottom-6 start-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-onink shadow-2xl rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
