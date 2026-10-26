import type { InfoPage } from "../InfoPages";
import type { Bi, SectionConfig } from "./config";

/* The pages of "Lujain" (fine jewelry): one for each link of the header (rings, necklaces, earrings, bracelets), all the pieces,
   a booking, a custom piece, and the pages of the footer. Every button of the theme leads to one of them. They belong to the
   theme's own copy (each theme keeps its own pages), and each is built with the designer's elements, so all of it can be edited. */

const bi = (en: string, ar: string): Bi => ({ en, ar });

/** The id of each page. They are fixed, so the links of the theme can point at them. */
export const lujainPageId = { rings: 9211, necklaces: 9212, earrings: 9213, bracelets: 9214, all: 9215, appointment: 9216, bespoke: 9217, care: 9218, sizes: 9219, shipping: 9220, contact: 9221, gold: 9222, silver: 9223, diamond: 9224 } as const;
export const lujainLink = (k: keyof typeof lujainPageId) => `page:${lujainPageId[k]}`;

const pieces = (title: Bi, productIds: number[]): SectionConfig => ({ id: "items", type: "collection", visible: true, settings: { title, productIds, count: productIds.length, columns: 3 } });
const statement = (id: string, eyebrow: Bi, title: Bi, body: Bi, button: Bi, link: string, trust: Bi[] = []): SectionConfig => ({ id, type: "text", visible: true, settings: { title, body, align: "center", tint: false, style: "statement", eyebrow, button, link, trust } });
const bespoke = () =>
  statement("bespoke", bi("Bespoke", "Bespoke"), bi("Your name… engraved in gold", "اسمكِ… محفورٌ بالذهب"), bi("We design your name necklace in the Arabic script you choose, and it arrives in a gift box.", "نصمّم قلادة الاسم بالخط العربي الذي تختارينه، وتصلك في علبة هدية."), bi("Order a name necklace", "اطلبي قلادة باسمك"), lujainLink("bespoke"));

