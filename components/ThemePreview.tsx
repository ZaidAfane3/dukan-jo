"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "./Prefs";
import { loadSetup } from "./setup";
import { StorefrontTheme } from "./storefront/StorefrontTheme";
import { composeDesign, DEFAULT_THEME_ID, lookOf, previewProducts, type ThemeInfo } from "./themes";
import { loadConfig } from "./storefront/storage";

/* A live preview is laid out as on a wide screen and shrunk to fit, so it shows a lot of the page, not a zoomed-in corner */
const WIDTH = 1920;
const SPEED = 28; /* px a second, while it scrolls by itself */

/** A theme's picture: a browser window with the whole home page inside.
    In the theme store the page scrolls by itself, slowly, down to the end and back up again, without end (it pauses while the
    mouse is over it), and the visitor can take it with the mouse and move it up or down himself; from then on it stays where he
    leaves it.
    With `scroll` the picture is a plain scrolling area (the preview window). */
/* With `sample` the theme is always shown on its own made-up store, never on the store of whoever is looking (Diwan). */
export function ThemePreview({ theme, height, scroll = false, sample = false }: { theme: ThemeInfo; height: number | string; scroll?: boolean; sample?: boolean }) {
  const { lang } = usePrefs();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(380);
  /* The address of the merchant's own store: his dukkan.store link (every store lives at Dukkan's address) */
  const [address, setAddress] = useState("");
  useEffect(() => {
    setAddress(`dukkan.store/${sample ? theme.id : loadSetup()?.slug || "your-store"}`);
  }, [sample, theme.id]);

  /* React 18 does not know the inert attribute yet, so it is set by hand */
  const still = useRef<HTMLDivElement>(null);
  useEffect(() => {
    still.current?.setAttribute("inert", "");
  });

  const state = useRef({ hover: false, stopped: false, pos: 0, dir: 1, dragging: false, moved: false, startY: 0, startTop: 0 });
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* The slow scroll: it moves the window's own scroll position, so dragging it by hand and the automatic movement never fight */
  useEffect(() => {
    const el = box.current;
    if (!el || scroll || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const s = state.current;
    let raf = 0;
    let last = 0;
    let begin = 0;
    const tick = (t: number) => {
      if (s.stopped) return;
      if (!begin) begin = t;
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      /* It waits a moment before starting, and pauses while the mouse is over it */
      if (t - begin > 1200 && !s.hover && !s.dragging) {
        const max = el.scrollHeight - el.clientHeight;
        s.pos = Math.max(0, Math.min(max, s.pos + SPEED * dt * s.dir));
        el.scrollTop = s.pos;
        /* at the end it turns and goes back up, at the top it goes down again */
        if (max > 0 && s.pos >= max) s.dir = -1;
        else if (s.pos <= 0) s.dir = 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scroll, theme]);

  const down = (e: React.PointerEvent) => {
    if (scroll || e.pointerType !== "mouse" || e.button !== 0 || !box.current) return;
    const s = state.current;
    s.dragging = true;
    s.moved = false;
    s.startY = e.clientY;
    s.startTop = box.current.scrollTop;
  };
  const move = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging || !box.current) return;
    const dy = e.clientY - s.startY;
    if (!s.moved && Math.abs(dy) < 5) return;
    if (!s.moved) {
      s.moved = true;
      s.stopped = true; /* once he has moved it, it stays where he leaves it */
      setGrabbing(true);
      box.current.setPointerCapture(e.pointerId);
    }
    box.current.scrollTop = s.startTop - dy;
  };
  const up = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    s.dragging = false;
    setGrabbing(false);
    try {
      box.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* it was not captured */
    }
  };

  /* A drag is not a click: it must not open the preview */
  const onClickCapture = (e: React.MouseEvent) => {
    if (state.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      state.current.moved = false;
    }
  };

  /* A theme without a picture of its own is drawn live, from the theme itself, with sample perfumes */
  const config = useMemo(() => {
    if (theme.shot) return null;
    /* A design the merchant saved is shown on his own store (his logo and his products) */
    if (theme.look && !sample) return composeDesign(loadConfig(), theme.look);
    /* Dukkan's default design is shown on his own store too, so he sees what going back to it looks like */
    if (theme.id === DEFAULT_THEME_ID && !sample) return composeDesign(loadConfig(), lookOf(theme.build(lang, { samples: false })));
    const c = theme.build(lang, { samples: true });
    c.identity.logo = { kind: "image", sample: "star", image: "/demo/perfume/logo.png" };
    return c;
  }, [theme, lang, sample]);
  /* his own store (a saved design, the default design): his products; any other theme: its sample products */
  const own = !sample && (!!theme.look || theme.id === DEFAULT_THEME_ID);
  const products = useMemo(() => (theme.shot ? [] : own ? undefined : previewProducts(lang, theme)), [theme, lang, own]);

  /* The frame around the window takes the theme's own colors (its background, with a touch of its accent), so each theme feels like itself */
  const backdrop = config
    ? (() => {
        const bg = config.theme.background || "#f7f2ea";
        const tint = config.theme.accent || config.theme.primary || config.theme.text || "#c9b48e";
        return `linear-gradient(135deg, color-mix(in srgb, ${tint} 28%, ${bg}), ${bg} 55%, color-mix(in srgb, ${tint} 40%, ${bg}))`;
      })()
    : "linear-gradient(135deg, #efe6d6, #f7f2ea 55%, #e6d9c2)";

  return (
    <div className="rounded-2xl p-3 sm:p-5" style={{ background: backdrop }} onClickCapture={onClickCapture}>
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-25px_rgba(28,26,23,0.55)] ring-1 ring-black/10">
        {/* The browser's bar with the store's address */}
        <div dir="ltr" className="flex items-center border-b border-black/10 bg-[#f6f2ea] px-3 py-2">
          <span className="mx-auto flex h-6 w-4/5 min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-white px-2 text-[11px] text-[#7a6f62] ring-1 ring-black/5">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            {address}
          </span>
        </div>

        <div
          ref={box}
          className={`relative select-none ${scroll ? "overflow-y-auto overflow-x-hidden" : `overflow-hidden ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}`}
          style={{ height, touchAction: scroll ? undefined : "pan-y" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerEnter={() => { state.current.hover = true; }}
          onPointerLeave={() => { state.current.hover = false; }}
        >
          {theme.shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.shot} alt={theme.name[lang]} className="block w-full" draggable={false} />
          ) : (
            /* only a picture: its links and buttons can't be reached with the mouse or the keys (inert) */
            <div ref={still} aria-hidden className="pointer-events-none" style={{ width: WIDTH, zoom: w / WIDTH }}>
              {config && <StorefrontTheme config={config} device="desktop" interactive={false} products={products} store={own ? undefined : theme.demo ? { name: theme.demo.name[lang], color: theme.demo.color } : { name: lang === "ar" ? "متجر عطور" : "Perfume Store", color: "#1c1a17" }} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
