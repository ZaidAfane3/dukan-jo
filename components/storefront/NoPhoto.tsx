"use client";

import type { CSSProperties, ReactNode } from "react";
import { legibleOn } from "./footerColors";

/* The one picture a product without a photo shows, everywhere: the store's cards, the product page, the cart, the hero cards,
   and the merchant's own pages (products, orders, the form's preview, onboarding). It is the look the cart has always drawn:
   a soft wash in the product's own color, two faint circles and a bag in the middle (a third of the box). It fills whatever
   box it is put in, so the size and the corners come from that box. The tile carries its own light ground, so it reads the
   same on a light page and on a dark one, and the bag's color is checked against that ground. */

/** The color of a product's placeholder: the same one for the same product on every page (the store works it the same way) */
export const noPhotoHue = (id?: number | string | null): number => {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 47) % 360 : 190;
};

/** hsl → "#rrggbb", so the readable-color check can compare the bag with its ground */
const hslHex = (h: number, s: number, l: number): string => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export function NoPhoto({ hue = 190, flat = false, className = "", style, children }: { hue?: number; flat?: boolean; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  /* flat (the playful stores): one soft color and a bigger, filled bag, no circles and no gradient */
  if (flat) {
    const ground = hslHex(h, 75, 86);
    return (
      <div className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: ground, ...style }}>
        <svg viewBox="0 0 24 24" className="relative h-1/2 w-1/2" fill={hslHex(h, 70, 96)} stroke={legibleOn(hslHex(h, 40, 30), ground)} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" />
        </svg>
        {children}
      </div>
    );
  }
  const from = hslHex(h, 70, 93);
  const to = hslHex(h, 55, 80);
  const ground = `linear-gradient(145deg, ${from}, ${to})`;
  const ink = legibleOn(hslHex(h, 45, 32), ground);
  return (
    <div className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: ground, ...style }}>
      <span aria-hidden className="pointer-events-none absolute -end-[18%] -top-[18%] aspect-square w-[75%] rounded-full opacity-50" style={{ background: hslHex(h, 80, 97) }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-[25%] -start-[18%] aspect-square w-[85%] rounded-full opacity-30" style={{ background: hslHex(h, 60, 62) }} />
      <svg viewBox="0 0 24 24" className="relative h-1/3 w-1/3 drop-shadow-sm" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {children}
    </div>
  );
}

/** A product's photo over its placeholder: no photo (or one that fails to load) shows the placeholder, never an empty picture */
export function ProductPhoto({ src, hue, flat, alt = "", className = "", imgClassName = "", imgStyle }: { src?: string | null; hue?: number; flat?: boolean; alt?: string; className?: string; imgClassName?: string; imgStyle?: CSSProperties }) {
  const url = typeof src === "string" ? src.trim() : "";
  return (
    <NoPhoto hue={hue} flat={flat} className={className}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`} style={imgStyle} />
      )}
    </NoPhoto>
  );
}
