"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Lang } from "../content";
import type { FreeDelivery } from "../freeDeliveryStore";
import { pushNotification } from "../notifications";
import { payNote, shipCityLists, storePayKey, storePays, usePublicSettings } from "../platformPublic";
import { jordanMobile } from "../phone";
import { checkCheckout, isUnlimited, ORDER_LIMITS, priceCart, productSizes, sellableStock, stock, toFils, type CheckoutField, type Fulfil, type PricedLine, type Sellable } from "../safeOrder";
import { checkCoupon, cleanCoupon, parseList, type Coupon, type CouponRefusal } from "../records";
import type { CartStyle } from "./config";
import { currency, icons, moneyIn, priceOf, ProductImage } from "./parts";
import { categoriesOf, type StoreProduct } from "./useStoreData";

/* The customer's basket: what is in it, the free delivery progress and a few suggestions, then the checkout (who, where,
   how to pay) in the same place, and a thank-you. It has four looks a design picks (`look`, see the skins at the end). The order is saved with
   the merchant's orders, so it shows in his dashboard. Prototype: no payment is taken. */


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
    phone: "Email or phone number",
    contactHint: "Your receipt will be sent here.",
    errContact: "Enter a Jordan mobile number (07X XXX XXXX) or an email address.",
    city: "City",
    address: "Area, street and building",
    note: "Note for the store (Optional)",
    fulfil: "How do you want your order?",
    fulfilDelivery: "Delivery",
    fulfilPickup: "I'll pick it up",
    pickupNote: "The store will send you where and when to collect it.",
    pay: "Payment",
    payCliq: "CliQ",
    payCash: "Cash on delivery",
    payCard: "Card",
    cardNote: "Prototype: no card details are asked and nothing is charged.",
    noPay: "This store can't take orders right now: no way to pay is open. Please try again later.",
    place: "Place the order",
    errName: "Enter your name.",
    errCity: "Choose your city.",
    errAddress: "Write where to deliver.",
    required: "Fields with * must be filled",
    changed: "Some products in your cart changed (stock or price). Check your cart, then place the order.",
    doneTitle: "Thank you, your order is in",
    doneText: "Order #{id}. Your receipt is sent to {phone}, and the store will contact you to confirm it.",
    done: "Back to the store",
    summary: "Order summary",
    stepCart: "Cart",
    stepDetails: "Details",
    coupon: "Coupon code",
    apply: "Apply",
    couponOn: "{code} applied",
    discount: "Discount",
    refused: {
      unknown: "This code doesn't exist. Check it and try again.",
      off: "This code is paused by the store.",
      soon: "This code isn't active yet.",
      ended: "This code has ended.",
      usedUp: "This code has been used up.",
      min: "Your order is under this code's minimum amount.",
    },
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
    phone: "البريد الإلكتروني أو رقم الهاتف",
    contactHint: "سنرسل إيصال طلبك إلى هنا.",
    errContact: "اكتب رقم موبايل أردني (07X XXX XXXX) أو بريدًا إلكترونيًا.",
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
    noPay: "لا يستقبل هذا المتجر طلبات الآن: لا توجد طريقة دفع متاحة. حاول مرة أخرى لاحقًا.",
    place: "تأكيد الطلب",
    errName: "اكتب اسمك.",
    errCity: "اختر مدينتك.",
    errAddress: "اكتب عنوان التوصيل.",
    required: "الحقول التي عليها * مطلوبة",
    changed: "تغيّرت بعض المنتجات في سلتك (الكمية المتوفرة أو السعر). راجع سلتك ثم أكّد الطلب.",
    doneTitle: "شكرًا لك، وصلنا طلبك",
    doneText: "طلب رقم {id}. أُرسل الإيصال إلى {phone}، وسيتواصل معك المتجر لتأكيده.",
    done: "العودة إلى المتجر",
    summary: "ملخص الطلب",
    stepCart: "السلة",
    stepDetails: "المعلومات",
    coupon: "كود الخصم",
    apply: "تطبيق",
    couponOn: "تم تطبيق {code}",
    discount: "الخصم",
    refused: {
      unknown: "هذا الكود غير موجود. تأكد منه وحاول مرة أخرى.",
      off: "أوقف المتجر هذا الكود مؤقتًا.",
      soon: "هذا الكود لم يبدأ بعد.",
      ended: "انتهت صلاحية هذا الكود.",
      usedUp: "نفدت مرات استخدام هذا الكود.",
      min: "طلبك أقل من الحد الأدنى لهذا الكود.",
    },
  },
};

/** Products to suggest: the same category as the ones given first, then featured ones, then the rest. Never ones already chosen. */
export function suggestFor(all: StoreProduct[], base: StoreProduct[], n: number): StoreProduct[] {
  const taken = new Set(base.map((p) => p.id));
  const cats = new Set(base.flatMap(categoriesOf).filter(Boolean));
  const left = all.filter((p) => !taken.has(p.id) && p.quantity > 0);
  const rank = (p: StoreProduct) => (categoriesOf(p).some((c) => cats.has(c)) ? 0 : p.featured ? 1 : 2);
  return [...left].sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

type Line = { p: StoreProduct; qty: number; /* the size chosen (clothing and shoes) */ size?: string };
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
    return s ? { ...p, price: typeof s.price === "number" ? s.price : null, sale: typeof s.sale === "number" ? s.sale : null, quantity: sellableStock(s), sizes: productSizes(s) } : p;
  });
}

/* The merchant's coupons as saved (checked before use, see records.ts) */
const storeCoupons = (): Coupon[] => {
  try {
    return parseList(localStorage.getItem("seen-coupons"), cleanCoupon);
  } catch {
    return [];
  }
};

