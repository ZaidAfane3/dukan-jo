import type { Lang } from "./content";
import { demoSeed } from "./demoData";
import { demoActive, isOwnCopy } from "./demoSandbox";
import { loadSetup } from "./setup";
import { atelierConfig } from "./storefront/atelierTheme";
import type { InfoPage } from "./InfoPages";
import { lammaPages } from "./storefront/lammaPages";
import { lammaConfig, lammaProducts } from "./storefront/lammaTheme";
import { lujainPages } from "./storefront/lujainPages";
import { lujainConfig, lujainProducts } from "./storefront/lujainTheme";
import type { Bi, StorefrontConfig } from "./storefront/config";
import { loadConfig, saveConfig } from "./storefront/storage";
import { toStoreProduct, type StoreProduct } from "./storefront/useStoreData";

/* The theme store: ready-made store designs a merchant can buy and use. A theme is a function that builds a
   store design (the same plain JSON the store designer edits), so once it is in use everything in it can be
   changed in the designer. What a merchant owns is kept in this browser (prototype: no payment is taken). */

const bi = (en: string, ar: string): Bi => ({ en, ar });

/* What a theme is made of: the look of a store (colors, fonts, menu, texture, sections, cards, footer colors),
   not who the store is (logo, name, contact details, announcement bar). */
export type ThemeLook = {
  theme: StorefrontConfig["theme"];
  nav: StorefrontConfig["nav"];
  texture: StorefrontConfig["texture"];
  sections: StorefrontConfig["sections"];
  cards: StorefrontConfig["cards"];
  footer: { background: string; text: string };
};

export type ThemeInfo = {
  id: string;
  name: Bi;
  tagline: Bi;
  about: Bi;
  /* In JOD. 0 means free. */
  price: number;
  tags: Bi[];
  features: Bi[];
  /* A picture of the whole home page (in /public/themes). Without one, the theme is drawn live. */
  shot?: string;
  /* A theme the merchant saved from his own design: it carries its look, and it can be deleted (bought ones never can) */
  look?: ThemeLook;
  custom?: boolean;
  /* For a customized copy of a bought theme: the id of that theme */
  from?: string;
  /* The made-up store a theme is previewed with, when it is not the perfume store: its products and who it is */
  sampleProducts?: (lang: Lang) => StoreProduct[];
  /* The version of the theme's sample. A private copy (/saad/<theme>) made from an older version starts again from the new one. */
  rev?: number;
  /* The sub pages the theme's buttons lead to. They are saved as the store's pages when a private copy of the theme is opened. */
  pages?: () => InfoPage[];
  demo?: { name: Bi; about: Bi; color: string; phone: string };
  build: (lang: Lang, o: { samples: boolean; storeName?: string }) => StorefrontConfig;
};

