"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { Lang } from "./content";
export type { Lang };
type Theme = "light" | "dark";

/* Copy that has an Arabic translation so far (nav + hero). The rest follows. */
const en = {
    solutions: "Solutions",
    industries: "Industries",
    resources: "Resources",
    themes: "Themes",
    login: "Log in",
    start: "Start free",
    h1a: "Commerce, made ",
    h1b: "simple",
    h1c: " and smart.",
    sub: "Build your store in minutes and connect payments, shipping, inventory and marketing in one place. Your success shouldn't need complexity.",
    cta1: "Create your store for free",
    cta2: "Try the demo",
    note: "Built for merchants in Jordan.",
    industriesTitle: "Launch in any industry",
};

const ar: typeof en = {
    solutions: "الحلول",
    industries: "القطاعات",
    resources: "الموارد",
    themes: "الثيمات",
    login: "تسجيل دخول",
    start: "ابدأ مجانًا",
    h1a: "التِّجارة، بشكلٍ ",
    h1b: "بسيطٍ",
    h1c: " وذكيٍّ.",
    sub: "أنشئ متجرك الإلكتروني في دقائق، واربط المدفوعات والشحن والمخزون والتسويق في مكانٍ واحد. نجاحك لا يحتاج إلى تعقيد.",
    cta1: "أنشئ متجرك مجانًا",
    cta2: "تجربة المنصة",
    note: "مُصمّم للتجّار في الأردن.",
    industriesTitle: "انطلق بتجارتك مهما كان قطاعك",
};

export type Copy = typeof en;

/* An industry can have a detail card: a title, a short text, three points, and pictures of a store of that kind
   (each picture is a part of a long picture of the page: `y` is how far down it, in percent). */
export type IndustryDetail = {
  title: string;
  body: string;
  bullets: string[];
  shots: { src: string; y: number }[];
};

