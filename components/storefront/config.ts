/* The contract between the starter storefront and the store designer.
   Plain JSON only: the designer edits this object, the storefront renders it. */

export type Bi = { en: string; ar: string };

export type PerkIcon = "truck" | "shield" | "returns" | "gift" | "clock" | "chat";
/* "image" means a picture the merchant uploaded (a small data URL kept in this browser) */
/* A customer review the merchant enters himself: his customers' real words, in one language */
export type Review = { name: string; text: string; stars: 1 | 2 | 3 | 4 | 5 };

/* One message of the bar above the header. Each has its own colors: "" for the text color means automatic. */
export type AnnouncementMessage = { text: Bi; link: string; color: string; textColor: string };

export type Perk = { title: Bi; desc: Bi; icon: PerkIcon | "image"; image?: string };

export type MarkKey = "shop" | "bag" | "star" | "heart" | "leaf" | "bolt";
/* "auto" uses the logo from the store setup, or the first letter when there is none */
export type LogoConfig = { kind: "auto" | "letter" | "sample" | "image"; sample: MarkKey; image: string };

/* One background of the hero banner: a color ("" means the store color) or a picture kept in this browser */
export type HeroBg = { kind: "color" | "image"; color: string; image: string };

/* One picture (or GIF) of the animated-pictures element, with an optional link */
export type Slide = { image: string; link: string };

/* One picture tile of the picture-tiles element: a picture, an optional name on it, and an optional link.
   `chip` is the color of the frosted label (editorial style). */
export type Tile = { image: string; label: Bi; link: string; chip?: "light" | "dark" };

/* The fonts a merchant can pick, and the extra display fonts a banner title can use */
export type ThemeFont = "readex" | "plex" | "elegant" | "cairo" | "tajawal";
/* The font of the hero title: "" follows the titles font of the store */
export type HeroFont = "" | ThemeFont | "ruqaa" | "lemonada" | "amiri";
/* The faint pattern behind the page */
export type PatternKey = "none" | "stars" | "dots" | "lines" | "diamonds" | "waves";
export type DisplayFont = "default" | "ruqaa" | "lemonada" | "amiri";

/* One promo banner: a picture with a title, a line of text and a button laid over it. Without a `panel` the text sits
   straight on the picture; with one it sits on a frosted panel that can go in any corner and never covers the middle. */
export type Banner = {
  image: string;
  title: Bi;
  text: Bi;
  button: Bi;
  link: string;
  eyebrow?: Bi;
  font?: DisplayFont;
  titleColor?: string;
  panel?: "light" | "dark" | "none";
  position?: "top-start" | "top-end" | "bottom-start" | "bottom-end";
  buttonStyle?: "filled" | "outline";
  accent?: string;
  /* The font of the eyebrow and the small text of the banner */
  textFont?: DisplayFont;
  /* Text sizes in pixels, set with the + and - buttons (empty: the theme's own size) */
  titleSize?: number;
  textSize?: number;
  /* The color of the small line and of the text under the title (empty: the panel's own) */
  eyebrowColor?: string;
  textColor?: string;
  /* A color of his own for the frosted panel (otherwise light or dark follows `panel`) */
  panelColor?: string;
};

