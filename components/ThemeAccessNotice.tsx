"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCatalog } from "./catalog";
import { usePrefs } from "./Prefs";
import { findTheme, leaveUnboughtTheme } from "./themes";

/* On the merchant's home page (Dashboard.tsx): a store whose theme in use is a paid one it never bought (no purchase
   recorded on the server: server/themeOwnership.ts) goes back to Dukkan's free default theme, the normal way
   (themes.ts leaveUnboughtTheme: saved like any change, his design kept in My themes as a draft copy), and this says so,
   once, with a way to buy the theme. Its customers already see the free theme (server/publicStore.ts). */

const words = {
  en: { back: (name: string) => `Your store is back on the free theme: ${name} wasn't bought.`, buy: "Buy it", close: "Close" },
  ar: { back: (name: string) => `عاد متجرك إلى الثيم المجاني: لم يتم شراء ${name}.`, buy: "اشترِه", close: "إغلاق" },
};

/* the theme the store just left, kept for this tab until the note is closed or the page is left: a reload that brings the
   server's copy right after (accounts.ts syncOnOpen) still shows it */
const NOTE = "dukkan-theme-back";
/* the tab has the store as the server has it (accounts.ts SYNCED): the check waits for it, at most this many tries */
const SYNCED = "dukkan-synced";
const TRIES = 10;

const readNote = (): string => {
  try {
    return sessionStorage.getItem(NOTE) ?? "";
  } catch {
    return "";
  }
};
const writeNote = (id: string | null) => {
  try {
    if (id) sessionStorage.setItem(NOTE, id);
    else sessionStorage.removeItem(NOTE);
  } catch {
    /* storage blocked: the note shows on this page only */
  }
};
const synced = () => {
  try {
    return sessionStorage.getItem(SYNCED) === "1";
  } catch {
    return true;
  }
};

/* once per page load: React may run the effect twice */
let ran = false;

export function ThemeAccessNotice() {
  const { lang } = usePrefs();
  /* the theme's name, also for a theme made in Diwan (the theme store's list) */
  useCatalog();
  const [left, setLeft] = useState("");

  useEffect(() => {
    const before = readNote();
    if (before) setLeft(before);
    if (ran) return;
    ran = true;
    let tries = 0;
    let timer: number | undefined;
    const check = () => {
      if (!synced() && ++tries < TRIES) {
        timer = window.setTimeout(check, 1000);
        return;
      }
      void leaveUnboughtTheme(lang).then((id) => {
        if (!id) return;
        writeNote(id);
        setLeft(id);
      });
    };
    check();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* leaving the page: said once */
  useEffect(() => () => writeNote(null), []);

  if (!left) return null;
  const w = words[lang];
  const t = findTheme(left);
  const name = t ? t.name[lang] : left;
  const close = () => {
    writeNote(null);
    setLeft("");
  };
  return (
    <section role="status" className="flex items-start gap-3 rounded-2xl bg-amber-500/12 p-4 ring-1 ring-amber-500/30">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Z" />
          <path d="M5 13.5V20h14v-6.5" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed">
        {w.back(name)}{" "}
        <Link href={`/themes?theme=${encodeURIComponent(left)}`} onClick={close} className="whitespace-nowrap font-bold text-primary underline underline-offset-2">
          {w.buy}
        </Link>
      </p>
      <button type="button" onClick={close} aria-label={w.close} title={w.close} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </section>
  );
}
