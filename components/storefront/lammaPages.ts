import type { InfoPage } from "../InfoPages";
import type { Bi, SectionConfig } from "./config";
import { newNewsletter } from "./config";

/* The sub pages of "Lamma": one for each colored button of the home page (Men, Women, Hoodies, T-shirts, Pants, Accessories).
   Every button, banner and menu link of the theme leads to one of them. Each page is built with the store designer's own elements:
   a color card with the picture, quick buttons to the other pages, a row of picks, a tinted note and the newsletter. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

/** The id of each page. They are fixed, so the links of the theme can point at them. */
export const lammaPageId = { men: 9101, women: 9102, hoodies: 9103, tees: 9104, pants: 9105, accessories: 9106, about: 9107, contact: 9108 } as const;
export type LammaPage = keyof typeof lammaPageId;
export const lammaLink = (k: LammaPage) => `page:${lammaPageId[k]}`;

type Spec = {
  key: "men" | "women" | "hoodies" | "tees" | "pants" | "accessories";
  name: Bi;
  color: string;
  eyebrow: Bi;
  blurb: Bi;
  pictures: string[];
  shape: "arch" | "tilt";
  productIds: number[];
  picksTitle: Bi;
  noteTitle: Bi;
  noteBody: Bi;
};

/* The made-up products are numbered -1 to -18 (see lammaProducts) */
const specs: Spec[] = [
  {
    key: "men",
    name: bi("Men", "رجالي"),
    color: "#b9f3d0",
    eyebrow: bi("✿ The guys' corner", "✿ ركن الشباب"),
    blurb: bi("Easy pieces that go with everything, from the first coffee to the last hangout.", "قطع سهلة تمشي مع كل شيء، من قهوة الصباح لآخر طلعة."),
    pictures: ["polo-zip"],
    shape: "arch",
    productIds: [-1, -2, -3, -4, -9, -10],
    picksTitle: bi("Picked for you ♥", "اخترناها لك ♥"),
    noteTitle: bi("Not sure about the size?", "محتار بالمقاس؟"),
    noteBody: bi("Take one size up for a relaxed fit. Changing it is free within 14 days.", "خذ مقاس أكبر لقصّة مريحة. والتبديل مجاني خلال ١٤ يومًا."),
  },
  {
    key: "women",
    name: bi("Women", "نسائي"),
    color: "#ff8fb1",
    eyebrow: bi("✿ Made to be loved", "✿ صُنعت لتُحَب"),
    blurb: bi("Soft fabrics, warm colors and little details you will notice every time you wear them.", "أقمشة ناعمة وألوان دافية وتفاصيل صغيرة تلاحظينها كل مرة تلبسينها."),
    pictures: ["cardigan"],
    shape: "tilt",
    productIds: [-24, -12, -5, -7, -9, -11],
    picksTitle: bi("Picked for you ♥", "اخترناها لك ♥"),
    noteTitle: bi("A new piece every week", "قطعة جديدة كل أسبوع"),
    noteBody: bi("Join the club below and be the first to see what lands in the wardrobe.", "انضمي للنادي تحت وكوني أول من يشوف الجديد على الخزانة."),
  },
  {
    key: "hoodies",
    name: bi("Hoodies", "هوديز"),
    color: "#ffe36e",
    eyebrow: bi("✿ Cozy season", "✿ موسم الدفا"),
    blurb: bi("Thick, soft and a little oversized. The kind you never want to take off.", "سميكة وناعمة وقصّتها واسعة شوي. من النوع اللي ما تبغى تقلعه."),
    pictures: ["hoodie-grey"],
    shape: "arch",
    productIds: [-1, -5, -13, -14, -3, -9],
    picksTitle: bi("Hoodie of the day ♥", "هودي اليوم ♥"),
    noteTitle: bi("Wash cold, wear forever", "غسيل بارد، ولبس للأبد"),
    noteBody: bi("Turn it inside out and wash it cold, and the color stays as bright as day one.", "اقلبها وغسلها ببارد، ويبقى لونها زي أول يوم."),
  },
  {
    key: "tees",
    name: bi("T-shirts", "تيشيرتات"),
    color: "#c9b6ff",
    eyebrow: bi("✿ Everyday colors", "✿ ألوان كل يوم"),
    blurb: bi("Cotton that breathes, prints that talk and colors that make the day lighter.", "قطن يتنفّس، وطبعات تحكي، وألوان تخلّي اليوم أخف."),
    pictures: ["tee-boston"],
    shape: "tilt",
    productIds: [-2, -6, -15, -10, -12, -1],
    picksTitle: bi("Tees you will love ♥", "تيشيرتات بتحبها ♥"),
    noteTitle: bi("Two for one mood", "اثنين أحسن من واحد"),
    noteBody: bi("Tees look better in pairs. Pick two colors and mix them all week.", "التيشيرتات أحلى بالزوج. اختر لونين وبدّلهم طول الأسبوع."),
  },
  {
    key: "pants",
    name: bi("Pants", "بناطيل"),
    color: "#ffb787",
    eyebrow: bi("✿ Fits like a dream", "✿ قصّة تريّح"),
    blurb: bi("Wide, straight or short. A cut for every walk and every mood.", "واسع أو مستقيم أو قصير. قصّة لكل مشوار ولكل مزاج."),
    pictures: ["trousers"],
    shape: "arch",
    productIds: [-4, -7, -11, -19, -20, -21],
    picksTitle: bi("Pants of the week ♥", "بناطيل الأسبوع ♥"),
    noteTitle: bi("The perfect length", "الطول المضبوط"),
    noteBody: bi("Every pair comes with a length guide, so the hem lands right where you want it.", "كل بنطلون معه دليل الأطوال، فتنزل الأطراف بالمكان اللي تبغاه."),
  },
  {
    key: "accessories",
    name: bi("Accessories", "إكسسوارات"),
    color: "#ffe36e",
    eyebrow: bi("✿ The little things", "✿ التفاصيل الصغيرة"),
    blurb: bi("Caps, sunglasses and bracelets. One small thing and the whole look changes.", "كابات ونظارات وأساور. شغلة صغيرة وكل الإطلالة تتغير."),
    pictures: ["sunglasses", "cap-green", "bracelet"],
    shape: "tilt",
    productIds: [-16, -8, -17, -18, -22, -23],
    picksTitle: bi("Finishing touches ♥", "اللمسة الأخيرة ♥"),
    noteTitle: bi("Gift it with a smile", "أهدِها بابتسامة"),
    noteBody: bi("Every accessory can be wrapped in our colorful gift bag, free.", "أي إكسسوار نغلّفه لك بكيس الهدايا الملوّن، مجانًا."),
  },
];

