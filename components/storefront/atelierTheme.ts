import type { Lang } from "../content";
import type { Bi, SectionConfig, StorefrontConfig } from "./config";
import { defaultConfig } from "./config";

/* "Misk" (code name "atelier"): a luxury home page for any store, written only with what the store designer offers
   (split hero, notes ribbon, picture tiles, promo banners, product grid, fonts, texture, footer colors).
   The same design is used by the platform tour and by the theme store.

   With `samples` the pictures, prices and texts of a made-up perfume store are filled in (for previews and the tour).
   Without them the merchant gets the structure, the fonts and the colors, and adds his own pictures. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

export function atelierConfig(lang: Lang, o: { samples: boolean; storeName?: string }): StorefrontConfig {
  const c = JSON.parse(JSON.stringify(defaultConfig)) as StorefrontConfig;
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const photo = (n: number) => (o.samples ? `/demo/perfume/p${n}.jpg` : "");
  const tile = (n: number, en: string, ar: string, chip: "light" | "dark" = "light") => ({ image: photo(n), label: bi(en, ar), link: "", chip });

  /* primary is left empty on purpose: the theme follows the store color (the demo store's color is the same dark ink, so it looks the same) */
  c.theme = { ...c.theme, primary: "", background: "#f7f2ea", text: "#1c1a17", radius: "md", font: "plex", headingFont: "readex", accent: "#8a6a3a", titleStyle: "light", spacing: "airy" };
  /* What a merchant receives is neutral, for any kind of store. The perfume words are only in the sample (the preview and the tour). */
  c.nav = {
    style: "links",
    /* The links go to the parts of this page: they work for any kind of store */
    links: [
      { ...bi("Best sellers", "الأكثر طلبًا"), to: "featured" },
      { ...bi("Collections", "المجموعات"), to: "tiles" },
      { ...bi("New arrivals", "وصل حديثًا"), to: "products" },
      { ...bi("Reviews", "آراء العملاء"), to: "reviews" },
      { ...bi("Contact", "التواصل"), to: "footer" },
    ],
  };
  /* No pattern by default: the stars read as tiles behind the products. Dots, lines and waves are soft; he can choose one. */
  c.texture = { pattern: "none", watermark: o.samples ? bi("Scent", "عِطر") : bi("", "") };
  c.announcement = { ...c.announcement, show: false };
  c.cards = { ...c.cards, showCategory: false, showHeart: false, showAdd: false, showNotes: true, showStock: false, style: "flat", info: "row", image: "portrait" };
  /* The basket opens as a calm full page, the summary beside the products */
  c.cart = { style: "luxe" };
  c.productPage = { style: "luxe" };
  /* The sample footer has a column of the site's own categories, built with the footer's own links */
  if (o.samples) {
    c.footer.columns = [
      { id: "about", kind: "about", visible: true },
      { id: "pages", kind: "pages", visible: true },
      { id: "shop", kind: "custom", visible: true, title: bi("Collections", "المجموعات"), links: [
        { id: "shop-unisex", label: bi("Unisex", "مشترك"), link: "tiles", visible: true },
        { id: "shop-men", label: bi("Men", "رجالي"), link: "tiles", visible: true },
        { id: "shop-women", label: bi("Women", "نسائي"), link: "tiles", visible: true },
        { id: "shop-oud", label: bi("Oud", "العود"), link: "banners", visible: true },
      ] },
      { id: "contact", kind: "contact", visible: true },
      { id: "social", kind: "social", visible: true },
      { id: "licenses", kind: "licenses", visible: true },
    ];
  }
  /* the store's name stands in the header (the hero's title is his own words, not a copy of the name); he can turn the logo on instead */
  if (!o.samples) c.identity = { ...c.identity, showLogo: false };
  c.footer.background = "#16120f";
  c.footer.text = "#e9e1d3";

  const hero: SectionConfig = {
    id: "hero",
    type: "hero",
    visible: true,
    settings: {
      /* a title in both languages, never a copy of the store name (that would stay behind when he renames the store) */
      title: o.samples ? bi("Noir Blanc", "Noir Blanc") : bi("Made to last", "صُنع ليدوم"),
      subtitle: o.samples ? bi("A soft, sweet scent for every hour", "عطرٌ حلوٌ ناعم لكل الأوقات") : bi("A short line about your best product", "سطر قصير عن أفضل منتج لديك"),
      button: bi("Shop now", "تسوّق الآن"),
      backgrounds: [{ kind: "color", color: "#f8f6f2", image: "" }],
      autoplay: false,
      seconds: 5,
      showCards: false,
      layout: "split",
      /* the title is set in the elegant serif font, one word to a line */
      titleFont: o.samples ? "elegant" : undefined,
      photo: photo(2),
      photoSide: "end",
      fullWidth: true,
      panelColor: "#f8f6f2",
      eyebrow: bi("The new collection", "المجموعة الجديدة"),
      price: o.samples ? L("23 JOD", "٢٣ د.أ") : "",
      size: o.samples ? bi("30 ml", "٣٠ مل") : bi("", ""),
      button2: bi("Discover the collection", "اكتشف المجموعة"),
    },
  };
  const ribbon: SectionConfig = {
    id: "ribbon",
    type: "ribbon",
    visible: true,
    settings: {
      items: o.samples
        ? [bi("Oud", "عود"), bi("Amber", "عنبر"), bi("Rose", "ورد"), bi("Musk", "مسك"), bi("Saffron", "زعفران"), bi("Vanilla", "فانيلا"), bi("Sandalwood", "صندل"), bi("Leather", "جلد")]
        : [bi("New arrivals", "وصل حديثًا"), bi("Best sellers", "الأكثر طلبًا"), bi("Gifts", "هدايا"), bi("Offers", "عروض")],
      background: "#16120f",
      color: "#c9a46a",
    },
  };
  const tiles: SectionConfig = {
    id: "tiles",
    type: "tiles",
    visible: true,
    settings: {
      title: bi("Collections", "المجموعات"),
      columns: 4,
      style: "editorial",
      items: o.samples ? [tile(3, "Unisex", "مشترك"), tile(11, "Men", "رجالي", "dark"), tile(1, "Women", "نسائي"), tile(7, "Oud", "العود")] : [],
    },
  };
  const featured: SectionConfig = { id: "featured", type: "featured", visible: true, settings: { title: bi("Best sellers", "الأكثر طلبًا"), count: 4 } };
  const banners: SectionConfig = {
    id: "banners",
    type: "banners",
    visible: true,
    settings: {
      height: "tall",
      items: [
        {
          image: photo(7),
          eyebrow: o.samples ? bi("The royal collection", "المجموعة الملكية") : bi("The collection", "مجموعة"),
          title: o.samples ? bi("Oud", "العود") : bi("New collection", "مجموعة جديدة"),
          text: o.samples ? bi("Warm smoke, unforgettable", "دخانٌ دافئ، لا يُنسى") : bi("Discover what is new in our store", "اكتشف الجديد في متجرنا"),
          button: o.samples ? bi("Discover oud", "اكتشف العود") : bi("Shop now", "تسوّق الآن"),
          link: "",
          font: "ruqaa",
          titleColor: "#d9b776",
          panel: "dark",
          position: "top-end",
          buttonStyle: "outline",
          accent: "#c9a46a",
        },
        {
          image: photo(8),
          eyebrow: o.samples ? bi("The collection", "مجموعة") : bi("Our picks", "اخترنا لك"),
          title: o.samples ? bi("Rose", "الورد") : bi("Best sellers", "الأكثر طلبًا"),
          text: o.samples ? bi("Soft as the first morning", "ناعمٌ كأول الصباح") : bi("The pieces our customers love", "ما يحبه عملاؤنا"),
          button: o.samples ? bi("Shop roses", "تسوّقي الورد") : bi("Discover", "اكتشف"),
          link: "",
          font: "lemonada",
          textFont: "amiri",
          titleColor: "#b03a5b",
          panel: "light",
          position: "top-start",
          buttonStyle: "filled",
          accent: "#b03a5b",
        },
      ],
    },
  };
  const arrivals: SectionConfig = { id: "products", type: "products", visible: true, settings: { title: bi("New arrivals", "وصل حديثًا"), columns: 4, showFilters: false, limit: 4 } };
  const reviews: SectionConfig = { id: "reviews", type: "reviews", visible: true, settings: { title: bi("Customer reviews", "آراء العملاء"), items: [] } };
  c.sections = [hero, ribbon, tiles, featured, banners, arrivals, reviews];
  return c;
}
