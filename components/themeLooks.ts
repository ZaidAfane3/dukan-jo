/* The looks that come with a paid theme. In the designer anyone can try them in the preview, but a store keeps them only
   when it bought that theme. The same rule runs in two places with this one function: the designer, when it saves
   (components/themes.ts withoutUnboughtLooks, asking what this browser knows), and the server, when it sends a store to
   its visitors (server/publicStore.ts, asking the purchases it recorded), so a design saved around the designer can't
   put a paid look on a store that did not buy it.

   Today only "lamma" has looks of its own: the "pop" hero, the "card" banners and the "pop" titles. Round category
   pictures belong to the free Mada design, so every store keeps them. The round-photo hero ("orbit"), the centered
   statement text and the ornament titles came with a jewelry theme removed on 2026-10-28: no theme offers them any more,
   but a design that already uses one keeps it; the designer no longer offers them. */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** The design with every look of a theme `owns` says no to put back to the plain one. Anything else is left exactly as it
    is; a design with nothing to change comes back as the same object. */
export function stripPaidLooks<T>(c: T, owns: (themeId: string) => boolean): T {
  if (!isObj(c) || owns("lamma")) return c;
  let changed = false;
  const sections = Array.isArray(c.sections)
    ? c.sections.map((s: unknown) => {
        if (!isObj(s) || !isObj(s.settings)) return s;
        if (s.type === "hero" && s.settings.layout === "pop") {
          changed = true;
          return { ...s, settings: { ...s.settings, layout: "banner" } };
        }
        if (s.type === "banners" && Array.isArray(s.settings.items) && s.settings.items.some((b: unknown) => isObj(b) && b.variant === "card")) {
          changed = true;
          return { ...s, settings: { ...s.settings, items: s.settings.items.map((b: unknown) => (isObj(b) && b.variant === "card" ? { ...b, variant: "photo" } : b)) } };
        }
        return s;
      })
    : c.sections;
  let theme = c.theme;
  if (isObj(theme) && theme.titleStyle === "pop") {
    changed = true;
    theme = { ...theme, titleStyle: "bold" };
  }
  return changed ? ({ ...c, sections, theme } as T) : c;
}
