import { ENDINGS } from "../domainShop";
import { cleanLine, cleanMoney } from "../safe";

/* The platform settings Diwan can change (platform_settings rows), their starting values and the rules each value must pass.
   Plain TypeScript with no browser APIs: the settings route runs the same clean functions on every value it is sent, and the
   settings page uses the types and the starting values. A clean function gives null when the value can't be used. */

export type ShippingCompany = { name: string; phone: string; cities: string[] };
export const PAY_METHODS = ["cod", "cliq", "card", "paypal"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type PaymentMethods = Record<PayMethod, { on: boolean; note: string }>;
export type SeoDefaults = { titleSuffix_en: string; titleSuffix_ar: string; description_en: string; description_ar: string };

export type PlatformSettings = {
  trial_days: number;
  shipping_companies: ShippingCompany[];
  payment_methods: PaymentMethods;
  default_themes: string[];
  seo_defaults: SeoDefaults;
  domain_prices: Record<string, number>;
};
export type SettingKey = keyof PlatformSettings;

export const SETTING_KEYS: SettingKey[] = ["trial_days", "shipping_companies", "payment_methods", "default_themes", "seo_defaults", "domain_prices"];
/* What any visitor's page may read (GET /api/platform/settings). The rest stays inside Diwan. */
export const PUBLIC_KEYS: SettingKey[] = ["payment_methods", "shipping_companies", "seo_defaults", "default_themes"];

/** Used while a setting has never been saved */
export const SETTING_DEFAULTS: PlatformSettings = {
  trial_days: 14,
  shipping_companies: [],
  payment_methods: {
    cod: { on: true, note: "" },
    cliq: { on: false, note: "" },
    card: { on: false, note: "" },
    paypal: { on: false, note: "" },
  },
  default_themes: [],
  seo_defaults: { titleSuffix_en: "", titleSuffix_ar: "", description_en: "", description_ar: "" },
  domain_prices: Object.fromEntries(ENDINGS.map((e) => [e.ending, e.price])),
};

export const LIMITS = { companies: 30, cities: 40, city: 40, companyName: 60, phone: 20, note: 200, themes: 20, suffix: 60, description: 300, endings: 30, maxTrial: 365 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

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
        const p = cleanMoney(typeof price === "number" ? String(price) : price, 10_000);
        if (p === "") return null;
        out[ending] = Number(p);
      }
      return out;
    }
  }
  return null;
}
