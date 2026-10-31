import { sanitizeDesign, sanitizePages } from "../safeDesign";
import { content } from "../content";
import { loadSetup } from "../setup";
import { ANNOUNCE_MESSAGES_MAX, defaultConfig, relinkPages, type Bi, type PageRef, type SectionConfig, type StorefrontConfig } from "./config";

/* The merchant's design, kept in this browser. Missing parts fall back to the starter design,
   so a design saved by an older version still loads after new options are added.

   There are two starter versions:
   - the ORIGINAL design, which is the one written in the code (`defaultConfig`) and never changes;
   - the TEMPLATE, an editable copy the platform admin can change and save (in /design?template=1).
     A store that has not saved a design of its own starts from the template, if there is one:
     the template is the default design of every new store. The admin edits it at /design?template=1. */
const KEY = "seen-storefront";
const TEMPLATE_KEY = "dukkan-template";

/* Sections saved by an older version miss settings that were added later. */
function upgrade(sec: SectionConfig): SectionConfig {
  const base = defaultConfig.sections.find((d) => d.type === sec.type);
  if (!base) return sec;
  const merged = { ...base.settings, ...sec.settings } as Record<string, unknown>;
  /* The hero used to have one background color. It is now a list of backgrounds. */
  const old = (sec.settings as Record<string, unknown>).background;
  if (sec.type === "hero" && !Array.isArray((sec.settings as Record<string, unknown>).backgrounds)) {
    merged.backgrounds = [{ kind: "color", color: typeof old === "string" ? old : "", image: "" }];
  }
  return { ...sec, settings: merged } as SectionConfig;
}

/* A bar saved by an older version had one message with its own link and color */
function mergeAnnouncement(saved: unknown): StorefrontConfig["announcement"] {
  const d = defaultConfig.announcement;
  const a = (saved ?? {}) as Record<string, unknown>;
  const base = d.messages[0];
  const list = Array.isArray(a.messages) && a.messages.length
    ? (a.messages as Partial<typeof base>[])
    : a.text ? [{ text: a.text as typeof base.text, link: typeof a.link === "string" ? a.link : "", color: typeof a.color === "string" ? a.color : base.color }] : d.messages;
  return {
    show: typeof a.show === "boolean" ? a.show : d.show,
    motion: a.motion === "ticker" ? "ticker" : "fade",
    seconds: typeof a.seconds === "number" ? a.seconds : d.seconds,
    ...(a.speed === "slow" || a.speed === "normal" || a.speed === "fast" ? { speed: a.speed } : {}),
    messages: list.slice(0, ANNOUNCE_MESSAGES_MAX).map((m) => ({ ...base, ...m, text: { ...base.text, ...m.text } })),
  };
}

/* A design saved before there was a choice of patterns has true (the stars) or false (none) */
function patternOf(v: unknown): StorefrontConfig["texture"]["pattern"] {
  if (v === true) return "stars";
  return typeof v === "string" && ["stars", "dots", "lines", "diamonds", "waves"].includes(v) ? (v as StorefrontConfig["texture"]["pattern"]) : "none";
}

/* A design saved before the store menu could be arranged gets the default one; a kind that is missing is added at the end */
function mergeDrawer(saved: unknown): StorefrontConfig["drawer"] {
  const items = Array.isArray((saved as { items?: unknown } | undefined)?.items) ? ((saved as { items: StorefrontConfig["drawer"]["items"] }).items) : [];
  const out = items.filter((x) => x && ["categories", "pages", "links", "custom"].includes(x.kind)).map((x) => ({ kind: x.kind, visible: x.visible !== false }));
  for (const d of defaultConfig.drawer.items) if (!out.some((x) => x.kind === d.kind)) out.push({ ...d });
  const custom = (saved as { custom?: unknown } | undefined)?.custom;
  return { items: out, custom: Array.isArray(custom) ? (custom as NonNullable<StorefrontConfig["drawer"]["custom"]>) : [] };
}

