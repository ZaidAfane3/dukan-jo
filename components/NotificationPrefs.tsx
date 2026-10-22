"use client";

import { useEffect, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";

/* Which events send him an email. There is no app, so email is the only channel. */
const KEY = "seen-notif-prefs";

const rows = {
  en: ["New orders", "Store rating", "Product rating", "Shipping company rating", "A question from a customer", "A product is almost out of stock", "Products have run out"],
  ar: ["طلبات جديدة", "تقييم المتجر", "تقييم المنتجات", "تقييم شركة الشحن", "إرسال سؤال من عميل", "تنبيه قرب انتهاء كمية منتج", "نبهني عند نفاد كمية المنتجات"],
};

const copy = {
  en: { title: "Notifications", tab: "Notifications", type: "Notification type", email: "Email", saved: "Saved on this device", hint: "Choose which events send you an email." },
  ar: { title: "الإشعارات", tab: "الإشعارات", type: "نوع الإشعار", email: "البريد الإلكتروني", saved: "تم الحفظ على هذا الجهاز", hint: "اختر الأحداث التي تصلك عنها رسالة بريد إلكتروني." },
};

function load(n: number): boolean[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as boolean[]) : null;
    if (Array.isArray(v) && v.length === n) return v;
  } catch {
    /* use defaults */
  }
  return Array(n).fill(true);
}

export function NotificationPrefs() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const labels = rows[lang];

  const [on, setOn] = useState<boolean[]>(() => Array(labels.length).fill(true));
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    setOn(load(labels.length));
    setReady(true);
  }, [labels.length]);

  const toggle = (i: number) => {
    const next = on.map((v, j) => (j === i ? !v : v));
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
            <span className="w-24 text-center">{c.email}</span>
          </div>

          <ul className="divide-y divide-fg/10">
            {labels.map((label, i) => (
              <li key={label}>
                <label className="flex cursor-pointer items-center px-5 py-4 text-sm sm:px-7">
                  <span className="flex-1 font-medium">{label}</span>
                  <span className="grid w-24 place-items-center">
                    <input type="checkbox" role="switch" checked={ready && on[i]} onChange={() => toggle(i)} className="peer sr-only" aria-label={`${label}: ${c.email}`} />
                    <span aria-hidden dir="ltr" className="relative h-6 w-11 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
                      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