/** The pages, ready to be saved in the theme's own list of pages */
export function lujainPages(): InfoPage[] {
  const now = Date.now();
  let n = 0;
  const page = (k: keyof typeof lujainPageId, title: Bi, content: Bi, sections: SectionConfig[], footer = false): InfoPage => ({ id: lujainPageId[k], type: 0, published: true, footer, title, content, created: now - n++ * 1000, sections });
  /* The made-up pieces are numbered -1 to -10 (see lujainProducts) */
  return [
    page("rings", bi("Rings", "خواتم"), bi("Rings for every day and for the days you remember. 18K gold and 925 silver · natural and lab-grown stones", "خواتم لكل يوم ولليوم اللي ما يُنسى. ذهب عيار ١٨ وفضة عيار ٩٢٥ · أحجار طبيعية ومختبرية"), [pieces(bi("Our rings", "خواتمنا"), [-1]), bespoke()]),
    page("necklaces", bi("Necklaces", "قلائد"), bi("Fine chains and pendants that sit close to the heart.", "سلاسل ناعمة وقلائد تبقى قريبة من القلب."), [pieces(bi("Our necklaces", "قلائدنا"), [-4, -6]), bespoke()]),
    page("earrings", bi("Earrings", "أقراط"), bi("Small lights that frame the face.", "أضواء صغيرة تحيط بالوجه."), [pieces(bi("Our earrings", "أقراطنا"), [-2, -7]), bespoke()]),
    page("bracelets", bi("Bracelets", "أساور"), bi("Gold and silver bracelets, alone or stacked together.", "أساور ذهب وفضة، وحدها أو مع بعضها."), [pieces(bi("Our bracelets", "أساورنا"), [-3, -5, -8, -9, -10]), bespoke()]),
    page("gold", bi("Gold", "ذهب"), bi("Yellow and white gold, 14K to 21K.", "ذهب أصفر وأبيض، من عيار ١٤ حتى عيار ٢١."), [pieces(bi("Gold pieces", "قطع الذهب"), [-3, -5, -8, -1, -2, -9]), bespoke()]),
    page("silver", bi("Silver", "فضة"), bi("925 silver, rhodium plated so it keeps its shine.", "فضة عيار ٩٢٥ مطلية بالروديوم لتبقى لامعة."), [pieces(bi("Silver pieces", "قطع الفضة"), [-4, -6, -7, -10]), bespoke()]),
    page("diamond", bi("Diamonds", "ألماس"), bi("Lab-grown diamonds and fine zircon, cut to catch the light.", "ألماس مختبري وزركون فاخر، مقطوع ليلتقط الضوء."), [pieces(bi("Pieces that sparkle", "قطع تلمع"), [-2, -9, -10, -1]), bespoke()]),
    page("all", bi("All the pieces", "كل القطع"), bi("", ""), [
      { id: "products", type: "products", visible: true, settings: { title: bi("Every piece", "كل القطع"), columns: 3, showFilters: true } },
      bespoke(),
    ]),
    page("appointment", bi("Visit our showroom", "زوري معرضنا"), bi("See the pieces in person, try them on and ask us anything. Amman, Abdoun · Saturday to Thursday, 11 am to 8 pm", "شوفي القطع على الطبيعة، جرّبيها واسألينا عن كل شيء. عمّان، عبدون · من السبت إلى الخميس، ١١ صباحاً حتى ٨ مساءً"), [
      statement("book", bi("By appointment", "By appointment"), bi("A quiet hour, just for you", "ساعة هادئة لكِ وحدكِ"), bi("Choose a day and a time and we will prepare the pieces you like before you arrive. Book by WhatsApp on 07 9000 0000.", "اختاري اليوم والوقت، ونجهّز لكِ القطع اللي تحبينها قبل ما توصلي. احجزي على واتساب ٠٧٩٠٠٠٠٠٠٠."), bi("Contact us", "تواصلي معنا"), lujainLink("contact")),
    ]),
    page("bespoke", bi("Order a name necklace", "اطلبي قلادة باسمك"), bi("Tell us the name, the script and the metal. We send a drawing to approve before we make it. Ready in 7 to 10 days · from 90 JOD", "قولي لنا الاسم والخط والمعدن، ونرسل لكِ رسمة توافقين عليها قبل التنفيذ. جاهزة خلال ٧ إلى ١٠ أيام · تبدأ من ٩٠ د.أ"), [
      statement("how", bi("How it works", "How it works"), bi("Three steps to your piece", "ثلاث خطوات لقطعتك"), bi("1. Send us the name and the script you like\n2. Approve the drawing and the price\n3. We make it and deliver it in a gift box", "١. أرسلي الاسم والخط اللي يعجبك\n٢. وافقي على الرسمة والسعر\n٣. نصنعها ونوصلها في علبة هدية"), bi("Contact us", "تواصلي معنا"), lujainLink("contact"), [bi("Gift wrapping", "تغليف هدية"), bi("One-year warranty", "ضمان سنة")]),
    ], true),
    page("care", bi("Caring for your jewelry", "العناية بالمجوهرات"), bi("Keep each piece in its own pouch, away from perfume and water.\nWipe it gently with a soft cloth after wearing.\nWe clean and polish your piece for free once a year.", "احفظي كل قطعة في كيسها، بعيداً عن العطر والماء.\nامسحيها بلطف بقطعة قماش ناعمة بعد اللبس.\nننظّف قطعتك ونلمّعها مجاناً مرة كل سنة."), [], true),
    page("sizes", bi("Ring sizes", "مقاسات الخواتم"), bi("Measure a ring that fits you well, or wrap a thin paper around your finger and measure its length.\nSize 48: 15.3 mm · Size 52: 16.6 mm · Size 56: 17.8 mm · Size 60: 19.1 mm", "قيسي خاتماً يناسبك، أو لفّي ورقة رفيعة حول إصبعك وقيسي طولها.\nمقاس ٤٨: ١٥٫٣ ملم · مقاس ٥٢: ١٦٫٦ ملم · مقاس ٥٦: ١٧٫٨ ملم · مقاس ٦٠: ١٩٫١ ملم"), [], true),
    page("shipping", bi("Shipping", "الشحن"), bi("Delivery across Jordan in 1 to 3 working days.\nFree delivery on orders over 150 JOD, otherwise 3 JOD.\nEvery piece is sent in a sealed gift box.", "توصيل لكل مناطق الأردن خلال ١ إلى ٣ أيام عمل.\nتوصيل مجاني للطلبات فوق ١٥٠ د.أ، وغير ذلك ٣ د.أ.\nكل قطعة تُرسل في علبة هدية مغلقة."), [], true),
    page("contact", bi("Contact us", "تواصل معنا"), bi("Phone and WhatsApp: 07 9000 0000\nEmail: hello@lujain.jo\nAmman, Abdoun", "الهاتف وواتساب: ٠٧٩٠٠٠٠٠٠٠\nالبريد: hello@lujain.jo\nعمّان، عبدون"), [], true),
  ];
}