export type SectionConfig =
  | { id: string; type: "hero"; visible: boolean; settings: { title: Bi; subtitle: Bi; button: Bi; backgrounds: HeroBg[]; autoplay: boolean; seconds: number; showCards: boolean; layout?: "banner" | "split"; photo?: string; photoSide?: "start" | "end"; eyebrow?: Bi; price?: string; size?: Bi; button2?: Bi; panelColor?: string; fullWidth?: boolean; titleFont?: HeroFont; colors?: { title?: string; subtitle?: string; eyebrow?: string; price?: string; detail?: string; button?: string }; sizes?: { title?: number; subtitle?: number; eyebrow?: number; price?: number; detail?: number; button?: number } } }
  | { id: string; type: "perks"; visible: boolean; settings: { items: Perk[] } }
  | { id: string; type: "featured"; visible: boolean; settings: { title: Bi; count: number } }
  | { id: string; type: "discounts"; visible: boolean; settings: { title: Bi; count: number } }
  | { id: string; type: "tiles"; visible: boolean; settings: { title: Bi; items: Tile[]; columns: 3 | 4 | 5; style?: "classic" | "editorial" } }
  | { id: string; type: "banners"; visible: boolean; settings: { items: Banner[]; height?: "normal" | "tall" } }
  | { id: string; type: "ribbon"; visible: boolean; settings: { items: Bi[]; background: string; color: string } }
  | { id: string; type: "slides"; visible: boolean; settings: { slides: Slide[]; autoplay: boolean; seconds: number; ratio: "wide" | "standard" } }
  | { id: string; type: "collection"; visible: boolean; settings: { title: Bi; productIds: number[]; count: number; columns: 2 | 3 | 4 } }
  | { id: string; type: "reviews"; visible: boolean; settings: { title: Bi; items: Review[] } }
  | { id: string; type: "text"; visible: boolean; settings: { title: Bi; body: Bi; align: "start" | "center"; tint: boolean } }
  | { id: string; type: "products"; visible: boolean; settings: { title: Bi; columns: 2 | 3 | 4; showFilters: boolean; limit?: number } };

export type SectionType = SectionConfig["type"];

export type StorefrontConfig = {
  theme: {
    /* "" means: use the color the merchant picked when he set up the store */
    primary: string;
    background: string;
    text: string;
    /* "" means the same color as the text */
    titleColor: string;
    radius: "none" | "md" | "xl";
    font: ThemeFont;
    /* The font of titles ("" means the same as the text) */
    headingFont: ThemeFont | "";
    /* A second color for small accents: eyebrows, "view all" links, the pattern ("" means the store color) */
    accent: string;
    titleStyle: "bold" | "light";
    /* The size of the titles of the sections ("Collections", "Best sellers" ...) */
    sectionTitleSize?: number;
    spacing: "normal" | "airy";
  };
  /* The header's menu: a button that opens the side menu, or a row of links in the middle of the header */
  /* A link can go to a part of the page: `to` is the id of a section, or "footer" (the contact details) */
  nav: { style: "button" | "links"; links: (Bi & { to?: string })[] };
  /* A faint pattern behind the page and a big word behind the picture tiles, both in the accent color */
  texture: { pattern: PatternKey; watermark: Bi };
  /* showLanguage: a button in the header that lets visitors switch the store between Arabic and English. Off by default:
     when he turns it on he must write his titles and texts in the other language too. */
  header: { showMenu: boolean; showSearch: boolean; showUser: boolean; showCart: boolean; showLanguage: boolean; sticky: boolean };
  /* favicon: the small icon in the browser tab, a small data URL kept in this browser */
  identity: { showLogo: boolean; align: "start" | "center"; logo: LogoConfig; favicon: string };
  sections: SectionConfig[];
  /* A picture, GIF or looping video behind the whole page. The file itself is kept in the browser's
     media storage under `media`. `veil` is how much of the page color covers it, so text stays readable. */
  pageBackground: { kind: "none" | "image" | "video"; media: string; name: string; size: number; veil: number };
  /* A thin bar above the header with a short message */
  announcement: { show: boolean; messages: AnnouncementMessage[]; motion: "fade" | "ticker"; seconds: number };
  /* What each product card shows */
  cards: {
    showName: boolean;
    showCategory: boolean;
    showPrice: boolean;
    showOldPrice: boolean;
    showBadge: boolean;
    showStock: boolean;
    showHeart: boolean;
    showAdd: boolean;
    /* The product's notes line (for example "rose · musk · incense") */
    showNotes: boolean;
    image: "portrait" | "square" | "wide";
    style: "shadow" | "outline" | "flat";
    /* "row" puts the name on one side and the price on the other */
    info: "stack" | "row";
  };
  /* Words the store uses in small places. An empty text falls back to the built-in wording. */
  texts: { search: Bi; viewAll: Bi; allFilter: Bi; noProducts: Bi };
  footer: {
    showLogo: boolean;
    showLinks: boolean;
    showContact: boolean;
    showSocial: boolean;
    /* Footer colors ("" means a soft tint of the store color) */
    background: string;
    text: string;
    about: Bi;
    email: string;
    address: Bi;
    whatsapp: string;
    telegram: string;
    /* The store's registration, shown as a small badge. It is what the merchant writes; nothing checks it. */
    /* `label` is what he writes when the kind is "other": the name of that registration or license */
    certificate: { kind: "commercial" | "license" | "other"; number: string; url: string; logo: string; label: string };
    social: { instagram: string; facebook: string; x: string; youtube: string; snapchat: string; tiktok: string };
  };
};

