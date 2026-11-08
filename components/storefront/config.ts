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
export type HeroBg = { kind: "color" | "image"; color: string; image: string; /* where the picture sits in the banner */ pos?: PicPos; /* words of its own while it shows (empty: the cover's main words) */ title?: Bi; subtitle?: Bi; button?: Bi; link?: string };

/* One picture (or GIF) of the animated-pictures element, with an optional link */
export type Slide = { image: string; link: string; /* where the picture sits in its frame */ pos?: PicPos };

/* One picture tile of the picture-tiles element: a picture, an optional name on it, and an optional link.
   `chip` is the color of the frosted label (editorial style). */
export type Tile = { /* its own name, so it keeps its place in the designer when the list is reordered */ key?: string; image: string; label: Bi; link: string; chip?: "light" | "dark"; /* where the picture sits in its frame */ pos?: PicPos };

/* The fonts a merchant can pick, and the extra display fonts a banner title can use */
export type ThemeFont = "readex" | "plex" | "elegant" | "cairo" | "tajawal" | "baloo" | "messiri" | "almarai" | "kufi";
/* The font of the hero title: "" follows the titles font of the store */
export type HeroFont = "" | ThemeFont | "ruqaa" | "lemonada" | "amiri";
/* The faint pattern behind the page */
export type PatternKey = "none" | "stars" | "dots" | "lines" | "diamonds" | "waves";

/* The basket's look. "drawer": a panel at the side. "editorial": a sharp, all-caps bag like the big fashion stores.
   "luxe": a whole page with the summary beside the products. "pop": a floating card with bold outlines and hard shadows. */
/* The biggest the hero title can be set (px). Bigger titles broke words and overflowed the cover; the title also shrinks to fit (FitTitle in sections.tsx). */
export const HERO_TITLE_MAX = 120;
/* and never smaller than this, so the cover's main words stay readable */
export const HERO_TITLE_MIN = 20;
/* The footer's text sizes (px): [smallest, biggest]. Bigger looked oversized and broke column titles letter by letter. */
export const FOOTER_SIZES = { title: [10, 24], text: [10, 20], name: [12, 40] } as const;
/* The announcement bar: the longest a message can be (characters) and how many messages it can have. The designer shows both counts. */
export const ANNOUNCE_TEXT_MAX = 90;
export const ANNOUNCE_MESSAGES_MAX = 5;
/* The small line under the store name: the longest it can be (characters); the designer shows the count */
export const TAGLINE_MAX = 40;

export const cartStyles = ["drawer", "editorial", "luxe", "pop"] as const;
export type CartStyle = (typeof cartStyles)[number];
/* The product page's look. "classic": soft rounded panels, clean and modern. "editorial": a tall photo, small capitals and hairlines
   like a fashion magazine. "luxe": a framed photo, centered titles and an ornament, airy. "pop": bold outlines, hard shadows and chunky round buttons. */
export const productPageStyles = ["classic", "editorial", "luxe", "pop"] as const;
/** The orders the all-products page can show its products in */
export const shopSorts = ["newest", "low", "high"] as const;
export type ShopSort = (typeof shopSorts)[number];
export type ProductPageStyle = (typeof productPageStyles)[number];
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
  /* "center": the text sits in the middle of the picture */
  position?: "top-start" | "top-end" | "bottom-start" | "bottom-end" | "center";
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
  /* "card": a card of one color with the small line, the title and a dark button, and the picture in an arch or tilted */
  variant?: "photo" | "card";
  bg?: string;
  shape?: "arch" | "tilt";
  /* where the picture sits in its frame */
  pos?: PicPos;
  /* the size of the small line above the title of a color card */
  eyebrowSize?: number;
  /* more pictures of a color card, shown with the first one as a small overlapping collage (up to 3 more) */
  images?: string[];
  /* where each of those pictures sits in its frame */
  imagesPos?: (PicPos | undefined)[];
  /* how its texts sit and look */
  styles?: { title?: TextStyle; text?: TextStyle; eyebrow?: TextStyle };
};

/* How one text sits and looks, set in the small editor of that text: right, center or left, bold, italic (empty: the theme's) */
export type TextStyle = { align?: "right" | "center" | "left"; bold?: boolean; italic?: boolean };

