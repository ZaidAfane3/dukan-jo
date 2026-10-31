import type { Lang } from "../content";
import type { Bi, SectionConfig, StorefrontConfig } from "./config";
import { defaultConfig, newChips, newNewsletter } from "./config";
import type { StoreProduct } from "./useStoreData";
import { lammaLink } from "./lammaPages";

/* "Lamma": a playful, colorful home page for clothes and youth stores, written only with what the store designer offers
   (the playful hero, the pill header, colored chips, round "+" product cards, color banner cards, the newsletter block).
   With `samples` the pictures, prices and words of a made-up clothing store are filled in (previews and /saad).
   Without them the merchant gets the structure, the font and the colors, and adds his own pictures. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

export function lammaConfig(_lang: Lang, o: { samples: boolean; storeName?: string }): StorefrontConfig {
  const c = JSON.parse(JSON.stringify(defaultConfig)) as StorefrontConfig;
  const S = o.samples;
  const photo = (f: string) => (S ? `/demo/lamma/${f}.jpg` : "");

  /* primary is left empty: the theme follows the store color (the made-up store uses the same deep purple as the text) */
  c.theme = { ...c.theme, primary: "", background: "#fff6ea", text: "#2b1b47", titleColor: "", radius: "xl", font: "baloo", headingFont: "baloo", accent: "#7c5cff", titleStyle: "pop", spacing: "normal" };
  c.header = { ...c.header, showSearch: false, showLanguage: false, showUser: false, showCart: true, showMenu: false };
  c.nav = {
    style: "pill",
    links: S
      ? [
          { ...bi("New", "جديد"), to: "products" },
          { ...bi("Collections", "المجموعات"), to: "banners" },
          { ...bi("About us", "من نحن"), to: lammaLink("about") },
          { ...bi("Contact us", "تواصل معنا"), to: lammaLink("contact") },
        ]
      : [
          { ...bi("New", "جديد"), to: "products" },
          { ...bi("Collections", "المجموعات"), to: "banners" },
          { ...bi("Join us", "انضم لنا"), to: "newsletter" },
        ],
    activeColor: "#ff4d4d",
    cartColor: "#b9f3d0",
  };
  c.texture = { pattern: "none", watermark: bi("", "") };
  c.announcement = { ...c.announcement, show: false };
  c.cards = { ...c.cards, showCategory: false, showHeart: false, showAdd: true, showNotes: false, showStock: false, showBadge: true, showOldPrice: true, style: "pop", info: "stack", image: "square", add: "plus", priceColor: "#7c5cff", addColor: "#b9f3d0" };
  /* The basket floats with the same bold outline and hard shadow as the cards */
  c.cart = { style: "pop" };
  c.productPage = { style: "pop" };
  c.footer = { ...c.footer, style: "simple", background: "", text: "" };
  /* The sample footer has a column of the site's own categories, built with the footer's own links: Men, Women, Accessories */
  if (S) {
    c.footer.columns = [
      { id: "about", kind: "about", visible: true },
      { id: "shop", kind: "custom", visible: true, title: bi("Shop", "تسوّق"), links: [
        { id: "shop-men", label: bi("Men", "رجالي"), link: lammaLink("men"), visible: true },
        { id: "shop-women", label: bi("Women", "نسائي"), link: lammaLink("women"), visible: true },
        { id: "shop-acc", label: bi("Accessories", "إكسسوارات"), link: lammaLink("accessories"), visible: true },
      ] },
      { id: "pages", kind: "pages", visible: true },
      { id: "contact", kind: "contact", visible: true },
      { id: "social", kind: "social", visible: true },
      { id: "licenses", kind: "licenses", visible: true },
    ];
  }
  /* the name sits in the dark pill; he can turn the logo on beside it */
  c.identity = { ...c.identity, showLogo: false };

  const hero: SectionConfig = {
    id: "hero",
    type: "hero",
    visible: true,
    settings: {
      /* a title in both languages, never a copy of the store name (that would stay behind when he renames the store) */
      title: S ? bi("Wear Colors Have Fun", "البس الوانك وانبسط") : bi("Wear your colors", "البس ألوانك"),
      subtitle: S ? bi("Comfy pieces in beautiful colors, for every place.", "قطع مريحة بألوان جميلة، لكل مكان.") : bi("A short line about your best products", "سطر قصير عن أفضل منتجاتك"),
      button: S ? bi("Let's shop", "يلا نتسوّق") : bi("Shop now", "تسوّق الآن"),
      backgrounds: [{ kind: "color", color: "#fff6ea", image: "" }],
      autoplay: false,
      seconds: 5,
      showCards: false,
      layout: "pop",
      link: "products",
      link2: "",
      photo: photo("polo2"),
      photo2: photo("trousers"),
      eyebrow: S ? bi("✿ Summer 2026", "✿ صيف ٢٠٢٦") : bi("✿ New season", "✿ موسم جديد"),
      button2: bi("", ""),
      sticker: S ? bi("20%\nOFF", "خصم\n٢٠٪") : bi("", ""),
      accentWord: S ? bi("Colors", "الوانك") : bi("colors", "ألوانك"),
      popColors: { accent: "#7c5cff", blob: "#c9b6ff", sticker: "#ffe36e" },
    },
  };

  const chips = newChips("chips", "products");
  if (S && chips.type === "chips") {
    chips.settings.items = [
      { label: bi("Men", "رجالي"), color: "#c9b6ff", link: lammaLink("men") },
      { label: bi("Women", "نسائي"), color: "#ff8fb1", link: lammaLink("women") },
      { label: bi("Hoodies", "هوديز"), color: "#ffe36e", link: lammaLink("hoodies") },
      { label: bi("T-shirts", "تيشيرتات"), color: "#b9f3d0", link: lammaLink("tees") },
      { label: bi("Pants", "بناطيل"), color: "#ffffff", link: lammaLink("pants") },
      { label: bi("Accessories", "إكسسوارات"), color: "#ffb787", link: lammaLink("accessories") },
    ];
  }

  const products: SectionConfig = { id: "products", type: "products", visible: true, settings: { title: S ? bi("Everyone loves it ♥", "الكل يحبها ♥") : bi("Best sellers", "الأكثر طلبًا"), columns: 3, showFilters: false, limit: 8 } };

  const banners: SectionConfig = {
    id: "banners",
    type: "banners",
    visible: true,
    settings: {
      height: "normal",
      items: [
        {
          image: photo("polo-zip"),
          eyebrow: bi("Collection", "مجموعة"),
          title: S ? bi("Men", "رجالي") : bi("New collection", "مجموعة جديدة"),
          text: bi("", ""),
          button: bi("Discover", "اكتشف"),
          link: S ? lammaLink("men") : "",
          variant: "card",
          bg: "#b9f3d0",
          shape: "arch",
          accent: "#2b1b47",
        },
        {
          image: photo("cardigan"),
          eyebrow: bi("Collection", "مجموعة"),
          title: S ? bi("Women", "نسائي") : bi("Our picks", "اخترنا لك"),
          text: bi("", ""),
          button: bi("Discover", "اكتشف"),
          link: S ? lammaLink("women") : "",
          variant: "card",
          bg: "#ff8fb1",
          shape: "tilt",
          accent: "#2b1b47",
        },
        ...(S
          ? [
              {
                image: photo("sunglasses"),
                images: [photo("cap-green"), photo("bracelet"), photo("cap-black")],
                eyebrow: bi("Collection", "مجموعة"),
                title: bi("Accessories", "إكسسوارات"),
                text: bi("", ""),
                button: bi("Discover", "اكتشف"),
                link: lammaLink("accessories"),
                variant: "card" as const,
                bg: "#ffe36e",
                shape: "tilt" as const,
                accent: "#2b1b47",
              },
            ]
          : []),
      ],
    },
  };

  /* A second row under "Everyone loves it": two big color cards for the women's pieces, each with its own line */
  const women: SectionConfig = {
    id: "women",
    type: "banners",
    visible: true,
    settings: {
      height: "normal",
      items: [
        {
          image: photo("blouse-stripes"),
          eyebrow: bi("New for your wardrobe", "جديد على خزانتك ✿"),
          title: bi("“Sky” blouse", "بلوزة «سماء»"),
          text: bi("Soft stripes and a bow at the waist", "خطوط ناعمة وفيونكة على الخصر"),
          button: bi("Take a look", "شوفيها"),
          link: lammaLink("women"),
          variant: "card" as const,
          bg: "#d6c8ff",
          shape: "arch" as const,
          accent: "#2b1b47",
          titleSize: 42,
          eyebrowSize: 20,
        },
        {
          image: photo("skirt-pleated"),
          eyebrow: bi("You have to try it", "لازم تجربيها ✿"),
          title: bi("“Coffee” skirt", "تنورة «قهوة»"),
          text: bi("A classic with a warm touch", "كلاسيك بلمسة دفا"),
          button: bi("Take a look", "شوفيها"),
          link: lammaLink("women"),
          variant: "card" as const,
          bg: "#ffe36e",
          shape: "tilt" as const,
          accent: "#2b1b47",
          titleSize: 42,
          eyebrowSize: 20,
        },
      ],
    },
  };

  const news = newNewsletter("newsletter");
  if (S && news.type === "newsletter") {
    news.settings.title = bi("Join the Lamma club", "انضم لنادي لَمّة");
    news.settings.accentWord = bi("Lamma", "لَمّة");
  }

  c.sections = S ? [hero, chips, products, women, banners, news] : [hero, chips, products, banners, news];
  return c;
}