export const themes: ThemeInfo[] = [
  {
    id: "atelier",
    name: bi("Atelier", "أتيليه"),
    tagline: bi("A luxury home page for any store", "صفحة رئيسية فاخرة لأي متجر"),
    about: bi(
      "A warm page with a big photo beside the title, a ribbon, collections and two large banners, set in elegant Arabic type. Change the words and the pictures and it fits any store.",
      "صفحة دافئة بصورة كبيرة بجانب العنوان، وشريط، ومجموعات وبنرين كبيرين، بخطوط عربية أنيقة. غيّر الكلمات والصور فتناسب أي متجر.",
    ),
    price: 19.99,
    tags: [bi("Dukkan design", "تصميم دكان")],
    shot: "/themes/atelier.jpg?v=2x",
    features: [
      bi("Edit everything: change every text, every picture and every color", "عدّل كل شيء: غيّر كل نص وكل صورة وكل لون"),
      bi("Your current products are imported into it automatically", "تُستورد منتجاتك الحالية فيه تلقائيًا"),
      bi("Big photo beside the title, with price and size", "صورة كبيرة بجانب العنوان مع السعر والحجم"),
      bi("A dark ribbon for short words: categories, materials, benefits", "شريط داكن لكلمات قصيرة: أقسام، خامات، مزايا"),
      bi("Collections with a frosted-glass look", "مجموعات بشكل زجاجي"),
      bi("Big banners with expressive display fonts", "بنرات كبيرة بخطوط عرض معبّرة"),
      bi("Light titles, airy spacing and a faint star pattern", "عناوين خفيفة ومسافات واسعة ونقش نجوم خافت"),
      bi("Footer and product cards with a short notes line", "فوتر وبطاقات منتجات بسطر ملاحظات قصير"),
    ],
    build: atelierConfig,
  },
  {
    id: "lamma",
    name: bi("Lamma", "لَمّة"),
    tagline: bi("A playful, colorful home page for clothes and youth stores", "صفحة رئيسية مرحة وملوّنة للملابس ومتاجر الشباب"),
    about: bi(
      "A bright page with a bold title, a collage of photos, colored quick buttons, round-corner product cards and color banner cards, in a friendly rounded font. Change the words, the pictures and the colors and it fits any lively store.",
      "صفحة مشرقة بعنوان عريض، وكولاج من الصور، وأزرار سريعة ملوّنة، وبطاقات منتجات بحواف دائرية، وبنرات بطاقات ملوّنة، بخط مدوّر ودود. غيّر الكلمات والصور والألوان فتناسب أي متجر مرح.",
    ),
    price: 39,
    tags: [bi("Dukkan design", "تصميم دكان")],
    shot: "/themes/lamma.jpg?v=3",
    features: [
      bi("Edit everything: change every text, every picture and every color", "عدّل كل شيء: غيّر كل نص وكل صورة وكل لون"),
      bi("Your current products are imported into it automatically", "تُستورد منتجاتك الحالية فيه تلقائيًا"),
      bi("A bold title with one colored word, a photo collage and a round sticker", "عنوان عريض بكلمة ملوّنة، وكولاج صور، وملصق دائري"),
      bi("A pill menu with a round basket button", "قائمة كبسولة مع زر سلة دائري"),
      bi("Colored quick buttons for your categories", "أزرار سريعة ملوّنة لأقسامك"),
      bi("Product cards with a hard shadow and a round + button", "بطاقات منتجات بظل صلب وزر + دائري"),
      bi("Color banner cards with an arch or tilted picture", "بنرات بطاقات ملوّنة بصورة قوس أو مائلة"),
      bi("A newsletter block and a simple one-line footer", "كتلة نشرة بريدية وتذييل بسيط بسطر واحد"),
    ],
    sampleProducts: lammaProducts,
    rev: 11,
    pages: lammaPages,
    demo: { name: bi("Lamma", "لَمّة"), about: bi("Comfy pieces in beautiful colors, for every place.", "قطع مريحة بألوان جميلة، لكل مكان."), color: "#2b1b47", phone: "70 000 0000" },
    build: lammaConfig,
  },
  {
    id: "lujain",
    name: bi("Lujain", "لُجَين"),
    tagline: bi("A quiet-luxury home page for fine jewelry", "صفحة رئيسية بفخامة هادئة لمتاجر المجوهرات"),
    about: bi(
      "Deep emerald with gold accents, round photos in thin gold rings, ornament titles, a light band of selected pieces and lots of room, set in El Messiri. Made for jewelry, watches and anything precious.",
      "زمرّدي عميق بلمسات ذهبية، وصور دائرية بحلقات ذهب رفيعة، وعناوين بزخرفة، وشريط فاتح للقطع المختارة، ومساحات واسعة، بخط المسيري. للمجوهرات والساعات وكل شي ثمين.",
    ),
    price: 49,
    tags: [bi("Dukkan design", "تصميم دكان")],
    features: [
      bi("Edit everything: change every text, every picture and every color", "عدّل كل شيء: غيّر كل نص وكل صورة وكل لون"),
      bi("Your current products are imported into it automatically", "تُستورد منتجاتك الحالية فيه تلقائيًا"),
      bi("A round hero photo in three thin rings, with a price tag", "صورة غلاف دائرية بثلاث حلقات رفيعة وبطاقة سعر"),
      bi("Round category pictures in gold rings", "صور أقسام دائرية بحلقات ذهبية"),
      bi("A light band for your selected pieces", "شريط فاتح لقطعك المختارة"),
      bi("A centered block for custom pieces, with short promises", "كتلة في المنتصف للقطع الخاصة مع وعود قصيرة"),
      bi("A page for every category, booking, custom piece, care, ring sizes and shipping", "صفحة لكل قسم وللحجز والقطعة الخاصة والعناية والمقاسات والشحن"),
      bi("Square buttons, hairlines and ornament titles", "أزرار مربعة وخطوط رفيعة وعناوين بزخرفة"),
    ],
    sampleProducts: lujainProducts,
    rev: 6,
    pages: lujainPages,
    demo: { name: bi("Lujain", "لُجَين"), about: bi("Fine jewelry, handmade.", "مجوهرات راقية مصنوعة يدوياً."), color: "#e2c27a", phone: "70 000 0000" },
    build: lujainConfig,
  },
];