/* Where a picture sits inside its frame: moved by x and y (percent of the frame) and zoomed. Set by dragging the picture in the designer. */
export type PicPos = { x: number; y: number; zoom: number };

/* moves: the words and pictures he slid sideways in the designer, by their place in the section ("h:0" its first title,
   "p:1" its second line of text, "img:0" its first picture, "btn:0" its first button, "box:0" its first picture made of several pieces, "card:1" the second card of such a group), as a share of the section's width
   (-100 to 100), so they keep their place on a phone and on a computer. Moved up or down too: { x, y } with x that share of the width and
   y in pixels (-600 to 600, + is down). A bare number (saved before he could move up and down) is { x: that, y: 0 }. */
export type SectionMove = { x: number; y: number };
export type SectionMoves = Record<string, number | SectionMove>;
/** a saved move as { x, y }, whichever way it was saved */
export const moveXY = (m: number | SectionMove | undefined): SectionMove => (typeof m === "number" ? { x: m, y: 0 } : m ? { x: Number(m.x) || 0, y: Number(m.y) || 0 } : { x: 0, y: 0 });
/* a picture he edited inside its frame (double-click it in the designer): moved by x and y (a share of its own width and
   height), stretched by sx and sy, turned by r degrees; the frame around it stays where it is */
export type PicEdit = { x: number; y: number; sx: number; sy: number; r: number };
/* the section's own title look (none: the theme's): its size in px, its color and its font */
export type TitleLook = { size?: number; color?: string; font?: HeroFont };

export type SectionConfig = (
  | { id: string; type: "hero"; visible: boolean; settings: { title: Bi; subtitle: Bi; button: Bi; backgrounds: HeroBg[]; autoplay: boolean; seconds: number; showCards: boolean; layout?: "banner" | "split" | "pop" | "orbit"; photo?: string; photoSide?: "start" | "end"; photo2?: string; /* where the two buttons lead (see linkProps in sections.tsx) */ link?: string; link2?: string; photoPos?: PicPos; photo2Pos?: PicPos; sticker?: Bi; accentWord?: Bi; popColors?: { accent?: string; blob?: string; sticker?: string }; eyebrow?: Bi; price?: string; size?: Bi; button2?: Bi; panelColor?: string; fullWidth?: boolean; /* banner cover: where the words sit and how tall it is */ textPos?: "center" | "bottom-start" | "bottom-center"; height?: "normal" | "tall"; /* the cover's own size in px (none: as wide as the page and as tall as its words); unlinked: width and height change on their own, not together */ box?: { width?: number; height?: number; unlinked?: boolean }; titleFont?: HeroFont; /* the products on the cards beside the text (empty: the first ones) */ cardIds?: number[]; /* how those cards look: fanned (default), in a row or one big picture; a white frame or the picture alone; the picture shape; the name under it */ cardLook?: { arrange?: "fan" | "row" | "single"; frame?: "card" | "bare"; shape?: "portrait" | "square" | "round"; showName?: boolean }; styles?: { title?: TextStyle; subtitle?: TextStyle; eyebrow?: TextStyle }; colors?: { title?: string; subtitle?: string; eyebrow?: string; price?: string; detail?: string; button?: string }; sizes?: { title?: number; subtitle?: number; eyebrow?: number; price?: number; detail?: number; button?: number } } }
  | { id: string; type: "perks"; visible: boolean; settings: { items: Perk[]; /* where the icon and words sit in each box: in a row on the left or the right, or stacked in the middle ("start": the side the words begin on, the default) */ align?: "start" | "left" | "center" | "right"; /* the boxes' own background (a color or a gradient) and border (empty: the theme's white box with a faint line) */ cardBg?: string; border?: "none" | "thin" | "thick"; borderColor?: string } }
  | { id: string; type: "featured"; visible: boolean; settings: { title: Bi; count: number; /* the products he picked for it, in his order (none: the ones marked featured) */ productIds?: number[] } }
  | { id: string; type: "discounts"; visible: boolean; settings: { title: Bi; count: number } }
  | { id: string; type: "tiles"; visible: boolean; settings: { title: Bi; items: Tile[]; columns: 3 | 4 | 5 | 6 | 8; /* "circles": round pictures in thin rings, the name under each */ style?: "classic" | "editorial" | "circles" } }
  | { id: string; type: "banners"; visible: boolean; settings: { items: Banner[]; height?: "normal" | "tall" } }
  | { id: string; type: "ribbon"; visible: boolean; settings: { items: Bi[]; background: string; color: string } }
  | { id: string; type: "chips"; visible: boolean; settings: { items: { /* its own name, so it keeps its place in the designer when reordered */ key?: string; label: Bi; color: string; link: string }[]; /* how the row sits: where the buttons gather, whether they are tilted, how big */ align?: "start" | "center" | "end"; tilt?: boolean; size?: "sm" | "md" | "lg" } }
  | { id: string; type: "newsletter"; visible: boolean; settings: { title: Bi; accentWord: Bi; text: Bi; button: Bi; placeholder: Bi; thanks: Bi; background: string; accent: string; buttonColor: string; /* after subscribing: the thank-you message (default) or go to a destination */ after?: "message" | "link" | "popup"; link?: string; /* the pop-up shown after subscribing */ popup?: { title: Bi; text: Bi; button: Bi; background: string; accent: string; image?: string; imagePos?: PicPos; textFont?: HeroFont } } }
  | { id: string; type: "slides"; visible: boolean; settings: { slides: Slide[]; autoplay: boolean; seconds: number; ratio: "wide" | "standard" } }
  | { id: string; type: "collection"; visible: boolean; settings: { title: Bi; productIds: number[]; count: number; columns: 2 | 3 | 4; /* where "view all" leads ("" shows it without a link) */ link?: string; /* a band of its own color across the whole width ("" : none) */ background?: string; color?: string } }
  | { id: string; type: "reviews"; visible: boolean; settings: { title: Bi; items: Review[] } }
  | { id: string; type: "text"; visible: boolean; settings: { title: Bi; body: Bi; align: "start" | "center"; tint: boolean; /* "statement": a centered block with a small line above, a big title, a button and a row of short promises */ style?: "plain" | "statement"; eyebrow?: Bi; button?: Bi; link?: string; trust?: Bi[]; /* text sizes in pixels and colors of their own (empty: the theme's) */ sizes?: { title?: number; body?: number; eyebrow?: number; button?: number }; colors?: { title?: string; body?: string; eyebrow?: string; button?: string }; styles?: { title?: TextStyle; body?: TextStyle; eyebrow?: TextStyle } } }
  | { id: string; type: "products"; visible: boolean; settings: { title: Bi; columns: 2 | 3 | 4; showFilters: boolean; limit?: number; /* which products it shows: all (default), the ones in his chosen categories, or the ones he picked, in his order. Ids and category names only, never copies of products */ source?: "all" | "categories" | "picked"; categories?: string[]; productIds?: number[] } }
) & { moves?: SectionMoves; titleLook?: TitleLook; /* the subtitle's own font (empty: the theme's) */ subFont?: HeroFont; /* by the picture's place in the section ("img:0") */ pics?: Record<string, PicEdit> };

