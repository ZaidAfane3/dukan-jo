import { ENDINGS, endingOk } from "../domainShop";
import { cleanLine, cleanLines, cleanMoney, visibleLength } from "../safe";

/* The platform settings Diwan can change (platform_settings rows), their starting values and the rules each value must pass.
   Plain TypeScript with no browser APIs: the settings route runs the same clean functions on every value it is sent, and the
   settings page uses the types and the starting values. A clean function gives null when the value can't be used. */

export type ShippingCompany = { name: string; phone: string; cities: string[] };
export const PAY_METHODS = ["cod", "cliq", "card", "paypal"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type PaymentMethods = Record<PayMethod, { on: boolean; note: string }>;
/** The ways the theme checkout can take a merchant's payment (it has no cash): only the ones Diwan has on are offered */
export const THEME_PAYS = ["card", "cliq", "paypal"] as const satisfies readonly PayMethod[];
export type ThemePay = (typeof THEME_PAYS)[number];
export type SeoDefaults = { titleSuffix_en: string; titleSuffix_ar: string; description_en: string; description_ar: string };
export type Bi = { en: string; ar: string };
/* Dukkan Ship, Dukkan's own delivery service: its flat price per order (also what a store's customer pays for delivery), the
   cities it picks up from, the short line under the price and the points listed beside it */
export type DukkanShip = { price: number; cities: Bi[]; policy: Bi; features: Bi[] };
export type LegalTemplate = { title: Bi; body: Bi };
/* The return, terms and privacy pages a new store starts with (the merchant edits his own copy) */
export const LEGAL_PAGES = ["returns", "terms", "privacy"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];
export type StoreLegalTemplates = Record<LegalPage, LegalTemplate>;

export type PlatformSettings = {
  trial_days: number;
  shipping_companies: ShippingCompany[];
  payment_methods: PaymentMethods;
  default_themes: string[];
  seo_defaults: SeoDefaults;
  domain_prices: Record<string, number>;
  dukkan_ship: DukkanShip;
  store_legal_templates: StoreLegalTemplates;
};
export type SettingKey = keyof PlatformSettings;

export const SETTING_KEYS: SettingKey[] = ["trial_days", "shipping_companies", "payment_methods", "default_themes", "seo_defaults", "domain_prices", "dukkan_ship", "store_legal_templates"];
/* What any visitor's page may read (GET /api/platform/settings): prices, ways to pay and texts every store shows anyway. The
   rest (the trial length) stays inside Diwan. */
export const PUBLIC_KEYS = ["payment_methods", "shipping_companies", "seo_defaults", "default_themes", "domain_prices", "dukkan_ship", "store_legal_templates"] as const satisfies readonly SettingKey[];
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
  trial_days: 14,
  shipping_companies: [],
  payment_methods: {
    /* the store checkout offered cash, CliQ and card, and the theme checkout card, CliQ and PayPal */
    cod: { on: true, note: "" },
    cliq: { on: true, note: "" },
    card: { on: true, note: "" },
    paypal: { on: true, note: "" },
  },
  /* empty: the code's own free designs (Dukkan and Mada, components/themes.ts) */
  default_themes: [],
  seo_defaults: { titleSuffix_en: "", titleSuffix_ar: "", description_en: "", description_ar: "" },
  domain_prices: Object.fromEntries(ENDINGS.map((e) => [e.ending, e.price])),
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
};

export const LIMITS = {
  companies: 30, cities: 40, city: 40, companyName: 60, phone: 20, note: 200, themes: 20, suffix: 60, description: 300, endings: 30, maxTrial: 365,
  shipPrice: 100, shipCities: 30, shipPolicy: 200, shipFeatures: 8, shipFeature: 80, legalTitle: 80, legalBody: 6000,
};

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

/** A domain ending as Dukkan sells it: ".com", ".com.jo" */
export const ENDING_RE = /^(\.[a-z0-9][a-z0-9-]{0,19}){1,2}$/;

/** A theme id as components/themes.ts writes them */
export const THEME_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Checks one setting. `themeIds` is the theme catalog (components/themeCatalog.ts) when the caller has it; the server can't load
    the catalog (it is browser code), so there a theme id is checked by its form, and the settings page offers only the catalog. */
export function cleanSetting(key: SettingKey, v: unknown, themeIds?: string[]): PlatformSettings[SettingKey] | null {
  switch (key) {
    case "trial_days":
      return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= LIMITS.maxTrial ? v : null;

    case "shipping_companies": {
      if (!Array.isArray(v) || v.length > LIMITS.companies) return null;
      const out: ShippingCompany[] = [];
      for (const c of v) {
        if (!isObj(c)) return null;
        const name = cleanLine(c.name, LIMITS.companyName);
        if (name.length < 2) return null;
        const phone = cleanLine(c.phone ?? "", LIMITS.phone);
        if (phone && !/^\+?[\d ]{6,20}$/.test(phone)) return null;
        if (!Array.isArray(c.cities) || c.cities.length > LIMITS.cities) return null;
        const cities = Array.from(new Set(c.cities.map((x) => cleanLine(x, LIMITS.city)).filter(Boolean)));
        out.push({ name, phone, cities });
      }
      return out;
    }

    case "payment_methods": {
      if (!isObj(v)) return null;
      const out = {} as PaymentMethods;
      for (const m of PAY_METHODS) {
        const x = v[m];
        if (!isObj(x) || typeof x.on !== "boolean") return null;
        out[m] = { on: x.on, note: cleanLine(x.note ?? "", LIMITS.note) };
      }
      return out;
    }

    case "default_themes": {
      if (!Array.isArray(v) || v.length > LIMITS.themes) return null;
      if (!v.every((id) => typeof id === "string" && (themeIds ? themeIds.includes(id) : THEME_ID_RE.test(id)))) return null;
      return Array.from(new Set(v as string[]));
    }

    case "seo_defaults": {
      if (!isObj(v)) return null;
      return {
        titleSuffix_en: cleanLine(v.titleSuffix_en ?? "", LIMITS.suffix),
        titleSuffix_ar: cleanLine(v.titleSuffix_ar ?? "", LIMITS.suffix),
        description_en: cleanLine(v.description_en ?? "", LIMITS.description),
        description_ar: cleanLine(v.description_ar ?? "", LIMITS.description),
      };
    }

    case "domain_prices": {
      if (!isObj(v)) return null;
      const entries = Object.entries(v);
      if (!entries.length || entries.length > LIMITS.endings) return null;
      const out: Record<string, number> = {};
      for (const [ending, price] of entries) {
        if (!ENDING_RE.test(ending)) return null;
        /* an ending no real name can have (".j", saved before this was checked) is left out on its own, so the other saved
           prices still apply; saving a new one is refused in the settings route */
        if (!endingOk(ending)) continue;
        const p = cleanMoney(typeof price === "number" ? String(price) : price, 10_000);
        if (p === "") return null;
        out[ending] = Number(p);
      }
      return Object.keys(out).length ? out : null;
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
  }
  return null;
}
