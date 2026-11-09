"use client";

import { dateLocale } from "./content";
import { useEffect, useState } from "react";
import { leaveSupportView, SUPPORT_VIEW, type SupportView } from "./accounts";
import { replaceAccountData } from "./demoSandbox";
import { merchantCall, onServer } from "./merchantApi";
import { dropSaves, SAVE_REFUSED } from "./serverSync";
import { usePrefs } from "./Prefs";
import { TwoStepPrompt } from "./TwoStepSettings";

/* What sits above the dashboard's header: while a Dukkan staff member is looking at the store from Diwan ("log in as
   merchant"), a bar that says so, until when, and ends it; and the one-time offer to set up a 2-step code. */

const words = {
  en: {
    viewing: "Dukkan support is viewing this store", viewOnly: "view only", canEdit: "changes are saved", ends: "ends at", end: "End", ending: "Ending…",
    notSaved: "That change was not saved: this visit is view only. The page shows it, the store does not have it.", undo: "Show the store as it is",
  },
  ar: {
    viewing: "دعم دكّان يعرض هذا المتجر", viewOnly: "للعرض فقط", canEdit: "التعديلات تُحفظ", ends: "ينتهي الساعة", end: "إنهاء", ending: "جارٍ الإنهاء…",
    notSaved: "لم يُحفظ هذا التعديل: هذه الزيارة للعرض فقط. الصفحة تعرضه لكن المتجر لم يتغيّر.", undo: "اعرض المتجر كما هو",
  },
};

const read = (): SupportView | "none" | null => {
  try {
    const v = sessionStorage.getItem(SUPPORT_VIEW);
    if (v === "none") return "none";
    const o = v ? JSON.parse(v) : null;
    return o && typeof o.staffName === "string" && typeof o.endsAt === "string" ? { staffName: o.staffName, endsAt: o.endsAt, viewOnly: o.viewOnly !== false } : null;
  } catch {
    return null;
  }
};

/* ends the visit here and goes back to the shop in Diwan */
async function end() {
  const shop = await leaveSupportView();
  window.location.href = shop ? `/diwan/shops/${shop}` : "/diwan/shops";
}

export function SupportBanner() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [view, setView] = useState<SupportView | null>(null);
  const [ending, setEnding] = useState(false);
  /* a change the page shows but the server refused (view-only visit) */
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<string>).detail === "view-only" && setRefused(true);
    window.addEventListener(SAVE_REFUSED, on);
    return () => window.removeEventListener(SAVE_REFUSED, on);
  }, []);

  /* puts the store's saved copy back in this browser, so the page shows what the merchant really has */
  const undo = async () => {
    dropSaves();
    const r = await merchantCall("/api/store", "GET");
    if (r?.status === 200 && r.data.data && typeof r.data.data === "object") replaceAccountData(r.data.data as Record<string, string>);
    window.location.reload();
  };

  useEffect(() => {
    if (!onServer()) return;
    const saved = read();
    if (saved === "none") return;
    if (saved) return setView(saved);
    /* a tab opened without it: asked once, and the answer kept for this tab */
    void merchantCall("/api/auth/me", "GET").then((r) => {
      const imp = r?.status === 200 ? (r.data.impersonation as SupportView | null) : null;
      try {
        sessionStorage.setItem(SUPPORT_VIEW, imp ? JSON.stringify(imp) : "none");
      } catch {
        /* storage blocked */
      }
      if (imp) setView(imp);
    });
  }, []);

  /* the visit runs out by itself at its end */
  useEffect(() => {
    if (!view) return;
    const left = new Date(view.endsAt).getTime() - Date.now();
    const t = setTimeout(() => void end(), Math.max(0, Math.min(left, 2_147_000_000)));
    return () => clearTimeout(t);
  }, [view]);

  if (!view) return null;
  const at = new Date(view.endsAt).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-amber-500 px-5 py-2 text-sm font-semibold text-black md:px-10">
      <p>
        {w.viewing} ({view.staffName}) · {view.viewOnly ? w.viewOnly : w.canEdit} · {w.ends} <span dir="ltr">{at}</span>
      </p>
      <button
        type="button"
        disabled={ending}
        onClick={() => {
          setEnding(true);
          void end();
        }}
        className="h-8 rounded-lg bg-black px-4 text-xs font-bold text-white hover:bg-black/80 disabled:opacity-60"
      >
        {ending ? w.ending : w.end}
      </button>
      {refused && (
        <p className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 font-medium">
          <span>{w.notSaved}</span>
          <button type="button" onClick={() => void undo()} className="underline underline-offset-2">
            {w.undo}
          </button>
        </p>
      )}
    </div>
  );
}

/** Mounted once in the dashboard's header (DashboardBar.tsx) */
export function AccountBanners() {
  return (
    <>
      <SupportBanner />
      <TwoStepPrompt />
    </>
  );
}
