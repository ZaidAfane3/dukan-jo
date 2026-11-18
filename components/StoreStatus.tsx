"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "./content";
import { loadMaintenance, MAINTENANCE_KEY, maintenanceText, saveMaintenance, type Maintenance } from "./maintenance";
import { saveNow } from "./serverSync";
import { offerUndo } from "./undo";
import { SELL_LINKS, sellWords, useSellReady } from "./ReadyToSell";

const words = {
  en: {
    open: "Store open",
    paused: "Store under maintenance",
    openHint: "Visitors can see your store.",
    pausedHint: "Visitors see a maintenance page.",
    see: "See what visitors see",
    saving: "Saving…",
    failed: "Couldn't save. Try again.",
    /* the undo note at the bottom (UndoToast.tsx) */
    undoPaused: "Store put under maintenance",
    undoOpened: "Store opened",
  },
  ar: {
    open: "المتجر مفتوح",
    paused: "المتجر قيد الصيانة",
    openHint: "يستطيع الزوار رؤية متجرك.",
    pausedHint: "يرى الزوار صفحة الصيانة.",
    see: "عرض ما يراه الزوار",
    saving: "جارٍ الحفظ…",
    failed: "تعذّر الحفظ. حاول مرة أخرى.",
    undoPaused: "وُضع المتجر قيد الصيانة",
    undoOpened: "فُتح المتجر",
  },
};

/* The switch's save still on its way: the menu can close and open again meanwhile, and must not take a second click */
let inFlight: Promise<boolean> | null = null;
/* the switches shown (the menu may be open while an undo runs): they read the state again */
const SHOWN = "dukkan-store-status";

/** Pauses or opens the store: kept in this browser and sent to the server at once, on its own. False when the server did
    not keep it (this browser then holds the server's state again: saveNow put it back). */
async function putStatus(on: boolean): Promise<boolean> {
  const before = maintenanceText(loadMaintenance());
  saveMaintenance({ on, message: { en: "", ar: "" } });
  const job = saveNow(MAINTENANCE_KEY, before);
  inFlight = job;
  window.dispatchEvent(new Event(SHOWN));
  const ok = await job;
  if (inFlight === job) inFlight = null;
  window.dispatchEvent(new Event(SHOWN));
  return ok;
}

/** The profile menu's switch to put the store under maintenance and open it again. Visitors of a paused store see
    Dukkan's own "under maintenance" page (MaintenancePage.tsx); the merchant can't write his own text on it.
    The switch goes to the server at once, on its own, and says "Saving…" until the server kept it: a pause that never
    reached the server would leave the store open while the menu says paused. Not kept: it shows the server's state again. */
export function StoreStatus({ lang, disabled = false, disabledTitle, onLink }: { lang: Lang; disabled?: boolean; disabledTitle?: string; onLink?: () => void }) {
  const w = words[lang];
  const [m, setM] = useState<Maintenance | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setM(loadMaintenance());
    let live = true;
    const job = inFlight;
    if (job) {
      setSaving(true);
      void job.then((ok) => {
        if (!live) return;
        setM(loadMaintenance());
        setSaving(false);
        setFailed(!ok);
      });
    }
    /* an undo switched it back: show what is kept now */
    const again = () => {
      if (!live) return;
      setM(loadMaintenance());
      setSaving(!!inFlight);
    };
    window.addEventListener(SHOWN, again);
    return () => {
      live = false;
      window.removeEventListener(SHOWN, again);
    };
  }, []);
  /* a paused store opens again only when it is ready to sell (safeOrder readyToSell; the server holds the switch to the
     same rule: app/api/store PUT "not-ready"). Pausing is always allowed. */
  const sell = useSellReady();
  if (!m) return null;
  const open = !m.on;
  const cantOpen = !open && sell.read && !sell.ok;
  const flip = async () => {
    if (disabled || saving || inFlight || cantOpen) return;
    const next = { on: open, message: { en: "", ar: "" } };
    setM(next);
    setFailed(false);
    setSaving(true);
    const ok = await putStatus(next.on);
    /* not kept: this browser now holds the server's state again (saveNow put it back) */
    if (!ok) setM(loadMaintenance());
    setFailed(!ok);
    setSaving(false);
    /* kept: an Undo switches it back the same way, unless it was switched again since */
    if (ok)
      offerUndo({
        scope: "store-status",
        label: (l) => (next.on ? words[l].undoPaused : words[l].undoOpened),
        undo: () => (inFlight || loadMaintenance().on !== next.on ? false : putStatus(!next.on)),
      });
  };
  const off = disabled || saving || cantOpen;
  return (
    <div className="px-5 py-3.5">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={open}
        aria-disabled={off || undefined}
        aria-busy={saving || undefined}
        title={disabled ? disabledTitle : undefined}
        onClick={() => void flip()}
        className={`flex w-full items-center justify-between gap-3 text-start text-sm ${disabled ? "cursor-not-allowed opacity-40" : cantOpen ? "cursor-not-allowed" : saving ? "cursor-wait" : ""}`}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${open ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="min-w-0">
            <span className="block font-semibold">{open ? w.open : w.paused}</span>
            <span aria-live="polite" className="block text-xs text-muted">{saving ? w.saving : open ? w.openHint : w.pausedHint}</span>
          </span>
        </span>
        <span aria-hidden dir="ltr" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${open ? "bg-emerald-500" : "bg-amber-500"} ${saving ? "opacity-60" : ""}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${open ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
      {failed && !saving && (
        <p role="alert" className="ms-5 mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {w.failed}
        </p>
      )}
      {cantOpen && !disabled && (
        <div role="status" className="ms-5 mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold">{sellWords[lang].notReady}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-4">
            {sell.missing.map((x) => (
              <li key={x}><a href={SELL_LINKS[x]} onClick={onLink} className="font-bold underline underline-offset-2">{sellWords[lang][x]}</a></li>
            ))}
          </ul>
        </div>
      )}
      {!open && !disabled && !saving && (
        <Link href="/store" target="_blank" onClick={onLink} className="ms-5 mt-1.5 inline-block text-xs font-semibold text-primary hover:underline">
          {w.see}
        </Link>
      )}
    </div>
  );
}
