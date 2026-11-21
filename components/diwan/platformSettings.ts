import { latin } from "../digits";
import { cleanEmail, cleanLine, cleanLines, cleanMoney, visibleLength } from "../safe";

/* The platform settings Diwan can change (platform_settings rows), their starting values and the rules each value must pass.
   Plain TypeScript with no browser APIs: the settings route runs the same clean functions on every value it is sent, and the
   settings page uses the types and the starting values. A clean function gives null when the value can't be used. */

/* Dukkan takes no PayPal (removed 2026-11-16): a saved setting that still has it is read without it */
export const PAY_METHODS = ["cod", "cliq", "card"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
/* note: the line shown under the way to pay at checkout, in English and Arabic (either may be empty; components/platformPublic.ts
   noteFor shows the other language when the visitor's is empty) */
export type PaymentMethods = Record<PayMethod, { on: boolean; note: Bi }>;
/** The ways the theme checkout can take a merchant's payment (it has no cash): only the ones Diwan has on are offered */
export const THEME_PAYS = ["card", "cliq"] as const satisfies readonly PayMethod[];
export type ThemePay = (typeof THEME_PAYS)[number];
export type Bi = { en: string; ar: string };
/* Dukkan Ship, Dukkan's own delivery service: its flat price per order (also what a store's customer pays for delivery), the
   cities it picks up from, the short line under the price and the points listed beside it */
export type DukkanShip = { price: number; cities: Bi[]; policy: Bi; features: Bi[] };
export type LegalTemplate = { title: Bi; body: Bi };
/* The return, terms and privacy pages a new store starts with (the merchant edits his own copy) */
export const LEGAL_PAGES = ["returns", "terms", "privacy"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];
export type StoreLegalTemplates = Record<LegalPage, LegalTemplate>;
/* How a merchant reaches Dukkan's own support team: shown on the suspended-store page and the website's contact lines.
   An empty field is left out wherever it would be shown. */
export type SupportContact = { phone: string; whatsapp: string; email: string };

export type PlatformSettings = {
  payment_methods: PaymentMethods;
  dukkan_ship: DukkanShip;
  store_legal_templates: StoreLegalTemplates;
  support_contact: SupportContact;
  /* how soon Dukkan's support team usually answers a ticket, in whole hours (1 to 168, a week): the merchant Support
     page says "We usually reply within N hours." */
  support_reply_hours: number;
};
export type SettingKey = keyof PlatformSettings;

/* Dukkan once sold domains, with a "domain_prices" setting; it no longer does (every store lives at the site address/<its
   link>), so that key is gone from here. The same goes for "trial_days": Dukkan has no plans and no free trial.
   Removed on 2026-11-16: "shipping_companies" (a list of couriers nothing outside this settings page ever read: a merchant
   names his own delivery partner), and "default_themes" and "seo_defaults", which are now set in the code
   (components/platformDefaults.ts). A row still saved under any of these keys is never read, sent or shown. */
export const SETTING_KEYS: SettingKey[] = ["payment_methods", "dukkan_ship", "store_legal_templates", "support_contact", "support_reply_hours"];
/* What any visitor's page may read (GET /api/platform/settings): prices, ways to pay and texts every store shows anyway.
   Today that is every setting; a setting only Diwan should see would be left out of this list. Dukkan's support contact is
   public on purpose: a suspended merchant reads it without being signed in. */
export const PUBLIC_KEYS = ["payment_methods", "dukkan_ship", "store_legal_templates", "support_contact", "support_reply_hours"] as const satisfies readonly SettingKey[];
export type PublicKey = (typeof PUBLIC_KEYS)[number];
export type PublicSettings = Pick<PlatformSettings, PublicKey>;

/* The pages every new store starts with, as they were written in the code before Diwan could change them */
const LEGAL_DEFAULTS: StoreLegalTemplates = {
  returns: {
    title: { en: "Return and exchange policy", ar: "سياسة الاستبدال والاسترجاع" },
    body: {
      en: "Return and exchange policy\n\nYou can return or exchange an item within 7 days of receiving it, as long as it is unused and in its original packaging.\n\nTo start a return, contact the store with your order number. Once we receive the item and check it, we refund the amount using the same payment method, or exchange it for another item.\n\nDelivery fees are not refunded unless the item arrived damaged or was not what you ordered.",
      ar: "سياسة الاستبدال والاسترجاع\n\nيمكنك إرجاع المنتج أو استبداله خلال 7 أيام من استلامه، بشرط أن يكون غير مستخدم وفي عبوته الأصلية.\n\nللبدء بطلب الإرجاع، تواصل مع المتجر ومعك رقم الطلب. بعد استلام المنتج وفحصه، نعيد المبلغ بنفس طريقة الدفع أو نستبدله بمنتج آخر.\n\nلا تُسترد رسوم التوصيل إلا إذا وصل المنتج تالفًا أو مختلفًا عمّا طلبته.",
    },
  },
  terms: {
    title: { en: "Terms and conditions", ar: "الأحكام والشروط" },
    body: {
      en: "Terms and conditions\n\nBy using this store and placing an order you agree to these terms.\n\nPrices are shown in Jordanian dinars. We may cancel an order if a product is unavailable or a price was shown by mistake, and in that case you are refunded in full.\n\nAll content on this store, including text, images and logos, belongs to the store and may not be used without permission.\n\nThe store may update these terms from time to time. The version published here is the one that applies.",
      ar: "الأحكام والشروط\n\nباستخدامك هذا المتجر وإتمامك طلبًا فإنك توافق على هذه الأحكام.\n\nتُعرض الأسعار بالدينار الأردني. يحق للمتجر إلغاء الطلب إذا كان المنتج غير متوفر أو عُرض بسعر خاطئ، وفي هذه الحالة يُعاد إليك المبلغ كاملًا.\n\nجميع محتويات المتجر، بما في ذلك النصوص والصور والشعارات، ملك للمتجر ولا يجوز استخدامها دون إذن.\n\nقد يحدّث المتجر هذه الأحكام من وقت لآخر، والنسخة المنشورة هنا هي المعتمدة.",
    },
  },
  privacy: {
    title: { en: "Privacy policy", ar: "سياسة الخصوصية" },
    body: {
      en: "Privacy policy\n\nWe collect only what we need to process your order: your name, phone number, email and delivery address.\n\nWe use this information to prepare and deliver your order and to contact you about it. We do not sell your personal information.\n\nYou can ask us to see, correct or delete your information at any time by contacting the store.",
      ar: "سياسة الخصوصية\n\nنجمع فقط ما نحتاجه لإتمام طلبك: اسمك ورقم جوالك وبريدك الإلكتروني وعنوان التوصيل.\n\nنستخدم هذه المعلومات لتجهيز طلبك وتوصيله والتواصل معك بشأنه. ولا نبيع بياناتك الشخصية.\n\nيمكنك في أي وقت أن تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها بالتواصل مع المتجر.",
    },
  },
};

/** Used while a setting has never been saved: what the pages did before Diwan could change it, so nothing moves until staff
    save something */
export const SETTING_DEFAULTS: PlatformSettings = {
  payment_methods: {
    /* the store checkout offers cash, CliQ and card, and the theme checkout card and CliQ */
    cod: { on: true, note: { en: "", ar: "" } },
    cliq: { on: true, note: { en: "", ar: "" } },
    card: { on: true, note: { en: "", ar: "" } },
  },
  dukkan_ship: {
    price: 3,
    cities: [
      { en: "Irbid", ar: "إربد" },
      { en: "Amman", ar: "عمّان" },
      { en: "Salt", ar: "السلط" },
    ],
    policy: { en: "Billed per order. No monthly fee and no contract.", ar: "تُحتسب لكل طلب. بلا اشتراك شهري ولا عقود." },
    features: [
      { en: "Pickup from your address", ar: "استلام من عنوانك" },
      { en: "Tracking for every order", ar: "تتبّع لكل طلب" },
      { en: "Flat price, no contracts", ar: "سعر ثابت بلا عقود" },
    ],
  },
  store_legal_templates: LEGAL_DEFAULTS,
  /* the email the website gave before; no phone or WhatsApp until staff write a real one (the old +962 6 000 0000 was a placeholder) */
  support_contact: { phone: "", whatsapp: "", email: "hello@dukkan.store" },
  support_reply_hours: 2,
};

export const LIMITS = {
  city: 40, note: 200,
  shipPrice: 100, shipCities: 30, shipPolicy: 200, shipFeatures: 8, shipFeature: 80, legalTitle: 80, legalBody: 6000,
  supportNumber: 20, supportEmail: 120,
  replyHoursMin: 1, replyHoursMax: 168,
};

/** A support phone or WhatsApp number as staff write it: empty, or 8 to 15 digits with only spaces, dashes, brackets and
    a leading + around them. Kept as written, so it shows the way staff spaced it. */
export function okSupportNumber(v: string): boolean {
  const t = latin(v).trim();
  if (!t) return true;
  const digits = t.replace(/\D/g, "").length;
  return /^\+?[\d\s\-()]+$/.test(t) && digits >= 8 && digits <= 15;
}

/** A support email: empty, or one that looks like an address */
export const okSupportEmail = (v: string): boolean => !v.trim() || !!cleanEmail(v);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/* English and Arabic of one line, both written (null when either is missing) */
function biLine(v: unknown, max: number): Bi | null {
  if (!isObj(v)) return null;
  const en = cleanLine(v.en, max);
  const ar = cleanLine(v.ar, max);
  return visibleLength(en) && visibleLength(ar) ? { en, ar } : null;
}

/* A list of English and Arabic lines: null when one of them is half written or there are too many */
function biList(v: unknown, maxItems: number, max: number): Bi[] | null {
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out: Bi[] = [];
  for (const x of v) {
    const b = biLine(x, max);
    if (!b) return null;
    if (!out.some((y) => y.en.toLowerCase() === b.en.toLowerCase())) out.push(b);
  }
  return out;
}

/* A checkout note: { en, ar }, each one optional. Before 2026-11-17 it was one plain string; such a saved note still reads,
   put in the box of the language it is written in (Arabic letters: Arabic), so nothing staff wrote is lost and the page
   shows it in both languages until staff write the other one. */
function payNoteOf(v: unknown): Bi {
  if (typeof v === "string") {
    const t = cleanLine(v, LIMITS.note);
    return /[؀-ۿ]/.test(t) ? { en: "", ar: t } : { en: t, ar: "" };
  }
  if (!isObj(v)) return { en: "", ar: "" };
  return { en: cleanLine(v.en ?? "", LIMITS.note), ar: cleanLine(v.ar ?? "", LIMITS.note) };
}

/** Checks one setting against its rules (null when the value can't be used) */
export function cleanSetting(key: SettingKey, v: unknown): PlatformSettings[SettingKey] | null {
  switch (key) {
    case "payment_methods": {
      if (!isObj(v)) return null;
      const out = {} as PaymentMethods;
      for (const m of PAY_METHODS) {
        const x = v[m];
        if (!isObj(x) || typeof x.on !== "boolean") return null;
        out[m] = { on: x.on, note: payNoteOf(x.note) };
      }
      return out;
    }

    case "dukkan_ship": {
      if (!isObj(v)) return null;
      const p = cleanMoney(typeof v.price === "number" ? String(v.price) : v.price, LIMITS.shipPrice);
      const cities = biList(v.cities, LIMITS.shipCities, LIMITS.city);
      const features = biList(v.features, LIMITS.shipFeatures, LIMITS.shipFeature);
      /* a pickup city has to be offered, or no store could choose Dukkan Ship */
      if (p === "" || !cities?.length || !features || !isObj(v.policy)) return null;
      return { price: Number(p), cities, features, policy: { en: cleanLine(v.policy.en, LIMITS.shipPolicy), ar: cleanLine(v.policy.ar, LIMITS.shipPolicy) } };
    }

    case "store_legal_templates": {
      if (!isObj(v)) return null;
      const out = {} as StoreLegalTemplates;
      for (const k of LEGAL_PAGES) {
        const x = v[k];
        if (!isObj(x)) return null;
        const title = biLine(x.title, LIMITS.legalTitle);
        if (!title || !isObj(x.body)) return null;
        const body = { en: cleanLines(x.body.en, LIMITS.legalBody), ar: cleanLines(x.body.ar, LIMITS.legalBody) };
        if (visibleLength(body.en) < 3 || visibleLength(body.ar) < 3) return null;
        out[k] = { title, body };
      }
      return out;
    }

    case "support_contact": {
      if (!isObj(v)) return null;
      /* a number with letters in it or a half-written email is refused, never saved cut down to something else */
      const line = (x: unknown, max: number) => (typeof x === "string" && x.trim().length > max ? null : cleanLine(latin(typeof x === "string" ? x : ""), max));
      const phone = line(v.phone, LIMITS.supportNumber);
      const whatsapp = line(v.whatsapp, LIMITS.supportNumber);
      const email = line(v.email, LIMITS.supportEmail);
      if (phone === null || whatsapp === null || email === null) return null;
      if (!okSupportNumber(phone) || !okSupportNumber(whatsapp) || !okSupportEmail(email)) return null;
      return { phone, whatsapp, email: email ? cleanEmail(email) : "" };
    }

    case "support_reply_hours": {
      /* a whole number of hours, 1 to 168 (written in Arabic digits too); anything else is refused, never rounded */
      const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d{1,3}\s*$/.test(latin(v)) ? Number(latin(v)) : NaN;
      return Number.isInteger(n) && n >= LIMITS.replyHoursMin && n <= LIMITS.replyHoursMax ? n : null;
    }
  }
  return null;
}
