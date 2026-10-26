import type { Lang } from "../content";
import type { Bi, SectionConfig, StorefrontConfig } from "./config";
import { defaultConfig } from "./config";
import { lujainLink } from "./lujainPages";
import type { StoreProduct } from "./useStoreData";

/* "Lujain" (لُجَين): quiet luxury for fine jewelry, written only with what the store designer offers (the round-photo hero in thin
   rings, round category pictures, ornament titles, a light band of selected pieces, a centered statement, hairlines).
   Deep emerald, gold accents and ivory, El Messiri for titles and Almarai for text, square buttons, lots of room.
   With `samples` the photos, prices and words of a made-up jewelry store are filled in (previews and /saad).
   Without them the merchant gets the structure, the fonts and the colors, and adds his own pictures. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

export function lujainConfig(lang: Lang, o: { samples: boolean; storeName?: string }): StorefrontConfig {
  const c = JSON.parse(JSON.stringify(defaultConfig)) as StorefrontConfig;
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const S = o.samples;
  const photo = (f: string) => (S ? `/demo/lujain/${f}.jpg` : "");
  const name = o.storeName?.trim() || L("Your store", "متجرك");
  const page = (k: Parameters<typeof lujainLink>[0], fallback = "") => (S ? lujainLink(k) : fallback);

  /* primary is left empty: the theme follows the store color (the made-up store uses the same gold) */
  c.theme = { ...c.theme, primary: "", background: "#0f2a22", text: "#f2eee6", titleColor: "", radius: "none", font: "almarai", headingFont: "messiri", accent: "#c9b48e", titleStyle: "ornament", hairlines: true, spacing: "airy" };
  c.texture = { pattern: "none", watermark: bi("", "") };
  c.header = { ...c.header, showSearch: false, showLanguage: false, showUser: false, showCart: true, showMenu: false, sticky: true };
  c.nav = {
    style: "links",
    place: "start",
    cartLook: "text",
    links: [
      { ...bi("Rings", "خواتم"), to: page("rings", "products") },
      { ...bi("Necklaces", "قلائد"), to: page("necklaces", "products") },
      { ...bi("Earrings", "أقراط"), to: page("earrings", "products") },
      { ...bi("Bracelets", "أساور"), to: page("bracelets", "products") },
    ],
  };
  c.identity = { ...c.identity, showLogo: false, align: "center", nameFont: "messiri", nameColor: "#e2c27a", tagline: S ? bi("LUJAIN · FINE JEWELRY", "LUJAIN · FINE JEWELRY") : bi("", "") };
  c.announcement = { ...c.announcement, show: false };
  c.cards = { ...c.cards, style: "flat", image: "portrait", info: "center", add: "wide", showCategory: false, showHeart: false, showNotes: true, showBadge: false, showStock: false, showOldPrice: true, priceColor: "" };
  c.footer = { ...c.footer, style: "simple", background: "", text: "" };
  c.footer.about = bi("", "");
  c.footer.columns = [
    { id: "about", kind: "about", visible: true },
    { id: "links", kind: "custom", visible: true, title: bi("", ""), links: [
      { id: "care", label: bi("Caring for your jewelry", "العناية بالمجوهرات"), link: page("care"), visible: true },
      { id: "sizes", label: bi("Ring sizes", "مقاسات الخواتم"), link: page("sizes"), visible: true },
      { id: "shipping", label: bi("Shipping", "الشحن"), link: page("shipping"), visible: true },
      { id: "contact", label: bi("Contact us", "تواصل معنا"), link: page("contact"), visible: true },
    ] },
    { id: "pages", kind: "pages", visible: false },
    { id: "contact", kind: "contact", visible: false },
    { id: "social", kind: "social", visible: false },
    { id: "licenses", kind: "licenses", visible: false },
  ];

  const hero: SectionConfig = {
    id: "hero",
    type: "hero",
    visible: true,
    settings: {
      eyebrow: S ? bi("The Emerald Edit", "The Emerald Edit") : bi("A short line", "سطر قصير"),
      title: S ? bi("An emerald\nthat's like you", "زُمرّدٌ\nيُشبهك") : bi(name, name),
      accentWord: S ? bi("that's like you", "يُشبهك") : bi("", ""),
      subtitle: S ? bi("Pieces handmade from 18K gold and 925 silver with natural stones, given and kept.", "قطع مصنوعة يدوياً من الذهب عيار ١٨ والفضة عيار ٩٢٥ وأحجار طبيعية، تُهدى وتبقى.") : bi("A line about your pieces", "سطر عن قطعك"),
      button: bi("Shop the collection", "تسوّق المجموعة"),
      button2: bi("Visit our showroom", "زوري معرضنا"),
      link: "selected",
      link2: page("appointment"),
      backgrounds: [{ kind: "color", color: "#0f2a22", image: "" }],
      autoplay: false,
      seconds: 5,
      showCards: false,
      layout: "orbit",
      photo: photo("hero-emerald"),
      size: S ? bi("“Zumurrud” necklace", "قلادة «زمرّد»") : bi("", ""),
      /* the price as the page shows it; he writes his own */
      price: S ? "٢٩٠ د.أ" : "",
      popColors: { accent: "#e2c27a", sticker: "#f2eee6" },
    },
  };

  const pieces: SectionConfig = {
    id: "pieces",
    type: "tiles",
    visible: true,
    settings: {
      title: bi("Shop by piece", "تسوّقي حسب القطعة"),
      columns: 4,
      style: "circles",
      items: [
        { image: photo("cat-rings"), label: bi("Rings", "خواتم"), link: page("rings") },
        { image: photo("cat-earrings"), label: bi("Earrings", "أقراط"), link: page("earrings") },
        { image: photo("cat-necklaces"), label: bi("Necklaces", "قلائد"), link: page("necklaces") },
        { image: photo("cat-bracelets"), label: bi("Bracelets", "أساور"), link: page("bracelets") },
      ],
    },
  };

  /* A second row of circles: by stone or metal */
  const materials: SectionConfig = {
    id: "materials",
    type: "tiles",
    visible: true,
    settings: {
      title: bi("Shop by stone or metal", "تسوّقي حسب الحجر أو المعدن"),
      columns: 3,
      style: "circles",
      items: [
        { image: photo("cat-gold"), label: bi("Gold", "ذهب"), link: page("gold") },
        { image: photo("cat-silver"), label: bi("Silver", "فضة"), link: page("silver") },
        { image: photo("cat-diamond"), label: bi("Diamonds", "ألماس"), link: page("diamond") },
      ],
    },
  };

  /* Our bracelets: one row of every bracelet, gold and silver, that slides with its arrows */
  const bracelets: SectionConfig = { id: "bracelets", type: "collection", visible: true, settings: { title: bi("Our bracelets", "أساورنا"), productIds: [-3, -5, -8, -9, -10], count: 5, columns: 3, link: page("bracelets") } };

  const selected: SectionConfig = { id: "selected", type: "collection", visible: true, settings: { title: bi("Selected pieces", "قطع مختارة"), productIds: [-1, -2, -3], count: 3, columns: 3, link: page("all"), background: "#f2eee6", color: "#0f2a22" } };

  const bespoke: SectionConfig = {
    id: "bespoke",
    type: "text",
    visible: true,
    settings: {
      eyebrow: bi("Bespoke", "Bespoke"),
      title: bi("Your name… engraved in gold", "اسمكِ… محفورٌ بالذهب"),
      body: bi("We design your name necklace in the Arabic script you choose, and it arrives in a gift box.", "نصمّم قلادة الاسم بالخط العربي الذي تختارينه، وتصلك في علبة هدية."),
      align: "center",
      tint: false,
      style: "statement",
      button: bi("Order a name necklace", "اطلبي قلادة باسمك"),
      link: page("bespoke"),
      trust: [bi("One-year warranty", "ضمان سنة على الصياغة"), bi("Gift wrapping", "تغليف هدية"), bi("Exchange within 14 days", "استبدال خلال ١٤ يوماً")],
    },
  };

  c.sections = [hero, pieces, materials, selected, bracelets, bespoke];
  return c;
}

