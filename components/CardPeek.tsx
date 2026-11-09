"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Lang } from "./content";
import { loadConfig } from "./storefront/storage";

/* A field of the product form that shows on the store's product card */
export type PeekField = "notes" | "badge" | "sale" | "category";

/* The card's switch (in the store design → Product card) that decides whether the field shows on the card */
const cardSwitch: Record<PeekField, "showNotes" | "showBadge" | "showOldPrice" | "showCategory"> = {
  notes: "showNotes",
  badge: "showBadge",
  sale: "showOldPrice",
  category: "showCategory",
};

const words = {
  ar: {
    ask: "كيف يظهر في المتجر؟",
    title: "هكذا يظهر على بطاقة المنتج",
    titlePage: "هكذا يظهر في صفحة المنتج",
    off: (name: string) => `لا يظهر على بطاقة المنتج إلا عند تشغيل «${name}» في تصميم المتجر ← «بطاقة المنتج».`,
    features: "الوصف",
    crumb: "المتجر",
    pageOnly: "يظهر في صفحة المنتج فقط، لا على بطاقة المنتج.",
    switchName: { showNotes: "الوصف", showBadge: "شارة الخصم", showOldPrice: "السعر القديم (مشطوب)", showCategory: "اسم التصنيف" },
    page: "ويظهر أيضًا في صفحة المنتج.",
    sample: { name: "قميص قطني", notes: "قطن · ناعم · خفيف", badge: "جديد", category: "ملابس" },
    add: "أضف إلى السلة",
    currency: "د.أ",
  },
  en: {
    ask: "How does it look in the store?",
    title: "This is how it shows on the product card",
    titlePage: "This is how it shows on the product page",
    off: (name: string) => `It shows on the product card only when “${name}” is on in Store design → “Product card”.`,
    features: "Description",
    crumb: "Store",
    pageOnly: "It shows on the product page only, not on the product card.",
    switchName: { showNotes: "Description", showBadge: "Discount badge", showOldPrice: "Old price (crossed out)", showCategory: "Category name" },
    page: "It also shows on the product page.",
    sample: { name: "Cotton shirt", notes: "Cotton · Soft · Light", badge: "New", category: "Clothing" },
    add: "Add to cart",
    currency: "JOD",
  },
};

/**
 * A small "!" beside a field's title. Pointing at it (or pressing it) shows a product card with that field marked, filled with
 * what he typed (or an example), so he sees exactly where it lands in his store.
 */
