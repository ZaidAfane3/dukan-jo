"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { displayFamily, heroTitleFamily, type SectionConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, money, onColor, priceOf, ProductImage } from "./parts";
import type { StoreData, StoreProduct } from "./useStoreData";

/* Set only inside the store designer: clicking a part of the store selects it for editing. */
export type Design = { selected: string | null; select: (id: string, field?: string) => void; /* clicking a product's picture opens its picture editor */ selectProduct?: (p: StoreProduct) => void };

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
};

/* A size set on a wide screen, made smaller for a phone (big titles shrink more than small texts) */
const scaled = (px: number, compact: boolean) => (compact ? (px > 40 ? Math.round(px * 0.55) : Math.round(px * 0.85)) : px);

/* A link a visitor may follow: "shop.com" becomes "https://shop.com" */
const linkHref = (l: string) => (/^https?:\/\//i.test(l.trim()) ? l.trim() : `https://${l.trim()}`);

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

function Heading({ title, ctx, more }: { title: string; ctx: Ctx; more?: boolean }) {
  const c = copy[ctx.lang];
  const viewAll = ctx.config.texts.viewAll[ctx.lang] || c.viewAll;
  const light = ctx.config.theme.titleStyle === "light";
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2
        className={`tracking-tight text-[var(--sf-title)] ${light ? "font-light leading-tight" : "font-extrabold"}`}
        style={{ fontFamily: "var(--sf-heading)", fontSize: scaled(ctx.config.theme.sectionTitleSize ?? (light ? 34 : 24), ctx.compact) }}
      >
        {title}
      </h2>
      {more &&
        (light ? (
          <span className="border-b border-current pb-0.5 text-sm text-[var(--sf-text)]">{viewAll}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sf-title)]">
            {viewAll}
            {icons.arrow}
          </span>
        ))}
    </div>
  );
}

/* ---------------- Product card ---------------- */

