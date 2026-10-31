"use client";

import { mayBeRude } from "./safe";

/** Under a text customers will read (a store text, a product name): a gentle note when it seems to have a rude word (see mayBeRude).
    It never stops saving: the merchant decides. One note for the designer and the dashboard alike. */
export function RudeNote({ lang, text, className = "mt-1.5" }: { lang: "en" | "ar"; text?: string | (string | undefined)[]; className?: string }) {
  const texts = Array.isArray(text) ? text : [text];
  if (!texts.some((t) => mayBeRude(t))) return null;
  return (
    <p role="note" className={`${className} rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300`}>
      {lang === "ar" ? "قد يحتوي هذا النص على كلمة غير لائقة، وسيراه العملاء كما كتبته." : "This text may contain a rude word. Customers will see it as written."}
    </p>
  );
}
