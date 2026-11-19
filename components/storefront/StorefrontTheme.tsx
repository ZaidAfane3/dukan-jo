"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "../Prefs";
import { defaultConfig, footerColumns, heroTitleFamily, radiusValue, shopTarget, type LogoConfig, type StorefrontConfig } from "./config";
import { copy, currency, icons, LogoMark, money, moneyIn, onColor, picFill, priceLang, priceOf, readableOn, resolveLogo, drawerHeading } from "./parts";
import { patterns } from "./patterns";
import { basketKey, emptyForCustomers, linkProps, ProductPage, renderSection, SearchResults, sellsOf, surfaceInk, type Ctx, type Design } from "./sections";
import { usePublicSettings } from "../platformPublic";
import { SEARCH_MAX, searchCopy, searchIndex, searchProducts } from "./search";
import { useMediaUrl } from "./mediaStore";
import { loadFreeDelivery, type FreeDelivery } from "../freeDeliveryStore";
import { fontFamily, headingFamily } from "./config";
import { categoriesOf, sampleProducts, storeDataReady, useStoreData, type StoreProduct } from "./useStoreData";
import { cartQty, ORDER_LIMITS, productId, toFils } from "../safeOrder";
import { CartPanel } from "./Cart";
import { footerColors, footerDim, footerNameSize, legibleOn, readsOn } from "./footerColors";
import { shownMobile } from "../phone";
import { hasArabic } from "../safe";
import { useSpots } from "./spotSignal";
import { ReportStore } from "./ReportStore";
import { useVisitorStore } from "./visitorStore";
import { sendVisit } from "../storeVisits";
import { basketStorageKey, readBasket, writeBasket } from "./visitorBasket";

/* The public store gives each product and each page of the store its own address: /<store>?p=<product id> or
   ?page=<page id>, and a search on the home page /<store>?q=<words>. A reload or a shared link opens it again, and the
   browser's Back closes it. Only on the public store, never in the designer or a preview, whose address is the
   merchant's own page. */
type View = { product: number | null; page: number | null; q?: string };
function viewInAddress(): View & { q: string } {
  try {
    const q = new URLSearchParams(window.location.search);
    return { product: productId(q.get("p")), page: productId(q.get("page")), q: (q.get("q") ?? "").slice(0, SEARCH_MAX).trim() };
  } catch {
    return { product: null, page: null, q: "" };
  }
}
function addressOf(v: View): string {
  const u = new URL(window.location.href);
  u.searchParams.delete("p");
  u.searchParams.delete("page");
  u.searchParams.delete("q");
  u.hash = "";
  if (v.product !== null) u.searchParams.set("p", String(v.product));
  else if (v.page !== null) u.searchParams.set("page", String(v.page));
  else if (v.q?.trim()) u.searchParams.set("q", v.q.trim());
  return u.pathname + u.search;
}

/* In the designer: the open settings point at a part of the store that is empty or hidden. It gets a dashed place with what
   will show there, so he sees where his change goes (customers never see it). */
function SpotHole({ spot, text, className = "" }: { spot: string; text: string; className?: string }) {
  return (
    <span data-spot={spot} className={`inline-flex items-center justify-center rounded-lg border-2 border-dashed border-[#14b8a6] bg-[#14b8a6]/10 px-3 py-1.5 text-xs font-bold text-[#0f766e] ${className}`}>
      {text}
    </span>
  );
}
/* the words of those places */
const holeWords = {
  en: { links: "Your links will show here", tagline: "Your short line will show here", bar: "The announcement bar is off: it will show here when you turn it on", column: "This column is hidden: it will show here when you show it", license: "Your license will show here", about: "Your store description will show here" },
  ar: { links: "ستظهر روابطك هنا", tagline: "سيظهر سطرك القصير هنا", bar: "الشريط الإعلاني مخفي، وسيظهر هنا عند تفعيله", column: "هذا العمود مخفي، وسيظهر هنا عند إظهاره", license: "ستظهر رخصتك هنا", about: "سيظهر وصف متجرك هنا" },
};

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
  /* In the designer: the store with its cart open, so the cart design can be seen (closing it goes back to the home page) */
  showCart?: boolean;
  /* In the designer: the store with its sidebar open, while its settings are being edited, so every change shows live */
  showMenu?: boolean;
  onCartClose?: () => void;
  onCartOpen?: () => void;
};