const none: Bi = { en: "", ar: "" };

export const defaultConfig: StorefrontConfig = {
  theme: { primary: "", background: "#fafaf8", text: "#12262b", titleColor: "", radius: "xl", font: "readex", headingFont: "", accent: "", titleStyle: "bold", spacing: "normal" },
  nav: { style: "button", links: [] },
  texture: { pattern: "none", watermark: { en: "", ar: "" } },
  header: { showMenu: true, showSearch: true, showUser: true, showCart: true, showLanguage: false, sticky: true },
  identity: { showLogo: true, align: "start", logo: { kind: "auto", sample: "shop", image: "" }, favicon: "" },
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      settings: {
        title: { en: "Everything you love, in one place", ar: "كل ما تحبه في مكان واحد" },
        subtitle: { en: "Fresh picks, fair prices and quick delivery across Jordan.", ar: "منتجات مختارة بعناية وأسعار عادلة وتوصيل سريع في كل أنحاء الأردن." },
        button: { en: "Shop now", ar: "تسوّق الآن" },
        backgrounds: [{ kind: "color", color: "", image: "" }],
        autoplay: true,
        seconds: 5,
        showCards: true,
        layout: "banner",
        photo: "",
        photoSide: "start",
      },
    },
    {
      id: "perks",
      type: "perks",
      visible: true,
      settings: {
        items: [
          { icon: "truck", title: { en: "Fast delivery", ar: "توصيل سريع" }, desc: { en: "Across Jordan", ar: "لكل مناطق الأردن" } },
          { icon: "shield", title: { en: "Secure payment", ar: "دفع آمن" }, desc: { en: "Cards, CliQ or cash", ar: "بطاقة أو كليك أو نقدًا" } },
          { icon: "returns", title: { en: "Easy returns", ar: "إرجاع سهل" }, desc: { en: "Within 7 days", ar: "خلال 7 أيام" } },
        ],
      },
    },
    { id: "featured", type: "featured", visible: true, settings: { title: { en: "Featured picks", ar: "منتجات مميزة" }, count: 4 } },
    { id: "discounts", type: "discounts", visible: true, settings: { title: { en: "Deals this week", ar: "تخفيضات الأسبوع" }, count: 4 } },
    { id: "products", type: "products", visible: true, settings: { title: { en: "All products", ar: "كل المنتجات" }, columns: 4, showFilters: true } },
    /* Starts with no reviews, so a new store never shows invented ones */
    { id: "reviews", type: "reviews", visible: true, settings: { title: { en: "Customer reviews", ar: "آراء العملاء" }, items: [] } },
  ],
  pageBackground: { kind: "none", media: "", name: "", size: 0, veil: 60 },
  announcement: {
    show: false,
    messages: [{ text: { en: "Write a short message for your visitors here", ar: "اكتب هنا رسالة قصيرة لزوّار متجرك" }, link: "", color: "#004956", textColor: "" }],
    motion: "fade",
    seconds: 4,
  },
  cards: { showName: true, showCategory: true, showPrice: true, showOldPrice: true, showBadge: true, showStock: false, showHeart: true, showAdd: true, showNotes: false, image: "portrait", style: "shadow", info: "stack" },
  texts: { search: { ...none }, viewAll: { ...none }, allFilter: { ...none }, noProducts: { ...none } },
  footer: {
    showLogo: true,
    showLinks: true,
    showContact: true,
    showSocial: true,
    background: "",
    text: "",
    about: { ...none },
    email: "",
    /* Every store is in Jordan, so the address starts as Jordan. He can add a city or street. */
    address: { en: "Jordan", ar: "الأردن" },
    whatsapp: "",
    telegram: "",
    certificate: { kind: "commercial", number: "", url: "", logo: "", label: "" },
    social: { instagram: "", facebook: "", x: "", youtube: "", snapchat: "", tiktok: "" },
  },
};

