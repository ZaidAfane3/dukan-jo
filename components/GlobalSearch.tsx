"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { content } from "./content";
import { useDemo } from "./demoSandbox";
import { latin } from "./digits";
import { usePrefs } from "./Prefs";
import { cleanOrder, cleanProduct, couponName, parseList, phoneDigits, productCategories, type Coupon, type Order } from "./records";
import { findStoreOrder, loadStoreOrders, readCoupons, readInfoPages, SEARCH_OPEN, useStoreOrders, type SearchPage } from "./searchSources";

/* The groups, in the order they are shown: products, orders, coupons, his own info pages, the dashboard's pages */
const GROUPS = [0, 1, 2, 3, 4] as const;
type Group = (typeof GROUPS)[number];
const ORDERS: Group = 1;
const PER_GROUP: Record<Group, number> = { 0: 5, 1: 5, 2: 4, 3: 4, 4: 6 };

type Result = { id: string; group: Group; label: string; sub?: string; href: string };

/* Pages of the dashboard. Keywords let "pay", "invoice" or "shipping" find the right place. */
const pages = [
  { href: "/dashboard", en: "Home", ar: "الرئيسية", kw: "dashboard summary overview ملخص لوحة التحكم" },
  { href: "/orders", en: "Orders", ar: "الطلبات", kw: "order sales customers manage إدارة الطلبات مبيعات عملاء" },
  { href: "/orders/invoices", en: "Invoice customization", ar: "تخصيص الفواتير", kw: "invoice receipt bill pdf فاتورة فواتير" },
  { href: "/products", en: "Products", ar: "المنتجات", kw: "product items inventory stock price quantity مخزون سعر كمية أصناف" },
  { href: "/marketing/abandoned-carts", en: "Abandoned carts", ar: "السلات المتروكة", kw: "cart marketing recover سلة تسويق" },
  { href: "/marketing/reminders", en: "Automatic reminders", ar: "التذكيرات التلقائية", kw: "reminder cart email sms تذكير" },
  { href: "/marketing/coupons", en: "Coupons", ar: "الكوبونات", kw: "coupon discount code free shipping marketing خصم كود تسويق" },
  { href: "/marketing/campaigns", en: "Campaigns", ar: "حملات تسويقية", kw: "campaign email newsletter send customers sms whatsapp marketing حملة حملات بريد رسائل إرسال عملاء واتساب تسويق" },
  { href: "/marketing/repurchase",en: "Repurchase reminders", ar: "تذكيرات إعادة الشراء", kw: "repurchase buy again reminder marketing تسويق" },
  { href: "/marketing/emails", en: "Customer emails", ar: "إيميلات العملاء", kw: "newsletter subscribers email back in stock remind sold out marketing نشرة بريدية مشتركين إيميل تذكير توفر نفدت تسويق" },
  { href: "/reports", en: "Store performance", ar: "أداء المتجر", kw: "reports analytics visits payments sales customers تقارير مدفوعات زيارات" },
  { href: "/store-link", en: "Store link", ar: "رابط المتجر", kw: "link address url domain رابط عنوان المتجر" },
  { href: "/themes", en: "Theme store", ar: "متجر الثيمات", kw: "themes templates buy store design ثيمات قوالب شراء تصميم" },
  { href: "/themes/mine", en: "My themes", ar: "ثيماتي", kw: "my themes bought owned ثيماتي ثيمات مشتريات" },
  { href: "/design", en: "Store design", ar: "تصميم المتجر", kw: "design theme storefront colors header footer sections editor تصميم ثيم ألوان واجهة المتجر" },
  { href: "/pages", en: "Info pages", ar: "الصفحات التعريفية", kw: "pages policy privacy terms return about صفحات سياسة الخصوصية الأحكام والشروط الاسترجاع من نحن" },
  { href: "/from-dukkan", en: "From Dukkan", ar: "من دكان", kw: "dukkan news guides rules help updates أخبار أدلة قواعد مساعدة تحديثات دكان" },
  { href: "/support", en: "Support tickets", ar: "تذاكر الدعم", kw: "support help ticket contact دعم مساعدة تذكرة" },
  { href: "/settings", en: "Account settings", ar: "إعدادات الحساب", kw: "settings profile password phone email name إعدادات الملف الشخصي كلمة المرور" },
  { href: "/settings/notifications", en: "Notifications settings", ar: "إعدادات الإشعارات", kw: "notification email alerts إشعارات تنبيهات بريد" },
  { href: "/onboarding", en: "Complete store setup", ar: "إكمال إعداد المتجر", kw: "setup onboarding store link shipping identity إعداد هوية المتجر الشحن الرابط" },
];