export type SectionType = SectionConfig["type"];

/* What the store menu (the burger button) shows, in this order: the categories, the pages of the store, the links of the header */
/* title: his own name for the group, shown as its heading in the sidebar (empty: the usual one).
   hidden: the items of the group he left out (a category's name, a page's id, a header link's place). */
export type DrawerItem = { kind: "categories" | "pages" | "links" | "custom"; visible: boolean; title?: Bi; hidden?: string[] };

/* A footer link of the merchant's own ("Contact us"): its words, where it leads (see linkProps), and whether it shows */
export type FooterTab = { id: string; label: Bi; link: string; visible: boolean };

/* A column of the footer. The built-in ones ("pages", "contact", "social", "licenses", "about") follow their own data and switches;
   a "custom" one is the merchant's own: a title and his own links. The list is in the order they show. */
export type FooterColumn = { id: string; kind: "about" | "pages" | "contact" | "social" | "licenses" | "custom"; visible: boolean; title?: Bi; links?: FooterTab[] };

const builtinColumns = ["about", "pages", "contact", "social", "licenses"] as const;

/** The columns of a footer in their order. A design saved before columns existed gets the usual five; a missing built-in one is added at the end. */
export function footerColumns(f: { columns?: FooterColumn[] }): FooterColumn[] {
  const out = (f.columns ?? []).filter((x) => x && x.id && ["about", "pages", "contact", "social", "licenses", "custom"].includes(x.kind));
  for (const k of builtinColumns) if (!out.some((x) => x.kind === k)) out.push({ id: k, kind: k, visible: true });
  return out;
}

