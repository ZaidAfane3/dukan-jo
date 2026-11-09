/* The messages a customer gets after ordering, as the merchant writes them on the Customer messages page (/messages):
   the WhatsApp message he sends from an order with one press, the thank-you words on the store's screen right after the
   order, and the email (kept for when the store is connected to an email service; nothing sends it yet).

   A message holds fill-in parts the store replaces for each order, written in either language:
   {اسم العميل} / {customer name}, {رقم الطلب} / {order number}, {المجموع} / {total}, {اسم المتجر} / {store name}.

   No React and no browser APIs except the storage helpers at the end. */

export type Bi = { en: string; ar: string };

export type CustomerMessages = {
  /* the order's WhatsApp button (Orders page): it opens WhatsApp with this message written for that customer */
  whatsapp: { on: boolean; text: Bi };
  /* the words under "Order placed" on the store's screen right after ordering */
  screen: { on: boolean; text: Bi };
  /* the order email: subject, heading, message, the order's items, closing line */
  email: { subject: Bi; heading: Bi; body: Bi; items: boolean; closing: Bi };
};

/** The fill-in parts, as written in each language */
export const MESSAGE_TOKENS = {
  name: { ar: "{اسم العميل}", en: "{customer name}" },
  order: { ar: "{رقم الطلب}", en: "{order number}" },
  total: { ar: "{المجموع}", en: "{total}" },
  store: { ar: "{اسم المتجر}", en: "{store name}" },
} as const;
export type MessageToken = keyof typeof MESSAGE_TOKENS;

export const MESSAGE_MAX = { whatsapp: 1000, screen: 300, subject: 120, heading: 120, body: 1500, closing: 200 };

export const defaultMessages: CustomerMessages = {
  whatsapp: {
    on: true,
    text: {
      ar: "مرحبًا {اسم العميل}، شكرًا لطلبك من {اسم المتجر}!\nرقم طلبك: {رقم الطلب}\nالمجموع: {المجموع}\nسنتواصل معك قريبًا لتأكيد موعد التوصيل.",
      en: "Hi {customer name}, thank you for your order from {store name}!\nOrder number: {order number}\nTotal: {total}\nWe'll contact you soon to confirm the delivery time.",
    },
  },
  screen: {
    on: true,
    text: {
      ar: "يسعدنا اختيارك {اسم المتجر} يا {اسم العميل}. سنجهّز طلبك ونتواصل معك قريبًا.",
      en: "We're glad you chose {store name}, {customer name}. We'll prepare your order and contact you soon.",
    },
  },
  email: {
    subject: { ar: "تم استلام طلبك رقم {رقم الطلب}", en: "We got your order {order number}" },
    heading: { ar: "شكرًا لطلبك!", en: "Thank you for your order!" },
    body: { ar: "مرحبًا {اسم العميل}، استلمنا طلبك وسنبدأ بتجهيزه. ستجد تفاصيله في الأسفل.", en: "Hi {customer name}, we got your order and will start preparing it. Its details are below." },
    items: true,
    closing: { ar: "مع تحيات {اسم المتجر}", en: "Best wishes, {store name}" },
  },
};

const line = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").slice(0, max) : fallback);
const bi = (v: unknown, max: number, fallback: Bi): Bi => {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return { en: line(o.en, max, fallback.en), ar: line(o.ar, max, fallback.ar) };
};
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Saved messages, checked (anything missing or broken gets the default) */
export function cleanMessages(raw: unknown): CustomerMessages {
  const r = obj(raw);
  const w = obj(r.whatsapp);
  const sc = obj(r.screen);
  const e = obj(r.email);
  const d = defaultMessages;
  return {
    whatsapp: { on: w.on !== false, text: bi(w.text, MESSAGE_MAX.whatsapp, d.whatsapp.text) },
    screen: { on: sc.on !== false, text: bi(sc.text, MESSAGE_MAX.screen, d.screen.text) },
    email: {
      subject: bi(e.subject, MESSAGE_MAX.subject, d.email.subject),
      heading: bi(e.heading, MESSAGE_MAX.heading, d.email.heading),
      body: bi(e.body, MESSAGE_MAX.body, d.email.body),
      items: e.items !== false,
      closing: bi(e.closing, MESSAGE_MAX.closing, d.email.closing),
    },
  };
}

/** A message with its fill-in parts replaced (in either language's wording) */
export function fillMessage(text: string, v: { name: string; order: string; total: string; store: string }): string {
  let out = text;
  for (const k of Object.keys(MESSAGE_TOKENS) as MessageToken[]) {
    for (const word of [MESSAGE_TOKENS[k].ar, MESSAGE_TOKENS[k].en]) out = out.split(word).join(v[k]);
  }
  return out;
}

/** The message in the customer's language, or the other one when his is empty */
export const messageIn = (b: Bi, lang: "en" | "ar") => (b[lang]?.trim() ? b[lang] : b[lang === "ar" ? "en" : "ar"]);

/** A WhatsApp link that opens a chat with this number with the message written (a Jordanian 07… number gets 962) */
export function whatsappLink(phone: string, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `962${d.slice(1)}`;
  if (d.length < 8 || d.length > 15) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export const MESSAGES_KEY = "seen-messages";

/** The merchant's messages as saved in this browser (the defaults until he changes them) */
export function loadMessages(): CustomerMessages {
  try {
    return cleanMessages(JSON.parse(localStorage.getItem(MESSAGES_KEY) || "null"));
  } catch {
    return cleanMessages(null);
  }
}

export function saveMessages(m: CustomerMessages): boolean {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(cleanMessages(m)));
    return true;
  } catch {
    return false;
  }
}
