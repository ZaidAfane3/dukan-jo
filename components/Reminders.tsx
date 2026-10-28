"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { REMINDER_MAX, cleanReminder, parseList, type Reminder } from "./records";
import { cleanLine, visibleLength } from "./safe";
import { RequiredMark, RequiredNote, requiredNote } from "./Required";


const KEYS = { abandoned: "seen-reminders", repurchase: "seen-repurchase" };
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

const copy = {
  en: {
    title: "Automatic reminders",
    newReminder: "New reminder",
    searchPh: "Search for a reminder",
    cols: ["Reminder name", "Cart left for", "Channel", "Discount", "Actions"],
    units: ["hours", "days"],
    channels: ["Email", "SMS"],
    none: "No discount",
    emptyTitle: "No reminders yet",
    emptyHint: "Create a reminder and Dukkan sends it by itself when a customer leaves a cart.",
    noMatch: "No reminders match your search",
    formTitle: "New reminder",
    name: "Reminder name",
    namePh: "For example: First nudge",
    after: "Send after the cart has been left for",
    channel: "Send through",
    discount: "Discount offered (%)",
    discountHint: "Leave at 0 to send the reminder without a discount.",
    create: "Create reminder",
    cancel: "Cancel",
    errName: "Enter a name for the reminder",
    errAmount: "Enter a time above zero",
    errDiscount: "A discount can be 0 to 90",
    on: "Active",
    off: "Paused",
    pause: "Pause",
    resume: "Resume",
    delete: "Delete",
    deleteAsk: "Delete this reminder?",
    deleteYes: "Yes, delete",
  },
  ar: {
    title: "التذكيرات التلقائية",
    newReminder: "تذكير جديد",
    searchPh: "ابحث عن تذكير",
    cols: ["اسم التذكير", "مدة ترك السلة", "قناة الإرسال", "الخصم", "إجراءات"],
    units: ["ساعة", "يوم"],
    channels: ["البريد الإلكتروني", "رسالة نصية"],
    none: "بدون خصم",
    emptyTitle: "لا توجد تذكيرات بعد",
    emptyHint: "أنشئ تذكيرًا وستُرسله دكان تلقائيًا عندما يترك العميل سلته.",
    noMatch: "لا توجد تذكيرات مطابقة لبحثك",
    formTitle: "تذكير جديد",
    name: "اسم التذكير",
    namePh: "مثال: التذكير الأول",
    after: "أرسل بعد ترك السلة لمدة",
    channel: "قناة الإرسال",
    discount: "الخصم المعروض (%)",
    discountHint: "اتركه 0 لإرسال التذكير بدون خصم.",
    create: "إنشاء التذكير",
    cancel: "إلغاء",
    errName: "أدخل اسمًا للتذكير",
    errAmount: "أدخل مدة أكبر من صفر",
    errDiscount: "الخصم من 0 إلى 90",
    on: "مفعّل",
    off: "متوقف",
    pause: "إيقاف",
    resume: "تفعيل",
    delete: "حذف",
    deleteAsk: "هل تريد حذف هذا التذكير؟",
    deleteYes: "نعم، احذف",
  },
};

/* Wording for reminders that bring customers back to buy again. */
const repurchase = {
  en: {
    title: "Repurchase reminders",
    cols: ["Reminder name", "Send after delivery", "Channel", "Discount", "Actions"],
    emptyHint: "Create a reminder and Dukkan sends it by itself to customers some time after their order is delivered.",
    after: "Send after the order was delivered by",
  },
  ar: {
    title: "تذكيرات إعادة الشراء",
    cols: ["اسم التذكير", "الإرسال بعد التسليم", "قناة الإرسال", "الخصم", "إجراءات"],
    emptyHint: "أنشئ تذكيرًا وستُرسله دكان تلقائيًا للعملاء بعد فترة من تسليم طلبهم.",
    after: "أرسل بعد تسليم الطلب بمدة",
  },
};

/* What is saved is checked again when it is read: storage can hold old, broken or hand-changed reminders */
function load(key: string): Reminder[] {
  try {
    return parseList(localStorage.getItem(key), cleanReminder);
  } catch {
    return [];
  }
}

