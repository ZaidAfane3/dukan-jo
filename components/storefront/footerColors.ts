import type { Banner, StorefrontConfig } from "./config";
import { fillColors, isGradient } from "./parts";

/* The colors the footer really paints, worked out once so the store and the designer's color pickers agree */

const DEFAULT_PRIMARY = "#004956";
const SOFT_LIGHT = "#f4efe6";
const SOFT_DARK = "#10242a";

/** "#abc" / "#aabbcc" as "#aabbcc", anything else "" */
export const hex = (v?: string): string => {
  const s = (v ?? "").trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return "";
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
};
const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** WCAG relative luminance (0 black … 1 white) */
export const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio of two hex colors (1 … 21) */
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** `a` mixed into `b`, t of `a` (like color-mix in srgb) */
export const mix = (a: string, b: string, t: number) => {
  const [p, q] = [rgb(a), rgb(b)];
  return `#${p.map((v, i) => Math.round(v * t + q[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
};

/* Words in a color he picked, on a background (the page, the header, a cover, a bar): the footer's bar for his text color, 3:1.
   The store draws an automatic color in place of one that does not read, and the designer says so beside the color. */

/** The plain colors of a background (the stops of a gradient); none for anything else (a picture) */
export const stopsOf = (bg?: string): string[] => (bg ? (isGradient(bg) ? fillColors(bg) : [bg]).map(hex).filter(Boolean) : []);

/** Whether words in `color` read on `bg` (on every color of a gradient). No color, or a background that is not a color, counts as readable. */
export function readsOn(color: string | undefined, bg: string | undefined, min = 3): boolean {
  const c = hex(color);
  const stops = stopsOf(bg);
  return !c || !stops.length || Math.min(...stops.map((s) => contrast(c, s))) >= min;
}

/** `color` where it reads on `bg`; otherwise `fallback` where that reads; otherwise the soft light or soft dark, whichever reads best */
export function legibleOn(color: string, bg: string, fallback?: string): string {
  if (readsOn(color, bg)) return color;
  if (fallback && readsOn(fallback, bg)) return fallback;
  const stops = stopsOf(bg);
  const worst = (c: string) => Math.min(...stops.map((s) => contrast(c, s)));
  return worst(SOFT_LIGHT) >= worst(SOFT_DARK) ? SOFT_LIGHT : SOFT_DARK;
}

/** What the words of a promo banner sit on: its card color, its frosted panel (his color, or the dark or light one), or, with no
    picture, the fill in the store color; "" on a picture (it has its own dark fade). `primary`: the theme's store color, `storeColor`: setup's. */
export function bannerSurface(b: Banner, primary: string, storeColor: string): string {
  if (b.variant === "card") return b.bg || primary;
  if (b.panel === "light" || b.panel === "dark") return hex(b.panelColor) || (b.panel === "dark" ? "#12100d" : "#fff5f8");
  if (b.image) return "";
  const plain = hex(storeColor) || DEFAULT_PRIMARY;
  return `linear-gradient(135deg, ${plain}, ${mix(plain, "#6fe3cf", 0.6)})`;
}

export type FooterColors = {
  /* the background drawn (a color or a gradient, with a veil over a gradient that needs one) and the text color drawn on it */
  bg: string;
  text: string;
  /* true when the merchant left the color empty (or his text color is unreadable, so the store picks one) */
  autoBg: boolean;
  autoText: boolean;
  /* the colors of the background (the stops of a gradient), the titles, the store color of the footer and a readable letter on it */
  stops: string[];
  title: string;
  primary: string;
  onPrimary: string;
  /* the store name color the merchant picked, when it reads on this background */
  name: string;
  /* light text (a dark footer), and whether the text needs a soft shadow (a gradient no single color reads well on) */
  dark: boolean;
  shadow: boolean;
};

/** The exact colors of the footer, in both styles. `storeColor` is the store color from setup (used when the theme has none). */
export function footerColors(cfg: StorefrontConfig, storeColor?: string): FooterColors {
  const t = cfg.theme;
  const f = cfg.footer;
  const primary = hex(t.primary) || hex(storeColor) || DEFAULT_PRIMARY;
  const pageBg = hex(t.background) || "#ffffff";
  const own = (f.background ?? "").trim();
  const autoBg = !own;
  const bg = autoBg ? (f.style === "simple" ? pageBg : mix(primary, pageBg, 0.07)) : own;
  const stops = (isGradient(bg) ? fillColors(bg) : [bg]).map(hex).filter(Boolean);
  if (!stops.length) stops.push(pageBg);
  const worst = (c: string) => Math.min(...stops.map((s) => contrast(c, s)));

  /* the merchant's text color, unless it is unreadable here (under 3:1): then the store's own pick */
  const picked = hex(f.text);
  const autoText = !(picked && worst(picked) >= 3);
  let text = picked;
  if (autoText) {
    const themeText = hex(t.text);
    const best = (list: string[]) => list.reduce((a, b) => (worst(b) > worst(a) ? b : a));
    text = themeText && worst(themeText) >= 4.5 ? themeText : best([SOFT_LIGHT, SOFT_DARK]);
    if (worst(text) < 4.5) text = best([text, "#ffffff", "#000000"]);
  }
  /* a gradient no single color reads on (light at one end, dark at the other): a veil over it, as light as will do */
  let drawn = bg;
  if (stops.length > 1 && worst(text) < 4.5) {
    const light = luminance(text) > 0.5;
    const veil = light ? "#000000" : "#ffffff";
    let a = 0.1;
    while (a < 0.8 && Math.min(...stops.map((s) => contrast(text, mix(veil, s, a)))) < 4.5) a += 0.05;
    const v = light ? `rgba(0,0,0,${a.toFixed(2)})` : `rgba(255,255,255,${a.toFixed(2)})`;
    drawn = `linear-gradient(${v}, ${v}), ${bg}`;
    stops.splice(0, stops.length, ...stops.map((s) => mix(veil, s, a)));
  }
  const themeTitle = hex(t.titleColor);
  const title = autoText && autoBg && themeTitle && worst(themeTitle) >= 3 ? themeTitle : text;

  /* the store color in the footer (links on hover, icons, the logo badge): pushed toward the text color until it reads (3:1) */
  let fp = autoBg ? primary : hex(t.accent) || primary;
  for (let k = 0.15; worst(fp) < 3 && k <= 1; k += 0.15) fp = mix(text, fp, k);
  if (worst(fp) < 3) fp = text;
  const onPrimary = contrast("#ffffff", fp) >= contrast(SOFT_DARK, fp) ? "#ffffff" : SOFT_DARK;

  const nameColor = hex(cfg.identity.nameColor);
  return {
    bg: drawn,
    text,
    autoBg,
    autoText,
    stops,
    title,
    primary: fp,
    onPrimary,
    name: nameColor && worst(nameColor) >= 3 ? nameColor : "",
    dark: luminance(text) > 0.5,
    shadow: worst(text) < 4.5,
  };
}

/** A dimmed text line: `pct`% of the text color, raised until it still reads (4.5:1 when the full color can) on every stop */
export function footerDim(c: FooterColors, pct: number, target = 4.5): string {
  return dimOn(c.text, c.stops, pct, target);
}

/** `color` where it reads `target`:1 on `bg`; otherwise mixed toward `toward` (the readable text color) just as far as it then reads */
export function inkOn(color: string, bg: string, toward: string, target = 4.5): string {
  const c = hex(color), t = hex(toward);
  const stops = stopsOf(bg);
  if (!c || !t || !stops.length) return color;
  const worst = (x: string) => Math.min(...stops.map((s) => contrast(x, s)));
  for (let p = 1; p > 0; p -= 0.05) {
    const m = mix(c, t, p);
    if (worst(m) >= target) return m;
  }
  return t;
}

/** `pct`% of `text` over `bg` (a color, a gradient or its stops), raised until it still reads (4.5:1 when the full color can) */
export function dimOn(text: string, bg: string | string[], pct: number, target = 4.5): string {
  const t = hex(text);
  const stops = Array.isArray(bg) ? bg.map(hex).filter(Boolean) : stopsOf(bg);
  if (!t || !stops.length) return text;
  const reach = Math.min(target, Math.min(...stops.map((s) => contrast(t, s))));
  let p = pct;
  while (p < 100 && Math.min(...stops.map((s) => contrast(mix(t, s, p / 100), s))) < reach) p += 5;
  return p >= 100 ? t : `color-mix(in srgb, ${t} ${p}%, transparent)`;
}

/** The size of the store name in the footer, in px (the merchant's size, or the default of that style) */
export function footerNameSize(cfg: StorefrontConfig, style: "full" | "simple" = cfg.footer.style): number {
  return cfg.footer.sizes?.name ?? (cfg.identity.nameFont ? 28 : style === "simple" ? 20 : 18);
}