/* Industries: name + one-line blurb per language (same order as the icons). */
export const industries: Record<Lang, { name: string; blurb: string; detail?: IndustryDetail }[]> = {
  en: [
    { name: "Fashion", blurb: "Sizes, variants and seasonal drops, handled." },
    {
      name: "Perfumes",
      blurb: "Collections, gift sets and samples, handled.",
      detail: {
        title: "Smart tools for selling your perfumes",
        body: "Whether you sell fine fragrances, oud or gift sets, your store shows every scent with elegance and takes orders without any technical fuss.",
        bullets: ["Show each perfume's notes and size on its card", "A ready luxury design for your collections and banners", "Choose which part of each bottle's picture shows"],
        shots: [{ src: "/themes/atelier.jpg", y: 0 }, { src: "/themes/atelier.jpg", y: 34 }],
      },
    },
    { name: "Digital products", blurb: "Instant delivery for downloads, courses and licenses." },
    { name: "Electronics", blurb: "Warranty, serial tracking and fast fulfilment." },
    { name: "Jewelry", blurb: "Premium presentation with secure checkout." },
    { name: "Beauty", blurb: "Routines, bundles and loyalty rewards." },
    { name: "Home", blurb: "Large catalogs with flexible shipping." },
  ],
  ar: [
    { name: "عبايات وأزياء", blurb: "المقاسات والألوان والتشكيلات الموسمية، كلها بسهولة." },
    {
      name: "العطور",
      blurb: "مجموعات وأطقم هدايا وعيّنات، كلها بسهولة.",
      detail: {
        title: "حلول ذكية لبيع عطورك",
        body: "سواء كنت تبيع عطورًا فاخرة أو دهن عود أو أطقم هدايا، يعرض متجرك كل عطر بأناقة ويستقبل الطلبات بدون أي تعقيدات تقنية.",
        bullets: ["اعرض نوتات كل عطر وحجمه على بطاقته", "تصميم فاخر جاهز لمجموعاتك وبنراتك", "اختر الجزء الظاهر من صورة كل زجاجة"],
        shots: [{ src: "/themes/atelier.jpg", y: 0 }, { src: "/themes/atelier.jpg", y: 34 }],
      },
    },
    { name: "المنتجات الرقمية", blurb: "تسليم فوري للملفات والدورات والتراخيص." },
    { name: "الإلكترونيات", blurb: "ضمان وتتبع للأرقام التسلسلية وتجهيز سريع للطلبات." },
    { name: "المجوهرات", blurb: "عرض فاخر مع دفع آمن." },
    { name: "العناية والتجميل", blurb: "روتين وباقات ومكافآت ولاء لعملائك." },
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

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("light");

  /* Runs before paint so a saved Arabic page never flashes English first. */
  useIsoLayoutEffect(() => {
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
    delete document.documentElement.dataset.boot;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (window.location.pathname === "/") document.title = lang === "ar" ? "دكان | أطلق متجرك الإلكتروني في دقائق" : "Dukkan | Launch your online store in minutes";
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const switching = useRef(false);

  /* Switch language like Salla. The top bar items glide to the middle and
     bunch up while the page text fades out. The language changes behind the
     scenes, the bar spreads out toward the new reading side, and the text
     then settles in block by block, top to bottom, so it never pops in all
     at once. */
  const setLang = useCallback((l: Lang) => {
    if (switching.current) return;
    safeSet("seen-lang", l);

    const apply = () => {
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
      flushSync(() => setLangState(l));
    };

    /* Only items inside a header take part (not the footer logo). */
    let items = Array.from(document.querySelectorAll<HTMLElement>("header [data-nav-item]"));
    let content = Array.from(document.querySelectorAll<HTMLElement>("[data-lang-fade]"));
    /* Sidebar entries fade and slide in one after another instead of gathering. */
    let side = Array.from(document.querySelectorAll<HTMLElement>("aside [data-side-item]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || items.length === 0 || typeof items[0].animate !== "function") {
      apply();
      return;
    }

    switching.current = true;
    const centerX = window.innerWidth / 2;
    const offsetToCenter = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return centerX - (r.left + r.width / 2);
    };

    const outs = items.map((el) =>
      el.animate(
        [
          { transform: "translateX(0) scale(1)", opacity: 1 },
          /* Gone before the items pile up on top of each other */
          { opacity: 0, offset: 0.6 },
          { transform: `translateX(${offsetToCenter(el)}px) scale(0.85)`, opacity: 0 },
        ],
        { duration: 360, easing: "cubic-bezier(0.55, 0, 0.9, 0.4)", fill: "forwards" },
      ),
    );

    const textOut = [...content, ...side].map((el) =>
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-in", fill: "forwards" }),
    );

    Promise.all([...outs, ...textOut].map((a) => a.finished.catch(() => undefined))).then(() => {
      /* Hide everything while the page re-renders in the new language. */
      items.forEach((el) => (el.style.opacity = "0"));
      content.forEach((el) => (el.style.opacity = "0"));
      side.forEach((el) => (el.style.opacity = "0"));
      outs.forEach((a) => a.cancel());
      textOut.forEach((a) => a.cancel());
      apply();

      /* If the page was rebuilt for the new language (as in the tour), these are new elements: take them and hide them too */
      if (items.some((el) => !el.isConnected)) {
        items = Array.from(document.querySelectorAll<HTMLElement>("header [data-nav-item]"));
        content = Array.from(document.querySelectorAll<HTMLElement>("[data-lang-fade]"));
        side = Array.from(document.querySelectorAll<HTMLElement>("aside [data-side-item]"));
        [...items, ...content, ...side].forEach((el) => (el.style.opacity = "0"));
      }

      /* Give the browser two frames to lay out and paint the new page, so
         the heavy work finishes before any animation starts. */
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const ins = items.map((el) => {
            const from = offsetToCenter(el);
            el.style.opacity = "";
            return el.animate(
              [
                { transform: `translateX(${from}px) scale(0.85)`, opacity: 0 },
                /* Only becomes visible once the items have started to spread apart */
                { opacity: 0, offset: 0.35 },
                { opacity: 1, offset: 0.8 },
                { transform: "translateX(0) scale(1)", opacity: 1 },
              ],
              { duration: 520, easing: "cubic-bezier(0.2, 0.65, 0.3, 1)", fill: "backwards" },
            );
          });

          /* Page text: reveal the blocks in order. Pages made of a few big
             columns reveal what is inside them instead. */
          content.forEach((el) => (el.style.opacity = ""));
          const toward = l === "ar" ? 10 : -10; /* the sidebar sits on the reading-start side */
          side.forEach((el, i) => {
            el.style.opacity = "";
            ins.push(
              el.animate(
                [
                  { opacity: 0, transform: `translateX(${toward}px)` },
                  { opacity: 1, transform: "translateX(0)" },
                ],
                { duration: 420, delay: 80 + i * 45, easing: "cubic-bezier(0.2, 0.65, 0.3, 1)", fill: "backwards" },
              ),
            );
          });
          let blocks = content.flatMap((el) => Array.from(el.children) as HTMLElement[]);
          if (blocks.length <= 3) {
            blocks = blocks.flatMap((b) => (b.children.length > 1 ? (Array.from(b.children) as HTMLElement[]) : [b]));
          }
          /* Blocks far below the screen don't need to animate. */
          const onScreen = blocks.filter((el) => el.getBoundingClientRect().top < window.innerHeight);
          onScreen.forEach((el, i) => {
            ins.push(
              el.animate(
                [
                  { opacity: 0, transform: "translateY(14px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 520, delay: 120 + Math.min(i * 50, 400), easing: "cubic-bezier(0.2, 0.65, 0.3, 1)", fill: "backwards" },
              ),
            );
          });

          Promise.all(ins.map((a) => a.finished.catch(() => undefined))).then(() => {
            switching.current = false;
          });
        }),
      );
    });
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

/* One button: shows the language you will switch to, flips on every press. */
export function LangSwitch({ onDark = false, iconOnly = false }: { onDark?: boolean; iconOnly?: boolean }) {
  const { lang, setLang } = usePrefs();
  const target: Lang = lang === "ar" ? "en" : "ar";

  return (
    <button
      data-nav-item
      onClick={() => setLang(target)}
      aria-label={target === "en" ? "Switch language to English" : "التبديل إلى اللغة العربية"}
      title={target === "en" ? "English" : "العربية"}
      className={`flex h-9 items-center gap-1.5 rounded-lg border text-xs font-semibold transition ${iconOnly ? "w-9 justify-center" : "px-2.5"} ${onDark ? "border-white/30 text-white hover:bg-white/10" : "border-fg/15 text-fg hover:bg-card"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
      </svg>
      {!iconOnly && (target === "en" ? "EN" : "AR")}
    </button>
  );
}

export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { theme, toggleTheme } = usePrefs();
  const dark = theme === "dark";

  return (
    <button
      data-nav-item
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid h-9 w-9 place-items-center rounded-lg border transition ${onDark ? "border-white/30 text-white hover:bg-white/10" : "border-fg/15 text-fg hover:bg-card"}`}
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