export function Reminders({ kind = "abandoned" }: { kind?: "abandoned" | "repurchase" }) {
  const { lang } = usePrefs();
  const KEY = KEYS[kind];
  const c = kind === "repurchase" ? { ...copy[lang], ...repurchase[lang] } : copy[lang];
  const m = content[lang].marketing;

  const [list, setList] = useState<Reminder[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<0 | 1>(0);
  const [channel, setChannel] = useState<0 | 1>(0);
  const [discount, setDiscount] = useState("0");
  const [errors, setErrors] = useState<{ name?: string; amount?: string; discount?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    setList(load(KEY));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
  }, [list, ready, KEY]);

  useEffect(() => {
    if (!creating) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCreating(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [list, query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const amt = Number(amount);
    const disc = Number(discount || 0);
    if (visibleLength(cleanLine(name, REMINDER_MAX.name)) < 2) next.name = c.errName;
    if (!(amt > 0 && amt <= REMINDER_MAX.amount)) next.amount = c.errAmount;
    if (!(disc >= 0 && disc <= REMINDER_MAX.discount)) next.discount = c.errDiscount;
    setErrors(next);
    if (Object.keys(next).length) return;

    const id = list.reduce((mx, r) => Math.max(mx, r.id), 0) + 1;
    setList((l) => [...l, { id, name: cleanLine(name, REMINDER_MAX.name), amount: Math.floor(amt), unit, channel, discount: Math.floor(disc), active: true }]);
    setName("");
    setAmount("1");
    setUnit(0);
    setChannel(0);
    setDiscount("0");
    setCreating(false);
  };

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="marketing"
        subtabs={kind === "repurchase" ? [c.title] : m.tabs}
        subHrefs={kind === "repurchase" ? undefined : ["/marketing/abandoned-carts", "/marketing/reminders"]}
        activeSub={kind === "repurchase" ? 0 : 1}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <section className={`${card} p-5 sm:p-7`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-extrabold">{c.title}</h1><button type="button" onClick={() => setCreating(true)} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onink transition hover:bg-deep"> + {c.newReminder} </button></div>

          <div className="relative mt-5">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.searchPh} aria-label={c.searchPh} className={`${field} h-12 ps-12`} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[44rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>{c.cols.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {shown.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-soft/40">
                    <td className={td}>
                      <p className="font-semibold">{r.name}</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 text-xs ${r.active ? "text-primary" : "text-muted"}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {r.active ? c.on : c.off}
                      </span>
                    </td>
                    <td className={td}>
                      <span dir="ltr">{r.amount}</span> {c.units[r.unit]}
                    </td>
                    <td className={`${td} text-muted`}>{c.channels[r.channel]}</td>
                    <td className={td}>{r.discount ? <span dir="ltr">{r.discount}%</span> : <span className="text-muted">{c.none}</span>}</td>
                    <td className={td}>
                      {confirm === r.id ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-rose-600">{c.deleteAsk}</span>
                          <button type="button" onClick={() => { setList((l) => l.filter((x) => x.id !== r.id)); setConfirm(null); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">{c.deleteYes}</button>
                          <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-fg/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-soft">{c.cancel}</button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setList((l) => l.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                            {r.active ? c.pause : c.resume}
                          </button>
                          <button type="button" onClick={() => setConfirm(r.id)} className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10">{c.delete}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <div className="px-4 py-14 text-center">
                <p className="font-bold">{list.length === 0 ? c.emptyTitle : c.noMatch}</p>
                {list.length === 0 && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{c.emptyHint}</p>}
                {list.length === 0 && (
                  <button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {c.newReminder}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={c.formTitle} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{c.formTitle}</h2>
            <div className="mt-2"><RequiredNote text={requiredNote[lang]} /></div>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="r-name" className="mb-2 block text-sm font-semibold">{c.name}<RequiredMark /></label>
                <input id="r-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder={c.namePh} maxLength={50} aria-required aria-invalid={!!errors.name} className={`${field} h-11`} />
                {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="r-amount" className="mb-2 block text-sm font-semibold">{c.after}<RequiredMark /></label>
                <div className="flex gap-3">
                  <input id="r-amount" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(latin(e.target.value).replace(/\D/g, ""))} maxLength={3} aria-required aria-invalid={!!errors.amount} className={`${field} h-11 w-28 text-start`} />
                  <select value={unit} onChange={(e) => setUnit(Number(e.target.value) as 0 | 1)} aria-label={c.after} className={`${field} h-11 flex-1`}>
                    {c.units.map((u, i) => <option key={u} value={i}>{u}</option>)}
                  </select>
                </div>
                {errors.amount && <p className="mt-1.5 text-xs text-rose-600">{errors.amount}</p>}
              </div>
              <div>
                <label htmlFor="r-channel" className="mb-2 block text-sm font-semibold">{c.channel}</label>
                <select id="r-channel" value={channel} onChange={(e) => setChannel(Number(e.target.value) as 0 | 1)} className={`${field} h-11`}>
                  {c.channels.map((u, i) => <option key={u} value={i}>{u}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="r-discount" className="mb-2 block text-sm font-semibold">{c.discount}</label>
                <input id="r-discount" dir="ltr" inputMode="numeric" value={discount} onChange={(e) => setDiscount(latin(e.target.value).replace(/\D/g, ""))} maxLength={2} className={`${field} h-11 text-start`} />
                <p className="mt-1.5 text-xs text-muted">{c.discountHint}</p>
                {errors.discount && <p className="mt-1.5 text-xs text-rose-600">{errors.discount}</p>}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{c.create}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
