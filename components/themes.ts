import type { Lang } from "./content";
import { demoSeed } from "./demoData";
import { demoActive, isOwnCopy } from "./demoSandbox";
import { loadSetup } from "./setup";
import { atelierConfig } from "./storefront/atelierTheme";
import { load as loadPages, type InfoPage } from "./InfoPages";
import { lammaPages } from "./storefront/lammaPages";
import { lammaConfig, lammaProducts } from "./storefront/lammaTheme";
import { madaPages } from "./storefront/madaPages";
import { madaConfig, madaProducts } from "./storefront/madaTheme";
import { footerColumns, matchPage, pageIdOf, relinkPages, samplePageId, type Bi, type FooterColumn, type FooterTab, type StorefrontConfig } from "./storefront/config";
import { loadConfig, loadTemplate, saveConfig } from "./storefront/storage";
import { defaultConfig } from "./storefront/config";
import { sanitizeDesign } from "./safeDesign";
import { toStoreProduct, type StoreProduct } from "./storefront/useStoreData";

/* The theme store: ready-made store designs a merchant can buy and use. A theme is a function that builds a
   store design (the same plain JSON the store designer edits), so once it is in use everything in it can be
   changed in the designer. What a merchant owns is kept in this browser (prototype: no payment is taken). */

const bi = (en: string, ar: string): Bi => ({ en, ar });

/* What a theme is made of: the look of a store (colors, fonts, menu, texture, sections, cards, the footer's colors and layout),
   not who the store is (logo, name, contact details, announcement bar). */
export type ThemeLook = {
  theme: StorefrontConfig["theme"];
  nav: StorefrontConfig["nav"];
  texture: StorefrontConfig["texture"];
  sections: StorefrontConfig["sections"];
  cards: StorefrontConfig["cards"];
  /* The basket's look. A look saved before it was kept has none: the store keeps its own. */
  cart?: StorefrontConfig["cart"];
  /* The product page's look. A look saved before it was kept has none: the store keeps its own. */
  productPage?: StorefrontConfig["productPage"];
  /* style, columns, sizes, labels: the footer's layout. A look saved before they were kept has only the colors. */
  footer: { background: string; text: string } & Partial<Pick<Footer, "style" | "columns" | "sizes" | "labels">>;
  /* The header's switches, how the store name is drawn and the order of the side menu. A look saved before they were kept
     has none of them: the store keeps its own. */
  header?: Partial<StorefrontConfig["header"]>;
  identity?: Partial<Pick<StorefrontConfig["identity"], LookIdentity>>;
  drawer?: { items: StorefrontConfig["drawer"]["items"] };
};

/* The parts of "who the store is" that are only a look: whether the logo shows, where the name sits, its font and its color.
   The logo itself, the tab icon and the line under the name are his. */
const lookIdentity = ["showLogo", "align", "nameFont", "nameColor"] as const;
type LookIdentity = (typeof lookIdentity)[number];

type Footer = StorefrontConfig["footer"];

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
  /* false: the theme is no longer offered in the theme store (a merchant who bought it keeps it, and its looks are open to everyone) */
  inStore?: false;
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

/* «مؤسسو دكان» (id "mada"): Dukkan's second free design. Like the default one it is always in My themes and can never be deleted. It is not sold,
   so it is not in the theme store; Saad's showcase with its photos is /saad/mada. */
export const MADA_THEME_ID = "mada";
export const madaTheme: ThemeInfo = {
  id: MADA_THEME_ID,
  inStore: false,
  name: bi("Dukkan Founders", "مؤسسو دكان"),
  tagline: bi("A clean, free home page for every store", "صفحة رئيسية نظيفة ومجانية لجميع المتاجر"),
  about: bi(
    "A white page with black type and a red for sales, like the big fashion stores: a tall full-width cover, round category pictures, photo cards, a sale banner and a trust row, set in Noto Kufi with square corners. Free for every store.",
    "صفحة بيضاء بخط أسود ولون أحمر للتخفيضات، مثل متاجر الأزياء الكبيرة: غلاف طويل بعرض الصفحة، وصور أقسام دائرية، وبطاقات صور، وبنر تخفيضات، وصف مزايا، بخط نوتو كوفي وحواف مربعة. مجاني لكل متجر.",
  ),
  price: 0,
  tags: [bi("Free", "مجاني"), bi("Dukkan design", "تصميم دكان")],
  features: [
    bi("Edit everything: change every text, every picture and every color", "عدّل كل شيء: غيّر كل نص وكل صورة وكل لون"),
    bi("Your current products are imported into it automatically", "تُستورد منتجاتك الحالية فيه تلقائيًا"),
    bi("A tall full-width cover with the words at the bottom corner and two buttons", "غلاف طويل بعرض الصفحة، الكلام في الزاوية السفلية مع زرّين"),
    bi("Shop by category: eight round pictures in one row", "تسوّق حسب الفئة: ثماني صور دائرية في صف واحد"),
    bi("Three photo cards for your main sections", "ثلاث بطاقات صور لأقسامك الرئيسية"),
    bi("Best sellers with category filters, and new arrivals", "الأكثر رواجاً مع فلاتر الأقسام، ووصل حديثاً"),
    bi("A sale banner, sale prices and badges in red", "بنر تخفيضات، وأسعار التخفيض والشارات بالأحمر"),
    bi("A trust row, a newsletter and a black footer", "صف مزايا، ونشرة بريدية، وفوتر أسود"),
  ],
  sampleProducts: madaProducts,
  rev: 1,
  pages: madaPages,
  demo: { name: bi("Your store", "متجرك"), about: bi("Everyday clothes at fair prices.", "ملابس يومية بأسعار معقولة."), color: "#111111", phone: "70 000 0000" },
  build: madaConfig,
};

