"use client";

import { useEffect, useRef, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { demoOff, demoOffText, useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { cleanDomain, isSlug, RESERVED_SLUGS, SLUG_RULE, typedSlug } from "./safe";
import { ACCOUNT_LIMITS, cleanDomains, reservedSlugError, type CustomDomain as Custom } from "./safeAccount";
import { loadSetup, saveSetup } from "./setup";
import { buyDomain, searchDomains, type DomainOffer } from "./domainShop";

const KEY = "seen-domains";
const PREFIX = "dukkan.store/";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

const copy = {
  en: {
    title: "Store domain",
    newDomain: "Connect a domain",
    current: "Current store address",
    currentHint: "The link your visitors use to reach your store.",
    edit: "Edit",
    copy: "Copy",
    copied: "Copied",
    share: "Share",
    save: "Save",
    cancel: "Cancel",
    invalid: "Use 3 to 30 letters (a to z), numbers or hyphens. It can't start or end with a hyphen.",
    saved: "Store address updated",
    noSlug: "You haven't chosen a store address yet. Finish setting up your store to pick one.",
    setup: "Choose address",
    custom: "Your own domains",
    searchPh: "Search",
    cols: ["Domain", "Status", "Added on", "Actions"],
    pending: "Awaiting setup",
    remove: "Remove",
    removeAsk: "Remove this domain?",
    removeYes: "Yes, remove",
    emptyTitle: "No domains connected",
    emptyHint: "Already own a domain like mystore.com? Add it here to use it for your store.",
    noMatch: "No domains match your search",
    formTitle: "Connect a domain",
    domainLabel: "Your domain",
    domainPh: "mystore.com",
    domainHint: "Type the domain without https:// or www.",
    errDomain: "Enter a valid domain, for example mystore.com",
    errDup: "This domain is already in your list",
    add: "Add domain",
    note: "Prototype: connecting your own domain isn't live yet. Domains you add are only saved on this device.",
    shareTitle: "My store",
    buyTitle: "Buy a domain",
    buyHint: "Get your own address, like olive.com. We register it for you and connect it to your store, no setup needed.",
    buyPh: "Your store name, e.g. olive",
    buySearch: "Search",
    buyShort: "Type at least 3 letters or numbers.",
    buySearching: "Checking which endings are free…",
    perYear: "JOD / year",
    buy: "Buy",
    taken: "Taken",
    papers: "For businesses registered in Jordan: we ask for the commercial registration after buying.",
    confirmTitle: "Buy this domain",
    years: "For how long",
    year: (n: number) => (n === 1 ? "1 year" : `${n} years`),
    total: "Total",
    autoRenew: "Renew it by itself every year, so the store never loses its address",
    buyNote: "Prototype: no payment is taken and nothing is registered yet.",
    confirmBuy: "Confirm purchase",
    buying: "Buying…",
    boughtMsg: (d: string) => `${d} is yours. It is connected to your store.`,
    takenNow: "Someone just took this domain. Try another ending.",
    active: "Active",
    boughtTag: "Bought through Dukkan",
    renews: "Renews on",
    ends: "Ends on",
  },
  ar: {
    title: "دومين المتجر",
    newDomain: "ربط نطاق",
    current: "عنوان المتجر الحالي",
    currentHint: "الرابط الذي يصل من خلاله الزوار إلى متجرك.",
    edit: "تعديل",
    copy: "نسخ",
    copied: "تم النسخ",
    share: "مشاركة",
    save: "حفظ",
    cancel: "إلغاء",
    invalid: "استخدم من 3 إلى 30 حرفًا لاتينيًا (a-z) أو أرقامًا أو شرطات، ولا يبدأ أو ينتهي بشرطة.",
    saved: "تم تحديث عنوان المتجر",
    noSlug: "لم تختر عنوان متجرك بعد. أكمل إعداد متجرك لاختياره.",
    setup: "اختيار العنوان",
    custom: "نطاقاتك الخاصة",
    searchPh: "بحث",
    cols: ["النطاق", "الحالة", "تاريخ الإضافة", "إجراءات"],
    pending: "بانتظار الإعداد",
    remove: "إزالة",
    removeAsk: "هل تريد إزالة هذا النطاق؟",
    removeYes: "نعم، أزل",
    emptyTitle: "لا توجد نطاقات مربوطة",
    emptyHint: "لديك نطاق مثل mystore.com؟ أضفه هنا لتستخدمه لمتجرك.",
    noMatch: "لا توجد نطاقات مطابقة لبحثك",
    formTitle: "ربط نطاق",
    domainLabel: "النطاق",
    domainPh: "mystore.com",
    domainHint: "اكتب النطاق بدون https:// أو www.",
    errDomain: "أدخل نطاقًا صحيحًا، مثل mystore.com",
    errDup: "هذا النطاق موجود في قائمتك",
    add: "إضافة النطاق",
    note: "نسخة تجريبية: ربط نطاقك الخاص غير مفعّل بعد. النطاقات التي تضيفها تُحفظ على هذا الجهاز فقط.",
    shareTitle: "متجري",
    buyTitle: "اشترِ نطاقًا",
    buyHint: "احصل على عنوان خاص لمتجرك مثل olive.com. نسجّله لك ونربطه بمتجرك تلقائيًا بدون أي إعداد.",
    buyPh: "اسم متجرك، مثل olive",
    buySearch: "ابحث",
    buyShort: "اكتب 3 أحرف أو أرقام على الأقل.",
    buySearching: "نتحقق من النطاقات المتاحة…",
    perYear: "د.أ / سنة",
    buy: "شراء",
    taken: "محجوز",
    papers: "للأعمال المسجّلة في الأردن: نطلب السجل التجاري بعد الشراء.",
    confirmTitle: "شراء هذا النطاق",
    years: "المدة",
    year: (n: number) => (n === 1 ? "سنة واحدة" : n === 2 ? "سنتان" : `${n} سنوات`),
    total: "الإجمالي",
    autoRenew: "جدّده تلقائيًا كل سنة، حتى لا يفقد متجرك عنوانه",
    buyNote: "نسخة تجريبية: لا يُدفع أي مبلغ ولا يُسجَّل النطاق فعليًا بعد.",
    confirmBuy: "تأكيد الشراء",
    buying: "جارٍ الشراء…",
    boughtMsg: (d: string) => `أصبح ${d} لك، وتم ربطه بمتجرك.`,
    takenNow: "حجز أحدهم هذا النطاق للتو. جرّب نهاية أخرى.",
    active: "فعّال",
    boughtTag: "مشترى من دكان",
    renews: "يتجدد في",
    ends: "ينتهي في",
  },
};

function load(): Custom[] {
  try {
    const raw = localStorage.getItem(KEY);
    /* anything can be written into this browser storage: only real domains are kept */
    return raw ? cleanDomains(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function Domain() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const locale = dateLocale(lang);

  const [slug, setSlug] = useState("");
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const tour = useDemo();
  const [draft, setDraft] = useState("");
  const [slugError, setSlugError] = useState("");
  const [flash, setFlash] = useState("");

  const [list, setList] = useState<Custom[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  /* buying a domain: what he searched, the answer, and the one he is buying */
  const [wanted, setWanted] = useState("");
  const [offers, setOffers] = useState<DomainOffer[] | "short" | "searching" | null>(null);
  const [buying, setBuying] = useState<DomainOffer | null>(null);
  const [years, setYears] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);
  const [paying, setPaying] = useState(false);
  const [buyMsg, setBuyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    setSlug(loadSetup()?.slug ?? "");
    setList(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  }, [list, ready]);

  useEffect(() => {
    if (!adding) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAdding(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [adding]);

  const url = slug ? `${PREFIX}${slug}` : "";
  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 1600);
  };

  const copyUrl = async () => {
    if (tour) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; /* clipboard blocked: do not claim it was copied */
    }
    flashMsg(c.copied);
  };

  const share = async () => {
    if (tour) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: c.shareTitle, text: url });
      } catch {
        /* cancelled */
      }
    } else {
      void copyUrl();
    }
  };

  const saveSlug = () => {
    const v = draft.trim();
    if (!isSlug(v)) {
      setSlugError(SLUG_RULE.test(v) && RESERVED_SLUGS.has(v) ? reservedSlugError[lang] : c.invalid);
      return;
    }
    const s = loadSetup();
    if (s) saveSetup({ ...s, slug: v });
    setSlug(v);
    setEditing(false);
    setSlugError("");
    flashMsg(c.saved);
  };

  const addDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const v = cleanDomain(name);
    if (!v) return setNameError(c.errDomain);
    if (list.some((d) => d.name === v)) return setNameError(c.errDup);
    if (list.length >= ACCOUNT_LIMITS.domains) return setNameError(c.errDomain);
    setList((l) => [...l, { id: l.reduce((m, d) => Math.max(m, d.id), 0) + 1, name: v, added: Date.now() }]);
    setName("");
    setNameError("");
    setAdding(false);
  };

  const search = async () => {
    setBuyMsg(null);
    setOffers("searching");
    setOffers(await searchDomains(wanted));
  };

  const confirmBuy = async () => {
    if (!buying || tour) return;
    setPaying(true);
    const r = await buyDomain(buying, years, autoRenew);
    setPaying(false);
    if (!r.ok) {
      setBuyMsg({ ok: false, text: c.takenNow });
      setBuying(null);
      return;
    }
    setList((l) => [...l.filter((d) => d.name !== r.name), { id: l.reduce((m, d) => Math.max(m, d.id), 0) + 1, name: r.name, added: Date.now(), bought: r.bought }]);
    setOffers((o) => (Array.isArray(o) ? o.map((x) => (x.name === r.name ? { ...x, free: false } : x)) : o));
    setBuyMsg({ ok: true, text: c.boughtMsg(r.name) });
    setBuying(null);
  };

  const day = (t: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(t));
  const shown = list.filter((d) => d.name.includes(query.trim().toLowerCase()));
  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="domain"
        subtabs={[c.title]}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-extrabold">{c.current}</h1>
              <p className="mt-1 text-sm text-muted">{c.currentHint}</p>
            </div>
            {slug && !editing && (
              <button
                type="button"
                disabled={tour}
                title={tour ? demoOffText(lang) : undefined}
                onClick={() => {
                  setDraft(slug);
                  setSlugError("");
                  setEditing(true);
                }}
                className={`rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white ${demoOff}`}
              >
                {c.edit}
              </button>
            )}
          </div>

          {!ready ? null : !slug ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-5 py-5">
              <p className="text-sm text-muted">{c.noSlug}</p>
              <a href="/onboarding" className="rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{c.setup}</a>
            </div>
          ) : editing ? (
            <div className="mt-5">
              <div dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border bg-card text-sm transition focus-within:ring-2 ${slugError ? "border-rose-500 focus-within:ring-rose-500/25" : "border-fg/15 focus-within:border-primary focus-within:ring-primary/25"}`}>
                <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">{PREFIX}</span>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(typedSlug(e.target.value));
                    setSlugError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && saveSlug()}
                  spellCheck={false}
                  autoCapitalize="none"
                  aria-label={c.current}
                  className="h-full flex-1 bg-transparent px-3 outline-none"
                />
              </div>
              {slugError && <p className="mt-2 text-xs text-rose-600">{slugError}</p>}
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={saveSlug} className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{c.save}</button>
                <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-soft px-5 py-5">
              <p dir="ltr" className="break-all text-lg font-bold">{url}</p>
              <div className="flex items-center gap-4 text-sm font-semibold text-primary">
                <button type="button" onClick={copyUrl} className="hover:underline">{flash === c.copied ? c.copied : c.copy}</button>
                <button type="button" onClick={share} className="hover:underline">{c.share}</button>
              </div>
            </div>
          )}
          {flash === c.saved && <p role="status" className="mt-3 text-sm font-semibold text-primary">{c.saved}</p>}
        </section>

        {/* Buying a domain through Dukkan (components/domainShop.ts) */}
        <section className={card}>
          <h2 className="text-lg font-extrabold">{c.buyTitle}</h2>
          <p className="mt-1 text-sm text-muted">{c.buyHint}</p>
          <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="mt-5 flex gap-3">
            <input dir="ltr" value={wanted} onChange={(e) => setWanted(e.target.value)} placeholder={c.buyPh} aria-label={c.buyTitle} maxLength={60} spellCheck={false} autoCapitalize="none" className={`${field} h-12 flex-1 text-start`} />
            <button type="submit" disabled={offers === "searching"} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep disabled:opacity-50">{c.buySearch}</button>
          </form>
          {buyMsg && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${buyMsg.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>{buyMsg.text}</p>}
          {offers === "short" && <p className="mt-3 text-xs text-rose-600">{c.buyShort}</p>}
          {offers === "searching" && <p className="mt-4 text-sm text-muted">{c.buySearching}</p>}
          {Array.isArray(offers) && (
            <ul className="mt-5 divide-y divide-fg/10 overflow-hidden rounded-xl border border-fg/10">
              {offers.map((o) => (
                <li key={o.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p dir="ltr" className={`text-start font-bold ${o.free ? "" : "text-muted line-through"}`}>{o.name}</p>
                    {o.needsPapers && o.free && <p className="mt-0.5 text-xs text-muted">{c.papers}</p>}
                  </div>
                  {o.free ? (
                    <>
                      <span className="text-sm font-semibold"><span dir="ltr">{o.price}</span> {c.perYear}</span>
                      <button type="button" disabled={tour} title={tour ? demoOffText(lang) : undefined} onClick={() => { setYears(1); setAutoRenew(true); setBuying(o); }} className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${demoOff}`}>{c.buy}</button>
                    </>
                  ) : (
                    <span className="rounded-full bg-fg/10 px-3 py-1 text-xs font-bold text-muted">{c.taken}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">{c.custom}</h2><button type="button" onClick={() => setAdding(true)} disabled={tour} title={tour ? demoOffText(lang) : undefined} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"> + {c.newDomain} </button></div>

          <div className="relative mt-5">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.searchPh} aria-label={c.searchPh} className={`${field} h-12 ps-12`} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>{c.cols.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {shown.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-soft/40">
                    <td className={`${td} font-semibold`} dir="ltr">{d.name}</td>
                    <td className={td}>
                      {d.bought ? (
                        <>
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                            {c.active} · {c.boughtTag}
                          </span>
                          <p className="mt-1 text-xs text-muted">{d.bought.autoRenew ? c.renews : c.ends} {day(d.bought.renews)}</p>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                          {c.pending}
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-muted`}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(d.added))}</td>
                    <td className={td}>
                      {confirm === d.id ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-rose-600">{c.removeAsk}</span>
                          <button type="button" onClick={() => { setList((l) => l.filter((x) => x.id !== d.id)); setConfirm(null); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">{c.removeYes}</button>
                          <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-fg/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-soft">{c.cancel}</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(d.id)} className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10">{c.remove}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="font-bold">{list.length === 0 ? c.emptyTitle : c.noMatch}</p>
                {list.length === 0 && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{c.emptyHint}</p>}
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted">{c.note}</p>
        </section>
      </main>

      {buying && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && !paying && setBuying(null)}>
          <div role="dialog" aria-modal="true" aria-label={c.confirmTitle} className="dash my-8 w-full max-w-md rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{c.confirmTitle}</h2>
            <p dir="ltr" className="mt-3 rounded-xl bg-soft px-4 py-3 text-start text-lg font-extrabold">{buying.name}</p>
            <p className="mb-2 mt-5 text-sm font-semibold">{c.years}</p>
            <div role="radiogroup" aria-label={c.years} className="flex flex-wrap gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={years === n} onClick={() => setYears(n)} className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${years === n ? "border-primary bg-primary text-white" : "border-fg/20 hover:bg-soft"}`}>{c.year(n)}</button>
              ))}
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]" />
              <span>{c.autoRenew}</span>
            </label>
            {buying.needsPapers && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{c.papers}</p>}
            <div className="mt-5 flex items-center justify-between border-t border-fg/10 pt-4">
              <span className="text-sm font-semibold">{c.total}</span>
              <span className="text-lg font-extrabold"><span dir="ltr">{buying.price * years}</span> {lang === "ar" ? "د.أ" : "JOD"}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{c.buyNote}</p>
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={paying} onClick={() => void confirmBuy()} className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep disabled:opacity-60">{paying ? c.buying : c.confirmBuy}</button>
              <button type="button" disabled={paying} onClick={() => setBuying(null)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setAdding(false)}>
          <form onSubmit={addDomain} noValidate role="dialog" aria-modal="true" aria-label={c.formTitle} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{c.formTitle}</h2>
            <div className="mt-5">
              <label htmlFor="d-name" className="mb-2 block text-sm font-semibold">{c.domainLabel}</label>
              <input id="d-name" ref={nameRef} dir="ltr" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder={c.domainPh} maxLength={80} spellCheck={false} autoCapitalize="none" className={`${field} h-11 text-start`} />
              <p className="mt-1.5 text-xs text-muted">{c.domainHint}</p>
              {nameError && <p className="mt-1.5 text-xs text-rose-600">{nameError}</p>}
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{c.add}</button>
              <button type="button" onClick={() => setAdding(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