const chipColor: Record<string, string> = { men: "#c9b6ff", women: "#ff8fb1", hoodies: "#ffe36e", tees: "#b9f3d0", pants: "#ffffff", accessories: "#ffb787" };

/** The six pages (and the two of the header: about us and contact us), ready to be saved as the store's pages (they are published, and the store designer can edit every element in them) */
export function lammaPages(): InfoPage[] {
  const now = Date.now();
  return [...categoryPages(now), ...servicePages(now)];
}

function categoryPages(now: number): InfoPage[] {
  return specs.map((s, n) => {
    const photo = (f: string) => `/demo/lamma/${f}.jpg`;
    const hero: SectionConfig = {
      id: "hero",
      type: "banners",
      visible: true,
      settings: {
        height: "normal",
        items: [
          {
            image: photo(s.pictures[0]),
            images: s.pictures.slice(1).map(photo),
            /* the page already has its own title (the name), so the card says the catchy line big and the name small */
            eyebrow: bi(`✿ ${s.name.en}`, `✿ ${s.name.ar}`),
            title: bi(s.eyebrow.en.replace("✿ ", ""), s.eyebrow.ar.replace("✿ ", "")),
            text: s.blurb,
            button: bi("See the picks", "شوف الاختيارات"),
            link: "items",
            variant: "card" as const,
            bg: s.color,
            shape: s.shape,
            accent: "#2b1b47",
            titleSize: 60,
            eyebrowSize: 22,
          },
        ],
      },
    };
    const chips: SectionConfig = {
      id: "chips",
      type: "chips",
      visible: true,
      settings: {
        items: specs
          .filter((x) => x.key !== s.key)
          .map((x) => ({ label: x.name, color: chipColor[x.key], link: lammaLink(x.key) })),
      },
    };
    const items: SectionConfig = {
      id: "items",
      type: "collection",
      visible: true,
      settings: { title: s.picksTitle, productIds: s.productIds, count: s.productIds.length, columns: 3 },
    };
    const note: SectionConfig = {
      id: "note",
      type: "text",
      visible: true,
      settings: { title: s.noteTitle, body: s.noteBody, align: "center", tint: true },
    };
    /* The women's page has one more row: two big color cards with the pieces of the week */
    const week: SectionConfig = {
      id: "week",
      type: "banners",
      visible: true,
      settings: {
        height: "normal",
        items: [
          { image: photo("blouse-stripes"), eyebrow: bi("New for your wardrobe", "جديد على خزانتك ✿"), title: bi("“Sky” blouse", "بلوزة «سماء»"), text: bi("Soft stripes and a bow at the waist", "خطوط ناعمة وفيونكة على الخصر"), button: bi("Take a look", "شوفيها"), link: "items", variant: "card" as const, bg: "#d6c8ff", shape: "arch" as const, accent: "#2b1b47", titleSize: 42, eyebrowSize: 20 },
          { image: photo("skirt-pleated"), eyebrow: bi("You have to try it", "لازم تجربيها ✿"), title: bi("“Coffee” skirt", "تنورة «قهوة»"), text: bi("A classic with a warm touch", "كلاسيك بلمسة دفا"), button: bi("Take a look", "شوفيها"), link: "items", variant: "card" as const, bg: "#ffe36e", shape: "tilt" as const, accent: "#2b1b47", titleSize: 42, eyebrowSize: 20 },
        ],
      },
    };
    const news = newNewsletter("newsletter");
    if (news.type === "newsletter") {
      news.settings.title = bi("Join the Lamma club", "انضم لنادي لَمّة");
      news.settings.accentWord = bi("Lamma", "لَمّة");
    }
    return {
      id: lammaPageId[s.key],
      type: 0 as const,
      published: true,
      footer: false,
      title: s.name,
      content: bi("", ""),
      created: now - n * 1000,
      sections: s.key === "women" ? [hero, chips, items, week, note, news] : [hero, chips, items, note, news],
    };
  });
}

