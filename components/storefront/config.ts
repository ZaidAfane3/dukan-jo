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

export type SectionConfig =
  | { id: string; type: "hero"; visible: boolean; settings: { title: Bi; subtitle: Bi; button: Bi; backgrounds: HeroBg[]; autoplay: boolean; seconds: number; showCards: boolean } }
  | { id: string; type: "perks"; visible: boolean; settings: { items: Perk[] } }
  | { id: string; type: "featured"; visible: boolean; settings: { title: Bi; count: number } }
  | { id: string; type: "discounts"; visible: boolean; settings: { title: Bi; count: number } }
  | { id: string; type: "slides"; visible: boolean; settings: { slides: Slide[]; autoplay: boolean; seconds: number; ratio: "wide" | "standard" } }
  | { id: string; type: "collection"; visible: boolean; settings: { title: Bi; productIds: number[]; count: number; columns: 2 | 3 | 4 } }
  | { id: string; type: "reviews"; visible: boolean; settings: { title: Bi; items: Review[] } }
  | { id: string; type: "text"; visible: boolean; settings: { title: Bi; body: Bi; align: "start" | "center"; tint: boolean } }
  | { id: string; type: "products"; visible: boolean; settings: { title: Bi; columns: 2 | 3 | 4; showFilters: boolean } };

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
    font: "readex";
  };
  header: { showMenu: boolean; showSearch: boolean; showUser: boolean; showCart: boolean; sticky: boolean };
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
    image: "portrait" | "square" | "wide";
    style: "shadow" | "outline" | "flat";
  };
  /* Words the store uses in small places. An empty text falls back to the built-in wording. */
  texts: { search: Bi; viewAll: Bi; allFilter: Bi; noProducts: Bi };
  footer: {
    showLogo: boolean;
    showLinks: boolean;
    showContact: boolean;
    showSocial: boolean;
    about: Bi;
    email: string;
    address: Bi;
    whatsapp: string;
    telegram: string;
    /* The store's registration, shown as a small badge. It is what the merchant writes; nothing checks it. */
    certificate: { kind: "commercial" | "license" | "other"; number: string; url: string; logo: string };
    social: { instagram: string; facebook: string; x: string; youtube: string; snapchat: string; tiktok: string };
  };
};

const none: Bi = { en: "", ar: "" };

export const defaultConfig: StorefrontConfig = {
  theme: { primary: "", background: "#fafaf8", text: "#12262b", titleColor: "", radius: "xl", font: "readex" },
  header: { showMenu: true, showSearch: true, showUser: true, showCart: true, sticky: true },
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
  cards: { showName: true, showCategory: true, showPrice: true, showOldPrice: true, showBadge: true, showStock: false, showHeart: true, showAdd: true, image: "portrait", style: "shadow" },
  texts: { search: { ...none }, viewAll: { ...none }, allFilter: { ...none }, noProducts: { ...none } },
  footer: {
    showLogo: true,
    showLinks: true,
    showContact: true,
    showSocial: true,
    about: { ...none },
    email: "",
    /* Every store is in Jordan, so the address starts as Jordan. He can add a city or street. */
    address: { en: "Jordan", ar: "الأردن" },
    whatsapp: "",
    telegram: "",
    certificate: { kind: "commercial", number: "", url: "", logo: "" },
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
