"use client";

import { motion, useReducedMotion } from "framer-motion";
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";

const ease = [0.2, 0.65, 0.3, 0.9] as const;

/** Fades and lifts its children into view once, when scrolled to. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/** Infinite horizontal loop of items. */
export function Marquee({
  children,
  reverse = false,
}: {
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
      <div className={`flex w-max gap-6 ${reverse ? "animate-marquee-slow" : "animate-marquee"}`}>
        {children}
        {children}
      </div>
    </div>
  );
}

/**
 * A card that answers the mouse: while the pointer is over it, it rises a little and grows a little,
 * then settles back. There is no swinging or rotating. Children can still sit at different depths
 * with `transform: translateZ(...)`, which gives the stack its layers.
 * `max` is kept so existing uses still compile; it no longer tilts anything.
 */
export function Tilt({
  children,
  className,
  perspective = 1100,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  /** Lower values make the 3D depth stronger. */
  perspective?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={className} style={{ perspective }}>
      <motion.div
        className="relative h-full"
        style={{ transformStyle: "preserve-3d" }}
        whileHover={reduce ? undefined : { y: -10, scale: 1.03 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Types its text out like a keyboard when it scrolls into view. The full text
 * is always laid out (the part not typed yet is just hidden), so nothing jumps
 * around while it types, and it shows in full without JavaScript or when the
 * visitor prefers reduced motion.
 */
export function Typed({
  text,
  as = "span",
  className,
  speed = 40,
}: {
  text: string;
  as?: "span" | "h2" | "h3" | "p";
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const chars = Array.from(text);
  const [armed, setArmed] = useState(false); /* false until we are on the client: show everything */
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  /* A new text (for example after a language change) types again when it is in view. */
  useIsoLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setArmed(true);
    setCount(0);
    setStarted(false);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [text]);

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setCount((n) => {
        if (n >= chars.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, text, speed]);

  const shown = armed ? count : chars.length;
  const typing = armed && started && count < chars.length;

  return createElement(
    as,
    { ref, className, "aria-label": text },
    <span aria-hidden>
      {chars.slice(0, shown).join("")}
      {typing && <span className="mx-px inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-current" />}
      <span className="invisible">{chars.slice(shown).join("")}</span>
    </span>,
  );
}
