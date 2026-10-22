"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { demoActive, endDemo, installDemoIfActive, reseedDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";

const words = {
  en: { label: "Platform tour: fake data only", create: "Create your own store", end: "End the tour" },
  ar: { label: "تجربة المنصة: بيانات وهمية فقط", create: "أنشئ متجرك الخاص", end: "إنهاء التجربة" },
};

/* Switches the browser's storage to the tour's made-up copy (see demoSandbox.ts) before any page
   reads its data, and shows a small bar while the tour is running. It sits first in the layout. */
/* In the tour every form can be opened and looked at, but never filled in or sent. Fields are
   switched off and say "Fake demo" where they are empty, and a note sits on top of each form.
   It works on the page itself, so it covers every form without changing each page. */
function useFormLock(on: boolean, lang: "en" | "ar") {
  useEffect(() => {
    if (!on) return;
    const text = lang === "ar" ? "تجربة وهمية، لا يمكن التعديل على النصوص" : "Fake demo: texts cannot be edited";
    const note = lang === "ar" ? "تجربة وهمية: النماذج للعرض فقط، ولا يمكن تعبئتها أو إرسالها." : "Fake demo: forms are for viewing only and cannot be filled in or sent.";

    const lockField = (el: HTMLElement) => {
      const f = el as HTMLInputElement;
      if (!f.disabled) f.disabled = true;
      const textual = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(|text|search|tel|email|number|url|password)$/.test(el.type));
      if (textual && !f.value) f.placeholder = text;
      if (el.tagName === "BUTTON") el.title = text;
    };

    const lock = () => {
      /* The sign-up page is where the tour ends, so its form stays usable */
      if (window.location.pathname.startsWith("/signup")) return;
      document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
        form.dataset.demoLock = "1";
        form.setAttribute("data-demo-note", note);
        form.querySelectorAll<HTMLElement>("input, textarea, select, button[type=submit]").forEach(lockField);
      });
      /* The settings page keeps its fields outside of form tags */
      if (window.location.pathname.startsWith("/settings")) {
        document.querySelectorAll<HTMLElement>("main input, main textarea, main select").forEach(lockField);
      }
    };

    const block = (e: Event) => {
      if ((e.target as HTMLElement).closest?.("form[data-demo-lock]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    lock();
    const watcher = new MutationObserver(lock);
    watcher.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("submit", block, true);
    return () => {
      watcher.disconnect();
      document.removeEventListener("submit", block, true);
    };
  }, [on, lang]);
}

function useTour() {
  const { lang } = usePrefs();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(demoActive()), []);
  return { on, lang, w: words[lang] };
}

const create = "rounded-lg bg-[#5fd9c4] px-3.5 py-1.5 text-xs font-bold text-[#00323b] transition hover:bg-[#8be8d6]";
const end = "rounded-lg border border-white/30 px-3.5 py-1.5 text-xs font-semibold transition hover:bg-white/10";

/* Switches the browser's storage to the tour's made-up copy (see demoSandbox.ts) before any page
   reads its data. It sits first in the layout. On pages without a dashboard header it also shows
   a small floating bar. */
export function DemoBoot() {
  if (typeof window !== "undefined") installDemoIfActive();
  const { on, lang, w } = useTour();
  useFormLock(on, lang);
  if (!on) return null;
  return (
    <div role="status" className="demo-pill dash fixed bottom-4 start-1/2 z-[70] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-[#00323b] px-4 py-2.5 text-white shadow-2xl ring-1 ring-white/15 rtl:translate-x-1/2">
      <span className="text-xs font-semibold sm:text-sm">{w.label}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => endDemo("/signup")} className={create}>{w.create}</button>
        <button type="button" onClick={() => endDemo()} className={end}>{w.end}</button>
      </div>
    </div>
  );
}

/** The tour bar under the dashboard's top bar. It hides the floating one while it is on the page. */
export function DemoStrip() {
  const { on, w } = useTour();
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.demoStrip = "1";
    return () => {
      delete document.documentElement.dataset.demoStrip;
    };
  }, [on]);
  if (!on) return null;
  return (
    <div role="status" className="dash flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#00323b] px-5 py-2 text-white md:px-10">
      <span className="text-xs font-semibold sm:text-sm">{w.label}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => endDemo("/signup")} className={create}>{w.create}</button>
        <button type="button" onClick={() => endDemo()} className={end}>{w.end}</button>
      </div>
    </div>
  );
}

/* Keeps the whole tour in the language the visitor chose. The names, products and orders of the tour are
   written in one language, so when the language changes they are written again and every page is built
   again from them. Outside the tour this does nothing. */
export function DemoRemount({ children }: { children: React.ReactNode }) {
  const { lang } = usePrefs();
  const seeded = useRef<string | null>(null);
  if (typeof window !== "undefined" && demoActive()) {
    if (seeded.current !== null && seeded.current !== lang) reseedDemo(lang);
    seeded.current = lang;
    return <Fragment key={lang}>{children}</Fragment>;
  }
  return <>{children}</>;
}