export const themes: ThemeInfo[] = [
  madaTheme,
  {
    id: "atelier",
    name: bi("Misk", "مِسك"),
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
];

/* Dukkan's own starting design: free, always in My themes, so he can go back to it whenever he wants. It is the design a new store starts with. */
export const DEFAULT_THEME_ID = "dukkan";
export const defaultTheme: ThemeInfo = {
  id: DEFAULT_THEME_ID,
  name: bi("Dukkan (default)", "دكان (الأساسي)"),
  tagline: bi("The design every new store starts with", "التصميم الذي يبدأ به كل متجر جديد"),
  about: bi("", ""),
  price: 0,
  tags: [],
  features: [],
  build: () => loadTemplate() ?? defaultConfig,
};

export const findTheme = (id: string | null | undefined) => (id === DEFAULT_THEME_ID ? defaultTheme : themes.find((t) => t.id === id) ?? null);

/** The free designs every merchant has: always first in My themes, in this order, and never deleted. */
export const freeThemes: ThemeInfo[] = [defaultTheme, madaTheme];
export const isFreeTheme = (id: string | null | undefined) => freeThemes.some((t) => t.id === id);

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
/* names: the names he gave to Dukkan's and bought themes in My themes (his saved designs keep theirs in `custom`) */
export type ThemeState = { owned: OwnedTheme[]; custom: CustomTheme[]; active: string; names?: Record<string, string> };

/** How many designs a merchant can save (their pictures live in this browser, which has little room) */
export const MAX_SAVED = 10;

export function loadThemeState(): ThemeState {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<ThemeState>) : {};
    /* A saved look is a design like any other: it is checked before it is shown or put on the store (see safeDesign.ts) */
    const custom = (Array.isArray(s.custom) ? s.custom : []).filter((c) => c && typeof c.id === "string" && c.look && typeof c.look === "object").map((c) => ({ ...c, name: String(c.name ?? "").slice(0, 40), look: { ...c.look, ...sanitizeDesign(c.look) } as ThemeLook }))
      /* a copy of a theme that no longer exists (one removed from Dukkan) is kept as a design he saved himself: it can be deleted */
      .map(({ from, ...c }) => (from && findTheme(from) ? { ...c, from } : c));
    const names = Object.fromEntries(Object.entries(s.names && typeof s.names === "object" ? s.names : {}).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 40)]));
    return { owned: Array.isArray(s.owned) ? s.owned : [], custom, active: typeof s.active === "string" ? s.active : "", names };
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
export const ownsLook = (themeId: string) => isOwnCopy() || isFreeTheme(themeId) || findTheme(themeId)?.inStore === false || loadThemeState().owned.some((o) => o.id === themeId);

/** The store design with every look of a theme he has not bought put back to the plain one. */
/* Round category pictures belong to the free Mada design, so every store keeps them. The round-photo hero ("orbit"), the centered
   statement text and the ornament titles came with a jewelry theme removed on 2026-10-28: no theme offers them any more, but a
   design that already uses one keeps it (as it did before, when they were open to everyone); the designer no longer offers them. */
