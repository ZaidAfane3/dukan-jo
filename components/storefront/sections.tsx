"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { displayFamily, heroTitleFamily, type SectionConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, moneyIn, onColor, picFill, picStyle, priceLang, priceOf, ProductImage } from "./parts";
import type { StoreData, StoreProduct } from "./useStoreData";

/* Set only inside the store designer: clicking a part of the store selects it for editing. */
export type Design = { selected: string | null; select: (id: string, field?: string) => void; /* clicking a product's picture opens its picture editor */ selectProduct?: (p: StoreProduct) => void; /* dragging a colored button in the page moves it to another place in its row */ reorderChips?: (sectionId: string, from: number, to: number) => void; /* a button that leads to a page of the store shows that page in the preview (null: back to the home page) */ openPage?: (id: number | null) => void };

export type Ctx = {
  lang: Lang;
  compact: boolean;
  data: StoreData;
  config: StorefrontConfig;
  design?: Design;
  owner?: boolean;
  query: string;
  interactive: boolean;
  /* The basket: how many of each product, and a way to change it */
  qty: Record<number, number>;
  setQty: (p: StoreProduct, n: number) => void;
  /* Opens a page of the store (an info page the merchant wrote) in place of the home page */
  openPage?: (id: number) => void;
  /* Shows a part of the home page (from a page of the store, it goes back home first) */
  showSection?: (id: string) => void;
  /* Opens the page of a product */
  openProduct?: (id: number) => void;
};

/* A small line in an elegant Latin italic (taglines such as "The Emerald Edit") */
const latinItalic: React.CSSProperties = { fontFamily: "var(--font-elegant-latin), var(--font-elegant-ar), Georgia, serif", fontStyle: "italic", fontWeight: 400 };
/* The thin ring of the store color around round pictures */
const ringColor = "color-mix(in srgb, var(--sf-primary) 40%, transparent)";

/* A size set on a wide screen, made smaller for a phone (big titles shrink more than small texts) */
const scaled = (px: number, compact: boolean) => (compact ? (px > 40 ? Math.round(px * 0.55) : Math.round(px * 0.85)) : px);

/* A link a visitor may follow: "shop.com" becomes "https://shop.com" */
const linkHref = (l: string) => (/^https?:\/\//i.test(l.trim()) ? l.trim() : `https://${l.trim()}`);

/* A button can lead to a page of the store ("page:5"), a part of this page, or a web address */
const pageOf = (l: string) => {
  const m = /^page:(\d+)$/.exec((l ?? "").trim());
  return m ? Number(m[1]) : null;
};
export function linkProps(l: string, ctx: Ctx) {
  const id = pageOf(l);
  if (id !== null) return { href: "#", onClick: (e: React.MouseEvent) => { e.preventDefault(); ctx.openPage?.(id); } };
  /* The name of a part of this page: it scrolls there. Anything else is a web address. */
  if (!/^https?:\/\//i.test(l.trim()) && !l.includes(".")) return { href: `#${l.trim()}`, onClick: (e: React.MouseEvent) => { e.preventDefault(); ctx.showSection?.(l.trim()); } };
  return { href: linkHref(l), target: "_blank", rel: "noreferrer" };
}

/* In the designer a button that leads to a page of the store opens that page with Ctrl+click (a plain click selects it) */
const designOpen = (link: string | undefined, ctx: Ctx) => {
  const to = pageOf(link ?? "");
  return ctx.design && to !== null ? (e: React.MouseEvent) => { if (e.ctrlKey || e.metaKey) ctx.design?.openPage?.(to); } : undefined;
};

/* A button of the hero: it leads where the merchant chose. In the designer it only selects. */
function HeroBtn({ link, ctx, children, ...rest }: { link?: string; ctx: Ctx; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  if (link && link.trim() && !ctx.design) return <a {...linkProps(link, ctx)} {...rest}>{children}</a>;
  const to = pageOf(link ?? "");
  return (
    <button type="button" {...rest} onClick={ctx.design && to !== null ? (e) => { if (e.ctrlKey || e.metaKey) ctx.design?.openPage?.(to); } : undefined}>
      {children}
    </button>
  );
}

const card = "rounded-[var(--sf-r)] bg-white ring-1 ring-black/[0.06]";
/* The space above and below a section follows the store's spacing choice (--sf-sy above, --sf-sb below) */
const section = (compact: boolean) => (compact ? "px-4 pt-[var(--sf-syc,1.75rem)] pb-[var(--sf-sbc,1.75rem)]" : "px-8 pt-[var(--sf-sy,2.5rem)] pb-[var(--sf-sb,2.5rem)]");

/** In the designer, a part of the store that can be clicked to edit it. Elsewhere it is just its children. */
export function Pick({ ctx, id, field, children, block = false }: { ctx: Ctx; id: string; field?: string; children: React.ReactNode; block?: boolean }) {
  if (!ctx.design) return <>{children}</>;
  const d = ctx.design;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        d.select(id, field);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          d.select(id, field);
        }
      }}
      className={`cursor-pointer rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6] focus-visible:outline-dashed focus-visible:outline-[#14b8a6] ${block ? "block" : "inline-block"}`}
    >
      {children}
    </span>
  );
}

function Heading({ title, ctx, more, right, link }: { title: string; ctx: Ctx; more?: boolean; right?: React.ReactNode; /* where "view all" leads */ link?: string }) {
  const c = copy[ctx.lang];
  const viewAll = ctx.config.texts.viewAll[ctx.lang] || c.viewAll;
  const light = ctx.config.theme.titleStyle === "light";
  const pop = ctx.config.theme.titleStyle === "pop";
  /* The ornament style: three small diamonds above a centered title; with "view all" the title sits at the start and the link at the end */
  if (ctx.config.theme.titleStyle === "ornament") {
    const size = scaled(ctx.config.theme.sectionTitleSize ?? 44, ctx.compact);
    const h2 = <h2 className="font-semibold leading-tight text-[var(--sf-title)]" style={{ fontFamily: "var(--sf-heading)", fontSize: size }}>{title}</h2>;
    if (more || link) {
      const cls = "inline-flex min-h-[44px] items-center text-sm underline underline-offset-[6px] transition hover:opacity-70";
      return (
        <div className="mb-8 flex items-end justify-between gap-4">
          {h2}
          {link && !ctx.design ? <a {...linkProps(link, ctx)} className={cls}>{viewAll}</a> : <span className={cls} onClick={designOpen(link, ctx)}>{viewAll}</span>}
          {right}
        </div>
      );
    }
    return (
      <div className="mb-10 text-center">
        <p aria-hidden className="mb-4 text-[15px] tracking-[0.6em] text-[var(--sf-primary)]">◆ ◆ ◆</p>
        {h2}
        {right && <div className="mt-4 flex justify-center">{right}</div>}
      </div>
    );
  }
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2
        className={`tracking-tight text-[var(--sf-title)] ${light ? "font-light leading-tight" : pop ? "font-extrabold leading-tight" : "font-extrabold"}`}
        style={{ fontFamily: "var(--sf-heading)", fontSize: scaled(ctx.config.theme.sectionTitleSize ?? (light ? 34 : pop ? 44 : 24), ctx.compact) }}
      >
        {title}
      </h2>
      {more &&
        (pop ? (
          <span className="border-b-[3px] pb-0.5 text-sm font-bold text-[var(--sf-text)]" style={{ borderColor: "var(--sf-accent)" }}>{viewAll}</span>
        ) : light ? (
          <span className="border-b border-current pb-0.5 text-sm text-[var(--sf-text)]">{viewAll}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sf-title)]">
            {viewAll}
            {icons.arrow}
          </span>
        ))}
      {right}
    </div>
  );
}

/* ---------------- Product card ---------------- */

