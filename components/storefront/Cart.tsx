"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import type { FreeDelivery } from "../freeDeliveryStore";
import { pushNotification } from "../notifications";
import { jordanMobile, phoneError } from "../phone";
import { CITIES, checkCheckout, isUnlimited, ORDER_LIMITS, priceCart, sellableStock, stock, toFils, type CheckoutField, type Fulfil, type PricedLine, type Sellable } from "../safeOrder";
import { currency, icons, moneyIn, priceOf, ProductImage } from "./parts";
import type { StoreProduct } from "./useStoreData";

/* The customer's basket: a panel that slides in from the side with what is in it, the free delivery progress and a few
   suggestions, then the checkout (who, where, how to pay) in the same panel, and a thank-you. The order is saved with
   the merchant's orders, so it shows in his dashboard. Prototype: no payment is taken. */

/* A flat delivery price until the merchant can set his own (orders reaching the free delivery amount pay nothing) */
export const DELIVERY_FEE = 3;

const cities = CITIES;

const words = {
  en: {
    title: "Your cart",
    close: "Close",
    empty: "Your cart is empty",
    emptyHint: "Add products and they show here.",
    keepShopping: "Keep shopping",
    remove: "Remove",
    less: "One less",
    more: "One more",
    subtotal: "Subtotal",
    delivery: "Delivery",
    free: "Free",
    total: "Total",
    checkout: "Checkout",
    suggest: "You may also like",
    add: "Add",
    leftForFree: "Add {n} more for free delivery",
    gotFree: "Your order gets free delivery",
    back: "Back to the cart",
    details: "Your details",
    name: "Full name",
    phone: "Mobile number",
    city: "City",
    address: "Area, street and building",
    note: "Note for the store (optional)",
    fulfil: "How do you want your order?",
    fulfilDelivery: "Delivery",
    fulfilPickup: "I'll pick it up",
    pickupNote: "The store will send you where and when to collect it.",
    pay: "Payment",
    payCliq: "CliQ",
    payCash: "Cash on delivery",
    payCard: "Card",
    cardNote: "Prototype: no card details are asked and nothing is charged.",
    place: "Place the order",
    errName: "Enter your name.",
    errCity: "Choose your city.",
    errAddress: "Write where to deliver.",
    required: "Fields with * must be filled",
    changed: "Some products in your cart changed (stock or price). Check your cart, then place the order.",
    doneTitle: "Thank you, your order is in",
    doneText: "Order #{id}. The store will contact you on {phone} to confirm it.",
    done: "Back to the store",
  },
  ar: {
    title: "سلتك",
    close: "إغلاق",
    empty: "سلتك فارغة",
    emptyHint: "أضف منتجات لتظهر هنا.",
    keepShopping: "تابع التسوق",
    remove: "إزالة",
    less: "قطعة أقل",
    more: "قطعة أكثر",
    subtotal: "المجموع",
    delivery: "التوصيل",
    free: "مجاني",
    total: "الإجمالي",
    checkout: "إتمام الطلب",
    suggest: "قد يعجبك أيضًا",
    add: "أضف",
    leftForFree: "باقي {n} للتوصيل المجاني",
    gotFree: "طلبك يحصل على توصيل مجاني",
    back: "العودة إلى السلة",
    details: "معلوماتك",
    name: "الاسم الكامل",
    phone: "رقم الموبايل",
    city: "المدينة",
    address: "المنطقة والشارع والبناية",
    note: "ملاحظة للمتجر (اختياري)",
    fulfil: "كيف تريد استلام طلبك؟",
    fulfilDelivery: "توصيل",
    fulfilPickup: "سأستلمه بنفسي",
    pickupNote: "سيرسل لك المتجر مكان ووقت الاستلام.",
    pay: "طريقة الدفع",
    payCliq: "كليك CliQ",
    payCash: "الدفع عند الاستلام",
    payCard: "بطاقة",
    cardNote: "نسخة تجريبية: لا تُطلب بيانات البطاقة ولا يُخصم أي مبلغ.",
    place: "تأكيد الطلب",
    errName: "اكتب اسمك.",
    errCity: "اختر مدينتك.",
    errAddress: "اكتب عنوان التوصيل.",
    required: "الحقول التي عليها * مطلوبة",
    changed: "تغيّرت بعض المنتجات في سلتك (الكمية المتوفرة أو السعر). راجع سلتك ثم أكّد الطلب.",
    doneTitle: "شكرًا لك، وصلنا طلبك",
    doneText: "طلب رقم {id}. سيتواصل معك المتجر على {phone} لتأكيده.",
    done: "العودة إلى المتجر",
  },
};