export const findTheme = (id: string | null | undefined) => themes.find((t) => t.id === id) ?? null;

/** The made-up perfumes a theme is previewed with (the same ones as the platform tour). */
export function previewProducts(lang: Lang, theme?: ThemeInfo | null): StoreProduct[] {
  if (theme?.sampleProducts) return theme.sampleProducts(lang);
  try {
    const raw = JSON.parse(demoSeed(lang).local["seen-products"]) as Record<string, unknown>[];
    return raw.filter((p) => !p.hidden).map(toStoreProduct);
  } catch {
    return [];
  }
}

/* ---------------- What the merchant owns ---------------- */

const KEY = "seen-themes";

export type OwnedTheme = { id: string; at: number; paid: number };
/* A design the merchant saved as a theme */
/* `from` is the bought theme a copy was made from: such a copy is never deleted, it can be reset to the original look */
export type CustomTheme = { id: string; name: string; at: number; look: ThemeLook; from?: string };
export type ThemeState = { owned: OwnedTheme[]; custom: CustomTheme[]; active: string };

/** How many designs a merchant can save (their pictures live in this browser, which has little room) */
export const MAX_SAVED = 10;

export function loadThemeState(): ThemeState {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<ThemeState>) : {};
    return { owned: Array.isArray(s.owned) ? s.owned : [], custom: Array.isArray(s.custom) ? s.custom : [], active: typeof s.active === "string" ? s.active : "" };
  } catch {
    return { owned: [], custom: [], active: "" };
  }
}

