"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { Blocked, Toggle } from "./designer/controls";
import { MESSAGE_MAX, MESSAGE_TOKENS, fillMessage, loadMessages, saveMessages, type Bi, type CustomerMessages as Messages, type MessageToken } from "./messageTemplates";
import { accountName, loadSetup } from "./setup";
import type { Lang } from "./content";

const words = {
  ar: {
    title: "رسائل العملاء",
    intro: "ما يصل للعميل بعد أن يطلب من متجرك. التغييرات تُحفظ تلقائيًا.",
    editing: "النسخة التي تعدّلها",
    editingHint: "يرى كل عميل النسخة بلغة متجره التي يتصفح بها. إذا تركت نسخة فارغة تظهر النسخة الأخرى.",
    saved: "تم الحفظ",
    insert: "أضف:",
    tokens: { name: "اسم العميل", order: "رقم الطلب", total: "المجموع", store: "اسم المتجر" } as Record<MessageToken, string>,
    example: "مثال بطلب تجريبي",
    whatsapp: "رسالة واتساب لتأكيد الطلب",
    whatsappOn: "زر «أرسل التأكيد عبر واتساب» في الطلبات",
    whatsappHow: "في صفحة الطلبات يظهر لكل طلب زر يفتح واتساب ورسالتك مكتوبة لذلك العميل، وتضغط إرسال.",
    whatsappText: "نص الرسالة",
    screen: "رسالة الشكر بعد إتمام الطلب",
    screenOn: "إظهار رسالة الشكر على شاشة العميل",
    screenHow: "تظهر للعميل في متجرك مباشرة بعد أن يضغط «إتمام الطلب».",
    screenText: "نص الشكر",
    orderPlaced: "شكرًا لك، وصلنا طلبك",
    email: "البريد الإلكتروني لتأكيد الطلب",
    emailWhy: "غير متاح لأن متجرك لم يُربط بخدمة بريد إلكتروني بعد. صمّم الرسالة الآن، وستُرسل عند ربط الخدمة.",
    subject: "عنوان البريد",
    heading: "العنوان الكبير",
    body: "الرسالة",
    items: "إظهار منتجات الطلب ومجموعه",
    closing: "سطر الختام",
    off: "غير متاح لأن هذه الرسالة مُطفأة.",
    sampleItems: [["قميص قطني", "× 2", "30.00"], ["حذاء رياضي", "× 1", "45.00"]],
  },
  en: {
    title: "Customer messages",
    intro: "What a customer gets after ordering from your store. Changes save by themselves.",
    editing: "Version you're editing",
    editingHint: "Each customer sees the version in the language they browse your store in. An empty version shows the other one.",
    saved: "Saved",
    insert: "Add:",
    tokens: { name: "Customer name", order: "Order number", total: "Total", store: "Store name" } as Record<MessageToken, string>,
    example: "Example with a sample order",
    whatsapp: "Order confirmation on WhatsApp",
    whatsappOn: "“Send confirmation on WhatsApp” button in orders",
    whatsappHow: "On the Orders page, each order gets a button that opens WhatsApp with your message written for that customer. You press send.",
    whatsappText: "Message text",
    screen: "Thank-you message after ordering",
    screenOn: "Show the thank-you message on the customer's screen",
    screenHow: "Shows in your store right after the customer presses “Place the order”.",
    screenText: "Thank-you text",
    orderPlaced: "Thank you, your order is in",
    email: "Order confirmation email",
    emailWhy: "Not available because your store isn't connected to an email service yet. Design the message now; it's sent once the service is connected.",
    subject: "Email subject",
    heading: "Big heading",
    body: "Message",
    items: "Show the order's products and total",
    closing: "Closing line",
    off: "Not available because this message is off.",
    sampleItems: [["Cotton shirt", "× 2", "30.00"], ["Running shoes", "× 1", "45.00"]],
  },
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-6";
const field = "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

/** A text with buttons that put a fill-in part where the cursor is */
function MessageField({ lang, editLang, label, value, onChange, max, rows = 4, single = false }: { lang: Lang; editLang: Lang; label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; single?: boolean }) {
  const w = words[lang];
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const insert = (k: MessageToken) => {
    const el = ref.current;
    const word = MESSAGE_TOKENS[k][editLang];
    const at = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, at) + word + value.slice(end)).slice(0, max);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + word.length, at + word.length);
    });
  };
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {single ? (
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} dir={editLang === "ar" ? "rtl" : "ltr"} className={`${field} h-11`} />
      ) : (
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={rows} dir={editLang === "ar" ? "rtl" : "ltr"} className={`${field} resize-y py-3 leading-relaxed`} />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted">{w.insert}</span>
        {(Object.keys(MESSAGE_TOKENS) as MessageToken[]).map((k) => (
          <button key={k} type="button" onClick={() => insert(k)} className="rounded-lg border border-fg/15 px-2.5 py-1 text-xs font-semibold transition hover:border-primary hover:bg-primary/10">
            + {w.tokens[k]}
          </button>
        ))}
        <span className="ms-auto text-[11px] text-muted" dir="ltr">{value.length}/{max}</span>
      </div>
    </div>
  );
}