/** Products to suggest: the same category as the ones given first, then featured ones, then the rest. Never ones already chosen. */
export function suggestFor(all: StoreProduct[], base: StoreProduct[], n: number): StoreProduct[] {
  const taken = new Set(base.map((p) => p.id));
  const cats = new Set(base.map((p) => p.category).filter(Boolean));
  const left = all.filter((p) => !taken.has(p.id) && p.quantity > 0);
  const rank = (p: StoreProduct) => (cats.has(p.category) ? 0 : p.featured ? 1 : 2);
  return [...left].sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

type Line = { p: StoreProduct; qty: number };
type Pay = "cliq" | "cash" | "card";

function readList(key: string): Record<string, unknown>[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
  } catch {
    return [];
  }
}

/** The catalog as it is right now: the stock and prices the merchant saved (maybe changed in another tab since the
    page opened) win over the ones on screen. Sample products are not saved, so they keep theirs. */
function currentCatalog(products: StoreProduct[]): Sellable[] {
  const saved = new Map(readList("seen-products").filter((p) => !p.deletedAt && !p.hidden).map((p) => [Number(p.id), p]));
  return products.map((p) => {
    const s = saved.get(p.id);
    return s ? { ...p, price: typeof s.price === "number" ? s.price : null, sale: typeof s.sale === "number" ? s.sale : null, quantity: sellableStock(s) } : p;
  });
}

/* The order saved for the merchant: the same shape as the orders of the dashboard (components/Orders.tsx) */
function saveOrder(o: { customer: string; phone: string; total: number; items: (PricedLine & { image?: string })[]; fulfil: Fulfil; city: string; address: string; note: string; pay: Pay }): number | null {
  try {
    const list = readList("seen-orders");
    const id = list.reduce((m, x) => (typeof x.id === "number" && Number.isSafeInteger(x.id) && x.id < 1e9 ? Math.max(m, x.id) : m), 1000) + 1;
    localStorage.setItem("seen-orders", JSON.stringify([{ id, ...o, status: "pending", channel: 1, created: Date.now() }, ...list]));
    /* what was bought leaves the stock (a stock with no limit stays as it is) */
    if (localStorage.getItem("seen-products")) {
      localStorage.setItem("seen-products", JSON.stringify(readList("seen-products").map((p) => {
        const line = o.items.find((x) => x.id === Number(p.id));
        return line && !isUnlimited(p) ? { ...p, quantity: Math.max(0, stock(p.quantity) - line.qty) } : p;
      })));
    }
    return id;
  } catch {
    return null;
  }
}