const copy = {
  en: {
    ph: "Search orders, products, coupons, pages…",
    groups: ["Products", "Orders", "Coupons", "Your pages", "Dashboard pages"],
    none: "Nothing found for",
    noneElse: "Nothing else found for",
    hint: "Try an order number, a customer, a product, a coupon code or a page name.",
    label: "Search the dashboard",
    searching: "Searching…",
    ordersFailed: "Orders couldn't be searched right now.",
    pageTypes: ["General", "Return policy", "Legal: terms or privacy"],
    draft: "Draft",
    untitled: "Untitled page",
  },
  ar: {
    ph: "ابحث في الطلبات والمنتجات والكوبونات والصفحات…",
    groups: ["المنتجات", "الطلبات", "الكوبونات", "صفحاتك", "صفحات لوحة التحكم"],
    none: "لا توجد نتائج لـ",
    noneElse: "لا توجد نتائج أخرى لـ",
    hint: "جرّب رقم طلب أو اسم عميل أو منتج أو كود كوبون أو اسم صفحة.",
    label: "ابحث في لوحة التحكم",
    searching: "جارٍ البحث…",
    ordersFailed: "تعذّر البحث في الطلبات الآن.",
    pageTypes: ["عامة", "سياسة الاستبدال والاسترجاع", "قانونية: الأحكام أو الخصوصية"],
    draft: "مسودة",
    untitled: "صفحة بدون عنوان",
  },
};

/* Arabic spelling variants should match each other, and Arabic-Indic digits the Latin ones. */
const norm = (s: string) =>
  latin(s)
    .toLowerCase()
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();

/* Saved orders and products, cleaned the same way their own pages clean them (anything broken is left out) */
function read(key: "seen-orders" | "seen-products"): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(key);
    return (key === "seen-orders" ? parseList(raw, cleanOrder) : parseList(raw, cleanProduct)) as unknown as Record<string, unknown>[];
  } catch {
    return [];
  }
}

type Local = { orders: Record<string, unknown>[]; products: Record<string, unknown>[]; coupons: Coupon[]; infoPages: SearchPage[] };
const noLocal: Local = { orders: [], products: [], coupons: [], infoPages: [] };

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  );
}