function merge(s: Partial<StorefrontConfig>): StorefrontConfig {
  return {
    drawer: mergeDrawer(s.drawer),
    theme: { ...defaultConfig.theme, ...s.theme },
    header: { ...defaultConfig.header, ...s.header },
    nav: { ...defaultConfig.nav, ...s.nav },
    texture: { ...defaultConfig.texture, ...s.texture, pattern: patternOf(s.texture?.pattern), watermark: { ...defaultConfig.texture.watermark, ...s.texture?.watermark } },
    identity: { ...defaultConfig.identity, ...s.identity, logo: { ...defaultConfig.identity.logo, ...s.identity?.logo } },
    footer: { ...defaultConfig.footer, ...s.footer, social: { ...defaultConfig.footer.social, ...s.footer?.social }, certificate: { ...defaultConfig.footer.certificate, ...s.footer?.certificate } },
    announcement: mergeAnnouncement(s.announcement),
    pageBackground: { ...defaultConfig.pageBackground, ...s.pageBackground },
    cards: { ...defaultConfig.cards, ...s.cards },
    cart: { style: s.cart?.style ?? defaultConfig.cart?.style ?? "drawer" },
    productPage: { style: s.productPage?.style ?? defaultConfig.productPage?.style ?? "classic" },
    texts: { ...defaultConfig.texts, ...s.texts },
    /* a page he emptied on purpose stays empty (the designer asks before saving one); only a design with no list at all gets the starter blocks */
    sections: Array.isArray(s.sections) ? s.sections.map(upgrade) : defaultConfig.sections,
  };
}

function read(key: string): StorefrontConfig | null {
  try {
    const raw = localStorage.getItem(key);
    /* A saved design is checked before it is used: it may have been changed by hand (see safeDesign.ts) */
    return raw ? merge(sanitizeDesign(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
}

/** The platform's template: what new stores start from. Null when the admin has not made one. */
export const loadTemplate = () => read(TEMPLATE_KEY);

/* The store's own pages as saved (see InfoPages). Null when he has none saved yet: then only a theme's sample pages count as missing. */
function savedPages(): PageRef[] | null {
  try {
    const raw = localStorage.getItem("seen-pages");
    return raw ? ((sanitizePages(JSON.parse(raw)) ?? null) as PageRef[] | null) : null;
  } catch {
    return null;
  }
}

/** A merchant's own design, or the template (or original) when he has not saved one. A design saved with links to pages his store
    does not have (a theme's sample pages, a page he deleted) has them led to his own pages, or to his products (see relinkPages). */
export function loadConfig(): StorefrontConfig {
  const own = read(KEY);
  return withDeliveryLine(own ? relinkPages(own, savedPages()) : loadTemplate() ?? defaultConfig);
}

/* The line under a delivery perk that Dukkan wrote (he never changed it) follows how the store delivers: with Dukkan's delivery,
   the cities it reaches (the list of the delivery setup); with his own delivery, or none chosen yet, no city at all. */
const cityList = (l: string[], and: string, comma: string) => (l.length > 1 ? `${l.slice(0, -1).join(comma)}${and}${l[l.length - 1]}` : l[0] ?? "");
const dukkanCities = (): Bi => ({ en: cityList(content.en.onboarding.shipping.cities, " and ", ", "), ar: content.ar.onboarding.shipping.cities.join(" و") });
const anyCity: Bi = { en: "Straight to your door", ar: "حتى باب بيتك" };
function withDeliveryLine(cfg: StorefrontConfig): StorefrontConfig {
  const stock = [{ en: "Irbid, Amman and Salt", ar: "إربد وعمّان والسلط" }, dukkanCities(), anyCity];
  const ours = (d?: Bi) => !!d && stock.some((x) => x.en === d.en && x.ar === d.ar);
  if (!cfg.sections.some((s) => s.type === "perks" && s.settings.items.some((p) => ours(p.desc)))) return cfg;
  const line = loadSetup()?.shipping?.mode === "seen" ? dukkanCities() : anyCity;
  return { ...cfg, sections: cfg.sections.map((s) => (s.type === "perks" ? { ...s, settings: { ...s.settings, items: s.settings.items.map((p) => (ours(p.desc) ? { ...p, desc: { ...line } } : p)) } } : s)) };
}

/** Returns false when the browser could not keep it (for example, too many large pictures). */
function write(key: string, config: StorefrontConfig): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(merge(sanitizeDesign(config))));
    return true;
  } catch {
    return false;
  }
}

export const saveConfig = (config: StorefrontConfig) => write(KEY, config);

/** Whether customers can see the store: in this prototype, once its design has been saved one time. The designer's badge and the
    dashboard's "Visit store" both ask this, so they always agree; a backend answers it from the store's real published state. */
export function storeIsLive(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** Forgets the store's own design, so the store starts again from the starter template. Used when a new account is created. */
export function resetToStarterDesign() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
export const saveTemplate = (config: StorefrontConfig) => write(TEMPLATE_KEY, config);

export function clearTemplate() {
  try {
    localStorage.removeItem(TEMPLATE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/* Reading and writing a design under any key (used by the private /saad template) */
export const readConfigKey = read;
export const writeConfigKey = write;