function ProductCard({ p, ctx }: { p: StoreProduct; ctx: Ctx }) {
  const c = copy[ctx.lang];
  const inBasket = ctx.qty[p.id] ?? 0;
  const off = p.sale !== null && p.price ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const out = p.quantity <= 0;
  const k = ctx.config.cards;
  const ratio = { portrait: "aspect-[4/5]", square: "aspect-square", wide: "aspect-[4/3]" }[k.image ?? "portrait"];
  const look = {
    shadow: `${card} p-2.5 hover:shadow-[0_18px_40px_-18px_rgba(18,38,43,0.35)]`,
    outline: "rounded-[var(--sf-r)] bg-white p-2.5 ring-1 ring-black/15",
    flat: "rounded-[var(--sf-r)] bg-transparent p-0",
    pop: "rounded-[var(--sf-r2)] border-2 border-[var(--sf-text)] bg-white p-3 shadow-[5px_5px_0_var(--sf-text)]",
  }[k.style ?? "shadow"];
  const pop = k.style === "pop";
  const plus = k.add === "plus";
  const low = k.showStock && p.quantity > 0 && p.quantity <= 5;
  const row = (k.info ?? "stack") === "row";
  /* centered: the name, the material line and the price under the picture, in the middle, the name and price in the titles font */
  const centered = k.info === "center";

  return (
    <article
      onClick={(e) => {
        if (ctx.design) { e.stopPropagation(); ctx.design.select("cards"); return; }
        /* the buttons of the card (add, +, -, heart) keep their own job */
        if (ctx.openProduct && !(e.target as HTMLElement).closest("button")) ctx.openProduct(p.id);
      }}
      className={`group relative overflow-hidden transition duration-300 hover:-translate-y-1 ${look} ${ctx.design || ctx.openProduct ? "cursor-pointer" : ""}`}
    >
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: pop ? "var(--sf-ri)" : "calc(var(--sf-r) - 8px)" }}
        onClick={(e) => {
          /* In the designer, the picture itself opens the editor for which part of it stays visible */
          if (ctx.design?.selectProduct && p.image) {
            e.stopPropagation();
            ctx.design.selectProduct(p);
          }
        }}
      >
        <ProductImage p={p} flat={pop} className={`${ratio} w-full transition duration-500 group-hover:scale-[1.04]`} />
        {k.showBadge &&
          (p.badge ? (
            <span className="absolute start-2.5 top-2.5 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#1c1a17] shadow-sm">{p.badge}</span>
          ) : (
            off > 0 && (
              <span className="absolute start-2.5 top-2.5 rounded-full bg-[var(--sf-primary)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--sf-on)] shadow">
                -{off}%
              </span>
            )
          ))}
      </div>

      <div className={`relative px-1.5 pb-1.5 ${centered ? "pt-4 text-center" : "pt-3"}`}>
       <div className={`${row ? "flex items-start justify-between gap-3" : ""} ${plus ? (inBasket > 0 && !out ? "pe-[6.75rem]" : "pe-11") : ""}`}>
        <div className="min-w-0">
        {p.category && k.showCategory && <p className="text-xs text-[var(--sf-text)]/55">{p.category}</p>}
        {k.showName && (centered ? (
          <h3 className="line-clamp-1 font-semibold" style={{ fontFamily: "var(--sf-heading)", fontSize: ctx.compact ? 18 : 22 }}>{p.name}</h3>
        ) : (
          <h3 className={`mt-0.5 text-sm font-bold ${plus && inBasket > 0 ? "line-clamp-2" : "line-clamp-1"}`}>{p.name}</h3>
        ))}
        {k.showNotes && p.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--sf-text)]/60">{p.notes}</p>}
        {low && <p className="mt-0.5 text-xs font-semibold text-amber-600">{ctx.lang === "ar" ? `بقي ${p.quantity} فقط` : `Only ${p.quantity} left`}</p>}
        </div>
        {k.showPrice && (
          <p dir="ltr" className={`${row ? "mt-0.5 shrink-0" : centered ? "mt-2 justify-center" : pop ? "mt-1 w-fit" : plus ? "mt-3 w-fit" : "mt-3"} flex items-baseline gap-1.5 text-start`} style={{ ...(k.priceColor ? { color: k.priceColor } : {}), ...(centered ? { fontFamily: "var(--sf-heading)" } : {}) }}>
            {p.price === null ? (
              <span className="text-sm text-[var(--sf-text)]/55">{ctx.lang === "ar" ? "بدون سعر" : "No price"}</span>
            ) : (
              <>
                <span className={centered ? "text-xl font-bold" : "text-base font-extrabold"}>{moneyIn(priceOf(p), priceLang(ctx.config.theme.prices, ctx.lang))}</span>
                <span className="text-[11px] font-semibold text-[var(--sf-text)]/60">{currency(priceLang(ctx.config.theme.prices, ctx.lang))}</span>
                {p.sale !== null && k.showOldPrice && <s className="text-xs text-[var(--sf-text)]/45">{moneyIn(p.price, priceLang(ctx.config.theme.prices, ctx.lang))}</s>}
              </>
            )}
          </p>
        )}
       </div>

        {/* Add to cart. Once the product is in the basket the button turns into  -  1  +  */}
        {plus && (
          inBasket > 0 && !out ? (
            <div className="absolute bottom-2 end-1.5">
              <div dir="ltr" className="flex h-9 items-center overflow-hidden rounded-full border-2 border-[var(--sf-text)] bg-white text-sm font-extrabold text-[var(--sf-text)]">
              <button type="button" onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, inBasket - 1)} aria-label={`${ctx.lang === "ar" ? "إنقاص" : "Remove one"}: ${p.name}`} className="grid h-full w-8 place-items-center transition hover:bg-black/10">&minus;</button>
              <span aria-live="polite" className="min-w-[1.25rem] text-center tabular-nums">{inBasket}</span>
              <button type="button" disabled={inBasket >= p.quantity} onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, inBasket + 1)} aria-label={`${ctx.lang === "ar" ? "زيادة" : "Add one more"}: ${p.name}`} className="grid h-full w-8 place-items-center transition hover:bg-black/10 disabled:opacity-40">+</button>
            </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={out || p.price === null}
              onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, 1)}
              aria-label={out ? c.soldOut : `${c.add}: ${p.name}`}
              className="absolute bottom-2 end-1.5 grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--sf-text)] text-xl font-extrabold leading-none text-[var(--sf-text)] transition hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: k.addColor || "#b9f3d0" }}
            >
              +
            </button>
          )
        )}
        {!plus && (inBasket > 0 && !out ? (
          <div dir="ltr" className="mt-3 flex h-11 w-full items-center justify-between overflow-hidden rounded-xl border-2 border-[var(--sf-text)] bg-white text-[var(--sf-text)]">
            <button
              type="button"
              onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, inBasket - 1)}
              aria-label={`${ctx.lang === "ar" ? "إنقاص" : "Remove one"}: ${p.name}`}
              className="grid h-full w-12 place-items-center text-xl font-bold transition hover:bg-black/[0.07] active:scale-95"
            >
              −
            </button>
            <span aria-live="polite" className="text-sm font-extrabold tabular-nums">{inBasket}</span>
            <button
              type="button"
              disabled={inBasket >= p.quantity}
              onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, inBasket + 1)}
              aria-label={`${ctx.lang === "ar" ? "زيادة" : "Add one more"}: ${p.name}`}
              className="grid h-full w-12 place-items-center text-xl font-bold transition hover:bg-black/[0.07] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={out || p.price === null}
            onClick={() => (ctx.interactive || ctx.design) && ctx.setQty(p, 1)}
            aria-label={out ? c.soldOut : `${c.add}: ${p.name}`}
            className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
              out
                ? "cursor-not-allowed border-black/10 bg-black/[0.05] text-[var(--sf-text)]/40"
                : "border-[var(--sf-primary)]/50 text-[var(--sf-primary)] hover:bg-[var(--sf-primary)] hover:text-[var(--sf-on)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            }`}
          >
            {out ? c.soldOut : <>{icons.bag}{c.add}</>}
          </button>
        ))}
      </div>
    </article>
  );
}

/** The page of one product: the picture, the name, the price, how many are left, the way to buy it, and other products below */
/* Stars: full, and one that is partly filled for a rating like 4.8 */
function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr" aria-label={`${value} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
            <defs>
              <linearGradient id={`st${i}-${Math.round(value * 10)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f5b301" />
                <stop offset={`${fill * 100}%`} stopColor="#f5b301" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z" fill={`url(#st${i}-${Math.round(value * 10)})`} stroke="#f5b301" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}

/* Made-up opinions of customers, shown only while a store is styled with sample products (a real store never shows invented ones) */
const sampleOpinions = {
  en: [
    { name: "Lina", text: "Exactly like the pictures, and it arrived the next day. I already ordered another color!" },
    { name: "Omar", text: "The fabric is soft and the size is right. Worth every dinar." },
    { name: "Sara", text: "Lovely packaging and a friendly team. They answered all my questions fast." },
  ],
  ar: [
    { name: "ليلى", text: "نفس الصور بالضبط ووصلتني تاني يوم. طلبت لون ثاني كمان!" },
    { name: "عمر", text: "القماش ناعم والمقاس مضبوط. يستاهل كل دينار." },
    { name: "سارة", text: "تغليف حلو وفريق لطيف. ردوا على كل أسئلتي بسرعة." },
  ],
};

export function ProductPage({ p, ctx, onBack }: { p: StoreProduct; ctx: Ctx; onBack: () => void }) {
  const c = copy[ctx.lang];
  const off = p.sale !== null && p.price ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const out = p.quantity <= 0;
  const inBasket = ctx.qty[p.id] ?? 0;
  const others = ctx.data.products.filter((x) => x.id !== p.id).slice(0, 4);
  const btn = "grid h-12 w-12 place-items-center text-xl font-bold transition hover:bg-black/[0.07] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
  /* A rating and a number of reviews that stay the same for a product (sample stores only) */
  /* Only sample products (the made-up store) show the sample rating, sizes, perks and opinions */
  const sample = ctx.data.isDemo || p.id < 0;
  const rating = 4.5 + (Math.abs(p.id) % 5) / 10;
  const reviewsCount = 24 + ((Math.abs(p.id) * 37) % 180);
  const [size, setSize] = useState("M");
  const isClothes = /ملابس|clothes/i.test(p.category ?? "");
  const perks = ctx.lang === "ar"
    ? [{ icon: "🚚", title: "توصيل سريع", text: "خلال ١–٢ يوم", color: "#b9f3d0" }, { icon: "🔄", title: "تبديل مجاني", text: "خلال ١٤ يومًا", color: "#ffe36e" }, { icon: "🔒", title: "دفع آمن", text: "كاش أو بطاقة", color: "#c9b6ff" }]
    : [{ icon: "🚚", title: "Fast delivery", text: "In 1–2 days", color: "#b9f3d0" }, { icon: "🔄", title: "Free exchange", text: "Within 14 days", color: "#ffe36e" }, { icon: "🔒", title: "Safe payment", text: "Cash or card", color: "#c9b6ff" }];
  return (
    <section className={ctx.compact ? "min-h-[420px] px-4 py-8" : "min-h-[640px] px-8 py-12"}>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-accent)] hover:underline">
        <span className={ctx.lang === "ar" ? "" : "rotate-180"}>{icons.arrow}</span>
        {ctx.lang === "ar" ? "العودة إلى المتجر" : "Back to the store"}
      </button>
      <div className={`mt-6 grid items-start gap-10 ${ctx.compact ? "" : "md:grid-cols-2"}`}>
        <div className="overflow-hidden" style={{ borderRadius: "var(--sf-r)" }}>
          <ProductImage p={p} flat={ctx.config.cards.style === "pop"} className="aspect-[4/5] w-full" />
        </div>
        <div>
          {p.category && <p className="text-sm text-[var(--sf-text)]/60">{p.category}</p>}
          <h1 className={`mt-1 font-extrabold leading-tight text-[var(--sf-title)] ${ctx.compact ? "text-3xl" : "text-5xl"}`} style={{ fontFamily: "var(--sf-heading)" }}>{p.name}</h1>
          {p.badge && <span className="mt-3 inline-block rounded-full bg-[var(--sf-primary)] px-3 py-1 text-xs font-bold text-[var(--sf-on)]">{p.badge}</span>}
          {sample && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <Stars value={rating} />
              <span>{rating.toFixed(1)}</span>
              <span className="text-[var(--sf-text)]/55">· {ctx.lang === "ar" ? `${reviewsCount} تقييم` : `${reviewsCount} reviews`}</span>
            </p>
          )}
          {p.price !== null && (
            <p dir="ltr" className="mt-5 flex items-baseline gap-2.5 text-start" style={ctx.config.cards.priceColor ? { color: ctx.config.cards.priceColor } : undefined}>
              <span className="text-4xl font-extrabold">{moneyIn(priceOf(p), priceLang(ctx.config.theme.prices, ctx.lang))}</span>
              <span className="text-sm font-semibold opacity-70">{currency(priceLang(ctx.config.theme.prices, ctx.lang))}</span>
              {p.sale !== null && <s className="text-lg opacity-50">{moneyIn(p.price, priceLang(ctx.config.theme.prices, ctx.lang))}</s>}
              {off > 0 && <span className="rounded-full bg-[var(--sf-primary)] px-2.5 py-1 text-xs font-extrabold text-[var(--sf-on)]">-{off}%</span>}
            </p>
          )}
          {p.notes && <p className="mt-4 text-lg leading-relaxed text-[var(--sf-text)]/75">{p.notes}</p>}
          <p className={`mt-4 text-sm font-semibold ${out ? "text-rose-600" : p.quantity <= 5 ? "text-amber-600" : "text-emerald-700"}`}>
            {out ? c.soldOut : p.quantity <= 5 ? (ctx.lang === "ar" ? `بقي ${p.quantity} فقط` : `Only ${p.quantity} left`) : ctx.lang === "ar" ? "متوفر" : "In stock"}
          </p>
          {sample && isClothes && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold">{ctx.lang === "ar" ? "المقاس" : "Size"}</p>
              <div className="flex flex-wrap gap-2">
                {["S", "M", "L", "XL"].map((z) => (
                  <button key={z} type="button" onClick={() => setSize(z)} aria-pressed={size === z} className={`grid h-11 min-w-[3rem] place-items-center border-2 px-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${size === z ? "bg-[var(--sf-text)] text-[var(--sf-bg)]" : "bg-white text-[var(--sf-text)]"}`} style={{ borderColor: "var(--sf-text)", borderRadius: "var(--sf-pill)" }}>{z}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6">
            {inBasket > 0 && !out ? (
              <div dir="ltr" className="inline-flex items-center overflow-hidden rounded-xl border-2 border-[var(--sf-text)] bg-white text-[var(--sf-text)]">
                <button type="button" className={btn} onClick={() => ctx.setQty(p, inBasket - 1)} aria-label={ctx.lang === "ar" ? "إنقاص" : "Remove one"}>−</button>
                <span aria-live="polite" className="min-w-[3rem] text-center font-extrabold tabular-nums">{inBasket}</span>
                <button type="button" className={btn} disabled={inBasket >= p.quantity} onClick={() => ctx.setQty(p, inBasket + 1)} aria-label={ctx.lang === "ar" ? "زيادة" : "Add one more"}>+</button>
              </div>
            ) : (
              <button
                type="button"
                disabled={out || p.price === null}
                onClick={() => ctx.setQty(p, 1)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--sf-primary)] px-8 text-base font-bold text-[var(--sf-on)] shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {icons.bag}
                {out ? c.soldOut : c.add}
              </button>
            )}
          </div>
          {sample && (
            <ul className="mt-7 grid gap-3 sm:grid-cols-3">
              {perks.map((x) => (
                <li key={x.title} className="flex items-center gap-3 border-2 bg-white p-3 text-start" style={{ borderColor: "var(--sf-text)", borderRadius: "var(--sf-ri)" }}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg" style={{ background: x.color }}>{x.icon}</span>
                  <span className="min-w-0 text-xs leading-snug"><b className="block text-sm">{x.title}</b>{x.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {sample && (
        <div className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Heading title={ctx.lang === "ar" ? "آراء العملاء" : "What customers say"} ctx={ctx} />
            <p className="mb-6 flex items-center gap-2 text-sm font-semibold">
              <Stars value={rating} size={16} />
              {rating.toFixed(1)} · {ctx.lang === "ar" ? `${reviewsCount} تقييم` : `${reviewsCount} reviews`}
            </p>
          </div>
          <div className={`grid gap-4 ${ctx.compact ? "" : "md:grid-cols-3"}`}>
            {sampleOpinions[ctx.lang].map((o, i) => (
              <figure key={o.name} className="border-2 bg-white p-5" style={{ borderColor: "var(--sf-text)", borderRadius: "var(--sf-r2)", boxShadow: ctx.config.cards.style === "pop" ? "4px 4px 0 var(--sf-text)" : undefined }}>
                <Stars value={i === 1 ? 4.5 : 5} size={16} />
                <blockquote className="mt-3 text-sm leading-relaxed">{o.text}</blockquote>
                <figcaption className="mt-4 flex items-center gap-2 text-sm font-bold">
                  <span className="grid h-8 w-8 place-items-center rounded-full text-xs" style={{ background: ["#ffe36e", "#b9f3d0", "#ff8fb1"][i] }}>{o.name.slice(0, 1)}</span>
                  {o.name}
                  <span className="ms-auto text-xs font-semibold text-emerald-700">{ctx.lang === "ar" ? "✓ مشتري موثّق" : "✓ Verified buyer"}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-14">
          <Heading title={ctx.lang === "ar" ? "منتجات أخرى" : "More products"} ctx={ctx} />
          <Grid items={others} ctx={ctx} columns={4} />
        </div>
      )}
    </section>
  );
}

/* The row of products that slides: where it is, how to move it, and its two arrows (they can sit in the section's title line) */
function useRail(count: number, cols: number, ctx: Ctx) {
  const rail = useRef<HTMLDivElement>(null);
  const animating = useRef<number | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false, page: 0 });
  const rtl = ctx.lang === "ar";

  /* Where the row is: at its first products, at its last ones, or in between (the arrows follow) */
  const measure = () => {
    const el = rail.current;
    if (!el) return;
    const at = Math.abs(el.scrollLeft);
    setEdge({ start: at < 4, end: at + el.clientWidth >= el.scrollWidth - 4, page: Math.round(at / Math.max(1, el.clientWidth)) });
  };
  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count, cols]);

  /* One row's width at a time, with an eased glide of its own (the browser's snapping would jerk it) */
  const slide = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    if (animating.current) cancelAnimationFrame(animating.current);
    const from = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const to = Math.max(rtl ? -max : 0, Math.min(rtl ? 0 : max, from + dir * (rtl ? -1 : 1) * el.clientWidth));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = to;
      return;
    }
    const t0 = performance.now();
    el.style.scrollSnapType = "none";
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 520);
      const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      el.scrollLeft = from + (to - from) * ease;
      if (k < 1) animating.current = requestAnimationFrame(step);
      else {
        animating.current = null;
        el.style.scrollSnapType = "";
      }
    };
    animating.current = requestAnimationFrame(step);
  };

  const arrow = "grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-[var(--sf-bg)] text-[var(--sf-text)] shadow-sm transition hover:scale-105 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100";
  const arrows = (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" disabled={edge.start} onClick={() => slide(-1)} aria-label={rtl ? "السابق" : "Previous"} className={arrow}>
        <span className="rtl:rotate-180">{icons.arrow}</span>
      </button>
      {/* One dot for each row of products, so a change in the number of products shown can be seen: more products, more dots */}
      <span className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: Math.max(1, Math.ceil(count / cols)) }, (_, i) => (
          <span key={i} className="h-2 rounded-full transition-all duration-300" style={{ width: i === edge.page ? 18 : 8, background: "var(--sf-text)", opacity: i === edge.page ? 1 : 0.25 }} />
        ))}
      </span>
      <button type="button" disabled={edge.end} onClick={() => slide(1)} aria-label={rtl ? "التالي" : "Next"} className={arrow}>
        <span className="rotate-180 rtl:rotate-0">{icons.arrow}</span>
      </button>
    </div>
  );
  return { rail, measure, arrows };
}