export const radiusValue: Record<StorefrontConfig["theme"]["radius"], string> = { none: "0px", md: "12px", xl: "24px" };

/* A new free-text element starts with a friendly welcome. The merchant can write his own or pick a sample. */
export function newTextSection(id: string): SectionConfig {
  return {
    id,
    type: "text",
    visible: true,
    settings: {
      title: { en: "Welcome to our store", ar: "أهلًا بك في متجرنا" },
      body: { en: "Write something here: who you are, what you sell, or a message for your customers.", ar: "اكتب هنا ما تريد: من أنتم، وماذا تبيعون، أو رسالة لعملائكم." },
      align: "center",
      tint: false,
    },
  };
}

/* A new product collection: the merchant names it and picks the products and how many show. */
export function newCollection(id: string): SectionConfig {
  return { id, type: "collection", visible: true, settings: { title: { en: "Pinned products", ar: "منتجات ثابتة" }, productIds: [], count: 4, columns: 4 } };
}

/* A new animated-pictures element starts empty: he adds his own pictures or GIFs. */
export function newSlides(id: string): SectionConfig {
  return { id, type: "slides", visible: true, settings: { slides: [], autoplay: true, seconds: 5, ratio: "wide" } };
}

/* The fonts a merchant can pick for his store. "" means the platform's own font (Readex Pro). The others are loaded
   in the app layout (all are open-licensed) and used through these CSS variables. */
export const fontFamily: Record<ThemeFont, string> = {
  readex: "var(--font-sans), sans-serif",
  plex: "var(--font-plex), var(--font-sans), sans-serif",
  elegant: "var(--font-elegant-latin), var(--font-elegant-ar), Georgia, serif",
  cairo: "var(--font-cairo), sans-serif",
  tajawal: "var(--font-tajawal), sans-serif",
};

/* A new picture-tiles element starts empty: he adds his own pictures. */
export function newTiles(id: string): SectionConfig {
  return { id, type: "tiles", visible: true, settings: { title: { en: "", ar: "" }, items: [], columns: 4 } };
}

/* A new promo-banners element starts with one banner he can fill in. */
export function newBanners(id: string): SectionConfig {
  return {
    id,
    type: "banners",
    visible: true,
    settings: {
      items: [
        { image: "", title: { en: "New collection", ar: "مجموعة جديدة" }, text: { en: "Discover what is new in our store.", ar: "اكتشف الجديد في متجرنا." }, button: { en: "Shop now", ar: "تسوّق الآن" }, link: "" },
      ],
    },
  };
}

/* The expressive fonts a banner title can use. "default" is the titles font of the store. */
export const displayFamily: Record<DisplayFont, string> = {
  default: "var(--sf-heading)",
  ruqaa: "var(--font-ruqaa), var(--font-elegant-ar), serif",
  lemonada: "var(--font-lemonada), var(--font-sans), sans-serif",
  amiri: "var(--font-elegant-ar), serif",
};

/* A new notes ribbon: a dark strip of short words (the notes of the perfumes, the materials, the sizes ...) */
export function newRibbon(id: string): SectionConfig {
  return {
    id,
    type: "ribbon",
    visible: true,
    settings: { items: [{ en: "Oud", ar: "عود" }, { en: "Amber", ar: "عنبر" }, { en: "Rose", ar: "ورد" }, { en: "Musk", ar: "مسك" }], background: "#16120f", color: "#c9a46a" },
  };
}

/* The font family of the hero title. Empty: the titles font of the store. */
export function heroTitleFamily(key?: HeroFont): string {
  if (!key) return "var(--sf-heading)";
  if (key === "ruqaa" || key === "lemonada" || key === "amiri") return displayFamily[key];
  return fontFamily[key];
}
