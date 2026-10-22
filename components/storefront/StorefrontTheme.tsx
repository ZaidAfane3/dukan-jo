"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { defaultConfig, radiusValue, type LogoConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, LogoMark, money, onColor, priceOf, resolveLogo } from "./parts";
import { renderSection, type Ctx, type Design } from "./sections";
import { useMediaUrl } from "./mediaStore";
import { loadFreeDelivery, type FreeDelivery } from "../freeDeliveryStore";
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
};

export function StorefrontTheme({ config = defaultConfig, device = "auto", interactive = true, store, design, sample = false, owner = false }: Props) {
  const { lang } = usePrefs();
  const c = copy[lang];
  const saved = useStoreData(lang, sample);
  const data = {
    ...saved,
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
  const ctx: Ctx = { lang, compact, data, config, design, owner, query, interactive, qty, setQty };

  const vars = {
    "--sf-primary": primary,
    "--sf-on": onColor(primary),
    "--sf-bg": config.theme.background,
    "--sf-text": config.theme.text,
    "--sf-title": config.theme.titleColor || config.theme.text,
    "--sf-r": radiusValue[config.theme.radius],
    background: config.theme.background,
    color: config.theme.text,
  } as React.CSSProperties;

  const h = config.header;
  const brand = (
    <a href="#" onClick={(e) => { e.preventDefault(); if (design) { e.stopPropagation(); design.select("identity"); } }} className={`flex min-w-0 items-center gap-2.5 ${design ? "rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6]" : ""}`}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      <span className={`truncate font-extrabold tracking-tight ${compact ? "text-lg" : "text-xl"}`}>{data.name}</span>
    </a>
  );

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
              {h.showUser && (
                <button type="button" aria-label={c.account} className={iconBtn}>
                  {icons.user}
                </button>
              )}
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
                      {money(cart.total)} <small className="font-semibold opacity-60">{currency(lang)}</small>
                    </span>
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
      {data.isDemo && design && <p className="px-4 py-2 text-center text-xs font-medium" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>{c.sample}</p>}

      <AnnouncementBar config={config} lang={lang} design={design} reduceMotion={reduceMotion} offer={freeDeliveryText(fd, lang, cart.total)} offerColor={primary} />

      <header onClick={() => design?.select("header")} className={`group/sel z-20 border-b border-black/[0.06] backdrop-blur-xl ${h.sticky ? "sticky top-0" : "relative"} ${design ? "cursor-pointer" : ""}`} style={{ background: "color-mix(in srgb, var(--sf-bg) 86%, transparent)" }}>
        {centered ? (
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
        {(compact || centered) && h.showSearch && <div className={compact ? "px-4 pb-3" : "mx-auto max-w-xl px-8 pb-4"}>{search}</div>}
        {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "header" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
      </header>

      <main>{config.sections.map((s) => renderSection(s, ctx))}</main>

      <Footer config={config} data={data} compact={compact} lang={lang} design={design} logo={logo} />

      {menu && (
        <div className="absolute inset-0 z-30 flex" role="dialog" aria-modal="true" aria-label={c.menu}>
          <button type="button" aria-label={c.close} onClick={() => setMenu(false)} className="absolute inset-0 bg-black/40" />
          <nav className="relative z-10 flex h-full w-72 max-w-[85%] flex-col gap-6 overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              {brand}
              <button type="button" onClick={() => setMenu(false)} aria-label={c.close} className={iconBtn}>
                {icons.close}
              </button>
            </div>
            {data.categories.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--sf-text)]/50">{c.categories}</p>
                <ul className="space-y-1">
                  {data.categories.map((name) => (
                    <li key={name}>
                      <button type="button" onClick={() => setMenu(false)} className="w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-black/[0.04]">
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.links.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--sf-text)]/50">{c.pages}</p>
                <ul className="space-y-1">
                  {data.links.map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => setMenu(false)} className="w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-black/[0.04]">
                        {l.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

function AnnouncementBar({ config, lang, design, reduceMotion, offer, offerColor }: { config: StorefrontConfig; lang: "en" | "ar"; design?: Design; reduceMotion: boolean; offer: string; offerColor: string }) {
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
    const href = m.link && !design ? (/^https?:\/\//i.test(m.link) ? m.link : `https://${m.link}`) : "";
    return href ? (
      <a key={key} href={href} target="_blank" rel="noreferrer" className={`underline-offset-2 hover:underline ${extra}`} style={{ color }}>{m.label}</a>
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

function Footer({ config, data, compact, lang, design, logo }: { config: StorefrontConfig; data: ReturnType<typeof useStoreData>; compact: boolean; lang: "en" | "ar"; design?: Design; logo: LogoConfig }) {
  const c = copy[lang];
  const f = config.footer;
  const head = "mb-3 text-sm font-extrabold text-[var(--sf-title)]";
  const socials = (["instagram", "facebook", "x", "youtube", "snapchat", "tiktok"] as const)
    .map((key, i) => ({ key, url: f.social[key].trim(), icon: icons.social[i] }))
    .filter((x) => x.url)
    .map((x) => ({ ...x, url: /^https?:\/\//i.test(x.url) ? x.url : `https://${x.url}` }));
  return (
    <footer onClick={() => design?.select("footer")} className={`group/sel relative mt-6 ${design ? "cursor-pointer" : ""}`} style={{ background: "color-mix(in srgb, var(--sf-primary) 7%, var(--sf-bg))" }}>
      <div className={`grid gap-8 ${compact ? "px-4 py-9" : "grid-cols-[1.3fr_1fr_1fr_1fr] px-8 py-12"}`}>
        <div>
          {f.showLogo && (
            <div className="flex items-center gap-2.5">
              <LogoMark logo={logo} name={data.name} />
              <span className="text-lg font-extrabold">{data.name}</span>
            </div>
          )}
          {(f.about[lang] || data.description) && <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--sf-text)]/65">{f.about[lang] || data.description}</p>}
        </div>

        {f.showLinks && (
          <div>
            <h4 className={head}>{c.pages}</h4>
            <ul className="space-y-2 text-sm text-[var(--sf-text)]/70">
              {data.links.length === 0 && <li className="text-[var(--sf-text)]/40">—</li>}
              {data.links.map((l) => (
                <li key={l.id}>
                  <a href="#" onClick={(e) => e.preventDefault()} className="transition hover:text-[var(--sf-primary)]">
                    {l.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {f.showContact && (
          <div>
            <h4 className={head}>{c.contact}</h4>
            <ul className="space-y-2 text-sm text-[var(--sf-text)]/70">
              {data.phone && (
                <li className="flex items-center gap-2">
                  {icons.phone}
                  <span dir="ltr">{data.phone}</span>
                </li>
              )}
              {f.whatsapp && (
                <li className="flex items-center gap-2">
                  {icons.whatsapp}
                  <span dir="ltr">{f.whatsapp}</span>
                  
                </li>
              )}
              {f.telegram && (
                <li className="flex items-center gap-2">
                  {icons.telegram}
                  <span dir="ltr">{f.telegram}</span>
                  
                </li>
              )}
              {f.email && (
                <li className="flex items-center gap-2">
                  {icons.mail}
                  <span dir="ltr">{f.email}</span>
                </li>
              )}
              {f.address[lang] && (
                <li className="flex items-center gap-2">
                  {icons.pin}
                  <span>{f.address[lang]}</span>
                </li>
              )}
              {!data.phone && !f.email && !f.whatsapp && !f.telegram && !f.address[lang] && <li className="text-[var(--sf-text)]/40">—</li>}
            </ul>
          </div>
        )}

        <div className="space-y-6">
        {f.showSocial && socials.length > 0 && (
          <div>
            <h4 className={head}>{c.follow}</h4>
            <ul className="flex gap-2">
              {socials.map((x) => (
                <li key={x.key}>
                  <a href={x.url} target="_blank" rel="noreferrer" aria-label={x.key} onClick={(e) => design && e.preventDefault()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--sf-primary)] ring-1 ring-black/[0.08] transition hover:-translate-y-0.5">
                    {x.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The store's licenses: at the far end of the footer. The logo is optional. */}
        {(f.certificate.number.trim() || f.certificate.logo) && (
          <div>
            <h4 className={head}>{c.licenses}</h4>
            <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-semibold ring-1 ring-black/[0.08]">
              {f.certificate.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.certificate.logo} alt="" className="h-9 w-auto max-w-[5.5rem] object-contain" />
              ) : (
                <span className="text-[var(--sf-primary)]">{icons.shield}</span>
              )}
              {f.certificate.number.trim() && (
                <span>
                  {c.certificate[f.certificate.kind]} <span dir="ltr">{f.certificate.number}</span>
                </span>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "footer" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
      {/* The copyright line and "Made with Dukkan" are fixed. The merchant can neither change nor remove them. */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] text-xs text-[var(--sf-text)]/55 ${compact ? "px-4 py-4" : "px-8 py-5"}`}>
        <span>{`© 2026 ${data.name}. ${c.rights}`}</span>
        <span>{c.made}</span>
      </div>
    </footer>
  );
}