/* About us and Contact us: the two pages of the header menu, with the same colors and touches */
function servicePages(now: number): InfoPage[] {
  const card = (o: { image: string; images?: string[]; eyebrow: Bi; title: Bi; text: Bi; button: Bi; link: string; bg: string; shape: "arch" | "tilt" }): SectionConfig => ({
    id: "hero",
    type: "banners",
    visible: true,
    settings: { height: "normal", items: [{ ...o, variant: "card" as const, accent: "#2b1b47", titleSize: 60, eyebrowSize: 22 }] },
  });
  const note = (id: string, title: Bi, body: Bi, tint: boolean): SectionConfig => ({ id, type: "text", visible: true, settings: { title, body, align: "center", tint } });
  const news = () => {
    const n = newNewsletter("newsletter");
    if (n.type === "newsletter") {
      n.settings.title = bi("Join the Lamma club", "انضم لنادي لَمّة");
      n.settings.accentWord = bi("Lamma", "لَمّة");
    }
    return n;
  };
  const chips = (links: { label: Bi; color: string; link: string }[]): SectionConfig => ({ id: "chips", type: "chips", visible: true, settings: { items: links } });
  const cats = specs.slice(0, 3).map((x) => ({ label: x.name, color: chipColor[x.key], link: lammaLink(x.key) }));

  return [
    {
      id: lammaPageId.about,
      type: 0 as const,
      published: true,
      footer: true,
      title: bi("About us", "من نحن"),
      content: bi("", ""),
      created: now - 6000,
      sections: [
        card({ image: "/demo/lamma/jacket-black.jpg", eyebrow: bi("✿ Who we are", "✿ مين إحنا"), title: bi("Clothes with a smile", "ملابس بابتسامة"), text: bi("Lamma started with a few friends and a love for colors. Today we dress hundreds of people, one happy piece at a time.", "بدأت لَمّة بكم صديق وحب للألوان. اليوم نلبّس مئات الناس، قطعة مبهجة بعد قطعة."), button: bi("Meet the pieces", "تعرّف على القطع"), link: lammaLink("men"), bg: "#c9b6ff", shape: "arch" }),
        note("story", bi("Our story", "قصتنا"), bi("We wanted clothes that feel good and look fun, without the big price. So we picked soft fabrics, bright colors and cuts that fit everyone.", "بغينا ملابس مريحة وشكلها حلو، بدون سعر كبير. فاخترنا أقمشة ناعمة وألوان مشرقة وقصّات تناسب الكل."), true),
        chips(cats),
        note("promise", bi("Our promise", "وعدنا لك"), bi("Free exchange within 14 days, honest sizes and a real person who answers your messages.", "تبديل مجاني خلال ١٤ يومًا، ومقاسات صادقة، وشخص حقيقي يرد على رسائلك."), false),
        news(),
      ],
    },
    {
      id: lammaPageId.contact,
      type: 0 as const,
      published: true,
      footer: true,
      title: bi("Contact us", "تواصل معنا"),
      content: bi("", ""),
      created: now - 7000,
      sections: [
        card({ image: "/demo/lamma/polo2.jpg", eyebrow: bi("✿ We love to hear from you", "✿ نحب نسمع منك"), title: bi("Say hello", "قل مرحبا"), text: bi("A question about a size, an order or just a color? We answer fast, and we are friendly.", "سؤال عن مقاس أو طلب أو حتى لون؟ نرد بسرعة وبأسلوب لطيف."), button: bi("Write to us", "اكتب لنا"), link: "newsletter", bg: "#b9f3d0", shape: "tilt" }),
        note("how", bi("Reach us", "طرق التواصل"), bi("Phone and WhatsApp: 70 000 0000\nEmail: hello@lamma.store\nAmman, Jordan", "الهاتف والواتساب: ⁦70 000 0000⁩\nالبريد: hello@lamma.store\nعمّان، الأردن"), true),
        note("hours", bi("Working hours", "أوقات الدوام"), bi("Every day from 10 am to 10 pm. On Fridays from 2 pm.", "كل يوم من ١٠ صباحًا إلى ١٠ مساءً. والجمعة من ٢ ظهرًا."), false),
        news(),
      ],
    },
  ];
}
