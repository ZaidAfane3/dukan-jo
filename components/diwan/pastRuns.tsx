"use client";

import { useId, useState } from "react";
import { Btn, field, useT } from "./ui";

/* What Announcements and Pop-ups share for the ones that ran: the two lists ("Live and scheduled" and "Past") and the
   "Start again" step, which asks for a new end (or none) before it goes out again. */

export type RunView = "now" | "past";

/** The two lists as tabs: only the words, the owner wants no numbers beside tabs in Diwan */
export function RunTabs({ view, setView, label }: { view: RunView; setView: (v: RunView) => void; label: string }) {
  const t = useT();
  const tabs: [RunView, string][] = [["now", t("Live and scheduled", "الظاهرة والمجدولة")], ["past", t("Past", "السابقة")]];
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([k, word]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={view === k}
          onClick={() => setView(k)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${view === k ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
        >
          {word}
        </button>
      ))}
    </div>
  );
}

/** An ISO time as the value of a datetime-local field (in this computer's time) */
const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** "Start again" under one of the past: the button, then the question with an optional new end. Its old end has passed
    (or it was ended), so the end starts empty: no end unless one is chosen. `start` sends it and gives an error or "". */
export function StartAgain({ note, start }: { note: string; start: (endsAt: string | null) => Promise<string> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const id = useId();
  if (!open) return <Btn onClick={() => setOpen(true)}>{t("Start again", "تشغيل مجددًا")}</Btn>;
  const go = async () => {
    setErr("");
    const endsAt = end ? new Date(end).toISOString() : null;
    if (endsAt && new Date(endsAt) <= new Date()) return setErr(t("The new end must be later than now.", "يجب أن تكون النهاية الجديدة بعد الآن."));
    setBusy(true);
    const e = await start(endsAt);
    setBusy(false);
    if (e) return setErr(e);
    setOpen(false);
  };
  return (
    <div className="w-full space-y-2">
      <p className="text-sm font-semibold">{note}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold" htmlFor={id}>{t("New end (optional)", "نهاية جديدة (اختيارية)")}</label>
          <input id={id} type="datetime-local" className={field} min={toLocal(new Date().toISOString())} value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Btn disabled={busy} onClick={() => void go()}>{busy ? t("Starting…", "جارٍ التشغيل…") : t("Start it now", "شغّله الآن")}</Btn>
        <Btn kind="ghost" disabled={busy} onClick={() => (setOpen(false), setErr(""))}>{t("Cancel", "إلغاء")}</Btn>
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
    </div>
  );
}