export function withoutUnboughtLooks(c: StorefrontConfig): StorefrontConfig {
  const lamma = ownsLook("lamma");
  const sections = c.sections.map((s): StorefrontConfig["sections"][number] => {
    if (s.type === "hero" && s.settings.layout === "pop" && !lamma) return { ...s, settings: { ...s.settings, layout: "banner" } };
    if (s.type === "banners" && !lamma && s.settings.items.some((b) => b.variant === "card")) return { ...s, settings: { ...s.settings, items: s.settings.items.map((b) => (b.variant === "card" ? { ...b, variant: "photo" as const } : b)) } };
    return s;
  });
  const ts = c.theme.titleStyle;
  const titleStyle = ts === "pop" && !lamma ? "bold" : ts;
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
  const f = c.footer;
  const identity = Object.fromEntries(lookIdentity.map((k) => [k, c.identity[k]]));
  return JSON.parse(JSON.stringify({ theme: c.theme, nav: c.nav, texture: c.texture, sections: c.sections, cards: c.cards, cart: c.cart, productPage: c.productPage, footer: { background: f.background, text: f.text, style: f.style, columns: footerColumns(f), sizes: f.sizes, labels: f.labels }, header: c.header, identity, drawer: { items: c.drawer.items } })) as ThemeLook;
}

/* ---------------- Footer links on the buyer's store ---------------- */

/* A theme's sample pages (9100 to 9399) are not in the buyer's store: a link to one goes to his own page of the same kind (see matchPage) */
let samples: Map<number, InfoPage> | null = null;
const sampleOf = (id: number) => (samples ??= new Map(themes.flatMap((t) => t.pages?.() ?? []).map((p) => [p.id, p] as const))).get(id);
/** The title of a theme's sample page, to find his page of the same kind */
const sampleWords = (id: number) => { const p = sampleOf(id); return p ? [p.title.en, p.title.ar] : []; };

/** Fixes a footer link for the pages this store really has: links to his pages stay, a theme's sample page (or a theme link left
    empty) goes to his page of the same title or kind, a link to a page he does not have is dropped (null). */
function pageLinker(pages: InfoPage[]) {
  const live = pages.filter((p) => p.published && !samplePageId(p.id));
  const has = new Set(pages.map((p) => p.id));
  return (x: FooterTab): FooterTab | null => {
    const id = pageIdOf(x.link);
    if (id !== null && !samplePageId(id)) return has.has(id) ? x : null;
    if (id === null && x.link.trim()) return x;
    const m = matchPage([...(id !== null ? sampleWords(id) : []), x.label.en, x.label.ar], live);
    /* No shipping page: the returns policy is the closest (and it is named as his page is) */
    if (m) return { ...x, link: `page:${m.page.id}`, label: m.near ? { ...m.page.title } : x.label };
    /* An empty link the theme left for him to fill stays; a sample page he does not have goes */
    return id === null ? x : null;
  };
}

const fixLinks = (list: FooterTab[] | undefined, fix: (x: FooterTab) => FooterTab | null) => (list ?? []).map(fix).filter((x): x is FooterTab => !!x);

/** His footer with the footer of a theme (or of a saved look) put on it. The layout (colors, style, columns, sizes, titles) comes from
    the theme; his own details (contact, socials, about, address, licenses, his links) stay. The theme's words only fill what he left
    empty, never the social accounts. No link is kept to a page the store does not have. */
export function mergeFooter(cur: Footer, look: ThemeLook["footer"] & Partial<Footer>, pages: InfoPage[] = loadPages()): Footer {
  const fix = pageLinker(pages);
  const fill = (k: "email" | "whatsapp" | "telegram") => (cur[k]?.trim() ? cur[k] : look[k]?.trim() || "");
  const fillBi = (mine: Bi, theirs?: Bi): Bi => ({ en: mine?.en?.trim() ? mine.en : theirs?.en ?? "", ar: mine?.ar?.trim() ? mine.ar : theirs?.ar ?? "" });
  const f: Footer = { ...cur, background: look.background, text: look.text, tabs: fixLinks(cur.tabs, fix), email: fill("email"), whatsapp: fill("whatsapp"), telegram: fill("telegram"), about: fillBi(cur.about, look.about), address: fillBi(cur.address, look.address) };
  /* A look saved before the layout was kept has only the colors: his layout stays */
  if (!look.columns) return f;
  f.style = look.style ?? cur.style;
  f.sizes = look.sizes;
  f.labels = look.labels ?? cur.labels;
  const theirs = footerColumns({ columns: look.columns }).flatMap((col): FooterColumn[] => {
    if (col.kind !== "custom") return [{ id: col.id, kind: col.kind, visible: col.visible !== false }];
    const links = fixLinks(col.links, fix);
    /* a column whose every link led to a missing page goes with them */
    return links.length || !col.links?.length ? [{ ...col, visible: col.visible !== false, links }] : [];
  });
  /* His own columns that the theme does not have stay at the end, with the links that still lead somewhere */
  const ids = new Set(look.columns.map((c) => c.id));
  const mine = footerColumns(cur)
    .filter((col) => col.kind === "custom" && !ids.has(col.id))
    .map((col) => ({ ...col, links: fixLinks(col.links, fix) }))
    .filter((col) => col.links.length);
  f.columns = [...theirs, ...mine];
  return f;
}

