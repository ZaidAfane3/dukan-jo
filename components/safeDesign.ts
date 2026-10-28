/* The store design (StorefrontConfig) made safe to keep and to show.

   A saved design comes from the merchant's browser today and from the server later, and either can be edited by hand, so it is
   never trusted: every part is checked against the shape in storefront/config.ts. Wrong types are dropped (the starter design
   fills them back in), lists are cut to a sane length, numbers are kept in range, links can only be web addresses, store pages,
   sections, e-mail or phone numbers, pictures can only be uploaded picture data or the platform's own files, and colors can only
   be hex colors or a gradient of them, so no value can load something from another site or run anything.

   Plain TypeScript with no browser APIs, so the backend can run the very same rules on every design it receives. */

import { defaultConfig, newBanners, newChips, newCollection, newNewsletter, newRibbon, newSlides, newTextSection, newTiles, type SectionConfig, type SectionType, type StorefrontConfig } from "./storefront/config";
import { safeUrl } from "./safe";

type Spec = (v: unknown, i: number) => unknown;
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/* ------------------------------ values ------------------------------ */

/** Text as typed, without control characters, invisible spaces and direction overrides (they can hide or reverse what a
    visitor reads). Line breaks, direction marks and isolates (LRM/RLM, LRI/PDI around a phone number), ZWJ/ZWNJ and emoji stay. */
export function cleanWords(v: unknown, max: number): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  return v.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b\u2028\u2029\u202a-\u202e\ufeff]/g, "").slice(0, max);
}

const text = (max: number): Spec => (v) => cleanWords(v, max);

const E = () => ({ en: "", ar: "" });
/** A text in both languages. A plain string counts for both; anything else that is there becomes empty words. */
const bi = (max = 300): Spec => (v) => {
  if (v === undefined) return undefined;
  if (typeof v === "string") {
    const s = cleanWords(v, max) ?? "";
    return { en: s, ar: s };
  }
  if (!isObj(v)) return E();
  return { en: cleanWords(v.en, max) ?? "", ar: cleanWords(v.ar, max) ?? "" };
};
const para = bi(4000);

const bool: Spec = (v) => (typeof v === "boolean" ? v : undefined);

const oneOf = (...list: readonly (string | number)[]): Spec => (v) => (list.includes(v as string | number) ? v : undefined);