export function CustomerMessages() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [m, setM] = useState<Messages | null>(null);
  const [editLang, setEditLang] = useState<Lang>(lang);
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => setM(loadMessages()), []);
  useEffect(() => setEditLang(lang), [lang]);

  /* every change is saved at once */
  const change = (fn: (cur: Messages) => Messages) =>
    setM((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      if (saveMessages(next)) setSavedAt(Date.now());
      return next;
    });
  const setBi = (b: Bi, v: string): Bi => ({ ...b, [editLang]: v });

  /* the previews: a sample order, filled in */
  const store = (typeof window !== "undefined" && (loadSetup()?.name?.trim() || accountName())) || (lang === "ar" ? "متجرك" : "Your store");
  const sample = {
    name: editLang === "ar" ? "ليلى" : "Layla",
    order: "1024",
    total: editLang === "ar" ? "75.00 د.أ" : "75.00 JOD",
    store,
  };
  const fill = (t: string) => fillMessage(t, sample);

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="messages" subtabs={[w.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1300px] space-y-5 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{w.title}</h1>
            <p className="mt-1 text-sm text-muted">{w.intro}</p>
          </div>
          <div className="flex items-center gap-3">
            {savedAt > 0 && <span role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{w.saved}</span>}
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">{w.editing}</p>
              <div role="radiogroup" aria-label={w.editing} className="flex rounded-xl border border-fg/15 p-0.5">
                {(["ar", "en"] as const).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={editLang === l} onClick={() => setEditLang(l)} className={`h-9 rounded-lg px-4 text-sm font-semibold transition ${editLang === l ? "bg-ink text-onink" : "hover:bg-soft"}`}>
                    {l === "ar" ? "العربية" : "English"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">{w.editingHint}</p>

        {!m ? null : (
          <>
            {/* WhatsApp: sent from each order with one press */}
            <section className={`${card} grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]`}>
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold">{w.whatsapp}</h2>
                <div>
                  <Toggle on={m.whatsapp.on} onChange={(on) => change((c) => ({ ...c, whatsapp: { ...c.whatsapp, on } }))} label={w.whatsappOn} />
                  <p className="text-xs leading-relaxed text-muted">{w.whatsappHow}</p>
                </div>
                <Blocked when={!m.whatsapp.on} why={w.off}>
                  <MessageField lang={lang} editLang={editLang} label={w.whatsappText} value={m.whatsapp.text[editLang]} onChange={(v) => change((c) => ({ ...c, whatsapp: { ...c.whatsapp, text: setBi(c.whatsapp.text, v) } }))} max={MESSAGE_MAX.whatsapp} rows={6} />
                </Blocked>
              </div>
              {/* the chat, as the customer sees it */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">{w.example}</p>
                <div className="rounded-2xl bg-[#efe7dd] p-4 dark:bg-[#0b141a]" dir={editLang === "ar" ? "rtl" : "ltr"}>
                  <div className="ms-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-xl rounded-se-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                    {fill(m.whatsapp.text[editLang]) || "…"}
                    <span className="mt-1 block text-end text-[10px] opacity-60" dir="ltr">12:30 ✓✓</span>
                  </div>
                </div>
              </div>
            </section>

            {/* the thank-you words on the store's screen, right after ordering */}
            <section className={`${card} grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]`}>
              <div className="space-y-4">
                <h2 className="text-lg font-extrabold">{w.screen}</h2>
                <div>
                  <Toggle on={m.screen.on} onChange={(on) => change((c) => ({ ...c, screen: { ...c.screen, on } }))} label={w.screenOn} />
                  <p className="text-xs leading-relaxed text-muted">{w.screenHow}</p>
                </div>
                <Blocked when={!m.screen.on} why={w.off}>
                  <MessageField lang={lang} editLang={editLang} label={w.screenText} value={m.screen.text[editLang]} onChange={(v) => change((c) => ({ ...c, screen: { ...c.screen, text: setBi(c.screen.text, v) } }))} max={MESSAGE_MAX.screen} rows={3} />
                </Blocked>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">{w.example}</p>
                <div className="grid place-items-center rounded-2xl bg-white px-5 py-8 text-center text-[#1c1a17] ring-1 ring-black/10" dir={editLang === "ar" ? "rtl" : "ltr"}>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                  <p className="mt-3 text-base font-extrabold">{editLang === "ar" ? words.ar.orderPlaced : words.en.orderPlaced}</p>
                  {m.screen.on && <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-black/70">{fill(m.screen.text[editLang])}</p>}
                </div>
              </div>
            </section>

            {/* the email: designed now, sent once an email service is connected */}
            <section className={card}>
              <h2 className="mb-4 text-lg font-extrabold">{w.email}</h2>
              <Blocked when why={w.emailWhy}>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-4">
                    <MessageField lang={lang} editLang={editLang} label={w.subject} value={m.email.subject[editLang]} onChange={(v) => change((c) => ({ ...c, email: { ...c.email, subject: setBi(c.email.subject, v) } }))} max={MESSAGE_MAX.subject} single />
                    <MessageField lang={lang} editLang={editLang} label={w.heading} value={m.email.heading[editLang]} onChange={(v) => change((c) => ({ ...c, email: { ...c.email, heading: setBi(c.email.heading, v) } }))} max={MESSAGE_MAX.heading} single />
                    <MessageField lang={lang} editLang={editLang} label={w.body} value={m.email.body[editLang]} onChange={(v) => change((c) => ({ ...c, email: { ...c.email, body: setBi(c.email.body, v) } }))} max={MESSAGE_MAX.body} />
                    <Toggle on={m.email.items} onChange={(items) => change((c) => ({ ...c, email: { ...c.email, items } }))} label={w.items} />
                    <MessageField lang={lang} editLang={editLang} label={w.closing} value={m.email.closing[editLang]} onChange={(v) => change((c) => ({ ...c, email: { ...c.email, closing: setBi(c.email.closing, v) } }))} max={MESSAGE_MAX.closing} single />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted">{w.example}</p>
                    <div className="overflow-hidden rounded-2xl bg-white text-[#1c1a17] ring-1 ring-black/10" dir={editLang === "ar" ? "rtl" : "ltr"}>
                      <p className="border-b border-black/10 px-4 py-2.5 text-xs"><b>{fill(m.email.subject[editLang])}</b></p>
                      <div className="space-y-3 px-5 py-5 text-sm leading-relaxed">
                        <p className="text-lg font-extrabold">{fill(m.email.heading[editLang])}</p>
                        <p className="whitespace-pre-wrap text-black/75">{fill(m.email.body[editLang])}</p>
                        {m.email.items && (
                          <div className="rounded-xl bg-black/[0.04] p-3 text-xs">
                            {(editLang === "ar" ? words.ar : words.en).sampleItems.map(([n, q, p]) => (
                              <p key={n} className="flex justify-between gap-2 py-0.5"><span>{n} <span className="opacity-60">{q}</span></span><span dir="ltr">{p}</span></p>
                            ))}
                            <p className="mt-1 flex justify-between border-t border-black/10 pt-1.5 font-bold"><span>{editLang === "ar" ? "المجموع" : "Total"}</span><span dir="ltr">{sample.total}</span></p>
                          </div>
                        )}
                        <p className="text-black/70">{fill(m.email.closing[editLang])}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Blocked>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
