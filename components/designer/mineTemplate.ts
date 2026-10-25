import type { Lang } from "../content";
import type { StorefrontConfig } from "../storefront/config";
import { demoConfig, perfumeStore } from "../storefront/demoStores";
import { readConfigKey, writeConfigKey } from "../storefront/storage";
import type { Identity } from "./panels";

/* TEMPORARY. Saad's private copy of the demo store's design, edited at /saad. It is kept under its own key, so it never touches a
   store, the starter template or the demo. To remove it later: delete this file, the folder app/saad, and the `mine` parts of
   components/designer/Designer.tsx (search for "mine"). */

const KEY = "saad-demo-template";

/** The demo template as it ships, and the demo store's identity */
export function freshMine(lang: Lang): { config: StorefrontConfig; identity: Identity } {
  return {
    config: demoConfig(perfumeStore, lang),
    identity: { name: perfumeStore.name[lang], description: perfumeStore.about[lang], color: perfumeStore.color, phone: "70 000 0000" },
  };
}

/** What was saved here before, or the demo template if nothing was */
export function loadMine(lang: Lang): { config: StorefrontConfig; identity: Identity } {
  const fresh = freshMine(lang);
  return { config: readConfigKey(KEY) ?? fresh.config, identity: fresh.identity };
}

export const saveMine = (config: StorefrontConfig) => writeConfigKey(KEY, config);

export function resetMine() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
