import type { PatternKey } from "./config";

/* The faint patterns a store can have behind its page. Each is one small tile, drawn in the accent color through a mask. */
const tile = (w: number, h: number, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}`;

export const patterns: Record<Exclude<PatternKey, "none">, { url: string; w: number; h: number }> = {
  /* an eight-point star made of two squares */
  stars: { w: 64, h: 64, url: tile(64, 64, "<g fill='none' stroke='black' stroke-width='1'><rect x='18' y='18' width='28' height='28'/><rect x='18' y='18' width='28' height='28' transform='rotate(45 32 32)'/></g>") },
  dots: { w: 24, h: 24, url: tile(24, 24, "<circle cx='12' cy='12' r='1.6' fill='black'/>") },
  lines: { w: 18, h: 18, url: tile(18, 18, "<path d='M-2 20 L20 -2' fill='none' stroke='black' stroke-width='1'/>") },
  diamonds: { w: 30, h: 30, url: tile(30, 30, "<path d='M15 3 L27 15 L15 27 L3 15 Z' fill='none' stroke='black' stroke-width='1'/>") },
  waves: { w: 44, h: 14, url: tile(44, 14, "<path d='M0 7 Q11 0 22 7 T44 7' fill='none' stroke='black' stroke-width='1'/>") },
};
