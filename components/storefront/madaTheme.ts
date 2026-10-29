import type { Lang } from "../content";
import type { Bi, SectionConfig, StorefrontConfig } from "./config";
import { defaultConfig } from "./config";
import { madaLink } from "./madaPages";
import type { StoreProduct } from "./useStoreData";

/* "Mada" (مَدى): Dukkan's second free design, a clean fashion-chain look, written only with what the store designer offers
   (a tall full-width cover with the words at the bottom corner, round category pictures, photo cards, a sale banner, a trust row).
   White page, black text and buttons, a red for sales, square corners, flat cards, Noto Kufi for everything.
   It is a free default design for every merchant, without photos: every picture place is there, empty, for his own (all of it
   stays editable). With `samples` the photos, products and words of a made-up clothing store are filled in (Saad's showcase at
   /saad/mada, and the view-only page /store?theme=mada).
   Every button leads to a part of the home page (by its id), so nothing is dead on any store. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

export const MADA_INK = "#111111";
export const MADA_SALE = "#C8102E";

export function madaConfig(lang: Lang, o: { samples: boolean; storeName?: string }): StorefrontConfig {
  const c = JSON.parse(JSON.stringify(defaultConfig)) as StorefrontConfig;
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const S = o.samples;
  /* the showcase's pictures (see public/demo/mada); a merchant's store starts without them */
  const photo = (f: string) => (S ? `/demo/mada/${f}.jpg` : "");
  const name = o.storeName?.trim() || L("Your store", "متجرك");

  /* Black is the store color here: the buttons, the filters and the price are black, whatever color the store was set up with */
  c.theme = { ...c.theme, primary: MADA_INK, background: "#ffffff", text: MADA_INK, titleColor: "", radius: "none", font: "kufi", headingFont: "kufi", accent: "#6B6B6B", titleStyle: "bold", titleAlign: "start", hairlines: true, spacing: "airy", saleColor: MADA_SALE };
  c.texture = { pattern: "none", watermark: bi("", "") };
  c.header = { ...c.header, showMenu: false, showSearch: true, showUser: true, showCart: true, showLanguage: false, sticky: true };
  /* The menu sits at the start of the header row, the name in the middle. «تخفيضات» is red. */
  c.nav = {
    style: "links",
    place: "start",
    links: [
      { ...bi("Women", "نساء"), to: "collections" },
      { ...bi("Men", "رجال"), to: "collections" },
      { ...bi("Kids", "أطفال"), to: "trending" },
      { ...bi("New in", "وصل حديثاً"), to: "new" },
      { ...bi("Sale", "تخفيضات"), to: "sale", color: MADA_SALE },
    ],
  };
  c.identity = { ...c.identity, showLogo: false, align: "center", nameColor: MADA_INK };
  c.announcement = {
    show: true,
    motion: "fade",
    seconds: 5,
    messages: [{ text: bi("Free shipping on orders over 30 JOD · Returns within 14 days", "شحن مجاني للطلبات فوق ٣٠ د.أ · إرجاع خلال ١٤ يوماً"), link: "perks", color: MADA_INK, textColor: "#ffffff" }],
  };
  /* Flat cards: the photo, the name, the price and a square add button. No hearts and no category line. */
  c.cards = { ...c.cards, style: "flat", image: "portrait", info: "stack", add: "wide", showName: true, showCategory: false, showPrice: true, showOldPrice: true, showBadge: true, showStock: false, showHeart: false, showAdd: true, showNotes: false, openPage: true, priceColor: "" };
  /* The bag: sharp, all caps and black, like the cards */
  c.cart = { style: "editorial" };
  c.productPage = { style: "editorial" };
  c.footer = { ...c.footer, style: "full", background: MADA_INK, text: "#CFCFCF", showLogo: true, showLinks: true, showContact: true, showSocial: true };
  c.footer.about = S ? bi("Everyday clothes at fair prices.", "ملابس يومية بأسعار معقولة.") : bi("", "");
  c.footer.columns = [
    { id: "about", kind: "about", visible: true },
    { id: "mada-shop", kind: "custom", visible: true, title: bi("Shop", "تسوّق"), links: [
      { id: "shop-women", label: bi("Women", "نساء"), link: "collections", visible: true },
      { id: "shop-men", label: bi("Men", "رجال"), link: "collections", visible: true },
      { id: "shop-kids", label: bi("Kids", "أطفال"), link: "trending", visible: true },
      { id: "shop-sale", label: bi("Sale", "تخفيضات"), link: "sale", visible: true },
    ] },
    /* Sample pages: on his store each goes to his own page of the same kind, or is left out (see mergeFooter in themes.ts) */
    { id: "mada-help", kind: "custom", visible: true, title: bi("Help", "مساعدة"), links: [
      { id: "help-track", label: bi("Track your order", "تتبّع الطلب"), link: madaLink("track"), visible: true },
      { id: "help-returns", label: bi("Exchanges", "الاستبدال"), link: madaLink("returns"), visible: true },
      { id: "help-sizes", label: bi("Size guide", "دليل المقاسات"), link: madaLink("sizes"), visible: true },
      { id: "help-contact", label: bi("Contact us", "تواصل معنا"), link: madaLink("contact"), visible: true },
    ] },
    { id: "mada-about", kind: "custom", visible: true, title: bi("About us", "من نحن"), links: [
      { id: "about-story", label: bi("Our story", "قصتنا"), link: "hero", visible: true },
      { id: "about-delivery", label: bi("Delivery", "التوصيل"), link: "perks", visible: true },
      { id: "about-contact", label: bi("Contact us", "تواصل معنا"), link: madaLink("contact"), visible: true },
    ] },
    { id: "pages", kind: "pages", visible: false },
    { id: "contact", kind: "contact", visible: false },
    { id: "social", kind: "social", visible: true },
    { id: "licenses", kind: "licenses", visible: true },
  ];

  const hero: SectionConfig = {
    id: "hero",
    type: "hero",
    visible: true,
    settings: {
      layout: "banner",
      fullWidth: true,
      height: "tall",
      textPos: "bottom-start",
      eyebrow: S ? bi("Autumn collection 2026", "مجموعة الخريف ٢٠٢٦") : bi("New season", "موسم جديد"),
      title: S ? bi("Style\nevery day", "أناقة\nكل يوم") : bi(name, name),
      subtitle: S ? bi("Comfortable cuts and warm colors for the new season.", "قصّات مريحة وألوان دافئة للموسم الجديد.") : bi("A short line about your new collection", "سطر قصير عن مجموعتك الجديدة"),
      button: bi("Shop women", "تسوّقي النساء"),
      link: "collections",
      button2: bi("Shop men", "تسوّق الرجال"),
      link2: "collections",
      backgrounds: [S ? { kind: "image", color: "", image: photo("hero"), pos: { x: 0, y: 0, zoom: 1 } } : { kind: "color", color: MADA_INK, image: "" }],
      autoplay: false,
      seconds: 5,
      showCards: false,
    },
  };

  const cat = (f: string, en: string, ar: string) => ({ image: photo(f), label: bi(en, ar), link: "trending" });
  const categories: SectionConfig = {
    id: "categories",
    type: "tiles",
    visible: true,
    settings: {
      title: bi("Shop by category", "تسوّق حسب الفئة"),
      columns: 8,
      style: "circles",
      items: [
        cat("cat-dresses", "Dresses", "فساتين"),
        cat("cat-blouses", "Blouses", "بلوزات"),
        cat("cat-jeans", "Jeans", "جينز"),
        cat("cat-sets", "Sets", "أطقم"),
        cat("cat-shirts", "Shirts", "قمصان"),
        cat("cat-sport", "Sportswear", "رياضي"),
        cat("cat-shoes", "Shoes", "أحذية"),
        cat("cat-bags", "Bags", "حقائب"),
      ],
    },
  };

  /* Three photo cards, each with its name and a button straight on the picture */
  const card = (f: string, title: Bi, button: Bi) => ({ image: photo(f), title, text: bi("", ""), button, link: "trending", variant: "photo" as const, titleSize: 44 });
  const collections: SectionConfig = {
    id: "collections",
    type: "banners",
    visible: true,
    settings: {
      height: "normal",
      items: [
        card("card-men", bi("Men", "رجال"), bi("Shop now", "تسوّق الآن")),
        card("card-women", bi("Women", "نساء"), bi("Shop now", "تسوّقي الآن")),
        card("card-shoes", bi("Shoes", "أحذية"), bi("Shop now", "تسوّق الآن")),
      ],
    },
  };

  /* The best sellers: the first four products, with the category filters above them */
  const trending: SectionConfig = { id: "trending", type: "products", visible: true, settings: { title: bi("Trending now", "الأكثر رواجاً"), columns: 4, showFilters: true, limit: 4 } };

  const sale: SectionConfig = {
    id: "sale",
    type: "banners",
    visible: true,
    settings: {
      height: "normal",
      items: [
        {
          image: photo("sale"),
          eyebrow: bi("Sale", "تخفيضات"),
          title: bi("Up to 50% off", "خصم حتى ٥٠٪"),
          text: bi("On selected pieces for a limited time", "على قطع مختارة لفترة محدودة"),
          button: bi("Shop the sale", "تسوّقي التخفيضات"),
          link: "trending",
          variant: "photo",
          panel: "none",
          position: "center",
          buttonStyle: "filled",
          /* a white button, and the small «تخفيضات» line in the sale red */
          accent: "#ffffff",
          titleColor: "#ffffff",
          eyebrowColor: MADA_SALE,
          textColor: "#ffffff",
          titleSize: 72,
        },
      ],
    },
  };

  /* New in: four pinned products (on his store he picks his own; until then only the designer shows it) */
  const fresh: SectionConfig = { id: "new", type: "collection", visible: true, settings: { title: bi("New in", "وصل حديثاً"), productIds: S ? [-5, -6, -7, -8] : [], count: 4, columns: 4, link: "trending" } };

  const perks: SectionConfig = {
    id: "perks",
    type: "perks",
    visible: true,
    settings: {
      items: [
        { icon: "truck", title: bi("Fast shipping", "شحن سريع"), desc: bi("To every governorate", "لكل المحافظات") },
        { icon: "returns", title: bi("Free returns", "إرجاع مجاني"), desc: bi("Within 14 days", "خلال ١٤ يوماً") },
        { icon: "shield", title: bi("Secure payment", "دفع آمن"), desc: bi("Or cash on delivery", "أو عند الاستلام") },
        { icon: "chat", title: bi("Customer care", "خدمة عملاء"), desc: bi("7 days a week", "٧ أيام") },
      ],
    },
  };

  const newsletter: SectionConfig = {
    id: "newsletter",
    type: "newsletter",
    visible: true,
    settings: {
      title: bi("Get our newest pieces", "اشترك ليصلك جديدنا"),
      accentWord: bi("", ""),
      text: bi("New collections and sales, straight to your inbox.", "المجموعات الجديدة والتخفيضات، تصلك أولًا على بريدك."),
      button: bi("Subscribe", "اشتراك"),
      placeholder: bi("Your email", "بريدك الإلكتروني"),
      thanks: bi("Thank you! You will hear from us soon.", "شكرًا لك! ستصلك عروضنا قريبًا."),
      /* a black band with a white button (the block's button text is always dark) */
      background: MADA_INK,
      accent: "#ffffff",
      buttonColor: "#ffffff",
    },
  };

  c.sections = [hero, categories, collections, trending, sale, fresh, perks, newsletter];
  return c;
}

