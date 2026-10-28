"use client";

import { useEffect, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";

/* Which events reach him, and how: by WhatsApp, by email, or both (each one has its own switch) */
const KEY = "seen-notif-prefs";
type Channel = "whatsapp" | "email";
const channels: Channel[] = ["whatsapp", "email"];

const rows = {
  en: ["New orders", "Store rating", "Product rating", "Shipping company rating", "A question from a customer", "A product is almost out of stock", "Products have run out"],
  ar: ["طلبات جديدة", "تقييم المتجر", "تقييم المنتجات", "تقييم شركة الشحن", "إرسال سؤال من عميل", "تنبيه قرب انتهاء كمية منتج", "نبهني عند نفاد كمية المنتجات"],
};

const copy = {
  en: { title: "Customize notifications", tab: "Customize notifications", type: "Notification type", whatsapp: "WhatsApp", email: "Email", saved: "Saved on this device", hint: "Choose which events reach you, by WhatsApp, by email, or both." },
  ar: { title: "تخصيص الإشعارات", tab: "تخصيص الإشعارات", type: "نوع الإشعار", whatsapp: "واتساب", email: "البريد الإلكتروني", saved: "تم الحفظ على هذا الجهاز", hint: "اختر الأحداث التي تصلك، عبر واتساب أو البريد الإلكتروني أو الاثنين." },
};

type Prefs = Record<Channel, boolean[]>;

function load(n: number): Prefs {
  const all = () => Array(n).fill(true) as boolean[];
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    /* saved before WhatsApp was added: one list, for email */
    /* each switch is on or off: anything else written into the storage counts as off */
    const bools = (l: unknown[]) => l.map((x) => x === true);
    if (Array.isArray(v) && v.length === n) return { whatsapp: all(), email: bools(v) };
    const o = v as Partial<Record<Channel, unknown>> | null;
    if (o && Array.isArray(o.whatsapp) && o.whatsapp.length === n && Array.isArray(o.email) && o.email.length === n) return { whatsapp: bools(o.whatsapp), email: bools(o.email) };
  } catch {
    /* use defaults */
  }
  return { whatsapp: all(), email: all() };
}

export function NotificationPrefs() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const labels = rows[lang];

  const [on, setOn] = useState<Prefs>(() => ({ whatsapp: Array(labels.length).fill(true), email: Array(labels.length).fill(true) }));
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    setOn(load(labels.length));
    setReady(true);
  }, [labels.length]);

  const toggle = (ch: Channel, i: number) => {
    const next = { ...on, [ch]: on[ch].map((v, j) => (j === i ? !v : v)) };
    setOn(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="settings" subtabs={[c.tab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-fg/10">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4l2-2ZM10 21a2 2 0 0 0 4 0" />
              </svg>
              <div>
                <h1 className="text-xl font-extrabold">{c.title}</h1>
                <p className="mt-0.5 text-xs text-muted">{c.hint}</p>
              </div>
            </div>
            {flash && <p role="status" className="text-sm font-semibold text-primary">{c.saved}</p>}
          </div>

          <div className="flex bg-soft/70 px-5 py-3 text-xs font-bold text-muted sm:px-7">
            <span className="flex-1">{c.type}</span>
            {channels.map((ch) => (
              <span key={ch} className="w-20 text-center sm:w-28">{c[ch]}</span>
            ))}
          </div>

          <ul className="divide-y divide-fg/10">
            {labels.map((label, i) => (
              <li key={label}>
                <div className="flex items-center px-5 py-4 text-sm sm:px-7">
                  <span className="flex-1 font-medium">{label}</span>
                  {channels.map((ch) => (
                    <label key={ch} className="grid w-20 cursor-pointer place-items-center sm:w-28">
                      <input type="checkbox" role="switch" checked={ready && on[ch][i]} onChange={() => toggle(ch, i)} className="peer sr-only" aria-label={`${label}: ${c[ch]}`} />
                      <span aria-hidden dir="ltr" className="relative h-6 w-11 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
                        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                      </span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