/** The made-up clothes a Lamma preview is shown with */
export function lammaProducts(lang: Lang): StoreProduct[] {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const mk = (i: number, en: string, ar: string, price: number, hue: number, img?: string): StoreProduct => ({
    id: -(i + 1),
    name: L(en, ar),
    category: L("Clothes", "ملابس"),
    price,
    sale: null,
    featured: true,
    quantity: 20,
    hue,
    image: img ? `/demo/lamma/${img}.jpg` : undefined,
  });
  const list = [
    { ...mk(0, "“Smoke” hoodie", "هودي «دخان»", 24, 20, "hoodie-grey"), notes: L("cotton · oversized", "قطن · قصّة واسعة"), badge: L("New", "جديد") },
    { ...mk(1, "“Boston” tee", "تيشيرت «بوسطن»", 17, 160, "tee-boston"), quantity: 3 },
    { ...mk(2, "“Night” jacket", "جاكيت «ليل»", 26, 260, "jacket-black"), sale: 21 },
    mk(3, "“Shade” trousers", "بنطلون «ظل»", 19, 330, "trousers-back"),
    /* More made-up products (no pictures yet: a soft color and a garment), so the choice of how many products to show can be seen at work */
    mk(4, "“Berry” hoodie", "هودي «توت»", 23, 335, "hoodie-berry"),
    mk(5, "“Lemon” tee", "تيشيرت «ليمون»", 11, 55, "tee-lemon"),
    mk(6, "“Sand” trousers", "بنطلون «رمل»", 21, 38, "trousers-sand"),
    mk(7, "“Mint” cap", "كاب «نعناع»", 8, 150, "cap-mint"),
    mk(8, "“Sky” jacket", "جاكيت «سماء»", 27, 200, "jacket-sky"),
    mk(9, "“Cloud” shirt", "قميص «غيمة»", 15, 210, "shirt-cloud"),
    mk(10, "“Sun” trousers", "بنطلون «شمس»", 13, 45, "trousers-sun"),
    mk(11, "“Rose” blouse", "بلوزة «ورد»", 16, 350, "blouse-rose"),
    mk(12, "“Peach” hoodie", "هودي «خوخ»", 22, 20, "hoodie-peach"),
    mk(13, "“Sage” hoodie", "هودي «ميرمية»", 25, 120, "hoodie-sage"),
    mk(14, "“Coral” tee", "تيشيرت «مرجان»", 12, 10, "tee-coral"),
    mk(15, "“Night” cap", "كاب «ليل»", 9, 260, "cap-black"),
    mk(16, "“Beach” sunglasses", "نظارة «بحر»", 14, 190, "sunglasses-beach"),
    mk(17, "“Cloud” bracelet", "سوار «غيمة»", 6, 205, "bracelet-cloud"),
    mk(18, "“Olive” cargo", "بنطلون «زيتون»", 24, 90, "trousers-olive"),
    mk(19, "“Denim” straight", "جينز «أزرق»", 28, 215, "trousers-denim"),
    mk(20, "“Linen” wide", "بنطلون «كتان»", 22, 45, "trousers-linen"),
    mk(21, "“Sun” cap", "كاب «شمس»", 10, 50, "cap-sun"),
    mk(22, "“Wave” bracelet", "سوار «موج»", 9, 30, "bracelet-wave"),
    mk(23, "“Coffee” skirt", "تنورة «قهوة»", 18, 30, "skirt-pleated"),
  ];
  /* the coffee skirt comes right after the first four, so it shows in the home page's row too */
  list.splice(4, 0, list.pop()!);
  return list;
}
