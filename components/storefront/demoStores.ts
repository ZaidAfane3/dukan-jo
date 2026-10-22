import type { Bi, MarkKey, Review, StorefrontConfig } from "./config";
import { defaultConfig } from "./config";

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
    color: "#2b241d",
    background: "#f6efe6",
    text: "#2a1f16",
    mark: "star",
    logo: "/demo/perfume/logo.png",
    favicon: "/demo/perfume/favicon.png",
    hero: { title: bi("Scents that stay with you", "عطور تبقى معك"), subtitle: bi("Floral, fresh and woody fragrances made to last all day.", "عطور زهرية ومنعشة وخشبية تدوم طوال اليوم."), button: bi("Discover the collection", "اكتشف المجموعة") },
    announcement: [
      { text: bi("Free gift box with every order above 40 JOD", "علبة هدية مجانية مع كل طلب فوق 40 د.أ"), color: "#2b241d" },
      { text: bi("Free delivery across Jordan on orders above 25 JOD", "توصيل مجاني لكل الأردن للطلبات فوق 25 د.أ"), color: "#8a6a3a" },
      { text: bi("New: Midnight Jasmine is back in stock", "جديد: عاد ياسمين الليل إلى المخزون"), color: "#5c4631" },
    ],
    featured: bi("Signature scents", "عطورنا المميزة"),
    products: [
      { name: bi("Rose Garden 50ml", "حديقة الورد 50 مل"), category: bi("Perfumes", "عطور"), price: 48, featured: true, hue: 345 },
      { name: bi("Vanilla Cloud 30ml", "سحابة الفانيلا 30 مل"), category: bi("Perfumes", "عطور"), price: 29, sale: 23, hue: 40 },
      { name: bi("Midnight Jasmine 100ml", "ياسمين الليل 100 مل"), category: bi("Perfumes", "عطور"), price: 62, featured: true, hue: 280 },
      { name: bi("Fresh Citrus Cologne", "كولونيا الحمضيات المنعشة"), category: bi("Cologne", "كولونيا"), price: 21, featured: true, hue: 60 },
      { name: bi("Sandalwood Oil", "دهن الصندل"), category: bi("Oils", "دهون"), price: 26, sale: 20, hue: 25 },
      { name: bi("Lavender Body Mist", "معطّر جسم باللافندر"), category: bi("Body mists", "معطّرات جسم"), price: 14, featured: true, hue: 265 },
      { name: bi("Gift set of three", "طقم هدية ثلاثي"), category: bi("Gifts", "هدايا"), price: 58, sale: 49, hue: 300 },
      { name: bi("Travel atomizer", "بخاخ سفر"), category: bi("Gifts", "هدايا"), price: 9, hue: 190, qty: 0 },
    ],
    reviews: [
      rev(["Lina M.", "لينا م."], ["The rose scent lasts all day and the box is beautiful.", "رائحة الورد تدوم طوال اليوم والعلبة جميلة جدًا."]),
      rev(["Hamza K.", "حمزة ك."], ["A perfect gift. Delivery was fast.", "هدية مثالية، والتوصيل كان سريعًا."]),
      rev(["Rana T.", "رنا ط."], ["Lovely scents, and the prices are fair.", "روائح رائعة وأسعار عادلة."], 4),
    ],
  },
];

export const perfumeStore = demoStores[0];

/** The design of a demo store: the starter design in the store's colors, with its own texts. */
export function demoConfig(d: DemoStore, lang: "en" | "ar"): StorefrontConfig {
  const c = JSON.parse(JSON.stringify(defaultConfig)) as StorefrontConfig;
  c.theme = { ...c.theme, primary: d.color, background: d.background, text: d.text };
  c.identity.logo = { kind: "image", sample: d.mark, image: d.logo };
  c.identity.favicon = d.favicon;
  c.announcement = { show: true, motion: "fade", seconds: 4, messages: d.announcement.map((m) => ({ text: m.text, link: "", color: m.color, textColor: "" })) };
  c.footer.about = d.about;
  /* A made-up registration number, only for the tour */
  c.footer.certificate = { ...c.footer.certificate, kind: "commercial", number: "1058742" };
  c.sections = c.sections.map((s) => {
    if (s.type === "hero") return { ...s, settings: { ...s.settings, title: d.hero.title, subtitle: d.hero.subtitle, button: d.hero.button } };
    if (s.type === "featured") return { ...s, settings: { ...s.settings, title: d.featured } };
    if (s.type === "reviews") return { ...s, settings: { ...s.settings, items: demoReviews(d, lang) } };
    return s;
  });
  return c;
}

export const demoReviews = (d: DemoStore, lang: "en" | "ar"): Review[] => d.reviews.map((r) => ({ name: r.name[lang], text: r.text[lang], stars: r.stars }));