const num = (min: number, max: number, int = false): Spec => (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
};
const size = num(8, 200); /* the designer's own steppers go up to 200 px */
const seconds = num(1, 60, true);
const productId = num(-1e12, 1e12, true);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const GRADIENT = /^linear-gradient\(\s*-?\d{1,3}deg(?:\s*,\s*#[0-9a-f]{6}){2,4}\s*\)$/i;
/** A color: "#abc", "#aabbcc", a gradient of such colors (see gradientOf/flowingOf), or "" for the theme's own. Nothing else, so a
    color can never carry other CSS such as url(...). */
export function safeDesignColor(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" || HEX.test(t) || GRADIENT.test(t) ? t : undefined;
}
const color: Spec = safeDesignColor;

const DATA_PIC = /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;
const OWN_FILE = /^\/(?!\/)[^\s"'`\\<>()]*$/;
/** A picture: picture data uploaded in the designer (never SVG: designer/image.ts turns every upload into PNG, JPEG, GIF or WebP), or a file of the platform itself ("/demo/..."). An address on another site,
    javascript:, data: of other kinds and anything that could break out of a CSS url() become "". */
export function safePicture(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t === "") return "";
  if (t.length > 16_000_000) return "";
  return DATA_PIC.test(t) || (OWN_FILE.test(t) && !t.includes("..")) ? t : "";
}
const pic: Spec = safePicture;

/** Where a button or a menu item leads (see resolveLink and linkProps): a page of the store ("page:5"), a part of the page (its id),
    a web address, an e-mail, a phone number, or a mailto:/tel:/sms:/whatsapp: link. Anything else (javascript:, data:, an address
    with a user name and password, a protocol-relative "//site") becomes "", or the full https address for "//site". */
export function safeDesignLink(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  /* Browsers ignore tabs and line breaks inside a link ("java\tscript:"), so they go before anything is checked */
  // eslint-disable-next-line no-control-regex
  const t = (cleanWords(v.replace(/[\t\n\r]/g, ""), 500) ?? "").trim();
  if (!t) return "";
  if (/^page:\d{1,12}$/.test(t)) return t;
  if (/^[\w-]{1,60}$/.test(t)) return t;
  if (/^(?:mailto|tel|sms|whatsapp):[^\s<>"'`]+$/i.test(t)) return t;
  if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(t)) return t;
  if (/^\+?[\d\s\-().]{7,24}$/.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:/i.test(t) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(t)) return "";
  const u = safeUrl(t);
  if (!u) return "";
  return t.startsWith("//") ? u : t;
}
const link: Spec = safeDesignLink;

/** A social account: a handle ("@name" or "name") or a link to the profile. */
const social: Spec = (v) => {
  if (typeof v !== "string") return undefined;
  const t = (cleanWords(v, 200) ?? "").trim();
  return /^@?[\w.-]{1,60}$/.test(t) ? t : safeDesignLink(t);
};

/** An id used as an anchor (#id) and as a key: letters, digits, _ and -. */
const ID = /^[\w-]{1,80}$/;
const id: Spec = (v) => (typeof v === "string" && ID.test(v) ? v : undefined);

/* ------------------------------ shapes ------------------------------ */

/** An object with only the keys of its shape, each checked. `base` fills what is missing or wrong (for the parts the store must have). */
function obj(shape: Record<string, Spec>, base?: () => Obj): Spec {
  return (v) => {
    if (!isObj(v)) return undefined;
    const out: Obj = base ? base() : {};
    for (const k of Object.keys(shape)) {
      const x = shape[k](v[k], 0);
      if (x !== undefined) out[k] = x;
    }
    return out;
  };
}

/** A list cut to `max`, with the items that are not of the right kind left out. */
const list = (item: Spec, max: number): Spec => (v) => {
  if (!Array.isArray(v)) return undefined;
  return v.slice(0, max).map((x, i) => item(x, i)).filter((x) => x !== undefined);
};

/** Where a picture sits in its frame. All three numbers or nothing. */
const pos: Spec = (v) => {
  if (!isObj(v)) return undefined;
  const x = num(-100, 100)(v.x, 0), y = num(-100, 100)(v.y, 0), zoom = num(0.5, 3)(v.zoom, 0);
  return x === undefined || y === undefined || zoom === undefined ? undefined : { x, y, zoom };
};
const textStyle = obj({ align: oneOf("right", "center", "left"), bold: bool, italic: bool });

const themeFonts = ["readex", "plex", "elegant", "cairo", "tajawal", "baloo", "messiri", "almarai", "kufi"] as const;
const heroFont = oneOf("", ...themeFonts, "ruqaa", "lemonada", "amiri");
const displayFont = oneOf("default", "ruqaa", "lemonada", "amiri");

/** A link of the menu or the footer. One without an id gets one from its place in the list. */
const tab: Spec = (v, i) => {
  if (!isObj(v)) return undefined;
  const t = obj({ id, label: bi(), link, visible: bool })(v, i) as Obj;
  return { id: t.id ?? `link-${i}`, label: t.label ?? E(), link: t.link ?? "", visible: t.visible ?? true };
};

const column: Spec = (v, i) => {
  if (!isObj(v)) return undefined;
  const c = obj({ id, kind: oneOf("about", "pages", "contact", "social", "licenses", "custom"), visible: bool, title: bi(), links: list(tab, 30) })(v, i) as Obj;
  if (!c.kind) return undefined;
  return { ...c, id: c.id ?? `col-${i}`, visible: c.visible ?? true };
};

/* The settings of each kind of section. Kept complete by the type below: a setting added to SectionConfig must be added here. */
type SettingsOf<T extends SectionType> = Extract<SectionConfig, { type: T }>["settings"];
type Shapes = { [T in SectionType]: { [K in keyof Required<SettingsOf<T>>]: Spec } };

const heroBg = obj({ kind: oneOf("color", "image"), color, image: pic, pos, title: bi(), subtitle: para, button: bi(), link }, () => ({ kind: "color", color: "", image: "" }));
const sizesOf = (...keys: string[]) => obj(Object.fromEntries(keys.map((k) => [k, size])));
const colorsOf = (...keys: string[]) => obj(Object.fromEntries(keys.map((k) => [k, color])));
const stylesOf = (...keys: string[]) => obj(Object.fromEntries(keys.map((k) => [k, textStyle])));

const shapes: Shapes = {
  hero: {
    title: bi(), subtitle: para, button: bi(), backgrounds: list(heroBg, 12), autoplay: bool, seconds, showCards: bool,
    layout: oneOf("banner", "split", "pop", "orbit"), photo: pic, photoSide: oneOf("start", "end"), photo2: pic, link, link2: link,
    photoPos: pos, photo2Pos: pos, sticker: bi(), accentWord: bi(), popColors: colorsOf("accent", "blob", "sticker"), eyebrow: bi(),
    price: text(60), size: bi(), button2: bi(), panelColor: color, fullWidth: bool, textPos: oneOf("center", "bottom-start", "bottom-center"),
    height: oneOf("normal", "tall"), titleFont: heroFont, cardIds: list(productId, 24),
    cardLook: obj({ arrange: oneOf("fan", "row", "single"), frame: oneOf("card", "bare"), shape: oneOf("portrait", "square", "round"), showName: bool }),
    styles: stylesOf("title", "subtitle", "eyebrow"),
    colors: colorsOf("title", "subtitle", "eyebrow", "price", "detail", "button"),
    sizes: sizesOf("title", "subtitle", "eyebrow", "price", "detail", "button"),
  },
  perks: { items: list(obj({ title: bi(), desc: para, icon: oneOf("truck", "shield", "returns", "gift", "clock", "chat", "image"), image: pic }, () => ({ icon: "truck", title: E(), desc: E() })), 12) },
  featured: { title: bi(), count: num(0, 48, true) },
  discounts: { title: bi(), count: num(0, 48, true) },
  tiles: { title: bi(), items: list(obj({ image: pic, label: bi(), link, chip: oneOf("light", "dark"), pos }, () => ({ image: "", label: E(), link: "" })), 24), columns: oneOf(3, 4, 5, 6, 8), style: oneOf("classic", "editorial", "circles") },
  banners: {
    items: list(obj({
      image: pic, title: bi(), text: para, button: bi(), link, eyebrow: bi(), font: displayFont, titleColor: color, panel: oneOf("light", "dark", "none"),
      position: oneOf("top-start", "top-end", "bottom-start", "bottom-end", "center"), buttonStyle: oneOf("filled", "outline"), accent: color, textFont: displayFont,
      titleSize: size, textSize: size, eyebrowColor: color, textColor: color, panelColor: color, variant: oneOf("photo", "card"), bg: color, shape: oneOf("arch", "tilt"),
      pos, eyebrowSize: size, images: list(pic, 4), imagesPos: (v) => (Array.isArray(v) ? v.slice(0, 4).map((x) => pos(x, 0) ?? null) : undefined),
      styles: stylesOf("title", "text", "eyebrow"),
    }, () => ({ image: "", title: E(), text: E(), button: E(), link: "" })), 12),
    height: oneOf("normal", "tall"),
  },
  ribbon: { items: list((v) => bi()(v ?? "", 0), 40), background: color, color },
  chips: { items: list(obj({ label: bi(), color, link }, () => ({ label: E(), color: "", link: "" })), 24), align: oneOf("start", "center", "end"), tilt: bool, size: oneOf("sm", "md", "lg") },
  newsletter: {
    title: bi(), accentWord: bi(), text: para, button: bi(), placeholder: bi(), thanks: para, background: color, accent: color, buttonColor: color,
    after: oneOf("message", "link", "popup"), link,
    popup: obj({ title: bi(), text: para, button: bi(), background: color, accent: color, image: pic, imagePos: pos }, () => ({ title: E(), text: E(), button: E(), background: "", accent: "" })),
  },
  slides: { slides: list(obj({ image: pic, link, pos }, () => ({ image: "", link: "" })), 20), autoplay: bool, seconds, ratio: oneOf("wide", "standard") },
  collection: { title: bi(), productIds: list(productId, 48), count: num(0, 48, true), columns: oneOf(2, 3, 4), link, background: color, color },
  reviews: { title: bi(), items: list(obj({ name: text(80), text: text(1500), stars: oneOf(1, 2, 3, 4, 5) }, () => ({ name: "", text: "", stars: 5 })), 50) },
  text: {
    title: bi(), body: para, align: oneOf("start", "center"), tint: bool, style: oneOf("plain", "statement"), eyebrow: bi(), button: bi(), link, trust: list((v) => bi()(v ?? "", 0), 8),
    sizes: sizesOf("title", "body", "eyebrow", "button"), colors: colorsOf("title", "body", "eyebrow", "button"), styles: stylesOf("title", "body", "eyebrow"),
  },
  products: { title: bi(), columns: oneOf(2, 3, 4), showFilters: bool, limit: num(0, 500, true) },
};

/* A section of each kind as the designer adds it: what a saved section is missing comes from here */
const starters: Record<SectionType, (id: string) => SectionConfig | undefined> = {
  hero: () => defaultConfig.sections.find((s) => s.type === "hero"),
  perks: () => defaultConfig.sections.find((s) => s.type === "perks"),
  featured: () => defaultConfig.sections.find((s) => s.type === "featured"),
  discounts: () => defaultConfig.sections.find((s) => s.type === "discounts"),
  products: () => defaultConfig.sections.find((s) => s.type === "products"),
  reviews: () => defaultConfig.sections.find((s) => s.type === "reviews"),
  text: newTextSection,
  collection: newCollection,
  slides: newSlides,
  tiles: newTiles,
  banners: newBanners,
  ribbon: newRibbon,
  chips: newChips,
  newsletter: newNewsletter,
};

/** One section, or undefined when it is not a section of a known kind. Settings it is missing come from a new section of its kind. */
export function sanitizeSection(v: unknown, i = 0): SectionConfig | undefined {
  if (!isObj(v) || typeof v.type !== "string" || !Object.prototype.hasOwnProperty.call(shapes, v.type)) return undefined;
  const type = v.type as SectionType;
  const sid = (id(v.id, i) as string | undefined) ?? `${type}-${i}`;
  const raw = isObj(v.settings) ? v.settings : {};
  /* An old hero had one background color */
  const legacy = type === "hero" && typeof raw.background === "string" && !Array.isArray(raw.backgrounds) ? { backgrounds: [{ kind: "color", color: safeDesignColor(raw.background) ?? "", image: "" }] } : {};
  const clean = obj(shapes[type] as Record<string, Spec>)({ ...raw, ...legacy }, i) as Obj;
  const start = (JSON.parse(JSON.stringify(starters[type](sid)?.settings ?? {})) as Obj);
  /* A list the starter fills with samples stays empty when the saved one was emptied on purpose */
  return { id: sid, type, visible: v.visible !== false, settings: { ...start, ...clean } } as SectionConfig;
}

/** The sections of a page: known kinds only, at most 60, each id once. */
export function sanitizeSections(v: unknown): SectionConfig[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: SectionConfig[] = [];
  v.slice(0, 60).forEach((x, i) => {
    const s = sanitizeSection(x, i);
    if (!s) return;
    let sid = s.id;
    for (let k = 2; seen.has(sid); k++) sid = `${s.id}-${k}`;
    seen.add(sid);
    out.push({ ...s, id: sid });
  });
  return out;
}

type Top = { [K in keyof Required<StorefrontConfig>]: Spec };
const top: Top = {
  drawer: obj({ items: list(obj({ kind: oneOf("categories", "pages", "links", "custom"), visible: bool }), 8), custom: list(tab, 30) }),
  theme: obj({
    primary: color, background: color, text: color, titleColor: color, radius: oneOf("none", "md", "xl"), font: oneOf(...themeFonts), headingFont: oneOf("", ...themeFonts),
    accent: color, titleStyle: oneOf("bold", "light", "pop", "ornament"), hairlines: bool, prices: oneOf("auto", "ar", "en"), sectionTitleSize: size,
    titleAlign: oneOf("start", "center"), spacing: oneOf("normal", "airy"), saleColor: color,
  }),
  nav: obj({
    style: oneOf("button", "links", "pill"),
    links: list((v) => (isObj(v) ? { en: cleanWords(v.en, 120) ?? "", ar: cleanWords(v.ar, 120) ?? "", ...(link(v.to, 0) !== undefined ? { to: link(v.to, 0) } : {}), ...(color(v.color, 0) !== undefined ? { color: color(v.color, 0) } : {}) } : undefined), 20),
    activeColor: color, cartColor: color, place: oneOf("below", "start"), cartLook: oneOf("icon", "text"),
  }),
  texture: obj({ pattern: (v) => (v === true ? "stars" : v === false ? "none" : oneOf("none", "stars", "dots", "lines", "diamonds", "waves")(v, 0)), watermark: bi(80), area: oneOf("all", "below", "top"), strength: oneOf("light", "medium", "strong"), fade: bool }),
  header: obj({ showMenu: bool, showSearch: bool, showUser: bool, showCart: bool, showLanguage: bool, sticky: bool }),
  identity: obj({
    showLogo: bool, align: oneOf("start", "center"), logo: obj({ kind: oneOf("auto", "letter", "sample", "image"), sample: oneOf("shop", "bag", "star", "heart", "leaf", "bolt"), image: pic }),
    favicon: pic, nameFont: heroFont, nameColor: color, tagline: bi(160),
  }),
  sections: sanitizeSections,
  pageBackground: obj({ kind: oneOf("none", "image", "video"), media: (v) => (typeof v === "string" && /^[\w:.-]{0,120}$/.test(v) ? v : undefined), name: text(160), size: num(0, 1e10, true), veil: num(0, 90), pos }),
  announcement: obj({
    show: bool, motion: oneOf("fade", "ticker"), seconds,
    messages: list(obj({ text: bi(300), link, color, textColor: color }, () => ({ text: E(), link: "", color: "#004956", textColor: "" })), 6),
    /* a bar saved by an older version had one message with its own link and color (see mergeAnnouncement) */
    text: bi(300), link, color,
  }),
  cards: obj({
    showName: bool, showCategory: bool, showPrice: bool, showOldPrice: bool, showBadge: bool, showStock: bool, showHeart: bool, showAdd: bool, openPage: bool, showNotes: bool,
    image: oneOf("portrait", "square", "wide"), style: oneOf("shadow", "outline", "flat", "pop"), info: oneOf("stack", "row", "center"), add: oneOf("wide", "plus"), priceColor: color, addColor: color,
  }),
  texts: obj({ search: bi(80), viewAll: bi(80), allFilter: bi(80), noProducts: bi(200) }),
  footer: obj({
    showLogo: bool, showLinks: bool, showContact: bool, showSocial: bool, tabs: list(tab, 30), columns: list(column, 12), sizes: sizesOf("title", "text", "name"),
    labels: obj({ pages: bi(80), contact: bi(80), follow: bi(80), licenses: bi(80) }, () => ({ pages: E(), contact: E(), follow: E(), licenses: E() })),
    style: oneOf("full", "simple"), background: color, text: color, about: para, email: text(160), address: bi(400), whatsapp: text(120), telegram: text(120),
    certificate: obj({ kind: oneOf("commercial", "license", "other"), number: text(80), url: link, logo: pic, label: text(120) }),
    social: obj({ instagram: social, facebook: social, x: social, youtube: social, snapchat: social, tiktok: social }),
  }),
};

/** A design (whole, or the parts a theme look keeps) with only valid parts. What is dropped is filled from the starter design
    when the design is loaded (storage.ts merge). Never throws. */
export function sanitizeDesign(v: unknown): Partial<StorefrontConfig> {
  if (!isObj(v)) return {};
  const out: Obj = {};
  for (const k of Object.keys(top) as (keyof Top)[]) {
    const x = top[k](v[k], 0);
    if (x !== undefined) out[k] = x;
  }
  /* An empty list of sections means "not set": the starter's sections are used */
  if (Array.isArray(out.sections) && !out.sections.length && !(Array.isArray(v.sections) && !v.sections.length)) delete out.sections;
  return out as Partial<StorefrontConfig>;
}

/* ------------------------------ pages ------------------------------ */

/** The store's own pages (InfoPages): each with a number id, its words and its sections checked. Entries that are not pages go. */
export function sanitizePages(v: unknown): unknown[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.slice(0, 200).flatMap((p) => {
    if (!isObj(p)) return [];
    const pid = num(-1e12, 1e12, true)(p.id, 0);
    if (pid === undefined) return [];
    const sections = sanitizeSections(p.sections);
    return [{
      id: pid,
      type: oneOf(0, 1, 2)(p.type, 0) ?? 0,
      published: p.published !== false,
      footer: p.footer === true,
      title: bi(200)(p.title ?? "", 0),
      content: bi(20000)(p.content ?? "", 0),
      created: num(0, 1e14, true)(p.created, 0) ?? 0,
      ...(sections ? { sections } : {}),
    }];
  });
}