/* Products in one row of `columns`; more than fit slide sideways. The arrows are in the section's title line (the end of it: the left in
   Arabic) when the section gives its own `rail`, otherwise they sit just above the row. */
function Grid({ items, ctx, columns, rail }: { items: StoreProduct[]; ctx: Ctx; columns: number; rail?: ReturnType<typeof useRail> }) {
  const cols = ctx.compact ? 2 : columns;
  const gap = ctx.compact ? 12 : 20;
  const own = useRail(items.length, cols, ctx);
  const r = rail ?? own;

  if (items.length <= cols) {
    return (
      <div className="grid" style={{ gap, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((p) => (
          <ProductCard key={p.id} p={p} ctx={ctx} />
        ))}
      </div>
    );
  }
  return (
    <div>
      {!rail && <div className="mb-3 flex justify-end">{own.arrows}</div>}
      <div ref={r.rail} onScroll={r.measure} className="flex snap-x snap-mandatory overflow-x-auto pb-3 pe-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ gap }}>
        {items.map((p) => (
          <div key={p.id} className="shrink-0 snap-start" style={{ width: `calc((100% - ${(cols - 1) * gap}px) / ${cols})` }}>
            <ProductCard p={p} ctx={ctx} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Sections ---------------- */

function Hero({ id, s, ctx }: { id: string; s: Extract<SectionConfig, { type: "hero" }>["settings"]; ctx: Ctx }) {
  const real = ctx.data.products.slice(0, 3);
  /* With no products yet, neutral cards keep the banner from looking bare */
  const tiles: StoreProduct[] = real.length ? real : [0, 1, 2].map((i) => ({ id: -i - 1, name: "", category: "", price: null, sale: null, featured: false, quantity: 0, hue: 175 + i * 25 }));
  const primary = ctx.config.theme.primary || ctx.data.color;
  const bgs = s.backgrounds?.length ? s.backgrounds : [{ kind: "color" as const, color: "", image: "" }];
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const idx = shown % bgs.length;
  const seconds = Math.max(2, s.seconds || 5);
  const run = (s.autoplay ?? true) && bgs.length > 1;
  /* The size of a text of the hero: the one he set with + and -, or the theme's own */
  const sz = (key: "title" | "subtitle" | "eyebrow" | "price" | "detail" | "button", def: number) => scaled(s.sizes?.[key] ?? def, ctx.compact);

  /* The backgrounds change by themselves, one after the other, in the order the merchant set. */
  useEffect(() => {
    if (!run || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setShown((v) => v + 1);
    }, seconds * 1000);
    return () => clearInterval(t);
    /* `shown` is here so that using the arrows or dots starts a fresh countdown */
  }, [run, paused, seconds, bgs.length, shown]);

  const go = (dir: 1 | -1) => setShown((v) => (v % bgs.length + dir + bgs.length) % bgs.length);

  /* The pop layout: a sticker chip, a heavy title with one colored word, two chunky buttons, and a collage (a blob, an arch photo,
     a tilted photo and a round sticker). Without photos the collage shows flat colored shapes. */
  if (s.layout === "pop") {
    const l = ctx.lang;
    const other = l === "ar" ? "en" : "ar";
    const pick = (b?: { en: string; ar: string }) => b?.[l] || b?.[other] || "";
    const ink = "var(--sf-text)";
    const pc = s.popColors ?? {};
    const accentC = pc.accent || "#ff5c93";
    const blobC = pc.blob || "#c9b6ff";
    const stickerC = pc.sticker || "#ffe36e";
    const eyebrow = pick(s.eyebrow);
    const sticker = pick(s.sticker);
    const button2 = pick(s.button2);
    const accentWords = pick(s.accentWord).split(/\s+/).filter(Boolean);
    const words = (s.title[l] || s.title[other] || "").split(/\s+/).filter(Boolean);
    const open = (field: string) => (ctx.design ? (e: React.MouseEvent) => { e.stopPropagation(); ctx.design!.select(id, field); } : undefined);
    const btn = "inline-flex items-center border-2 px-8 py-3.5 font-bold transition hover:-translate-y-0.5";
    return (
      <section className={ctx.compact ? "px-4 pt-6" : "px-8 pt-10"}>
        <div className={`grid items-center gap-8 ${ctx.compact ? "" : "md:grid-cols-2"}`}>
          <div className={`flex flex-col gap-5 ${ctx.compact ? "items-center text-center" : "items-start"}`}>
            {eyebrow && (
              <Pick ctx={ctx} id={id} field="eyebrow">
                <span className="inline-block rounded-full border-2 px-3.5 py-1 text-xs font-bold" style={{ background: stickerC, borderColor: ink, color: s.colors?.eyebrow || ink }}>{eyebrow}</span>
              </Pick>
            )}
            <Pick ctx={ctx} id={id} field="title" block>
              <h1 className="font-extrabold tracking-[-0.01em]" style={{ fontFamily: s.titleFont ? heroTitleFamily(s.titleFont) : "var(--sf-heading)", fontSize: sz("title", 108), lineHeight: 1.02, color: s.colors?.title || "var(--sf-title)" }}>
                {words.map((w, i) => (
                  <span key={i} className="block" style={accentWords.includes(w) ? { color: accentC } : undefined}>{w}</span>
                ))}
              </h1>
            </Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block>
              <p className="max-w-md font-medium leading-[1.7]" style={{ fontSize: sz("subtitle", 20), color: s.colors?.subtitle }}>{s.subtitle[l] || s.subtitle[other]}</p>
            </Pick>
            <div className={`flex flex-wrap items-center gap-3 ${ctx.compact ? "justify-center" : ""}`}>
              <Pick ctx={ctx} id={id} field="button">
                <HeroBtn ctx={ctx} link={s.link} style={{ fontSize: sz("button", 16), background: ink, borderColor: ink, color: s.colors?.button || "var(--sf-bg)", boxShadow: `4px 4px 0 ${accentC}`, borderRadius: "var(--sf-pill)" }} className={btn}>{s.button[l] || s.button[other]}</HeroBtn>
              </Pick>
              {button2 && (
                <Pick ctx={ctx} id={id} field="button2">
                  <HeroBtn ctx={ctx} link={s.link2} style={{ fontSize: sz("button", 16), background: "#ffffff", borderColor: ink, color: ink, borderRadius: "var(--sf-pill)" }} className={btn}>{button2}</HeroBtn>
                </Pick>
              )}
            </div>
          </div>

          <div dir="ltr" className="relative mx-auto aspect-[1.05/1] w-full max-w-[34rem]">
            <span aria-hidden className="absolute inset-[5%] border-2" style={{ background: blobC, borderColor: ink, borderRadius: "58% 42% 55% 45% / 50% 55% 45% 50%" }} />
            <div onClick={open("photo")} className={`absolute right-[7%] top-[9%] w-[47%] overflow-hidden border-2 bg-[#ece4dc] ${ctx.design ? "cursor-pointer" : ""}`} style={{ aspectRatio: "3/4", borderColor: ink, borderRadius: "999px 999px var(--sf-ri) var(--sf-ri)" }}>
              {s.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo} alt="" className="h-full w-full object-cover" style={picStyle(s.photoPos)} />
              )}
            </div>
            <div onClick={open("photo2")} className={`absolute bottom-[8%] left-[6%] w-[38%] overflow-hidden border-2 ${ctx.design ? "cursor-pointer" : ""}`} style={{ aspectRatio: "3/4", background: "#bfe36a", borderColor: ink, borderRadius: "var(--sf-ri)", transform: "rotate(-7deg)" }}>
              {s.photo2 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photo2} alt="" className="h-full w-full object-cover" style={picStyle(s.photo2Pos)} />
              )}
            </div>
            {sticker && (
              <div onClick={open("sticker")} className={`absolute left-[3%] top-[3%] grid w-[21%] place-items-center rounded-full border-2 text-center font-extrabold leading-tight ${ctx.design ? "cursor-pointer" : ""}`} style={{ aspectRatio: "1", background: stickerC, borderColor: ink, color: ink, transform: "rotate(-10deg)", whiteSpace: "pre-line", fontSize: ctx.compact ? 12 : 18 }}>
                {sticker}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* The orbit layout: a small Latin line, a title whose marked words are in the accent color, two square buttons, and a round photo
     in three thin rings with a small price tag over its edge */
  if (s.layout === "orbit") {
    const l = ctx.lang;
    const other = l === "ar" ? "en" : "ar";
    const pick = (b?: { en: string; ar: string }) => b?.[l] || b?.[other] || "";
    const pc = s.popColors ?? {};
    const gold = pc.accent || "var(--sf-primary)";
    const kicker = pick(s.eyebrow);
    const button2 = pick(s.button2);
    const label = pick(s.size);
    const accentWords = pick(s.accentWord).split(/\s+/).filter(Boolean);
    const lines = (s.title[l] || s.title[other] || "").split("\n");
    const open = (field: string) => (ctx.design ? (e: React.MouseEvent) => { e.stopPropagation(); ctx.design!.select(id, field); } : undefined);
    const btn = "inline-flex min-h-[44px] items-center px-9 py-4 text-[15px] font-bold transition hover:opacity-90";
    return (
      <section className={ctx.compact ? "px-4 pt-10" : "px-8 pt-[72px]"}>
        <div className={`grid items-center ${ctx.compact ? "gap-14" : "gap-[72px] md:grid-cols-2"}`}>
          <div className={`flex flex-col gap-6 ${ctx.compact ? "items-center text-center" : "items-start"}`}>
            {kicker && (
              <Pick ctx={ctx} id={id} field="eyebrow">
                <p dir="auto" style={{ ...latinItalic, fontSize: sz("eyebrow", 22), color: s.colors?.eyebrow || "var(--sf-accent)" }}>{kicker}</p>
              </Pick>
            )}
            <Pick ctx={ctx} id={id} field="title" block>
              <h1 className="font-semibold" style={{ fontFamily: s.titleFont ? heroTitleFamily(s.titleFont) : "var(--sf-heading)", fontSize: sz("title", 80), lineHeight: 1.15, color: s.colors?.title || "var(--sf-title)" }}>
                {lines.map((line, i) => (
                  <span key={i} className="block">
                    {line.split(/\s+/).filter(Boolean).map((w, j) => (
                      <Fragment key={j}>
                        {j > 0 && " "}
                        <span style={accentWords.includes(w) ? { color: gold } : undefined}>{w}</span>
                      </Fragment>
                    ))}
                  </span>
                ))}
              </h1>
            </Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block>
              <p className="max-w-[420px] font-light" style={{ fontSize: sz("subtitle", 18), lineHeight: 2, color: s.colors?.subtitle || "color-mix(in srgb, var(--sf-text) 80%, var(--sf-bg))" }}>{s.subtitle[l] || s.subtitle[other]}</p>
            </Pick>
            <div className={`flex flex-wrap items-center gap-4 ${ctx.compact ? "justify-center" : ""}`}>
              <Pick ctx={ctx} id={id} field="button">
                <HeroBtn ctx={ctx} link={s.link} className={btn} style={{ fontSize: sz("button", 15), background: gold, color: s.colors?.button || "var(--sf-bg)" }}>{s.button[l] || s.button[other]}</HeroBtn>
              </Pick>
              {button2 && (
                <Pick ctx={ctx} id={id} field="button2">
                  <HeroBtn ctx={ctx} link={s.link2} className={btn} style={{ fontSize: sz("button", 15), border: `1px solid ${gold}`, color: gold }}>{button2}</HeroBtn>
                </Pick>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full" style={{ maxWidth: ctx.compact ? 300 : 520, padding: ctx.compact ? 26 : 40 }}>
            <div className="relative aspect-square w-full">
              <span aria-hidden className="pointer-events-none absolute rounded-full" style={{ inset: ctx.compact ? -26 : -40, border: "1px dashed color-mix(in srgb, var(--sf-primary) 20%, transparent)" }} />
              <span aria-hidden className="pointer-events-none absolute rounded-full" style={{ inset: -16, border: `1px solid ${ringColor}` }} />
              <div onClick={open("photo")} className={`absolute inset-0 overflow-hidden rounded-full ${ctx.design ? "cursor-pointer" : ""}`} style={{ outline: `1px solid ${ringColor}`, outlineOffset: 8, background: "color-mix(in srgb, var(--sf-text) 6%, var(--sf-bg))" }}>
                {s.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo} alt={label || pick(s.title)} className="h-full w-full object-cover" style={picFill(s.photoPos)} />
                )}
              </div>
              {(label || s.price) && (
                <div onClick={open("price")} className={`absolute bottom-[4%] start-[-6%] px-5 py-3.5 ${ctx.design ? "cursor-pointer" : ""}`} style={{ background: pc.sticker || "#f2eee6", color: "var(--sf-bg)" }}>
                  {label && <p className="text-xs" style={{ color: "color-mix(in srgb, var(--sf-bg) 60%, #f2eee6)" }}>{label}</p>}
                  {s.price && <p className="font-bold" style={{ fontFamily: "var(--sf-heading)", fontSize: sz("price", 20) }}>{s.price}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* The split layout: a big photo on one side and the text on the other. The text panel has its own color (or the first
     background color), and can hold an eyebrow, a price with its size, and a second button. */
  if (s.layout === "split") {
    const l = ctx.lang;
    const other = l === "ar" ? "en" : "ar";
    const pick = (b?: { en: string; ar: string }) => b?.[l] || b?.[other] || "";
    const panel = s.panelColor || (bgs[0].kind === "color" ? bgs[0].color || primary : primary);
    const light = onColor(panel) !== "#ffffff";
    const photoFirst = (s.photoSide ?? "start") === "start";
    const full = !!s.fullWidth;
    const eyebrow = pick(s.eyebrow);
    const size = pick(s.size);
    const button2 = pick(s.button2);
    const head = { fontFamily: "var(--sf-heading)" };
    const solid = light ? "bg-[var(--sf-primary)] text-[var(--sf-on)]" : "bg-white text-[#12262b]";
    return (
      <section className={full ? "" : ctx.compact ? "px-4 pt-4" : "px-8 pt-6"}>
        <div
          className={`grid overflow-hidden ${full ? "" : "rounded-[var(--sf-r)]"} ${ctx.compact ? "" : photoFirst ? "md:grid-cols-[1.15fr_1fr]" : "md:grid-cols-[1fr_1.15fr]"}`}
          style={{ background: panel, color: light ? "var(--sf-text)" : "#ffffff" }}
        >
          <div className={`relative ${ctx.compact ? "aspect-[4/3]" : full ? "min-h-[720px]" : "min-h-[26rem]"} ${photoFirst ? "" : "md:order-2"}`}>
            {s.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-black/10 px-6 text-center text-sm font-semibold opacity-80">
                {ctx.design ? (l === "ar" ? "أضف صورة الغلاف من القائمة الجانبية" : "Add the cover photo from the side panel") : ""}
              </span>
            )}
          </div>
          <div className={`flex flex-col justify-center ${ctx.compact ? "items-center gap-4 px-6 py-10 text-center" : full ? "gap-7 px-16 py-20" : "gap-5 px-12 py-12"}`}>
            {eyebrow && (
              <Pick ctx={ctx} id={id} field="eyebrow" block>
                <p className="font-bold leading-[1.2]" style={{ ...head, fontSize: sz("eyebrow", 34), color: s.colors?.eyebrow || (light ? "var(--sf-accent)" : "currentColor") }}>{eyebrow}</p>
              </Pick>
            )}
            <Pick ctx={ctx} id={id} field="title" block>
              <h1 className="font-bold leading-none tracking-[-0.01em]" style={{ ...head, fontFamily: heroTitleFamily(s.titleFont), fontSize: sz("title", full ? 100 : 48), color: s.colors?.title }}>{s.title[l]}</h1>
            </Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block>
              <p className="max-w-[460px] font-medium leading-[1.7] opacity-85" style={{ fontSize: sz("subtitle", full ? 24 : 15), color: s.colors?.subtitle }}>{s.subtitle[l]}</p>
            </Pick>
            {(s.price || size) && (
              <p className="flex items-baseline gap-2.5">
                {s.price && <span className="font-bold" style={{ ...head, fontSize: sz("price", 26), color: s.colors?.price }}>{s.price}</span>}
                {size && <span className="opacity-60" style={{ fontSize: sz("detail", 13), color: s.colors?.detail }}>{size}</span>}
              </p>
            )}
            <div className={`flex flex-wrap items-center gap-3 ${ctx.compact ? "justify-center" : ""}`}>
              <Pick ctx={ctx} id={id} field="button">
                <HeroBtn ctx={ctx} link={s.link} style={{ fontSize: sz("button", 15), color: s.colors?.button }} className={`inline-flex items-center gap-2 rounded-full px-9 py-4 font-semibold shadow-md transition hover:-translate-y-0.5 ${solid}`}>
                  {s.button[l]}
                </HeroBtn>
              </Pick>
              {button2 && (
                <Pick ctx={ctx} id={id} field="button2">
                  <HeroBtn ctx={ctx} link={s.link2} style={{ fontSize: sz("button", 15), color: s.colors?.button }} className="inline-flex items-center gap-2 rounded-full border border-current px-[30px] py-[15px] font-medium transition hover:-translate-y-0.5">
                    {button2}
                  </HeroBtn>
                </Pick>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const current = bgs[idx];
  const heroOn = current.kind === "image" && current.image ? "#ffffff" : onColor(current.color || primary);
  const slideColor = (c: string) => c || primary;
  return (
    <section className={ctx.compact ? "px-4 pt-4" : "px-8 pt-6"}>
      <div
        className={`relative isolate overflow-hidden rounded-[var(--sf-r)] transition-colors duration-700 ${ctx.compact ? "px-6 py-9" : "px-10 py-11"}`}
        style={{ color: heroOn }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* The backgrounds, stacked: the current one is visible and the others fade in and out */}
        {bgs.map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-0 -z-20 transition-opacity duration-700"
            style={{
              opacity: i === idx ? 1 : 0,
              background:
                b.kind === "image" && b.image
                  ? `linear-gradient(to top, rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.2)), url(${b.image}) center / cover no-repeat`
                  : `linear-gradient(120deg, ${slideColor(b.color)}, color-mix(in srgb, ${slideColor(b.color)} 62%, #6fe3cf))`,
            }}
          />
        ))}
        <span aria-hidden className="absolute -end-16 -top-20 -z-10 h-72 w-72 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -bottom-24 start-1/3 -z-10 h-64 w-64 rounded-full bg-white/10" />

        <div className={`flex items-center justify-between gap-8 ${ctx.compact ? "flex-col text-center" : ""}`}>
          <div className={ctx.compact ? "" : "max-w-md"}>
            <Pick ctx={ctx} id={id} field="title" block><h1 className="font-extrabold leading-[1.1] tracking-tight" style={{ ...(s.titleFont ? { fontFamily: heroTitleFamily(s.titleFont) } : {}), fontSize: sz("title", 36), color: s.colors?.title }}>{s.title[ctx.lang]}</h1></Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block><p className="mt-4 leading-relaxed opacity-85" style={{ fontSize: sz("subtitle", 15), color: s.colors?.subtitle }}>{s.subtitle[ctx.lang]}</p></Pick>
            <div className="mt-7"><Pick ctx={ctx} id={id} field="button"><HeroBtn ctx={ctx} link={s.link} style={{ fontSize: sz("button", 14), color: s.colors?.button }} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-extrabold text-[#12262b] shadow-lg transition hover:-translate-y-0.5">
              {s.button[ctx.lang]}
              {icons.arrow}
            </HeroBtn></Pick></div>
          </div>

          {!ctx.compact && (s.showCards ?? true) && (
            <div className="relative h-56 w-72 shrink-0" style={{ perspective: 900 }}>
              {tiles.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute w-36 rounded-2xl bg-white p-2 shadow-2xl"
                  style={{ insetInlineStart: `${i * 52}px`, top: `${i === 1 ? 0 : 36}px`, transform: `rotateY(${(i - 1) * -10}deg) rotate(${(i - 1) * 4}deg)`, zIndex: i === 1 ? 2 : 1 }}
                >
                  <ProductImage p={p} className="aspect-[4/5] w-full rounded-xl" />
                  {p.name ? <p className="mt-2 line-clamp-1 px-1 text-[11px] font-bold text-[#12262b]">{p.name}</p> : <span className="mt-2 block h-2 w-16 rounded-full bg-black/10" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Previous and next: a visitor never has to wait for the next background */}
        {bgs.length > 1 &&
          ([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(dir);
              }}
              aria-label={dir === -1 ? (ctx.lang === "ar" ? "السابق" : "Previous") : ctx.lang === "ar" ? "التالي" : "Next"}
              className={`absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#12262b] shadow-md backdrop-blur transition hover:scale-105 hover:bg-white ${dir === -1 ? "start-3" : "end-3"}`}
            >
              {/* Previous sits at the start of the reading direction, next at the end */}
              <span className={dir === -1 ? "rotate-180" : ""}>{icons.arrow}</span>
            </button>
          ))}

        {bgs.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {bgs.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1} / ${bgs.length}`}
                aria-current={i === idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setShown(i);
                }}
                className={`h-2 rounded-full bg-current transition-all ${i === idx ? "w-6 opacity-90" : "w-2 opacity-40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Perks({ s, ctx }: { s: Extract<SectionConfig, { type: "perks" }>["settings"]; ctx: Ctx }) {
  const items = s.items ?? [];
  if (!items.length) return null;
  const ic = { truck: icons.truck, shield: icons.shield, returns: icons.returns, gift: icons.gift, clock: icons.clock, chat: icons.chat };
  return (
    <section className={ctx.compact ? "px-4 pt-4" : "px-8 pt-6"}>
      <div className={`grid gap-3 ${ctx.compact ? "" : ""}`} style={ctx.compact ? undefined : { gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
        {items.map((p, i) => (
          <div key={i} className={`flex items-center gap-3.5 ${card} px-5 py-4`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--sf-primary)]" style={{ background: "color-mix(in srgb, var(--sf-primary) 11%, white)" }}>
              {p.icon === "image" && p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-7 w-7 object-contain" />
              ) : (
                ic[p.icon as keyof typeof ic] ?? icons.truck
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{p.title[ctx.lang] || p.title[ctx.lang === "ar" ? "en" : "ar"]}</span>
              <span className="block text-xs text-[var(--sf-text)]/55">{p.desc[ctx.lang] || p.desc[ctx.lang === "ar" ? "en" : "ar"]}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A product collection the merchant built: the products he picked, with his name for it, up to the count he set. */
function Collection({ s, ctx }: { s: Extract<SectionConfig, { type: "collection" }>["settings"]; ctx: Ctx }) {
  const picked = (s.productIds ?? []).map((id) => ctx.data.products.find((p) => p.id === id)).filter((p): p is StoreProduct => !!p);
  /* While styling with sample products, an empty collection shows some samples */
  const items = (picked.length ? picked : ctx.data.isDemo ? ctx.data.products : []).slice(0, s.count);
  if (!items.length) return null;
  const inner = (
    <>
      <Heading title={s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]} ctx={ctx} more link={s.link || undefined} />
      <Grid items={items} ctx={ctx} columns={s.columns} />
    </>
  );
  /* A band of its own color across the whole width: its text, titles and buttons take the band's text color */
  if (s.background) {
    const ink = s.color || onColor(s.background);
    return (
      <section className={ctx.compact ? "my-10 px-4 py-12" : "my-16 px-8 py-24"} style={{ background: s.background, color: ink, ["--sf-text" as string]: ink, ["--sf-title" as string]: ink, ["--sf-primary" as string]: ink, ["--sf-on" as string]: s.background }}>
        {inner}
      </section>
    );
  }
  return <section className={section(ctx.compact)}>{inner}</section>;
}

/** Animated pictures: his own pictures or GIFs, one at a time, with arrows, dots and optional links. */
/* ---------------- Picture tiles ---------------- */

function Tiles({ s, ctx }: { s: Extract<SectionConfig, { type: "tiles" }>["settings"]; ctx: Ctx }) {
  const list = (s.items ?? []).filter((x) => x.image);
  const other = ctx.lang === "ar" ? "en" : "ar";
  const title = s.title?.[ctx.lang] || s.title?.[other] || "";
  const editorial = s.style === "editorial";
  if (!list.length) {
    /* Only the merchant, in the designer, sees where the pictures will go */
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <div className="grid aspect-[4/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "معرض صور: أضف صورك من القائمة الجانبية" : "Picture tiles: add your pictures from the side panel"}
        </div>
      </section>
    );
  }
  const cols = ctx.compact ? Math.min(2, list.length) : Math.min(s.columns || 4, list.length);
  /* Circles: round pictures, each in a thin ring of the store color, with the name under it */
  if (s.style === "circles") {
    return (
      <section className={section(ctx.compact)}>
        {title && <Heading title={title} ctx={ctx} />}
        <div className={`grid ${ctx.compact ? "gap-x-6 gap-y-8" : "gap-8"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {list.map((x, n) => {
            const label = x.label?.[ctx.lang] || x.label?.[other] || "";
            const body = (
              <div className="group flex flex-col items-center px-3">
                <div className="aspect-square w-full overflow-hidden rounded-full" style={{ outline: `1px solid ${ringColor}`, outlineOffset: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.image} alt={label} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" style={picFill(x.pos)} />
                </div>
                {label && <span className="mt-5 text-center" style={{ fontFamily: "var(--sf-heading)", fontSize: ctx.compact ? 18 : 22 }}>{label}</span>}
              </div>
            );
            return x.link && !ctx.design ? <a key={n} {...linkProps(x.link, ctx)} className="block">{body}</a> : <div key={n} onClick={designOpen(x.link, ctx)}>{body}</div>;
          })}
        </div>
      </section>
    );
  }
  return (
    <section className={`relative isolate ${section(ctx.compact)}`}>
      {title && <Heading title={title} ctx={ctx} more={editorial} />}
      <div className={`grid ${editorial ? "gap-5" : "gap-4"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((x, n) => {
          const label = x.label?.[ctx.lang] || x.label?.[other] || "";
          const dark = x.chip === "dark";
          const body = (
            <div className={`group relative overflow-hidden bg-black/5 ${editorial ? `rounded-[4px] ${ctx.compact ? "h-[200px]" : "h-[260px]"}` : "aspect-[4/5] rounded-[var(--sf-r)]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.image} alt={label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" style={picFill(x.pos)} />
              {label &&
                (editorial ? (
                  <span
                    className={`absolute start-3 top-3 rounded-[10px] px-3.5 py-1.5 backdrop-blur-[6px] ${dark ? "bg-[rgba(18,14,11,.55)] text-white" : "bg-[rgba(255,250,246,.7)] text-[#1c1a17]"}`}
                    style={{ fontFamily: "var(--sf-heading)" }}
                  >
                    <span className={`font-light ${ctx.compact ? "text-lg" : "text-[22px]"}`}>{label}</span>
                  </span>
                ) : (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10 text-sm font-bold text-white">{label}</span>
                ))}
            </div>
          );
          return x.link && !ctx.design ? (
            <a key={n} {...linkProps(x.link, ctx)} className="block">
              {body}
            </a>
          ) : (
            <div key={n}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Promo banners: text and a button laid over a picture ---------------- */

function Banners({ s, ctx }: { s: Extract<SectionConfig, { type: "banners" }>["settings"]; ctx: Ctx }) {
  const list = s.items ?? [];
  const other = ctx.lang === "ar" ? "en" : "ar";
  if (!list.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <div className="grid aspect-[3/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "بنرات ترويجية: أضف بنرًا من القائمة الجانبية" : "Promo banners: add a banner from the side panel"}
        </div>
      </section>
    );
  }
  /* Color cards sit two by two (an odd last one takes the whole row); photo banners sit up to three in a row */
  const cardMode = list.every((b) => b.variant === "card");
  const cols = ctx.compact ? 1 : cardMode ? 2 : Math.min(list.length, 3);
  const ratio = list.length === 1 ? "aspect-[21/9]" : list.length === 2 ? "aspect-[4/3]" : "aspect-[4/5]";
  const tall = s.height === "tall";
  const primary = ctx.config.theme.primary || ctx.data.color;
  const corner = { "top-start": "top-6 start-6", "top-end": "top-6 end-6", "bottom-start": "bottom-6 start-6", "bottom-end": "bottom-6 end-6" };
  return (
    <section className={section(ctx.compact)}>
      <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((b, n) => {
          const pickText = (v?: { en: string; ar: string }) => v?.[ctx.lang] || v?.[other] || "";
          const title = pickText(b.title);
          const text = pickText(b.text);
          const button = pickText(b.button);
          const eyebrow = pickText(b.eyebrow);
          const go = b.link && !ctx.design;
          const dgo = ctx.design && pageOf(b.link ?? "") !== null ? (e: React.MouseEvent) => { if (e.ctrlKey || e.metaKey) ctx.design?.openPage?.(pageOf(b.link)!); } : undefined;
          const rich = b.panel === "light" || b.panel === "dark";
          const accent = b.accent || "var(--sf-accent)";
          const sizeClass = tall ? (ctx.compact ? "h-[420px]" : "h-[600px]") : ctx.compact ? "aspect-[4/3]" : ratio;
          const photo = b.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" style={picStyle(b.pos)} />
          );
          const shell = `relative isolate overflow-hidden rounded-[var(--sf-r)] ${sizeClass}`;
          const bg = { background: b.image ? "#000" : `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, #6fe3cf))` };

          if (b.variant === "card") {
            /* A card of one color: the small line, the title and a dark button, with the picture in an arch or tilted */
            const ink = "var(--sf-text)";
            const dark = b.accent || ink;
            const shape = b.shape ?? "arch";
            const arrow = ctx.lang === "ar" ? "\u2190" : "\u2192";
            const pillStyle = { background: dark, color: "#ffffff" };
            const pill = "mt-5 inline-flex w-fit items-center rounded-full px-5 py-2 text-sm font-bold transition hover:-translate-y-0.5";
            return (
              <div key={n} className={`relative flex items-center justify-between gap-4 overflow-hidden ${ctx.compact ? "min-h-[220px] p-5" : "min-h-[300px] p-8"}`} style={{ background: b.bg || primary, border: `2px solid ${ink}`, borderRadius: "var(--sf-r2)", gridColumn: cardMode && !ctx.compact && list.length % 2 === 1 && n === list.length - 1 ? "1 / -1" : undefined }}>
                {(() => {
                  const pics = [b.image, ...(b.images ?? [])].filter((x, k) => (k === 0 ? true : !!x));
                  /* Three or more pictures on a wide screen: some at the left end, the text in the middle, the rest at the right end */
                  const spread = pics.length >= 3 && !ctx.compact;
                  const many = pics.length > 1;
                  const tilts = [-6, 5, -4, 6];
                  const textBlock = (
                    <div className={`min-w-0 ${spread ? "text-center" : ""}`}>
                      {eyebrow && (
                        <p className={`flex items-center gap-2 font-extrabold ${spread ? "justify-center" : ""}`} style={{ color: b.eyebrowColor || ink, fontSize: scaled(b.eyebrowSize ?? 24, ctx.compact), fontFamily: b.textFont && b.textFont !== "default" ? displayFamily[b.textFont] : undefined }}>
                          {eyebrow}
                        </p>
                      )}
                      {title && <h3 className="mt-1 font-extrabold leading-none" style={{ fontFamily: b.font && b.font !== "default" ? displayFamily[b.font] : "var(--sf-heading)", color: b.titleColor || ink, fontSize: scaled(b.titleSize ?? 64, ctx.compact) }}>{title}</h3>}
                      {text && <p className="mt-2 leading-relaxed" style={{ color: b.textColor || ink, fontSize: b.textSize ?? 15, fontFamily: b.textFont && b.textFont !== "default" ? displayFamily[b.textFont] : undefined }}>{text}</p>}
                      {button &&
                        (go ? (
                          <a {...linkProps(b.link, ctx)} className={pill} style={pillStyle}>{button} {arrow}</a>
                        ) : (
                          <span className={pill} style={pillStyle} onClick={dgo}>{button} {arrow}</span>
                        ))}
                    </div>
                  );
                  /* A group of pictures: they overlap a little and each one is tilted its own way (the first one keeps the card's shape) */
                  const group = (items: string[], from: number) => (
                    <div className="flex shrink-0 items-center" style={{ width: many ? undefined : ctx.compact ? "36%" : "min(38%, 14rem)" }}>
                      {items.map((src, j) => {
                        const k = from + j;
                        return (
                          <div
                            key={k}
                            className="shrink-0 overflow-hidden"
                            style={{
                              width: many ? (ctx.compact ? "5.5rem" : "11rem") : "100%",
                              aspectRatio: "3/4",
                              border: `2px solid ${ink}`,
                              borderRadius: k === 0 && shape === "arch" ? "999px 999px var(--sf-ri) var(--sf-ri)" : "var(--sf-ri)",
                              transform: k === 0 ? (shape === "tilt" || many ? `rotate(${tilts[0]}deg)` : undefined) : `rotate(${tilts[k % tilts.length]}deg)`,
                              marginInlineStart: j === 0 ? 0 : ctx.compact ? "-1.25rem" : "-2.25rem",
                              zIndex: k + 1,
                              background: src ? "#000" : "rgba(255,255,255,0.55)",
                            }}
                          >
                            {src && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt="" className="h-full w-full object-cover" style={k === 0 ? picStyle(b.pos) : undefined} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                  if (spread) {
                    const left = Math.ceil(pics.length / 2);
                    return (
                      <div dir="ltr" className="flex w-full items-center justify-between gap-6">
                        {group(pics.slice(0, left), 0)}
                        <div dir={ctx.lang === "ar" ? "rtl" : "ltr"}>{textBlock}</div>
                        {group(pics.slice(left), left)}
                      </div>
                    );
                  }
                  return (
                    <>
                      {textBlock}
                      {group(pics, 0)}
                    </>
                  );
                })()}
              </div>
            );
          }

          if (rich) {
            /* The text sits on a frosted panel in a corner, so the product in the picture is never covered */
            const dark = b.panel === "dark";
            const family = displayFamily[b.font ?? "default"];
            const small = displayFamily[b.textFont ?? "default"];
            const customPanel = !!b.panelColor && /^#[0-9a-f]{6}$/i.test(b.panelColor);
            const panelStyle = customPanel ? { background: `color-mix(in srgb, ${b.panelColor} 72%, transparent)`, color: onColor(b.panelColor!) === "#ffffff" ? "#f4efe6" : "#2a1f16" } : undefined;
            const btn = `mt-5 inline-flex w-fit items-center rounded-full px-6 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${b.buttonStyle === "outline" ? "border" : "text-white"}`;
            const btnStyle = b.buttonStyle === "outline" ? { color: accent, borderColor: accent } : { background: accent };
            return (
              <div key={n} className={shell} style={bg}>
                {photo}
                <div
                  className={`absolute max-w-[min(80%,24rem)] rounded-[22px] px-8 py-7 backdrop-blur-[8px] ${corner[b.position ?? "top-start"]} ${customPanel ? "" : dark ? "bg-[rgba(18,14,11,.55)] text-[#e9dfcf]" : "bg-[rgba(255,245,248,.72)] text-[#5a3a34]"}`}
                  style={panelStyle}
                >
                  {eyebrow && <p className="text-xs tracking-wide" style={{ fontFamily: small, color: b.eyebrowColor || accent, fontSize: b.textSize ? Math.round(b.textSize * 0.8) : b.textFont && b.textFont !== "default" ? 20 : undefined }}>{eyebrow}</p>}
                  {title && (
                    <h3 className="mt-1 leading-tight" style={{ fontFamily: family, fontWeight: 700, color: b.titleColor || "inherit", fontSize: scaled(b.titleSize ?? 84, ctx.compact) }}>
                      {title}
                    </h3>
                  )}
                  {text && <p className="mt-2 leading-relaxed" style={{ fontFamily: small, color: b.textColor, fontSize: b.textSize ?? (b.textFont && b.textFont !== "default" ? 20 : 15) }}>{text}</p>}
                  {button &&
                    (go ? (
                      <a {...linkProps(b.link, ctx)} className={btn} style={btnStyle}>
                        {button}
                      </a>
                    ) : (
                      <span className={btn} style={btnStyle} onClick={dgo}>
                        {button}
                      </span>
                    ))}
                </div>
              </div>
            );
          }

          return (
            <div key={n} className={shell} style={bg}>
              {photo}
              <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="flex h-full flex-col justify-end p-6 text-white">
                {title && <h3 className="font-extrabold leading-tight drop-shadow" style={{ fontFamily: displayFamily[b.font ?? "default"], color: b.titleColor || "inherit", fontSize: scaled(b.titleSize ?? 84, ctx.compact) }}>{title}</h3>}
                {text && <p className="mt-1.5 max-w-[85%] text-sm leading-relaxed opacity-90">{text}</p>}
                {button &&
                  (go ? (
                    <a {...linkProps(b.link, ctx)} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#12262b] shadow-lg transition hover:-translate-y-0.5">
                      {button}
                      {icons.arrow}
                    </a>
                  ) : (
                    <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#12262b] shadow-lg">
                      {button}
                      {icons.arrow}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Slides({ s, ctx }: { s: Extract<SectionConfig, { type: "slides" }>["settings"]; ctx: Ctx }) {
  const list = (s.slides ?? []).filter((x) => x.image);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const idx = list.length ? i % list.length : 0;
  const seconds = Math.max(2, s.seconds || 5);
  const run = (s.autoplay ?? true) && list.length > 1;
  useEffect(() => {
    if (!run || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setI((v) => v + 1);
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [run, paused, seconds, list.length, i]);
  const go = (dir: 1 | -1) => setI((v) => (v % list.length + dir + list.length) % list.length);

  if (!list.length) {
    /* Only the merchant, in the designer, sees where the pictures will go */
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <div className="grid aspect-[3/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "صور متحركة: أضف صورك أو ملفات GIF من القائمة الجانبية" : "Animated pictures: add your pictures or GIFs from the side panel"}
        </div>
      </section>
    );
  }

  const ratio = ctx.compact ? "aspect-[16/9]" : s.ratio === "standard" ? "aspect-[2/1]" : "aspect-[3/1]";
  const arrow = "absolute top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#12262b] shadow-md backdrop-blur transition hover:scale-105 hover:bg-white";
  return (
    <section className={section(ctx.compact)}>
      <div className={`relative isolate overflow-hidden rounded-[var(--sf-r)] bg-black/5 ${ratio}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {list.map((x, n) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={x.image} alt="" className="h-full w-full object-cover" />
          );
          return (
            <div key={n} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: n === idx ? 1 : 0 }} aria-hidden={n !== idx}>
              {x.link && !ctx.design ? (
                <a {...linkProps(x.link, ctx)} className="block h-full w-full" tabIndex={n === idx ? 0 : -1}>
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
        {list.length > 1 && (
          <>
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(dir);
                }}
                aria-label={dir === -1 ? (ctx.lang === "ar" ? "السابق" : "Previous") : ctx.lang === "ar" ? "التالي" : "Next"}
                className={`${arrow} ${dir === -1 ? "start-3" : "end-3"}`}
              >
                <span className={dir === -1 ? "rotate-180" : ""}>{icons.arrow}</span>
              </button>
            ))}
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {list.map((_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n + 1} / ${list.length}`}
                  aria-current={n === idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setI(n);
                  }}
                  className={`h-2 rounded-full bg-white shadow transition-all ${n === idx ? "w-6 opacity-95" : "w-2 opacity-60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* Example reviews, shown only while styling the store in the designer or the demo store. Never saved. */
const exampleReviews: { name: string; text: string; stars: 1 | 2 | 3 | 4 | 5 }[] = [
  { name: "Khaled A.", text: "Fast delivery and the quality is exactly as described.", stars: 5 },
  { name: "ندى ح.", text: "تجربة شراء سهلة، والمنتج وصل مغلّفًا بعناية.", stars: 5 },
  { name: "Omar S.", text: "Good prices and friendly service. I will order again.", stars: 4 },
];

function Reviews({ s, ctx }: { s: Extract<SectionConfig, { type: "reviews" }>["settings"]; ctx: Ctx }) {
  const items = (s.items ?? []).filter((r) => r.text.trim());
  const shown = items.length ? items : ctx.data.isDemo ? exampleReviews : [];
  const rail = useRef<HTMLDivElement>(null);
  if (!shown.length) return null;
  const slide = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    /* In right-to-left pages scrolling goes the other way */
    el.scrollBy({ left: dir * (ctx.lang === "ar" ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow = "grid h-10 w-10 place-items-center rounded-full bg-white shadow-md ring-1 ring-black/[0.06] transition hover:scale-105";
  return (
    <section className={section(ctx.compact)}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className={`font-extrabold tracking-tight text-[var(--sf-title)] ${ctx.compact ? "text-xl" : "text-2xl"}`}>{s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]}</h2>
        {shown.length > (ctx.compact ? 1 : 3) && (
          <div className="flex gap-2">
            <button type="button" onClick={() => slide(-1)} aria-label={ctx.lang === "ar" ? "السابق" : "Previous"} className={arrow}>
              <span className="rtl:rotate-180">{icons.arrow}</span>
            </button>
            <button type="button" onClick={() => slide(1)} aria-label={ctx.lang === "ar" ? "التالي" : "Next"} className={arrow}>
              <span className="rotate-180 rtl:rotate-0">{icons.arrow}</span>
            </button>
          </div>
        )}
      </div>
      <div ref={rail} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((r, i) => (
          <figure key={i} dir={/[؀-ۿ]/.test(r.text) ? "rtl" : "ltr"} className={`relative shrink-0 snap-start ${card} p-6 ${ctx.compact ? "w-[85%]" : "w-[calc((100%-2rem)/3)]"}`}>
            <svg aria-hidden viewBox="0 0 32 32" className="h-9 w-9 fill-current opacity-30" style={{ color: "var(--sf-primary)" }}>
              <path d="M10 8C6 9.500 4 13 4 17v7h9v-9H8c0-3 1.500-5 4-6L10 8Zm14 0c-4 1.500-6 5-6 9v7h9v-9h-5c0-3 1.500-5 4-6L24 8Z" />
            </svg>
            <blockquote className="mt-3 text-sm leading-relaxed text-[var(--sf-text)]/80">{r.text}</blockquote>
            <div className="mt-4 flex gap-0.5" aria-label={`${r.stars} / 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <svg key={n} viewBox="0 0 24 24" className="h-4 w-4" fill={n <= r.stars ? "#f5b301" : "#e5e7eb"} aria-hidden>
                  <path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" />
                </svg>
              ))}
            </div>
            <figcaption className="mt-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold" style={{ background: "color-mix(in srgb, var(--sf-primary) 14%, white)", color: "var(--sf-primary)" }}>
                {r.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="text-sm font-bold">{r.name}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** A free-text block: a title and a few paragraphs the merchant writes himself. */
function TextBlock({ id, s, ctx }: { id: string; s: Extract<SectionConfig, { type: "text" }>["settings"]; ctx: Ctx }) {
  const other = ctx.lang === "ar" ? "en" : "ar";
  const title = s.title[ctx.lang] || s.title[other];
  const body = s.body[ctx.lang] || s.body[other];
  if (!title && !body) return null;
  const center = s.align === "center";
  /* The statement: a small Latin line, a big title, a line of text, a button and a row of short promises, all in the middle */
  if (s.style === "statement") {
    const pick = (b?: { en: string; ar: string }) => b?.[ctx.lang] || b?.[other] || "";
    const eyebrow = pick(s.eyebrow);
    const button = pick(s.button);
    const trust = (s.trust ?? []).map(pick).filter(Boolean);
    const btn = "inline-flex min-h-[44px] items-center px-9 py-4 text-[15px] font-bold transition hover:opacity-90";
    const btnStyle = { background: "var(--sf-primary)", color: "var(--sf-on)" };
    return (
      <section className={ctx.compact ? "px-4 pt-16" : "px-8 pt-28"}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-[22px] text-center">
          {eyebrow && <Pick ctx={ctx} id={id} field="eyebrow"><p dir="auto" style={{ ...latinItalic, fontSize: 22, color: "var(--sf-accent)" }}>{eyebrow}</p></Pick>}
          {title && <Pick ctx={ctx} id={id} field="title" block><h2 className="font-semibold leading-tight text-[var(--sf-title)]" style={{ fontFamily: "var(--sf-heading)", fontSize: ctx.compact ? 34 : 56 }}>{title}</h2></Pick>}
          {body && <Pick ctx={ctx} id={id} field="body" block><p className="mx-auto max-w-[560px] text-lg font-light leading-[2] text-[var(--sf-text)]/80">{body}</p></Pick>}
          {button && (
            <Pick ctx={ctx} id={id} field="button">
              {s.link?.trim() && !ctx.design ? <a {...linkProps(s.link, ctx)} className={btn} style={btnStyle}>{button}</a> : <span className={btn} style={btnStyle} onClick={designOpen(s.link, ctx)}>{button}</span>}
            </Pick>
          )}
          {trust.length > 0 && (
            <Pick ctx={ctx} id={id} field="trust">
              <ul className={`mt-2 flex flex-wrap items-center justify-center text-sm ${ctx.compact ? "gap-x-4 gap-y-2" : "gap-x-12 gap-y-3"}`} style={{ color: "var(--sf-accent)" }}>
                {trust.map((x, i) => (
                  <Fragment key={i}>
                    {i > 0 && <li aria-hidden className="text-[10px] text-[var(--sf-primary)]">◆</li>}
                    <li>{x}</li>
                  </Fragment>
                ))}
              </ul>
            </Pick>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className={section(ctx.compact)}>
      <div
        className={`rounded-[var(--sf-r)] ${s.tint ? "px-6 py-9 sm:px-12" : ""} ${center ? "text-center" : ""}`}
        style={s.tint ? { background: "color-mix(in srgb, var(--sf-primary) 8%, var(--sf-bg))" } : undefined}
      >
        <div className={center ? "mx-auto max-w-2xl" : "max-w-2xl"}>
          {title && (
            <Pick ctx={ctx} id={id} field="title" block>
              <h2 className={`font-extrabold tracking-tight text-[var(--sf-title)] ${ctx.compact ? "text-xl" : "text-2xl"}`}>{title}</h2>
            </Pick>
          )}
          {body && (
            <Pick ctx={ctx} id={id} field="body" block>
              <div className={`${title ? "mt-3" : ""} space-y-3 text-[15px] leading-relaxed text-[var(--sf-text)]/75`}>
                {body.split("\n").filter((l) => l.trim()).map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </Pick>
          )}
        </div>
      </div>
    </section>
  );
}

function Featured({ s, ctx }: { s: Extract<SectionConfig, { type: "featured" }>["settings"]; ctx: Ctx }) {
  const featured = ctx.data.products.filter((p) => p.featured);
  const items = (featured.length ? featured : ctx.data.products).slice(0, s.count);
  if (!items.length) return null;
  return (
    <section className={section(ctx.compact)}>
      <Heading title={s.title[ctx.lang]} ctx={ctx} more />
      <Grid items={items} ctx={ctx} columns={4} />
    </section>
  );
}

function Discounts({ s, ctx }: { s: Extract<SectionConfig, { type: "discounts" }>["settings"]; ctx: Ctx }) {
  const items = ctx.data.products.filter((p) => p.sale !== null).slice(0, s.count);
  if (!items.length) return null;
  return (
    <section className={section(ctx.compact)}>
      <div className="rounded-[var(--sf-r)] p-5" style={{ background: "color-mix(in srgb, var(--sf-primary) 8%, var(--sf-bg))" }}>
        <Heading title={s.title[ctx.lang]} ctx={ctx} more />
        <Grid items={items} ctx={ctx} columns={4} />
      </div>
    </section>
  );
}

function Products({ s, ctx }: { s: Extract<SectionConfig, { type: "products" }>["settings"]; ctx: Ctx }) {
  const c = copy[ctx.lang];
  const [cat, setCat] = useState("");
  const q = ctx.query.trim().toLowerCase();
  const all = ctx.data.products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));
  /* He chose how many products the section holds; they sit in one row that slides when there are more than fit */
  const items = s.limit ? all.slice(0, s.limit) : all;
  const cols = ctx.compact ? 2 : s.columns;
  const railCtl = useRail(items.length, cols, ctx);

  return (
    <section className={section(ctx.compact)}>
      <Heading title={s.title[ctx.lang]} ctx={ctx} right={items.length > cols ? railCtl.arrows : null} />
      {s.showFilters && ctx.data.categories.length > 0 && (
        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["", ...ctx.data.categories].map((name) => {
            const on = cat === name;
            return (
              <button
                key={name || "all"}
                type="button"
                onClick={() => ctx.interactive && setCat(name)}
                aria-pressed={on}
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${on ? "bg-[var(--sf-primary)] text-[var(--sf-on)] shadow-md" : "bg-white text-[var(--sf-text)]/75 ring-1 ring-black/[0.08] hover:ring-black/20"}`}
              >
                {name || ctx.config.texts.allFilter[ctx.lang] || c.all}
              </button>
            );
          })}
        </div>
      )}

      {items.length ? (
        <Grid items={items} ctx={ctx} columns={s.columns} rail={railCtl} />
      ) : (
        <div className="grid place-items-center py-16 text-center">
          <span className="grid h-24 w-24 place-items-center rounded-full text-[var(--sf-primary)]/70" style={{ background: "color-mix(in srgb, var(--sf-primary) 9%, white)" }}>
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 8h14l-1 12H6L5 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </span>
          {ctx.owner && !q ? (
            /* In the designer the dashboard opens in a new tab, so unsaved design changes are not lost */
            <a
              href="/products"
              target={ctx.design ? "_blank" : undefined}
              rel="noreferrer"
              onClick={(e) => ctx.design && e.stopPropagation()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--sf-primary)] px-6 py-3 text-sm font-extrabold text-[var(--sf-on)] shadow-md transition hover:-translate-y-0.5"
            >
              {icons.plus}
              {c.addHere}
            </a>
          ) : (
            <p className="mt-4 text-sm font-semibold text-[var(--sf-text)]/60">{q ? c.noMatch : ctx.config.texts.noProducts[ctx.lang] || c.noProducts}</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------- Notes ribbon: a dark strip of short words ---------------- */

function Ribbon({ s, ctx }: { s: Extract<SectionConfig, { type: "ribbon" }>["settings"]; ctx: Ctx }) {
  const other = ctx.lang === "ar" ? "en" : "ar";
  const words = (s.items ?? []).map((x) => x[ctx.lang] || x[other]).filter(Boolean);
  if (!words.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <div className="grid h-16 place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "شريط النوتات: أضف كلمات من القائمة الجانبية" : "Notes ribbon: add words from the side panel"}
        </div>
      </section>
    );
  }
  return (
    <section style={{ background: s.background, color: s.color }}>
      <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 tracking-[0.06em] ${ctx.compact ? "px-4 py-3 text-[15px]" : "px-8 py-5 text-[18px]"}`} style={{ fontFamily: "var(--sf-heading)" }}>
        {words.map((w, i) => (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden className="opacity-50">✦</span>}
            <span>{w}</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Chips: colored quick links, each a little tilted ---------------- */

function Chips({ id, s, ctx }: { id: string; s: Extract<SectionConfig, { type: "chips" }>["settings"]; ctx: Ctx }) {
  /* The button being pulled (only in the designer): it follows the mouse, and the others make room as it passes over them */
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const grab = useRef<{ cur: number; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const [dragI, setDragI] = useState<number | null>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const canDrag = !!ctx.design?.reorderChips;
  const other = ctx.lang === "ar" ? "en" : "ar";
  const items = (s.items ?? []).filter((x) => (x.label[ctx.lang] || x.label[other] || "").trim());
  if (!items.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <div className="grid h-16 place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "أزرار ملوّنة: أضف أزرارًا من القائمة الجانبية" : "Colored chips: add chips from the side panel"}
        </div>
      </section>
    );
  }
  const tilt = s.tilt === false ? [0] : [-2, 1.5, -1, 2, -1.5, 1];
  const align = { start: "justify-start", center: "justify-center", end: "justify-end" }[s.align ?? "center"];
  const size = {
    sm: ctx.compact ? "px-4 py-1.5 text-xs" : "px-5 py-2 text-sm",
    md: ctx.compact ? "px-5 py-2 text-sm" : "px-7 py-3 text-base",
    lg: ctx.compact ? "px-6 py-2.5 text-base" : "px-9 py-4 text-xl",
  }[s.size ?? "md"];
  /* A link is a link to another site, or the name of a part of this page */
  const go = (e: React.MouseEvent, link: string) => {
    if (justDragged.current) { e.preventDefault(); justDragged.current = false; return; }
    if (ctx.design) {
      e.preventDefault();
      const to = pageOf(link);
      if (to !== null && (e.ctrlKey || e.metaKey)) ctx.design.openPage?.(to);
      return;
    }
    if (!link.trim()) { e.preventDefault(); return; }
    const pg = pageOf(link);
    if (pg !== null) { e.preventDefault(); ctx.openPage?.(pg); return; }
    if (/^https?:\/\//i.test(link.trim()) || link.includes(".")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).closest(".store-preview")?.querySelector(`[data-sf="${link.trim()}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section className={section(ctx.compact)}>
      <div className={`flex flex-wrap items-center gap-3 ${align}`}>
        {items.map((x, i) => (
          <a
            key={i}
            href={x.link.trim() ? (/^https?:\/\//i.test(x.link.trim()) || x.link.includes(".") ? linkHref(x.link) : `#${x.link.trim()}`) : "#"}
            target={x.link.includes(".") && !ctx.design ? "_blank" : undefined}
            rel="noreferrer"
            onClick={(e) => go(e, x.link)}
            ref={(el) => { refs.current[i] = el; }}
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (!canDrag || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              grab.current = { cur: i, x: e.clientX, y: e.clientY, moved: false };
            }}
            onPointerMove={(e) => {
              const g = grab.current;
              const el = g && refs.current[g.cur];
              if (!g || !el) return;
              const dx = e.clientX - g.x;
              const dy = e.clientY - g.y;
              if (!g.moved && Math.hypot(dx, dy) < 5) return;
              g.moved = true;
              /* the store may be shown smaller than it is: the move is in the store's own pixels */
              const scale = el.getBoundingClientRect().width / el.offsetWidth || 1;
              setDragI(g.cur);
              setOff({ x: dx / scale, y: dy / scale });
              const over = refs.current.findIndex((r, j) => {
                if (j === g.cur || !r) return false;
                const b = r.getBoundingClientRect();
                return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
              });
              if (over >= 0) {
                ctx.design?.reorderChips?.(id, g.cur, over);
                g.cur = over;
                g.x = e.clientX;
                g.y = e.clientY;
                setDragI(over);
                setOff({ x: 0, y: 0 });
              }
            }}
            onPointerUp={() => {
              if (grab.current?.moved) justDragged.current = true;
              grab.current = null;
              setDragI(null);
              setOff({ x: 0, y: 0 });
            }}
            onPointerCancel={() => {
              grab.current = null;
              setDragI(null);
              setOff({ x: 0, y: 0 });
            }}
            className={`border-2 border-[var(--sf-text)] font-bold text-[var(--sf-text)] ${dragI === i ? "" : "transition hover:-translate-y-0.5"} ${size} ${canDrag ? "touch-none select-none cursor-grab active:cursor-grabbing" : ""}`}
            style={{ borderRadius: "var(--sf-pill)", background: x.color, transform: dragI === i ? `translate(${off.x}px, ${off.y}px) rotate(${tilt[i % tilt.length]}deg) scale(1.06)` : `rotate(${tilt[i % tilt.length]}deg)`, zIndex: dragI === i ? 30 : undefined, boxShadow: dragI === i ? "0 10px 24px rgba(0,0,0,0.25)" : undefined, position: dragI === i ? "relative" : undefined }}
          >
            {x.label[ctx.lang] || x.label[other]}
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Newsletter: a dark block with an email field. The emails are kept in this browser (the prototype has no mail service). ---------------- */

const SUBSCRIBERS = "seen-subscribers";

/** The emails people left in the newsletter block */
export function readSubscribers(): { email: string; at: number }[] {
  try {
    const list = JSON.parse(localStorage.getItem(SUBSCRIBERS) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveSubscriber(email: string) {
  try {
    const list = readSubscribers();
    if (!list.some((x) => x.email.toLowerCase() === email.toLowerCase())) localStorage.setItem(SUBSCRIBERS, JSON.stringify([...list, { email, at: Date.now() }]));
  } catch {
    /* storage unavailable */
  }
}

function Newsletter({ id, s, ctx }: { id: string; s: Extract<SectionConfig, { type: "newsletter" }>["settings"]; ctx: Ctx }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  /* The pop-up after subscribing (when the merchant chose it): in the designer pressing the button shows it, to see and adjust it */
  const [pop, setPop] = useState(false);
  const l = ctx.lang;
  const other = l === "ar" ? "en" : "ar";
  const pick = (b?: { en: string; ar: string }) => b?.[l] || b?.[other] || "";
  const pp = s.popup;
  const popTitle = pick(pp?.title) || (l === "ar" ? "شكرًا لانضمامك!" : "You are in!");
  const popText = pick(pp?.text) || pick(s.thanks);
  const popButton = pick(pp?.button) || (l === "ar" ? "تمام" : "Great");
  const title = pick(s.title);
  const accent = pick(s.accentWord);
  /* The accent word is shown in the accent color wherever it appears in the title */
  const at = accent ? title.indexOf(accent) : -1;
  const on = onColor(s.background || "#2b1b47") === "#ffffff" ? "#ffffff" : "#1c1a17";
  return (
    <section className={`relative ${section(ctx.compact)}`}>
      <div className={`flex gap-6 ${ctx.compact ? "flex-col p-6" : "items-center justify-between px-10 py-8"}`} style={{ background: s.background, color: on, borderRadius: "var(--sf-r2)" }}>
        <div className="min-w-0">
          <Pick ctx={ctx} id={id} field="title" block>
            <h2 className="font-extrabold leading-tight" style={{ fontFamily: "var(--sf-heading)", fontSize: scaled(36, ctx.compact) }}>
              {at >= 0 ? (
                <>
                  {title.slice(0, at)}
                  <span style={{ color: s.accent }}>{accent}</span>
                  {title.slice(at + accent.length)}
                </>
              ) : (
                title
              )}
            </h2>
          </Pick>
          <Pick ctx={ctx} id={id} field="text" block>
            <p className="mt-2 text-sm opacity-80">{pick(s.text)}</p>
          </Pick>
        </div>
        {done ? (
          <p className="font-bold" style={{ color: s.accent }}>{pick(s.thanks)}</p>
        ) : (
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ctx.design) {
                if (s.after === "popup") setPop(true);
                return;
              }
              if (!ctx.interactive || !email.trim()) return;
              saveSubscriber(email.trim());
              if (s.after === "popup") {
                setPop(true);
                setEmail("");
                return;
              }
              setDone(true);
              /* "Go to...": after the thank-you, the visitor is taken where the merchant chose (a store page, a part of the page or a web address) */
              if (s.after === "link" && s.link?.trim()) {
                const lp = linkProps(s.link, ctx);
                if (lp.onClick) lp.onClick({ preventDefault() {} } as React.MouseEvent<HTMLAnchorElement>);
                else if (lp.href) window.open(lp.href, "_blank", "noreferrer");
              }
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={pick(s.placeholder)}
              aria-label={pick(s.placeholder)}
              className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-sm text-[#1c1a17] outline-none placeholder:text-[#1c1a17]/50"
            />
            <button type="submit" className="h-12 shrink-0 rounded-full px-6 text-sm font-extrabold text-[#1c1a17] transition hover:-translate-y-0.5" style={{ background: s.buttonColor }}>
              {pick(s.button)}
            </button>
          </form>
        )}
      </div>
      {pop && (
        /* A real pop-up on the store; in the designer it sits over the block itself, so it is seen where it is edited */
        <div className={`${ctx.design ? "absolute" : "fixed"} inset-0 z-50 grid place-items-center bg-black/55 p-4`} role="dialog" aria-modal="true" aria-label={popTitle} onClick={(e) => { e.stopPropagation(); setPop(false); }}>
          <div className="relative w-full max-w-md overflow-hidden text-center" onClick={(e) => e.stopPropagation()} style={{ background: pp?.background || "#ffffff", color: onColor(pp?.background || "#ffffff") === "#ffffff" ? "#ffffff" : "#1c1a17", border: "2px solid var(--sf-text)", borderRadius: "var(--sf-r2)", boxShadow: "6px 6px 0 var(--sf-text)" }}>
            <button type="button" onClick={() => setPop(false)} aria-label={copy[l].close} className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-[#1c1a17] transition hover:scale-105">
              {icons.close}
            </button>
            {pp?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pp.image} alt="" className="h-44 w-full object-cover" />
            )}
            <div className="px-8 pb-8 pt-9">
              <h3 className="text-3xl font-extrabold leading-tight" style={{ fontFamily: "var(--sf-heading)" }}>{popTitle}</h3>
              <p className="mt-3 text-base leading-relaxed opacity-85">{popText}</p>
              <button type="button" onClick={() => setPop(false)} className="mt-6 h-12 rounded-full px-8 text-sm font-extrabold text-[#1c1a17] transition hover:-translate-y-0.5" style={{ background: pp?.accent || s.buttonColor, border: "2px solid var(--sf-text)" }}>
                {popButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** A whole section: a teal outline and its name appear on hover, and a click selects it. */
function Selectable({ id, name, ctx, children }: { id: string; name: string; ctx: Ctx; children: React.ReactNode }) {
  if (!ctx.design) return <>{children}</>;
  const d = ctx.design;
  const on = d.selected === id;
  return (
    <div className="group/sel relative cursor-pointer" onClick={() => d.select(id)}>
      {children}
      <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-[var(--sf-r)] ring-2 ring-[#14b8a6] transition ${on ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />
      <span aria-hidden className={`pointer-events-none absolute start-3 top-0 z-10 -translate-y-1/2 rounded-md bg-[#14b8a6] px-2.5 py-1 text-[11px] font-bold text-white shadow transition ${on ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`}>{name}</span>
    </div>
  );
}

const sectionNames = {
  en: { hero: "Hero banner", perks: "Store perks", featured: "Featured products", discounts: "Deals", products: "Product grid", text: "Free text", reviews: "Customer reviews", collection: "Pinned products", slides: "Animated pictures", tiles: "Picture tiles", banners: "Promo banners", ribbon: "Notes ribbon", chips: "Colored chips", newsletter: "Newsletter" },
  ar: { hero: "الغلاف الرئيسي", perks: "مزايا المتجر", featured: "منتجات مميزة", discounts: "التخفيضات", products: "شبكة المنتجات", text: "نص حر", reviews: "آراء العملاء", collection: "منتجات ثابتة", slides: "صور متحركة", tiles: "معرض صور", banners: "بنرات ترويجية", ribbon: "شريط النوتات", chips: "أزرار ملوّنة", newsletter: "النشرة البريدية" },
};

export function renderSection(s: SectionConfig, ctx: Ctx) {
  if (!s.visible) return null;
  const inner = (() => {
    switch (s.type) {
      case "hero":
        return <Hero id={s.id} s={s.settings} ctx={ctx} />;
      case "perks":
        return <Perks s={s.settings} ctx={ctx} />;
      case "featured":
        return <Featured s={s.settings} ctx={ctx} />;
      case "discounts":
        return <Discounts s={s.settings} ctx={ctx} />;
      case "products":
        return <Products s={s.settings} ctx={ctx} />;
      case "slides":
        return <Slides s={s.settings} ctx={ctx} />;
      case "tiles":
        return <Tiles s={s.settings} ctx={ctx} />;
      case "banners":
        return <Banners s={s.settings} ctx={ctx} />;
      case "ribbon":
        return <Ribbon s={s.settings} ctx={ctx} />;
      case "chips":
        return <Chips id={s.id} s={s.settings} ctx={ctx} />;
      case "newsletter":
        return <Newsletter id={s.id} s={s.settings} ctx={ctx} />;
      case "collection":
        return <Collection s={s.settings} ctx={ctx} />;
      case "reviews":
        return <Reviews s={s.settings} ctx={ctx} />;
      case "text":
        return <TextBlock id={s.id} s={s.settings} ctx={ctx} />;
    }
  })();
  return (
    <div key={s.id} data-sf={s.id} className="scroll-mt-20">
      <Selectable id={s.id} name={sectionNames[ctx.lang][s.type]} ctx={ctx}>
        {inner}
      </Selectable>
    </div>
  );
}
