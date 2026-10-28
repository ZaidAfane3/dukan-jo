"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { defaultConfig, footerColumns, heroTitleFamily, radiusValue, type LogoConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, LogoMark, money, moneyIn, onColor, picFill, priceLang, priceOf, resolveLogo } from "./parts";
import { patterns } from "./patterns";
import { linkProps, ProductPage, renderSection, type Ctx, type Design } from "./sections";
import { useMediaUrl } from "./mediaStore";
import { loadFreeDelivery, type FreeDelivery } from "../freeDeliveryStore";
import { fontFamily } from "./config";
import { useStoreData, type StoreProduct } from "./useStoreData";
import { cartQty } from "../safeOrder";
import { CartPanel } from "./Cart";
import { footerColors, footerDim, footerNameSize } from "./footerColors";

type Props = {
  config?: StorefrontConfig;
  /* "auto" follows the width of its own box, so the designer's phone preview works on a big screen */
  device?: "auto" | "desktop" | "mobile";
  /* false turns off search, add to cart and filters, for static previews */
  interactive?: boolean;
  /* Values the designer is editing right now, shown before they are saved */
  store?: { name?: string; description?: string; color?: string; phone?: string };
  /* Only the designer passes this: clicks on parts of the store become "edit this" */
  design?: Design;
  /* Designer only: show sample products while the store has none, so cards can be styled */
  sample?: boolean;
  /* The merchant is looking at his own store: an empty store offers a way to add the first product */
  owner?: boolean;
  /* Show these products instead of the saved ones (theme previews) */
  products?: StoreProduct[];
  /* Designer only: the page of the store to show in place of the home page */
  showPage?: number | null;
  /* Designer only: show the page of the first product (the "product page" of the page menu) */
  showProduct?: boolean;
};

