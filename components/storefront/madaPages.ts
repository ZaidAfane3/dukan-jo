import type { InfoPage } from "../InfoPages";
import type { Bi } from "./config";

/* The help pages of "Mada" (the links of the footer's «المساعدة» column). The menu, the cover and every other button of the theme
   lead to parts of the home page, so they work in any store. On a merchant's store these sample pages are not there: the footer
   links go to his own page of the same kind instead (his return policy, his contact page ...), or are left out (see mergeFooter). */

const bi = (en: string, ar: string): Bi => ({ en, ar });

/** The id of each page (9300 to 9399 belong to Mada). They are fixed, so the links of the theme can point at them. */
export const madaPageId = { track: 9301, returns: 9302, sizes: 9303, contact: 9304 } as const;
export const madaLink = (k: keyof typeof madaPageId) => `page:${madaPageId[k]}`;

/** The pages, ready to be saved in the theme's own list of pages */
export function madaPages(): InfoPage[] {
  const now = Date.now();
  let n = 0;
  const page = (k: keyof typeof madaPageId, title: Bi, content: Bi): InfoPage => ({ id: madaPageId[k], type: k === "returns" ? 1 : 0, published: true, footer: true, title, content, created: now - n++ * 1000, sections: [] });
  return [
    page(
      "track",
      bi("Track your order", "تتبّع الطلب"),
      bi(
        "Send us your order number on WhatsApp (07 9000 0000) and we tell you where your order is.\nOrders in Amman arrive in 1 to 2 working days, and in the other cities in 2 to 4 working days.",
        "أرسل لنا رقم طلبك على واتساب (٠٧٩٠٠٠٠٠٠٠) ونخبرك أين وصل طلبك.\nتصل الطلبات داخل عمّان خلال ١ إلى ٢ يوم عمل، وباقي المحافظات خلال ٢ إلى ٤ أيام عمل.",
      ),
    ),
    page(
      "returns",
      bi("Exchanges", "الاستبدال"),
      bi(
        "Free exchange within 14 days of receiving your order, as long as the piece is unworn and has its tags.\nContact us with your order number and we collect the piece and send you the new size or another piece.",
        "استبدال مجاني خلال ١٤ يومًا من استلام طلبك، بشرط أن تكون القطعة غير ملبوسة وعليها بطاقتها.\nتواصل معنا برقم الطلب ونستلم القطعة ونرسل لك المقاس الجديد أو قطعة أخرى.",
      ),
    ),
    page(
      "sizes",
      bi("Size guide", "دليل المقاسات"),
      bi(
        "S: chest 88–92 cm · waist 70–74 cm\nM: chest 96–100 cm · waist 78–82 cm\nL: chest 104–108 cm · waist 86–90 cm\nXL: chest 112–116 cm · waist 94–98 cm\nBetween two sizes? Take the bigger one for a relaxed fit.",
        "S: الصدر ٨٨–٩٢ سم · الخصر ٧٠–٧٤ سم\nM: الصدر ٩٦–١٠٠ سم · الخصر ٧٨–٨٢ سم\nL: الصدر ١٠٤–١٠٨ سم · الخصر ٨٦–٩٠ سم\nXL: الصدر ١١٢–١١٦ سم · الخصر ٩٤–٩٨ سم\nبين مقاسين؟ اختر الأكبر لقصّة مريحة.",
      ),
    ),
    page(
      "contact",
      bi("Contact us", "تواصل معنا"),
      bi("Phone and WhatsApp: 07 9000 0000\nEmail: hello@mada.jo\nEvery day from 10 am to 10 pm", "الهاتف وواتساب: ٠٧٩٠٠٠٠٠٠٠\nالبريد: hello@mada.jo\nيوميًا من ١٠ صباحًا حتى ١٠ مساءً"),
    ),
  ];
}
