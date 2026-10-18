"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "ar";
type Theme = "light" | "dark";

/* Copy that has an Arabic translation so far (nav + hero). The rest follows. */
const en = {
    solutions: "Solutions",
    industries: "Industries",
    themes: "Themes",
    pricing: "Pricing",
    login: "Log in",
    start: "Start free",
    badge: "68,000+ active stores",
    h1a: "Commerce, made ",
    h1b: "simple",
    h1c: " and smart.",
    sub: "Build your store in minutes and connect payments, shipping, inventory and marketing in one place. Your success shouldn't need complexity.",
    cta1: "Create your store free",
    cta2: "Take the tour",
    note: "Built for merchants in Jordan.",
    industriesTitle: "Launch in any industry",
};

const ar: typeof en = {
    solutions: "الحلول",
    industries: "القطاعات",
    themes: "الثيمات",
    pricing: "الأسعار",
    login: "تسجيل دخول",
    start: "ابدأ مجانًا",
    badge: "+68,000 متجر إلكتروني نشط",
    h1a: "التجارة، بشكل ",
    h1b: "بسيط",
    h1c: " وذكي.",
    sub: "أنشئ متجرك في دقائق، واربط المدفوعات والشحن والمخزون والتسويق في مكان واحد. نجاحك لا يحتاج إلى تعقيد.",
    cta1: "أنشئ متجرك مجانًا",
    cta2: "جولة سريعة",
    note: "مصمم للتجار في الأردن.",
    industriesTitle: "انطلق بتجارتك مهما كان قطاعك",
};

export type Copy = typeof en;

/* Industries: name + one-line blurb per language (same order as the icons). */
export const industries: Record<Lang, { name: string; blurb: string }[]> = {
  en: [
    { name: "Fashion", blurb: "Sizes, variants and seasonal drops, handled." },
    { name: "Digital products", blurb: "Instant delivery for downloads, courses and licenses." },
    { name: "Health & fitness", blurb: "Subscriptions and bundles for wellness brands." },
    { name: "Electronics", blurb: "Warranty, serial tracking and fast fulfilment." },
    { name: "Jewelry", blurb: "Premium presentation with secure checkout." },
    { name: "Beauty", blurb: "Routines, bundles and loyalty rewards." },
    { name: "Food & cafes", blurb: "Menus, pickup and delivery in one flow." },
    { name: "Home", blurb: "Large catalogs with flexible shipping." },
  ],
  ar: [
    { name: "عبايات وأزياء", blurb: "المقاسات والألوان والتشكيلات الموسمية، كلها بسهولة." },
    { name: "المنتجات الرقمية", blurb: "تسليم فوري للملفات والدورات والتراخيص." },
    { name: "الصحة واللياقة", blurb: "اشتراكات وباقات لعلامات العافية والرياضة." },
    { name: "الإلكترونيات", blurb: "ضمان وتتبع للأرقام التسلسلية وتجهيز سريع للطلبات." },
    { name: "المجوهرات", blurb: "عرض فاخر مع دفع آمن." },
    { name: "العناية والتجميل", blurb: "روتين وباقات ومكافآت ولاء لعملائك." },
    { name: "المطاعم والمقاهي", blurb: "القوائم والاستلام والتوصيل في تجربة واحدة." },
    { name: "مستلزمات المنزل", blurb: "كتالوجات كبيرة مع خيارات شحن مرنة." },
  ],
};
export const dict: Record<Lang, Copy> = { en, ar };

type Ctx = {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  t: Copy;
};

const PrefsContext = createContext<Ctx | null>(null);

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable, preference just won't persist */
  }
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedLang = safeGet("seen-lang");
    if (savedLang === "ar" || savedLang === "en") setLangState(savedLang);
    const savedTheme = safeGet("seen-theme");
    setTheme(
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    safeSet("seen-lang", l);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      safeSet("seen-theme", next);
      return next;
    });
  }, []);

  return (
    <PrefsContext.Provider value={{ lang, theme, setLang, toggleTheme, t: dict[lang] }}>
      {children}
    </PrefsContext.Provider>
  );
}

/* ---------- Small inline flags (emoji flags don't render on Windows) ---------- */
function FlagUS() {
  return (
    <svg viewBox="0 0 24 16" className="h-3 w-[18px] rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" aria-hidden>
      <rect width="24" height="16" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 16) / 13} width="24" height={16 / 13} fill="#b22234" />
      ))}
      <rect width="10" height={(16 / 13) * 7} fill="#3c3b6e" />
    </svg>
  );
}

function FlagJO() {
  return (
    <svg viewBox="0 0 24 16" className="h-3 w-[18px] rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" aria-hidden>
      <rect width="24" height="5.34" fill="#000" />
      <rect y="5.33" width="24" height="5.34" fill="#fff" />
      <rect y="10.66" width="24" height="5.34" fill="#007a3d" />
      <path d="M0 0 L11 8 L0 16 Z" fill="#ce1126" />
      <circle cx="3.4" cy="8" r="1" fill="#fff" />
    </svg>
  );
}

export function LangSwitch() {
  const { lang, setLang } = usePrefs();
  const options: { code: Lang; label: string; flag: React.ReactNode }[] = [
    { code: "en", label: "EN", flag: <FlagUS /> },
    { code: "ar", label: "العربية", flag: <FlagJO /> },
  ];

  return (
    <div role="group" aria-label="Language" className="flex rounded-lg border border-fg/15 p-0.5 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          aria-pressed={lang === o.code}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
            lang === o.code ? "bg-ink text-white" : "text-muted hover:text-fg"
          }`}
        >
          {o.flag}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = usePrefs();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15 text-fg transition hover:bg-card"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