export function StorefrontTheme({ config = defaultConfig, device = "auto", interactive = true, store, design, sample = false, owner = false, products, showPage = null, showProduct = false }: Props) {
  const { lang, setLang } = usePrefs();
  const c = copy[lang];
  const saved = useStoreData(lang, sample);
  /* Kept the same object while nothing in it changes, so the parts of the store that use it do not draw again on every key in the designer */
  const sName = store?.name, sDescription = store?.description, sColor = store?.color, sPhone = store?.phone;
  const data = useMemo(() => ({
    ...saved,
    ...(products ? { products, categories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))), isDemo: false } : {}),
    name: sName?.trim() || saved.name,
    description: sDescription ?? saved.description,
    color: sColor || saved.color,
    phone: sPhone !== undefined ? (sPhone ? `+962 ${sPhone}` : "") : saved.phone,
  }), [saved, products, sName, sDescription, sColor, sPhone]);

  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  /* What is in the basket: how many of each product (by product id) */
  const [fd, setFd] = useState<FreeDelivery>({ on: false, min: 25 });
  useEffect(() => setFd(loadFreeDelivery()), []);
  const [qty, setQtyMap] = useState<Record<number, number>>({});

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const logo = resolveLogo(config.identity.logo, data.logo);
  const bg = config.pageBackground;
  const bgUrl = useMediaUrl(bg.kind === "none" ? "" : bg.media);
  const centered = config.identity.align === "center";
  const compact = device === "mobile" || (device === "auto" && width < 720);
  const primary = config.theme.primary || data.color;

  const setQty = useCallback((p: StoreProduct, n: number) =>
    setQtyMap((m) => {
      const next = { ...m };
      /* Never more than the store has, and a quantity of 0 takes it out of the basket */
      const v = cartQty(n, p.quantity);
      if (v === 0) delete next[p.id];
      else next[p.id] = v;
      return next;
    }), []);
  /* The basket panel: the cart button opens it (not in the designer, where a click edits the header) */
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = () => {
    if (!design && interactive) setCartOpen(true);
  };
  const cartLines = data.products.filter((p) => qty[p.id]).map((p) => ({ p, qty: qty[p.id] }));
  const cart = data.products.reduce((k, p) => ({ count: k.count + (qty[p.id] ?? 0), total: k.total + (qty[p.id] ?? 0) * priceOf(p) }), { count: 0, total: 0 });
  /* A page of the store (an info page) shown in place of the home page */
  const [ownPage, setPageId] = useState<number | null>(null);
  /* In the designer the page shown is chosen by the designer (its page menu, or a button that leads to a page) */
  const pageId = design ? showPage : ownPage;
  /* The page of a product: pressing a product card opens it (in the designer it is the first product, from the page menu) */
  const [ownProduct, setOwnProduct] = useState<number | null>(null);
  const productId = design ? (showProduct ? (products ?? data.products)[0]?.id ?? null : null) : ownProduct;
  const openPage = (id: number) => {
    if (design) return design.openPage?.(id);
    setOwnProduct(null);
    setPageId(id);
    root.current?.scrollIntoView({ block: "start" });
  };
  const openProduct = (id: number) => {
    if (design) return;
    setPageId(null);
    setOwnProduct(id);
    root.current?.scrollIntoView({ block: "start" });
  };
  const closePage = () => {
    setOwnProduct(null);
    if (design) design.openPage?.(null);
    else setPageId(null);
  };
  const shownPage = pageId !== null ? data.pages.find((p) => p.id === pageId) : undefined;
  const shownProduct = productId !== null ? data.products.find((x) => x.id === productId) : undefined;
  /* What the sections are given. It stays the same object while nothing they use changes, so editing one section draws only that
     section again: the sections see only the look (theme, texts, cards) and the products, never the list of sections or the footer,
     and the actions below are stable and always call the newest version. */
  const latest = useRef({ openPage, openProduct, showSection: (_: string) => {}, design });
  latest.current = { ...latest.current, openPage, openProduct, design };
  const openPageS = useCallback((id: number) => latest.current.openPage(id), []);
  const openProductS = useCallback((id: number) => latest.current.openProduct(id), []);
  const showSectionS = useCallback((id: string) => {
    if (!latest.current.design) latest.current.showSection(id);
  }, []);
  const look = useMemo(() => ({ theme: config.theme, texts: config.texts, cards: config.cards }), [config.theme, config.texts, config.cards]);
  const goods = useMemo(() => ({ products: data.products, categories: data.categories, color: data.color, isDemo: data.isDemo }), [data.products, data.categories, data.color, data.isDemo]);
  const ctx: Ctx = useMemo(
    () => ({ lang, compact, data: goods, config: look, design, owner, query, interactive, qty, setQty, openPage: openPageS, openProduct: openProductS, showSection: showSectionS }),
    [lang, compact, goods, look, design, owner, query, interactive, qty, setQty, openPageS, openProductS, showSectionS],
  );

  const vars = {
    "--sf-primary": primary,
    "--sf-on": onColor(primary),
    "--sf-bg": config.theme.background,
    "--sf-text": config.theme.text,
    "--sf-title": config.theme.titleColor || config.theme.text,
    "--sf-r": radiusValue[config.theme.radius],
    /* The same choice of corners, for the other shapes: big cards and blocks, the pictures inside them, and buttons and pills */
    "--sf-r2": { none: "0px", md: "16px", xl: "28px" }[config.theme.radius],
    "--sf-ri": { none: "0px", md: "8px", xl: "20px" }[config.theme.radius],
    "--sf-pill": { none: "0px", md: "12px", xl: "999px" }[config.theme.radius],
    "--sf-accent": config.theme.accent || primary,
    /* The sale badges, sale prices and the basket count: his sale color, or the store color */
    "--sf-sale": config.theme.saleColor || primary,
    "--sf-onsale": onColor(config.theme.saleColor || primary),
    "--sf-heading": fontFamily[config.theme.headingFont || config.theme.font],
    "--sf-sy": config.theme.spacing === "airy" ? "96px" : "40px",
    "--sf-syc": config.theme.spacing === "airy" ? "56px" : "28px",
    "--sf-sb": config.theme.spacing === "airy" ? "16px" : "40px",
    "--sf-sbc": config.theme.spacing === "airy" ? "8px" : "28px",
    background: config.theme.background,
    color: config.theme.text,
    fontFamily: fontFamily[config.theme.font] || undefined,
  } as React.CSSProperties;

  const h = config.header;
  const brandNode = (nameToo: boolean) => (
    <a href="#" onClick={(e) => { e.preventDefault(); if (design) { e.stopPropagation(); design.select("identity"); } }} className={`flex min-w-0 items-center gap-2.5 ${design ? "rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6]" : ""}`}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      {(nameToo || !config.identity.showLogo) && (
        <span className={`flex min-w-0 flex-col ${centered ? "items-center" : ""}`}>
          {config.identity.nameFont ? (
            <span className="truncate font-bold leading-tight" style={{ fontFamily: heroTitleFamily(config.identity.nameFont), color: config.identity.nameColor || undefined, fontSize: compact ? 30 : 40 }}>{data.name}</span>
          ) : (
            <span className={`truncate font-extrabold tracking-tight ${compact ? "text-lg" : "text-xl"}`} style={config.identity.nameColor ? { color: config.identity.nameColor } : undefined}>{data.name}</span>
          )}
          {/* the small line under the name ("FINE JEWELRY"), in an elegant italic */}
          {(config.identity.tagline?.[lang] || config.identity.tagline?.[lang === "ar" ? "en" : "ar"]) && (
            <span dir="auto" className="mt-1 truncate text-sm tracking-[0.2em]" style={{ fontFamily: "var(--font-elegant-latin), Georgia, serif", fontStyle: "italic", color: "var(--sf-accent)" }}>{config.identity.tagline?.[lang] || config.identity.tagline?.[lang === "ar" ? "en" : "ar"]}</span>
          )}
        </span>
      )}
    </a>
  );
  const brand = brandNode(true);

  const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/[0.08] transition hover:ring-black/25";

  const search = h.showSearch && (
    <label className="relative block min-w-[11rem] flex-1">
      <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sf-text/45">{icons.search}</span>
      <input
        value={query}
        onChange={(e) => interactive && setQuery(e.target.value)}
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-11 w-full rounded-full bg-white ps-12 pe-4 text-sm leading-[2] outline-none ring-1 ring-black/[0.08] transition placeholder:text-sf-text/70 focus:ring-2 focus:ring-[var(--sf-primary)]"
      />
    </label>
  );

  const menuBtn = h.showMenu && (
    <button type="button" onClick={() => setMenu(true)} aria-label={c.menu} className={iconBtn}>
      {icons.menu}
    </button>
  );


  const actions = (
    <div className="flex items-center gap-2">
              {h.showCart && (
                <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className="flex h-10 items-center gap-2 rounded-full bg-white ps-3 pe-3 text-sm font-bold ring-1 ring-black/[0.08] transition hover:ring-black/25">
                  <span className="relative">
                    {icons.bag}
                    {cart.count > 0 && (
                      <span className="absolute -end-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold" style={{ background: "var(--sf-sale)", color: "var(--sf-onsale)" }}>
                        {cart.count}
                      </span>
                    )}
                  </span>
                  {!compact && (
                    <span dir="ltr">
                      {moneyIn(cart.total, priceLang(config.theme.prices, lang))} <small className="font-semibold opacity-60">{currency(priceLang(config.theme.prices, lang))}</small>
                    </span>
                  )}
                </button>
              )}
              </div>
  );

  /* The header with a row of links: logo | links | plain icons (account, saved, search, basket) */
  const navLinks = config.nav.style === "links" || config.nav.style === "pill" ? config.nav.links.map((l) => ({ name: l[lang]?.trim() || l[lang === "ar" ? "en" : "ar"]?.trim(), to: l.to, color: l.color })).filter((l) => l.name) : [];
  /* A link takes the visitor to its part of the page, smoothly */
  const goTo = (e: React.MouseEvent, to?: string) => {
    e.preventDefault();
    if (!to) return;
    /* a page of the store, a part of this page, or an address (a web address opens in a new tab; mail and phone in place) */
    const r = resolveLink(to);
    if (!r || r.kind === "dead") return;
    if (r.kind === "page") return openPage(r.id);
    if (r.kind === "section") return showSection(r.id);
    if (design) return;
    if (r.blank) window.open(r.href, "_blank", "noreferrer");
    else window.location.href = r.href;
  };
  /* From a page of the store back to the home page, then to its part */
  const showSection = (to: string) => {
    const scroll = () => root.current?.querySelector(`[data-sf="${CSS.escape(to)}"]`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (pageId !== null || productId !== null) {
      closePage();
      setTimeout(scroll, 60);
    } else scroll();
  };
  latest.current.showSection = showSection;
  const [searchOpen, setSearchOpen] = useState(false);
  const pillHeader = config.nav.style === "pill" && navLinks.length > 0;
  const linksHeader = navLinks.length > 0 && !pillHeader;
  const [navOn, setNavOn] = useState(0);
  /* The pill header: the name in a dark pill, the links in a white pill (the chosen one colored), and a round basket button */
  const pillBrand = (
    <a href="#" onClick={(e) => { e.preventDefault(); if (design) { e.stopPropagation(); design.select("identity"); } }} className="inline-flex items-center gap-2.5 px-5 py-2 text-xl font-extrabold" style={{ background: "var(--sf-text)", color: "var(--sf-bg)", fontFamily: "var(--sf-heading)", borderRadius: "var(--sf-r2)" }}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      {data.name}
    </a>
  );
  /* With the search open, the pill of links turns into the search field in the same place, and the links are hidden until it closes */
  const pillSearch = (
    <label className="flex h-[46px] w-full min-w-[16rem] max-w-md items-center gap-2 border-2 border-[var(--sf-text)] bg-white px-4" style={{ borderRadius: "var(--sf-pill)" }}>
      <span className="shrink-0 text-sf-text/60">{icons.search}</span>
      <input
        autoFocus={!design}
        value={query}
        onChange={(e) => interactive && setQuery(e.target.value)}
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-sf-text/50"
      />
      <button type="button" onClick={() => { setSearchOpen(false); setQuery(""); }} aria-label={c.close} className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-black/[0.06]">
        {icons.close}
      </button>
    </label>
  );
  const pillNav = (
    <nav aria-label={c.pages} className="flex items-center gap-1 border-2 border-[var(--sf-text)] bg-white p-1 text-sm font-bold" style={{ borderRadius: "var(--sf-pill)" }}>
      {navLinks.map((l, i) => (
        <a
          key={i}
          href={l.to ? `#${l.to}` : "#"}
          onClick={(e) => { goTo(e, l.to); setNavOn(i); }}
          className="whitespace-nowrap px-4 py-1.5 transition duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-black/[0.07] active:scale-95"
          style={{ borderRadius: "var(--sf-pill)", ...(l.color ? { color: l.color } : {}), ...(i === navOn ? { background: config.nav.activeColor || "#ff8fb1", color: onColor(config.nav.activeColor || "#ff8fb1") } : {}) }}
        >
          {l.name}
        </a>
      ))}
    </nav>
  );
  /* The other buttons of the header follow their switches in the pill header too: menu, search, account, language */
  const pillIcon = "relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-white transition hover:-translate-y-0.5";
  const pillMenu = h.showMenu && (
    <button type="button" onClick={() => setMenu(true)} aria-label={c.menu} className={pillIcon}>
      {icons.menu}
    </button>
  );
  const pillExtras = (
    <>
      {h.showSearch && (
        <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label={config.texts.search[lang] || c.search} aria-expanded={searchOpen} className={`${pillIcon} ${searchOpen ? "!bg-[var(--sf-text)] !text-[var(--sf-bg)]" : ""}`}>
          {icons.search}
        </button>
      )}
    </>
  );
  const pillCart = h.showCart && (
    <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)]" style={{ background: config.nav.cartColor || "#b9f3d0" }}>
      {icons.bag}
      {cart.count > 0 && <span className="absolute -start-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--sf-text)] px-1 text-[10px] font-extrabold text-[var(--sf-text)]" style={config.theme.saleColor ? { background: "var(--sf-sale)", color: "var(--sf-onsale)" } : { background: "#ff8fb1" }}>{cart.count}</span>}
    </button>
  );
  const plain = "relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--sf-text)] transition hover:bg-black/[0.05]";
  const textCart = config.nav.cartLook === "text";
  const digits = (n: number) => (lang === "ar" ? String(n).replace(/[0-9]/g, (d) => "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"[Number(d)]) : String(n));
  const wordBtn = "inline-flex min-h-[44px] items-center whitespace-nowrap text-sm font-light tracking-[0.04em] transition hover:opacity-70";
  const plainActions = textCart ? (
    <div className="flex items-center justify-end gap-3">
      {h.showSearch && (
        <>
          <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-expanded={searchOpen} className={wordBtn}>{config.texts.search[lang] || c.search}</button>
          <span aria-hidden className="opacity-50">·</span>
        </>
      )}
      <button type="button" className={wordBtn}>{lang === "ar" ? "المفضلة" : "Saved"}</button>
      <span aria-hidden className="opacity-50">·</span>
      {h.showCart && <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className={wordBtn}>{c.cart} <span className="ms-1" style={config.theme.saleColor ? { color: "var(--sf-sale)" } : undefined}>({digits(cart.count)})</span></button>}
    </div>
  ) : (
    <div className="flex items-center justify-end">
      {h.showSearch && (
        <button type="button" onClick={() => setSearchOpen((v) => !v)} aria-label={config.texts.search[lang] || c.search} aria-expanded={searchOpen} className={plain}>
          {icons.search}
        </button>
      )}
      <button type="button" aria-label={c.like} className={plain}>{icons.heart}</button>
      {h.showCart && (
        <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className={plain}>
          {icons.bag}
          {cart.count > 0 && (
            <span className="absolute end-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#1c1a17] px-1 text-[10px] font-bold text-white" style={config.theme.saleColor ? { background: "var(--sf-sale)", color: "var(--sf-onsale)" } : undefined}>{cart.count}</span>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div ref={root} dir={lang === "ar" ? "rtl" : "ltr"} className="store-preview relative isolate overflow-hidden text-[var(--sf-text)]" style={vars}>
      {/* The page background: behind the banners, products and everything else */}
      {bgUrl && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {bg.kind === "video" ? (
            <video src={bgUrl} autoPlay={!reduceMotion} muted loop playsInline preload="auto" className="h-full w-full object-cover" style={picFill(bg.pos)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bgUrl} alt="" className="h-full w-full object-cover" style={picFill(bg.pos)} />
          )}
          <div className="absolute inset-0" style={{ background: config.theme.background, opacity: bg.veil / 100 }} />
        </div>
      )}
      {config.texture.pattern !== "none" && patterns[config.texture.pattern] && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 -z-10 ${{ all: "bottom-0 top-0", below: "bottom-0 top-[40rem]", top: "top-0 h-[48rem]" }[config.texture.area ?? "below"]}`}
          style={{
            opacity: { light: 0.09, medium: 0.16, strong: 0.26 }[config.texture.strength ?? "light"],
            ...((config.texture.fade ?? true) ? { WebkitMaskImage: "linear-gradient(to bottom, #000, transparent)", maskImage: "linear-gradient(to bottom, #000, transparent)" } : {}),
          }}
        >
          <div className="h-full w-full" style={{ background: "var(--sf-accent)", WebkitMaskImage: `url("${patterns[config.texture.pattern].url}")`, maskImage: `url("${patterns[config.texture.pattern].url}")`, WebkitMaskSize: `${patterns[config.texture.pattern].w}px ${patterns[config.texture.pattern].h}px`, maskSize: `${patterns[config.texture.pattern].w}px ${patterns[config.texture.pattern].h}px` }} />
        </div>
      )}
      {data.isDemo && design && <p className="px-4 py-2 text-center text-xs font-medium" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>{c.sample}</p>}

      <AnnouncementBar config={config} lang={lang} design={design} reduceMotion={reduceMotion} offer={freeDeliveryText(fd, lang, cart.total, priceLang(config.theme.prices, lang))} offerColor={primary} linkFor={(l) => linkProps(l, ctx)} />

      <header onClick={() => design?.select("header")} className={`group/sel z-20 ${pillHeader ? "" : config.theme.hairlines ? "border-b border-[color-mix(in_srgb,var(--sf-primary)_25%,transparent)] backdrop-blur-xl" : "border-b border-black/[0.06] backdrop-blur-xl"} ${h.sticky ? "sticky top-0" : "relative"} ${design ? "cursor-pointer" : ""}`} style={{ background: pillHeader ? "color-mix(in srgb, var(--sf-bg) 94%, transparent)" : "color-mix(in srgb, var(--sf-bg) 86%, transparent)" }}>
        {pillHeader ? (
          centered ? (
            /* The name in the middle: menu | name | buttons, and the links under it */
            <div className={compact ? "px-4 py-3" : "px-8 py-4"}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex items-center justify-start gap-2">{pillMenu}</div>
                <div className="min-w-0">{pillBrand}</div>
                <div className="flex items-center justify-end gap-2">{pillExtras}{pillCart}</div>
              </div>
              <div className="mt-3 flex justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{searchOpen && h.showSearch ? pillSearch : pillNav}</div>
            </div>
          ) : compact ? (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">{pillMenu}{pillBrand}</div>
                <div className="flex items-center gap-2">{pillExtras}{pillCart}</div>
              </div>
              <div className="mt-3 flex justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{searchOpen && h.showSearch ? pillSearch : pillNav}</div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-4">
              <div className="flex items-center justify-start gap-2">{pillMenu}{pillBrand}</div>
              {searchOpen && h.showSearch ? pillSearch : pillNav}
              <div className="flex items-center justify-end gap-2">{pillExtras}{pillCart}</div>
            </div>
          )
        ) : linksHeader ? (
          centered && !compact && config.nav.place === "start" ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-7">
              <nav aria-label={c.pages} className="flex items-center justify-start gap-7 text-[14px] font-light tracking-[0.04em]">
                {menuBtn}
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center text-[var(--sf-text)] transition duration-200 hover:text-[var(--sf-primary)]" style={l.color ? { color: l.color } : undefined}>{l.name}</a>
                ))}
              </nav>
              <div className="min-w-0">{brandNode(false)}</div>
              {plainActions}
            </div>
          ) : centered && !compact ? (
            <div className="px-8 py-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center justify-start">{menuBtn}</div>
                <div className="min-w-0">{brandNode(false)}</div>
                <div className="flex items-center justify-end">{plainActions}</div>
              </div>
              <nav aria-label={c.pages} className="mt-2 flex items-center justify-center gap-9 text-[14px]">
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]" style={l.color ? { color: l.color } : undefined}>{l.name}</a>
                ))}
              </nav>
            </div>
          ) : compact && config.nav.place === "start" ? (
            /* on a phone: the name on top, the links and the basket under it */
            <div className="px-4 py-4">
              <div className="flex justify-center">{brandNode(false)}</div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] font-light">
                {menuBtn}
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center" style={l.color ? { color: l.color } : undefined}>{l.name}</a>
                ))}
                {plainActions}
              </div>
            </div>
          ) : compact ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
              <div className="flex items-center justify-start">{menuBtn}</div>
              <div className="min-w-0">{brandNode(false)}</div>
              <div className="flex items-center justify-end">{plainActions}</div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-3">
              <div className="flex items-center justify-start gap-3">{menuBtn}{brandNode(false)}</div>
              <nav aria-label={c.pages} className="flex items-center gap-9 text-[14px]">
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]" style={l.color ? { color: l.color } : undefined}>{l.name}</a>
                ))}
              </nav>
              {plainActions}
            </div>
          )
        ) : centered ? (
          /* Name in the middle: menu | name | account and cart, with the search bar on its own row */
          <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
            <div className="flex items-center justify-start">{menuBtn}</div>
            <div className="min-w-0">{brand}</div>
            <div className="flex items-center justify-end">{actions}</div>
          </div>
        ) : (
          <div className={`flex items-center gap-3 ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
            {menuBtn}
            <div className="shrink-0">{brand}</div>

            {!compact && <div className="mx-auto w-full max-w-xl">{search}</div>}
            {compact && <div className="flex-1" />}

            {actions}
          </div>
        )}
        {linksHeader && searchOpen && h.showSearch && <div className={compact ? "px-4 pb-3" : "mx-auto max-w-xl px-8 pb-4"}>{search}</div>}
        {!linksHeader && !pillHeader && (compact || centered) && h.showSearch && <div className={compact ? "px-4 pb-3" : "mx-auto max-w-xl px-8 pb-4"}>{search}</div>}
        {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "header" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
      </header>

      {!design && interactive && <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} lines={cartLines} products={data.products} setQty={setQty} fd={fd} priceLanguage={priceLang(config.theme.prices, lang)} onCleared={() => setQtyMap({})} pickup={data.pickup} />}
      <main>
        {shownProduct ? (
          <ProductPage p={shownProduct} ctx={ctx} onBack={closePage} />
        ) : shownPage ? (
          <>
            <section className={`${compact ? "px-4 pt-8" : "px-8 pt-12"} ${shownPage.sections.length || design ? "pb-2" : compact ? "min-h-[420px] pb-10" : "min-h-[640px] pb-16"}`}>
              <div className="mx-auto max-w-3xl">
                <button type="button" onClick={closePage} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-accent)] hover:underline">
                  <span className="rotate-180">{icons.arrow}</span>
                  {lang === "ar" ? "العودة إلى المتجر" : "Back to the store"}
                </button>
                <h1 className={`mt-6 font-extrabold leading-tight text-[var(--sf-title)] ${compact ? "text-3xl" : "text-5xl"}`} style={{ fontFamily: "var(--sf-heading)" }}>{shownPage.title}</h1>
                {shownPage.content.trim() && (
                  <div className={`mt-8 space-y-5 leading-[2] text-sf-text/85 ${compact ? "text-base" : "text-lg"}`}>
                    {shownPage.content.split("\n").map((l) => l.trim()).filter((l, i) => l && !(i === 0 && l === shownPage.title)).map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </div>
                )}
              </div>
            </section>
            {/* The elements of the page, built in the designer like the home page */}
            {shownPage.sections.map((s) => renderSection(s, ctx))}
            {design && shownPage.sections.length === 0 && (
              <p className="mx-8 mb-10 mt-4 rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 py-10 text-center text-sm font-semibold text-[var(--sf-primary)]">
                {lang === "ar" ? "الصفحة فارغة: أضف عناصر من القائمة الجانبية" : "The page is empty: add elements from the side panel"}
              </p>
            )}
          </>
        ) : (
          config.sections.map((s) => renderSection(s, ctx))
        )}
      </main>

      <Footer config={config} data={data} compact={compact} lang={lang} design={design} logo={logo} onPage={openPage} onSection={(id) => { if (!design) showSection(id); }} />

      {menu && (
        <div className="absolute inset-0 z-30 flex" role="dialog" aria-modal="true" aria-label={c.menu}>
          <button type="button" aria-label={c.close} onClick={() => setMenu(false)} className="absolute inset-0 bg-black/40" />
          <nav className={`relative z-10 flex h-full w-80 max-w-[85%] flex-col gap-6 overflow-y-auto p-6 shadow-2xl ${config.theme.titleStyle === "pop" ? "border-e-2 border-[var(--sf-text)]" : ""}`} style={{ background: "var(--sf-bg)", color: "var(--sf-text)" }}>
            <div className="flex items-center justify-between">
              {config.nav.style === "pill" ? pillBrand : brand}
              <button type="button" onClick={() => setMenu(false)} aria-label={c.close} className={config.theme.titleStyle === "pop" ? "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-white transition hover:-translate-y-0.5" : iconBtn}>
                {icons.close}
              </button>
            </div>
            {config.drawer.items.filter((it) => it.visible).map((it) => {
              const rows: { key: string | number; title: string; on: () => void; color?: string }[] =
                it.kind === "categories"
                  ? data.categories.map((name) => ({ key: name, title: name, on: () => setMenu(false) }))
                  : it.kind === "pages"
                    ? data.links.map((l) => ({ key: l.id, title: l.title, on: () => { setMenu(false); openPage(l.id); } }))
                    : it.kind === "custom"
                      ? (config.drawer.custom ?? [])
                          /* trimmed first, so a label of only spaces counts as empty and the other language is used */
                          .filter((x) => x.visible && (x.label[lang]?.trim() || x.label[lang === "ar" ? "en" : "ar"]?.trim()))
                          .map((x) => ({
                            key: x.id,
                            title: x.label[lang]?.trim() || x.label[lang === "ar" ? "en" : "ar"]?.trim() || "",
                            on: () => {
                              setMenu(false);
                              if (design || !x.link.trim()) return;
                              /* the same rules as every button: a store page, a part of the page, or a web address */
                              const lp = linkProps(x.link, ctx);
                              if (lp.onClick) lp.onClick({ preventDefault() {} } as React.MouseEvent<HTMLAnchorElement>);
                              else if (lp.href) window.open(lp.href, "_blank", "noreferrer");
                            },
                          }))
                    : navLinks.map((l, i) => ({ key: i, title: l.name, color: l.color, on: () => { setMenu(false); goTo({ preventDefault() {} } as React.MouseEvent, l.to); } }));
              if (!rows.length) return null;
              return (
                <div key={it.kind}>
                  <p className={config.theme.titleStyle === "pop" ? "mb-3 text-lg font-extrabold" : "mb-2 text-xs font-bold uppercase tracking-wide text-sf-text/50"} style={config.theme.titleStyle === "pop" ? { color: "var(--sf-accent)", fontFamily: "var(--sf-heading)" } : undefined}>{it.kind === "categories" ? c.categories : it.kind === "pages" ? c.pages : it.kind === "custom" ? (lang === "ar" ? "روابط" : "Links") : lang === "ar" ? "روابط المتجر" : "Store links"}</p>
                  <ul className={config.theme.titleStyle === "pop" ? "space-y-2" : "space-y-1"}>
                    {rows.map((r) => (
                      <li key={r.key}>
                        <button type="button" onClick={r.on} className={config.theme.titleStyle === "pop" ? "w-full rounded-full border-2 border-[var(--sf-text)] bg-white px-5 py-2.5 text-start text-base font-bold transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02]" : "w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition duration-200 hover:bg-black/[0.05] hover:ps-4"} style={r.color ? { color: r.color } : undefined}>
                          {r.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

/* The "free delivery above ..." offer from the Marketing menu, worded for the customer's basket:
   the offer itself, how much is left to add, or that the order already gets it. */
function freeDeliveryText(fd: FreeDelivery, lang: "en" | "ar", total: number, prices: "en" | "ar"): string {
  if (!fd.on) return "";
  const ar = lang === "ar";
  const cur = currency(prices);
  const money = (n: number) => moneyIn(n, prices);
  const left = fd.min - total;
  if (total <= 0) return ar ? `توصيل مجاني للطلبات فوق ${money(fd.min)} ${cur}` : `Free delivery on orders above ${money(fd.min)} ${cur}`;
  if (left > 0) return ar ? `أضف ${money(left)} ${cur} للحصول على توصيل مجاني` : `Add ${money(left)} ${cur} more for free delivery`;
  return ar ? "طلبك يحصل على توصيل مجاني" : "Your order gets free delivery";
}

function AnnouncementBar({ config, lang, design, reduceMotion, offer, offerColor, linkFor }: { config: StorefrontConfig; lang: "en" | "ar"; design?: Design; reduceMotion: boolean; offer: string; offerColor: string; linkFor: (link: string) => React.AnchorHTMLAttributes<HTMLAnchorElement> }) {
  const other = lang === "ar" ? "en" : "ar";
  const a = config.announcement;
  const own = a.show ? a.messages.map((m) => ({ ...m, label: m.text[lang] || m.text[other] })).filter((m) => m.label.trim()) : [];
  /* The free delivery offer is one more message of the same bar, so there is never a second bar */
  const list = offer ? [...own, { text: { en: offer, ar: offer }, link: "", color: offerColor, textColor: "", label: offer }] : own;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const rotate = a.motion === "fade" && list.length > 1 && !reduceMotion;
  useEffect(() => {
    if (!rotate || paused) return;
    const id = setInterval(() => setI((n) => n + 1), Math.max(2, a.seconds) * 1000);
    return () => clearInterval(id);
  }, [rotate, paused, a.seconds]);

  if (!list.length) return null;
  const item = (m: (typeof list)[number], key: string, extra = "") => {
    const color = m.textColor || onColor(m.color);
    const lead = m.link && m.link.trim() && !design;
    return lead ? (
      <a key={key} {...linkFor(m.link)} className={`underline-offset-2 hover:underline ${extra}`} style={{ color }}>{m.label}</a>
    ) : (
      <span key={key} className={extra} style={{ color }}>{m.label}</span>
    );
  };

  const wrap = `overflow-hidden text-sm font-semibold transition-colors duration-500 ${design ? "cursor-pointer" : ""}`;

  /* A ticker: every message slides across, over and over, and stops while the mouse is over it */
  if (a.motion === "ticker" && !reduceMotion) {
    const chars = list.reduce((n, m) => n + m.label.length, 0);
    const copy = (k: string) => (
      <div key={k} className="flex shrink-0 items-center" aria-hidden={k !== "a"}>
        {[0, 1, 2].map((r) => list.map((m, n) => (
          <span key={`${r}-${n}`} className="flex items-center">
            {item(m, `${k}${r}${n}`, "px-8")}
            <span aria-hidden className="opacity-50" style={{ color: m.textColor || onColor(m.color) }}>•</span>
          </span>
        )))}
      </div>
    );
    return (
      <div role="note" dir="ltr" onClick={() => design?.select("announcement")} className={`dk-ticker py-2 ${wrap}`} style={{ background: list[0].color }}>
        <div className={`dk-marquee flex w-max ${lang === "ar" ? "dk-marquee-rev" : ""}`} style={{ "--dk-d": `${Math.max(20, Math.round(chars * 0.9 * 3 / 2))}s` } as React.CSSProperties}>
          {copy("a")}
          {copy("b")}
        </div>
      </div>
    );
  }

  const m = list[(rotate ? i : 0) % list.length];
  return (
    <div
      role="note"
      onClick={() => design?.select("announcement")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`px-4 py-2 text-center ${wrap}`}
      style={{ background: m.color }}
    >
      <div key={rotate ? i : 0} className={rotate ? "dk-ann-in" : ""}>{item(m, "m")}</div>
    </div>
  );
}

/* Where a link the merchant wrote leads: a page of the store ("page:5", "dead" when that page is gone), a part of the page, or an address.
   mailto:, tel:, sms: and whatsapp: stay as written (in the same tab); a bare email or phone number becomes one; "@name" in a social
   field becomes that network's profile; javascript:/data: and loose words (spaces, no dot) are not links. */
type Resolved = { kind: "page"; id: number } | { kind: "section"; id: string } | { kind: "url"; href: string; blank: boolean } | { kind: "dead" } | null;
type Network = "instagram" | "facebook" | "x" | "youtube" | "snapchat" | "tiktok";
const profileOf: Record<Network, string> = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", x: "https://x.com/", youtube: "https://youtube.com/@", snapchat: "https://snapchat.com/add/", tiktok: "https://tiktok.com/@" };
function resolveLink(raw: string, opts: { pages?: number[]; sections?: string[]; social?: Network } = {}): Resolved {
  const l = (raw ?? "").trim();
  if (!l) return null;
  const pg = /^page:(\d+)$/.exec(l);
  if (pg) return !opts.pages || opts.pages.includes(Number(pg[1])) ? { kind: "page", id: Number(pg[1]) } : { kind: "dead" };
  if (/^(javascript|data|vbscript|file):/i.test(l)) return null;
  if (/^(mailto|tel|sms|whatsapp):/i.test(l)) return { kind: "url", href: l, blank: false };
  if (/^https?:\/\//i.test(l)) return /\s/.test(l) ? null : { kind: "url", href: l, blank: true };
  if (opts.social && /^@?[\w.-]+$/.test(l) && (l.startsWith("@") || !l.includes("."))) return { kind: "url", href: profileOf[opts.social] + l.replace(/^@/, ""), blank: true };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l)) return { kind: "url", href: `mailto:${l}`, blank: false };
  if (/^\+?[\d\s\-().]+$/.test(l) && l.replace(/\D/g, "").length >= 7) return { kind: "url", href: `tel:${l.startsWith("+") ? "+" : ""}${l.replace(/\D/g, "")}`, blank: false };
  if (/\s/.test(l)) return null;
  if (!l.includes(".")) return !opts.sections || opts.sections.includes(l) ? { kind: "section", id: l } : null;
  return { kind: "url", href: `https://${l}`, blank: true };
}

/* The contact lines as links: WhatsApp and Telegram open the chat (a local 07… number gets Jordan's 962) */
const digitsOf = (s: string) => s.replace(/\D/g, "");
const whatsappHref = (s: string) => {
  const v = s.trim();
  if (/^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(v)) return /^https?:/i.test(v) ? v : `https://${v}`;
  let d = digitsOf(v);
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `962${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : "";
};
const telegramHref = (s: string) => {
  const v = s.trim();
  if (/^(https?:\/\/)?(t|telegram)\.me\//i.test(v)) return /^https?:/i.test(v) ? v : `https://${v}`;
  if (/^\+?[\d\s-]+$/.test(v) && digitsOf(v).length >= 7) return `https://t.me/+${digitsOf(v)}`;
  const h = v.replace(/^@/, "");
  return /^\w{3,}$/.test(h) ? `https://t.me/${h}` : "";
};

function Footer({ config, data, compact, lang, design, logo, onPage, onSection }: { config: StorefrontConfig; data: ReturnType<typeof useStoreData>; compact: boolean; lang: "en" | "ar"; design?: Design; logo: LogoConfig; onPage: (id: number) => void; onSection: (id: string) => void }) {
  const c = copy[lang];
  const f = config.footer;
  const simple = f.style === "simple";
  const other = lang === "ar" ? "en" : "ar";
  /* A text in the page's language, or the other one when it is only written there */
  const bi = (v?: { en: string; ar: string }) => v?.[lang]?.trim() || v?.[other]?.trim() || "";
  /* The sizes of the footer's texts, in px */
  const sizeTitle = f.sizes?.title ?? 14;
  const sizeText = f.sizes?.text ?? 14;
  const sizeName = footerNameSize(config, f.style);
  /* A title of a column: the merchant's word, or the default one */
  const word = (k: "pages" | "contact" | "follow" | "licenses") => bi(f.labels?.[k]) || c[k];
  /* The colors drawn (footerColors, the same the designer shows): the text reads on the background whatever the merchant picks.
     It is also the footer's `color`, so dimmed lines follow it; they stay readable (footerDim). */
  const fc = footerColors(config, data.color);
  const dim = (pct: number) => footerDim(fc, pct);
  const ownVars = {
    "--sf-text": fc.text,
    "--sf-title": fc.title,
    "--sf-primary": fc.primary,
    "--sf-accent": fc.primary,
    "--sf-on": fc.onPrimary,
    color: fc.text,
    ...(fc.shadow ? { textShadow: fc.dark ? "0 1px 2px rgba(0,0,0,.55)" : "0 1px 2px rgba(255,255,255,.7)" } : {}),
  } as React.CSSProperties;
  /* In the designer a click on a text opens its field in the side panel */
  const edit = (field?: string) => (design ? (e: React.MouseEvent) => { e.stopPropagation(); design.select(field === "name" ? "identity" : "footer", field === "name" ? undefined : field); } : undefined);
  const hot = design ? "cursor-pointer rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6]" : "";
  /* the same, for pieces with corners of their own (icons, the badge) */
  const hotShape = hot.replace("rounded-md ", "");
  const newTab = <span className="sr-only"> ({c.newTab})</span>;

  /* The links: a page that is gone is left out for visitors (the designer shows it struck through) */
  const pageIds = data.pages.map((p) => p.id);
  const sectionIds = [...config.sections.map((s) => s.id), "footer"];
  type Item = { key: string; title: string; to: Resolved };
  const items = (list: { id: string; label: { en: string; ar: string }; link: string; visible: boolean }[] | undefined): Item[] =>
    (list ?? [])
      .filter((x) => x.visible && bi(x.label))
      .map((x) => ({ key: x.id, title: bi(x.label), to: resolveLink(x.link, { pages: pageIds, sections: sectionIds }) }))
      .filter((x) => design || x.to?.kind !== "dead");
  /* The pages column: the pages of the store, then the merchant's own links. Its switch hides all of it. */
  const pageItems: Item[] = f.showLinks ? [...data.links.map((l) => ({ key: `p${l.id}`, title: l.title, to: { kind: "page", id: l.id } as Resolved })), ...items(f.tabs)] : [];
  const aProps = (to: Resolved): React.AnchorHTMLAttributes<HTMLAnchorElement> | null => {
    if (!to || to.kind === "dead") return null;
    if (design) return { href: "#", onClick: (e) => e.preventDefault() };
    if (to.kind === "page") return { href: "#", onClick: (e) => { e.preventDefault(); onPage(to.id); } };
    if (to.kind === "section") return { href: `#${to.id}`, onClick: (e) => { e.preventDefault(); onSection(to.id); } };
    return to.blank ? { href: to.href, target: "_blank", rel: "noreferrer" } : { href: to.href };
  };

  const networks: Network[] = ["instagram", "facebook", "x", "youtube", "snapchat", "tiktok"];
  const socials = networks.flatMap((key, i) => {
    const to = resolveLink(f.social[key] ?? "", { social: key });
    return to?.kind === "url" ? [{ key, href: to.href, blank: to.blank, icon: icons.social[i] }] : [];
  });
  type Line = { key: string; icon: React.ReactNode; text: string; ltr: boolean; href: string; blank?: boolean };
  const tel = resolveLink(data.phone);
  const mail = resolveLink(f.email);
  const address = bi(f.address);
  const contactLines: Line[] = ([
    data.phone && { key: "phone", icon: icons.phone, text: data.phone, ltr: true, href: tel?.kind === "url" && tel.href.startsWith("tel:") ? tel.href : "" },
    f.whatsapp?.trim() && { key: "whatsapp", icon: icons.whatsapp, text: f.whatsapp, ltr: true, href: whatsappHref(f.whatsapp), blank: true },
    f.telegram?.trim() && { key: "telegram", icon: icons.telegram, text: f.telegram, ltr: true, href: telegramHref(f.telegram), blank: true },
    f.email?.trim() && { key: "email", icon: icons.mail, text: f.email, ltr: true, href: mail?.kind === "url" && mail.href.startsWith("mailto:") ? mail.href : "" },
    address && { key: "address", icon: icons.pin, text: address, ltr: false, href: "" },
  ] as (Line | false | "" | undefined)[]).filter((x): x is Line => !!x);
  /* The about text; the store's description only when the field was never set (a cleared text stays empty) */
  const aboutText = f.about == null ? data.description : bi(f.about);

  const cert = f.certificate;
  const certOther = cert.kind === "other" ? cert.label.trim() : "";
  const hasCertificate = !!(cert.number.trim() || cert.logo || certOther);
  /* The words of the badge show with a number or a name of his own; a logo alone is named for screen readers */
  const certText = cert.number.trim() || certOther ? certOther || c.certificate[cert.kind] : "";
  const certLink = resolveLink(cert.url);
  const certUrl = certLink?.kind === "url" ? certLink : null;

  const ownCols = new Map(footerColumns(f).filter((x) => x.kind === "custom").map((x) => [x.id, items(x.links)]));
  /* The columns, in the order the merchant chose. Visitors only see a column with something in it; the designer also shows empty ones. */
  const shown = footerColumns(f).filter((col) => {
    if (col.visible === false) return false;
    if (col.kind === "about") return !!(f.showLogo || aboutText);
    if (col.kind === "pages") return f.showLinks && (pageItems.length > 0 || !!design);
    if (col.kind === "contact") return f.showContact && (contactLines.length > 0 || !!design);
    if (col.kind === "social") return f.showSocial && (socials.length > 0 || !!design);
    if (col.kind === "licenses") return hasCertificate;
    return (ownCols.get(col.id)?.length ?? 0) > 0 || !!design;
  });

  /* The parts both styles share */
  const heading = (text: string) => text && <h2 className={`${simple ? "mb-2" : "mb-3"} font-extrabold`} style={{ fontSize: sizeTitle, color: "var(--sf-title)" }}>{text}</h2>;
  const brand = f.showLogo && (
    <div onClick={edit("name")} className={`inline-flex min-w-0 max-w-full items-center gap-2.5 font-extrabold ${hot}`} style={{ fontFamily: config.identity.nameFont ? heroTitleFamily(config.identity.nameFont) : "var(--sf-heading)", fontSize: sizeName, color: fc.name || undefined }}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      <span className="min-w-0">{data.name}</span>
    </div>
  );
  const textSize = simple ? undefined : sizeText;
  const linkList = (label: string, list: Item[]) => (
    <nav aria-label={label || c.pages}>
      <ul className={simple ? "flex flex-wrap items-center gap-x-6 gap-y-2 font-medium" : "space-y-2"} style={{ color: dim(simple ? 75 : 70), fontSize: textSize }}>
        {design && list.length === 0 && <li className="opacity-50">—</li>}
        {list.map((l) => {
          const p = aProps(l.to);
          return (
            <li key={l.key}>
              {p ? (
                <a {...p} className="transition hover:text-[var(--sf-primary)]">{l.title}{p.target && newTab}</a>
              ) : l.to?.kind === "dead" ? (
                <span className="line-through opacity-50" title={c.missingPage}>{l.title}</span>
              ) : (
                <span>{l.title}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
  const contactList = (
    <ul className={simple ? "space-y-2.5" : "space-y-2"} style={{ color: dim(simple ? 75 : 70), fontSize: textSize }}>
      {design && contactLines.length === 0 && <li className="opacity-50">—</li>}
      {contactLines.map((x) => {
        const body = (
          <>
            <span className="shrink-0">{x.icon}</span>
            <span dir={x.ltr ? "ltr" : undefined} className="min-w-0">{x.text}</span>
          </>
        );
        return (
          <li key={x.key} onClick={edit(x.key)} className={`flex min-w-0 items-center gap-2 ${hot}`}>
            {x.href && !design ? (
              <a href={x.href} {...(x.blank ? { target: "_blank", rel: "noreferrer" } : {})} className="flex min-w-0 items-center gap-2 transition hover:text-[var(--sf-primary)]">{body}{x.blank && newTab}</a>
            ) : body}
          </li>
        );
      })}
    </ul>
  );
  const chip = simple
    ? "grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--sf-text)] text-[var(--sf-text)]"
    : `grid h-10 w-10 place-items-center rounded-full text-[var(--sf-primary)] ring-1 ${fc.dark ? "bg-white/10 ring-white/15" : "bg-white ring-black/[0.08]"}`;
  const socialList =
    socials.length === 0 ? (
      /* no accounts yet: the networks, dimmed, in the designer only */
      <ul aria-hidden className="flex flex-wrap gap-2 opacity-40">
        {icons.social.map((icon, k) => <li key={k} onClick={edit(`social-${networks[k]}`)} className={`${chip} ${hotShape}`}>{icon}</li>)}
      </ul>
    ) : (
      <ul className="flex flex-wrap gap-2">
        {socials.map((x) => (
          <li key={x.key}>
            <a href={x.href} {...(x.blank ? { target: "_blank", rel: "noreferrer" } : {})} aria-label={x.blank ? `${c.networks[x.key]} (${c.newTab})` : c.networks[x.key]} onClick={design ? (e) => { e.preventDefault(); edit(`social-${x.key}`)?.(e); } : undefined} className={`${chip} ${hotShape} transition hover:-translate-y-0.5`}>
              {x.icon}
            </a>
          </li>
        ))}
      </ul>
    );
  const certBody = (
    <>
      {cert.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cert.logo} alt={certText ? "" : certOther || c.licenses} className={simple ? "h-8 w-auto max-w-[5rem] object-contain" : "h-9 w-auto max-w-[5.5rem] object-contain"} />
      ) : (
        <span className="shrink-0 text-[var(--sf-primary)]">{icons.shield}</span>
      )}
      {certText && (
        <span className="min-w-0">
          {certText}
          {cert.number.trim() && <> <span dir="ltr">{cert.number}</span></>}
        </span>
      )}
    </>
  );
  const certCls = simple ? "flex max-w-full items-center gap-2 text-xs font-semibold" : `inline-flex max-w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold ring-1 ${fc.dark ? "bg-white/10 ring-white/15" : "bg-white ring-black/[0.08]"}`;
  const certBadge = certUrl ? (
    <a href={certUrl.href} {...(certUrl.blank ? { target: "_blank", rel: "noreferrer" } : {})} onClick={design ? (e) => { e.preventDefault(); edit("licenses")?.(e); } : undefined} className={`${certCls} ${hotShape} transition hover:-translate-y-0.5`} style={simple ? { color: dim(75) } : undefined}>{certBody}{certUrl.blank && newTab}</a>
  ) : (
    <div onClick={edit("licenses")} className={`${certCls} ${hotShape}`} style={simple ? { color: dim(75) } : undefined}>{certBody}</div>
  );

  /* One column: its title and its content */
  const column = (col: (typeof shown)[number]) => {
    const cls = "min-w-0 [overflow-wrap:anywhere]";
    if (col.kind === "about")
      return (
        <div key={col.id} className={`${cls} ${simple ? "max-w-xs" : ""}`} style={!simple && !compact ? { gridColumn: "span 2" } : undefined}>
          {brand}
          {aboutText && <p onClick={edit("about")} className={`${simple ? "mt-2" : "mt-3 max-w-sm"} block leading-relaxed ${hot}`} style={{ color: dim(simple ? 70 : 65), fontSize: textSize }}>{aboutText}</p>}
        </div>
      );
    if (col.kind === "pages" || col.kind === "custom") {
      const title = col.kind === "pages" ? word("pages") : bi(col.title);
      return (
        <div key={col.id} className={cls}>
          {heading(title)}
          {linkList(title, col.kind === "pages" ? pageItems : ownCols.get(col.id) ?? [])}
        </div>
      );
    }
    if (col.kind === "contact")
      return (
        <div key={col.id} className={cls}>
          {heading(word("contact"))}
          {contactList}
        </div>
      );
    if (col.kind === "social")
      return (
        <div key={col.id} className={cls}>
          {heading(word("follow"))}
          {socialList}
        </div>
      );
    return (
      <div key={col.id} onClick={edit("licenses")} className={cls}>
        {heading(word("licenses"))}
        {certBadge}
      </div>
    );
  };

  const ring = design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "footer" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />;
  /* The copyright line and "Made with Dukkan" are fixed. The merchant can neither change nor remove them. */
  const bottom = (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-t text-xs ${simple ? "border-sf-text/10" : fc.dark ? "border-white/10" : "border-black/[0.06]"} ${compact ? "px-4 py-4" : "px-8 py-5"}`} style={{ color: dim(55) }}>
      <span>{`© ${new Date().getFullYear()} ${data.name}. ${c.rights}`}</span>
      <span>{c.made}</span>
    </div>
  );

  /* The simple footer: the columns in one row that wraps, then the copyright line */
  if (simple)
    return (
      <footer data-sf="footer" onClick={() => design?.select("footer")} className={`group/sel relative ${config.theme.hairlines ? "mt-24 border-t border-[color-mix(in_srgb,var(--sf-primary)_25%,transparent)]" : "mt-6"} ${design ? "cursor-pointer" : ""}`} style={{ background: fc.autoBg ? "transparent" : fc.bg, ...ownVars }}>
        <div className={`flex flex-wrap items-start justify-between gap-x-10 gap-y-5 ${compact ? "px-4 py-6" : "px-8 py-8"}`} style={{ fontSize: sizeText }}>
          {shown.map(column)}
        </div>
        {ring}
        {bottom}
      </footer>
    );
  /* The full footer: columns that wrap onto more rows (the about column twice as wide), one under the other on a phone */
  return (
    <footer data-sf="footer" onClick={() => design?.select("footer")} className={`group/sel relative mt-6 ${config.theme.hairlines ? "border-t border-[color-mix(in_srgb,var(--sf-primary)_25%,transparent)]" : ""} ${design ? "cursor-pointer" : ""}`} style={{ background: fc.bg, ...ownVars }}>
      <div className={`grid gap-8 ${compact ? "grid-cols-1 px-4 py-9" : "px-8 py-12"}`} style={compact ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {shown.map(column)}
      </div>
      {ring}
      {bottom}
    </footer>
  );
}