function ProductCard({ p, ctx }: { p: StoreProduct; ctx: Ctx }) {
  const c = copy[ctx.lang];
  const [liked, setLiked] = useState(false);
  const inBasket = ctx.qty[p.id] ?? 0;
  const off = p.sale !== null && p.price ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const out = p.quantity <= 0;
  const k = ctx.config.cards;
  const ratio = { portrait: "aspect-[4/5]", square: "aspect-square", wide: "aspect-[4/3]" }[k.image ?? "portrait"];
  const look = {
    shadow: `${card} p-2.5 hover:shadow-[0_18px_40px_-18px_rgba(18,38,43,0.35)]`,
    outline: "rounded-[var(--sf-r)] bg-white p-2.5 ring-1 ring-black/15",
    flat: "rounded-[var(--sf-r)] bg-transparent p-0",
  }[k.style ?? "shadow"];
  const low = k.showStock && p.quantity > 0 && p.quantity <= 5;
  const row = (k.info ?? "stack") === "row";

  return (
    <article onClick={(e) => { if (ctx.design) { e.stopPropagation(); ctx.design.select("cards"); } }} className={`group relative overflow-hidden transition duration-300 hover:-translate-y-1 ${look} ${ctx.design ? "cursor-pointer" : ""}`}>
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: "calc(var(--sf-r) - 8px)" }}
        onClick={(e) => {
          /* In the designer, the picture itself opens the editor for which part of it stays visible */
          if (ctx.design?.selectProduct && p.image) {
            e.stopPropagation();
            ctx.design.selectProduct(p);
          }
        }}
      >
        <ProductImage p={p} className={`${ratio} w-full transition duration-500 group-hover:scale-[1.04]`} />
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
        {k.showHeart && <button
          type="button"
          onClick={() => ctx.interactive && setLiked((v) => !v)}
          aria-label={c.like}
          aria-pressed={liked}
          className={`absolute end-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow backdrop-blur transition ${liked ? "text-rose-500" : "text-[var(--sf-text)]/60 hover:text-rose-500"}`}
        >
          <span className={liked ? "[&_path]:fill-current" : ""}>{icons.heart}</span>
        </button>}
        {out && !k.showAdd && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-xs font-semibold text-white">{c.soldOut}</span>}
      </div>

      <div className="px-1.5 pb-1.5 pt-3">
       <div className={row ? "flex items-start justify-between gap-3" : ""}>
        <div className="min-w-0">
        {p.category && k.showCategory && <p className="text-xs text-[var(--sf-text)]/55">{p.category}</p>}
        {k.showName && <h3 className="mt-0.5 line-clamp-1 text-sm font-bold">{p.name}</h3>}
        {k.showNotes && p.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--sf-text)]/60">{p.notes}</p>}
        {low && <p className="mt-0.5 text-xs font-semibold text-amber-600">{ctx.lang === "ar" ? `بقي ${p.quantity} فقط` : `Only ${p.quantity} left`}</p>}
        </div>
        {k.showPrice && (
          <p dir="ltr" className={`${row ? "mt-0.5 shrink-0" : "mt-3"} flex items-baseline gap-1.5 text-start`}>
            {p.price === null ? (
              <span className="text-sm text-[var(--sf-text)]/55">{ctx.lang === "ar" ? "بدون سعر" : "No price"}</span>
            ) : (
              <>
                <span className="text-base font-extrabold">{money(priceOf(p))}</span>
                <span className="text-[11px] font-semibold text-[var(--sf-text)]/60">{currency(ctx.lang)}</span>
                {p.sale !== null && k.showOldPrice && <s className="text-xs text-[var(--sf-text)]/45">{money(p.price)}</s>}
              </>
            )}
          </p>
        )}
       </div>

        {/* Add to cart. Once the product is in the basket the button turns into  -  1  +  */}
        {k.showAdd && (inBasket > 0 && !out ? (
          <div dir="ltr" className="mt-3 flex h-11 w-full items-center justify-between overflow-hidden rounded-xl border border-[var(--sf-primary)] bg-[var(--sf-primary)] text-[var(--sf-on)]">
            <button
              type="button"
              onClick={() => ctx.interactive && ctx.setQty(p, inBasket - 1)}
              aria-label={`${ctx.lang === "ar" ? "إنقاص" : "Remove one"}: ${p.name}`}
              className="grid h-full w-12 place-items-center text-xl font-bold transition hover:bg-black/15 active:scale-95"
            >
              −
            </button>
            <span aria-live="polite" className="text-sm font-extrabold tabular-nums">{inBasket}</span>
            <button
              type="button"
              disabled={inBasket >= p.quantity}
              onClick={() => ctx.interactive && ctx.setQty(p, inBasket + 1)}
              aria-label={`${ctx.lang === "ar" ? "زيادة" : "Add one more"}: ${p.name}`}
              className="grid h-full w-12 place-items-center text-xl font-bold transition hover:bg-black/15 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={out || p.price === null}
            onClick={() => ctx.interactive && ctx.setQty(p, 1)}
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

function Grid({ items, ctx, columns }: { items: StoreProduct[]; ctx: Ctx; columns: number }) {
  const cols = ctx.compact ? 2 : columns;
  return (
    <div className={`grid ${ctx.compact ? "gap-3" : "gap-5"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((p) => (
        <ProductCard key={p.id} p={p} ctx={ctx} />
      ))}
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
                <button type="button" style={{ fontSize: sz("button", 15), color: s.colors?.button }} className={`inline-flex items-center gap-2 rounded-full px-9 py-4 font-semibold shadow-md transition hover:-translate-y-0.5 ${solid}`}>
                  {s.button[l]}
                </button>
              </Pick>
              {button2 && (
                <Pick ctx={ctx} id={id} field="button2">
                  <button type="button" style={{ fontSize: sz("button", 15), color: s.colors?.button }} className="inline-flex items-center gap-2 rounded-full border border-current px-[30px] py-[15px] font-medium transition hover:-translate-y-0.5">
                    {button2}
                  </button>
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
            <div className="mt-7"><Pick ctx={ctx} id={id} field="button"><button type="button" style={{ fontSize: sz("button", 14), color: s.colors?.button }} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-extrabold text-[#12262b] shadow-lg transition hover:-translate-y-0.5">
              {s.button[ctx.lang]}
              {icons.arrow}
            </button></Pick></div>
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
  return (
    <section className={section(ctx.compact)}>
      <Heading title={s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]} ctx={ctx} more />
      <Grid items={items} ctx={ctx} columns={s.columns} />
    </section>
  );
}

/** Animated pictures: his own pictures or GIFs, one at a time, with arrows, dots and optional links. */
/* ---------------- Picture tiles ---------------- */

function Tiles({ s, ctx }: { s: Extract<SectionConfig, { type: "tiles" }>["settings"]; ctx: Ctx }) {
  const list = (s.items ?? []).filter((x) => x.image);
  const other = ctx.lang === "ar" ? "en" : "ar";
  const title = s.title?.[ctx.lang] || s.title?.[other] || "";
  const editorial = s.style === "editorial";
  const watermark = ctx.config.texture.watermark[ctx.lang] || ctx.config.texture.watermark[other];
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
  return (
    <section className={`relative isolate ${section(ctx.compact)}`}>
      {/* A big word behind the tiles, in the accent color */}
      {watermark && !ctx.compact && (
        <span aria-hidden className="pointer-events-none absolute -top-8 end-6 -z-10 select-none leading-none" style={{ fontFamily: displayFamily.ruqaa, fontSize: "clamp(120px, 18vw, 260px)", color: "var(--sf-accent)", opacity: 0.07 }}>
          {watermark}
        </span>
      )}
      {title && <Heading title={title} ctx={ctx} more={editorial} />}
      <div className={`grid ${editorial ? "gap-5" : "gap-4"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((x, n) => {
          const label = x.label?.[ctx.lang] || x.label?.[other] || "";
          const dark = x.chip === "dark";
          const body = (
            <div className={`group relative overflow-hidden bg-black/5 ${editorial ? `rounded-[4px] ${ctx.compact ? "h-[200px]" : "h-[260px]"}` : "aspect-[4/5] rounded-[var(--sf-r)]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.image} alt={label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
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
            <a key={n} href={linkHref(x.link)} target="_blank" rel="noreferrer" className="block">
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
  const cols = ctx.compact ? 1 : Math.min(list.length, 3);
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
          const rich = b.panel === "light" || b.panel === "dark";
          const accent = b.accent || "var(--sf-accent)";
          const sizeClass = tall ? (ctx.compact ? "h-[420px]" : "h-[600px]") : ctx.compact ? "aspect-[4/3]" : ratio;
          const photo = b.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          );
          const shell = `relative isolate overflow-hidden rounded-[var(--sf-r)] ${sizeClass}`;
          const bg = { background: b.image ? "#000" : `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, #6fe3cf))` };

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
                      <a href={linkHref(b.link)} target="_blank" rel="noreferrer" className={btn} style={btnStyle}>
                        {button}
                      </a>
                    ) : (
                      <span className={btn} style={btnStyle}>
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
                {title && <h3 className="text-2xl font-extrabold leading-tight drop-shadow" style={{ fontFamily: displayFamily[b.font ?? "default"] }}>{title}</h3>}
                {text && <p className="mt-1.5 max-w-[85%] text-sm leading-relaxed opacity-90">{text}</p>}
                {button &&
                  (go ? (
                    <a href={linkHref(b.link)} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#12262b] shadow-lg transition hover:-translate-y-0.5">
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
                <a href={/^https?:\/\//i.test(x.link) ? x.link : `https://${x.link}`} target="_blank" rel="noreferrer" className="block h-full w-full" tabIndex={n === idx ? 0 : -1}>
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
  const items = s.limit ? all.slice(0, s.limit) : all;

  return (
    <section className={section(ctx.compact)}>
      <Heading title={s.title[ctx.lang]} ctx={ctx} />
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
        <Grid items={items} ctx={ctx} columns={s.columns} />
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
  en: { hero: "Hero banner", perks: "Store perks", featured: "Featured products", discounts: "Deals", products: "Product grid", text: "Free text", reviews: "Customer reviews", collection: "Pinned products", slides: "Animated pictures", tiles: "Picture tiles", banners: "Promo banners", ribbon: "Notes ribbon" },
  ar: { hero: "الغلاف الرئيسي", perks: "مزايا المتجر", featured: "منتجات مميزة", discounts: "التخفيضات", products: "شبكة المنتجات", text: "نص حر", reviews: "آراء العملاء", collection: "منتجات ثابتة", slides: "صور متحركة", tiles: "معرض صور", banners: "بنرات ترويجية", ribbon: "شريط النوتات" },
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
