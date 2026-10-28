"use client";

import { useEffect, useState } from "react";
import { brandName, content } from "./content";
import { DashboardBar } from "./DashboardBar";
import { money, typedMoney } from "./records";
import { loadFreeDelivery, saveFreeDelivery } from "./freeDeliveryStore";
import { usePrefs } from "./Prefs";
import { RequiredMark } from "./Required";

const copy = {
  en: {
    title: "Free delivery",
    sub: "Give customers free delivery automatically when their order reaches an amount you choose. It encourages bigger baskets.",
    on: "Turn on free delivery",
    min: "Free delivery for orders above",
    cur: "JOD",
    hint: "Orders below this amount pay the normal delivery price.",
    preview: (n: string) => `Customers will see: "Free delivery on orders above ${n} JOD", and a reminder of how much is left to add.`,
    off: "It is off. Customers always pay the normal delivery price.",
    save: "Save",
    saved: "Saved",
    err: "Enter an amount above zero.",
    shipNote: "If you deliver with Dukkan Ship, the delivery fee of each free-delivery order is paid by you: it is deducted from the order amount that is paid out to you. The customer pays nothing for delivery.",
  },
  ar: {
    title: "التوصيل المجاني",
    sub: "امنح عملاءك توصيلًا مجانيًا تلقائيًا عندما يبلغ طلبهم مبلغًا تحدّده. وهذا يشجّعهم على شراء المزيد.",
    on: "تفعيل التوصيل المجاني",
    min: "توصيل مجاني للطلبات التي تزيد عن",
    cur: "د.أ",
    hint: "الطلبات الأقل من هذا المبلغ تدفع سعر التوصيل المعتاد.",
    preview: (n: string) => `سيرى العملاء: «توصيل مجاني للطلبات فوق ${n} د.أ»، مع تذكير بالمبلغ المتبقي للوصول إليه.`,
    off: "الخيار متوقف. يدفع العملاء دائمًا سعر التوصيل المعتاد.",
    save: "حفظ",
    saved: "تم الحفظ",
    err: "أدخل مبلغًا أكبر من صفر.",
    shipNote: "إذا كنت توصّل عبر شحن دكان، فإن رسوم التوصيل لكل طلب مشمول بالتوصيل المجاني يتحمّلها المتجر: تُخصم من مبلغ الطلب المستحق لك، ولا يدفع العميل أي رسوم توصيل.",
  },
};

const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

export function FreeDelivery() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const [on, setOn] = useState(false);
  const [min, setMin] = useState("25");
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    const v = loadFreeDelivery();
    setOn(v.on);
    setMin(String(v.min));
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    /* The amount is needed only while the offer is on; switched off, the last good amount is kept */
    const n = money(min);
    const good = n !== null && n > 0;
    if (on && !good) return setError(true);
    setError(false);
    if (saveFreeDelivery({ on, min: good ? n : loadFreeDelivery().min })) {
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
    }
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="marketing" subtabs={[c.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <form onSubmit={save} noValidate className={`${card} max-w-2xl p-5 sm:p-7`}>
          <h1 className="text-lg font-extrabold">{c.title}</h1>
          <p className="mt-1 text-sm text-muted">{c.sub}</p>

          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm font-semibold">{c.on}</span>
            <input type="checkbox" role="switch" checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
            <span aria-hidden dir="ltr" className="relative h-6 w-11 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
            </span>
          </label>

          <div className={`mt-5 transition-opacity ${on ? "" : "pointer-events-none opacity-40"}`}>
            <label htmlFor="fd-min" className="mb-2 block text-sm font-semibold">{c.min} ({c.cur}){on && <RequiredMark />}</label>
            <input id="fd-min" dir="ltr" inputMode="decimal" value={min} onChange={(e) => { setMin(typedMoney(e.target.value, 3)); setError(false); }} maxLength={8} disabled={!on} className={`${field} h-11 max-w-[12rem] text-start`} />
            {error ? <p className="mt-1.5 text-xs text-rose-600">{c.err}</p> : <p className="mt-1.5 text-xs text-muted">{c.hint}</p>}
          </div>

          <p className="mt-5 rounded-xl bg-primary/10 px-4 py-3 text-sm text-deep dark:text-primary">{on && Number(min) > 0 ? c.preview(min) : c.off}</p>

          <p className="mt-3 rounded-xl border border-fg/10 px-4 py-3 text-xs leading-relaxed text-muted">{c.shipNote}</p>

          <div className="mt-6 flex items-center gap-3">
            <button type="submit" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{c.save}</button>
            <span aria-live="polite" className="text-sm font-semibold text-primary">{flash ? c.saved : ""}</span>
          </div>
        </form>
      </main>
    </div>
  );
}
