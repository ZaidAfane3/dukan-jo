"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { cleanOrder, cleanProduct, parseList, productCategories } from "./records";

type Result = { id: string; group: 0 | 1 | 2; label: string; sub?: string; href: string };

/* Pages of the dashboard. Keywords let "pay", "invoice" or "shipping" find the right place. */
const pages = [
  { href: "/dashboard", en: "Home", ar: "الرئيسية", kw: "dashboard summary overview ملخص لوحة التحكم" },
  { href: "/orders", en: "Orders", ar: "الطلبات", kw: "order sales customers manage إدارة الطلبات مبيعات عملاء" },
  { href: "/orders/invoices", en: "Invoice customization", ar: "تخصيص الفواتير", kw: "invoice receipt bill pdf فاتورة فواتير" },
  { href: "/products", en: "Products", ar: "المنتجات", kw: "product items inventory stock price quantity مخزون سعر كمية أصناف" },
  { href: "/marketing/abandoned-carts", en: "Abandoned carts", ar: "السلات المتروكة", kw: "cart marketing recover سلة تسويق" },
  { href: "/marketing/reminders", en: "Automatic reminders", ar: "التذكيرات التلقائية", kw: "reminder cart email sms تذكير" },
  { href: "/marketing/coupons", en: "Coupons", ar: "الكوبونات", kw: "coupon discount code free shipping marketing خصم كود تسويق" },
  { href: "/marketing/repurchase", en: "Repurchase reminders", ar: "تذكيرات إعادة الشراء", kw: "repurchase buy again reminder marketing تسويق" },
  { href: "/reports", en: "Store performance", ar: "أداء المتجر", kw: "reports analytics visits payments sales customers تقارير مدفوعات زيارات" },
  { href: "/domain", en: "Store domain", ar: "دومين المتجر", kw: "domain address link url dukkan.store نطاق رابط عنوان المتجر" },
  { href: "/themes", en: "Theme store", ar: "متجر الثيمات", kw: "themes templates buy store design ثيمات قوالب شراء تصميم" },
  { href: "/themes/mine", en: "My themes", ar: "ثيماتي", kw: "my themes bought owned ثيماتي ثيمات مشتريات" },
  { href: "/design", en: "Store design", ar: "تصميم المتجر", kw: "design theme storefront colors header footer sections editor تصميم ثيم ألوان واجهة المتجر" },
  { href: "/pages", en: "Info pages", ar: "الصفحات التعريفية", kw: "pages policy privacy terms return about صفحات سياسة الخصوصية الأحكام والشروط الاسترجاع من نحن" },
  { href: "/from-dukkan", en: "From Dukkan", ar: "من دكّان", kw: "dukkan news guides rules help updates أخبار أدلة قواعد مساعدة تحديثات دكان" },
  { href: "/support", en: "Support tickets", ar: "تذاكر الدعم", kw: "support help ticket contact دعم مساعدة تذكرة" },
  { href: "/settings", en: "Account settings", ar: "إعدادات الحساب", kw: "settings profile password phone email name إعدادات الملف الشخصي كلمة المرور" },
  { href: "/settings/notifications", en: "Notifications settings", ar: "إعدادات الإشعارات", kw: "notification email alerts إشعارات تنبيهات بريد" },
  { href: "/onboarding", en: "Complete store setup", ar: "إكمال إعداد المتجر", kw: "setup onboarding store domain shipping identity إعداد هوية المتجر الشحن النطاق" },
];

const copy = {
  en: { ph: "Search orders, products, pages…", groups: ["Pages", "Orders", "Products"], none: "Nothing found for", hint: "Try an order number, a customer, a product or a page name.", label: "Search the dashboard" },
  ar: { ph: "ابحث في الطلبات والمنتجات والصفحات…", groups: ["الصفحات", "الطلبات", "المنتجات"], none: "لا توجد نتائج لـ", hint: "جرّب رقم طلب أو اسم عميل أو منتج أو صفحة.", label: "ابحث في لوحة التحكم" },
};

/* Arabic spelling variants should match each other. */
const norm = (s: string) =>
  s
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

export function GlobalSearch() {
  const { lang } = usePrefs();
  const tour = useDemo();
  const c = copy[lang];
  const router = useRouter();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<{ orders: Record<string, unknown>[]; products: Record<string, unknown>[] }>({ orders: [], products: [] });
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  /* Fresh data every time the field is focused, since orders and products change on other pages. */
  const refresh = () => setData({ orders: read("seen-orders"), products: read("seen-products") });

  const results = useMemo<Result[]>(() => {
    const t = norm(q);
    if (!t) return [];
    const out: Result[] = [];
    const sym = (s: string) => (s.startsWith("#") ? s.slice(1) : s);

    pages.forEach((p) => {
      if (tour && p.href === "/settings/notifications") return;
      const label = lang === "ar" ? p.ar : p.en;
      if (norm(label).includes(t) || norm(p.en).includes(t) || norm(p.ar).includes(t) || norm(p.kw).includes(t)) out.push({ id: p.href, group: 0, label, href: p.href });
    });

    data.orders.slice(0, 500).forEach((o) => {
      const id = String(o.id);
      const name = String(o.customer ?? "");
      const phone = String(o.phone ?? "");
      if (id.includes(sym(t)) || norm(name).includes(t) || phone.replace(/\s/g, "").includes(t.replace(/\s/g, ""))) {
        out.push({ id: `o${id}`, group: 1, label: name, sub: `#${id}`, href: `/orders?open=${id}` });
      }
    });

    data.products
      .filter((p) => !p.deletedAt)
      .slice(0, 500)
      .forEach((p) => {
        const name = String(p.name ?? "");
        const cats = productCategories(p).join(", ");
        if (norm(name).includes(t) || norm(cats).includes(t) || norm(String(p.brand ?? "")).includes(t)) {
          out.push({ id: `p${p.id}`, group: 2, label: name, sub: cats, href: `/products?open=${p.id}` });
        }
      });

    const perGroup = [6, 5, 5];
    const seen = [0, 0, 0];
    return out.filter((r) => ++seen[r.group] <= perGroup[r.group]);
  }, [q, data, lang, tour]);

  useEffect(() => setActive(0), [q]);

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
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const showPanel = open && q.trim().length > 0;

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
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-fg/15 bg-soft/60 ps-12 pe-4 text-sm outline-none transition placeholder:text-muted/80 focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/25"
        />
      </div>

      {showPanel && (
        <div id="global-search-list" role="listbox" className="absolute inset-x-0 top-[calc(100%-0.25rem)] z-50 mt-2 max-h-[min(28rem,70vh)] overflow-y-auto rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-fg/10 md:top-full">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold">
                {c.none} <span dir="auto">“{q.trim()}”</span>
              </p>
              <p className="mt-1 text-xs text-muted">{c.hint}</p>
            </div>
          ) : (
            [0, 1, 2].map((g) => {
              const items = results.filter((r) => r.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="py-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{c.groups[g]}</p>
                  {items.map((r) => {
                    const i = results.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition-colors ${i === active ? "bg-black/[0.07] dark:bg-white/[0.1]" : ""}`}
                      >
                        <span className="truncate font-semibold">{r.label}</span>
                        {r.sub && <span dir="auto" className="shrink-0 text-xs text-muted">{r.sub}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
