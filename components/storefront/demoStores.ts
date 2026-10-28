import { atelierConfig } from "./atelierTheme";
import type { Bi, MarkKey, Review, StorefrontConfig } from "./config";

/* A made-up store for the platform tour (/demo). Everything here is invented: the names, products,
   prices, reviews and phone numbers belong to no real store or customer. The tour never reads
   or writes the browser's saved data, so it cannot show (or change) anything of a real merchant. */

type P = { name: Bi; category: Bi; price: number; sale?: number; featured?: boolean; hue: number; qty?: number };

export type DemoStore = {
  id: string;
  name: Bi;
  about: Bi;
  color: string;
  background: string;
  text: string;
  mark: MarkKey;
  /* The brand's own logo and tab icon (files in /public/demo/perfume) */
  logo: string;
  favicon: string;
  hero: { title: Bi; subtitle: Bi; button: Bi };
  announcement: { text: Bi; color: string }[];
  featured: Bi;
  products: P[];
  reviews: { name: Bi; text: Bi; stars: Review["stars"] }[];
};

const rev = (name: [string, string], text: [string, string], stars: Review["stars"] = 5) => ({ name: { en: name[0], ar: name[1] }, text: { en: text[0], ar: text[1] }, stars });
const bi = (en: string, ar: string): Bi => ({ en, ar });

export const demoStores: DemoStore[] = [
  {
    id: "perfume",
    name: bi("Perfume Store", "متجر عطور"),
    about: bi("Fine fragrances and body mists, made in small batches.", "عطور راقية ومعطّرات جسم، تُصنع بكميات صغيرة."),
    color: "#1c1a17",
    background: "#f7f2ea",
    text: "#1c1a17",
    mark: "star",
    logo: "/demo/perfume/logo.png",
    favicon: "/demo/perfume/favicon.png",
    hero: { title: bi("Noir Blanc", "Noir Blanc"), subtitle: bi("A soft, sweet scent for every hour", "عطرٌ حلوٌ ناعم لكل الأوقات"), button: bi("Shop now", "تسوّق الآن") },
    announcement: [
      { text: bi("Free gift box with every order above 40 JOD", "علبة هدية مجانية مع كل طلب فوق 40 د.أ"), color: "#2b241d" },
      { text: bi("Free delivery across Jordan on orders above 25 JOD", "توصيل مجاني لكل الأردن للطلبات فوق 25 د.أ"), color: "#8a6a3a" },
      { text: bi("New: Cuir Curcuma is back in stock", "جديد: عاد كوير كركوما إلى المخزون"), color: "#5c4631" },
    ],
    featured: bi("Best sellers", "الأكثر طلبًا"),
    products: [
      { name: bi("Rose Garden 50ml", "حديقة الورد 50 مل"), category: bi("Perfumes", "عطور"), price: 48, featured: true, hue: 345 },
      { name: bi("Noir Blanc 30ml", "نوار بلان 30 مل"), category: bi("Perfumes", "عطور"), price: 29, sale: 23, hue: 40 },
      { name: bi("Cuir Curcuma 50ml", "كوير كركوما 50 مل"), category: bi("Perfumes", "عطور"), price: 62, featured: true, hue: 30 },
      { name: bi("Golden Leather 100ml", "جولدن ليذر 100 مل"), category: bi("Perfumes", "عطور"), price: 74, featured: true, hue: 40 },
      { name: bi("Black Piano 50ml", "بلاك بيانو 50 مل"), category: bi("Perfumes", "عطور"), price: 44, featured: true, hue: 120 },
      { name: bi("Myst Oud 50ml", "مست عود 50 مل"), category: bi("Perfumes", "عطور"), price: 56, sale: 49, hue: 20 },
      { name: bi("Xanat Trio Gift Set", "طقم زانات الثلاثي"), category: bi("Gifts", "هدايا"), price: 58, sale: 49, featured: true, hue: 300 },
    ],
    reviews: [
      rev(["Lina M.", "لينا م."], ["The rose scent lasts all day and the box is beautiful.", "رائحة الورد تدوم طوال اليوم والعلبة جميلة جدًا."]),
      rev(["Hamza K.", "حمزة ك."], ["A perfect gift. Delivery was fast.", "هدية مثالية، والتوصيل كان سريعًا."]),
      rev(["Rana T.", "رنا ط."], ["Lovely scents, and the prices are fair.", "روائح رائعة وأسعار عادلة."], 4),
    ],
  },
];

export const perfumeStore = demoStores[0];

/** The design of a demo store: the "Misk" theme (atelier) with the made-up store's pictures, logo and texts. */
export function demoConfig(d: DemoStore, lang: "en" | "ar"): StorefrontConfig {
  const c = atelierConfig(lang, { samples: true });
  c.identity.logo = { kind: "image", sample: d.mark, image: d.logo };
  c.identity.favicon = d.favicon;
  c.footer.about = d.about;
  /* A made-up registration number, only for the tour */
  c.footer.certificate = { ...c.footer.certificate, kind: "commercial", number: "1058742" };
  c.sections = c.sections.map((x) => (x.type === "reviews" ? { ...x, settings: { ...x.settings, items: demoReviews(d, lang) } } : x));
  return c;
}

export const demoReviews = (d: DemoStore, lang: "en" | "ar"): Review[] => d.reviews.map((r) => ({ name: r.name[lang], text: r.text[lang], stars: r.stars }));