/* The order saved for the merchant: the same shape as the orders of the dashboard (components/Orders.tsx) */
function saveOrder(o: { customer: string; phone: string; total: number; items: (PricedLine & { image?: string })[]; fulfil: Fulfil; city: string; address: string; note: string; pay: Pay; coupon?: { code: string; discount: number }; /* the delivery fee inside the total, for his reports */ delivery: number }): number | null {
  try {
    const list = readList("seen-orders");
    const id = list.reduce((m, x) => (typeof x.id === "number" && Number.isSafeInteger(x.id) && x.id < 1e9 ? Math.max(m, x.id) : m), 1000) + 1;
    localStorage.setItem("seen-orders", JSON.stringify([{ id, ...o, status: "pending", channel: 1, created: Date.now() }, ...list]));
    /* what was bought leaves the stock (a stock with no limit stays as it is) */
    if (localStorage.getItem("seen-products")) {
      localStorage.setItem("seen-products", JSON.stringify(readList("seen-products").map((p) => {
        /* clothing and shoes: each size bought leaves its own stock, and the product's stock is all its sizes again */
        const sizes = productSizes(p);
        if (sizes.length) {
          const left = sizes.map((z) => ({ ...z, quantity: Math.max(0, z.quantity - o.items.filter((x) => x.id === Number(p.id) && x.size === z.name).reduce((n, x) => n + x.qty, 0)) }));
          return o.items.some((x) => x.id === Number(p.id)) ? { ...p, sizes: left, quantity: left.reduce((n, z) => n + z.quantity, 0) } : p;
        }
        const line = o.items.find((x) => x.id === Number(p.id));
        return line && !isUnlimited(p) ? { ...p, quantity: Math.max(0, stock(p.quantity) - line.qty) } : p;
      })));
    }
    /* the coupon counts one more use (its limit is checked against this) */
    if (o.coupon) {
      const code = o.coupon.code;
      localStorage.setItem("seen-coupons", JSON.stringify(readList("seen-coupons").map((c) => (typeof c.code === "string" && c.code.toUpperCase() === code ? { ...c, used: (typeof c.used === "number" && c.used >= 0 ? c.used : 0) + 1 } : c))));
    }
    return id;
  } catch {
    return null;
  }
}

