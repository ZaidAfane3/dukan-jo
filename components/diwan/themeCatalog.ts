import { defaultTheme, madaTheme, themes, type ThemeInfo } from "../themes";

/** Dukkan's own built-in themes (components/themes.ts), each once: the default one, the free "mada" one, then the theme store's */
export const THEME_CATALOG: ThemeInfo[] = [defaultTheme, madaTheme, ...themes].filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i);
export const THEME_IDS = THEME_CATALOG.map((t) => t.id);