/** Fills the footer from what the site already has: a "Shop" column with its categories (the colored buttons, or the menu links, or the
    categories of the products), and a "Help" column with the pages of the store. The title of each is picked at random from a few wordings,
    so footers do not all read the same. The built-in columns stay as they are; his own columns are replaced by these. */
export function autoFooterColumns(cfg: StorefrontConfig, lang: "en" | "ar", pages: { id: number; title: string }[], categories: string[] = []): FooterColumn[] {
  const pickOne = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const stamp = Date.now().toString(36);
  const productsId = cfg.sections.find((s) => s.type === "products")?.id ?? cfg.sections.find((s) => s.type === "tiles" || s.type === "featured")?.id ?? "";
  const chips = cfg.sections.find((s) => s.type === "chips");
  const fromChips = chips && chips.type === "chips" ? chips.settings.items.map((x) => ({ label: x.label, link: x.link || productsId })) : [];
  const fromNav = cfg.nav.links.filter((l) => l.to).map((l) => ({ label: { en: l.en, ar: l.ar }, link: l.to as string }));
  const fromProducts = categories.map((name) => ({ label: { en: name, ar: name }, link: productsId }));
  const shop = (fromChips.length ? fromChips : fromNav.length ? fromNav : fromProducts).slice(0, 6);
  const kept = footerColumns(cfg.footer).filter((x) => x.kind !== "custom");
  const out: FooterColumn[] = [...kept];
  if (shop.length) {
    const t = pickOne([{ en: "Shop", ar: "تسوّق" }, { en: "Browse", ar: "تصفّح" }, { en: "Categories", ar: "الأقسام" }, { en: "Discover", ar: "اكتشف" }]);
    out.push({ id: `col-shop-${stamp}`, kind: "custom", visible: true, title: t, links: shop.map((x, i) => ({ id: `lnk-${stamp}-${i}`, label: x.label, link: x.link, visible: true })) });
  }
  if (pages.length) {
    const t = pickOne([{ en: "Help", ar: "مساعدة" }, { en: "Need a hand?", ar: "تحتاج مساعدة؟" }, { en: "Customer care", ar: "خدمة العملاء" }]);
    out.push({ id: `col-help-${stamp}`, kind: "custom", visible: true, title: t, links: pages.slice(0, 5).map((p, i) => ({ id: `lnk-h-${stamp}-${i}`, label: { en: p.title, ar: p.title }, link: `page:${p.id}`, visible: true })) });
  }
  void L;
  return out;
}