function saveThemeState(s: ThemeState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/* Looks that come with a theme: in the designer anyone can try them in the preview, but they are kept in the store only for a
   merchant who bought that theme. Saad's own copies (/saad) have everything. */
export const ownsLook = (themeId: string) => isOwnCopy() || loadThemeState().owned.some((o) => o.id === themeId);

/** The store design with every look of a theme he has not bought put back to the plain one. */
export function withoutUnboughtLooks(c: StorefrontConfig): StorefrontConfig {
  const lamma = ownsLook("lamma");
  const lujain = ownsLook("lujain");
  const sections = c.sections.map((s): StorefrontConfig["sections"][number] => {
    if (s.type === "hero" && ((s.settings.layout === "pop" && !lamma) || (s.settings.layout === "orbit" && !lujain))) return { ...s, settings: { ...s.settings, layout: "banner" } };
    if (s.type === "tiles" && s.settings.style === "circles" && !lujain) return { ...s, settings: { ...s.settings, style: "classic" } };
    if (s.type === "text" && s.settings.style === "statement" && !lujain) return { ...s, settings: { ...s.settings, style: "plain" } };
    if (s.type === "banners" && !lamma && s.settings.items.some((b) => b.variant === "card")) return { ...s, settings: { ...s.settings, items: s.settings.items.map((b) => (b.variant === "card" ? { ...b, variant: "photo" as const } : b)) } };
    return s;
  });
  const ts = c.theme.titleStyle;
  const titleStyle = (ts === "pop" && !lamma) || (ts === "ornament" && !lujain) ? "bold" : ts;
  return { ...c, sections, theme: { ...c.theme, titleStyle } };
}

/** Adds the theme to the merchant's themes (prototype: no payment is taken). */
export function buyTheme(t: ThemeInfo): ThemeState {
  const s = loadThemeState();
  if (!s.owned.some((o) => o.id === t.id)) s.owned = [...s.owned, { id: t.id, at: Date.now(), paid: t.price }];
  saveThemeState(s);
  return s;
}

/** The look of a store design, copied so later edits to the design never change a saved theme. */
export function lookOf(c: StorefrontConfig): ThemeLook {
  return JSON.parse(JSON.stringify({ theme: c.theme, nav: c.nav, texture: c.texture, sections: c.sections, cards: c.cards, footer: { background: c.footer.background, text: c.footer.text } })) as ThemeLook;
}

/** A store design with a look put on it. His logo, store name, contact details and announcement bar stay as they are. */
export function composeDesign(cur: StorefrontConfig, look: ThemeLook): StorefrontConfig {
  const l = JSON.parse(JSON.stringify(look)) as ThemeLook;
  return { ...cur, theme: l.theme, nav: l.nav, texture: l.texture, sections: l.sections, cards: l.cards, footer: { ...cur.footer, background: l.footer.background, text: l.footer.text } };
}

/** Makes the theme the store's design. */
export function applyTheme(t: ThemeInfo, lang: Lang): boolean {
  const look = t.look ?? lookOf(t.build(lang, { samples: demoActive(), storeName: loadSetup()?.name }));
  if (!saveConfig(composeDesign(loadConfig(), look))) return false;
  return saveThemeState({ ...loadThemeState(), active: t.id });
}

/** Keeps a design as a theme in My themes. `full` means the browser had no room (usually too many pictures). */
export function saveDesignAsTheme(name: string, cfg: StorefrontConfig = loadConfig()): "ok" | "full" | "limit" {
  const s = loadThemeState();
  /* Copies of bought themes do not count: only designs he saved himself */
  if (s.custom.filter((c) => !c.from).length >= MAX_SAVED) return "limit";
  const id = `mine-${Date.now().toString(36)}`;
  const next: ThemeState = { ...s, custom: [...s.custom, { id, name: name.trim().slice(0, 40) || "My design", at: Date.now(), look: lookOf(cfg) }], active: s.active };
  return saveThemeState(next) ? "ok" : "full";
}

/** Deletes a design the merchant saved himself. A bought theme, and the customized copy of one, can never be deleted (they can be reset). */
export function deleteSavedTheme(id: string): ThemeState {
  const s = loadThemeState();
  const next: ThemeState = { ...s, custom: s.custom.filter((c) => c.id !== id || !!c.from), active: s.active === id && !s.custom.find((c) => c.id === id)?.from ? "" : s.active };
  saveThemeState(next);
  return next;
}

/** A saved design, shaped like a theme of the store so the same cards and previews can show it. */
export function savedThemeInfo(c: CustomTheme): ThemeInfo {
  return {
    id: c.id,
    name: bi(c.name, c.name),
    tagline: bi("Saved from your store", "محفوظ من متجرك"),
    about: bi("", ""),
    price: 0,
    tags: [],
    features: [],
    look: c.look,
    custom: true,
    from: c.from,
    build: (_lang, _o) => composeDesign(loadConfig(), c.look),
  };
}

/** "Customize" on a bought theme: starts a copy of it in My themes (once), makes it the store design, and returns so the
    designer can open on it. The bought theme itself is never changed. */
export function customizeTheme(t: ThemeInfo, lang: Lang): "ok" | "full" {
  const s = loadThemeState();
  const mine = s.custom.find((c) => c.from === t.id);
  const look = mine ? mine.look : lookOf(t.build(lang, { samples: demoActive(), storeName: loadSetup()?.name }));
  const id = mine ? mine.id : `mine-${Date.now().toString(36)}`;
  const custom = mine ? s.custom : [...s.custom, { id, name: `${t.name[lang]} ${lang === "ar" ? "(نسختي)" : "(my copy)"}`, at: Date.now(), look, from: t.id }];
  if (!saveConfig(composeDesign(loadConfig(), look))) return "full";
  return saveThemeState({ ...s, custom, active: id }) ? "ok" : "full";
}

/** Puts a customized copy back to the original look of the theme it came from. If it is the store's design now, the store goes back too. */
export function resetCopy(id: string, lang: Lang): "ok" | "full" {
  const s = loadThemeState();
  const c = s.custom.find((x) => x.id === id);
  const original = findTheme(c?.from);
  if (!c || !original) return "full";
  const look = lookOf(original.build(lang, { samples: demoActive(), storeName: loadSetup()?.name }));
  if (s.active === id && !saveConfig(composeDesign(loadConfig(), look))) return "full";
  return saveThemeState({ ...s, custom: s.custom.map((x) => (x.id === id ? { ...x, look } : x)) }) ? "ok" : "full";
}