export function StorefrontTheme({ config = defaultConfig, device = "auto", interactive = true, store, design, sample = false, owner = false, products, showPage = null, showProduct = false, showCart = false, showMenu = false, onCartClose, onCartOpen }: Props) {
  const { lang, setLang } = usePrefs();
  const c = copy[lang];
  const saved = useStoreData(lang, sample);
  /* the public store (app/[slug]): the store as Dukkan's server sent it, for a visitor (see visitorStore.ts) */
  const visitor = useVisitorStore();
  /* Kept the same object while nothing in it changes, so the parts of the store that use it do not draw again on every key in the designer */
  const sName = store?.name, sDescription = store?.description, sColor = store?.color, sPhone = store?.phone;
  const data = useMemo(() => ({
    ...saved,
    ...(products ? { products, categories: Array.from(new Set(products.flatMap(categoriesOf).filter(Boolean))), isDemo: false } : {}),
    name: sName?.trim() || saved.name,
    description: sDescription ?? saved.description,
    color: sColor || saved.color,
    phone: sPhone !== undefined ? (sPhone ? `+962 ${shownMobile(sPhone)}` : "") : saved.phone,
    /* the designer (it passes the store) shows only the design's own WhatsApp, which it fills from setup when it opens */
    whatsapp: sPhone !== undefined ? "" : saved.whatsapp,
  }), [saved, products, sName, sDescription, sColor, sPhone]);

  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  const [query, setQuery] = useState("");
  /* the newest search, for the timers and the browser's events below */
  const queryNow = useRef("");
  /* where he was on the home page when he started searching from it: clearing the search takes him back there */
  const homeY = useRef<number | null>(null);
  /* where to scroll once the page is drawn: to the results (smoothly), to the top of the store, or back to a place */
  const scrollNext = useRef<"results" | "top" | number | null>(null);
  const searchTimers = useRef<{ leave?: ReturnType<typeof setTimeout>; url?: ReturnType<typeof setTimeout> }>({});
  const [menu, setMenu] = useState(false);
  /* the designer opens the sidebar while its settings are open, and closes it when he leaves them */
  useEffect(() => {
    if (design) setMenu(showMenu);
  }, [design, showMenu]);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  /* What is in the basket: how many of each product (by product id) */
  const [fd, setFd] = useState<FreeDelivery>({ on: false, min: 25 });
  useEffect(() => setFd(visitor ? visitor.freeDelivery : loadFreeDelivery()), [visitor]);
  /* by product id, or "id|size" for clothing and shoes (one entry per size) */
  const [qty, setQtyMap] = useState<Record<string, number>>({});
  const qtyNow = useRef(qty);
  qtyNow.current = qty;
  /* an add refused because the basket already holds as many different products as one order can (ORDER_LIMITS.lines):
     said for a few seconds (when), instead of the checkout answering "products changed" again and again */
  const [basketFull, setBasketFull] = useState(0);
  useEffect(() => {
    if (!basketFull) return;
    const t = setTimeout(() => setBasketFull(0), 5000);
    return () => clearTimeout(t);
  }, [basketFull]);
  /* The public store only: the address follows the product or page open, and the basket is kept in the visitor's
     browser for this store (visitorBasket.ts). Both are taken back once the store's products are in (`settled`); until
     then the basket's count and total are not shown, so a kept basket never flashes as empty. */
  const routed = !!visitor && !design;
  const basketStore = routed && visitor ? basketStorageKey(visitor.setup.slug) : "";
  const [settled, setSettled] = useState(!routed);

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
  /* the logo and name at the other side (the left in Arabic, the right in English): the header's rows are drawn mirrored */
  const nameEnd = config.identity.align === "end";
  const compact = device === "mobile" || (device === "auto" && width < 720);
  const primary = config.theme.primary || data.color;

  const setQty = useCallback((p: StoreProduct, n: number, size?: string) => {
    /* a product in sizes needs its size first: an add without one (a card's button) opens its page to choose it */
    if (p.sizes?.length && !size) {
      if (n > 0) latest.current.openProduct(p.id);
      return;
    }
    const key = basketKey(p.id, size);
    /* a new product (or size) once the basket holds as many as one order takes: not added, and he is told why */
    const full = (m: Record<string, number>) => n > 0 && !m[key] && Object.keys(m).length >= ORDER_LIMITS.lines;
    if (full(qtyNow.current)) {
      setBasketFull(Date.now());
      return;
    }
    setQtyMap((m) => {
      if (full(m)) return m;
      const next = { ...m };
      /* Never more than the store has (of that size), and a quantity of 0 takes it out of the basket */
      const v = cartQty(n, size ? p.sizes?.find((z) => z.name === size)?.quantity ?? 0 : p.quantity);
      if (v === 0) delete next[key];
      else next[key] = v;
      return next;
    });
  }, []);
  /* The basket panel: the cart button opens it (not in the designer, where a click edits the header) */
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = (e?: React.MouseEvent) => {
    /* in the designer the cart button shows the cart page of the designer (instead of picking the header) */
    if (design) {
      if (onCartOpen) {
        e?.stopPropagation();
        onCartOpen();
      }
      return;
    }
    if (interactive) setCartOpen(true);
  };
  /* in the designer the cart is drawn inside the preview: where he is looking (not at the top of the page), and it stays in
     view while he scrolls. Measured against the box the preview scrolls in; the preview may be shown smaller than it is. */
  const [cartAt, setCartAt] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!design || !showCart || !el) return setCartAt(null);
    let box: HTMLElement | null = el.parentElement;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const place = () => {
      const r = el.getBoundingClientRect();
      const k = r.width / el.offsetWidth || 1;
      const view = box ? box.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      /* the whole height he can see, but never taller than the page itself */
      const height = Math.min(el.offsetHeight, Math.max(320, view.height / k));
      const top = Math.max(0, Math.min(el.offsetHeight - height, (view.top - r.top) / k));
      setCartAt({ top, height });
    };
    place();
    const on: EventTarget = box ?? window;
    on.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => { on.removeEventListener("scroll", place); window.removeEventListener("resize", place); };
  }, [design, showCart]);
  const cartLines = Object.entries(qty).flatMap(([key, n]) => {
    /* "id|size": split at the first bar only, so a size whose name has a bar ("S|M") stays whole (visitorBasket.ts reads it the same way) */
    const bar = key.indexOf("|");
    const id = bar < 0 ? key : key.slice(0, bar);
    const size = bar < 0 ? "" : key.slice(bar + 1);
    const p = data.products.find((x) => String(x.id) === id);
    return p && n > 0 ? [{ p, qty: n, ...(size ? { size } : {}) }] : [];
  });
  /* every entry of the basket (each size of a product counts on its own) */
  const cartSum = cartLines.reduce((k, l) => ({ count: k.count + l.qty, total: k.total + l.qty * priceOf(l.p) }), { count: 0, total: 0 });
  /* the total kept to the fils, as the cart and the server work it out (the free delivery offer is tested on it) */
  const cart = { count: cartSum.count, total: toFils(cartSum.total) };
  /* A page of the store (an info page) shown in place of the home page */
  const [ownPage, setPageId] = useState<number | null>(null);
  /* In the designer the page shown is chosen by the designer (its page menu, or a button that leads to a page) */
  const pageId = design ? showPage : ownPage;
  /* The page of a product: pressing a product card opens it (in the designer it is the first product, from the page menu) */
  const [ownProduct, setOwnProduct] = useState<number | null>(null);
  const productId = design ? (showProduct ? (products ?? data.products)[0]?.id ?? null : null) : ownProduct;
  /* the public store: a new address for what opens (Back comes back here, to where he was on the page) */
  const moveTo = (v: View) => {
    if (!routed) return;
    try {
      const url = addressOf(v);
      if (url === window.location.pathname + window.location.search) return;
      window.history.replaceState({ ...window.history.state, sfY: window.scrollY }, "", window.location.href);
      window.history.pushState({ sfY: 0 }, "", url);
    } catch {
      /* the address stays as it is; the store still works */
    }
  };
  const openPage = (id: number) => {
    if (design) return design.openPage?.(id);
    /* a page of the store is not part of the search: the box empties (Back still comes back to the results) */
    if (queryNow.current) endSearch(false);
    setOwnProduct(null);
    setPageId(id);
    moveTo({ product: null, page: id });
    root.current?.scrollIntoView({ block: "start" });
  };
  const openProduct = (id: number) => {
    if (design) return;
    setPageId(null);
    setOwnProduct(id);
    moveTo({ product: id, page: null });
    root.current?.scrollIntoView({ block: "start" });
  };
  const closePage = () => {
    setOwnProduct(null);
    if (design) design.openPage?.(null);
    else {
      setPageId(null);
      /* back to the results when the box still holds a search (a product opened from them), else the home page */
      moveTo({ product: null, page: null, q: queryNow.current });
    }
  };
  /* The public store, once its products are in: the kept basket (checked against them) and the product or page of the
     address. One the store does not have (any more) shows the store, and the address becomes the store's own. Before
     the first paint, so neither the empty basket nor the home page flashes first. */
  useLayoutEffect(() => {
    if (settled || !storeDataReady(saved)) return;
    setQtyMap(readBasket(basketStore, data.products));
    const v = viewInAddress();
    const product = v.product !== null && data.products.some((p) => p.id === v.product) ? v.product : null;
    const page = product === null && v.page !== null && data.pages.some((p) => p.id === v.page) ? v.page : null;
    /* a search in the address (only on the home page) is typed back into the box and its results shown */
    const q = product === null && page === null ? v.q : "";
    setOwnProduct(product);
    setPageId(page);
    if (q) {
      queryNow.current = q;
      setQuery(q);
    }
    if (product !== v.product || page !== v.page || q !== v.q) {
      try {
        window.history.replaceState(window.history.state, "", addressOf({ product, page, q }));
      } catch {
        /* the address stays as it is */
      }
    }
    setSettled(true);
  }, [settled, saved, basketStore, data.products, data.pages]);
  /* the basket is kept on every change (an order placed empties it, so it is removed) */
  useEffect(() => {
    if (settled && basketStore) writeBasket(basketStore, qty);
  }, [settled, basketStore, qty]);
  /* the newest store data, for the browser's events below */
  const dataNow = useRef(data);
  dataNow.current = data;
  /* another tab of the same store changed the basket: this one follows it */
  useEffect(() => {
    if (!settled || !basketStore) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === basketStore) setQtyMap(readBasket(basketStore, dataNow.current.products));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [settled, basketStore]);
  /* Back and Forward: the product or page of that address, at the place on the page he left it */
  const [popAt, setPopAt] = useState<{ y: number | null } | null>(null);
  useEffect(() => {
    if (!routed) return;
    const onPop = (e: PopStateEvent) => {
      const v = viewInAddress();
      const d = dataNow.current;
      const product = v.product !== null && d.products.some((p) => p.id === v.product) ? v.product : null;
      const page = product === null && v.page !== null && d.pages.some((p) => p.id === v.page) ? v.page : null;
      setOwnProduct(product);
      setPageId(page);
      /* the search box follows the address too: the search of a results address, empty elsewhere */
      clearTimeout(searchTimers.current.leave);
      clearTimeout(searchTimers.current.url);
      const q = product === null && page === null ? v.q : "";
      queryNow.current = q;
      homeY.current = null;
      setQuery(q);
      const y = (e.state as { sfY?: unknown } | null)?.sfY;
      setPopAt({ y: typeof y === "number" ? y : null });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [routed]);
  useLayoutEffect(() => {
    if (!popAt) return;
    if (popAt.y !== null) window.scrollTo(0, popAt.y);
    else root.current?.scrollIntoView({ block: "start" });
  }, [popAt]);
  const shownPage = pageId !== null ? data.pages.find((p) => p.id === pageId) : undefined;
  /* The public store only (never the merchant's preview, the designer or the tour): each page a visitor opens is counted
     for the merchant's visitor numbers (components/storeVisits.ts). Sent once per page: the same page drawn again is not
     a new one, and closing the cart is not either. */
  const visitSlug = visitor && !design ? visitor.setup.slug : "";
  const counted = useRef("");
  useEffect(() => {
    /* counted once the address's product or page is open (a link to a product counts the product, not the home page) */
    if (!visitSlug || !settled) return;
    const key = ownProduct !== null ? `product:${ownProduct}` : ownPage !== null ? `page:${ownPage}` : "home";
    if (counted.current === key) return;
    counted.current = key;
    sendVisit(visitSlug, ownProduct !== null ? "product" : ownPage !== null ? "page" : "home", ownProduct);
  }, [visitSlug, settled, ownPage, ownProduct]);
  useEffect(() => {
    if (!visitSlug || !cartOpen) return;
    counted.current = "cart";
    sendVisit(visitSlug, "cart");
  }, [visitSlug, cartOpen]);
  /* the designer's product page with no products in the store: a sample product, so the page can still be designed */
  const sampleProduct = useMemo(() => (design && showProduct && !(products ?? data.products).length ? sampleProducts(lang)[0] : undefined), [design, showProduct, products, data.products, lang]);
  const shownProduct = (productId !== null ? data.products.find((x) => x.id === productId) : undefined) ?? sampleProduct;

  /* The search. While the box holds words, the home page gives way to one block of results at the top of the store
     (search.ts: name, categories and the merchant's words about the product; hidden products are never in the store's
     list, so never found). Clearing it (the box's ×, Escape, an empty box or "Clear search") brings the home page back
     as it was: its sections stay drawn underneath, only hidden, and the page goes back to where he was. */
  const index = useMemo(() => searchIndex(data.products), [data.products]);
  const searchQ = interactive ? query.trim() : "";
  const found = useMemo(() => (searchQ ? searchProducts(index, searchQ) : []), [index, searchQ]);
  /* what is open now, for the timers below */
  const viewNow = useRef({ product: productId, page: pageId });
  viewNow.current = { product: productId, page: pageId };
  /* the public store's address follows the search on the home page, a moment after the last key (one entry: Back
     does not step through every letter) */
  const markQuery = (q: string, now: boolean) => {
    if (!routed) return;
    clearTimeout(searchTimers.current.url);
    const put = () => {
      try {
        /* only while the home page is open (a product opened meanwhile has its own address) */
        const v = viewInAddress();
        if (v.product !== null || v.page !== null) return;
        const url = addressOf({ product: null, page: null, q });
        if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url);
      } catch {
        /* the address stays as it is; the search still works */
      }
    };
    if (now) put();
    else searchTimers.current.url = setTimeout(put, 300);
  };
  /* A search typed on a product or a page of the store: that page closes and the results show on the home page, as a
     new address (Back comes back to the product). Not in the designer, whose page menu chooses what it shows. */
  const leaveToResults = () => {
    clearTimeout(searchTimers.current.leave);
    const q = queryNow.current.trim();
    if (!q || design || (viewNow.current.product === null && viewNow.current.page === null)) return;
    homeY.current = null;
    scrollNext.current = "top";
    setOwnProduct(null);
    setPageId(null);
    moveTo({ product: null, page: null, q });
  };
  const typeQuery = (value: string) => {
    if (!interactive) return;
    const v = value.slice(0, SEARCH_MAX);
    const was = queryNow.current.trim();
    const now = v.trim();
    queryNow.current = v;
    setQuery(v);
    if (design) return;
    if (viewNow.current.product !== null || viewNow.current.page !== null) {
      /* on a product or a page: the results open after a short pause in typing (or at once with Enter) */
      clearTimeout(searchTimers.current.leave);
      if (now) searchTimers.current.leave = setTimeout(leaveToResults, 450);
      return;
    }
    if (!was && now) {
      /* a search starts on the home page: kept where he was, and the results come into view */
      homeY.current = window.scrollY;
      scrollNext.current = "results";
    } else if (was && !now) {
      scrollNext.current = homeY.current ?? "top";
      homeY.current = null;
    }
    markQuery(now, !now);
  };
  /* the search is over without going back anywhere (a page of the store or a part of the home page was chosen) */
  /* `address`: the home page's address loses its search too; otherwise it keeps it (written now if it was still
     waiting), so Back from the page he opens comes back to these results */
  const endSearch = (address: boolean) => {
    clearTimeout(searchTimers.current.leave);
    markQuery(address ? "" : queryNow.current.trim(), true);
    queryNow.current = "";
    homeY.current = null;
    setQuery("");
  };
  useEffect(() => () => {
    clearTimeout(searchTimers.current.leave);
    clearTimeout(searchTimers.current.url);
  }, []);
  /* after the drawing: to the results, to the top of the store, or back to his place on the home page */
  useLayoutEffect(() => {
    const go = scrollNext.current;
    if (go === null) return;
    scrollNext.current = null;
    if (typeof go === "number") window.scrollTo(0, go);
    else root.current?.scrollIntoView({ block: "start", behavior: go === "results" && !reduceMotion ? "smooth" : "auto" });
  });
  /* the keys of every search box: Escape clears it (a second one closes a search that opened from its icon), Enter shows
     the results (on a product page at once) */
  const searchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      typeQuery("");
    } else if (e.key === "Enter" && query.trim() && !design) {
      e.preventDefault();
      if (viewNow.current.product !== null || viewNow.current.page !== null) leaveToResults();
      else root.current?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
      /* on a phone the keyboard goes away, so the results can be seen */
      if (compact) e.currentTarget.blur();
    }
  };
  /* the × in a search box: clears it and keeps the cursor in the box */
  const clearX = (className: string) =>
    query && interactive ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const field = e.currentTarget.parentElement?.querySelector("input");
          typeQuery("");
          field?.focus({ preventScroll: true });
        }}
        aria-label={searchCopy[lang].clear}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sf-text/60 transition hover:bg-black/[0.06] hover:text-sf-text [&>svg]:h-4 [&>svg]:w-4 ${className}`}
      >
        {icons.close}
      </button>
    ) : null;
  /* a category of the sidebar: its name becomes the search, so its products show in the results (search.ts looks
     through categories), at once and in view, also from a product or a page of the store. Not in the designer. */
  const searchFor = (words: string) => {
    if (!interactive || design) return;
    typeQuery(words);
    if (viewNow.current.product !== null || viewNow.current.page !== null) leaveToResults();
    else scrollNext.current = "results";
  };
  /* the results' own "Clear search": the cursor goes back to the search box when one is showing */
  const clearFromResults = () => {
    typeQuery("");
    root.current?.querySelector<HTMLInputElement>("header input")?.focus({ preventScroll: true });
  };
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
  const shop = shopTarget(config);
  /* what the store offers now (the ways to pay and home delivery, as its checkout works them out): the promises of its
     parts follow it (sellsOf) */
  const platform = usePublicSettings();
  const sellsNow = sellsOf(platform, data);
  const sellsKey = `${sellsNow.pays.join()}|${sellsNow.delivers}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sells = useMemo(() => sellsNow, [sellsKey]);
  const ctx: Ctx = useMemo(
    () => ({ lang, compact, data: goods, config: look, shop, design, owner, visitor: !!visitor, interactive, qty, setQty, openPage: openPageS, openProduct: openProductS, showSection: showSectionS, sells }),
    [lang, compact, goods, look, shop, design, owner, visitor, interactive, qty, setQty, openPageS, openProductS, showSectionS, sells],
  );

  /* his text and title colors, unless they vanish on his background (the same color, or too close): then automatic ones that read */
  const pageText = legibleOn(config.theme.text, config.theme.background);
  const pageTitle = legibleOn(config.theme.titleColor || pageText, config.theme.background, pageText);
  const vars = {
    "--sf-primary": primary,
    "--sf-on": onColor(primary),
    "--sf-bg": config.theme.background,
    "--sf-text": pageText,
    "--sf-title": pageTitle,
    "--sf-r": radiusValue[config.theme.radius],
    /* The same choice of corners, for the other shapes: big cards and blocks, the pictures inside them, and buttons and pills */
    "--sf-r2": { none: "0px", md: "16px", xl: "28px" }[config.theme.radius],
    "--sf-ri": { none: "0px", md: "8px", xl: "20px" }[config.theme.radius],
    "--sf-pill": { none: "0px", md: "12px", xl: "999px" }[config.theme.radius],
    "--sf-accent": config.theme.accent || primary,
    /* The sale badges, sale prices and the basket count: his sale color, or the store color */
    "--sf-sale": config.theme.saleColor || primary,
    "--sf-onsale": onColor(config.theme.saleColor || primary),
    /* the sale and accent colors when they color words: kept readable on the page's background */
    "--sf-saletext": readableOn(config.theme.saleColor || primary, config.theme.background, pageText),
    "--sf-primarytext": readableOn(primary, config.theme.background, pageText),
    "--sf-accenttext": readableOn(config.theme.accent || primary, config.theme.background, pageText),
    "--sf-heading": headingFamily(config.theme),
    "--sf-sy": config.theme.spacing === "airy" ? "96px" : "40px",
    "--sf-syc": config.theme.spacing === "airy" ? "56px" : "28px",
    "--sf-sb": config.theme.spacing === "airy" ? "16px" : "40px",
    "--sf-sbc": config.theme.spacing === "airy" ? "8px" : "28px",
    background: config.theme.background,
    color: pageText,
    fontFamily: fontFamily[config.theme.font] || undefined,
  } as React.CSSProperties;

  /* the search bar and the basket are always there, and the header always stays in view while scrolling (no longer
     switches in the designer; older saved designs that turned them off get them back) */
  const h = { ...config.header, showSearch: true, showCart: true, sticky: true };
  const tagline = config.identity.tagline?.[lang] || config.identity.tagline?.[lang === "ar" ? "en" : "ar"];
  /* the name shows beside the logo unless he switched it off; with no logo the name always shows */
  const nameShown = config.identity.showName !== false || !config.identity.showLogo;
  /* the designer with no store name yet: an empty, dashed place for it (never a made-up name that looks saved) */
  const namePlace = design && store && !store.name?.trim() ? (
    <span className="truncate rounded-md border-2 border-dashed border-rose-400 px-2.5 py-0.5 text-sm font-bold text-rose-500">{lang === "ar" ? "اكتب اسم متجرك" : "Write your store name"}</span>
  ) : null;
  const nameSizeOwn = config.identity.nameSize ? (compact ? Math.round(config.identity.nameSize * 0.75) : config.identity.nameSize) : undefined;
  /* the name's and the small line's own colors, on the header (the page's background): one that vanishes there gives way to the theme's */
  const nameColor = (config.identity.nameColor && readsOn(config.identity.nameColor, config.theme.background) && config.identity.nameColor) || undefined;
  const taglineColor = (config.identity.taglineColor && readsOn(config.identity.taglineColor, config.theme.background) && config.identity.taglineColor) || "var(--sf-accent)";
  /* in the pill header the name sits on a pill of the text color: his name color there too, where it reads on that pill */
  const pillNameColor = (config.identity.nameColor && readsOn(config.identity.nameColor, pageText) && config.identity.nameColor) || "var(--sf-bg)";
  /* a link's own color, where it reads on what the link sits on (the page, or a white pill); otherwise the usual color */
  const linkColor = (c: string | undefined, on: string) => (c && readsOn(c, on) ? c : undefined);
  const drawerLinkOn = config.theme.titleStyle === "pop" ? "#ffffff" : config.theme.background;
  /* the parts of the store the designer's open settings point at (see spotSignal): an empty one gets a dashed place */
  const spots = useSpots();
  const spotted = (key: string) => !!design && spots.some((s) => s.key === key);
  const taglineHole = !tagline && spotted("identity:tagline");
  const brand = (
    <a href="#" data-spot="identity" onClick={(e) => { e.preventDefault(); if (design) { e.stopPropagation(); design.select("identity"); } }} className={`flex min-w-0 items-center gap-2.5 ${design ? "rounded-md outline-2 outline-offset-4 outline-transparent transition hover:outline-dashed hover:outline-[#14b8a6]" : ""}`}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      {(nameShown || tagline || taglineHole) && (
        <span className={`flex min-w-0 flex-col ${centered ? "items-center" : nameEnd ? "items-end" : ""}`}>
          {/* his own size wins (a little smaller on a phone); without one, the theme's */}
          {!nameShown ? null : namePlace ?? (config.identity.nameFont ? (
            <span dir="auto" className={`max-w-full truncate font-bold leading-tight ${centered ? "" : nameEnd ? "ltr:text-right rtl:text-left" : "ltr:text-left rtl:text-right"}`} style={{ fontFamily: heroTitleFamily(config.identity.nameFont), color: nameColor, fontSize: nameSizeOwn ?? (compact ? 30 : 40) }}><bdi>{data.name}</bdi></span>
          ) : (
            <span dir="auto" className={`max-w-full truncate font-extrabold tracking-tight ${centered ? "" : nameEnd ? "ltr:text-right rtl:text-left" : "ltr:text-left rtl:text-right"} ${compact ? "text-lg" : "text-xl"}`} style={{ color: nameColor, fontSize: nameSizeOwn }}><bdi>{data.name}</bdi></span>
          ))}
          {/* the small line under the name ("FINE JEWELRY"), in an elegant italic; Arabic is never slanted or spaced out (it breaks the joined letters) */}
          {taglineHole && <SpotHole spot="identity:tagline" text={holeWords[lang].tagline} className="mt-1" />}
          {tagline && (
            <span data-spot="identity:tagline" dir="auto" className={`mt-1 max-w-full truncate ${centered ? "" : nameEnd ? "ltr:text-right rtl:text-left" : "ltr:text-left rtl:text-right"} text-sm ${config.identity.taglineFont || hasArabic(tagline) ? "" : "tracking-[0.2em]"}`} style={{ fontFamily: config.identity.taglineFont ? heroTitleFamily(config.identity.taglineFont) : "var(--font-elegant-latin), Georgia, serif", fontStyle: config.identity.taglineFont || hasArabic(tagline) ? undefined : "italic", color: taglineColor }}><bdi>{tagline}</bdi></span>
          )}
        </span>
      )}
    </a>
  );

  /* the search bar opened from its icon (declared before the buttons that use it) */
  const [searchOpen, setSearchOpen] = useState(false);
  const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/[0.08] transition hover:ring-black/25";
  /* the white buttons and boxes of the header and the menu: their icons and words in the page's colors worked out again
     for white (the page text's rule), so the light text of a dark page never sits on white */
  const onWhite = surfaceInk(ctx, "#ffffff");
  /* the search as an icon beside the basket (it opens its field right beside it), or as a full bar: his choice, and with
     none an icon when the name is in the middle. On a phone there is no room for a bar in the row: always the icon */
  const searchIcon = compact || (config.nav.searchLook ?? (centered ? "icon" : "bar")) === "icon";
  /* the field opened from a search icon: focused at once; Escape or a press anywhere else closes it */
  const searchField = useRef<HTMLInputElement>(null);
  /* in the designer, while his search settings are open, the search field stays open so he sees what he changes (it closes when
     he leaves them); it does not take the cursor or close on a press in the settings */
  const searchSpotted = spotted("search");
  useEffect(() => {
    /* only a search behind an icon has a field to open (an always-open box is already there) */
    const zone = searchSpotted ? root.current?.querySelector("header [data-search-zone]") : null;
    if (!zone) return setSearchOpen(false);
    setSearchOpen(true);
    /* measured once the preview has settled (right after a screen opens it can still be moving into place) */
    const t = setTimeout(() => measureAt(zone), 80);
    return () => clearTimeout(t);
  }, [searchSpotted, config.nav.searchLook, config.nav.style, config.nav.searchSize, config.identity.align, compact]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!searchOpen || searchSpotted) return;
    searchField.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.("[data-search-zone]")) setSearchOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [searchOpen, searchSpotted]);
  /* where the pressed search button sits in the header (its half of the row, and the room from it to the far side), so the
     field opens toward the middle and never past the edge, whichever side the name and buttons are on */
  const [searchAt, setSearchAt] = useState<{ right: boolean; room: number }>({ right: true, room: 288 });
  const measureSearch = (e: React.PointerEvent<HTMLElement>) => measureAt(e.currentTarget);
  function measureAt(el: Element) {
    const row = el.closest("header")?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!row || !row.width) return;
    const right = r.left + r.width / 2 > row.left + row.width / 2;
    setSearchAt({ right, room: Math.round(right ? r.right - row.left - 16 : row.right - r.left - 16) });
  };
  /* A search button with its field right beside it, in the header row (never on a row of its own): on a wide screen it
     opens toward the middle of the row, on a phone just under the button */
  /* the field a search icon opens: as wide as he chose (small, medium, large), never past the row */
  const popWidth = { small: 200, medium: 288, large: 420 }[config.nav.searchSize ?? "medium"];
  const searchPop = (trigger: React.ReactNode) => (
    <span data-search-zone onPointerDownCapture={measureSearch} className="relative inline-flex shrink-0">
      {trigger}
      {searchOpen && h.showSearch && (
        <span className={`absolute z-30 ${compact ? `top-full mt-2 ${searchAt.right ? "right-0" : "left-0"}` : `top-1/2 -translate-y-1/2 ${searchAt.right ? "right-full mr-2" : "left-full ml-2"}`}`} style={{ width: Math.max(160, Math.min(compact ? 256 : popWidth, searchAt.room)) }}>
          <input
            ref={searchField}
            value={query}
            onChange={(e) => typeQuery(e.target.value)}
            onKeyDown={searchKeys}
            onClick={(e) => e.stopPropagation()}
            maxLength={SEARCH_MAX}
            enterKeyHint="search"
            placeholder={config.texts.search[lang] || c.search}
            aria-label={config.texts.search[lang] || c.search}
            className="h-10 w-full rounded-full bg-white ps-4 pe-10 text-sm leading-[2] text-[#1c1a17] shadow-lg outline-none ring-1 ring-black/[0.12] transition placeholder:text-black/50 focus:ring-2 focus:ring-[var(--sf-primary)]"
          />
          {clearX("absolute end-1.5 top-1/2 -translate-y-1/2 !text-black/60")}
        </span>
      )}
    </span>
  );

  const search = h.showSearch && (
    <label className="relative block min-w-[11rem] flex-1" style={onWhite}>
      <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sf-text/45">{icons.search}</span>
      <input
        value={query}
        onChange={(e) => typeQuery(e.target.value)}
        onKeyDown={searchKeys}
        maxLength={SEARCH_MAX}
        enterKeyHint="search"
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-11 w-full rounded-full bg-white ps-12 pe-10 text-sm leading-[2] outline-none ring-1 ring-black/[0.08] transition placeholder:text-sf-text/70 focus:ring-2 focus:ring-[var(--sf-primary)]"
      />
      {clearX("absolute end-2 top-1/2 -translate-y-1/2")}
    </label>
  );

  const menuBtn = h.showMenu && (
    <button type="button" onClick={(e) => { /* only opens the menu: in the designer it must not also pick the header and leave the settings he is in */ e.stopPropagation(); setMenu(true); }} aria-label={c.menu} data-spot="menu" className={iconBtn} style={onWhite}>
      {icons.menu}
    </button>
  );


  /* the full search bar's width and place (beside the basket, or in the middle of the header) */
  const searchSize = config.nav.searchSize ?? "medium";
  const searchByCart = config.nav.searchPlace === "cart";
  const searchWidth = { small: "max-w-xs", medium: "max-w-xl", large: "max-w-3xl" }[searchSize];
  const searchWidthMid = { small: "w-44", medium: "w-64", large: "w-80" }[searchSize];
  const actions = (
    <div className={`flex shrink-0 items-center gap-2 ${nameEnd ? "flex-row-reverse" : ""}`}>
              {searchIcon && searchPop(
                <button type="button" onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); }} aria-label={config.texts.search[lang] || c.search} aria-expanded={searchOpen} className={iconBtn} style={onWhite}>
                  {icons.search}
                </button>
              )}
              {h.showCart && (
                <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white ps-3 pe-3 text-sm font-bold ring-1 ring-black/[0.08] transition hover:ring-black/25" style={onWhite}>
                  <span className="relative">
                    {icons.bag}
                    {cart.count > 0 && (
                      <span className="absolute -end-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold" style={{ background: "var(--sf-sale)", color: "var(--sf-onsale)" }}>
                        {cart.count}
                      </span>
                    )}
                  </span>
                  {!compact && config.nav.cartTotal !== false && (
                    <span dir="ltr" className={settled ? undefined : "invisible"}>
                      {moneyIn(cart.total, priceLang(config.theme.prices, lang))} <small className="font-semibold opacity-60">{currency(priceLang(config.theme.prices, lang))}</small>
                    </span>
                  )}
                </button>
              )}
              </div>
  );

  /* The parts of the home page that show nothing to customers (an empty part draws no element), found after each drawing of the
     home page; kept while a page or a product is open, since the home page is not drawn then */
  const [emptyParts, setEmptyParts] = useState<string[]>([]);
  useEffect(() => {
    if (design || pageId !== null || productId !== null || !root.current) return;
    const empty = config.sections.filter((s) => !root.current?.querySelector(`[data-sf="${CSS.escape(s.id)}"]`)?.childElementCount).map((s) => s.id);
    setEmptyParts((was) => (was.join() === empty.join() ? was : empty));
  });

  /* The header with a row of links: logo | links | plain icons (account, saved, search, basket) */
  /* Customers only get links that have words and somewhere to go, and never one to a part of the page they do not see
     (hidden, or with nothing in it yet: no reviews, no products picked). The designer's preview draws the header the same
     way, so a link customers never see does not take the header's room there (nor push the store name out); the designer's
     link list says on such a link what it is missing. The preview draws an empty part as a dashed place, so there it asks
     whether the part would show anything to customers (emptyForCustomers, the same conditions the parts check). */
  /* every navigation style has links: in the header row (links, pill) or in a bar under it (sidebar button) */
  const hiddenPart = (to: string) => (design ? config.sections.some((s) => s.id === to && emptyForCustomers(s, data, lang, sells)) : emptyParts.includes(to));
  const navOwn = config.nav.links
    .map((l, at) => ({ at, name: l[lang]?.trim() || l[lang === "ar" ? "en" : "ar"]?.trim(), to: l.to?.trim() || undefined, color: l.color as string | undefined, hole: false }))
    .filter((l) => !!l.name && !!l.to && !hiddenPart(l.to));
  /* in the designer, his navigation settings open with no links yet: the header is drawn as it will be, with one link that
     says where his links will show */
  const navLinks = navOwn.length || !spotted("nav") ? navOwn : [{ at: -1, name: holeWords[lang].links, to: undefined, color: undefined, hole: true }];
  /* with his navigation settings open, the search gives the links their place back (an open search hides the pill of links) */
  const navSpotted = spotted("nav");
  useEffect(() => {
    if (navSpotted) setSearchOpen(false);
  }, [navSpotted]);
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
    /* a part of the home page: a search showing gives way to the home page first */
    const searching = !!queryNow.current.trim();
    if (searching) endSearch(pageId === null && productId === null);
    if (pageId !== null || productId !== null) {
      closePage();
      setTimeout(scroll, 60);
    } else if (searching) setTimeout(scroll, 60);
    else scroll();
  };
  latest.current.showSection = showSection;
  /* The header rows in three columns. The buttons' columns keep their full width, so a long store name gives way (it ends
     with "…") instead of pushing the basket out or wrapping its price: the name in the middle, or the name at the start. */
  const nameMid = "grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)]";
  const nameSide = "grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)]";
  const nameSideEnd = "grid-cols-[minmax(max-content,1fr)_auto_minmax(0,1fr)]";
  /* the chosen navigation style decides the header, with or without links in it: adding the first link only adds a link,
     it does not change how the whole header looks */
  const pillHeader = config.nav.style === "pill";
  const linksHeader = config.nav.style === "links";
  /* the pill of links, or the search in its place while it is open (nothing at all with no links and no search) */
  const pillMiddle = searchOpen && h.showSearch ? "search" : navLinks.length ? "links" : null;
  const [navOn, setNavOn] = useState(0);
  /* The pill header: the name in a dark pill, the links in a white pill (the chosen one colored), and a round basket button */
  const pillBrand = (
    <a href="#" data-spot="identity" onClick={(e) => { e.preventDefault(); if (design) { e.stopPropagation(); design.select("identity"); } }} className="inline-flex min-w-0 max-w-full items-center gap-2.5 px-5 py-2 text-xl font-extrabold" style={{ background: "var(--sf-text)", color: pillNameColor, fontFamily: "var(--sf-heading)", borderRadius: "var(--sf-r2)" }}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      {namePlace ?? <span dir="auto" className="min-w-0 truncate ltr:text-left rtl:text-right" style={{ fontSize: nameSizeOwn }}>{data.name}</span>}
    </a>
  );
  /* With the search open, the pill of links turns into the search field in the same place, and the links are hidden until it closes */
  const pillSearch = (
    <label data-search-zone onClick={(e) => e.stopPropagation()} className={`flex h-[46px] w-full min-w-[16rem] ${{ small: "max-w-xs", medium: "max-w-md", large: "max-w-xl" }[config.nav.searchSize ?? "medium"]} items-center gap-2 border-2 border-[var(--sf-text)] bg-white px-4`} style={{ borderRadius: "var(--sf-pill)" }}>
      <span className="shrink-0 text-sf-text/60">{icons.search}</span>
      <input
        autoFocus={!design}
        value={query}
        onChange={(e) => typeQuery(e.target.value)}
        onKeyDown={searchKeys}
        maxLength={SEARCH_MAX}
        enterKeyHint="search"
        placeholder={config.texts.search[lang] || c.search}
        aria-label={config.texts.search[lang] || c.search}
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-sf-text/50"
      />
      <button type="button" onClick={() => { setSearchOpen(false); if (query) typeQuery(""); }} aria-label={c.close} className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-black/[0.06]">
        {icons.close}
      </button>
    </label>
  );
  const pillNav = (
    <nav aria-label={c.pages} className="flex items-center gap-1 border-2 border-[var(--sf-text)] bg-white p-1 text-sm font-bold" style={{ ...onWhite, borderRadius: "var(--sf-pill)" }}>
      {navLinks.map((l, i) => (
        <a
          key={i}
          href={l.to ? `#${l.to}` : "#"}
          onClick={(e) => { goTo(e, l.to); setNavOn(i); }}
          className="whitespace-nowrap px-4 py-1.5 transition duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-black/[0.07] active:scale-95"
          style={{ borderRadius: "var(--sf-pill)", ...(linkColor(l.color, "#ffffff") ? { color: l.color } : {}), ...(i === navOn ? { background: config.nav.activeColor || "#ff8fb1", color: onColor(config.nav.activeColor || "#ff8fb1") } : {}) }}
        >
          {l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}
        </a>
      ))}
    </nav>
  );
  /* The other buttons of the header follow their switches in the pill header too: menu, search, account, language */
  const pillIcon = "relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-white transition hover:-translate-y-0.5";
  const pillMenu = h.showMenu && (
    <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(true); }} aria-label={c.menu} data-spot="menu" className={pillIcon} style={onWhite}>
      {icons.menu}
    </button>
  );
  /* the links and pill headers: the search box open all the time when he asks for it (an icon otherwise); on a phone always the icon */
  const searchAlways = !compact && config.nav.style !== "button" && config.nav.searchLook === "bar";
  /* the pill header's always-open search: a white pill with a thick line, like its buttons */
  const pillBar = (
    <label className={`flex h-11 shrink-0 items-center gap-2 border-2 border-[var(--sf-text)] bg-white px-4 ${searchWidthMid}`} style={{ ...onWhite, borderRadius: "var(--sf-pill)" }}>
      <span className="shrink-0 text-sf-text/60">{icons.search}</span>
      <input value={query} onChange={(e) => typeQuery(e.target.value)} onKeyDown={searchKeys} maxLength={SEARCH_MAX} enterKeyHint="search" placeholder={config.texts.search[lang] || c.search} aria-label={config.texts.search[lang] || c.search} className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-sf-text/50" />
      {clearX("-me-2")}
    </label>
  );
  const pillExtras = (
    <>
      {h.showSearch && searchAlways && pillBar}
      {h.showSearch && !searchAlways && (
        <button type="button" data-search-zone onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); }} aria-label={config.texts.search[lang] || c.search} aria-expanded={searchOpen} className={`${pillIcon} ${searchOpen ? "!bg-[var(--sf-text)] !text-[var(--sf-bg)]" : ""}`} style={searchOpen ? undefined : onWhite}>
          {icons.search}
        </button>
      )}
    </>
  );
  const pillCart = h.showCart && (
    <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)]" style={{ background: config.nav.cartColor || "#b9f3d0", ...surfaceInk(ctx, config.nav.cartColor || "#b9f3d0") }}>
      {icons.bag}
      {cart.count > 0 && <span className="absolute -start-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--sf-text)] px-1 text-[10px] font-extrabold text-[var(--sf-text)]" style={config.theme.saleColor ? { background: "var(--sf-sale)", color: "var(--sf-onsale)" } : { background: "#ff8fb1", ...surfaceInk(ctx, "#ff8fb1") }}>{cart.count}</span>}
    </button>
  );
  const plain = "relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--sf-text)] transition hover:bg-black/[0.05]";
  const textCart = config.nav.cartLook === "text";
  /* the Latin digits in both languages, like every number of the store (see moneyIn) */
  const digits = (n: number) => String(n);
  const wordBtn = "inline-flex min-h-[44px] items-center whitespace-nowrap text-sm font-light tracking-[0.04em] transition hover:opacity-70";
  /* the buttons' side of the row: the end, or the start when the name sits at the end (mirrored, the search nearest the middle) */
  const plainRow = nameEnd ? "flex-row-reverse justify-end" : "justify-end";
  const plainActions = textCart ? (
    <div className={`flex items-center gap-3 ${plainRow}`}>
      {h.showSearch && searchAlways && <div className={`shrink-0 ${searchWidthMid}`}>{search}</div>}
      {h.showSearch && !searchAlways && (
        <>
          {searchPop(<button type="button" onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); }} aria-expanded={searchOpen} className={wordBtn}>{config.texts.search[lang] || c.search}</button>)}
          <span aria-hidden className="opacity-50">·</span>
        </>
      )}
      {config.nav.showSaved !== false && (
        <>
          <button type="button" className={wordBtn}>{lang === "ar" ? "المفضلة" : "Saved"}</button>
          <span aria-hidden className="opacity-50">·</span>
        </>
      )}
      {h.showCart && <button type="button" onClick={openCart} aria-label={`${c.cart}: ${cart.count}`} className={wordBtn}>{c.cart} <span className={`ms-1 ${settled ? "" : "invisible"}`} style={config.theme.saleColor ? { color: "var(--sf-sale)" } : undefined}>({digits(cart.count)})</span></button>}
    </div>
  ) : (
    <div className={`flex items-center ${plainRow}`}>
      {h.showSearch && searchAlways && <div className={`me-1 shrink-0 ${searchWidthMid}`}>{search}</div>}
      {h.showSearch && !searchAlways && searchPop(
        <button type="button" onClick={(e) => { e.stopPropagation(); setSearchOpen((v) => !v); }} aria-label={config.texts.search[lang] || c.search} aria-expanded={searchOpen} className={plain}>
          {icons.search}
        </button>
      )}
      {config.nav.showSaved !== false && <button type="button" aria-label={c.like} className={plain}>{icons.heart}</button>}
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

      <AnnouncementBar config={config} lang={lang} design={design} reduceMotion={reduceMotion} offer={sells.delivers ? freeDeliveryText(fd, lang, cart.total, priceLang(config.theme.prices, lang)) : ""} offerColor={primary} linkFor={(l) => linkProps(l, ctx)} spotted={spotted("announcement")} />

      <header onClick={() => design?.select("header")} className={`group/sel z-20 ${pillHeader ? "" : config.theme.hairlines ? "border-b border-[color-mix(in_srgb,var(--sf-primary)_25%,transparent)] backdrop-blur-xl" : "border-b border-black/[0.06] backdrop-blur-xl"} ${h.sticky ? "sticky top-0" : "relative"} ${design ? "cursor-pointer" : ""}`} style={{ background: pillHeader ? "color-mix(in srgb, var(--sf-bg) 94%, transparent)" : "color-mix(in srgb, var(--sf-bg) 86%, transparent)" }}>
        {pillHeader ? (
          centered ? (
            /* The name in the middle: menu | name | buttons, and the links under it */
            <div className={compact ? "px-4 py-3" : "px-8 py-4"}>
              <div className={`grid ${nameMid} items-center gap-2`}>
                <div className="flex items-center justify-start gap-2">{pillMenu}</div>
                <div className="min-w-0">{pillBrand}</div>
                <div className="flex items-center justify-end gap-2">{pillExtras}{pillCart}</div>
              </div>
              {pillMiddle && <div className="mt-3 flex justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{pillMiddle === "search" ? pillSearch : pillNav}</div>}
            </div>
          ) : compact ? (
            <div className="px-4 py-3">
              <div className={`flex items-center justify-between gap-3 ${nameEnd ? "flex-row-reverse" : ""}`}>
                <div className={`flex min-w-0 items-center gap-2 ${nameEnd ? "flex-row-reverse" : ""}`}>{pillMenu}{pillBrand}</div>
                <div className={`flex shrink-0 items-center gap-2 ${nameEnd ? "flex-row-reverse" : ""}`}>{pillExtras}{pillCart}</div>
              </div>
              {pillMiddle && <div className="mt-3 flex justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{pillMiddle === "search" ? pillSearch : pillNav}</div>}
            </div>
          ) : nameEnd ? (
            /* mirrored: buttons | links | name, the menu button at the outer edge */
            <div className={`grid ${nameSideEnd} items-center gap-6 px-8 py-4`}>
              <div className="flex flex-row-reverse items-center justify-end gap-2">{pillExtras}{pillCart}</div>
              {pillMiddle === "search" ? pillSearch : pillMiddle === "links" ? pillNav : <span />}
              <div className="flex min-w-0 flex-row-reverse items-center justify-start gap-2">{pillMenu}{pillBrand}</div>
            </div>
          ) : (
            <div className={`grid ${nameSide} items-center gap-6 px-8 py-4`}>
              <div className="flex min-w-0 items-center justify-start gap-2">{pillMenu}{pillBrand}</div>
              {pillMiddle === "search" ? pillSearch : pillMiddle === "links" ? pillNav : <span />}
              <div className="flex items-center justify-end gap-2">{pillExtras}{pillCart}</div>
            </div>
          )
        ) : linksHeader ? (
          centered && !compact && config.nav.place === "start" ? (
            <div className={`grid ${nameMid} items-center gap-6 px-8 py-7`}>
              <nav aria-label={c.pages} className="flex items-center justify-start gap-7 text-[14px] font-light tracking-[0.04em]">
                {menuBtn}
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center text-[var(--sf-text)] transition duration-200 hover:text-[var(--sf-primary)]" style={linkColor(l.color, config.theme.background) ? { color: l.color } : undefined}>{l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}</a>
                ))}
              </nav>
              <div className="min-w-0">{brand}</div>
              {plainActions}
            </div>
          ) : centered && !compact ? (
            <div className="px-8 py-3">
              <div className={`grid ${nameMid} items-center gap-3`}>
                <div className="flex items-center justify-start">{menuBtn}</div>
                <div className="min-w-0">{brand}</div>
                <div className="flex items-center justify-end">{plainActions}</div>
              </div>
              <nav aria-label={c.pages} className="mt-2 flex items-center justify-center gap-9 text-[14px]">
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]" style={linkColor(l.color, config.theme.background) ? { color: l.color } : undefined}>{l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}</a>
                ))}
              </nav>
            </div>
          ) : compact && config.nav.place === "start" ? (
            /* on a phone: the name on top, the links and the basket under it */
            <div className="px-4 py-4">
              <div className="flex justify-center">{brand}</div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] font-light">
                {menuBtn}
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[44px] items-center" style={linkColor(l.color, config.theme.background) ? { color: l.color } : undefined}>{l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}</a>
                ))}
                {plainActions}
              </div>
            </div>
          ) : compact ? (
            /* on a phone the name stays in the middle; the menu button and the other buttons swap sides when the name is set
               to the end */
            <div className={`grid ${nameMid} items-center gap-3 px-4 py-3`}>
              <div className="flex items-center justify-start">{nameEnd ? plainActions : menuBtn}</div>
              <div className="min-w-0">{brand}</div>
              <div className="flex items-center justify-end">{nameEnd ? menuBtn : plainActions}</div>
            </div>
          ) : (
            /* name | links | buttons, or mirrored when the name sits at the end (the menu button at the outer edge) */
            <div className={`grid ${nameEnd ? nameSideEnd : nameSide} items-center gap-6 px-8 py-3`}>
              {nameEnd && plainActions}
              {!nameEnd && <div className="flex min-w-0 items-center justify-start gap-3">{menuBtn}{brand}</div>}
              <nav aria-label={c.pages} className="flex items-center gap-9 text-[14px]">
                {navLinks.map((l, i) => (
                  <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-block text-[var(--sf-text)] transition duration-200 hover:-translate-y-0.5 hover:text-[var(--sf-primary)]" style={linkColor(l.color, config.theme.background) ? { color: l.color } : undefined}>{l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}</a>
                ))}
              </nav>
              {!nameEnd && plainActions}
              {nameEnd && <div className="flex min-w-0 flex-row-reverse items-center justify-start gap-3">{menuBtn}{brand}</div>}
            </div>
          )
        ) : centered ? (
          /* Name in the middle: menu (and the full search bar, when he chose it) | name | search icon and cart, all in one row */
          <div className={`grid ${nameMid} items-center gap-3 ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
            <div className="flex min-w-0 items-center justify-start gap-3">
              {menuBtn}
              {!searchIcon && !searchByCart && <div className={`min-w-0 ${searchWidthMid}`}>{search}</div>}
            </div>
            <div className="min-w-0">{brand}</div>
            <div className="flex items-center justify-end gap-3">
              {!searchIcon && searchByCart && <div className={`min-w-0 ${searchWidthMid}`}>{search}</div>}
              {actions}
            </div>
          </div>
        ) : (
          /* a long name gives way first (it ends with "…"): the search keeps its room and the basket never wraps; with the
             name at the end the row is mirrored (the menu button at the outer edge, the buttons at the start) */
          <div className={`flex items-center gap-3 ${nameEnd ? "flex-row-reverse" : ""} ${compact ? "px-4 py-3" : "px-8 py-4"}`}>
            {menuBtn}
            <div className={`min-w-0 ${compact ? "flex-1" : searchIcon ? "max-w-[40%] shrink" : "max-w-[40%] shrink-0"}`}>{brand}</div>

            {!compact && !searchIcon && !searchByCart && <div className={`mx-auto w-full min-w-0 shrink-[4] ${searchWidth}`}>{search}</div>}
            {!compact && (searchIcon || searchByCart) && <div className="flex-1" />}
            {!compact && !searchIcon && searchByCart && <div className={`w-full min-w-0 shrink-[4] ${searchWidth}`}>{search}</div>}

            {actions}
          </div>
        )}
        {/* with the sidebar button, his links sit in a bar of their own under the header, above the first section
            (like "Men, Women, Kids"); on a phone the bar slides sideways */}
        {config.nav.style === "button" && navLinks.length > 0 && (
          <nav aria-label={c.pages} className={`flex items-center gap-7 overflow-x-auto whitespace-nowrap border-t text-[14px] font-semibold [scrollbar-width:none] ${compact ? "px-4 py-2" : "px-8 py-2.5"} ${centered && !compact ? "justify-center" : ""}`} style={{ borderTopColor: "color-mix(in srgb, var(--sf-text) 10%, transparent)" }}>
            {navLinks.map((l, i) => (
              <a key={i} href={l.to ? `#${l.to}` : "#"} onClick={(e) => goTo(e, l.to)} className="inline-flex min-h-[36px] shrink-0 items-center text-[var(--sf-text)] transition duration-200 hover:text-[var(--sf-primary)]" style={linkColor(l.color, config.theme.background) ? { color: l.color } : undefined}>{l.hole ? <SpotHole spot="nav" text={l.name ?? ""} /> : <bdi>{l.name}</bdi>}</a>
            ))}
          </nav>
        )}
        {design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "header" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />}
      </header>

      {design && showCart && (
        /* the cart drawn inside the preview where he is looking, filled with the first products when nothing was added */
        <div className={`absolute inset-x-0 z-[60] ${cartAt ? "" : "top-0 h-[min(100%,880px)]"}`} style={cartAt ? { top: cartAt.top, height: cartAt.height } : undefined}>
          <CartPanel contained open onClose={onCartClose ?? (() => {})} lang={lang} lines={cartLines.length ? cartLines : data.products.filter((p) => p.quantity > 0).slice(0, 2).map((p) => ({ p, qty: 1 }))} products={data.products} setQty={setQty} fd={fd} priceLanguage={priceLang(config.theme.prices, lang)} onCleared={() => setQtyMap({})} pickup={data.pickup} ownFee={data.ownFee} ownCities={data.ownCities} shipMode={data.shipMode} chosenPays={data.pays} look={config.cart?.style} />
        </div>
      )}
      {/* on the public store the order goes to Dukkan's server for the merchant (a test order: no payment yet), in his preview it is saved in his browser */}
      {basketFull > 0 && !design && (
        <p role="status" className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-md rounded-2xl bg-[#1c1a17] px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
          {lang === "ar"
            ? `تتسع سلتك لـ ${ORDER_LIMITS.lines} منتجًا مختلفًا كحد أقصى. أكمل هذا الطلب أولًا، ثم أضف المزيد في طلب جديد.`
            : `Your cart can hold up to ${ORDER_LIMITS.lines} different products. Place this order first, then add more in a new one.`}
        </p>
      )}
      {!design && interactive && <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} lang={lang} lines={cartLines} products={data.products} setQty={setQty} fd={fd} priceLanguage={priceLang(config.theme.prices, lang)} onCleared={() => setQtyMap({})} pickup={data.pickup} ownFee={data.ownFee} ownCities={data.ownCities} shipMode={data.shipMode} chosenPays={data.pays} look={config.cart?.style} orderTo={visitor ? visitor.setup.slug : undefined} />}
      <main>
        {shownProduct ? (
          <>
          {sampleProduct && (
            <p data-sample-product className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs font-medium`} style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }}>
              {lang === "ar" ? "منتج تجريبي: أضف منتجاتك لترى منتجك هنا" : "A sample product: add your products to see yours here"}
              <a href="/products" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="font-bold text-[var(--sf-primary)] underline underline-offset-2">{lang === "ar" ? "أضف منتجًا" : "Add a product"}</a>
            </p>
          )}
          <ProductPage p={shownProduct} ctx={ctx} onBack={closePage} look={config.productPage?.style} fd={fd} pickup={data.pickup} sections={config.sections} ask={whatsappHref(config.footer.whatsapp?.trim() || data.whatsapp)} />
          </>
        ) : shownPage ? (
          <>
            <section className={`${compact ? "px-4 pt-8" : "px-8 pt-12"} ${shownPage.sections.length || design ? "pb-2" : compact ? "min-h-[420px] pb-10" : "min-h-[640px] pb-16"}`}>
              <div className="mx-auto max-w-3xl">
                <button type="button" onClick={closePage} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sf-accenttext,var(--sf-accent))] hover:underline">
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
        ) : design && !config.sections.length ? (
          /* the home page with every block taken off: only the designer sees where blocks would go */
          <p className={`${compact ? "mx-4" : "mx-8"} my-10 rounded-[var(--sf-r)] border-2 border-dashed border-sf-primary/40 px-4 py-14 text-center text-sm font-semibold text-[var(--sf-primary)]`}>
            {lang === "ar" ? "الصفحة فارغة: أضف أول عنصر من «عناصر الصفحة» في القائمة الجانبية" : "This page is empty: add your first block from Page elements in the side panel"}
          </p>
        ) : (
          <>
            {searchQ && <SearchResults query={searchQ} items={found} ctx={ctx} onClear={clearFromResults} />}
            {/* hidden, not taken away, while a search shows: its sliders and places are as he left them when it clears */}
            <div style={{ display: searchQ ? "none" : "contents" }}>{config.sections.map((s) => renderSection(s, ctx))}</div>
          </>
        )}
      </main>

      {/* "Report this store" is for customers on a live store: never in the designer, a static or theme preview, or the owner's own look */}
      <Footer config={config} data={data} compact={compact} lang={lang} design={design} logo={logo} namePlace={namePlace} onPage={openPage} onSection={(id) => { if (!design) showSection(id); }} reportSlug={!design && interactive && !owner && !products && !data.isDemo ? data.slug : ""} />

      {menu && (
        /* the sidebar opens from the side its button is on (the end, when the name and the menu button sit there) */
        <div className={`absolute inset-0 z-30 flex ${nameEnd ? "justify-end" : ""}`} role="dialog" aria-modal="true" aria-label={c.menu}>
          <button type="button" aria-label={c.close} onClick={() => setMenu(false)} className="absolute inset-0 bg-black/40" />
          <nav className={`relative z-10 flex h-full w-80 max-w-[85%] flex-col gap-6 overflow-y-auto p-6 shadow-2xl ${config.theme.titleStyle === "pop" ? (nameEnd ? "border-s-2 border-[var(--sf-text)]" : "border-e-2 border-[var(--sf-text)]") : ""}`} style={{ background: "var(--sf-bg)", color: "var(--sf-text)" }}>
            <div className="flex items-center justify-between">
              {config.nav.style === "pill" ? pillBrand : brand}
              <button type="button" onClick={() => setMenu(false)} aria-label={c.close} style={onWhite} className={config.theme.titleStyle === "pop" ? "grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[var(--sf-text)] bg-white transition hover:-translate-y-0.5" : iconBtn}>
                {icons.close}
              </button>
            </div>
            {config.drawer.items.filter((it) => it.visible).map((it) => {
              const rows: { key: string | number; title: string; on: () => void; color?: string }[] =
                it.kind === "categories"
                  ? data.categories.map((name) => ({ key: name, title: name, on: () => { setMenu(false); searchFor(name); } }))
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
                    : navLinks.filter((l) => !l.hole).map((l) => ({ key: l.at, title: l.name, color: l.color, on: () => { setMenu(false); goTo({ preventDefault() {} } as React.MouseEvent, l.to); } }));
              /* the items he left out of this group in the designer */
              const shown = rows.filter((r) => !(it.hidden ?? []).includes(String(r.key)));
              if (!shown.length) return null;
              const heading = it.title?.[lang]?.trim() || drawerHeading(it.kind, lang);
              return (
                <div key={it.kind}>
                  <p className={config.theme.titleStyle === "pop" ? "mb-3 text-lg font-extrabold" : "mb-2 text-xs font-bold uppercase tracking-wide text-sf-text/50"} style={config.theme.titleStyle === "pop" ? { color: "var(--sf-accenttext, var(--sf-accent))", fontFamily: "var(--sf-heading)" } : undefined}><bdi>{heading}</bdi></p>
                  <ul className={config.theme.titleStyle === "pop" ? "space-y-2" : "space-y-1"}>
                    {shown.map((r) => (
                      <li key={r.key}>
                        <button type="button" onClick={r.on} className={config.theme.titleStyle === "pop" ? "w-full rounded-full border-2 border-[var(--sf-text)] bg-white px-5 py-2.5 text-start text-base font-bold transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02]" : "w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition duration-200 hover:bg-black/[0.05] hover:ps-4"} style={{ ...(config.theme.titleStyle === "pop" ? onWhite : {}), ...(linkColor(r.color, drawerLinkOn) ? { color: r.color } : {}) }}>
                          <bdi>{r.title}</bdi>
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

function AnnouncementBar({ config, lang, design, reduceMotion, offer, offerColor, linkFor, spotted = false }: { config: StorefrontConfig; lang: "en" | "ar"; design?: Design; reduceMotion: boolean; offer: string; offerColor: string; linkFor: (link: string) => React.AnchorHTMLAttributes<HTMLAnchorElement>; /* its settings are open in the designer: switched off, it shows where it would be */ spotted?: boolean }) {
  const a = config.announcement;
  /* only what he wrote in this language: an empty message is skipped (never the other language's words in its place) */
  const own = a.show ? a.messages.map((m) => ({ ...m, label: m.text[lang] ?? "" })).filter((m) => m.label.trim()) : [];
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

  if (!list.length) {
    /* turned on with nothing written yet: customers see no bar; the designer shows a dashed place that opens its settings */
    if (design && !a.show && spotted) return <div className="flex justify-center px-4 py-1.5"><SpotHole spot="announcement" text={holeWords[lang].bar} className="w-full" /></div>;
    if (!design || !a.show) return null;
    return (
      <button type="button" data-spot="announcement" onClick={() => design.select("announcement")} className="block w-full border-y border-dashed border-fg/25 bg-fg/[0.03] py-2 text-center text-xs font-semibold text-sf-text/55">
        {lang === "ar" ? "اكتب رسالة الشريط الإعلاني في الإعدادات لتظهر هنا" : "Write the announcement bar's message in its settings to show it here"}
      </button>
    );
  }
  const item = (m: (typeof list)[number], key: string, extra = "") => {
    /* his text color, unless it vanishes on the bar's color: then the automatic one */
    const color = legibleOn(m.textColor || onColor(m.color), m.color, onColor(m.color));
    const lead = m.link && m.link.trim() && !design;
    /* <bdi>: his words keep their own direction ("خصم 20%" in an English store, or inside the left-to-right ticker) */
    return lead ? (
      <a key={key} {...linkFor(m.link)} className={`underline-offset-2 hover:underline ${extra}`} style={{ color }}><bdi>{m.label}</bdi></a>
    ) : (
      <span key={key} className={extra} style={{ color }}><bdi>{m.label}</bdi></span>
    );
  };

  const wrap = `overflow-hidden text-sm font-semibold transition-colors duration-500 ${design ? "cursor-pointer" : ""}`;

  /* A ticker: every message slides across, over and over, and stops while the mouse is over it */
  if (a.motion === "ticker" && !reduceMotion) {
    const chars = list.reduce((n, m) => n + m.label.length, 0);
    /* one bar: every message in the colors of the first one (the free delivery offer too) */
    const bar = { color: list[0].color, textColor: list[0].textColor };
    const pace = { slow: 1.6, normal: 1, fast: 0.6 }[a.speed ?? "normal"];
    const copy = (k: string) => (
      <div key={k} className="flex shrink-0 items-center" aria-hidden={k !== "a"}>
        {[0, 1, 2].map((r) => list.map((m, n) => (
          <span key={`${r}-${n}`} className="flex items-center">
            {item({ ...m, ...bar }, `${k}${r}${n}`, "px-8")}
            <span aria-hidden className="opacity-50" style={{ color: legibleOn(bar.textColor || onColor(bar.color), bar.color, onColor(bar.color)) }}>•</span>
          </span>
        )))}
      </div>
    );
    return (
      <div role="note" data-spot="announcement" dir="ltr" onClick={() => design?.select("announcement")} className={`dk-ticker py-2 ${wrap}`} style={{ background: list[0].color }}>
        <div className={`dk-marquee flex w-max ${lang === "ar" ? "dk-marquee-rev" : ""}`} style={{ "--dk-d": `${Math.round(Math.max(20, chars * 0.9 * 3 / 2) * pace)}s` } as React.CSSProperties}>
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
      data-spot="announcement"
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
  /* any other kind of link (javascript:, data:, vbscript:, …) is never one, only "shop.com:8080" (a port) */
  if (/^[a-z][a-z0-9+.-]*:/i.test(l) && !/^https?:/i.test(l) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(l)) return null;
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

function Footer({ config, data, compact, lang, design, logo, namePlace, onPage, onSection, reportSlug = "" }: { config: StorefrontConfig; data: ReturnType<typeof useStoreData>; compact: boolean; lang: "en" | "ar"; design?: Design; logo: LogoConfig; /* the designer's empty place for the store name (none: the name) */ namePlace?: React.ReactNode; onPage: (id: number) => void; onSection: (id: string) => void; /* the store link "Report this store" is about (none: the link is not shown) */ reportSlug?: string }) {
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
  /* the design's own WhatsApp, or the one given in setup */
  const whatsapp = f.whatsapp?.trim() || data.whatsapp;
  const address = bi(f.address);
  const contactLines: Line[] = ([
    data.phone && { key: "phone", icon: icons.phone, text: data.phone, ltr: true, href: tel?.kind === "url" && tel.href.startsWith("tel:") ? tel.href : "" },
    whatsapp && { key: "whatsapp", icon: icons.whatsapp, text: whatsapp, ltr: true, href: whatsappHref(whatsapp), blank: true },
    f.telegram?.trim() && { key: "telegram", icon: icons.telegram, text: f.telegram, ltr: true, href: telegramHref(f.telegram), blank: true },
    f.email?.trim() && { key: "email", icon: icons.mail, text: f.email, ltr: true, href: mail?.kind === "url" && mail.href.startsWith("mailto:") ? mail.href : "" },
    address && { key: "address", icon: icons.pin, text: address, ltr: false, href: "" },
  ] as (Line | false | "" | undefined)[]).filter((x): x is Line => !!x);
  /* The about text: the footer's own words when it has some, otherwise the store's description (Store identity) */
  const aboutText = (f.about == null ? "" : bi(f.about)) || data.description;

  const cert = f.certificate;
  const certOther = cert.kind === "other" ? cert.label.trim() : "";
  const hasCertificate = !!(cert.number.trim() || cert.logo || certOther);
  /* The words of the badge show with a number or a name of his own; a logo alone is named for screen readers */
  const certText = cert.number.trim() || certOther ? certOther || c.certificate[cert.kind] : "";
  const certLink = resolveLink(cert.url);
  const certUrl = certLink?.kind === "url" ? certLink : null;

  const ownCols = new Map(footerColumns(f).filter((x) => x.kind === "custom").map((x) => [x.id, items(x.links)]));
  /* The columns, in the order the merchant chose. Visitors only see a column with something in it; the designer also shows empty ones. */
  const isOn = (col: ReturnType<typeof footerColumns>[number]) => {
    if (col.visible === false) return false;
    if (col.kind === "about") return !!(f.showLogo || aboutText);
    if (col.kind === "pages") return f.showLinks && (pageItems.length > 0 || !!design);
    if (col.kind === "contact") return f.showContact && (contactLines.length > 0 || !!design);
    if (col.kind === "social") return f.showSocial && (socials.length > 0 || !!design);
    if (col.kind === "licenses") return hasCertificate;
    return (ownCols.get(col.id)?.length ?? 0) > 0 || !!design;
  };
  /* the designer's settings of a column that does not show (hidden, or nothing in it yet) are open: it gets a dashed place */
  const spots = useSpots();
  const spotted = (col: ReturnType<typeof footerColumns>[number]) => !!design && spots.some((s) => s.key === `footer:${col.kind}`);
  const shown = footerColumns(f).filter((col) => isOn(col) || spotted(col));

  /* The parts both styles share */
  /* a long title breaks between words; inside a word only when one word alone is wider than the column */
  const heading = (text: string) => text && <h2 className={`${simple ? "mb-2" : "mb-3"} font-extrabold [overflow-wrap:break-word] [word-break:normal]`} style={{ fontSize: sizeTitle, color: "var(--sf-title)" }}><bdi>{text}</bdi></h2>;
  const brand = f.showLogo && (
    <div onClick={edit("name")} className={`inline-flex min-w-0 max-w-full items-center gap-2.5 font-extrabold ${hot}`} style={{ fontFamily: config.identity.nameFont ? heroTitleFamily(config.identity.nameFont) : "var(--sf-heading)", fontSize: sizeName, color: fc.name || undefined }}>
      {config.identity.showLogo && <LogoMark logo={logo} name={data.name} />}
      <span className="min-w-0">{namePlace ?? <bdi>{data.name}</bdi>}</span>
    </div>
  );
  const textSize = simple ? undefined : sizeText;
  const linkList = (label: string, list: Item[]) => (
    <nav aria-label={label || c.pages}>
      <ul className={simple ? "flex flex-wrap items-center gap-x-6 gap-y-2 font-medium" : "space-y-2"} style={{ color: dim(simple ? 75 : 70), fontSize: textSize }}>
        {/* an empty column: customers never see it; the designer says so and where to fill it */}
        {design && list.length === 0 && <li className="rounded-md border border-dashed border-current px-2 py-1 text-xs opacity-60">{lang === "ar" ? "لا روابط هنا بعد، فلا يراه العملاء. أضف روابطه من إعدادات التذييل" : "No links here yet, so customers don't see it. Add links in the footer settings"}</li>}
        {list.map((l) => {
          const p = aProps(l.to);
          return (
            <li key={l.key}>
              {p ? (
                <a {...p} className="transition hover:text-[var(--sf-primary)]"><bdi>{l.title}</bdi>{p.target && newTab}</a>
              ) : l.to?.kind === "dead" ? (
                <span className="line-through opacity-50" title={c.missingPage}><bdi>{l.title}</bdi></span>
              ) : (
                <span><bdi>{l.title}</bdi></span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
  const contactList = (
    <ul className={simple ? "space-y-2.5" : "space-y-2"} style={{ color: dim(simple ? 75 : 70), fontSize: textSize }}>
      {design && contactLines.length === 0 && <li className="rounded-md border border-dashed border-current px-2 py-1 text-xs opacity-60">{lang === "ar" ? "لا بيانات تواصل بعد، فلا يراه العملاء" : "No contact details yet, so customers don't see it"}</li>}
      {contactLines.map((x) => {
        const body = (
          <>
            <span className="shrink-0">{x.icon}</span>
            <span dir={x.ltr ? "ltr" : undefined} className="min-w-0">{x.ltr ? x.text : <bdi>{x.text}</bdi>}</span>
          </>
        );
        return (
          <li key={x.key} data-spot={`footer:${x.key}`} onClick={edit(x.key)} className={`flex min-w-0 items-center gap-2 ${hot}`}>
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
    /* each column says which part of the designer's footer settings fills it (see spotSignal) */
    const spot = `footer:${col.kind}`;
    if (!isOn(col)) {
      const hw = holeWords[lang];
      const title = col.kind === "about" ? "" : col.kind === "pages" ? word("pages") : col.kind === "contact" ? word("contact") : col.kind === "social" ? word("follow") : col.kind === "licenses" ? word("licenses") : bi(col.title);
      return (
        <div key={col.id} className={cls}>
          {heading(title)}
          <SpotHole spot={spot} text={col.visible === false ? hw.column : col.kind === "licenses" ? hw.license : col.kind === "about" ? hw.about : hw.column} />
        </div>
      );
    }
    if (col.kind === "about")
      return (
        <div key={col.id} data-spot={spot} className={`${cls} ${simple ? "max-w-xs" : ""}`} style={!simple && !compact ? { gridColumn: "span 2" } : undefined}>
          {brand}
          {aboutText && <p data-spot="footer:about" onClick={edit("about")} className={`${simple ? "mt-2" : "mt-3 max-w-sm"} block whitespace-pre-line leading-relaxed ${hot}`} style={{ color: dim(simple ? 70 : 65), fontSize: textSize }}><bdi>{aboutText}</bdi></p>}
          {!aboutText && design && spots.some((s) => s.key === "footer:about") && <SpotHole spot="footer:about" text={holeWords[lang].about} className="mt-3" />}
        </div>
      );
    if (col.kind === "pages" || col.kind === "custom") {
      const title = col.kind === "pages" ? word("pages") : bi(col.title);
      return (
        <div key={col.id} data-spot={spot} className={cls}>
          {heading(title)}
          {linkList(title, col.kind === "pages" ? pageItems : ownCols.get(col.id) ?? [])}
        </div>
      );
    }
    if (col.kind === "contact")
      return (
        <div key={col.id} data-spot={spot} className={cls}>
          {heading(word("contact"))}
          {contactList}
        </div>
      );
    if (col.kind === "social")
      return (
        <div key={col.id} data-spot={spot} className={cls}>
          {heading(word("follow"))}
          {socialList}
        </div>
      );
    return (
      <div key={col.id} data-spot={spot} onClick={edit("licenses")} className={cls}>
        {heading(word("licenses"))}
        {certBadge}
      </div>
    );
  };

  const ring = design && <span aria-hidden className={`pointer-events-none absolute inset-1 rounded-xl ring-2 ring-[#14b8a6] transition ${design.selected === "footer" ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100"}`} />;
  /* The copyright line and "Made with Dukkan" are fixed. The merchant can neither change nor remove them, nor the
     "Report this store" link beside it (ReportStore.tsx) that customers of a live store get. */
  const bottom = (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-t text-xs ${simple ? "border-sf-text/10" : fc.dark ? "border-white/10" : "border-black/[0.06]"} ${compact ? "px-4 py-4" : "px-8 py-5"}`} style={{ color: dim(55) }}>
      <span>© {new Date().getFullYear()} <bdi>{data.name}</bdi>. {c.rights}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{c.made}</span>
        {reportSlug && <ReportStore slug={reportSlug} lang={lang} />}
      </span>
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
