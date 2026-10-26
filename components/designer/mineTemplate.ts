import type { Lang } from "../content";
import type { StorefrontConfig } from "../storefront/config";
import { demoConfig, perfumeStore } from "../storefront/demoStores";
import { readConfigKey, writeConfigKey } from "../storefront/storage";
import { load as loadPages, savePages } from "../InfoPages";
import { findTheme } from "../themes";
import type { Identity } from "./panels";

/* TEMPORARY. Saad's private copy of the demo store's design, edited at /saad. It is kept under its own key, so it never touches a
   store, the starter template or the demo. To remove it later: delete this file, the folder app/saad, and the `mine` parts of
   components/designer/Designer.tsx (search for "mine"). */

const KEY = "saad-demo-template";
/* A ready theme of the theme store is kept under its own key: /saad/lamma */
const keyOf = (themeId?: string) => (themeId ? `saad-template-${themeId}-r${findTheme(themeId)?.rev ?? 0}` : KEY);

/** The demo template as it ships, and the demo store's identity */
export function freshMine(lang: Lang, themeId?: string): { config: StorefrontConfig; identity: Identity } {
  const th = findTheme(themeId);
  if (th) {
    const d = th.demo ?? { name: th.name, about: th.tagline, color: "#004956", phone: "70 000 0000" };
    return { config: th.build(lang, { samples: true, storeName: d.name[lang] }), identity: { name: d.name[lang], description: d.about[lang], color: d.color, phone: d.phone } };
  }
  return {
    config: demoConfig(perfumeStore, lang),
    identity: { name: perfumeStore.name[lang], description: perfumeStore.about[lang], color: perfumeStore.color, phone: "70 000 0000" },
  };
}

/** What was saved here before, or the demo template if nothing was */
export function loadMine(lang: Lang, themeId?: string): { config: StorefrontConfig; identity: Identity } {
  /* The sub pages the theme's buttons lead to are saved as the store's pages. A new version of the theme (`rev`) brings its pages again. */
  const own = findTheme(themeId)?.pages?.();
  if (own) {
    const flag = `saad-pages-${themeId}-r${findTheme(themeId)?.rev ?? 0}`;
    try {
      const fresh = !localStorage.getItem(flag);
      const list = loadPages();
      const next = [...list.filter((x) => !own.some((p) => p.id === x.id) || !fresh), ...own.filter((p) => fresh || !list.some((x) => x.id === p.id))];
      savePages(next);
      localStorage.setItem(flag, "1");
    } catch {
      /* storage unavailable */
    }
  }
  const fresh = freshMine(lang, themeId);
  return { config: readConfigKey(keyOf(themeId)) ?? fresh.config, identity: fresh.identity };
}

export const saveMine = (config: StorefrontConfig, themeId?: string) => writeConfigKey(keyOf(themeId), config);

export function resetMine(themeId?: string) {
  try {
    localStorage.removeItem(keyOf(themeId));
  } catch {
    /* storage unavailable */
  }
}
