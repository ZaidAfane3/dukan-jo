"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { defaultConfig, footerColumns, heroTitleFamily, radiusValue, type LogoConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, LogoMark, money, moneyIn, onColor, priceLang, priceOf, resolveLogo } from "./parts";
import { patterns } from "./patterns";
import { linkProps, ProductPage, renderSection, type Ctx, type Design } from "./sections";
import { useMediaUrl } from "./mediaStore";
import { loadFreeDelivery, type FreeDelivery } from "../freeDeliveryStore";
import { fontFamily } from "./config";
import { useStoreData, type StoreProduct } from "./useStoreData";

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
  const data = {
    ...saved,
    ...(products ? { products, categories: Array.from(new Set(products.map((p) => p.category).filter(Boolean))), isDemo: false } : {}),
    name: store?.name?.trim() || saved.name,
    description: store?.description ?? saved.description,
    color: store?.color || saved.color,
    phone: store?.phone !== undefined ? (store.phone ? `+962 ${store.phone}` : "") : saved.phone,
  };

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

  const setQty = (p: StoreProduct, n: number) =>
    setQtyMap((m) => {
      const next = { ...m };
      /* Never more than the store has, and a quantity of 0 takes it out of the basket */
      const v = Math.max(0, Math.min(n, p.quantity));
      if (v === 0) delete next[p.id];
      else next[p.id] = v;
      return next;
    });
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
  const ctx: Ctx = { lang, compact, data, config, design, owner, query, interactive, qty, setQty, openPage, openProduct, showSection: (id) => !design && showSection(id) };

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
    "--sf-heading": fontFamily[config.theme.headingFont || config.theme.font],
    "--sf-sy": config.theme.spacing === "airy" ? "6rem" : "2.5rem",
    "--sf-syc": config.theme.spacing === "airy" ? "3.5rem" : "1.75rem",
    "--sf-sb": config.theme.spacing === "airy" ? "1rem" : "2.5rem",
    "--sf-sbc": config.theme.spacing === "airy" ? "0.5rem" : "1.75rem",
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
      <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--sf-text)]/45">{icons.search}</span>
      <input
        value={query}
        onChange={(e) => interactive && setQuery(e.target.value)}
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-11 w-full rounded-full bg-white ps-12 pe-4 text-sm leading-[2] outline-none ring-1 ring-black/[0.08] transition placeholder:text-[var(--sf-text)]/70 focus:ring-2 focus:ring-[var(--sf-primary)]"
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
                <button type="button" aria-label={`${c.cart}: ${cart.count}`} className="flex h-10 items-center gap-2 rounded-full bg-white ps-3 pe-3 text-sm font-bold ring-1 ring-black/[0.08] transition hover:ring-black/25">
                  <span className="relative">
                    {icons.bag}
                    {cart.count > 0 && (
                      <span className="absolute -end-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>
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
  const navLinks = config.nav.style === "links" || config.nav.style === "pill" ? config.nav.links.map((l) => ({ name: l[lang] || l[lang === "ar" ? "en" : "ar"], to: l.to })).filter((l) => l.name) : [];
  /* A link takes the visitor to its part of the page, smoothly */
  const goTo = (e: React.MouseEvent, to?: string) => {
    e.preventDefault();
    if (!to) return;
    const pg = /^page:(\d+)$/.exec(to);
    if (pg) return openPage(Number(pg[1]));
    /* a web address opens in a new tab; anything else is a part of this page */
    if (/^https?:\/\//i.test(to) || to.includes(".")) {
      if (!design) window.open(/^https?:\/\//i.test(to) ? to : `https://${to}`, "_blank", "noreferrer");
      return;
    }
    showSection(to);
  };
  /* From a page of the store back to the home page, then to its part */
  const showSection = (to: string) => {
    const scroll = () => root.current?.querySelector(`[data-sf="${to}"]`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (pageId !== null || productId !== null) {
      closePage();
      setTimeout(scroll, 60);
    } else scroll();
  };
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
      <span className="shrink-0 text-[var(--sf-text)]/60">{icons.search}</span>
      <input
        autoFocus={!design}
        value={query}
        onChange={(e) => interactive && setQuery(e.target.value)}
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--sf-text)]/50"
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
          style={{ borderRadius: "var(--sf-pill)", ...(i === navOn ? { background: config.nav.activeColor || "#ff8fb1", color: onColor(config.nav.activeColor || "#ff8fb1") } : {}) }}
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
    <button type="button" aria-label={`${c.cart}: ${cart.count}`} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)]" style={{ background: config.nav.cartColor || "#b9f3d0" }}>
      {icons.bag}
      {cart.count > 0 && <span className="absolute -start-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--sf-text)] px-1 text-[10px] font-extrabold text-[var(--sf-text)]" style={{ background: "#ff8fb1" }}>{cart.count}</span>}
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
      {h.showCart && <button type="button" aria-label={`${c.cart}: ${cart.count}`} className={wordBtn}>{`${c.cart} (${digits(cart.count)})`}</button>}
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
        <button type="button" aria-label={`${c.cart}: ${cart.count}`} className={plain}>
          {icons.bag}
          {cart.count > 0 && (
            <span className="absolute end-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#1c1a17] px-1 text-[10px] font-bold text-white">{cart.count}</span>
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
            <video src={bgUrl} autoPlay={!reduceMotion} muted loop playsInline preload="auto" className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bgUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: config.theme.background, opacity: bg.veil / 100 }} />
        </div>
      )}
      {config.texture.pattern !== "none" && patterns[config.texture.pattern] && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-[40rem] -z-10 opacity-[0.09]" style={{ WebkitMaskImage: "linear-gradient(to bottom, #000, transparent)", maskImage: "linear-gradient(to bottom, #000, transparent)" }}>
          <div className="h-full w-full" style={{ background: "var(--sf-accent)", WebkitMaskImage: `url("${patterns[config.texture.pattern].url}")`, maskImage: `url("${patterns[config.texture.pattern].url}")`, WebkitMaskSize: `${patterns[config.texture.pattern].w}px ${patterns[config.texture.pattern].h}px`, maskSize: `${patterns[config.texture.pattern].w}px ${patterns[config.texture.pattern].h}px` }} />
        </div>
      )}
      {data.isDemo && design && <p className="px-4 py-2 text-center text-xs font-medium" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>{c.sample}</p>}

      <AnnouncementBar config={config} lang={lang} design={design} reduceMotion={reduceMotion} offer={freeDeliveryText(fd, lang, cart.total)} offerColor={primary} linkFor={(l) => linkProps(l, ctx)} />

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
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center text-[var(--sf-text)] transition duration-200 hover:text-[var(--sf-primary)]">{l.name}</a>
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
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]">{l.name}</a>
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
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center">{l.name}</a>
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
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]">{l.name}</a>
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

      <main>
        {shownProduct ? (
          <ProductPage p={shownProduct} ctx={ctx} onBack={closePage} />
        ) : shownPage ? (
          <>
            <section className={`${compact ? "px-4 pt-8" : "px-8 pt-12"} ${shownPage.sections.length || design ? "pb-2" : compact ? "min-h-[420px] pb-10" : "min-h-[640px] pb-16"}`}>
              <div className="mx-auto max-w-3xl">
                <button type="button" onClick={closePage} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-accent)] hover:underline">
                  <span className={lang === "ar" ? "" : "rotate-180"}>{icons.arrow}</span>
                  {lang === "ar" ? "العودة إلى المتجر" : "Back to the store"}
                </button>
                <h1 className={`mt-6 font-extrabold leading-tight text-[var(--sf-title)] ${compact ? "text-3xl" : "text-5xl"}`} style={{ fontFamily: "var(--sf-heading)" }}>{shownPage.title}</h1>
                {shownPage.content.trim() && (
                  <div className={`mt-8 space-y-5 leading-[2] text-[var(--sf-text)]/85 ${compact ? "text-base" : "text-lg"}`}>
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
              <p className="mx-8 mb-10 mt-4 rounded-[var(--sf-r)] border-2 border-dashed border-[var(--sf-primary)]/40 py-10 text-center text-sm font-semibold text-[var(--sf-primary)]">
                {lang === "ar" ? "الصفحة فارغة: أضف عناصر من القائمة الجانبية" : "The page is empty: add elements from the side panel"}
              </p>
            )}
          </>
        ) : (
          config.sections.map((s) => renderSection(s, ctx))
        )}
      </main>

      <Footer config={config} data={data} compact={compact} lang={lang} design={design} logo={logo} onPage={openPage} linkFor={(l) => linkProps(l, ctx)} />

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
              const rows: { key: string | number; title: string; on: () => void }[] =
                it.kind === "categories"
                  ? data.categories.map((name) => ({ key: name, title: name, on: () => setMenu(false) }))
                  : it.kind === "pages"
                    ? data.links.map((l) => ({ key: l.id, title: l.title, on: () => { setMenu(false); openPage(l.id); } }))
                    : it.kind === "custom"
                      ? (config.drawer.custom ?? [])
                          .filter((x) => x.visible && (x.label[lang] || x.label[lang === "ar" ? "en" : "ar"]).trim())
                          .map((x) => ({
                            key: x.id,
                            title: x.label[lang] || x.label[lang === "ar" ? "en" : "ar"],
                            on: () => {
                              setMenu(false);
                              if (design || !x.link.trim()) return;
                              /* the same rules as every button: a store page, a part of the page, or a web address */
                              const lp = linkProps(x.link, ctx);
                              if (lp.onClick) lp.onClick({ preventDefault() {} } as React.MouseEvent<HTMLAnchorElement>);
                              else if (lp.href) window.open(lp.href, "_blank", "noreferrer");
                            },
                          }))
                    : navLinks.map((l, i) => ({ key: i, title: l.name, on: () => { setMenu(false); goTo({ preventDefault() {} } as React.MouseEvent, l.to); } }));
              if (!rows.length) return null;
              return (
                <div key={it.kind}>
                  <p className={config.theme.titleStyle === "pop" ? "mb-3 text-lg font-extrabold" : "mb-2 text-xs font-bold uppercase tracking-wide text-[var(--sf-text)]/50"} style={config.theme.titleStyle === "pop" ? { color: "var(--sf-accent)", fontFamily: "var(--sf-heading)" } : undefined}>{it.kind === "categories" ? c.categories : it.kind === "pages" ? c.pages : it.kind === "custom" ? (lang === "ar" ? "روابط" : "Links") : lang === "ar" ? "روابط المتجر" : "Store links"}</p>
                  <ul className={config.theme.titleStyle === "pop" ? "space-y-2" : "space-y-1"}>
                    {rows.map((r) => (
                      <li key={r.key}>
                        <button type="button" onClick={r.on} className={config.theme.titleStyle === "pop" ? "w-full rounded-full border-2 border-[var(--sf-text)] bg-white px-5 py-2.5 text-start text-base font-bold transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02]" : "w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition duration-200 hover:bg-black/[0.05] hover:ps-4"}>
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
function freeDeliveryText(fd: FreeDelivery, lang: "en" | "ar", total: number): string {
  if (!fd.on) return "";
  const ar = lang === "ar";
  const cur = ar ? "د.أ" : "JOD";
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

function Footer({ config, data, compact, lang, design, logo, onPage, linkFor }: { config: StorefrontConfig; data: ReturnType<typeof useStoreData>; compact: boolean; lang: "en" | "ar"; design?: Design; logo: LogoConfig; onPage: (id: number) => void; linkFor: (link: string) => React.AnchorHTMLAttributes<HTMLAnchorElement> }) {
  const c = copy[lang];
  const f = config.footer;
  const head = "mb-3 text-sm font-extrabold text-[var(--sf-title)]";
  /* The sizes of the footer's texts, in px */
  const sizeTitle = f.sizes?.title ?? 14;
  const sizeText = f.sizes?.text ?? 14;
  const sizeName = f.sizes?.name ?? (f.style === "simple" ? 20 : 18);
  /* A title of a column: the merchant's word, or the default one */
  const word = (k: "pages" | "contact" | "follow" | "licenses") => f.labels?.[k]?.[lang]?.trim() || f.labels?.[k]?.[lang === "ar" ? "en" : "ar"]?.trim() || c[k];
  /* A footer with its own background (usually dark): its text takes the footer text color, links glow in the accent color */
  const own = !!f.background || !!f.text;
  const dark = !!f.background && onColor(f.background) === "#ffffff";
  /* The footer's own text color, or a light one on a dark footer. It is also the footer's `color`, so every line (including the ones
     that are only dimmed) is readable, not left in the page's dark text color. */
  const ink = f.text || (dark ? "#f4efe6" : "");
  const ownVars = own
    ? ({ ...(ink ? { "--sf-text": ink, "--sf-title": ink, color: ink } : {}), ...(f.background ? { "--sf-primary": dark ? "color-mix(in srgb, var(--sf-accent) 55%, white)" : "var(--sf-accent)" } : {}) } as React.CSSProperties)
    : {};
  /* The links of the footer: the pages of the store (when that switch is on), then the merchant's own links (each has its own switch) */
  const other = lang === "ar" ? "en" : "ar";
  const tabs = (f.tabs ?? []).filter((x) => x.visible && (x.label[lang] || x.label[other]).trim());
  const linkItems: { key: string; title: string; props: React.AnchorHTMLAttributes<HTMLAnchorElement> }[] = [
    ...(f.showLinks ? data.links.map((l) => ({ key: `p${l.id}`, title: l.title, props: { href: "#", onClick: (e: React.MouseEvent) => { e.preventDefault(); onPage(l.id); } } })) : []),
    ...tabs.map((x) => ({ key: x.id, title: x.label[lang] || x.label[other], props: design ? { href: "#", onClick: (e: React.MouseEvent) => e.preventDefault() } : x.link.trim() ? linkFor(x.link) : { href: "#", onClick: (e: React.MouseEvent) => e.preventDefault() } })),
  ];
  const socials = (["instagram", "facebook", "x", "youtube", "snapchat", "tiktok"] as const)
    .map((key, i) => ({ key, url: f.social[key].trim(), icon: icons.social[i] }))
    .filter((x) => x.url)
    .map((x) => ({ ...x, url: /^https?:\/\//i.test(x.url) ? x.url : `https://${x.url}` }));
  /* The columns, in the order the merchant chose. Each kind knows when it has something to show. */
  type Line = { key: string; icon: React.ReactNode; text: string; ltr: boolean };
  const contactLines: Line[] = ([
    data.phone && { key: "phone", icon: icons.phone, text: data.phone, ltr: true },
    f.whatsapp && { key: "whatsapp", icon: icons.whatsapp, text: f.whatsapp, ltr: true },
    f.telegram && { key: "telegram", icon: icons.telegram, text: f.telegram, ltr: true },
    f.email && { key: "email", icon: icons.mail, text: f.email, ltr: true },
    f.address[lang] && { key: "address", icon: icons.pin, text: f.address[lang], ltr: false },
  ] as (Line | false | "" | undefined)[]).filter((x): x is Line => !!x);
  const aboutText = f.about[lang] || data.description;
  const hasCertificate = !!(f.certificate.number.trim() || f.certificate.logo || (f.certificate.kind === "other" && f.certificate.label.trim()));
  /* The verification link of the badge: a web address the visitor can open to check the registration */
  const certUrl = f.certificate.url.trim() ? (/^https?:\/\//i.test(f.certificate.url.trim()) ? f.certificate.url.trim() : `https://${f.certificate.url.trim()}`) : "";
  const certWrap = (cls: string, kids: React.ReactNode) =>
    certUrl ? (
      <a href={certUrl} target="_blank" rel="noreferrer" onClick={(e) => design && e.preventDefault()} className={`${cls} transition hover:-translate-y-0.5`}>{kids}</a>
    ) : (
      <div className={cls}>{kids}</div>
    );
  const ownLinks = (col: { links?: { id: string; label: { en: string; ar: string }; link: string; visible: boolean }[] }) =>
    (col.links ?? [])
      .filter((x) => x.visible && (x.label[lang] || x.label[other]).trim())
      .map((x) => ({ key: x.id, title: x.label[lang] || x.label[other], props: design || !x.link.trim() ? { href: "#", onClick: (e: React.MouseEvent) => e.preventDefault() } : linkFor(x.link) }));
  const shown = footerColumns(f).filter((col) => {
    if (col.visible === false) return false;
    if (col.kind === "about") return !!(f.showLogo || aboutText);
    if (col.kind === "pages") return f.showLinks || linkItems.length > 0;
    if (col.kind === "contact") return f.showContact;
    if (col.kind === "social") return f.showSocial;
    if (col.kind === "licenses") return hasCertificate;
    /* the merchant's own column shows as soon as it is on, even before it has links */
    return true;
  });
  /* A social column with no accounts yet shows the logos of the networks, dimmed, until accounts are added (or the column is hidden) */
  const placeholderSocials = icons.social.map((icon, k) => ({ key: `ph${k}`, icon }));
  const customTitle = (col: { title?: { en: string; ar: string } }) => col.title?.[lang]?.trim() || col.title?.[other]?.trim() || "";
  /* The simple footer: the name, a short text, the pages, the contact lines and the social icons (each one follows its switch in the
     footer settings), then the copyright line. Clicking a text opens its field in the side panel. */
  if (f.style === "simple") {
    const edit = (field?: string) => (design ? (e: React.MouseEvent) => { e.stopPropagation(); design.select(field === "name" ? "identity" : "footer", field === "name" ? undefined : field); } : undefined);
    const hot = design ? "cursor-pointer rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6]" : "";
    return (
      <footer data-sf="footer" onClick={() => design?.select("footer")} className={`group/sel relative ${config.theme.hairlines ? "mt-24 border-t border-[color-mix(in_srgb,var(--sf-primary)_25%,transparent)]" : "mt-6"} ${design ? "cursor-pointer" : ""}`} style={{ background: f.background || "transparent", ...ownVars }}>
        <div className={`flex flex-wrap items-start justify-between gap-x-10 gap-y-5 ${compact ? "px-4 py-6" : "px-8 py-8"}`} style={{ fontSize: sizeText }}>
          {shown.map((col) => {
            if (col.kind === "about")
              return (
                <div key={col.id} className="min-w-0 max-w-xs">
                  {f.showLogo && (
                    <div onClick={edit("name")} className={`inline-flex items-center gap-2.5 font-extrabold ${hot}`} style={{ fontFamily: config.identity.nameFont ? heroTitleFamily(config.identity.nameFont) : "var(--sf-heading)", fontSize: config.identity.nameFont && !f.sizes?.name ? 28 : sizeName, color: config.identity.nameColor || undefined }}>
                      {(config.identity.showLogo || !config.identity.nameFont) && <LogoMark logo={logo} name={data.name} />}
                      <span>{data.name}</span>
                    </div>
                  )}
                  {aboutText && <p onClick={edit("about")} className={`mt-2 block leading-relaxed text-[var(--sf-text)]/70 ${hot}`}>{aboutText}</p>}
                </div>
              );
            if (col.kind === "pages" || col.kind === "custom") {
              const list = col.kind === "pages" ? linkItems : ownLinks(col);
              return (
                <div key={col.id}>
                  {(col.kind === "custom" ? customTitle(col) : word("pages")) && <p className="mb-2 font-extrabold" style={{ fontSize: sizeTitle }}>{col.kind === "custom" ? customTitle(col) : word("pages")}</p>}
                  <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-[var(--sf-text)]/75">
                    {list.length === 0 && <li className="text-[var(--sf-text)]/40">—</li>}
                    {list.map((l) => (
                      <li key={l.key}>
                        <a {...l.props} className="transition hover:text-[var(--sf-accent)]">{l.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            if (col.kind === "contact")
              return (
                <div key={col.id}>
                  <p className="mb-2 font-extrabold" style={{ fontSize: sizeTitle }}>{word("contact")}</p>
                  <div className="space-y-2.5 text-[var(--sf-text)]/75">
                  {contactLines.map((x) => (
                    <p key={x.key} onClick={edit(x.key)} className={`flex items-center gap-2 ${hot}`}>
                      {x.icon}
                      <span dir={x.ltr ? "ltr" : undefined}>{x.text}</span>
                    </p>
                  ))}
                  </div>
                </div>
              );
            if (col.kind === "social" && socials.length === 0)
              return (
                <div key={col.id}>
                  <p className="mb-2 font-extrabold" style={{ fontSize: sizeTitle }}>{word("follow")}</p>
                  <ul className="flex gap-2 opacity-40">
                    {placeholderSocials.map((x) => (
                      <li key={x.key} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--sf-text)] text-[var(--sf-text)]">{x.icon}</li>
                    ))}
                  </ul>
                </div>
              );
            if (col.kind === "social")
              return (
                <div key={col.id}>
                  <p className="mb-2 font-extrabold" style={{ fontSize: sizeTitle }}>{word("follow")}</p>
                  <ul className="flex gap-2">
                    {socials.map((x) => (
                      <li key={x.key}>
                        <a href={x.url} target="_blank" rel="noreferrer" aria-label={x.key} onClick={(e) => design && e.preventDefault()} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--sf-text)] text-[var(--sf-text)] transition hover:-translate-y-0.5">
                          {x.icon}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            return (
              <div key={col.id}>
                <p className="mb-2 font-extrabold" style={{ fontSize: sizeTitle }}>{word("licenses")}</p>
                {certWrap(
                  "flex items-center gap-2 text-xs font-semibold text-[var(--sf-text)]/75",
                  <>
                    {f.certificate.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.certificate.logo} alt="" className="h-8 w-auto max-w-[5rem] object-contain" />
                    ) : (
                      <span className="text-[var(--sf-primary)]">{icons.shield}</span>
                    )}
                    <span>
                      {f.certificate.kind === "other" && f.certificate.label.trim() ? f.certificate.label.trim() : c.certificate[f.certificate.kind]}
                      {f.certificate.number.trim() && <> <span dir="ltr">{f.certificate.number}</span></>}
                    </span>
                  </>,
                )}
              </div>
            );
          })}
        </div>
        {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "footer" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
        {/* The copyright line and "Made with Dukkan" are fixed. The merchant can neither change nor remove them. */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sf-text)]/10 text-xs text-[var(--sf-text)]/55 ${compact ? "px-4 py-4" : "px-8 py-5"}`}>
          <span>{`© 2026 ${data.name}. ${c.rights}`}</span>
          <span>{c.made}</span>
        </div>
      </footer>
    );
  }
  return (
    <footer data-sf="footer" onClick={() => design?.select("footer")} className={`group/sel relative mt-6 ${design ? "cursor-pointer" : ""}`} style={{ background: f.background || "color-mix(in srgb, var(--sf-primary) 7%, var(--sf-bg))", ...ownVars }}>
      <div className={`grid gap-8 ${compact ? "px-4 py-9" : "px-8 py-12"}`} style={compact ? undefined : { gridTemplateColumns: shown.map((col) => (col.kind === "about" ? "1.3fr" : "1fr")).join(" ") }}>
        {shown.map((col) => {
          if (col.kind === "about")
            return (
              <div key={col.id}>
                {f.showLogo && (
                  <div className="flex items-center gap-2.5">
                    <LogoMark logo={logo} name={data.name} />
                    <span className="font-extrabold" style={{ fontSize: sizeName }}>{data.name}</span>
                  </div>
                )}
                {aboutText && <p className="mt-3 max-w-xs leading-relaxed text-[var(--sf-text)]/65" style={{ fontSize: sizeText }}>{aboutText}</p>}
              </div>
            );
          if (col.kind === "pages" || col.kind === "custom") {
            const list = col.kind === "pages" ? linkItems : ownLinks(col);
            return (
              <div key={col.id}>
                <h4 className={head} style={{ fontSize: sizeTitle }}>{col.kind === "pages" ? word("pages") : customTitle(col)}</h4>
                <ul className="space-y-2 text-[var(--sf-text)]/70" style={{ fontSize: sizeText }}>
                  {list.length === 0 && <li className="text-[var(--sf-text)]/40">—</li>}
                  {list.map((l) => (
                    <li key={l.key}>
                      <a {...l.props} className="transition hover:text-[var(--sf-primary)]">
                        {l.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          if (col.kind === "contact")
            return (
              <div key={col.id}>
                <h4 className={head} style={{ fontSize: sizeTitle }}>{word("contact")}</h4>
                <ul className="space-y-2 text-[var(--sf-text)]/70" style={{ fontSize: sizeText }}>
                  {contactLines.map((x) => (
                    <li key={x.key} className="flex items-center gap-2">
                      {x.icon}
                      <span dir={x.ltr ? "ltr" : undefined}>{x.text}</span>
                    </li>
                  ))}
                  {contactLines.length === 0 && <li className="text-[var(--sf-text)]/40">—</li>}
                </ul>
              </div>
            );
          if (col.kind === "social" && socials.length === 0)
            return (
              <div key={col.id}>
                <h4 className={head} style={{ fontSize: sizeTitle }}>{word("follow")}</h4>
                <ul className="flex gap-2 opacity-40">
                  {placeholderSocials.map((x) => (
                    <li key={x.key} className={`grid h-10 w-10 place-items-center rounded-full text-[var(--sf-primary)] ring-1 ${dark ? "bg-white/10 ring-white/15" : "bg-white ring-black/[0.08]"}`}>{x.icon}</li>
                  ))}
                </ul>
              </div>
            );
          if (col.kind === "social")
            return (
              <div key={col.id}>
                <h4 className={head} style={{ fontSize: sizeTitle }}>{word("follow")}</h4>
                <ul className="flex gap-2">
                  {socials.map((x) => (
                    <li key={x.key}>
                      <a href={x.url} target="_blank" rel="noreferrer" aria-label={x.key} onClick={(e) => design && e.preventDefault()} className={`grid h-10 w-10 place-items-center rounded-full text-[var(--sf-primary)] ring-1 transition hover:-translate-y-0.5 ${dark ? "bg-white/10 ring-white/15" : "bg-white ring-black/[0.08]"}`}>
                        {x.icon}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          return (
            <div key={col.id}>
              <h4 className={head} style={{ fontSize: sizeTitle }}>{word("licenses")}</h4>
              {certWrap(
                `inline-flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold ring-1 ${dark ? "bg-white/10 ring-white/15" : "bg-white ring-black/[0.08]"}`,
                <>
                  {f.certificate.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.certificate.logo} alt="" className="h-9 w-auto max-w-[5.5rem] object-contain" />
                  ) : (
                    <span className="text-[var(--sf-primary)]">{icons.shield}</span>
                  )}
                  {(f.certificate.number.trim() || (f.certificate.kind === "other" && f.certificate.label.trim())) && (
                    <span>
                      {f.certificate.kind === "other" && f.certificate.label.trim() ? f.certificate.label.trim() : c.certificate[f.certificate.kind]}
                      {f.certificate.number.trim() && <> <span dir="ltr">{f.certificate.number}</span></>}
                    </span>
                  )}
                </>,
              )}
            </div>
          );
        })}
      </div>

      {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "footer" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
      {/* The copyright line and "Made with Dukkan" are fixed. The merchant can neither change nor remove them. */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-t text-xs ${dark ? "border-white/10" : "border-black/[0.06]"} text-[var(--sf-text)]/55 ${compact ? "px-4 py-4" : "px-8 py-5"}`}>
        <span>{`© 2026 ${data.name}. ${c.rights}`}</span>
        <span>{c.made}</span>
      </div>
    </footer>
  );
}