export function CardPeek({ lang, field, values }: { lang: Lang; field: PeekField; values: { name: string; notes: string; badge: string; category: string; price: string; sale: string; photo?: string } }) {
  const w = words[lang];
  const [open, setOpen] = useState(false);
  /* whether the store's card shows this field (his saved design, or the template) */
  const [shown, setShown] = useState(true);
  /* where the card opens: fixed on the screen (the form scrolls inside a box that would cut it), under the "!" or above it
     when there is no room below, and never past the screen's sides */
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return setAt(null);
    const b = btn.current.getBoundingClientRect();
    const h = pop.current.offsetHeight;
    const w = pop.current.offsetWidth;
    const below = b.bottom + 8 + h <= window.innerHeight - 8;
    const top = below ? b.bottom + 8 : Math.max(8, b.top - 8 - h);
    const rtl = document.documentElement.dir === "rtl" || lang === "ar";
    const left = Math.min(Math.max(8, rtl ? b.right - w : b.left), window.innerWidth - w - 8);
    setAt({ top, left });
  }, [open, lang, shown]);
  /* it is pinned to the screen, so a scroll (of the page or the form) closes it rather than leaving it behind */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    try {
      const cards = loadConfig().cards as unknown as Record<string, unknown>;
      /* the short line is never on the card (only on the product page) */
      setShown(field !== "notes" && cards[cardSwitch[field]] !== false);
    } catch {
      setShown(true);
    }
  }, [open, field]);

  const name = values.name.trim() || w.sample.name;
  const notes = values.notes.trim() || w.sample.notes;
  const badge = values.badge.trim() || w.sample.badge;
  const category = values.category.trim() || w.sample.category;
  const price = Number(values.price) > 0 ? Number(values.price) : 15;
  const sale = Number(values.sale) > 0 && Number(values.sale) < price ? Number(values.sale) : field === "sale" ? Math.round(price * 0.8 * 100) / 100 : null;
  /* the marked part: a teal dashed ring */
  const mark = (on: boolean) => (on ? "rounded-md outline-dashed outline-2 outline-offset-2 outline-[#14b8a6]" : "");
  /* the short line as the product page shows it: each word in its own chip */
  const chips = notes.split(/\s*[·•،,|]\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
  const photo = (h: string) => (
    <span className={`relative block ${h} bg-gradient-to-br from-[#e8dccb] to-[#b9a58a]`}>
      {values.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={values.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
  const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <span className="relative ms-1.5 inline-block align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btn}
        type="button"
        aria-label={w.ask}
        aria-expanded={open}
        title={w.ask}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="grid h-[18px] w-[18px] place-items-center rounded-full border border-fg/30 text-[11px] font-extrabold leading-none text-muted transition hover:border-primary hover:text-primary"
      >
        !
      </button>
      {open && (
        <span ref={pop} role="tooltip" className={`fixed z-[100] block ${shown ? "w-56" : "w-[22rem]"} rounded-2xl bg-card p-3 text-start font-normal shadow-2xl ring-1 ring-fg/15`} style={at ? { top: at.top, left: at.left } : { top: 0, left: 0, visibility: "hidden" }}>
          <span className="mb-2 block text-xs font-bold">{shown ? w.title : w.titlePage}</span>
          {shown ? (
          /* the card, as the store draws it: picture (with its small label), category, name, the short line, price, add button */
          <span className="block overflow-hidden rounded-xl bg-white text-[#1c1a17] shadow ring-1 ring-black/10">
            <span className="relative block">
              {photo("h-28")}
              <span className={`absolute start-2 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#1c1a17] shadow-sm ${mark(field === "badge")}`}>{badge}</span>
            </span>
            <span className="block p-2.5">
              <span className={`block text-[10px] text-black/55 ${mark(field === "category")}`}>{category}</span>
              <span className="mt-0.5 block truncate text-[13px] font-bold">{name}</span>
              {field === "notes" && <span className={`mt-0.5 block truncate text-[11px] text-black/60 ${mark(true)}`}>{notes}</span>}
              <span className="mt-1.5 flex items-baseline gap-1.5" dir="ltr">
                <span className="text-[13px] font-extrabold">{money(sale ?? price)} <small className="text-[9px] font-semibold opacity-60">{w.currency}</small></span>
                {sale !== null && <span className={`text-[11px] text-black/45 line-through ${mark(field === "sale")}`}>{money(price)}</span>}
              </span>
              <span className="mt-2 block rounded-lg border border-black/15 py-1.5 text-center text-[11px] font-bold">{w.add}</span>
            </span>
          </span>
          ) : (
          /* not on the card: a small product page, as the store draws it on a wide screen: the store's bar on top, the way back,
             then the picture on one side and the details on the other (the short line as chips under its heading) */
          <span className="block overflow-hidden rounded-xl bg-white text-[#1c1a17] shadow ring-1 ring-black/10">
            <span className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-2.5 py-1.5">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-black/10" /><span className="h-1.5 w-8 rounded-full bg-black/15" /></span>
              <span className="h-2.5 w-16 rounded-full bg-black/[0.06]" />
              <span className="h-3 w-5 rounded-full bg-black/10" />
            </span>
            <span className="block px-2.5 pt-1.5 text-[8px] text-black/45">{w.crumb} / {category} / {name}</span>
            <span className="grid grid-cols-2 gap-2.5 p-2.5 pt-1.5">
              <span className="block overflow-hidden rounded-lg">{photo("h-full min-h-[7.5rem]")}</span>
              <span className="block min-w-0">
                <span className={`inline-block rounded-full bg-black/[0.06] px-1.5 py-px text-[8px] font-semibold text-black/60 ${mark(field === "badge" || field === "category")}`}>{field === "badge" ? badge : category}</span>
                <span className="mt-1 block truncate text-[13px] font-extrabold">{name}</span>
                <span className="mt-0.5 flex items-baseline gap-1.5" dir="ltr">
                  <span className="text-[12px] font-extrabold">{money(sale ?? price)} <small className="text-[8px] font-semibold opacity-60">{w.currency}</small></span>
                  {sale !== null && <span className={`text-[10px] text-black/45 line-through ${mark(field === "sale")}`}>{money(price)}</span>}
                </span>
                {field === "notes" && (
                  <span className={`mt-1.5 block p-0.5 ${mark(true)}`}>
                    <span className="block text-[9px] font-bold">{w.features}</span>
                    <span className="mt-0.5 flex flex-wrap gap-0.5">
                      {chips.map((x, i) => <span key={i} className="rounded-full bg-black/[0.06] px-1.5 py-px text-[8px] font-semibold">{x}</span>)}
                    </span>
                  </span>
                )}
                <span className="mt-1.5 flex gap-1">
                  <span className="rounded-md border border-black/15 px-1.5 py-1 text-[8px] font-bold" dir="ltr">− 1 +</span>
                  <span className="flex-1 rounded-md bg-[#1c1a17] py-1 text-center text-[8px] font-bold text-white">{w.add}</span>
                </span>
              </span>
            </span>
          </span>
          )}
          {shown && <span className="mt-2 block text-[11px] leading-relaxed text-muted">{w.page}</span>}
          {!shown && <span className="mt-2 block text-[11px] leading-relaxed text-muted">{field === "notes" ? w.pageOnly : w.off(w.switchName[cardSwitch[field]])}</span>}
        </span>
      )}
    </span>
  );
}