/* `pickup`: the merchant lets customers collect the order, so checkout offers it and then asks no city or address */
export function CartPanel({ open, onClose, lang, lines, products, setQty, fd, priceLanguage, onCleared, pickup = false }: { open: boolean; onClose: () => void; lang: Lang; lines: Line[]; products: StoreProduct[]; setQty: (p: StoreProduct, n: number) => void; fd: FreeDelivery; priceLanguage: Lang; onCleared: () => void; pickup?: boolean }) {
  const w = words[lang];
  const [step, setStep] = useState<"cart" | "details" | "done">("cart");
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", note: "" });
  const [pay, setPay] = useState<Pay>("cliq");
  const [fulfilRaw, setFulfil] = useState<Fulfil>("delivery");
  /* if the store stops offering pickup, the order is delivered */
  const fulfil: Fulfil = pickup ? fulfilRaw : "delivery";
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "city" | "address", string>>>({});
  const [doneId, setDoneId] = useState(0);
  /* the cart had to change at checkout (stock ran out or a price changed): he sees it before ordering */
  const [changed, setChanged] = useState(false);
  /* one order per press, even when the button is pressed again before the page updates */
  const placing = useRef(false);
  const panel = useRef<HTMLDivElement>(null);

  /* Escape closes it, and it opens on the basket again */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => {
    if (!open && step === "done") setStep("cart");
  }, [open, step]);

  const amount = (n: number) => `${moneyIn(n, priceLanguage)} ${currency(priceLanguage)}`;
  const subtotal = lines.reduce((s, l) => s + l.qty * priceOf(l.p), 0);
  const freeNow = fd.on && subtotal >= fd.min;
  const delivery = lines.length === 0 || freeNow || fulfil === "pickup" ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;
  const suggestions = suggestFor(products, lines.map((l) => l.p), 3);
  const field = (bad?: string) => `h-11 w-full rounded-[var(--sf-ri,10px)] border bg-transparent px-3 text-sm outline-none transition focus:ring-2 focus:ring-sf-primary/30 ${bad ? "border-rose-500" : "border-sf-text/20 focus:border-[var(--sf-primary)]"}`;
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof typeof errors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const place = () => {
    if (placing.current) return;
    const checked = checkCheckout({ ...form, pay, fulfil }, { pickup });
    const bad = new Set<CheckoutField>(checked.ok ? [] : checked.errors);
    const next: typeof errors = {};
    if (bad.has("name")) next.name = w.errName;
    if (bad.has("phone")) next.phone = phoneError[lang];
    if (bad.has("city")) next.city = w.errCity;
    if (bad.has("address")) next.address = w.errAddress;
    setErrors(next);
    const first = (["name", "phone", "city", "address"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    if (!checked.ok) return;
    /* The prices, the stock and the total come from the catalog, never from what is on screen */
    const priced = priceCart(lines.map((l) => ({ id: l.p.id, qty: l.qty })), currentCatalog(products));
    if (priced.changed || priced.items.length === 0) {
      const fresh = new Map(priced.items.map((it) => [it.id, it.qty]));
      lines.forEach((l) => setQty(l.p, fresh.get(l.p.id) ?? 0));
      setChanged(true);
      setStep("cart");
      return;
    }
    const sum = toFils(priced.subtotal + ((fd.on && priced.subtotal >= fd.min) || checked.value.fulfil === "pickup" ? 0 : DELIVERY_FEE));
    placing.current = true;
    const id = saveOrder({
      ...checked.value,
      total: sum,
      items: priced.items.map((it) => ({ ...it, image: lines.find((l) => l.p.id === it.id)?.p.image })),
    });
    if (id === null) {
      placing.current = false;
      return;
    }
    pushNotification("orderCreated", { id: String(id), name: checked.value.customer, total: amount(sum) });
    setDoneId(id);
    setStep("done");
    setChanged(false);
    onCleared();
  };
  useEffect(() => {
    if (step !== "done") placing.current = false;
  }, [step]);

  const freeLine = fd.on && lines.length > 0 && (
    <div className="space-y-2 rounded-[var(--sf-ri,10px)] bg-sf-primary/10 px-3 py-2.5 text-xs font-semibold">
      <p>{freeNow ? w.gotFree : w.leftForFree.replace("{n}", amount(fd.min - subtotal))}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-sf-text/10">
        <div className="h-full rounded-full bg-[var(--sf-primary)] transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / fd.min) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* the page dims behind the panel; a click on it closes the panel */}
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={w.title}
        tabIndex={-1}
        className={`absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-[var(--sf-bg)] text-[var(--sf-text)] shadow-2xl outline-none transition-transform duration-300 ease-out ${open ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sf-text/10 px-5 py-4">
          {step === "details" ? (
            <button type="button" onClick={() => setStep("cart")} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-accent)] hover:underline">
              <span className="rotate-180">{icons.arrow}</span>
              {w.back}
            </button>
          ) : (
            <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--sf-heading)" }}>
              {w.title} {step === "cart" && lines.length > 0 && <span className="text-sm font-semibold opacity-60">({lines.reduce((s, l) => s + l.qty, 0)})</span>}
            </h2>
          )}
          <button type="button" onClick={onClose} aria-label={w.close} className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-sf-text/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "done" ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4 10-10" /></svg>
                </span>
                <h3 className="mt-4 text-xl font-extrabold" style={{ fontFamily: "var(--sf-heading)" }}>{w.doneTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-75">{w.doneText.replace("{id}", String(doneId)).replace("{phone}", `0${jordanMobile(form.phone)}`)}</p>
                <button type="button" onClick={onClose} className="mt-6 h-11 rounded-[var(--sf-pill,999px)] px-8 text-sm font-bold" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>{w.done}</button>
              </div>
            </div>
          ) : step === "details" ? (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-extrabold">{w.details}</h3>
                <p className="text-[11px] opacity-60">{w.required.split("*")[0]}<span className="text-rose-600">*</span>{w.required.split("*")[1]}</p>
              </div>
              {(["name", "phone"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`co-${k}`} className="mb-1.5 block text-sm font-semibold">{w[k]} <span className="text-rose-600">*</span></label>
                  <input id={`co-${k}`} value={form[k]} maxLength={k === "phone" ? 20 : ORDER_LIMITS.name} onChange={(e) => set(k, e.target.value)} dir={k === "phone" ? "ltr" : undefined} inputMode={k === "phone" ? "tel" : undefined} placeholder={k === "phone" ? "07X XXX XXXX" : undefined} aria-invalid={!!errors[k]} className={`${field(errors[k])} ${k === "phone" ? "text-start" : ""}`} />
                  {errors[k] && <p className="mt-1 text-xs text-rose-600">{errors[k]}</p>}
                </div>
              ))}
              {pickup && (
                <div role="radiogroup" aria-label={w.fulfil}>
                  <p className="mb-1.5 text-sm font-semibold">{w.fulfil}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["delivery", "pickup"] as const).map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={fulfil === k} onClick={() => { setFulfil(k); setErrors((e) => ({ ...e, city: undefined, address: undefined })); }} className={`min-h-11 rounded-[var(--sf-ri,10px)] border px-2 py-2 text-xs font-bold transition ${fulfil === k ? "border-[var(--sf-primary)] bg-sf-primary/10" : "border-sf-text/20 hover:bg-sf-text/5"}`}>
                        {k === "delivery" ? w.fulfilDelivery : w.fulfilPickup}
                      </button>
                    ))}
                  </div>
                  {fulfil === "pickup" && <p className="mt-2 text-xs opacity-70">{w.pickupNote}</p>}
                </div>
              )}
              {fulfil === "delivery" && <>
              <div>
                <label htmlFor="co-city" className="mb-1.5 block text-sm font-semibold">{w.city} <span className="text-rose-600">*</span></label>
                <select id="co-city" value={form.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} className={field(errors.city)}>
                  <option value="">—</option>
                  {cities[lang].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                {errors.city && <p className="mt-1 text-xs text-rose-600">{errors.city}</p>}
              </div>
              <div>
                <label htmlFor="co-address" className="mb-1.5 block text-sm font-semibold">{w.address} <span className="text-rose-600">*</span></label>
                <input id="co-address" value={form.address} maxLength={ORDER_LIMITS.address} onChange={(e) => set("address", e.target.value)} aria-invalid={!!errors.address} className={field(errors.address)} />
                {errors.address && <p className="mt-1 text-xs text-rose-600">{errors.address}</p>}
              </div>
              </>}
              <div>
                <label htmlFor="co-note" className="mb-1.5 block text-sm font-semibold">{w.note}</label>
                <textarea id="co-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={ORDER_LIMITS.note} className={`${field()} h-auto resize-none py-2`} />
              </div>
              <div role="radiogroup" aria-label={w.pay}>
                <p className="mb-1.5 text-sm font-semibold">{w.pay}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["cliq", "cash", "card"] as const).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={pay === k} onClick={() => setPay(k)} className={`min-h-11 rounded-[var(--sf-ri,10px)] border px-2 py-2 text-xs font-bold transition ${pay === k ? "border-[var(--sf-primary)] bg-sf-primary/10" : "border-sf-text/20 hover:bg-sf-text/5"}`}>
                      {k === "cliq" ? w.payCliq : k === "cash" ? w.payCash : w.payCard}
                    </button>
                  ))}
                </div>
                {pay === "card" && <p className="mt-2 text-xs opacity-70">{w.cardNote}</p>}
              </div>
            </div>
          ) : lines.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sf-primary/10 text-[var(--sf-primary)] [&>svg]:h-7 [&>svg]:w-7">{icons.bag}</span>
                <p className="mt-4 font-extrabold">{w.empty}</p>
                <p className="mt-1 text-sm opacity-70">{w.emptyHint}</p>
                <button type="button" onClick={onClose} className="mt-5 h-11 rounded-[var(--sf-pill,999px)] px-7 text-sm font-bold" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>{w.keepShopping}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {changed && <p role="alert" className="rounded-[var(--sf-ri,10px)] bg-amber-500/15 px-3 py-2.5 text-xs font-semibold">{w.changed}</p>}
              {freeLine}
              <ul className="divide-y divide-sf-text/10">
                {lines.map(({ p, qty }) => (
                  <li key={p.id} className="flex gap-3 py-3">
                    <ProductImage p={p} className="h-20 w-16 shrink-0 rounded-[var(--sf-ri,10px)]" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
                      <p className="mt-0.5 text-xs opacity-70" dir="auto">{amount(priceOf(p))}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div dir="ltr" className="inline-flex items-center rounded-full border border-sf-text/20">
                          <button type="button" onClick={() => setQty(p, qty - 1)} aria-label={w.less} className="grid h-8 w-8 place-items-center text-base font-bold">−</button>
                          <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                          <button type="button" onClick={() => setQty(p, qty + 1)} disabled={qty >= Math.min(p.quantity, ORDER_LIMITS.qty)} aria-label={w.more} className="grid h-8 w-8 place-items-center text-base font-bold disabled:opacity-30">+</button>
                        </div>
                        <button type="button" onClick={() => setQty(p, 0)} className="text-xs font-semibold text-rose-600 hover:underline">{w.remove}</button>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold" dir="auto">{amount(qty * priceOf(p))}</p>
                  </li>
                ))}
              </ul>
              {suggestions.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-extrabold">{w.suggest}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {suggestions.map((p) => (
                      <div key={p.id} className="flex flex-col rounded-[var(--sf-ri,10px)] border border-sf-text/10 p-2">
                        <ProductImage p={p} className="aspect-square w-full rounded-[var(--sf-ri,8px)]" />
                        <p className="mt-1.5 line-clamp-1 text-xs font-bold">{p.name}</p>
                        <p className="text-[11px] opacity-70" dir="auto">{amount(priceOf(p))}</p>
                        <button type="button" onClick={() => setQty(p, 1)} className="mt-1.5 h-8 rounded-full text-xs font-bold" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>+ {w.add}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* the sums and the next step stay at the bottom */}
        {step !== "done" && lines.length > 0 && (
          <div className="space-y-2 border-t border-sf-text/10 px-5 py-4 text-sm">
            <p className="flex justify-between"><span className="opacity-70">{w.subtotal}</span><span dir="auto">{amount(subtotal)}</span></p>
            <p className="flex justify-between"><span className="opacity-70">{w.delivery}</span><span dir="auto">{delivery === 0 ? w.free : amount(delivery)}</span></p>
            <p className="flex justify-between text-base font-extrabold"><span>{w.total}</span><span dir="auto">{amount(total)}</span></p>
            <button type="button" onClick={() => (step === "cart" ? setStep("details") : place())} className="mt-2 h-12 w-full rounded-[var(--sf-pill,999px)] text-sm font-extrabold transition hover:opacity-90" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>
              {step === "cart" ? w.checkout : `${w.place} · ${amount(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
