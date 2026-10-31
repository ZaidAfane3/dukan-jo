"use client";

import { useEffect, useState } from "react";
import type { Lang } from "../content";
import { editLocked } from "../demoSandbox";
import { load as loadPages, savePages, type InfoPage } from "../InfoPages";
import { Field, input, Toggle } from "./controls";

/* Editing a page of the store (an info page) inside the designer. What he types is saved at once, in the same list the Info pages
   dashboard uses, and the preview shows the page as he writes it. */

const words = {
  en: { back: "Back to the home page", editing: "Editing the page", title: "Page title", content: "Text under the title (Optional)", published: "Published", footer: "Show the page link in the footer", delete: "Delete this page", ask: "Delete this page? This cannot be undone.", yes: "Yes, delete", cancel: "Cancel", demo: "Pages cannot be changed in the demo", missing: "This page was deleted" },
  ar: { back: "العودة إلى الصفحة الرئيسية", editing: "تعديل الصفحة", title: "عنوان الصفحة", content: "نص تحت العنوان (اختياري)", published: "منشورة", footer: "عرض رابط الصفحة في التذييل", delete: "حذف هذه الصفحة", ask: "هل تريد حذف هذه الصفحة؟ لا يمكن التراجع عن ذلك.", yes: "نعم، احذف", cancel: "إلغاء", demo: "لا يمكن تغيير الصفحات في النسخة التجريبية", missing: "تم حذف هذه الصفحة" },
};

export function PageEditor({ lang, id, onBack, onChanged }: { lang: Lang; id: number; onBack: () => void; onChanged: () => void }) {
  const w = words[lang];
  const [page, setPage] = useState<InfoPage | null>(null);
  const [asking, setAsking] = useState(false);
  const locked = editLocked();

  useEffect(() => {
    setPage(loadPages().find((p) => p.id === id) ?? null);
    setAsking(false);
  }, [id]);

  /* Saves the whole list with this page changed, and tells the preview */
  const save = (patch: Partial<InfoPage>) => {
    if (locked || !page) return;
    const next = { ...page, ...patch };
    setPage(next);
    savePages(loadPages().map((p) => (p.id === id ? next : p)));
    window.dispatchEvent(new Event("storage"));
    onChanged();
  };

  const remove = () => {
    if (locked) return;
    savePages(loadPages().filter((p) => p.id !== id));
    window.dispatchEvent(new Event("storage"));
    onChanged();
    onBack();
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={w.back} title={w.back} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg">
          <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </button>
        <div>
          <p className="text-xs text-muted">{w.editing}</p>
          <p className="font-bold text-black dark:text-white">{page ? page.title[lang] || page.title[lang === "ar" ? "en" : "ar"] : w.missing}</p>
        </div>
      </div>
      {page && (
        <div className="space-y-4 p-4">
          {locked && <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">{w.demo}</p>}
          <Field label={w.title}>
            <input disabled={locked} value={page.title[lang]} onChange={(e) => save({ title: { ...page.title, [lang]: e.target.value } })} maxLength={60} className={`${input} h-11`} />
          </Field>
          <Field label={w.content}>
            <textarea disabled={locked} value={page.content[lang]} onChange={(e) => save({ content: { ...page.content, [lang]: e.target.value } })} rows={12} maxLength={4000} className={`${input} resize-y py-3`} />
          </Field>
          <Toggle on={page.published} onChange={(published) => save({ published })} label={w.published} />
          <Toggle on={page.footer} onChange={(footer) => save({ footer })} label={w.footer} />

          <div className="border-t border-fg/10 pt-4">
            {asking ? (
              <div className="rounded-xl bg-rose-500/10 p-3">
                <p className="text-sm text-rose-700 dark:text-rose-400">{w.ask}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={remove} className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700">{w.yes}</button>
                  <button type="button" onClick={() => setAsking(false)} className="h-10 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={locked} onClick={() => setAsking(true)} className="flex h-11 w-full items-center justify-center rounded-xl border border-rose-500/50 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-40">{w.delete}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
