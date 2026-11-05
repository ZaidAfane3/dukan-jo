/* What each theme in the theme store costs, in JOD (themes.ts uses these for its list). Kept apart from themes.ts,
   which needs the browser, so the server (app/api/themes/purchase) reads the price from here and never from the page.
   A theme that is not here is not for sale. */
export const THEME_PRICES: Record<string, number> = {
  atelier: 19.99,
  lamma: 39,
};

/** The price of a theme for sale, or null when there is no such theme in the store */
export const themePrice = (id: unknown): number | null => (typeof id === "string" && Object.prototype.hasOwnProperty.call(THEME_PRICES, id) ? THEME_PRICES[id] : null);
