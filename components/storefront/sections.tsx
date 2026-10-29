"use client";

import { UNLIMITED_STOCK, visitorEmail } from "../safeOrder";
import type { FreeDelivery } from "../freeDeliveryStore";
import { cloneElement, Fragment, isValidElement, memo, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { suggestFor } from "./Cart";
import { displayFamily, heroTitleFamily, type ProductPageStyle, type SectionConfig, type TextStyle, type StorefrontConfig } from "./config";
import { copy, currency, icons, moneyIn, onColor, picFill, picStyle, priceLang, priceOf, ProductImage } from "./parts";
import type { StoreData, StoreProduct } from "./useStoreData";
import { isBlank } from "../safe";

/* Set only inside the store designer: clicking a part of the store selects it for editing. */
export type Design = { selected: string | null; select: (id: string, field?: string) => void; /* clicking a product's picture opens its picture editor */ selectProduct?: (p: StoreProduct) => void; /* dragging a colored button in the page moves it to another place in its row */ reorderChips?: (sectionId: string, from: number, to: number) => void; /* a button that leads to a page of the store shows that page in the preview (null: back to the home page) */ openPage?: (id: number | null) => void };

export type Ctx = {
  lang: Lang;
  compact: boolean;
  /* Only what the sections use, so that a change elsewhere (the name, the footer, another section) does not draw every section again */
  data: Pick<StoreData, "products" | "categories" | "color" | "isDemo">;
  config: Pick<StorefrontConfig, "theme" | "texts" | "cards">;
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

/* How a text sits and looks when the merchant set it in its editor: right, center or left (the box moves too), bold, italic */
const tx = (st?: TextStyle): React.CSSProperties =>
  st
    ? {
        ...(st.align ? { textAlign: st.align, marginLeft: st.align === "left" ? 0 : "auto", marginRight: st.align === "right" ? 0 : "auto" } : {}),
        ...(st.bold === undefined ? {} : { fontWeight: st.bold ? 800 : 400 }),
        ...(st.italic ? { fontStyle: "italic" } : {}),
      }
    : {};

/* A link a visitor may follow: "shop.com" becomes "https://shop.com" */
const linkHref = (l: string) => (/^https?:\/\//i.test(l.trim()) ? l.trim() : `https://${l.trim()}`);

/* The ways a merchant writes the dinar: in Latin letters (JOD, JD, dinars, Jordanian dinar) and in Arabic (د.أ, دينار, دنانير, دينار أردني, دينارًا).
   Both check their neighbours by hand (\b knows no Arabic letters, and "23JOD" has no word edge); the letter before is kept, with a space after a digit. */
const latinDinar = /(^|[^A-Za-z])(?:Jordanian\s+)?(?:JOD|JD|dinars?)(?![A-Za-z])/gi;
const arabicDinar = /(^|[^ء-ي])(?:(?:دينار|دنانير)(?:ًا|ا)?(?:\s+أردني(?:ة|ًا|ا)?)?|د\s?\.\s?[أا])(?![ء-ي])/g;

/* A price the merchant wrote himself ("290 JOD", "٢٩٠ د.أ", "٢٣ دينار"): its digits and currency follow the store's price setting like every other price.
   Every way of writing the dinar, in either language, becomes the store's own: د.أ on Arabic prices, JOD on English ones. */
const dinarAs = (cur: string) => (_: string, before: string) => `${before}${/[0-9٠-٩]/.test(before) ? " " : ""}${cur}`;
const writtenPrice = (text: string, ctx: Ctx) => {
  const ar = priceLang(ctx.config.theme.prices, ctx.lang) === "ar";
  return ar
    ? text.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]).replace(/([٠-٩]),(?=[٠-٩])/g, "$1٬").replace(/([٠-٩])\.(?=[٠-٩])/g, "$1٫").replace(latinDinar, dinarAs(currency("ar"))).replace(arabicDinar, dinarAs(currency("ar")))
    : text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٬/g, ",").replace(/٫/g, ".").replace(arabicDinar, dinarAs(currency("en"))).replace(latinDinar, dinarAs(currency("en")));
};
/* It reads in its own direction, so "23 JOD" stays in that order on an Arabic page (and "٢٣ د.أ" on an English one) */
const WrittenPrice = ({ text, ctx }: { text: string; ctx: Ctx }) => <bdi dir={priceLang(ctx.config.theme.prices, ctx.lang) === "ar" ? "rtl" : "ltr"}>{writtenPrice(text, ctx)}</bdi>;

/* How light a hex color is (0 black … 1 white); below about 0.18 white text reads better on it than dark text */
const luminance = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

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

/* Whether a part shows nothing at all: no words (spaces do not count) and no picture or icon. A component counts by the children it is given. */
const media = new Set(["img", "svg", "video", "picture", "canvas", "iframe", "input", "textarea", "select"]);
const blank = (n: React.ReactNode): boolean => {
  if (n === null || n === undefined || typeof n === "boolean") return true;
  /* spaces, zero-width and direction marks alone are no text either */
  if (typeof n === "string") return isBlank(n);
  if (typeof n === "number" || typeof n === "bigint") return false;
  if (Array.isArray(n)) return n.every(blank);
  if (!isValidElement(n)) return false;
  const props = n.props as { children?: React.ReactNode; dangerouslySetInnerHTML?: unknown };
  if (typeof n.type === "string" && media.has(n.type)) return false;
  if (props.dangerouslySetInnerHTML) return false;
  if (typeof n.type !== "string" && n.type !== Fragment && !("children" in props)) return false;
  return blank(props.children);
};
/* The faint words an emptied text shows in the designer, so there is still something to click to write it again */
const emptyHint: Record<string, { en: string; ar: string }> = {
  title: { en: "Add a title", ar: "أضف عنوانًا" },
  subtitle: { en: "Add a short line", ar: "أضف سطرًا قصيرًا" },
  eyebrow: { en: "Add a small line", ar: "أضف سطرًا صغيرًا" },
  button: { en: "Add the button words", ar: "أضف نص الزر" },
  button2: { en: "Add the button words", ar: "أضف نص الزر" },
  body: { en: "Add some text", ar: "أضف نصًا" },
  text: { en: "Add some text", ar: "أضف نصًا" },
};

/** In the designer, a part of the store that can be clicked to edit it. Elsewhere it is just its children.
    In the designer an emptied text keeps its place with a faint hint in its own font and size; the store itself shows nothing. */