/** The side menu with the order and switches of a look. His own links in it stay, and a part of the menu the look does not list
    keeps his switch at the end. */
function mergeDrawer(cur: StorefrontConfig["drawer"], look?: ThemeLook["drawer"]): StorefrontConfig["drawer"] {
  /* a look saved by hand or by an older version can hold anything: only the menu's known parts, each once, are taken */
  const known = ["categories", "pages", "links", "custom"];
  const items = Array.isArray(look?.items) ? look.items.filter((x) => x && known.includes(x.kind)) : [];
  const theirs = items.filter((x, i, all) => all.findIndex((y) => y.kind === x.kind) === i);
  if (!theirs.length) return cur;
  const kinds = new Set(theirs.map((x) => x.kind));
  return { ...cur, items: [...theirs.map((x) => ({ kind: x.kind, visible: x.visible !== false })), ...cur.items.filter((x) => !kinds.has(x.kind))] };
}

/** His identity with the look of a theme's store name (see lookIdentity). A look that has the name's look but no font or color
    of its own draws the name in the theme's usual font and color, so his are taken off. */
function mergeIdentity(cur: StorefrontConfig["identity"], look?: ThemeLook["identity"]): StorefrontConfig["identity"] {
  if (!look || typeof look !== "object") return cur;
  const { nameFont: _f, nameColor: _c, ...rest } = cur;
  void _f;
  void _c;
  return {
    ...rest,
    showLogo: typeof look.showLogo === "boolean" ? look.showLogo : cur.showLogo,
    align: look.align === "start" || look.align === "center" ? look.align : cur.align,
    ...(typeof look.nameFont === "string" && look.nameFont ? { nameFont: look.nameFont } : {}),
    ...(typeof look.nameColor === "string" && look.nameColor ? { nameColor: look.nameColor } : {}),
  };
}

/** A store design with a look put on it. His logo, store name, the line under it, his menu links, contact details and announcement
    bar stay as they are. The header's switches come from the look, except the language button, which is his choice (it needs
    his words in both languages). */
export function composeDesign(cur: StorefrontConfig, look: ThemeLook, pages?: InfoPage[]): StorefrontConfig {
  const l = JSON.parse(JSON.stringify(look)) as ThemeLook;
  const list = pages ?? loadPages();
  /* only the switches the look really has (true or false) are taken */
  const theirs = l.header && typeof l.header === "object" ? Object.fromEntries(Object.entries(l.header).filter(([k, v]) => k in cur.header && typeof v === "boolean")) : {};
  const header = { ...cur.header, ...theirs, showLanguage: cur.header.showLanguage };
  /* the theme's links to its sample pages lead to his own pages (or his products) */
  return relinkPages({ ...cur, theme: l.theme, nav: l.nav, texture: l.texture, sections: l.sections, cards: l.cards, cart: l.cart ?? cur.cart, productPage: l.productPage ?? cur.productPage, header, identity: mergeIdentity(cur.identity, l.identity), drawer: mergeDrawer(cur.drawer, l.drawer), footer: mergeFooter(cur.footer, l.footer, list) }, list, sampleWords);
}

/** A whole theme design (as its build makes it) on his store: all of the theme, but who the store is stays his: the logo, the tab
    icon, the announcement bar, the page background, his words, his menu links and his footer details (see mergeFooter). */
export function adoptTheme(cur: StorefrontConfig, built: StorefrontConfig, pages?: InfoPage[]): StorefrontConfig {
  const b = JSON.parse(JSON.stringify(built)) as StorefrontConfig;
  const list = pages ?? loadPages();
  return relinkPages({
    ...b,
    identity: { ...b.identity, logo: cur.identity.logo, favicon: cur.identity.favicon },
    announcement: cur.announcement,
    pageBackground: cur.pageBackground,
    texts: cur.texts,
    drawer: { ...b.drawer, custom: cur.drawer.custom },
    footer: mergeFooter(cur.footer, { ...b.footer, columns: footerColumns(b.footer) }, list),
  }, list, sampleWords);
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

/** Renames a theme in My themes. An empty name gives a Dukkan or bought theme its own name back (a saved design keeps its old one). */
export function renameTheme(id: string, name: string): ThemeState {
  const s = loadThemeState();
  const v = name.trim().slice(0, 40);
  const mine = s.custom.some((c) => c.id === id);
  const names = { ...s.names };
  if (!mine) {
    if (v) names[id] = v;
    else delete names[id];
  }
  const next: ThemeState = { ...s, names, custom: mine && v ? s.custom.map((c) => (c.id === id ? { ...c, name: v } : c)) : s.custom };
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
