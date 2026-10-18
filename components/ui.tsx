"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

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

/** Counts up to `to` when scrolled into view. */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
}: {
  to: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${prefix}${Math.round(v).toLocaleString("en-US")}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration: 2, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, to, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
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