export function GlobalSearch() {
  const { lang } = usePrefs();
  const tour = useDemo();
  const c = copy[lang];
  const couponTypes = content[lang].coupons.types;
  const router = useRouter();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [data, setData] = useState<Local>(noLocal);
  const store = useStoreOrders();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  /* Fresh data every time the field is focused, since orders, products, coupons and pages change on other pages. The
     store's orders start loading now (not on the first key), and the list fetched is used again for the rest of the
     visit, refreshed in the background. */
  const refresh = () => {
    setData({ orders: read("seen-orders"), products: read("seen-products"), coupons: readCoupons(), infoPages: readInfoPages() });
    loadStoreOrders();
  };

  /* Every record with the text it is searched by, worked out once per load and not on every key */
  const index = useMemo(() => {
    /* the store's orders and those asked for by their number; an order kept in this browser with the same number opens
       the store's one anyway (Orders.tsx), so it is shown once */
    const storeOrders = new Map<number, Order>();
    store.orders.forEach((o) => storeOrders.set(o.id, o));
    Object.values(store.numbers).forEach((o) => typeof o === "object" && storeOrders.set(o.id, o));
    const orders = [
      ...data.orders.filter((o) => !storeOrders.has(Number(o.id))).map((o) => ({ o, store: false })),
      ...[...storeOrders.values()].map((o) => ({ o: o as unknown as Record<string, unknown>, store: true })),
    ]
      .slice(0, 1000)
      .map(({ o, store }) => ({
        key: `${store ? "s" : "l"}${o.id}`,
        id: String(o.id),
        name: String(o.customer ?? ""),
        hay: norm(`${o.customer ?? ""}\n${o.email ?? ""}`),
        /* kept as bare digits (no +962 or leading 0) so a phone is found however it is typed, like on the Orders page */
        phone: phoneDigits(String(o.phone ?? "")),
      }));
    const products = data.products
      .filter((p) => !p.deletedAt)
      .slice(0, 500)
      .map((p) => {
        const cats = productCategories(p).join(", ");
        return { id: String(p.id), name: String(p.name ?? ""), cats, hay: norm(`${p.name ?? ""}\n${cats}\n${p.brand ?? ""}`) };
      });
    const coupons = data.coupons.map((x) => ({ x, hay: norm(`${x.code}\n${x.name}`) }));
    const infoPages = data.infoPages.map((p) => ({ p, title: norm(`${p.title.en}\n${p.title.ar}`), body: norm(`${p.content.en}\n${p.content.ar}`) }));
    return { orders, products, coupons, infoPages };
  }, [data, store.orders, store.numbers]);

  const t = norm(q);
  /* a number typed (with or without "#"): an order older than those fetched is asked for by it */
  const number = /^#?\d{1,12}$/.test(t) ? t.replace(/^#/, "") : "";
  const asked = number ? store.numbers[number] : undefined;
  /* The store's orders are still on their way, or failed: "Nothing found" is never said for them */
  const ordersPending = store.status === "loading" || asked === "loading";
  const ordersFailed = store.status === "failed" || asked === "failed";

  useEffect(() => {
    if (!number || store.status !== "ready") return;
    const timer = setTimeout(() => findStoreOrder(number), 350);
    return () => clearTimeout(timer);
  }, [number, store.status, store.orders]);

  const results = useMemo<Result[]>(() => {
    if (!t) return [];
    const out: Result[] = [];
    const sym = t.startsWith("#") ? t.slice(1) : t;
    const digits = phoneDigits(t);
    const by = (b: { en: string; ar: string }) => b[lang] || b[lang === "ar" ? "en" : "ar"];

    index.products.forEach((p) => {
      if (p.hay.includes(t)) out.push({ id: `p${p.id}`, group: 0, label: p.name, sub: p.cats, href: `/products?open=${p.id}` });
    });

    index.orders.forEach((o) => {
      if ((sym && o.id.includes(sym)) || o.hay.includes(t) || (digits.length >= 3 && o.phone.includes(digits))) {
        out.push({ id: `o${o.key}`, group: 1, label: o.name, sub: `#${o.id}`, href: `/orders?open=${o.id}` });
      }
    });

    index.coupons.forEach(({ x, hay }) => {
      if (!hay.includes(t)) return;
      const name = couponName(x);
      out.push({ id: `c${x.id}`, group: 2, label: name, sub: name === x.code ? couponTypes[x.type]?.title : x.code, href: `/marketing/coupons?open=${encodeURIComponent(x.id)}` });
    });

    /* his pages whose title matches come before those where only the text does */
    const titled = index.infoPages.filter((p) => p.title.includes(t));
    const inText = index.infoPages.filter((p) => !p.title.includes(t) && p.body.includes(t));
    [...titled, ...inText].forEach(({ p }) => {
      const kind = c.pageTypes[p.type];
      out.push({ id: `i${p.id}`, group: 3, label: by(p.title) || c.untitled, sub: p.published ? kind : `${kind} · ${c.draft}`, href: `/pages?open=${p.id}` });
    });

    pages.forEach((p) => {
      if (tour && p.href === "/settings/notifications") return;
      const label = lang === "ar" ? p.ar : p.en;
      if (norm(p.en).includes(t) || norm(p.ar).includes(t) || norm(p.kw).includes(t)) out.push({ id: p.href, group: 4, label, href: p.href });
    });

    const seen: Record<Group, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    return out.filter((r) => ++seen[r.group] <= PER_GROUP[r.group]);
  }, [t, index, lang, tour, c, couponTypes]);

  /* The highlighted result is kept by what it is, so results arriving later (store orders) don't move it */
  const activeAt = Math.max(0, results.findIndex((r) => r.id === activeId));
  const active = results[activeAt];
  useEffect(() => setActiveId(null), [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (r: Result) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    /* a result on the page already open: the page is not opened again, so it is told to open the item (the Orders page
       follows its address by itself) */
    const to = new URL(r.href, window.location.href);
    if (to.pathname === window.location.pathname && to.searchParams.has("open") && to.pathname !== "/orders") {
      window.history.replaceState(window.history.state, "", to.pathname + to.search + to.hash);
      window.dispatchEvent(new Event(SEARCH_OPEN));
      return;
    }
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActiveId(results[(activeAt + 1) % results.length].id);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActiveId(results[(activeAt - 1 + results.length) % results.length].id);
    } else if (e.key === "Enter" && active) {
      e.preventDefault();
      go(active);
    }
  };

  const showPanel = open && q.trim().length > 0;
  const shown = `“${q.trim()}”`;
  /* what a screen reader hears while the results change: only the waiting, a failure and an empty answer (the rows
     showing them in the list are hidden from it, so nothing is read twice) */
  const live = !showPanel
    ? ""
    : ordersPending
      ? c.searching
      : results.length
        ? ordersFailed
          ? c.ordersFailed
          : ""
        : ordersFailed
          ? `${c.ordersFailed} ${c.noneElse} ${shown}`
          : `${c.none} ${shown}`;

  const statusRow = (pending: boolean) => (
    <div aria-hidden className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted">
      {pending && <Spinner />}
      <span>{pending ? c.searching : c.ordersFailed}</span>
    </div>
  );

  return (
    <div ref={box} className="relative order-last basis-full pb-3 md:order-none md:flex-1 md:basis-auto md:pb-0 md:max-w-3xl">
      <div data-nav-item className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            refresh();
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={c.ph}
          aria-label={c.label}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-list"
          aria-activedescendant={showPanel && active ? `gs-${active.id}` : undefined}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-fg/15 bg-soft/60 ps-12 pe-4 text-sm outline-none transition placeholder:text-muted/80 focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/25"
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>

      {showPanel && (
        <div id="global-search-list" role="listbox" aria-label={c.label} className="absolute inset-x-0 top-[calc(100%-0.25rem)] z-50 mt-2 max-h-[min(28rem,70vh)] overflow-y-auto rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-fg/10 md:top-full">
          {results.length === 0 ? (
            ordersPending ? (
              <div aria-hidden className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted">
                <Spinner />
                <span>{c.searching}</span>
              </div>
            ) : (
              <div aria-hidden className="px-4 py-8 text-center">
                {ordersFailed && <p className="mb-1 text-sm text-muted">{c.ordersFailed}</p>}
                <p className="text-sm font-semibold">
                  {ordersFailed ? c.noneElse : c.none} <span dir="auto">{shown}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{c.hint}</p>
              </div>
            )
          ) : (
            GROUPS.map((g) => {
              const items = results.filter((r) => r.group === g);
              const waiting = g === ORDERS && (ordersPending || ordersFailed);
              if (!items.length && !waiting) return null;
              return (
                <div key={g} role="group" aria-labelledby={`gs-group-${g}`} className="py-1">
                  <p id={`gs-group-${g}`} className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                    {c.groups[g]}
                  </p>
                  {items.map((r) => {
                    const on = r === active;
                    return (
                      <button
                        key={r.id}
                        id={`gs-${r.id}`}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={on}
                        onMouseEnter={() => setActiveId(r.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(r)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${on ? "bg-black/[0.07] dark:bg-white/[0.1]" : ""}`}
                      >
                        <span dir="auto" className="truncate font-semibold">
                          {r.label}
                        </span>
                        {r.sub && (
                          <span dir="auto" className="shrink-0 text-xs text-muted">
                            {r.sub}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {waiting && statusRow(ordersPending)}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
