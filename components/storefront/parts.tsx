"use client";

import type { Lang } from "../content";
import type { LogoConfig, MarkKey } from "./config";
import type { StoreProduct } from "./useStoreData";

/* Small pieces shared by the storefront sections: icons, product picture, copy. */

export const copy = {
  en: {
    search: "Search products",
    menu: "Menu",
    close: "Close",
    account: "Account",
    cart: "Cart",
    all: "All",
    add: "Add to cart",
    soldOut: "Out of stock",
    added: "Added",
    sale: "Sale",
    viewAll: "View all",
    categories: "Categories",
    pages: "Important links",
    contact: "Contact us",
    follow: "Follow us",
    noProducts: "No products",
    addHere: "Add your product here",
    noMatch: "No products match your search",
    sample: "Sample products. Yours appear here once you add them.",
    perks: [
      { t: "Fast delivery", d: "Across Jordan" },
      { t: "Secure payment", d: "Cards, CliQ or cash" },
      { t: "Easy returns", d: "Within 7 days" },
    ],
    made: "Made with Dukkan",
    licenses: "Store licenses",
    certificate: { commercial: "Commercial registration no.", license: "Trade license no.", other: "Registration no." },
    rights: "All rights reserved",
    like: "Save",
  },
  ar: {
    search: "ابحث عن منتج",
    menu: "القائمة",
    close: "إغلاق",
    account: "حسابي",
    cart: "السلة",
    all: "الكل",
    add: "أضف إلى السلة",
    soldOut: "لقد نفذت الكمية",
    added: "تمت الإضافة",
    sale: "تخفيض",
    viewAll: "عرض الكل",
    categories: "التصنيفات",
    pages: "روابط مهمة",
    contact: "تواصل معنا",
    follow: "تابعنا",
    noProducts: "لا توجد منتجات",
    addHere: "أضف منتجك هنا",
    noMatch: "لا توجد منتجات مطابقة لبحثك",
    sample: "منتجات تجريبية. ستظهر منتجاتك هنا بعد إضافتها.",
    perks: [
      { t: "توصيل سريع", d: "لكل مناطق الأردن" },
      { t: "دفع آمن", d: "بطاقة أو كليك أو نقدًا" },
      { t: "إرجاع سهل", d: "خلال 7 أيام" },
    ],
    made: "صُنع بواسطة دكان",
    licenses: "رُخَص المتجر",
    certificate: { commercial: "سجل تجاري رقم", license: "رخصة مهن رقم", other: "رقم التسجيل" },
    rights: "جميع الحقوق محفوظة",
    like: "حفظ",
  },
} satisfies Record<Lang, unknown>;

export const currency = (lang: Lang) => (lang === "ar" ? "د.أ" : "JOD");
export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** The language the prices are shown in: the page's language, or the one the merchant chose for his prices */
export const priceLang = (mode: "auto" | "ar" | "en" | undefined, lang: Lang): Lang => (mode === "ar" ? "ar" : mode === "en" ? "en" : lang);
/** An amount in the chosen language: Arabic-Indic digits and the Arabic decimal mark, or Latin digits */
export const moneyIn = (n: number, lang: Lang) =>
  lang === "ar" ? money(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]).replace(".", "٫") : money(n);
export const priceOf = (p: StoreProduct) => (p.sale ?? p.price ?? 0);

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const icons = {
  menu: <svg {...base} className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h10" /></svg>,
  search: <svg {...base} className="h-5 w-5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  user: <svg {...base} className="h-5 w-5"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  bag: <svg {...base} className="h-5 w-5"><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  heart: <svg {...base} className="h-4 w-4"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10Z" /></svg>,
  plus: <svg {...base} className="h-4 w-4" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg {...base} className="h-4 w-4" strokeWidth={2.4}><path d="m5 12 5 5 9-10" /></svg>,
  truck: <svg {...base} className="h-5 w-5"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.500 1.500 0 1 0 0-.01M17 19a1.500 1.500 0 1 0 0-.01" /></svg>,
  shield: <svg {...base} className="h-5 w-5"><path d="M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  gift: <svg {...base} className="h-5 w-5"><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11M4 13h16M12 9c-2.500 0-4-1-4-2.500S9.500 4 12 7c2.500-3 4-1.500 4 0S14.500 9 12 9Z" /></svg>,
  clock: <svg {...base} className="h-5 w-5"><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></svg>,
  chat: <svg {...base} className="h-5 w-5"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-1-2V6Z" /></svg>,
  whatsapp: <svg {...base} className="h-4 w-4"><path d="M12 3a9 9 0 0 0-7.800 13.500L3 21l4.700-1.200A9 9 0 1 0 12 3Z" /><path d="M9 8.500c.300 2.800 2.700 5.200 5.500 5.500l1.200-1.300-1.800-1-.9.800c-.9-.4-1.700-1.200-2.100-2.100l.8-.9-1-1.800L9 8.500Z" /></svg>,
  telegram: <svg {...base} className="h-4 w-4"><path d="M21 4 3 11l5.500 2L10 19l3-3.500L18 19l3-15Z" /><path d="M8.500 13 21 4" /></svg>,
  mail: <svg {...base} className="h-4 w-4"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  pin: <svg {...base} className="h-4 w-4"><path d="M12 21s7-6.100 7-11.500A7 7 0 0 0 5 9.500C5 14.900 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.500" /></svg>,
  returns: <svg {...base} className="h-5 w-5"><path d="M4 12a8 8 0 1 0 3-6.200M4 4v5h5" /></svg>,
  phone: <svg {...base} className="h-4 w-4"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z" /></svg>,
  close: <svg {...base} className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>,
  arrow: <svg {...base} className="h-4 w-4 rtl:rotate-180"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  social: [
    <svg key="ig" {...base} className="h-[18px] w-[18px]"><rect x="4" y="4" width="16" height="16" rx="4.500" /><circle cx="12" cy="12" r="3.500" /><path d="M16.800 7.200v.01" /></svg>,
    <svg key="fb" {...base} className="h-[18px] w-[18px]"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z" /></svg>,
    <svg key="x" {...base} className="h-[18px] w-[18px]"><path d="M5 5l14 14M19 5 5 19" /></svg>,
    <svg key="yt" {...base} className="h-[18px] w-[18px]"><rect x="3" y="6" width="18" height="12" rx="3.500" /><path d="m10.500 9.500 4 2.500-4 2.500Z" /></svg>,
    <svg key="sc" {...base} className="h-[18px] w-[18px]"><path d="M12 4c-2.800 0-4.500 2-4.500 4.500V10c-.8.200-1.500.600-2.500.600.600 1 1.500 1.200 2.400 1.300-.300 1.500-1.800 2.500-3 3 1.300.800 2.700.600 3.600 1 .500.600 1.200 1.600 4 1.600s3.500-1 4-1.600c.900-.400 2.300-.200 3.600-1-1.200-.500-2.700-1.500-3-3 .900-.100 1.800-.300 2.400-1.300-1 0-1.700-.400-2.500-.600V8.500C16.500 6 14.800 4 12 4Z" /></svg>,
    <svg key="tt" {...base} className="h-[18px] w-[18px]"><path d="M14 4v10.500a3.500 3.500 0 1 1-3.500-3.500M14 4c.400 2.500 2 4 4.500 4.200" /></svg>,
  ],
};