/* `pickup`: the merchant lets customers collect the order, so checkout offers it and then asks no city or address */
/* `ownFee`: the merchant delivers with his own courier and charges this per order; null means Dukkan Ship's price */
export function CartPanel({ open, onClose, lang, lines, products, setQty, fd, priceLanguage, onCleared, pickup = false, ownFee = null, look = "drawer", contained = false }: { open: boolean; onClose: () => void; lang: Lang; lines: Line[]; products: StoreProduct[]; setQty: (p: StoreProduct, n: number, size?: string) => void; fd: FreeDelivery; priceLanguage: Lang; onCleared: () => void; pickup?: boolean; ownFee?: number | null; look?: CartStyle; /* drawn inside its box (the designer's preview) instead of over the window */ contained?: boolean }) {
  const w = words[lang];
  const [step, setStep] = useState<"cart" | "details" | "done">("cart");
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", note: "" });
  /* What Dukkan's staff set in Diwan (platform settings): the ways to pay that are on, and the flat delivery price of Dukkan
     Ship. A merchant with his own courier charges his own fee instead (set on the Delivery page). Orders reaching the
     free delivery amount pay nothing either way */
  const platform = usePublicSettings();
  const pays = storePays(platform);
  const DELIVERY_FEE = ownFee ?? platform.dukkan_ship.price;
  /* the cities Dukkan Ship delivers to, as set in Diwan */
  const cities = shipCityLists(platform);
  const [payPicked, setPay] = useState<Pay>("cliq");
  /* a way to pay switched off in Diwan while the page is open is never kept: the first one still on is chosen */
  const pay: Pay | null = pays.includes(payPicked) ? payPicked : pays[0] ?? null;
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
    /* in the designer the preview stays where it is (focus would scroll it) */
    if (!contained) panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, contained]);
  useEffect(() => {
    if (!open && step === "done") setStep("cart");
  }, [open, step]);

  /* The coupon: what he types, the code taken, and why a code was refused */
  const [couponText, setCouponText] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState<CouponRefusal | null>(null);

  const amount = (n: number) => `${moneyIn(n, priceLanguage)} ${currency(priceLanguage)}`;
  const subtotal = lines.reduce((s, l) => s + l.qty * priceOf(l.p), 0);
  const freeNow = fd.on && subtotal >= fd.min;
  /* the coupon taken is checked again whenever the basket changes (it may fall under its minimum) */
  const cp = coupon ? checkCoupon(coupon, storeCoupons(), subtotal) : null;
  const discount = cp?.ok ? cp.discount : 0;
  const delivery = lines.length === 0 || freeNow || fulfil === "pickup" || (cp?.ok && cp.freeDelivery) ? 0 : DELIVERY_FEE;
  const total = toFils(subtotal - discount + delivery);
  const applyCoupon = () => {
    if (!couponText.trim()) return;
    const r = checkCoupon(couponText, storeCoupons(), subtotal);
    if (r.ok) {
      setCoupon(r.coupon.code);
      setCouponText("");
      setCouponErr(null);
    } else setCouponErr(r.why);
  };
  const suggestions = suggestFor(products, lines.map((l) => l.p), 3);
  const field = (bad?: string) => { const k = skins[look] ?? skins.drawer; return `${k.field} ${bad ? k.fieldBad : k.fieldOk}`; };
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof typeof errors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const place = () => {
    if (placing.current) return;
    const checked = checkCheckout({ ...form, pay, fulfil }, { pickup, pays, cities });
    const bad = new Set<CheckoutField>(checked.ok ? [] : checked.errors);
    const next: typeof errors = {};
    if (bad.has("name")) next.name = w.errName;
    if (bad.has("phone")) next.phone = w.errContact;
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
    const priced = priceCart(lines.map((l) => ({ id: l.p.id, qty: l.qty, size: l.size })), currentCatalog(products));
    if (priced.changed || priced.items.length === 0) {
      const fresh = new Map(priced.items.map((it) => [`${it.id}|${it.size ?? ""}`, it.qty]));
      lines.forEach((l) => setQty(l.p, fresh.get(`${l.p.id}|${l.size ?? ""}`) ?? 0, l.size));
      setChanged(true);
      setStep("cart");
      return;
    }
    /* The coupon is checked again with the catalog's subtotal and the coupons as saved now (it may have been used up) */
    const used = coupon ? checkCoupon(coupon, storeCoupons(), priced.subtotal) : null;
    if (used && !used.ok) {
      setCoupon("");
      setCouponErr(used.why);
      setStep("cart");
      return;
    }
    const off = used?.ok ? used.discount : 0;
    const fee = (fd.on && priced.subtotal >= fd.min) || checked.value.fulfil === "pickup" || (used?.ok && used.freeDelivery) ? 0 : DELIVERY_FEE;
    const sum = toFils(priced.subtotal - off + fee);
    placing.current = true;
    const id = saveOrder({
      ...checked.value,
      total: sum,
      delivery: toFils(fee),
      items: priced.items.map((it) => ({ ...it, image: lines.find((l) => l.p.id === it.id)?.p.image })),
      ...(used?.ok ? { coupon: { code: used.coupon.code, discount: off } } : {}),
    });
    if (id === null) {
      placing.current = false;
      return;
    }
    pushNotification("orderCreated", { id: String(id), name: checked.value.customer, total: amount(sum) });
    setDoneId(id);
    setStep("done");
    setChanged(false);
    setCoupon("");
    setCouponErr(null);
    onCleared();
  };
  useEffect(() => {
    if (step !== "done") placing.current = false;
  }, [step]);

  const s = skins[look] ?? skins.drawer;
  const luxe = look === "luxe";
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const progress = fd.on && fd.min > 0 ? Math.min(100, (subtotal / fd.min) * 100) : 100;
  const next = () => (step === "cart" ? setStep("details") : place());
  const heading: CSSProperties = { fontFamily: "var(--sf-heading)" };

  const freeLine = fd.on && lines.length > 0 && (
    <div className={s.free}>
      <p className="flex items-center gap-2">
        {look !== "editorial" && <span aria-hidden className="shrink-0">{truck}</span>}
        <span>{freeNow ? w.gotFree : w.leftForFree.replace("{n}", amount(fd.min - subtotal))}</span>
      </p>
      <div className={s.track}>
        <div className={s.fill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  const qtyControl = (p: StoreProduct, qty: number, size?: string) => (
    <div dir="ltr" className={s.qty}>
      <button type="button" onClick={() => setQty(p, qty - 1, size)} aria-label={w.less} className={s.qtyBtn}>−</button>
      <span className={s.qtyNum}>{qty}</span>
      <button type="button" onClick={() => setQty(p, qty + 1, size)} disabled={qty >= Math.min(size ? p.sizes?.find((z) => z.name === size)?.quantity ?? 0 : p.quantity, ORDER_LIMITS.qty)} aria-label={w.more} className={`${s.qtyBtn} disabled:opacity-30`}>+</button>
    </div>
  );

  /* The side panel and the floating card remove with a small icon at the corner, the fashion bag and the page with a word */
  const iconRemove = look === "drawer" || look === "pop";
  const item = ({ p, qty, size }: Line) => (
    <li key={`${p.id}|${size ?? ""}`} className={s.item} style={s.itemStyle}>
      <ProductImage p={p} className={`shrink-0 ${s.img}`} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className={s.name} style={luxe ? heading : undefined}><bdi>{p.name}</bdi></p>
          {iconRemove && (
            <button type="button" onClick={() => setQty(p, 0, size)} aria-label={`${w.remove}: ${p.name}`} title={w.remove} className={s.remove}>
              {look === "pop" ? cross : trash}
            </button>
          )}
        </div>
        {size && <p className="text-xs font-semibold opacity-70">{lang === "ar" ? "المقاس" : "Size"}: <bdi>{size}</bdi></p>}
        <p className={s.unit} dir="auto">{amount(priceOf(p))}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
          <div className="flex items-center gap-3">
            {qtyControl(p, qty, size)}
            {!iconRemove && <button type="button" onClick={() => setQty(p, 0, size)} className={s.remove}>{w.remove}</button>}
          </div>
          <p className={s.lineTotal} dir="auto">{amount(qty * priceOf(p))}</p>
        </div>
      </div>
    </li>
  );

  const suggest = suggestions.length > 0 && (
    <div>
      <p className={s.sTitle} style={luxe ? heading : undefined}>{w.suggest}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {suggestions.map((p) => (
          <div key={p.id} className={s.sCard} style={s.itemStyle}>
            <div className="relative">
              <ProductImage p={p} className={`w-full ${s.sImg}`} />
              {iconRemove && (
                <button type="button" onClick={() => setQty(p, 1)} aria-label={`${w.add}: ${p.name}`} className={s.sPlus}>+</button>
              )}
            </div>
            <p className={s.sName}><bdi>{p.name}</bdi></p>
            <p className={s.sPrice} dir="auto">{amount(priceOf(p))}</p>
            {!iconRemove && <button type="button" onClick={() => setQty(p, 1)} className={s.sAdd}>+ {w.add}</button>}
          </div>
        ))}
      </div>
    </div>
  );

  const sums = (
    <div className={s.sums}>
      <p className="flex justify-between gap-3"><span className="opacity-70">{w.subtotal}</span><span dir="auto">{amount(subtotal)}</span></p>
      {cp?.ok && discount > 0 && <p className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-500"><span>{w.discount} <span dir="ltr" className="font-bold">{cp.coupon.code}</span></span><span dir="auto">−{amount(discount)}</span></p>}
      <p className="flex justify-between gap-3"><span className="opacity-70">{w.delivery}</span><span dir="auto">{delivery === 0 ? w.free : amount(delivery)}</span></p>
      <p className={s.totalRow}><span>{w.total}</span><span dir="auto">{amount(total)}</span></p>
    </div>
  );
  const cta = (
    <button type="button" onClick={next} className={s.cta} style={s.ctaStyle}>
      <span>{step === "cart" ? w.checkout : `${w.place} · ${amount(total)}`}</span>
      <span aria-hidden>{icons.arrow}</span>
    </button>
  );

  /* A code refused now, or a code taken earlier that no longer fits the basket */
  const couponMsg = couponErr ? w.refused[couponErr] : cp && !cp.ok ? w.refused[cp.why] : "";
  const couponBox = (
    <div>
      {cp?.ok ? (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-bold ${s.couponOn}`}>
          <span className="flex items-center gap-1.5">{svg("m5 12 4 4 10-10", 2.4)}{w.couponOn.replace("{code}", cp.coupon.code)}</span>
          <button type="button" onClick={() => setCoupon("")} className="underline underline-offset-2 opacity-70 hover:opacity-100">{w.remove}</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); applyCoupon(); }} className="flex gap-2">
          <input
            value={couponText}
            onChange={(e) => { setCouponText(e.target.value.toUpperCase().slice(0, 24)); setCouponErr(null); if (coupon) setCoupon(""); }}
            aria-label={w.coupon}
            aria-invalid={!!couponMsg}
            placeholder={w.coupon}
            dir="ltr"
            autoComplete="off"
            className={`${field(couponMsg || undefined)} !h-10 min-w-0 flex-1 text-start uppercase placeholder:normal-case`}
          />
          <button type="submit" disabled={!couponText.trim()} className={`h-10 shrink-0 px-4 text-xs font-bold transition disabled:opacity-40 ${s.couponBtn}`}>{w.apply}</button>
        </form>
      )}
      {couponMsg && <p role="alert" className="mt-1.5 text-xs text-rose-600">{couponMsg}</p>}
    </div>
  );

  const cartView = (
    <div className={s.stack}>
      {changed && <p role="alert" className="rounded-[var(--sf-ri,10px)] bg-amber-500/15 px-3 py-2.5 text-xs font-semibold">{w.changed}</p>}
      {!luxe && freeLine}
      <ul className={s.list}>{lines.map(item)}</ul>
      {!luxe && couponBox}
      {suggest}
    </div>
  );

  const choice = (on: boolean) => `min-h-11 px-2 py-2 text-xs font-bold transition ${s.choice} ${on ? s.choiceOn : s.choiceOff}`;
  const detailsView = (
    <div className={s.form}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={s.formTitle} style={luxe ? heading : undefined}>{w.details}</h3>
        <p className="text-[11px] opacity-60">{w.required.split("*")[0]}<span className="text-rose-600">*</span>{w.required.split("*")[1]}</p>
      </div>
      <div className={luxe ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
        {(["name", "phone"] as const).map((k) => (
          <div key={k}>
            <label htmlFor={`co-${k}`} className={s.label}>{w[k]} <span className="text-rose-600">*</span></label>
            <input id={`co-${k}`} value={form[k]} maxLength={k === "phone" ? ORDER_LIMITS.email : ORDER_LIMITS.name} onChange={(e) => set(k, e.target.value)} dir={k === "phone" ? "ltr" : undefined} autoComplete={k === "phone" ? "email" : "name"} placeholder={k === "phone" ? "07X XXX XXXX · name@email.com" : undefined} aria-invalid={!!errors[k]} aria-describedby={k === "phone" ? "co-phone-hint" : undefined} className={`${field(errors[k])} ${k === "phone" ? "text-start" : ""}`} />
            {k === "phone" && !errors.phone && <p id="co-phone-hint" className="mt-1 text-xs opacity-60">{w.contactHint}</p>}
            {errors[k] && <p id={k === "phone" ? "co-phone-hint" : undefined} className="mt-1 text-xs text-rose-600">{errors[k]}</p>}
          </div>
        ))}
      </div>
      {pickup && (
        <div role="radiogroup" aria-label={w.fulfil}>
          <p className={s.label}>{w.fulfil}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["delivery", "pickup"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={fulfil === k} onClick={() => { setFulfil(k); setErrors((e) => ({ ...e, city: undefined, address: undefined })); }} className={choice(fulfil === k)}>
                {k === "delivery" ? w.fulfilDelivery : w.fulfilPickup}
              </button>
            ))}
          </div>
          {fulfil === "pickup" && <p className="mt-2 text-xs opacity-70">{w.pickupNote}</p>}
        </div>
      )}
      {fulfil === "delivery" && (
        <div className={luxe ? "grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "space-y-3"}>
          <div>
            <label htmlFor="co-city" className={s.label}>{w.city} <span className="text-rose-600">*</span></label>
            <select id="co-city" value={form.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} className={field(errors.city)}>
              <option value="">—</option>
              {cities[lang].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {errors.city && <p className="mt-1 text-xs text-rose-600">{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="co-address" className={s.label}>{w.address} <span className="text-rose-600">*</span></label>
            <input id="co-address" value={form.address} maxLength={ORDER_LIMITS.address} onChange={(e) => set("address", e.target.value)} aria-invalid={!!errors.address} className={field(errors.address)} />
            {errors.address && <p className="mt-1 text-xs text-rose-600">{errors.address}</p>}
          </div>
        </div>
      )}
      <div>
        <label htmlFor="co-note" className={s.label}>{w.note}</label>
        <textarea id="co-note" value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={ORDER_LIMITS.note} className={`${field()} h-auto resize-none py-2`} />
      </div>
      <div role="radiogroup" aria-label={w.pay}>
        <p className={s.label}>{w.pay}</p>
        {!pays.length && <p role="alert" className="text-sm text-rose-600">{w.noPay}</p>}
        <div className={`grid gap-2 ${pays.length === 1 ? "grid-cols-1" : pays.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {pays.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={pay === k} onClick={() => setPay(k)} className={choice(pay === k)}>
              {k === "cliq" ? w.payCliq : k === "cash" ? w.payCash : w.payCard}
            </button>
          ))}
        </div>
        {pay && payNote(platform, storePayKey(pay)) && <p dir="auto" className="mt-2 text-xs opacity-70">{payNote(platform, storePayKey(pay))}</p>}
        {pay === "card" && <p className="mt-2 text-xs opacity-70">{w.cardNote}</p>}
      </div>
    </div>
  );

  const centered = (icon: ReactNode, title: string, text: string, button: string) => (
    <div className="grid place-items-center py-10 text-center">
      <div className="max-w-xs">
        <span className={s.badge} style={s.badgeStyle}>{icon}</span>
        <h3 className={s.stateTitle} style={heading}>{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed opacity-70">{text}</p>
        <button type="button" onClick={onClose} className={`${s.cta} mx-auto mt-5 !w-auto px-7`} style={s.ctaStyle}>{button}</button>
      </div>
    </div>
  );
  const doneView = centered(check, w.doneTitle, w.doneText.replace("{id}", String(doneId)).replace("{phone}", jordanMobile(form.phone) ? `0${jordanMobile(form.phone)}` : form.phone.trim().toLowerCase()), w.done);
  const emptyView = centered(icons.bag, w.empty, w.emptyHint, w.keepShopping);

  const back = (
    <button type="button" onClick={() => setStep("cart")} className={s.back}>
      <span className="rotate-180">{icons.arrow}</span>
      {w.back}
    </button>
  );
  const title = (
    <h2 className={s.title} style={heading}>
      {w.title}
      {step === "cart" && count > 0 && <span className={s.count} style={s.countStyle}>{count}</span>}
    </h2>
  );
  const closeBtn = (
    <button type="button" onClick={onClose} aria-label={w.close} className={s.close}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
  /* the side panel shows where he is: the basket, then his details */
  const steps = look === "drawer" && step !== "done" && lines.length > 0 && (
    <div className="flex gap-1.5 px-4 pb-3 text-[11px] font-bold">
      {(["cart", "details"] as const).map((k, i) => (
        <div key={k} className="flex-1">
          <div className={`h-1 rounded-full ${i === 0 || step === "details" ? "bg-[var(--sf-primary)]" : "bg-sf-text/10"}`} />
          <p className={`mt-1 ${i === 0 || step === "details" ? "" : "opacity-50"}`}>{i + 1}. {k === "cart" ? w.stepCart : w.stepDetails}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`${contained ? "absolute" : "fixed"} inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} onClick={contained ? (e) => e.stopPropagation() : undefined}>
      {/* the page dims behind the basket; a click on it closes it */}
      <div onClick={onClose} className={`absolute inset-0 transition-opacity duration-300 ${s.dim} ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={w.title}
        tabIndex={-1}
        className={`absolute flex flex-col bg-[var(--sf-bg)] text-[var(--sf-text)] outline-none transition duration-300 ease-out ${s.shell} ${open ? s.shown : s.hidden}`}
        style={s.shellStyle}
      >
        {luxe ? (
          <div className={s.head}>
            <div>{step === "details" && back}</div>
            <div className="text-center">
              {title}
              <span aria-hidden className="mx-auto mt-1.5 flex items-center justify-center gap-2 text-[var(--sf-accent)]">
                <span className="h-px w-8 bg-current opacity-50" />
                <span className="h-1.5 w-1.5 rotate-45 bg-current" />
                <span className="h-px w-8 bg-current opacity-50" />
              </span>
            </div>
            <div className="flex justify-end">{closeBtn}</div>
          </div>
        ) : (
          <div className={s.head}>
            {step === "details" ? back : title}
            {closeBtn}
          </div>
        )}
        {steps}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={s.body}>
          {step === "done" ? (
            doneView
          ) : lines.length === 0 && step === "cart" ? (
            emptyView
          ) : luxe ? (
            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_330px] md:gap-10">
              <div>{step === "details" ? detailsView : cartView}</div>
              {/* the summary stays beside the products (under them on a phone) */}
              <aside className="self-start rounded-[var(--sf-r2,16px)] border border-[color-mix(in_srgb,var(--sf-accent)_28%,transparent)] bg-sf-text/[0.03] p-5 md:sticky md:top-0">
                <h3 className="text-lg" style={heading}>{w.summary}</h3>
                {step === "details" && (
                  <ul className="mt-3 space-y-2 border-b border-sf-text/10 pb-3">
                    {lines.map(({ p, qty }) => (
                      <li key={p.id} className="flex items-center gap-2.5 text-sm">
                        <ProductImage p={p} className="h-11 w-11 shrink-0 rounded-[var(--sf-ri,8px)]" />
                        <span className="min-w-0 flex-1 truncate"><bdi>{p.name}</bdi> <span className="opacity-60">× {qty}</span></span>
                        <span dir="auto" className="shrink-0 font-semibold">{amount(qty * priceOf(p))}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {freeLine && <div className="mt-3">{freeLine}</div>}
                <div className="mt-3">{couponBox}</div>
                <div className="mt-3">{sums}</div>
                <div className="mt-4">{cta}</div>
              </aside>
            </div>
          ) : step === "details" ? (
            detailsView
          ) : (
            cartView
          )}
          </div>
          {/* the sums and the next step follow the products (no empty gap), and stay in view when the list is long */}
          {!luxe && step !== "done" && lines.length > 0 && (
            <div className={`sticky bottom-0 bg-[var(--sf-bg)] ${s.foot}`}>
              {sums}
              {cta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const svg = (d: string, w = 2) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const trash = svg("M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3");
const cross = svg("M7 7l10 10M17 7 7 17", 2.6);
const truck = svg("M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z");
const check = <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4 10-10" /></svg>;

/* The four looks of the basket. They only shape it: the colors, fonts and corners are the store's own (the --sf-* values), so
   every look works with any colors a merchant picks. */
type Skin = {
  dim: string; shell: string; shown: string; hidden: string; shellStyle?: CSSProperties;
  head: string; title: string; count: string; countStyle?: CSSProperties; close: string; back: string;
  body: string; stack: string; list: string; item: string; itemStyle?: CSSProperties; img: string; name: string; unit: string;
  qty: string; qtyBtn: string; qtyNum: string; remove: string; lineTotal: string;
  free: string; track: string; fill: string;
  sTitle: string; sCard: string; sImg: string; sName: string; sPrice: string; sPlus: string; sAdd: string;
  couponBtn: string; couponOn: string;
  sums: string; totalRow: string; cta: string; ctaStyle?: CSSProperties; foot: string;
  form: string; formTitle: string; label: string; field: string; fieldBad: string; fieldOk: string; choice: string; choiceOn: string; choiceOff: string;
  badge: string; badgeStyle?: CSSProperties; stateTitle: string;
};
const onPrimary: CSSProperties = { background: "var(--sf-primary)", color: "var(--sf-on)" };
const hard = (n: number): CSSProperties => ({ boxShadow: `${n}px ${n}px 0 var(--sf-text)` });
/* a card a little lighter than the page, so it stands out on light and dark pages alike */
const lifted = "color-mix(in srgb, var(--sf-bg) 70%, white)";

const skins: Record<CartStyle, Skin> = {
  /* The store's own: a side panel with soft cards, a two-step bar and an icon to remove */
  drawer: {
    dim: "bg-black/40 backdrop-blur-[2px]",
    shell: "inset-y-0 end-0 w-full max-w-[420px] shadow-2xl",
    shown: "translate-x-0",
    hidden: "ltr:translate-x-full rtl:-translate-x-full",
    head: "flex items-center justify-between gap-3 px-4 pb-2.5 pt-4",
    title: "flex items-center gap-2 text-lg font-extrabold",
    count: "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold",
    countStyle: onPrimary,
    close: "grid h-9 w-9 place-items-center rounded-full bg-sf-text/[0.06] transition hover:bg-sf-text/10",
    back: "inline-flex items-center gap-1.5 text-sm font-bold text-[var(--sf-accent)] hover:underline",
    body: "px-4 pb-4",
    stack: "space-y-3",
    list: "space-y-2",
    item: "flex gap-3 rounded-[var(--sf-ri,12px)] bg-sf-text/[0.04] p-2",
    img: "h-[88px] w-[72px] rounded-[var(--sf-ri,8px)]",
    name: "line-clamp-2 text-[13px] font-bold leading-snug",
    unit: "mt-0.5 text-xs opacity-60",
    qty: "inline-flex h-8 items-center rounded-full bg-[var(--sf-bg)] ring-1 ring-sf-text/15",
    qtyBtn: "grid h-8 w-8 place-items-center text-base font-bold",
    qtyNum: "w-6 text-center text-sm font-bold tabular-nums",
    remove: "grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-50 transition hover:bg-rose-500/10 hover:text-rose-600 hover:opacity-100",
    lineTotal: "shrink-0 text-sm font-extrabold",
    free: "space-y-2 rounded-[var(--sf-ri,12px)] bg-sf-primary/10 px-3 py-2.5 text-xs font-semibold",
    track: "h-1.5 overflow-hidden rounded-full bg-sf-text/10",
    fill: "h-full rounded-full bg-[var(--sf-primary)] transition-[width] duration-500",
    sTitle: "mb-2 text-sm font-extrabold",
    sCard: "min-w-0",
    sImg: "aspect-square rounded-[var(--sf-ri,10px)]",
    sName: "mt-1.5 line-clamp-1 text-xs font-bold",
    sPrice: "text-[11px] opacity-60",
    sPlus: "absolute bottom-1.5 end-1.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--sf-primary)] text-base font-bold text-[var(--sf-on)] shadow-md transition hover:scale-110",
    sAdd: "",
    couponBtn: "rounded-[var(--sf-pill,999px)] bg-[var(--sf-primary)] text-[var(--sf-on)]",
    couponOn: "rounded-[var(--sf-ri,10px)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    sums: "space-y-1.5 text-sm",
    totalRow: "flex justify-between gap-3 border-t border-dashed border-sf-text/15 pt-2 text-base font-extrabold",
    cta: "flex h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-pill,999px)] text-sm font-extrabold transition hover:opacity-90",
    ctaStyle: onPrimary,
    foot: "space-y-3 border-t border-sf-text/10 px-4 py-3.5",
    form: "space-y-4",
    formTitle: "font-extrabold",
    label: "mb-1.5 block text-sm font-semibold",
    field: "h-11 w-full rounded-[var(--sf-ri,10px)] border bg-transparent px-3 text-sm outline-none transition focus:ring-2 focus:ring-sf-primary/30",
    fieldBad: "border-rose-500",
    fieldOk: "border-sf-text/20 focus:border-[var(--sf-primary)]",
    choice: "rounded-[var(--sf-ri,10px)] border",
    choiceOn: "border-[var(--sf-primary)] bg-sf-primary/10",
    choiceOff: "border-sf-text/20 hover:bg-sf-text/5",
    badge: "mx-auto grid h-16 w-16 place-items-center rounded-full bg-sf-primary/10 text-[var(--sf-primary)] [&>svg]:h-7 [&>svg]:w-7",
    stateTitle: "mt-4 text-xl font-extrabold",
  },
  /* The fashion chain's bag: square, black hairlines, small capitals, tall photos and words to remove */
  editorial: {
    dim: "bg-black/50",
    shell: "inset-y-0 end-0 w-full max-w-[460px]",
    shown: "translate-x-0",
    hidden: "ltr:translate-x-full rtl:-translate-x-full",
    head: "flex items-center justify-between gap-3 border-b-2 border-[var(--sf-text)] px-5 py-4",
    title: "flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.18em]",
    count: "font-normal opacity-60 before:content-['('] after:content-[')']",
    close: "grid h-8 w-8 place-items-center transition hover:opacity-60",
    back: "inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] hover:opacity-60",
    body: "px-5 pb-5",
    stack: "space-y-4 pt-4",
    list: "divide-y divide-sf-text/15 border-b border-sf-text/15",
    item: "flex gap-4 py-4",
    img: "h-[124px] w-[92px] rounded-[var(--sf-ri,0px)]",
    name: "line-clamp-2 text-[13px] font-semibold uppercase leading-snug tracking-wide",
    unit: "mt-1 text-[13px]",
    qty: "inline-flex h-8 items-center border border-[var(--sf-text)]",
    qtyBtn: "grid h-8 w-8 place-items-center text-sm transition hover:bg-sf-text/[0.06]",
    qtyNum: "w-7 text-center text-[13px] font-semibold tabular-nums",
    remove: "text-[11px] font-semibold uppercase tracking-[0.12em] underline underline-offset-4 opacity-60 hover:opacity-100",
    lineTotal: "shrink-0 text-[13px] font-bold",
    free: "space-y-2 text-[11px] font-semibold uppercase tracking-[0.12em]",
    track: "h-[3px] bg-sf-text/10",
    fill: "h-full bg-[var(--sf-text)] transition-[width] duration-500",
    sTitle: "mb-3 text-[12px] font-bold uppercase tracking-[0.18em]",
    sCard: "min-w-0",
    sImg: "aspect-[3/4] rounded-[var(--sf-ri,0px)]",
    sName: "mt-2 line-clamp-1 text-[11px] font-semibold uppercase tracking-wide",
    sPrice: "text-[12px]",
    sPlus: "",
    sAdd: "mt-1 self-start text-[11px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 hover:opacity-60",
    couponBtn: "rounded-[var(--sf-ri,0px)] border border-[var(--sf-text)] uppercase tracking-[0.12em] hover:bg-[var(--sf-text)] hover:text-[var(--sf-bg)]",
    couponOn: "border border-[var(--sf-text)] uppercase tracking-[0.08em]",
    sums: "space-y-1.5 text-[13px]",
    totalRow: "flex justify-between gap-3 pt-1.5 text-[13px] font-bold uppercase tracking-[0.12em]",
    cta: "flex h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-ri,0px)] text-[13px] font-bold uppercase tracking-[0.2em] transition hover:opacity-85",
    ctaStyle: { background: "var(--sf-text)", color: "var(--sf-bg)" },
    foot: "space-y-3 border-t-2 border-[var(--sf-text)] px-5 py-4",
    form: "space-y-4 pt-4",
    formTitle: "text-[13px] font-bold uppercase tracking-[0.18em]",
    label: "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em]",
    field: "h-11 w-full rounded-[var(--sf-ri,0px)] border bg-transparent px-3 text-sm outline-none transition",
    fieldBad: "border-rose-500",
    fieldOk: "border-sf-text/30 focus:border-[var(--sf-text)]",
    choice: "rounded-[var(--sf-ri,0px)] border uppercase tracking-wide",
    choiceOn: "border-[var(--sf-text)] bg-[var(--sf-text)] text-[var(--sf-bg)]",
    choiceOff: "border-sf-text/30 hover:border-[var(--sf-text)]",
    badge: "mx-auto grid h-14 w-14 place-items-center border-2 border-[var(--sf-text)] [&>svg]:h-6 [&>svg]:w-6",
    stateTitle: "mt-5 text-[15px] font-bold uppercase tracking-[0.16em]",
  },
  /* The luxury page: the whole screen, a centered title with an ornament, the summary in a framed card beside the products */
  luxe: {
    dim: "bg-black/30",
    shell: "inset-x-3 top-1/2 mx-auto max-h-[calc(100%-1.5rem)] max-w-5xl -translate-y-1/2 overflow-hidden rounded-[var(--sf-r2,16px)] shadow-2xl",
    shown: "scale-100 opacity-100",
    hidden: "scale-[0.97] opacity-0",
    head: "grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-sf-text/10 px-5 py-4 md:px-8",
    title: "inline-flex items-center gap-2 text-2xl font-light md:text-3xl",
    count: "text-base font-normal text-[var(--sf-accent)]",
    close: "grid h-10 w-10 place-items-center rounded-full border border-sf-text/15 transition hover:bg-sf-text/5",
    back: "inline-flex items-center gap-2 text-sm text-[var(--sf-accent)] hover:underline",
    body: "px-5 py-5 md:px-8 md:py-7",
    stack: "space-y-6",
    list: "divide-y divide-[color-mix(in_srgb,var(--sf-accent)_20%,transparent)]",
    item: "flex gap-4 py-4 first:pt-0",
    img: "h-28 w-24 rounded-[var(--sf-ri,10px)] md:h-32 md:w-28",
    name: "line-clamp-2 text-base leading-snug md:text-lg",
    unit: "mt-1 text-sm text-[var(--sf-accent)]",
    qty: "inline-flex items-center gap-1",
    qtyBtn: "grid h-8 w-8 place-items-center rounded-full border border-sf-text/20 text-sm transition hover:border-[var(--sf-accent)] hover:text-[var(--sf-accent)]",
    qtyNum: "w-7 text-center text-sm tabular-nums",
    remove: "text-xs text-[var(--sf-accent)] underline-offset-4 opacity-80 hover:underline",
    lineTotal: "shrink-0 text-base font-semibold",
    free: "space-y-2 text-xs",
    track: "h-1 overflow-hidden rounded-full bg-sf-text/10",
    fill: "h-full rounded-full bg-[var(--sf-accent)] transition-[width] duration-500",
    sTitle: "mb-3 text-lg",
    sCard: "flex min-w-0 flex-col rounded-[var(--sf-ri,10px)] border border-sf-text/10 p-2",
    sImg: "aspect-square rounded-[var(--sf-ri,8px)]",
    sName: "mt-2 line-clamp-1 text-xs font-semibold",
    sPrice: "text-xs text-[var(--sf-accent)]",
    sPlus: "",
    sAdd: "mt-2 h-8 rounded-[var(--sf-pill,999px)] border border-[var(--sf-accent)] text-[11px] font-semibold text-[var(--sf-accent)] transition hover:bg-[var(--sf-accent)] hover:text-[var(--sf-bg)]",
    couponBtn: "rounded-[var(--sf-pill,999px)] border border-[var(--sf-accent)] text-[var(--sf-accent)] hover:bg-[var(--sf-accent)] hover:text-[var(--sf-bg)]",
    couponOn: "rounded-[var(--sf-ri,10px)] border border-[color-mix(in_srgb,var(--sf-accent)_35%,transparent)] text-[var(--sf-accent)]",
    sums: "space-y-2 text-sm",
    totalRow: "flex justify-between gap-3 border-t border-sf-text/10 pt-3 text-lg font-semibold",
    cta: "flex h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-pill,999px)] text-sm font-semibold tracking-wide transition hover:opacity-90",
    ctaStyle: onPrimary,
    foot: "",
    form: "space-y-5",
    formTitle: "text-xl",
    label: "mb-1.5 block text-sm",
    field: "h-12 w-full rounded-[var(--sf-ri,10px)] border bg-sf-text/[0.03] px-3.5 text-sm outline-none transition focus:bg-transparent",
    fieldBad: "border-rose-500",
    fieldOk: "border-sf-text/15 focus:border-[var(--sf-accent)]",
    choice: "rounded-[var(--sf-ri,10px)] border",
    choiceOn: "border-[var(--sf-accent)] bg-[color-mix(in_srgb,var(--sf-accent)_10%,transparent)] text-[var(--sf-accent)]",
    choiceOff: "border-sf-text/15 hover:border-[var(--sf-accent)]",
    badge: "mx-auto grid h-16 w-16 place-items-center rounded-full border border-[var(--sf-accent)] text-[var(--sf-accent)] [&>svg]:h-7 [&>svg]:w-7",
    stateTitle: "mt-5 text-2xl font-light",
  },
  /* The playful card: it floats off the edge, with bold outlines, hard shadows, chunky round buttons and a sticker count */
  pop: {
    dim: "bg-black/25",
    shell: "bottom-3 end-3 max-h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] max-w-[420px] overflow-hidden rounded-[28px] border-2 border-[var(--sf-text)]",
    shellStyle: hard(6),
    shown: "translate-x-0 rotate-0",
    hidden: "ltr:translate-x-[calc(100%+2rem)] rtl:-translate-x-[calc(100%+2rem)] ltr:rotate-2 rtl:-rotate-2",
    head: "flex items-center justify-between gap-3 border-b-2 border-[var(--sf-text)] px-4 py-3",
    title: "flex items-center gap-2 text-2xl font-extrabold",
    count: "grid h-7 min-w-7 -rotate-6 place-items-center rounded-full border-2 border-[var(--sf-text)] px-1.5 text-xs font-extrabold",
    countStyle: onPrimary,
    close: "grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--sf-text)] transition hover:-translate-y-0.5",
    back: "inline-flex items-center gap-1.5 text-sm font-extrabold hover:underline",
    body: "px-4 py-3",
    stack: "space-y-3",
    list: "space-y-2.5",
    item: "flex gap-3 rounded-[18px] border-2 border-[var(--sf-text)] p-2",
    itemStyle: { ...hard(3), background: lifted },
    img: "h-[76px] w-[76px] rounded-[12px]",
    name: "line-clamp-2 text-sm font-extrabold leading-snug",
    unit: "text-xs font-bold opacity-60",
    qty: "inline-flex items-center gap-1.5",
    qtyBtn: "grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-[var(--sf-primary)] text-base font-extrabold text-[var(--sf-on)] transition active:translate-y-0.5",
    qtyNum: "w-5 text-center text-sm font-extrabold tabular-nums",
    remove: "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)] transition hover:bg-rose-500 hover:text-white",
    lineTotal: "shrink-0 text-base font-extrabold",
    free: "space-y-2 rounded-[16px] border-2 border-dashed border-[var(--sf-text)] px-3 py-2.5 text-xs font-extrabold",
    track: "h-3 overflow-hidden rounded-full border-2 border-[var(--sf-text)] bg-[var(--sf-bg)]",
    fill: "h-full bg-[var(--sf-accent)] bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(255,255,255,.35)_6px_12px)] transition-[width] duration-500",
    sTitle: "mb-2 text-base font-extrabold",
    sCard: "min-w-0 rounded-[16px] border-2 border-[var(--sf-text)] p-1.5",
    sImg: "aspect-square rounded-[10px]",
    sName: "mt-1.5 line-clamp-1 text-xs font-extrabold",
    sPrice: "text-[11px] font-bold opacity-60",
    sPlus: "absolute -bottom-2 end-1 grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-[var(--sf-primary)] text-lg font-extrabold text-[var(--sf-on)] transition hover:-translate-y-0.5",
    sAdd: "",
    couponBtn: "rounded-full border-2 border-[var(--sf-text)] bg-[var(--sf-primary)] text-[var(--sf-on)] shadow-[2px_2px_0_var(--sf-text)] active:translate-y-0.5 active:shadow-none",
    couponOn: "rounded-[14px] border-2 border-dashed border-[var(--sf-text)]",
    sums: "space-y-1 text-sm font-bold",
    totalRow: "flex justify-between gap-3 pt-1 text-lg font-extrabold",
    cta: "flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--sf-text)] text-base font-extrabold shadow-[4px_4px_0_var(--sf-text)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none",
    ctaStyle: onPrimary,
    foot: "space-y-3 border-t-2 border-[var(--sf-text)] px-4 py-3.5",
    form: "space-y-3.5",
    formTitle: "text-lg font-extrabold",
    label: "mb-1.5 block text-sm font-extrabold",
    field: "h-11 w-full rounded-[14px] border-2 bg-[var(--sf-bg)] px-3 text-sm font-semibold outline-none transition focus:shadow-[3px_3px_0_var(--sf-text)]",
    fieldBad: "border-rose-500",
    fieldOk: "border-[var(--sf-text)]",
    choice: "rounded-[14px] border-2 border-[var(--sf-text)]",
    choiceOn: "bg-[var(--sf-primary)] text-[var(--sf-on)] shadow-[3px_3px_0_var(--sf-text)]",
    choiceOff: "hover:-translate-y-0.5",
    badge: "mx-auto grid h-20 w-20 -rotate-6 place-items-center rounded-full border-2 border-[var(--sf-text)] [&>svg]:h-9 [&>svg]:w-9",
    badgeStyle: { ...hard(4), ...onPrimary },
    stateTitle: "mt-5 text-2xl font-extrabold",
  },
};