export function Pick({ ctx, id, field, children, block = false }: { ctx: Ctx; id: string; field?: string; children: React.ReactNode; block?: boolean }) {
  if (!ctx.design) return <>{children}</>;
  const d = ctx.design;
  if (blank(children)) {
    const hint = <span data-sf-empty className="opacity-40">{(emptyHint[field ?? ""] ?? { en: "Add text", ar: "أضف نصًا" })[ctx.lang]}</span>;
    /* the hint goes inside the emptied element (a title, a button) so it takes that element's look; a bare text gets the hint alone */
    children = isValidElement(children) && children.type !== Fragment ? cloneElement(children as React.ReactElement<{ children?: React.ReactNode }>, undefined, hint) : hint;
  }
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
  /* A title of only spaces: the store shows no heading, the designer a faint hint in its place (something to click) */
  const empty = isBlank(title);
  if (empty && !ctx.design && !more && !link && !right) return null;
  const words = empty ? ctx.design ? <span data-sf-empty className="opacity-40">{emptyHint.title[ctx.lang]}</span> : null : title;
  /* The ornament style: three small diamonds above a centered title; with "view all" the title sits at the start and the link at the end */
  if (ctx.config.theme.titleStyle === "ornament") {
    const size = scaled(ctx.config.theme.sectionTitleSize ?? 44, ctx.compact);
    const h2 = <h2 className="font-semibold leading-tight text-[var(--sf-title)] [overflow-wrap:anywhere]" style={{ fontFamily: "var(--sf-heading)", fontSize: size }}>{words}</h2>;
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
  const center = ctx.config.theme.titleAlign === "center";
  return (
    <div className={center ? "mb-5 flex flex-col items-center gap-2 text-center" : "mb-5 flex items-end justify-between gap-4"}>
      <h2
        className={`tracking-tight text-[var(--sf-title)] [overflow-wrap:anywhere] ${light ? "font-light leading-tight" : pop ? "font-extrabold leading-tight" : "font-extrabold"}`}
        style={{ fontFamily: "var(--sf-heading)", fontSize: scaled(ctx.config.theme.sectionTitleSize ?? (light ? 34 : pop ? 44 : 24), ctx.compact) }}
      >
        {words}
      </h2>
      {more &&
        (() => {
          /* "view all": a real link on the store when he set where it leads; in the designer a click selects (Ctrl+click opens a page) */
          const cls = pop ? "border-b-[3px] pb-0.5 text-sm font-bold text-[var(--sf-text)]" : light ? "border-b border-current pb-0.5 text-sm text-[var(--sf-text)]" : "inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sf-title)]";
          const style: React.CSSProperties | undefined = pop ? { borderColor: "var(--sf-accent)" } : undefined;
          const inner = pop || light ? viewAll : <>{viewAll}{icons.arrow}</>;
          return link?.trim() && !ctx.design ? (
            <a {...linkProps(link, ctx)} className={`${cls} transition hover:opacity-70`} style={style}>{inner}</a>
          ) : (
            <span className={cls} style={style} onClick={designOpen(link, ctx)}>{inner}</span>
          );
        })()}
      {right}
    </div>
  );
}

/* ---------------- Product card ---------------- */

/* A discounted price shows in his sale color, when he picked one */
const saleTint = (ctx: Ctx, p: StoreProduct): React.CSSProperties | undefined => (p.sale !== null && ctx.config.theme.saleColor ? { color: "var(--sf-sale)" } : undefined);

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
  /* the add-to-cart button (or the + button) shows unless he turned it off; the product page keeps its own */
  const withAdd = k.showAdd ?? true;
  const plus = withAdd && k.add === "plus";
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
        style={{ borderRadius: pop ? "var(--sf-ri)" : k.style === "flat" ? "var(--sf-r)" : "calc(var(--sf-r) - 8px)" }}
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
              <span className="absolute start-2.5 top-2.5 rounded-full bg-[var(--sf-sale)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--sf-onsale)] shadow">
                -{off}%
              </span>
            )
          ))}
      </div>

      <div className={`relative px-1.5 pb-1.5 ${centered ? "pt-4 text-center" : "pt-3"}`}>
       <div className={`${row ? "flex items-start justify-between gap-3" : ""} ${plus ? (inBasket > 0 && !out ? "pe-[6.75rem]" : "pe-11") : ""}`}>
        <div className="min-w-0">
        {p.category && k.showCategory && <p className="text-xs text-sf-text/55">{p.category}</p>}
        {k.showName && (centered ? (
          <h3 className="line-clamp-1 font-semibold" style={{ fontFamily: "var(--sf-heading)", fontSize: ctx.compact ? 18 : 22 }}>{p.name}</h3>
        ) : (
          <h3 className={`mt-0.5 text-sm font-bold ${plus && inBasket > 0 ? "line-clamp-2" : "line-clamp-1"}`}>{p.name}</h3>
        ))}
        {k.showNotes && p.notes && <p className="mt-0.5 line-clamp-1 text-[13px] text-sf-text/60">{p.notes}</p>}
        {low && <p className="mt-0.5 text-xs font-semibold text-amber-600">{ctx.lang === "ar" ? `بقي ${p.quantity} فقط` : `Only ${p.quantity} left`}</p>}
        </div>
        {k.showPrice && (
          <p dir="ltr" className={`${row ? "mt-0.5 shrink-0" : centered ? "mt-2 justify-center" : pop ? "mt-1 w-fit" : plus ? "mt-3 w-fit" : "mt-3"} flex items-baseline gap-1.5 text-start`} style={{ ...(k.priceColor ? { color: k.priceColor } : {}), ...(centered ? { fontFamily: "var(--sf-heading)" } : {}) }}>
            {p.price === null ? (
              <span className="text-sm text-sf-text/55">{ctx.lang === "ar" ? "بدون سعر" : "No price"}</span>
            ) : (
              <>
                <span className={centered ? "text-xl font-bold" : "text-base font-extrabold"} style={saleTint(ctx, p)}>{moneyIn(priceOf(p), priceLang(ctx.config.theme.prices, ctx.lang))}</span>
                <span className="text-[11px] font-semibold text-sf-text/60">{currency(priceLang(ctx.config.theme.prices, ctx.lang))}</span>
                {p.sale !== null && k.showOldPrice && <s className="text-xs text-sf-text/45">{moneyIn(p.price, priceLang(ctx.config.theme.prices, ctx.lang))}</s>}
              </>
            )}
          </p>
        )}
       </div>

        {/* Add to cart. Once the product is in the basket the button turns into  -  1  +  (both follow the store's corners: round, soft or sharp) */}
        {plus && (
          inBasket > 0 && !out ? (
            <div className="absolute bottom-2 end-1.5">
              <div dir="ltr" className="flex h-9 items-center overflow-hidden rounded-[var(--sf-pill,999px)] border-2 border-[var(--sf-text)] bg-white text-sm font-extrabold text-[var(--sf-text)]">
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
              className="absolute bottom-2 end-1.5 grid h-9 w-9 place-items-center rounded-[var(--sf-pill,999px)] border-2 border-[var(--sf-text)] text-xl font-extrabold leading-none text-[var(--sf-text)] transition hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              /* a dark button color gets a white + so it stays visible (mid tones keep the dark +, which reads better on them) */
              style={{ background: k.addColor || "#b9f3d0", ...(k.addColor && luminance(k.addColor) < 0.18 ? { color: "#ffffff" } : {}) }}
            >
              +
            </button>
          )
        )}
        {withAdd && !plus && (inBasket > 0 && !out ? (
          <div dir="ltr" className="mt-3 flex h-11 w-full items-center justify-between overflow-hidden rounded-[min(var(--sf-r),12px)] border-2 border-[var(--sf-text)] bg-white text-[var(--sf-text)]">
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
            className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[min(var(--sf-r),12px)] border text-sm font-bold transition ${
              out
                ? "cursor-not-allowed border-black/10 bg-black/[0.05] text-sf-text/40"
                : "border-sf-primary/50 text-[var(--sf-primary)] hover:bg-[var(--sf-primary)] hover:text-[var(--sf-on)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            }`}
          >
            {out ? c.soldOut : <>{icons.bag}{c.add}</>}
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------------- Product page ---------------- */

/* The words of the product page */
const pageWords = {
  en: {
    home: "Store", crumbs: "You are here", save: "You save", left: (n: number) => `Only ${n} left`, inStock: "In stock", always: "Always available", noPrice: "Price on request",
    qty: "Quantity", less: "Remove one", more: "Add one more", inCart: (n: number) => `In your cart: ${n}`, total: "Total", about: "About this product", details: "Details",
    category: "Category", brand: "Brand", availability: "Availability", delivery: "Delivery", notes: "Notes",
    freeFrom: "Free delivery on orders above", freeLeft: "Add", freeLeftEnd: "more for free delivery", freeHere: "Your order gets free delivery", more2: "Read more", less2: "Show less",
    pickup: "Pick it up yourself", pickupD: "Collect your order from the store", picture: (i: number, n: number) => `Picture ${i} of ${n}`, prev: "Previous picture", next: "Next picture", also: "You may also like",
  },
  ar: {
    home: "المتجر", crumbs: "أنت هنا", save: "توفّر", left: (n: number) => `بقي ${n} فقط`, inStock: "متوفر", always: "متوفر دائمًا", noPrice: "السعر عند الطلب",
    qty: "الكمية", less: "إنقاص", more: "زيادة", inCart: (n: number) => `في سلتك: ${n}`, total: "المجموع", about: "عن المنتج", details: "التفاصيل",
    category: "التصنيف", brand: "العلامة", availability: "التوفر", delivery: "التوصيل", notes: "النوتات",
    freeFrom: "توصيل مجاني للطلبات فوق", freeLeft: "أضف", freeLeftEnd: "بعد للحصول على توصيل مجاني", freeHere: "طلبك يحصل على توصيل مجاني", more2: "اقرأ المزيد", less2: "عرض أقل",
    pickup: "استلمه بنفسك", pickupD: "استلم طلبك من المتجر", picture: (i: number, n: number) => `الصورة ${i} من ${n}`, prev: "الصورة السابقة", next: "الصورة التالية", also: "قد يعجبك أيضًا",
  },
};

/* The class names of each look of the product page (see ProductPageStyle in config.ts). Every look uses the store's own colors,
   fonts and corners through its variables, so it works with any colors the merchant picks. */
type PageSkin = {
  grid: string;
  /* around the main picture, and its shape */
  frame: string;
  ratio: string;
  thumb: string;
  thumbOn: string;
  /* the info column, the category line and the name */
  info: string;
  eyebrow: string;
  title: string;
  /* the price line, the sale label, the "you save" line */
  price: string;
  off: string;
  save: string;
  /* the quantity stepper and the add button */
  stepper: string;
  step: string;
  buy: string;
  added: string;
  /* the perks and details */
  panel: string;
  chip: string;
};
const tint = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;
const pageSkins: Record<ProductPageStyle, PageSkin> = {
  classic: {
    grid: "md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-10 lg:gap-14",
    frame: "overflow-hidden rounded-[var(--sf-r2)] ring-1 ring-sf-text/10",
    ratio: "aspect-[4/5]",
    thumb: "overflow-hidden rounded-[var(--sf-ri)] ring-1 ring-sf-text/10 opacity-70 hover:opacity-100",
    thumbOn: "!opacity-100 ring-2 !ring-[var(--sf-primary)]",
    info: "",
    eyebrow: "inline-flex items-center rounded-[var(--sf-pill)] bg-sf-primary/10 px-3 py-1 text-xs font-bold",
    title: "mt-3 font-extrabold leading-tight tracking-tight",
    price: "text-[34px] font-extrabold leading-none",
    off: "rounded-[var(--sf-pill)] bg-[var(--sf-sale)] px-2.5 py-1 text-xs font-extrabold text-[var(--sf-onsale)]",
    save: "text-sm font-semibold",
    stepper: "h-12 rounded-[var(--sf-pill)] ring-1 ring-sf-text/20",
    step: "w-11 rounded-[var(--sf-pill)] text-xl hover:bg-sf-text/[0.07]",
    buy: "h-12 rounded-[var(--sf-pill)] bg-[var(--sf-primary)] px-6 text-[15px] font-bold text-[var(--sf-on)] shadow-[0_12px_28px_-14px_var(--sf-primary)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-14px_var(--sf-primary)]",
    added: "h-12 rounded-[var(--sf-pill)] bg-sf-primary/10 px-5 text-sm font-bold",
    panel: "rounded-[var(--sf-r2)] bg-sf-text/[0.035] p-5 ring-1 ring-sf-text/[0.07]",
    chip: "rounded-[var(--sf-pill)] bg-sf-text/[0.06] px-3 py-1 text-sm font-semibold",
  },
  editorial: {
    grid: "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-16",
    frame: "overflow-hidden rounded-[var(--sf-ri)]",
    ratio: "aspect-[3/4]",
    thumb: "overflow-hidden rounded-[var(--sf-ri)] opacity-55 hover:opacity-100",
    thumbOn: "!opacity-100 outline outline-1 outline-offset-2 outline-[var(--sf-text)]",
    info: "",
    eyebrow: "text-[11px] font-semibold uppercase tracking-[0.28em] text-sf-text/60",
    title: "mt-3 font-semibold leading-snug ltr:uppercase ltr:tracking-[0.06em]",
    price: "text-xl font-semibold",
    off: "text-sm font-bold text-[var(--sf-sale)]",
    save: "text-xs font-semibold uppercase tracking-[0.18em] text-sf-text/60",
    stepper: "h-14 rounded-[var(--sf-ri)] border border-[var(--sf-text)]",
    step: "w-12 text-lg hover:bg-sf-text/[0.06]",
    buy: "h-14 rounded-[var(--sf-ri)] bg-[var(--sf-primary)] px-6 text-xs font-bold uppercase tracking-[0.24em] text-[var(--sf-on)] hover:opacity-85",
    added: "h-14 rounded-[var(--sf-ri)] border border-sf-text/25 px-5 text-xs font-bold uppercase tracking-[0.18em]",
    panel: "border-t border-sf-text/15",
    chip: "border border-sf-text/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] rounded-[var(--sf-ri)]",
  },
  luxe: {
    grid: "md:grid-cols-2 gap-12 lg:gap-20",
    frame: "overflow-hidden rounded-[var(--sf-ri)]",
    ratio: "aspect-[4/5]",
    thumb: "overflow-hidden rounded-[var(--sf-ri)] opacity-60 hover:opacity-100",
    thumbOn: "!opacity-100 ring-1 ring-[var(--sf-accent)] ring-offset-2 ring-offset-[var(--sf-bg)]",
    info: "text-center",
    eyebrow: "text-[17px] text-[var(--sf-accent)]",
    title: "mt-2 font-light leading-[1.15]",
    price: "text-[28px] font-light",
    off: "rounded-[var(--sf-pill)] border border-[var(--sf-sale)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--sf-sale)]",
    save: "text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--sf-accent)]",
    stepper: "h-[52px] rounded-[var(--sf-pill)] border border-sf-text/25",
    step: "w-11 rounded-[var(--sf-pill)] text-lg font-light hover:bg-sf-text/[0.05]",
    buy: "h-[52px] rounded-[var(--sf-pill)] bg-[var(--sf-primary)] px-8 text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--sf-on)] hover:opacity-90",
    added: "h-[52px] rounded-[var(--sf-pill)] border border-[var(--sf-accent)] px-6 text-[13px] font-semibold tracking-[0.08em]",
    panel: "rounded-[var(--sf-ri)] border p-1.5",
    chip: "rounded-[var(--sf-pill)] border px-4 py-1.5 text-sm",
  },
  pop: {
    grid: "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-14",
    frame: "overflow-hidden rounded-[var(--sf-r2)] border-2 border-[var(--sf-text)] shadow-[6px_6px_0_var(--sf-text)]",
    ratio: "aspect-square",
    thumb: "overflow-hidden rounded-[var(--sf-ri)] border-2 border-[var(--sf-text)] hover:-translate-y-0.5",
    thumbOn: "shadow-[3px_3px_0_var(--sf-text)] -translate-y-0.5",
    info: "",
    eyebrow: "inline-flex items-center rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] px-3 py-0.5 text-xs font-extrabold",
    title: "mt-3 font-extrabold leading-[1.05]",
    price: "text-[30px] font-extrabold leading-none",
    off: "rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] bg-[var(--sf-sale)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--sf-onsale)] -rotate-3",
    save: "text-sm font-bold",
    stepper: "h-14 rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] bg-[var(--sf-bg)] shadow-[3px_3px_0_var(--sf-text)]",
    step: "w-12 rounded-[var(--sf-pill)] text-2xl font-extrabold hover:bg-sf-text/10",
    buy: "h-14 rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] bg-[var(--sf-primary)] px-6 text-base font-extrabold text-[var(--sf-on)] shadow-[4px_4px_0_var(--sf-text)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--sf-text)] active:translate-y-0.5 active:shadow-[1px_1px_0_var(--sf-text)]",
    added: "h-14 rounded-[var(--sf-pill)] border-2 border-dashed border-[var(--sf-text)] px-5 text-sm font-extrabold",
    panel: "rounded-[var(--sf-r2)] border-2 border-[var(--sf-text)] p-4",
    chip: "rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] px-3 py-1 text-sm font-bold",
  },
};

/* The notes line ("rose · musk · incense", or one note on each line) as separate notes; null when it is a sentence */
function notesList(notes?: string): string[] | null {
  const parts = (notes ?? "").split(/\s*[·•|]\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 8 && parts.every((s) => s.length <= 28) ? parts : null;
}

/* An arrow that points the same way in both languages (the gallery's arrows sit at the left and the right whatever the language) */
const chevron = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;

/* The pictures of a product: the big one, arrows and small pictures to switch when there are several, and a closer look under the mouse */
function Gallery({ p, ctx, look }: { p: StoreProduct; ctx: Ctx; look: ProductPageStyle }) {
  const s = pageSkins[look];
  const w = pageWords[ctx.lang];
  const pics = p.images ?? (p.image ? [p.image] : []);
  const [at, setAt] = useState(0);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setAt(0), [p.id]);
  const i = Math.min(at, Math.max(0, pics.length - 1));
  /* the point the merchant chose to keep visible belongs to the main picture only */
  const pic = (n: number): StoreProduct => (pics.length ? { ...p, image: pics[n], focus: pics[n] === p.image ? p.focus : undefined } : p);
  const flat = look === "pop";
  const many = pics.length > 1;
  const go = (d: number) => setAt((i + d + pics.length) % pics.length);
  const arrow = `absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center bg-[var(--sf-bg)] text-[var(--sf-text)] shadow-md transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sf-text)] ${look === "pop" ? "rounded-full border-2 border-[var(--sf-text)] shadow-[2px_2px_0_var(--sf-text)]" : look === "editorial" ? "rounded-[var(--sf-ri)]" : "rounded-full"}`;
  /* the editorial look puts the small pictures in a column beside the big one on a wide screen */
  const side = look === "editorial" && !ctx.compact && many;
  const thumbs = many && (
    <div role="group" aria-label={w.picture(i + 1, pics.length)} className={side ? "flex w-16 shrink-0 flex-col gap-2.5" : `mt-3 flex gap-2.5 overflow-x-auto pb-1 ${look === "luxe" ? "justify-center" : ""}`}>
      {pics.map((src, n) => (
        <button key={src + n} type="button" onClick={() => setAt(n)} aria-label={w.picture(n + 1, pics.length)} aria-pressed={n === i} className={`shrink-0 transition ${side ? "w-16" : "w-16 sm:w-[72px]"} ${s.thumb} ${n === i ? s.thumbOn : ""}`}>
          <ProductImage p={{ ...pic(n), name: "" }} flat={flat} className={s.ratio} />
        </button>
      ))}
    </div>
  );
  const main = (
    <div className={`relative ${s.frame}`}>
      <div
        className="group/zoom relative overflow-hidden"
        onMouseMove={(e) => {
          if (!pics.length || ctx.compact) return;
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onMouseLeave={() => setOrigin(null)}
      >
        <div className={`transition-transform duration-300 motion-reduce:!transform-none ${origin ? "scale-[1.6]" : ""}`} style={origin ? { transformOrigin: origin } : undefined}>
          <ProductImage p={pic(i)} flat={flat} className={`${s.ratio} w-full`} />
        </div>
      </div>
      {many && (
        <>
          <button type="button" onClick={() => go(ctx.lang === "ar" ? 1 : -1)} aria-label={ctx.lang === "ar" ? w.next : w.prev} className={`${arrow} left-3`}>{chevron("M15 6l-6 6 6 6")}</button>
          <button type="button" onClick={() => go(ctx.lang === "ar" ? -1 : 1)} aria-label={ctx.lang === "ar" ? w.prev : w.next} className={`${arrow} right-3`}>{chevron("M9 6l6 6-6 6")}</button>
          <span dir="ltr" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{i + 1} / {pics.length}</span>
        </>
      )}
    </div>
  );
  return side ? <div className="flex items-start gap-3">{thumbs}<div className="min-w-0 flex-1">{main}</div></div> : <div>{main}{thumbs}</div>;
}

/** The page of one product: its pictures, name, price, stock and the way to buy it, then what the merchant wrote about it and other products.
    It has four looks (classic, editorial, luxe, pop); a theme picks one and the merchant can switch it in the designer. */
export function ProductPage({ p, ctx, onBack, look = "classic", fd, pickup = false }: { p: StoreProduct; ctx: Ctx; onBack: () => void; look?: ProductPageStyle; fd?: FreeDelivery; pickup?: boolean }) {
  const c = copy[ctx.lang];
  const w = pageWords[ctx.lang];
  const s = pageSkins[look] ?? pageSkins.classic;
  const luxe = look === "luxe", pop = look === "pop", editorial = look === "editorial";
  const pl = priceLang(ctx.config.theme.prices, ctx.lang);
  const out = p.quantity <= 0;
  const unlimited = !!p.unlimited || p.quantity >= UNLIMITED_STOCK;
  const low = !out && !unlimited && p.quantity <= 5;
  const inBasket = ctx.qty[p.id] ?? 0;
  /* how many to add: chosen before adding; once it is in the basket the same buttons change the basket */
  const [pick, setPick] = useState(1);
  const [more, setMore] = useState(false);
  useEffect(() => { setPick(1); setMore(false); }, [p.id]);
  const count = inBasket > 0 ? inBasket : pick;
  const setCount = (n: number) => (inBasket > 0 ? ctx.setQty(p, n) : setPick(Math.max(1, Math.min(Math.max(1, p.quantity), n))));
  const now = priceOf(p);
  const off = p.sale !== null && p.price ? Math.round((1 - p.sale / p.price) * 100) : 0;
  const saved = p.sale !== null && p.price ? p.price - p.sale : 0;
  const amount = (n: number) => <bdi dir="ltr">{moneyIn(n, pl)} {currency(pl)}</bdi>;
  /* suggestions: the same category first, then featured products, then the rest */
  const others = suggestFor(ctx.data.products, [p], 4);
  const notes = notesList(p.notes);
  const lead = notes ? "" : p.notes ?? "";
  const about = p.description ?? "";
  const long = about.length > 360 || about.split("\n").length > 6;
  /* the free delivery offer follows what is already in the basket */
  const basket = ctx.data.products.reduce((t, x) => t + (ctx.qty[x.id] ?? 0) * priceOf(x), 0);
  const perks: { icon: React.ReactNode; t: React.ReactNode; d?: React.ReactNode; bar?: number }[] = [];
  if (fd?.on) {
    perks.push(
      basket >= fd.min
        ? { icon: icons.truck, t: w.freeHere, bar: 1 }
        : basket > 0
          ? { icon: icons.truck, t: <>{w.freeLeft} {amount(fd.min - basket)} {w.freeLeftEnd}</>, d: <>{w.freeFrom} {amount(fd.min)}</>, bar: basket / fd.min }
          : { icon: icons.truck, t: <>{w.freeFrom} {amount(fd.min)}</> },
    );
  }
  if (pickup) perks.push({ icon: icons.pin, t: w.pickup, d: w.pickupD });
  const details = [
    p.brand ? [w.brand, p.brand] : null,
    p.category ? [w.category, p.category] : null,
    [w.availability, out ? c.soldOut : low ? w.left(p.quantity) : unlimited ? w.always : w.inStock],
  ].filter(Boolean) as [string, string][];
  const titleSize = { classic: [28, 40], editorial: [24, 32], luxe: [32, 50], pop: [32, 48] }[look][ctx.compact ? 0 : 1];
  const chipTints = ["--sf-primary", "--sf-accent", "--sf-sale"];

  const eyebrow = (p.category || p.brand || p.badge) && (
    <div className={`flex flex-wrap items-center gap-2 ${luxe ? "justify-center" : ""}`}>
      {(p.brand || p.category) && (
        <span className={s.eyebrow} style={luxe ? latinItalic : pop ? { background: tint("--sf-accent", 22) } : undefined}>
          {[p.brand, p.category].filter(Boolean).join(editorial ? " / " : " · ")}
        </span>
      )}
      {p.badge && (
        <span className={pop ? "rotate-2 rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] bg-[var(--sf-primary)] px-3 py-0.5 text-xs font-extrabold text-[var(--sf-on)] shadow-[2px_2px_0_var(--sf-text)]" : editorial ? "border border-[var(--sf-text)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]" : luxe ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-sf-text/60" : "rounded-[var(--sf-pill)] bg-[var(--sf-primary)] px-3 py-1 text-xs font-bold text-[var(--sf-on)]"}>
          {luxe && (p.brand || p.category) ? <span aria-hidden className="me-2 text-[var(--sf-accent)]">·</span> : null}{p.badge}
        </span>
      )}
    </div>
  );

  const price = p.price === null ? (
    <p className="text-base font-semibold text-sf-text/65">{w.noPrice}</p>
  ) : (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${luxe ? "justify-center" : ""}`}>
      <span
        dir="ltr"
        className={`inline-flex items-baseline gap-1.5 ${pop ? "rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] px-4 py-2 shadow-[3px_3px_0_var(--sf-text)]" : ""}`}
        style={{ ...(ctx.config.cards.priceColor ? { color: ctx.config.cards.priceColor } : {}), ...(pop ? { background: tint("--sf-accent", 20) } : {}) }}
      >
        <span className={s.price} style={{ ...saleTint(ctx, p), ...(luxe ? { fontFamily: "var(--sf-heading)" } : {}) }}>{moneyIn(now, pl)}</span>
        <span className="text-sm font-semibold opacity-70">{currency(pl)}</span>
      </span>
      {p.sale !== null && <s dir="ltr" className="text-base text-sf-text/50">{moneyIn(p.price, pl)} {currency(pl)}</s>}
      {off > 0 && <span dir="ltr" className={s.off}>-{off}%</span>}
    </div>
  );

  const stock = (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold ${luxe ? "justify-center" : ""} ${editorial ? "text-xs uppercase tracking-[0.16em]" : ""}`}>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${out ? "bg-rose-500" : low ? "bg-amber-500" : "bg-emerald-500"} ${!out && !low ? "shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" : ""}`} />
        {out ? c.soldOut : low ? w.left(p.quantity) : unlimited ? w.always : w.inStock}
      </span>
      {/* a few left: five small bars, as many filled as there are pieces */}
      {low && (
        <span aria-hidden className="inline-flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 w-4 rounded-full ${n <= p.quantity ? "bg-amber-500" : "bg-sf-text/15"}`} />)}
        </span>
      )}
    </div>
  );

  const step = `grid h-full place-items-center leading-none transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sf-text)] ${s.step}`;
  const buy = (
    <div className={`flex flex-wrap items-stretch gap-3 ${luxe ? "justify-center" : ""}`}>
      {!out && p.price !== null && (
        <div dir="ltr" role="group" aria-label={w.qty} className={`inline-flex shrink-0 items-center ${s.stepper}`}>
          <button type="button" className={step} disabled={inBasket === 0 && pick <= 1} onClick={() => setCount(count - 1)} aria-label={`${w.less}: ${p.name}`}>−</button>
          <span aria-live="polite" className="min-w-[2.5rem] text-center text-base font-extrabold tabular-nums">{count}</span>
          <button type="button" className={step} disabled={count >= p.quantity} onClick={() => setCount(count + 1)} aria-label={`${w.more}: ${p.name}`}>+</button>
        </div>
      )}
      {inBasket > 0 && !out ? (
        <p role="status" className={`flex min-w-[12rem] flex-1 flex-wrap items-center justify-center gap-x-2 text-center ${s.added}`}>
          <span className="inline-flex items-center gap-1.5">{icons.check}{w.inCart(inBasket)}</span>
          <span className="opacity-70">· {w.total} {amount(now * inBasket)}</span>
        </p>
      ) : (
        <button
          type="button"
          disabled={out || p.price === null}
          onClick={() => ctx.setQty(p, pick)}
          className={`inline-flex min-w-[12rem] flex-1 items-center justify-center gap-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-text)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${s.buy}`}
        >
          {icons.bag}
          {out ? c.soldOut : c.add}
          {!out && p.price !== null && pick > 1 && <span className="opacity-80">· {amount(now * pick)}</span>}
        </button>
      )}
    </div>
  );

  const notesChips = notes && (
    <div className={luxe ? "text-center" : ""}>
      <p className={`mb-2 ${editorial || luxe ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-sf-text/60" : "text-sm font-bold"}`}>{w.notes}</p>
      <ul className={`flex flex-wrap gap-2 ${luxe ? "justify-center" : ""}`}>
        {notes.map((n, i) => (
          <li key={n + i} className={s.chip} style={luxe ? { borderColor: tint("--sf-accent", 45) } : pop ? { background: tint(chipTints[i % 3], 22) } : undefined}>{n}</li>
        ))}
      </ul>
    </div>
  );

  const perkList = perks.length > 0 && (
    <ul className={`grid gap-3 ${perks.length > 1 && !ctx.compact && !luxe ? "sm:grid-cols-2" : ""}`}>
      {perks.map((x, i) => (
        <li key={i} className={`flex items-start gap-3 text-start ${pop ? "rounded-[var(--sf-r2)] border-2 border-[var(--sf-text)] p-3" : luxe || editorial ? "" : "rounded-[var(--sf-r2)] bg-sf-text/[0.035] p-3.5 ring-1 ring-sf-text/[0.07]"}`}>
          <span
            aria-hidden
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${pop ? "border-2 border-[var(--sf-text)]" : ""} ${luxe ? "text-[var(--sf-accent)]" : ""}`}
            style={pop ? { background: tint(chipTints[i % 3], 25) } : luxe ? { boxShadow: `inset 0 0 0 1px ${tint("--sf-accent", 45)}` } : { background: tint("--sf-primary", 12) }}
          >
            {x.icon}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug">
            <span className="block font-bold">{x.t}</span>
            {x.d && <span className="mt-0.5 block text-[13px] text-sf-text/65">{x.d}</span>}
            {x.bar !== undefined && (
              <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sf-text/10">
                <span className="block h-full rounded-full bg-[var(--sf-primary)] transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, x.bar) * 100)}%` }} />
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  const aboutText = about && (
    <div>
      <p className={`whitespace-pre-line text-[15px] text-sf-text/80 [overflow-wrap:anywhere] ${luxe ? "leading-8" : "leading-relaxed"} ${long && !more ? "line-clamp-6" : ""}`}>{about}</p>
      {long && (
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-2 text-sm font-bold underline underline-offset-4 hover:opacity-70">
          {more ? w.less2 : w.more2}
        </button>
      )}
    </div>
  );

  const detailRows = (
    <dl className={luxe ? "grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-4 text-center" : "divide-y divide-sf-text/10 text-sm"}>
      {details.map(([k, v]) => (
        <div key={k} className={luxe ? "min-w-0" : "flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"}>
          <dt className={luxe ? "text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--sf-accent)]" : "shrink-0 text-sf-text/60"}>{k}</dt>
          <dd className={`min-w-0 font-semibold [overflow-wrap:anywhere] ${luxe ? "mt-1 text-sm" : "text-end"}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );

  /* The editorial look folds the longer parts into rows with a thin line between them; the others show them as blocks */
  const fold = (title: string, body: React.ReactNode, open = false) => (
    <details open={open} className="group border-b border-sf-text/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-xs font-bold uppercase tracking-[0.22em] [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-lg font-light leading-none transition group-open:rotate-45">+</span>
      </summary>
      <div className="pb-5">{body}</div>
    </details>
  );

  return (
    <section className={ctx.compact ? "px-4 pb-10 pt-5" : "px-8 pb-16 pt-8"}>
      <div className="mx-auto max-w-6xl">
        <nav aria-label={w.crumbs} className={`flex min-w-0 items-center gap-2 text-sm ${luxe ? "justify-center" : ""} ${editorial ? "text-[11px] uppercase tracking-[0.2em]" : ""}`}>
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex shrink-0 items-center gap-1.5 font-bold transition hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-text)] ${pop ? "rounded-[var(--sf-pill)] border-2 border-[var(--sf-text)] px-3 py-1" : ""}`}
          >
            <span className="rotate-180">{icons.arrow}</span>
            {w.home}
          </button>
          {p.category && (
            <>
              <span aria-hidden className="text-sf-text/35">/</span>
              <span className="max-w-[40%] shrink-0 truncate text-sf-text/60">{p.category}</span>
            </>
          )}
          <span aria-hidden className="text-sf-text/35">/</span>
          <span aria-current="page" className="min-w-0 truncate text-sf-text/60">{p.name}</span>
        </nav>

        <div className={`mt-5 grid items-start ${ctx.compact ? "gap-7" : s.grid}`}>
          {luxe ? (
            <div className="rounded-[var(--sf-r2)] border p-2.5 sm:p-3" style={{ borderColor: tint("--sf-accent", 40) }}>
              <Gallery p={p} ctx={ctx} look={look} />
            </div>
          ) : (
            <Gallery p={p} ctx={ctx} look={look} />
          )}

          <div className={`min-w-0 ${ctx.compact ? "" : "md:sticky md:top-6"} ${s.info}`}>
            {eyebrow}
            <h1 className={`${s.title} text-[var(--sf-title)] [overflow-wrap:anywhere]`} style={{ fontFamily: "var(--sf-heading)", fontSize: titleSize }}>
              {p.name}
            </h1>
            {lead && <p className={`mt-2 text-sf-text/65 ${luxe ? "text-[15px]" : "text-base"} [overflow-wrap:anywhere]`} style={luxe ? latinItalic : undefined}>{lead}</p>}
            {luxe && (
              <div aria-hidden className="mt-5 flex items-center justify-center gap-3 text-[var(--sf-accent)]">
                <span className="h-px w-12 bg-current opacity-50" />
                <span className="text-xs">✦</span>
                <span className="h-px w-12 bg-current opacity-50" />
              </div>
            )}

            <div className={`mt-5 space-y-2 ${editorial ? "border-y border-sf-text/15 py-5" : ""}`}>
              {price}
              {saved > 0 && <p className={s.save} style={pop || look === "classic" ? { color: "var(--sf-sale)" } : undefined}>{w.save} {amount(saved)}</p>}
            </div>

            <div className="mt-4">{stock}</div>
            {notesChips && <div className="mt-6">{notesChips}</div>}
            <div className="mt-6">{buy}</div>
            {perkList && !editorial && <div className={luxe ? "mx-auto mt-6 w-fit" : "mt-6"}>{perkList}</div>}

            {editorial ? (
              <div className="mt-8 border-t border-sf-text/15">
                {aboutText && fold(w.about, aboutText, true)}
                {fold(w.details, detailRows, !aboutText)}
                {perkList && fold(w.delivery, perkList)}
              </div>
            ) : luxe ? (
              <>
                {aboutText && <div className="mx-auto mt-8 max-w-md">{aboutText}</div>}
                <div className={`mt-8 ${s.panel}`} style={{ borderColor: tint("--sf-accent", 45) }}>
                  <div className="rounded-[var(--sf-ri)] border px-5 py-5" style={{ borderColor: tint("--sf-accent", 25) }}>{detailRows}</div>
                </div>
              </>
            ) : (
              <>
                {aboutText && (
                  <div className="mt-8">
                    <h2 className={`mb-2 ${pop ? "text-lg font-extrabold" : "text-base font-bold"}`} style={{ fontFamily: "var(--sf-heading)" }}>{w.about}</h2>
                    {aboutText}
                  </div>
                )}
                <div className={`mt-6 ${s.panel}`}>{detailRows}</div>
              </>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <div className={`${ctx.compact ? "mt-12" : "mt-20"} ${editorial ? "border-t border-sf-text/15 pt-10" : ""}`}>
            <Heading title={w.also} ctx={ctx} />
            <Grid items={others} ctx={ctx} columns={4} />
          </div>
        )}
      </div>
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
        <span className="rotate-180">{icons.arrow}</span>
      </button>
      {/* One dot for each row of products, so a change in the number of products shown can be seen: more products, more dots */}
      <span className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: Math.max(1, Math.ceil(count / cols)) }, (_, i) => (
          <span key={i} className="h-2 rounded-full transition-all duration-300" style={{ width: i === edge.page ? 18 : 8, background: "var(--sf-text)", opacity: i === edge.page ? 1 : 0.25 }} />
        ))}
      </span>
      <button type="button" disabled={edge.end} onClick={() => slide(1)} aria-label={rtl ? "التالي" : "Next"} className={arrow}>
        <span>{icons.arrow}</span>
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

/* An empty product section, seen only by the merchant in the designer: it says what is missing, so the section never looks like it is gone.
   With `add`, a button opens the products page (in a new tab, so unsaved design changes are not lost). */
function DesignEmpty({ ctx, hint, add, quote }: { ctx: Ctx; hint: string; add?: boolean; /* a quote mark instead of the bag (for reviews) */ quote?: boolean }) {
  return (
    <div className="grid place-items-center rounded-[var(--sf-r)] border-2 border-dashed px-6 py-12 text-center" style={{ borderColor: "color-mix(in srgb, var(--sf-primary) 35%, transparent)" }}>
      <span className="grid h-20 w-20 place-items-center rounded-full text-sf-primary/70" style={{ background: "color-mix(in srgb, var(--sf-primary) 9%, white)" }}>
        {quote ? (
          <svg aria-hidden viewBox="0 0 32 32" className="h-9 w-9 fill-current">
            <path d="M10 8C6 9.500 4 13 4 17v7h9v-9H8c0-3 1.500-5 4-6L10 8Zm14 0c-4 1.500-6 5-6 9v7h9v-9h-5c0-3 1.500-5 4-6L24 8Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 8h14l-1 12H6L5 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
        )}
      </span>
      <p className="mt-4 max-w-sm text-sm font-semibold text-sf-text/70">{hint}</p>
      {add && (
        <a
          href="/products"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--sf-primary)] px-6 py-3 text-sm font-extrabold text-[var(--sf-on)] shadow-md transition hover:-translate-y-0.5"
        >
          {icons.plus}
          {copy[ctx.lang].addHere}
        </a>
      )}
    </div>
  );
}

/* A previous or next button of the hero's backgrounds. Previous sits at the start of the reading direction, next at the end. */
function HeroArrow({ dir, ctx, go }: { dir: 1 | -1; ctx: Ctx; go: (dir: 1 | -1) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        go(dir);
      }}
      aria-label={dir === -1 ? (ctx.lang === "ar" ? "السابق" : "Previous") : ctx.lang === "ar" ? "التالي" : "Next"}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/85 text-[#12262b] shadow-md backdrop-blur transition hover:scale-105 hover:bg-white"
    >
      <span className={dir === -1 ? "rotate-180" : ""}>{icons.arrow}</span>
    </button>
  );
}

/* ---------------- Sections ---------------- */

function Hero({ id, s, ctx }: { id: string; s: Extract<SectionConfig, { type: "hero" }>["settings"]; ctx: Ctx }) {
  /* the products he picked for the cards, in his order; without a pick, the first ones */
  const picked = (s.cardIds ?? []).map((pid) => ctx.data.products.find((p) => p.id === pid)).filter((p): p is StoreProduct => !!p);
  const real = (picked.length ? picked : ctx.data.products).slice(0, 3);
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
              <h1 className="[overflow-wrap:anywhere] font-extrabold tracking-[-0.01em]" style={{ fontFamily: s.titleFont ? heroTitleFamily(s.titleFont) : "var(--sf-heading)", fontSize: sz("title", 80), lineHeight: 1.02, color: s.colors?.title || "var(--sf-title)" , ...tx(s.styles?.title) }}>
                {/* The words wrap like a sentence, so a short title takes two lines instead of one word per line */}
                {words.map((w, i) => (
                  <Fragment key={i}>
                    {i > 0 && " "}
                    <span style={accentWords.includes(w) ? { color: accentC } : undefined}>{w}</span>
                  </Fragment>
                ))}
              </h1>
            </Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block>
              <p className="max-w-md font-medium leading-[1.7]" style={{ fontSize: sz("subtitle", 20), color: s.colors?.subtitle , ...tx(s.styles?.subtitle) }}>{s.subtitle[l] || s.subtitle[other]}</p>
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
                <p dir="auto" style={{ ...latinItalic, fontSize: sz("eyebrow", 22), color: s.colors?.eyebrow || "var(--sf-accent)" , ...tx(s.styles?.eyebrow) }}>{kicker}</p>
              </Pick>
            )}
            <Pick ctx={ctx} id={id} field="title" block>
              <h1 className="[overflow-wrap:anywhere] font-semibold" style={{ fontFamily: s.titleFont ? heroTitleFamily(s.titleFont) : "var(--sf-heading)", fontSize: sz("title", 80), lineHeight: 1.15, color: s.colors?.title || "var(--sf-title)" , ...tx(s.styles?.title) }}>
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
              <p className="max-w-[420px] font-light" style={{ fontSize: sz("subtitle", 18), lineHeight: 2, color: s.colors?.subtitle || "color-mix(in srgb, var(--sf-text) 80%, var(--sf-bg))" , ...tx(s.styles?.subtitle) }}>{s.subtitle[l] || s.subtitle[other]}</p>
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
                  {s.price && <p className="font-bold" style={{ fontFamily: "var(--sf-heading)", fontSize: sz("price", 20) }}><WrittenPrice text={s.price} ctx={ctx} /></p>}
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
          <div className={`relative overflow-hidden ${ctx.compact ? "aspect-[4/3]" : full ? "min-h-[720px]" : "min-h-[26rem]"} ${photoFirst ? "" : "md:order-2"}`}>
            {s.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photo} alt="" className="absolute inset-0 h-full w-full object-cover" style={picFill(s.photoPos)} />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-black/10 px-6 text-center text-sm font-semibold opacity-80">
                {ctx.design ? (l === "ar" ? "أضف صورة الغلاف من القائمة الجانبية" : "Add the cover photo from the side panel") : ""}
              </span>
            )}
          </div>
          <div className={`flex flex-col justify-center ${ctx.compact ? "items-center gap-4 px-6 py-10 text-center" : full ? "gap-7 px-16 py-20" : "gap-5 px-12 py-12"}`}>
            {eyebrow && (
              <Pick ctx={ctx} id={id} field="eyebrow" block>
                <p className="font-bold leading-[1.2]" style={{ ...head, fontSize: sz("eyebrow", 34), color: s.colors?.eyebrow || (light ? "var(--sf-accent)" : "currentColor") , ...tx(s.styles?.eyebrow) }}>{eyebrow}</p>
              </Pick>
            )}
            <Pick ctx={ctx} id={id} field="title" block>
              <h1 className="[overflow-wrap:anywhere] font-bold leading-none tracking-[-0.01em]" style={{ ...head, fontFamily: heroTitleFamily(s.titleFont), fontSize: sz("title", full ? 100 : 48), color: s.colors?.title , ...tx(s.styles?.title) }}>{s.title[l]}</h1>
            </Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block>
              <p className="max-w-[460px] font-medium leading-[1.7] opacity-85" style={{ fontSize: sz("subtitle", full ? 24 : 15), color: s.colors?.subtitle , ...tx(s.styles?.subtitle) }}>{s.subtitle[l]}</p>
            </Pick>
            {(s.price || size) && (
              <p className="flex items-baseline gap-2.5">
                {s.price && <span className="font-bold" style={{ ...head, fontSize: sz("price", 26), color: s.colors?.price }}><WrittenPrice text={s.price} ctx={ctx} /></span>}
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
  /* the words of the picture that shows now, or the cover's main words where it has none */
  const own = (b: { en: string; ar: string } | undefined, main: { en: string; ar: string }) => b?.[ctx.lang]?.trim() || main[ctx.lang];
  const words = { title: own(current.title, s.title), subtitle: own(current.subtitle, s.subtitle), button: own(current.button, s.button), link: current.link?.trim() || s.link };
  const changes = bgs.some((b) => b.title?.[ctx.lang]?.trim() || b.subtitle?.[ctx.lang]?.trim() || b.button?.[ctx.lang]?.trim());
  const slideColor = (c: string) => c || primary;
  /* where the words sit (the middle by default, or at the bottom), how tall the cover is, and whether it reaches the page edges */
  const pos = s.textPos ?? "center";
  const low = pos !== "center";
  const mid = pos === "bottom-center";
  const tall = s.height === "tall";
  const full = !!s.fullWidth;
  const l = ctx.lang;
  const button2 = s.button2?.[l] || s.button2?.[l === "ar" ? "en" : "ar"] || "";
  /* the small line above the title (empty: none); letter-spaced, but only lightly for Arabic so its letters stay joined */
  const eyebrow = s.eyebrow?.[l]?.trim() || s.eyebrow?.[l === "ar" ? "en" : "ar"]?.trim() || "";
  return (
    <section className={full ? "" : ctx.compact ? "px-4 pt-4" : "px-8 pt-6"}>
      <div
        className={`relative isolate flex flex-col overflow-hidden transition-colors duration-700 ${full ? "" : "rounded-[var(--sf-r)]"} ${low ? "justify-end" : "justify-center"} ${tall ? (ctx.compact ? "min-h-[520px]" : "min-h-[720px]") : ""} ${ctx.compact ? "px-6 py-9" : tall || full ? "px-14 py-14" : "px-10 py-11"} ${bgs.length > 1 ? "pb-16" : ""}`}
        style={{ color: heroOn }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* The backgrounds, stacked: the current one is visible and the others fade in and out */}
        {bgs.map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-0 -z-20 overflow-hidden transition-opacity duration-700"
            style={{
              opacity: i === idx ? 1 : 0,
              background: b.kind === "image" && b.image ? undefined : b.color ? b.color : `linear-gradient(120deg, ${slideColor(b.color)}, color-mix(in srgb, ${slideColor(b.color)} 62%, #6fe3cf))`,
            }}
          >
            {b.kind === "image" && b.image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" className="h-full w-full object-cover" style={picFill(b.pos)} />
                {/* a dark fade keeps the words readable; it is deepest on the side where the words sit */}
                <span className="absolute inset-0" style={{ background: low ? "linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0.25) 45%, rgb(0 0 0 / 0.05))" : "linear-gradient(to top, rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.2))" }} />
              </>
            )}
          </span>
        ))}
        {/* the two soft circles belong to the usual cover; a tall, edge-to-edge or bottom-text cover stays clean */}
        {!tall && !full && !low && (
          <>
            <span aria-hidden className="absolute -end-16 -top-20 -z-10 h-72 w-72 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -bottom-24 start-1/3 -z-10 h-64 w-64 rounded-full bg-white/10" />
          </>
        )}

        <div className={`flex justify-between gap-8 ${low ? "items-end" : "items-center"} ${ctx.compact || mid ? "flex-col text-center" : ""}`}>
          {/* when the pictures have words of their own, the words fade in again with each picture */}
          <div key={changes ? idx : "same"} className={`${ctx.compact ? "" : mid ? "mx-auto max-w-2xl" : tall || full ? "max-w-xl" : "max-w-md"} ${changes ? "animate-[fadeIn_0.6s_ease]" : ""}`}>
            {eyebrow && <Pick ctx={ctx} id={id} field="eyebrow" block><p className={`mb-3 font-bold opacity-90 ${/[؀-ۿ]/.test(eyebrow) ? "tracking-[0.04em]" : "uppercase tracking-[0.18em]"}`} style={{ fontSize: sz("eyebrow", 13), color: s.colors?.eyebrow , ...tx(s.styles?.eyebrow) }}>{eyebrow}</p></Pick>}
            <Pick ctx={ctx} id={id} field="title" block><h1 className="[overflow-wrap:anywhere] font-extrabold leading-[1.1] tracking-tight" style={{ fontFamily: s.titleFont ? heroTitleFamily(s.titleFont) : "var(--sf-heading)", fontSize: sz("title", tall ? 56 : 36), color: s.colors?.title , ...tx(s.styles?.title) }}>{words.title}</h1></Pick>
            <Pick ctx={ctx} id={id} field="subtitle" block><p className="mt-4 leading-relaxed opacity-85" style={{ fontSize: sz("subtitle", tall ? 17 : 15), color: s.colors?.subtitle , ...tx(s.styles?.subtitle) }}>{words.subtitle}</p></Pick>
            <div className={`mt-7 flex flex-wrap items-center gap-3 ${ctx.compact || mid ? "justify-center" : ""}`}>
              <Pick ctx={ctx} id={id} field="button"><HeroBtn ctx={ctx} link={words.link} style={{ fontSize: sz("button", 14), color: s.colors?.button, borderRadius: "var(--sf-pill)" }} className="inline-flex items-center gap-2 bg-white px-6 py-3 font-extrabold text-[#12262b] shadow-lg transition hover:-translate-y-0.5">
                {words.button}
                {icons.arrow}
              </HeroBtn></Pick>
              {/* a second button, outlined, next to the main one */}
              {button2 && (
                <Pick ctx={ctx} id={id} field="button2">
                  <HeroBtn ctx={ctx} link={s.link2} style={{ fontSize: sz("button", 14), color: s.colors?.button, borderRadius: "var(--sf-pill)" }} className="inline-flex items-center gap-2 border-2 border-current px-6 py-[10px] font-extrabold transition hover:-translate-y-0.5 hover:bg-white/10">
                    {button2}
                  </HeroBtn>
                </Pick>
              )}
            </div>
          </div>

          {/* the product cards stay beside the words, except when the words sit in the bottom middle */}
          {!ctx.compact && !mid && (s.showCards ?? true) && (() => {
            /* how the merchant styled these cards: fanned, in a row or one big picture; framed or not; the picture shape; the name under it */
            const look = s.cardLook ?? {};
            const arrange = look.arrange ?? "fan";
            const bare = look.frame === "bare";
            const round = look.shape === "round";
            const named = look.showName ?? true;
            const pic = `${look.shape === "square" || round ? "aspect-square" : "aspect-[4/5]"} w-full ${round ? "rounded-full" : bare ? "rounded-2xl" : "rounded-xl"} ${bare ? "shadow-2xl" : ""}`;
            const shown = arrange === "single" ? tiles.slice(0, 1) : tiles;
            /* fanned cards overlap, so only the front one carries a name, on a dark pill when unframed since it sits over the card behind */
            const one = (p: StoreProduct, withName = named, pill = false) => (
              <>
                <ProductImage p={p} className={pic} />
                {withName && (p.name ? <p className={`mt-2 line-clamp-1 px-1 text-[11px] font-bold ${bare ? "text-center" : "text-[#12262b]"}`}>{pill ? <span className="rounded-full bg-black/55 px-2 py-0.5 text-white">{p.name}</span> : p.name}</p> : <span className={`mt-2 block h-2 w-16 rounded-full ${bare ? "mx-auto bg-white/30" : "bg-black/10"}`} />)}
              </>
            );
            const frame = bare ? "" : "rounded-2xl bg-white p-2 shadow-2xl";
            if (arrange === "fan")
              return (
                <div className="relative h-56 w-72 shrink-0" style={{ perspective: 900 }}>
                  {shown.map((p, i) => (
                    <div
                      key={p.id}
                      className={`absolute w-36 ${frame}`}
                      style={{ insetInlineStart: `${i * 52}px`, top: `${i === 1 ? 0 : 36}px`, transform: `rotateY(${(i - 1) * -10}deg) rotate(${(i - 1) * 4}deg)`, zIndex: i === 1 ? 2 : 1 }}
                    >
                      {one(p, named && i === Math.min(1, shown.length - 1), bare)}
                    </div>
                  ))}
                </div>
              );
            return (
              <div className="flex shrink-0 items-end gap-3">
                {shown.map((p) => (
                  <div key={p.id} className={`${arrange === "single" ? "w-56" : "w-28"} ${frame}`}>
                    {one(p)}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Previous and next sit at the bottom on both sides of the dots, below the words, so they never cover them.
            A visitor never has to wait for the next background. */}
        {bgs.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-3">
            <HeroArrow dir={-1} ctx={ctx} go={go} />
            <div className="flex items-center gap-1.5">
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
            <HeroArrow dir={1} ctx={ctx} go={go} />
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
              <span className="block text-xs text-sf-text/55">{p.desc[ctx.lang] || p.desc[ctx.lang === "ar" ? "en" : "ar"]}</span>
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
  if (!items.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <Heading title={s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]} ctx={ctx} />
        <DesignEmpty ctx={ctx} hint={ctx.lang === "ar" ? "اختر منتجات هذا القسم من إعداداته" : "Pick products for this section in its settings"} />
      </section>
    );
  }
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
        <div className="grid aspect-[4/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 text-sm font-semibold text-[var(--sf-primary)]">
          {ctx.lang === "ar" ? "معرض صور: أضف صورك من القائمة الجانبية" : "Picture tiles: add your pictures from the side panel"}
        </div>
      </section>
    );
  }
  /* On a phone the row keeps 2 to 4 pictures (more columns on the computer, more on the phone) so each stays easy to tap */
  const want = s.columns || 4;
  const cols = Math.min(ctx.compact ? (want >= 8 ? 4 : want >= 5 ? 3 : 2) : want, list.length);
  /* many pictures in a row: tighter gaps and a smaller name */
  const dense = ctx.compact ? cols >= 3 : cols >= 6;
  /* Circles: round pictures, each in a thin ring of the store color, with the name under it */
  if (s.style === "circles") {
    return (
      <section className={section(ctx.compact)}>
        {title && <Heading title={title} ctx={ctx} />}
        <div className={`grid ${dense ? "gap-x-3 gap-y-6" : ctx.compact ? "gap-x-6 gap-y-8" : "gap-8"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {list.map((x, n) => {
            const label = x.label?.[ctx.lang] || x.label?.[other] || "";
            const body = (
              <div className={`group flex flex-col items-center ${dense ? "px-1" : "px-3"}`}>
                <div className="aspect-square w-full overflow-hidden rounded-full" style={{ outline: `1px solid ${ringColor}`, outlineOffset: dense ? 4 : 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.image} alt={label} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" style={picFill(x.pos)} />
                </div>
                {label && <span className={`${dense ? "mt-3" : "mt-5"} text-center`} style={{ fontFamily: "var(--sf-heading)", fontSize: dense ? (ctx.compact ? 13 : 16) : ctx.compact ? 18 : 22 }}>{label}</span>}
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
      <div className={`grid ${dense ? "gap-3" : editorial ? "gap-5" : "gap-4"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
                    <span className={`font-light ${dense ? "text-sm" : ctx.compact ? "text-lg" : "text-[22px]"}`}>{label}</span>
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
        <div className="grid aspect-[3/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 text-sm font-semibold text-[var(--sf-primary)]">
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
  /* where the text panel of a photo banner sits: a corner, or the middle ("center" puts it in the middle, text centered) */
  const corner = { "top-start": "top-6 start-6", "top-end": "top-6 end-6", "bottom-start": "bottom-6 start-6", "bottom-end": "bottom-6 end-6", center: "inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 text-center" };
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
                        <p className={`flex items-center gap-2 font-extrabold ${spread ? "justify-center" : ""}`} style={{ color: b.eyebrowColor || ink, fontSize: scaled(b.eyebrowSize ?? 24, ctx.compact), fontFamily: b.textFont && b.textFont !== "default" ? displayFamily[b.textFont] : undefined , ...tx(b.styles?.eyebrow) }}>
                          {eyebrow}
                        </p>
                      )}
                      {title && <h3 className="mt-1 font-extrabold leading-none" style={{ fontFamily: b.font && b.font !== "default" ? displayFamily[b.font] : "var(--sf-heading)", color: b.titleColor || ink, fontSize: scaled(b.titleSize ?? 64, ctx.compact) , ...tx(b.styles?.title) }}>{title}</h3>}
                      {text && <p className="mt-2 leading-relaxed" style={{ color: b.textColor || ink, fontSize: b.textSize ?? 15, fontFamily: b.textFont && b.textFont !== "default" ? displayFamily[b.textFont] : undefined , ...tx(b.styles?.text) }}>{text}</p>}
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
                              <img src={src} alt="" className="h-full w-full object-cover" style={k === 0 ? picStyle(b.pos) : picFill(b.imagesPos?.[k - 1])} />
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
                  {eyebrow && <p className="text-xs tracking-wide" style={{ fontFamily: small, color: b.eyebrowColor || accent, fontSize: b.textSize ? Math.round(b.textSize * 0.8) : b.textFont && b.textFont !== "default" ? 20 : undefined , ...tx(b.styles?.eyebrow) }}>{eyebrow}</p>}
                  {title && (
                    <h3 className="mt-1 leading-tight" style={{ fontFamily: family, fontWeight: 700, color: b.titleColor || "inherit", fontSize: scaled(b.titleSize ?? 84, ctx.compact) , ...tx(b.styles?.title) }}>
                      {title}
                    </h3>
                  )}
                  {text && <p className="mt-2 leading-relaxed" style={{ fontFamily: small, color: b.textColor, fontSize: b.textSize ?? (b.textFont && b.textFont !== "default" ? 20 : 15) , ...tx(b.styles?.text) }}>{text}</p>}
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

          /* "center": the words sit in the middle of the picture, on an even dark fade, with the small line above the title and
             the button in the banner's own color (white when none is set); its corners follow the store's corner setting */
          const middle = b.position === "center";
          const own = middle && !!b.accent;
          const plainBtn = `mt-4 inline-flex w-fit items-center gap-2 px-5 py-2.5 text-sm font-extrabold shadow-lg ${middle ? "" : "rounded-full"} ${own && b.buttonStyle === "outline" ? "border-2" : own ? "" : "bg-white text-[#12262b]"}`;
          const plainBtnStyle: React.CSSProperties | undefined = !middle ? undefined : !own ? { borderRadius: "var(--sf-pill)" } : b.buttonStyle === "outline" ? { borderRadius: "var(--sf-pill)", borderColor: b.accent, color: b.accent } : { borderRadius: "var(--sf-pill)", background: b.accent, color: onColor(b.accent!) };
          return (
            <div key={n} className={shell} style={bg}>
              {photo}
              <span aria-hidden className={`absolute inset-0 -z-10 ${middle ? "bg-black/40" : "bg-gradient-to-t from-black/65 via-black/15 to-transparent"}`} />
              <div className={`flex h-full flex-col p-6 text-white ${middle ? "items-center justify-center text-center" : "justify-end"}`}>
                {middle && eyebrow && <p className={`mb-2 font-bold drop-shadow ${/[؀-ۿ]/.test(eyebrow) ? "" : "uppercase tracking-[0.18em]"}`} style={{ color: b.eyebrowColor || "inherit", fontSize: b.eyebrowSize ? scaled(b.eyebrowSize, ctx.compact) : 13, fontFamily: b.textFont && b.textFont !== "default" ? displayFamily[b.textFont] : undefined, ...tx(b.styles?.eyebrow) }}>{eyebrow}</p>}
                {title && <h3 className="font-extrabold leading-tight drop-shadow" style={{ fontFamily: displayFamily[b.font ?? "default"], color: b.titleColor || "inherit", fontSize: scaled(b.titleSize ?? 84, ctx.compact) , ...tx(b.styles?.title) }}>{title}</h3>}
                {text && <p className={`mt-1.5 max-w-[85%] text-sm leading-relaxed opacity-90 ${middle ? "drop-shadow" : ""}`}>{text}</p>}
                {button &&
                  (go ? (
                    <a {...linkProps(b.link, ctx)} className={`${plainBtn} transition hover:-translate-y-0.5`} style={plainBtnStyle}>
                      {button}
                      {icons.arrow}
                    </a>
                  ) : (
                    <span className={plainBtn} style={plainBtnStyle} onClick={dgo}>
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
        <div className="grid aspect-[3/1] place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 text-sm font-semibold text-[var(--sf-primary)]">
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
            <img src={x.image} alt="" className="h-full w-full object-cover" style={picFill(x.pos)} />
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

/* Example reviews, shown only while styling the store in the designer or the demo store. Never saved. One set per language, so the page never mixes them. */
const exampleReviews: Record<Lang, { name: string; text: string; stars: 1 | 2 | 3 | 4 | 5 }[]> = {
  ar: [
    { name: "خالد ع.", text: "توصيل سريع والجودة تمامًا كما في الوصف.", stars: 5 },
    { name: "ندى ح.", text: "تجربة شراء سهلة، والمنتج وصل مغلّفًا بعناية.", stars: 5 },
    { name: "عمر س.", text: "أسعار جيدة وخدمة لطيفة. سأطلب مرة أخرى.", stars: 4 },
  ],
  en: [
    { name: "Khaled A.", text: "Fast delivery and the quality is exactly as described.", stars: 5 },
    { name: "Nada H.", text: "An easy order, and the product arrived carefully wrapped.", stars: 5 },
    { name: "Omar S.", text: "Good prices and friendly service. I will order again.", stars: 4 },
  ],
};

function Reviews({ s, ctx }: { s: Extract<SectionConfig, { type: "reviews" }>["settings"]; ctx: Ctx }) {
  const items = (s.items ?? []).filter((r) => r.text.trim());
  const shown = items.length ? items : ctx.data.isDemo ? exampleReviews[ctx.lang] : [];
  const rail = useRef<HTMLDivElement>(null);
  if (!shown.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <Heading title={s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]} ctx={ctx} />
        <DesignEmpty ctx={ctx} quote hint={ctx.lang === "ar" ? "أضف آراء عملائك من إعدادات هذا القسم" : "Add your customers' reviews in this section's settings"} />
      </section>
    );
  }
  const slide = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    /* In right-to-left pages scrolling goes the other way */
    el.scrollBy({ left: dir * (ctx.lang === "ar" ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow = "grid h-10 w-10 place-items-center rounded-full bg-white shadow-md ring-1 ring-black/[0.06] transition hover:scale-105";
  return (
    <section className={section(ctx.compact)}>
      <Heading
        title={s.title[ctx.lang] || s.title[ctx.lang === "ar" ? "en" : "ar"]}
        ctx={ctx}
        right={shown.length > (ctx.compact ? 1 : 3) && (
          <div className="flex gap-2">
            <button type="button" onClick={() => slide(-1)} aria-label={ctx.lang === "ar" ? "السابق" : "Previous"} className={arrow}>
              <span className="rotate-180">{icons.arrow}</span>
            </button>
            <button type="button" onClick={() => slide(1)} aria-label={ctx.lang === "ar" ? "التالي" : "Next"} className={arrow}>
              <span>{icons.arrow}</span>
            </button>
          </div>
        )}
      />
      <div ref={rail} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((r, i) => (
          <figure key={i} dir={/[؀-ۿ]/.test(r.text) ? "rtl" : "ltr"} className={`relative shrink-0 snap-start ${card} p-6 ${ctx.compact ? "w-[85%]" : "w-[calc((100%-2rem)/3)]"}`}>
            <svg aria-hidden viewBox="0 0 32 32" className="h-9 w-9 fill-current opacity-30" style={{ color: "var(--sf-primary)" }}>
              <path d="M10 8C6 9.500 4 13 4 17v7h9v-9H8c0-3 1.500-5 4-6L10 8Zm14 0c-4 1.500-6 5-6 9v7h9v-9h-5c0-3 1.500-5 4-6L24 8Z" />
            </svg>
            <blockquote className="mt-3 text-sm leading-relaxed text-sf-text/80">{r.text}</blockquote>
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
  /* with no words at all the store skips it; the designer keeps both places, each with its faint hint, so it can still be clicked */
  const empty = !title?.trim() && !body?.trim();
  if (empty && !ctx.design) return null;
  const center = s.align === "center";
  /* a size or color the merchant chose for one part (otherwise the look's own) */
  const sz = (k: "title" | "body" | "eyebrow" | "button", def: number) => (s.sizes?.[k] ? scaled(s.sizes[k]!, ctx.compact) : def);
  const col = (k: "title" | "body" | "eyebrow" | "button") => s.colors?.[k] || undefined;
  /* The statement: a small Latin line, a big title, a line of text, a button and a row of short promises, all in the middle */
  if (s.style === "statement") {
    const pick = (b?: { en: string; ar: string }) => b?.[ctx.lang] || b?.[other] || "";
    const eyebrow = pick(s.eyebrow);
    const button = pick(s.button);
    const trust = (s.trust ?? []).map(pick).filter(Boolean);
    const btn = "inline-flex min-h-[44px] items-center px-9 py-4 text-[15px] font-bold transition hover:opacity-90";
    const btnStyle = { background: "var(--sf-primary)", color: col("button") || "var(--sf-on)", fontSize: s.sizes?.button || undefined };
    return (
      <section className={ctx.compact ? "px-4 pt-16" : "px-8 pt-28"}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-[22px] text-center">
          {eyebrow && <Pick ctx={ctx} id={id} field="eyebrow"><p dir="auto" style={{ ...latinItalic, fontSize: sz("eyebrow", 22), color: col("eyebrow") || "var(--sf-accent)" , ...tx(s.styles?.eyebrow) }}>{eyebrow}</p></Pick>}
          {(title || empty) && <Pick ctx={ctx} id={id} field="title" block><h2 className="font-semibold leading-tight text-[var(--sf-title)]" style={{ fontFamily: "var(--sf-heading)", fontSize: sz("title", ctx.compact ? 34 : 56), color: col("title") , ...tx(s.styles?.title) }}>{title}</h2></Pick>}
          {(body || empty) && <Pick ctx={ctx} id={id} field="body" block><p className="mx-auto max-w-[560px] text-lg font-light leading-[2] text-sf-text/80" style={{ fontSize: s.sizes?.body || undefined, color: col("body") , ...tx(s.styles?.body) }}>{body}</p></Pick>}
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
          {(title || empty) && (
            <Pick ctx={ctx} id={id} field="title" block>
              <h2 className={`font-extrabold tracking-tight text-[var(--sf-title)] ${ctx.compact ? "text-xl" : "text-2xl"}`} style={{ fontSize: s.sizes?.title ? sz("title", 24) : undefined, color: col("title") , ...tx(s.styles?.title) }}>{title}</h2>
            </Pick>
          )}
          {(body || empty) && (
            <Pick ctx={ctx} id={id} field="body" block>
              <div className={`${title ? "mt-3" : ""} space-y-3 text-[15px] leading-relaxed text-sf-text/75`} style={{ fontSize: s.sizes?.body || undefined, color: col("body") , ...tx(s.styles?.body) }}>
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
  if (!items.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <Heading title={s.title[ctx.lang]} ctx={ctx} />
        <DesignEmpty ctx={ctx} add hint={ctx.lang === "ar" ? "علّم منتجاتك كمميزة لتظهر هنا" : "Mark products as featured to show them here"} />
      </section>
    );
  }
  return (
    <section className={section(ctx.compact)}>
      <Heading title={s.title[ctx.lang]} ctx={ctx} more />
      <Grid items={items} ctx={ctx} columns={4} />
    </section>
  );
}

function Discounts({ s, ctx }: { s: Extract<SectionConfig, { type: "discounts" }>["settings"]; ctx: Ctx }) {
  const items = ctx.data.products.filter((p) => p.sale !== null).slice(0, s.count);
  if (!items.length) {
    if (!ctx.design) return null;
    return (
      <section className={section(ctx.compact)}>
        <Heading title={s.title[ctx.lang]} ctx={ctx} />
        <DesignEmpty ctx={ctx} add hint={ctx.lang === "ar" ? "المنتجات التي لها سعر مخفّض تظهر هنا" : "Products with a discounted price show here"} />
      </section>
    );
  }
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
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${on ? "bg-[var(--sf-primary)] text-[var(--sf-on)] shadow-md" : "bg-white text-sf-text/75 ring-1 ring-black/[0.08] hover:ring-black/20"}`}
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
          <span className="grid h-24 w-24 place-items-center rounded-full text-sf-primary/70" style={{ background: "color-mix(in srgb, var(--sf-primary) 9%, white)" }}>
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
            <p className="mt-4 text-sm font-semibold text-sf-text/60">{q ? c.noMatch : ctx.config.texts.noProducts[ctx.lang] || c.noProducts}</p>
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
        <div className="grid h-16 place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 text-sm font-semibold text-[var(--sf-primary)]">
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
        <div className="grid h-16 place-items-center rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 text-sm font-semibold text-[var(--sf-primary)]">
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
    const list: unknown = JSON.parse(localStorage.getItem(SUBSCRIBERS) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is { email: string; at: number } => !!x && typeof x.email === "string" && !!visitorEmail(x.email)) : [];
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
  const [bad, setBad] = useState(false);
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
  /* the text on a button: white on a dark button color, dark otherwise (and when the color is not one we can read) */
  const textOn = (fill?: string) => (fill && /#[0-9a-f]{6}/i.test(fill) && onColor(fill) === "#ffffff" ? "#ffffff" : "#1c1a17");
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
            noValidate
            className="flex w-full max-w-md flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ctx.design) {
                if (s.after === "popup") setPop(true);
                return;
              }
              if (!ctx.interactive) return;
              const clean = visitorEmail(email);
              setBad(!clean);
              if (!clean) return;
              saveSubscriber(clean);
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
              onChange={(e) => {
                setEmail(e.target.value);
                setBad(false);
              }}
              maxLength={120}
              aria-invalid={bad}
              placeholder={pick(s.placeholder)}
              aria-label={pick(s.placeholder)}
              className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-sm text-[#1c1a17] outline-none placeholder:text-[#1c1a17]/50"
            />
            {/* the button text is dark or white, whichever reads on his button color (a gradient is judged by its first color) */}
            <button type="submit" className="h-12 shrink-0 rounded-full px-6 text-sm font-extrabold transition hover:-translate-y-0.5" style={{ background: s.buttonColor, color: textOn(s.buttonColor) }}>
              {pick(s.button)}
            </button>
            {bad && <p role="alert" className="w-full text-xs font-semibold">{l === "ar" ? "اكتب بريدًا إلكترونيًا صحيحًا، مثل name@example.com" : "Enter a valid email, like name@example.com"}</p>}
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
              <div className="h-44 w-full overflow-hidden"><img src={pp.image} alt="" className="h-full w-full object-cover" style={picFill(pp.imagePos)} /></div>
            )}
            <div className="px-8 pb-8 pt-9">
              <h3 className="text-3xl font-extrabold leading-tight" style={{ fontFamily: "var(--sf-heading)" }}>{popTitle}</h3>
              <p className="mt-3 text-base leading-relaxed opacity-85">{popText}</p>
              <button type="button" onClick={() => setPop(false)} className="mt-6 h-12 rounded-full px-8 text-sm font-extrabold transition hover:-translate-y-0.5" style={{ background: pp?.accent || s.buttonColor, color: textOn(pp?.accent || s.buttonColor), border: "2px solid var(--sf-text)" }}>
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
  return <SectionView key={s.id} s={s} ctx={ctx} />;
}

/* One section. It draws again only when its own settings or what all sections share (ctx) change, not when another section is edited. */
const SectionView = memo(function SectionView({ s, ctx }: { s: SectionConfig; ctx: Ctx }) {
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
    <div data-sf={s.id} className="scroll-mt-20">
      <Selectable id={s.id} name={sectionNames[ctx.lang][s.type]} ctx={ctx}>
        {inner}
      </Selectable>
    </div>
  );
});