/** The picture of a product. Without a real photo it is a soft color wash with a bag. */
export function ProductImage({ p, className = "", flat = false }: { p: StoreProduct; className?: string; flat?: boolean }) {
  const h = p.hue ?? 190;
  /* flat: one soft color and a garment, no circles and no gradient (the playful stores) */
  if (flat) {
    return (
      <div className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: `hsl(${h} 75% 86%)` }}>
        <svg viewBox="0 0 24 24" className="relative h-1/2 w-1/2" fill={`hsl(${h} 70% 96%)`} stroke={`hsl(${h} 40% 30%)`} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8.5 3 3 6l1.8 4.2L7 9.200V20h10V9.200l2.200.9L21 6l-5.500-3a3.500 3.500 0 0 1-7 0Z" />
        </svg>
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" style={p.focus ? { objectPosition: `${p.focus.x}% ${p.focus.y}%` } : undefined} />
        )}
      </div>
    );
  }
  return (
    <div
      className={`relative grid place-items-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(145deg, hsl(${h} 70% 93%), hsl(${h} 55% 80%))` }}
    >
      <span aria-hidden className="absolute -end-6 -top-6 h-24 w-24 rounded-full opacity-50" style={{ background: `hsl(${h} 80% 97%)` }} />
      <span aria-hidden className="absolute -bottom-8 -start-6 h-28 w-28 rounded-full opacity-30" style={{ background: `hsl(${h} 60% 62%)` }} />
      <svg viewBox="0 0 24 24" className="relative h-1/3 w-1/3 drop-shadow-sm" fill="none" stroke={`hsl(${h} 45% 32%)`} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt={p.name} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" style={p.focus ? { objectPosition: `${p.focus.x}% ${p.focus.y}%` } : undefined} />
      )}
    </div>
  );
}

/** The style that puts a picture where he dragged it inside its frame (nothing when he never moved it) */
export function picStyle(p?: { x: number; y: number; zoom: number }): React.CSSProperties | undefined {
  if (!p || (p.x === 0 && p.y === 0 && p.zoom === 1)) return undefined;
  return { transform: `translate(${p.x}%, ${p.y}%) scale(${p.zoom})`, transformOrigin: "50% 50%" };
}

/** Readable text color on top of the brand color. */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#10242a" : "#ffffff";
}

/** Sample logo marks the merchant can pick from. */
export const sampleMarks: Record<MarkKey, React.ReactNode> = {
  shop: <path d="M4 9 5.500 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />,
  bag: <g><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></g>,
  star: <path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" />,
  heart: <path d="M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.600-7 10-7 10Z" />,
  leaf: <g><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-5 6-8 10-10" /></g>,
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />,
};
export const markKeys = Object.keys(sampleMarks) as MarkKey[];

/** The store logo: the first letter of the name, a sample mark, or the merchant's own picture. */
export function LogoMark({ logo, name, className = "h-10 w-10 rounded-2xl text-lg" }: { logo: LogoConfig; name: string; className?: string }) {
  const base = `grid shrink-0 place-items-center overflow-hidden font-extrabold shadow-sm ${className}`;
  if (logo.kind === "image" && logo.image) {
    return (
      <span className={`${base} bg-white ring-1 ring-black/10`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.image} alt="" className="h-full w-full object-contain p-0.5" />
      </span>
    );
  }
  if (logo.kind === "sample" && sampleMarks[logo.sample]) {
    return (
      <span className={base} style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {sampleMarks[logo.sample]}
        </svg>
      </span>
    );
  }
  return (
    <span className={base} style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The logo to show: "auto" means the picture uploaded in setup, if there is one. */
export function resolveLogo(logo: LogoConfig, setupLogo: string): LogoConfig {
  if (logo.kind !== "auto") return logo;
  return setupLogo ? { ...logo, kind: "image", image: setupLogo } : { ...logo, kind: "letter" };
}
