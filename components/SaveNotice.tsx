"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "./Prefs";
import { SIGNED_OUT_ELSEWHERE, SIGNED_OUT_NOTE } from "./accounts";
import { SAVE_REFUSED, THEME_NOT_BOUGHT } from "./serverSync";

/* Says so when the server refused to keep a change for good (serverSync.ts SAVE_REFUSED): the page already shows the
   change, so without this the merchant would think it was saved. A suspended store is sent to its own page, so only
   these are said here. Shown on every merchant page, the store designer too (mounted by DemoBoot). It also says, once,
   that a tab was sent to sign in because its session ended (accounts.ts SIGNED_OUT_NOTE). */

const words = {
  en: {
    "too-big": "Some changes were not saved: your store has run out of space. Remove some products or pictures, then try again.",
    "media-full": "A picture was not saved: your store's space for pictures is full. Remove some pictures, then try again.",
    invalid: "Some changes could not be saved. Reload the page and try again.",
    "slug-taken": "Your store link was not saved: another store already uses it. Choose another link.",
    "slug-reserved": "Your store link was not saved: this name is reserved. Choose another link.",
    "signed-out": "You were signed out. Sign in again to keep working.",
    "signed-out-elsewhere": "Your account was opened on another device, so this one was signed out. Your account works on one device at a time. Sign in here to continue; the other device will be signed out.",
    stale: "Couldn't save some changes. Reload to see the latest.",
    "theme-not-bought": "This theme isn't bought yet. Buy it from the Theme store to use it.",
    "not-ready": "Not saved: your store isn't ready to go live yet. Finish what's still missing (the setup steps, a way to pay, delivery, or confirming your email), then save again.",
    close: "Close",
  },
  ar: {
    "too-big": "لم تُحفظ بعض التعديلات: امتلأت مساحة متجرك. احذف بعض المنتجات أو الصور ثم حاول مرة أخرى.",
    "media-full": "لم تُحفظ إحدى الصور: امتلأت مساحة الصور في متجرك. احذف بعض الصور ثم حاول مرة أخرى.",
    invalid: "تعذّر حفظ بعض التعديلات. أعد تحميل الصفحة وحاول مرة أخرى.",
    "slug-taken": "لم يُحفظ رابط متجرك: متجر آخر يستخدمه. اختر رابطًا آخر.",
    "slug-reserved": "لم يُحفظ رابط متجرك: هذا الاسم محجوز. اختر رابطًا آخر.",
    "signed-out": "تم تسجيل خروجك. سجّل الدخول مجددًا لمتابعة العمل.",
    "signed-out-elsewhere": "فُتح حسابك على جهاز آخر، فتم تسجيل خروجك من هذا الجهاز. يعمل حسابك على جهاز واحد في كل مرة. سجّل الدخول هنا للمتابعة، وسيُسجَّل خروج الجهاز الآخر.",
    stale: "تعذّر حفظ بعض التعديلات. أعد تحميل الصفحة لترى أحدث نسخة.",
    "theme-not-bought": "لم تشترِ هذا الثيم بعد. اشترِه من متجر الثيمات لتستخدمه.",
    "not-ready": "لم يُحفظ: متجرك غير جاهز للنشر بعد. أكمل ما ينقصه (خطوات الإعداد، أو طريقة دفع، أو التوصيل، أو تأكيد بريدك الإلكتروني)، ثم احفظ مرة أخرى.",
    close: "إغلاق",
  },
};
/* the button to the theme store, on the theme he has not bought (ThemeStore.tsx ?theme=) */
const buyWords = { en: "Buy it", ar: "اشترِه" };

type Why = Exclude<keyof (typeof words)["en"], "close">;
const said = (v: unknown): v is Why => typeof v === "string" && v !== "close" && v in words.en;

export function SaveNotice() {
  const { lang } = usePrefs();
  const [why, setWhy] = useState<Why | null>(null);
  /* for "theme-not-bought": the theme, so "Buy it" opens the theme store on it */
  const [theme, setTheme] = useState("");

  useEffect(() => {
    /* this tab was sent to sign in because its session ended (accounts.ts): said once, here */
    try {
      const note = sessionStorage.getItem(SIGNED_OUT_NOTE);
      if (note === "1" || note === SIGNED_OUT_ELSEWHERE) {
        sessionStorage.removeItem(SIGNED_OUT_NOTE);
        setWhy(note === SIGNED_OUT_ELSEWHERE ? "signed-out-elsewhere" : "signed-out");
      }
    } catch {
      /* storage blocked */
    }
    const on = (e: Event) => {
      const d = (e as CustomEvent<unknown>).detail;
      if (said(d)) {
        setWhy(d);
        setTheme("");
      }
    };
    /* a paid theme he has not bought was not put on the store (serverSync.ts THEME_NOT_BOUGHT): detail is its id */
    const onTheme = (e: Event) => {
      const d = (e as CustomEvent<unknown>).detail;
      setWhy("theme-not-bought");
      setTheme(typeof d === "string" && /^[a-z][a-z0-9-]{1,30}$/.test(d) ? d : "");
    };
    window.addEventListener(SAVE_REFUSED, on);
    window.addEventListener(THEME_NOT_BOUGHT, onTheme);
    return () => {
      window.removeEventListener(SAVE_REFUSED, on);
      window.removeEventListener(THEME_NOT_BOUGHT, onTheme);
    };
  }, []);

  if (!why) return null;
  const w = words[lang];
  const buy = why === "theme-not-bought" ? `/themes${theme ? `?theme=${theme}` : ""}` : null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/15">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <p className="min-w-0 flex-1 leading-relaxed">
        {w[why]}
        {buy && (
          <>
            {" "}
            <a href={buy} onClick={() => setWhy(null)} className="whitespace-nowrap font-bold underline underline-offset-2">{buyWords[lang]}</a>
          </>
        )}
      </p>
      <button type="button" onClick={() => setWhy(null)} aria-label={w.close} title={w.close} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition hover:bg-white/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