export type StorefrontConfig = {
  /* custom: the merchant's own links in the menu (each with its words, its destination and its switch) */
  drawer: { items: DrawerItem[]; custom?: FooterTab[] };
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
    /* any font of the list, the title-only ones too ("": the store font) */
    headingFont: HeroFont;
    /* A second color for small accents: eyebrows, "view all" links, the pattern ("" means the store color) */
    accent: string;
    /* "pop": big heavy titles, and a colored line under "view all". "ornament": centered titles with three small diamonds above */
    titleStyle: "bold" | "light" | "pop" | "ornament";
    /* hairlines: a thin line in the store color under the header and over the footer */
    hairlines?: boolean;
    /* The prices: like the page's language (default), always Arabic (٢٤ د.أ) or always English (24 JOD) */
    prices?: "auto" | "ar" | "en";
    /* The size of the titles of the sections ("Collections", "Best sellers" ...) */
    sectionTitleSize?: number;
    /* Where the titles of the sections sit: at the start of the row (default) or in the middle */
    titleAlign?: "start" | "center";
    spacing: "normal" | "airy";
    /* The color of the sale badges, sale prices and the basket count ("" means the store color) */
    saleColor?: string;
  };
  /* The header's menu: a button that opens the side menu, or a row of links in the middle of the header */
  /* A link can go to a part of the page: `to` is the id of a section, or "footer" (the contact details) */
  /* style "pill": the logo in a dark pill, the links in a white pill (the first one is the active one), and a round basket button */
  /* place "start": with the name in the middle, the links sit at the start of the header row instead of under it.
     cartLook "text": the saved items and the basket are written as words, "Saved · Cart (2)".
     A link can have a color of its own ("" or none: the header's usual color) */
  /* searchLook (the header with the sidebar button): the search as a full bar, or an icon beside the basket that opens it.
     None chosen: an icon when the store name is in the middle, a bar otherwise. */
  nav: { style: "button" | "links" | "pill"; links: (Bi & { to?: string; color?: string })[]; activeColor?: string; cartColor?: string; place?: "below" | "start"; cartLook?: "icon" | "text"; searchLook?: "bar" | "icon"; /* the full search bar: its width, and whether it sits in the middle of the header or beside the basket */ searchSize?: "small" | "medium" | "large"; searchPlace?: "middle" | "cart"; /* the header with the sidebar button: the basket shows the total beside its icon (default yes) */ cartTotal?: boolean; /* the links header: the saved (favourites) button beside the basket (default yes) */ showSaved?: boolean };
  /* A faint pattern behind the page and a big word behind the picture tiles, both in the accent color */
  texture: { pattern: PatternKey; watermark: Bi; /* where the pattern shows (default: under the cover), how strong it is, and whether it fades toward the bottom (default: yes) */ area?: "all" | "below" | "top"; strength?: "light" | "medium" | "strong"; fade?: boolean };
  /* showLanguage: a button in the header that lets visitors switch the store between Arabic and English. Off by default:
     when he turns it on he must write his titles and texts in the other language too. */
  header: { showMenu: boolean; showSearch: boolean; showUser: boolean; showCart: boolean; showLanguage: boolean; sticky: boolean };
  /* favicon: the small icon in the browser tab, a small data URL kept in this browser */
  /* nameFont, nameColor: the store name in a font and a color of its own (header and footer). tagline: a small line under the name,
     with its own font and color (none: thin and slanted, in the accent color) */
  /* showName: the store name beside the logo (off: the logo stands alone; with no logo the name always shows) */
  /* align: where the logo and name sit in the header. "start" is the side the language reads from (the right in Arabic, the left
     in English), "end" the other side; the header's buttons move to the side the name leaves free */
  identity: { showLogo: boolean; showName?: boolean; align: "start" | "center" | "end"; logo: LogoConfig; favicon: string; nameFont?: HeroFont; nameColor?: string; /* the store name's size in the header, in px (none: the theme's) */ nameSize?: number; tagline?: Bi; taglineFont?: HeroFont; taglineColor?: string };
  sections: SectionConfig[];
  /* A picture, GIF or looping video behind the whole page. The file itself is kept in the browser's
     media storage under `media`. `veil` is how much of the page color covers it, so text stays readable. */
  pageBackground: { kind: "none" | "image" | "video"; media: string; name: string; size: number; veil: number; /* the part of the picture or video that stays in view */ pos?: PicPos };
  /* A thin bar above the header with a short message */
  announcement: { show: boolean; messages: AnnouncementMessage[]; motion: "fade" | "ticker"; seconds: number; /* how fast the ticker slides (none: normal) */ speed?: "slow" | "normal" | "fast" };
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
    /* Pressing a product opens its own page */
    openPage: boolean;
    /* The product's notes line (for example "rose · musk · incense") */
    showNotes: boolean;
    image: "portrait" | "square" | "wide";
    style: "shadow" | "outline" | "flat" | "pop";
    /* "row" puts the name on one side and the price on the other */
    info: "stack" | "row" | "center";
    /* "plus": a round + button instead of the wide "add to cart" button */
    add: "wide" | "plus";
    /* The color of the price ("" means the text color) */
    priceColor: string;
    /* The color of the round + button */
    addColor?: string;
  };
  /* How the basket looks (see Cart.tsx). A design saved before it was kept has none: the side panel. */
  cart?: { style: CartStyle };
  /* How the page of a product looks (see ProductPage in sections.tsx). A design saved before it was kept has none: the classic page. */
  /* The product page: its look, which of its parts show (none set: shown), his own words for the add button and the
     "You may also like" title ("" or none: the store's), and the add button's color */
  /* The all-products page: which filters customers get (none set: categories, sizes, in stock on; price range off), which
     orders they can pick and the one it opens with, products per row, his own title, and its look: the home page's ("same"),
     or its own background (a color or a picture) and chosen-filter color ("own") */
  shopPage?: { cats?: boolean; sizes?: boolean; inStock?: boolean; price?: boolean; sorts?: ShopSort[]; sortFirst?: ShopSort; cols?: 3 | 4; title?: Bi; look?: "same" | "own"; bg?: string; bgImage?: string; chipColor?: string };
  productPage?: { style: ProductPageStyle; crumbs?: boolean; save?: boolean; ask?: boolean; perks?: boolean; details?: boolean; also?: boolean; addText?: Bi; alsoTitle?: Bi; buyColor?: string };
  /* Words the store uses in small places. An empty text falls back to the built-in wording. */
  texts: { search: Bi; viewAll: Bi; allFilter: Bi; noProducts: Bi };
  footer: {
    showLogo: boolean;
    showLinks: boolean;
    showContact: boolean;
    showSocial: boolean;
    /* the merchant's own links, shown with the pages of the store */
    tabs?: FooterTab[];
    /* the columns of the footer, in their order (see footerColumns) */
    columns?: FooterColumn[];
    /* the size of the footer's texts, in px (empty: the theme's own size) */
    sizes?: { title?: number; text?: number; name?: number };
    /* The titles of the footer's columns. A title left empty shows the default word. */
    labels?: { pages: Bi; contact: Bi; follow: Bi; licenses: Bi };
    /* "simple": one row with the name, the links and the copyright line */
    style: "full" | "simple";
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
  drawer: { items: [{ kind: "categories", visible: true }, { kind: "pages", visible: true }, { kind: "links", visible: false }, { kind: "custom", visible: true }], custom: [] },
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
          { icon: "truck", title: { en: "Fast delivery", ar: "توصيل سريع" }, desc: { en: "Irbid, Amman and Salt", ar: "إربد وعمّان والسلط" } },
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
    messages: [{ text: { en: "", ar: "" }, link: "", color: "#004956", textColor: "" }],
    motion: "fade",
    seconds: 4,
  },
  cards: { showName: true, showCategory: true, showPrice: true, showOldPrice: true, showBadge: true, showStock: false, showHeart: true, showAdd: true, openPage: true, showNotes: false, image: "portrait", style: "shadow", info: "stack", add: "wide", priceColor: "" },
  cart: { style: "drawer" },
  productPage: { style: "classic" },
  texts: { search: { ...none }, viewAll: { ...none }, allFilter: { ...none }, noProducts: { ...none } },
  footer: {
    showLogo: true,
    showLinks: true,
    showContact: true,
    showSocial: true,
    style: "full",
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
  baloo: "var(--font-baloo), var(--font-sans), sans-serif",
  messiri: "var(--font-messiri), var(--font-sans), sans-serif",
  almarai: "var(--font-almarai), var(--font-sans), sans-serif",
  kufi: "var(--font-kufi), var(--font-sans), sans-serif",
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

/* A new words ribbon: a dark strip of short words about the store; starts with words that fit any kind of store */
export function newRibbon(id: string): SectionConfig {
  return {
    id,
    type: "ribbon",
    visible: true,
    settings: { items: [{ en: "New arrivals", ar: "وصل حديثًا" }, { en: "Best sellers", ar: "الأكثر مبيعًا" }, { en: "Fast delivery", ar: "توصيل سريع" }, { en: "Easy returns", ar: "إرجاع سهل" }], background: "#16120f", color: "#c9a46a" },
  };
}

/* The font family of the hero title. Empty: the titles font of the store. */
export function heroTitleFamily(key?: HeroFont): string {
  if (!key) return "var(--sf-heading)";
  if (key === "ruqaa" || key === "lemonada" || key === "amiri") return displayFamily[key];
  return fontFamily[key];
}

/* The font of the store's titles: the titles font he picked, or else the store font */
export function headingFamily(theme: Pick<StorefrontConfig["theme"], "font" | "headingFont">): string {
  return theme.headingFont ? heroTitleFamily(theme.headingFont) : fontFamily[theme.font] ?? fontFamily.readex;
}

/* Every font a merchant can pick, in one list that every font picker of the designer shows (store font, titles, the cover's
   title, the store name, the small line under it, a section's title).
   latin: it also writes English letters. The English pickers leave out the fonts that write Arabic only, since English text
   would fall back to another font. noAr: in Arabic it writes exactly like another font of the list, so the Arabic pickers
   leave it out. titles: a display font, for titles only (never the store's body text).
   A font already picked always shows, so it can be seen and changed. */
export type FontKey = Exclude<HeroFont, "">;
export type FontChoice = { key: FontKey; name: Bi; latin: boolean; noAr?: boolean; titles?: boolean };
export const storeFonts: FontChoice[] = [
  { key: "readex", name: { en: "Readex (default)", ar: "ريديكس (الافتراضي)" }, latin: true },
  { key: "plex", name: { en: "IBM Plex Arabic", ar: "آي بي إم بلكس" }, latin: true },
  { key: "cairo", name: { en: "Cairo", ar: "القاهرة" }, latin: true },
  { key: "tajawal", name: { en: "Tajawal", ar: "تجوال" }, latin: true },
  { key: "kufi", name: { en: "Noto Kufi", ar: "نوتو كوفي" }, latin: true },
  { key: "baloo", name: { en: "Baloo (playful)", ar: "بالو (مرح)" }, latin: true },
  { key: "messiri", name: { en: "El Messiri (elegant)", ar: "المسيري (أنيق)" }, latin: true },
  /* English letters in Cormorant Garamond, Arabic letters in Amiri */
  { key: "elegant", name: { en: "Cormorant (elegant)", ar: "أميري (أنيق)" }, latin: true },
  { key: "almarai", name: { en: "Almarai (light)", ar: "المراعي (خفيف)" }, latin: false },
  { key: "amiri", name: { en: "Amiri (classic)", ar: "أميري (كلاسيكي)" }, latin: true, noAr: true, titles: true },
  { key: "ruqaa", name: { en: "Aref Ruqaa (royal)", ar: "رقعة (ملكي)" }, latin: true, titles: true },
  { key: "lemonada", name: { en: "Lemonada (round)", ar: "ليمونادا (مستدير)" }, latin: true, titles: true },
];

/* The fonts a picker offers in a language. text: a picker for the store's body text, so no title-only fonts. */
export function fontChoices(lang: "en" | "ar", picked?: string, text = false): FontChoice[] {
  return storeFonts.filter((f) => f.key === picked || (!(text && f.titles) && (lang === "en" ? f.latin : !f.noAr)));
}

/* A new row of colored chips (quick categories). Each chip has its own color and sits a little tilted. */
export function newChips(id: string, /* where every chip leads at first: the store's products (see shopTarget), never nowhere */ to = ""): SectionConfig {
  const bi = (en: string, ar: string): Bi => ({ en, ar });
  return {
    id,
    type: "chips",
    visible: true,
    settings: {
      items: [
        { key: "c1", label: bi("New", "جديد"), color: "#ff8fb1", link: to },
        { key: "c2", label: bi("Best sellers", "الأكثر طلبًا"), color: "#c9b6ff", link: to },
        { key: "c3", label: bi("Offers", "عروض"), color: "#ffe36e", link: to },
        { key: "c4", label: bi("Gifts", "هدايا"), color: "#b9f3d0", link: to },
      ],
    },
  };
}

/* A new newsletter block: a dark block with a title, a line of text and an email field. Nothing is sent in this prototype. */
export function newNewsletter(id: string): SectionConfig {
  const bi = (en: string, ar: string): Bi => ({ en, ar });
  return {
    id,
    type: "newsletter",
    visible: true,
    settings: {
      title: bi("Join our club", "انضم لنادينا"),
      accentWord: bi("club", "لنادينا"),
      text: bi("10% off your first order, and news before everyone else", "خصم ١٠٪ على أول طلب + أخبار الإصدارات قبل الكل"),
      button: bi("Subscribe", "اشترك"),
      placeholder: bi("Your email", "إيميلك"),
      thanks: bi("Thank you! We will be in touch.", "شكرًا! سنتواصل معك."),
      background: "#2b1b47",
      accent: "#ffe36e",
      buttonColor: "#ffe36e",
    },
  };
}

/* ---------------- Links to pages the store does not have ---------------- */

/* A ready theme's sample pages (9100 to 9399) are not in a merchant's store */
export const samplePageId = (id: number) => id >= 9100 && id < 9400;
export const pageIdOf = (link: string) => (/^page:\d+$/.test((link ?? "").trim()) ? Number(link.trim().slice(5)) : null);
/* A page of the store, as the links need it */
export type PageRef = { id: number; title: Bi; type?: number; published?: boolean };
const pageTopics: [string, RegExp][] = [
  ["contact", /contact|تواصل|اتصل/i],
  ["about", /about|من نحن|قصتنا/i],
  ["returns", /return|exchange|refund|استرجاع|استبدال|إرجاع/i],
  ["shipping", /shipping|delivery|شحن|توصيل/i],
  ["sizes", /\bsizes?\b|مقاس/i],
  ["care", /\bcar(e|ing)\b|عناية/i],
  ["faq", /faq|questions|أسئلة/i],
  ["privacy", /privacy|خصوصية/i],
  ["terms", /terms|conditions|أحكام|شروط/i],
];
export const pageTopicOf = (words: string[]) => pageTopics.find(([, re]) => words.some((w) => re.test(w)))?.[0] ?? null;
const sameWord = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** His page that a link with these words should lead to: one of the same title, then one of the same kind (a returns page for
    "Returns"). With no shipping page, the returns policy is the closest; `near` says it was taken that way. */
export function matchPage(words: string[], live: PageRef[]): { page: PageRef; near: boolean } | undefined {
  const w = words.filter((x) => !!x?.trim());
  const same = live.find((p) => w.some((x) => sameWord(x, p.title.en ?? "") || sameWord(x, p.title.ar ?? "")));
  if (same) return { page: same, near: false };
  const topic = pageTopicOf(w);
  const kind = topic ? live.find((p) => pageTopicOf([p.title.en, p.title.ar]) === topic) : undefined;
  if (kind) return { page: kind, near: false };
  const near = topic === "shipping" ? live.find((p) => p.type === 1) : undefined;
  return near ? { page: near, near: true } : undefined;
}

/** Where a link that led nowhere goes instead: the products of the home page (the grid, then any block of products), else nowhere */
export function shopTarget(cfg: StorefrontConfig): string {
  const s = cfg.sections;
  return (s.find((x) => x.type === "products") ?? s.find((x) => x.type === "featured" || x.type === "collection" || x.type === "discounts" || x.type === "tiles"))?.id ?? "";
}

/** The menu, the header's links, the bar above the header and every block of the page, with each link to a page the store does not
    have (a theme's sample page, or a page he deleted) led to his own page of the same title or kind, or else to his products.
    `pages`: the pages of the store (null when they are not known: then only sample pages count as missing). `wordsOf`: more words
    for a missing page (a sample page's title). The footer is left as it is (see mergeFooter: it drops such links). */
export function relinkPages(cfg: StorefrontConfig, pages: PageRef[] | null, wordsOf?: (id: number) => string[]): StorefrontConfig {
  const has = pages ? new Set(pages.map((p) => p.id)) : null;
  const live = (pages ?? []).filter((p) => p.published !== false && !samplePageId(p.id));
  const shop = shopTarget(cfg);
  let changed = false;
  const fix = (link: string, words: string[]): string => {
    const id = pageIdOf(link);
    /* a page the store has stays (a copy of a theme keeps its sample pages); unknown pages: only sample ones are missing */
    if (id === null || (has ? has.has(id) : !samplePageId(id))) return link;
    changed = true;
    const to = matchPage([...(wordsOf?.(id) ?? []), ...words], live);
    return to ? `page:${to.page.id}` : shop;
  };
  /* the words around a link: the texts of the same item (its label, title, button) */
  const wordsIn = (o: Record<string, unknown>) =>
    Object.values(o).flatMap((v) => (v && typeof v === "object" && !Array.isArray(v) && typeof (v as Bi).en === "string" ? [(v as Bi).en, (v as Bi).ar] : []));
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = (k === "link" || k === "link2") && typeof x === "string" ? fix(x, wordsIn(o)) : walk(x);
    return out;
  };
  const next: StorefrontConfig = {
    ...cfg,
    nav: { ...cfg.nav, links: cfg.nav.links.map((l) => (l.to && pageIdOf(l.to) !== null ? { ...l, to: fix(l.to, [l.en, l.ar]) || undefined } : l)) },
    drawer: { ...cfg.drawer, custom: cfg.drawer.custom?.map((x) => ({ ...x, link: fix(x.link, [x.label?.en, x.label?.ar]) })) },
    announcement: walk(cfg.announcement) as StorefrontConfig["announcement"],
    sections: walk(cfg.sections) as SectionConfig[],
  };
  if (!cfg.drawer.custom) delete next.drawer.custom;
  return changed ? next : cfg;
}