/** The made-up pieces a Lujain preview is shown with (real photos, see public/demo/lujain) */
export function lujainProducts(lang: Lang): StoreProduct[] {
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const mk = (i: number, en: string, ar: string, price: number, cat: [string, string], notes: [string, string], img: string): StoreProduct => ({
    id: -(i + 1),
    name: L(en, ar),
    category: L(...cat),
    price,
    sale: null,
    featured: true,
    quantity: 4,
    hue: 150,
    notes: L(...notes),
    image: `/demo/lujain/${img}.jpg`,
  });
  const rings: [string, string] = ["Rings", "خواتم"];
  const necklaces: [string, string] = ["Necklaces", "قلائد"];
  const earrings: [string, string] = ["Earrings", "أقراط"];
  const bracelets: [string, string] = ["Bracelets", "أساور"];
  return [
    mk(0, "“Samaa” ring", "خاتم «سماء»", 120, rings, ["18K white gold · blue topaz", "ذهب أبيض عيار ١٨ · توباز أزرق"], "ring-samaa"),
    mk(1, "“Luluah” earrings", "أقراط «لؤلؤة»", 185, earrings, ["18K white gold · lab-grown diamonds", "ذهب أبيض عيار ١٨ · ألماس مختبري"], "earrings-luluah"),
    mk(2, "“Jamra” bracelet", "سوار «جمرة»", 340, bracelets, ["21K yellow gold · Cuban chain", "ذهب أصفر عيار ٢١ · سلسلة كوبية"], "gold-bracelet-jamra"),
    mk(3, "“Zumurrud” necklace", "قلادة «زمرّد»", 290, necklaces, ["925 silver, rhodium plated · natural emerald", "فضة عيار ٩٢٥ مطلية بالروديوم · زمرّد طبيعي"], "hero-emerald"),
    mk(4, "“Sahm” bracelet", "سوار «سهم»", 260, bracelets, ["18K yellow gold · white zircon", "ذهب أصفر عيار ١٨ · زركون أبيض"], "gold-bracelet-sahm"),
    mk(5, "“Najma” necklace", "قلادة «نجمة»", 420, necklaces, ["925 silver · emerald-cut zircon", "فضة عيار ٩٢٥ · زركون بقصّة زمرّدية"], "necklace-najma"),
    mk(6, "“Daw” earrings", "أقراط «ضوء»", 160, earrings, ["925 silver · emerald-cut zircon", "فضة عيار ٩٢٥ · زركون بقصّة زمرّدية"], "dimaonds2"),
    mk(7, "“Sanabel” bracelet", "سوار «سنابل»", 230, bracelets, ["18K yellow gold · nail design", "ذهب أصفر عيار ١٨ · تصميم مسماري"], "gold-bracelet-sanabel"),
    mk(8, "“Nada” bracelet", "سوار «ندى»", 280, bracelets, ["14K white gold · white zircon", "ذهب أبيض عيار ١٤ · زركون أبيض"], "bracelet-nada"),
    mk(9, "“Lamaa” bracelet", "سوار «لمعة»", 310, bracelets, ["925 silver · set zircon", "فضة عيار ٩٢٥ · زركون مرصوص"], "diamonds"),
  ];
}