/** The made-up clothes a Mada preview is shown with (real photos, see public/demo/mada). 1 to 4 are the best sellers, 5 to 8 are new in,
    9 to 11 are the pieces of the weekend look. */
export function madaProducts(lang: Lang): StoreProduct[] {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const women: [string, string] = ["Women", "نساء"];
  const men: [string, string] = ["Men", "رجال"];
  const shoes: [string, string] = ["Shoes", "أحذية"];
  const mk = (n: number, photo: string, en: string, ar: string, price: number, cat: [string, string], hue: number, extra: Partial<StoreProduct> = {}): StoreProduct => ({
    id: -n,
    name: L(en, ar),
    category: L(...cat),
    price,
    sale: null,
    featured: true,
    quantity: 12,
    hue,
    image: `/demo/mada/${photo}.jpg`,
    ...extra,
  });
  const isNew = { badge: L("New", "جديد") };
  return [
    mk(1, "trend-1", "Long printed dress", "فستان طويل منقوش", 24, women, 30),
    mk(2, "trend-2", "Folded men's shirt", "قميص رجالي مطوي", 18, men, 220),
    mk(3, "trend-3", "Wide high-waist jeans", "جينز واسع بخصر عالي", 20, women, 215, { sale: 14 }),
    mk(4, "trend-4", "Classic white blazer", "بليزر أبيض كلاسيك", 39, women, 40),
    mk(5, "new-1", "Straight-cut beige blazer", "بليزر بيج بقصّة مستقيمة", 45, women, 35, isNew),
    mk(6, "new-2", "Crew-neck wool sweater", "كنزة صوف بياقة دائرية", 22, men, 15, isNew),
    mk(7, "new-3", "Top and skirt set", "طقم بلوزة وتنورة", 20, women, 40, isNew),
    mk(8, "new-4", "Men's chino trousers", "بنطلون تشينو رجالي", 21, men, 35, isNew),
    mk(9, "look-1", "Cotton blouse", "بلوزة قطن", 12, women, 40),
    mk(10, "look-2", "Olive trousers", "بنطلون زيتي", 19, women, 90),
    mk(11, "look-3", "White shoes", "حذاء أبيض", 28, shoes, 0),
  ];
}
