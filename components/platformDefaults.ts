/* Platform defaults that are decided in the code, on purpose, not in Diwan (moved out of Diwan's platform settings on
   2026-11-16, at the owner's request). To change them, change them here. Rows still saved in platform_settings under
   "default_themes" or "seo_defaults" are never read. */

/** The free themes every store has in My themes, in this order (ids from components/themes.ts): Dukkan, the design a new
    store starts with, and Mada ("Dukkan Founders"). Buying one of them costs nothing (app/api/themes/purchase). */
export const FREE_THEME_IDS = ["dukkan", "mada"] as const;

/** What a store's search engine title ends with and its description, until the merchant writes his own. Empty: nothing
    is added (nothing reads these yet; they are kept here so the defaults have one home). */
export const SEO_DEFAULTS = { titleSuffix_en: "", titleSuffix_ar: "", description_en: "", description_ar: "" } as const;
