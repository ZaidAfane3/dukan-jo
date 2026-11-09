"use client";

import { useEffect, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { demoOff, demoOffText, useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { isSlug, RESERVED_SLUGS, SLUG_RULE, typedSlug } from "./safe";
import { reservedSlugError } from "./safeAccount";
import { loadSetup, saveSetup } from "./setup";
import { merchantCall, onServer } from "./merchantApi";

/* The store link: every store lives at Dukkan's address followed by its own link name (dukkan.store/olive). Dukkan
   does not sell domains or connect a merchant's own domain, so this page is only about that link: see it, copy it,
   share it, change it. */

const PREFIX = "dukkan.store/";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";

const copy = {
  en: {
    title: "Store link",
    current: "Your store link",
    currentHint: "The link your visitors use to reach your store.",
    edit: "Edit",
    copy: "Copy",
    copied: "Copied",
    share: "Share",
    save: "Save",
    cancel: "Cancel",
    invalid: "Use 3 to 30 letters (a to z), numbers or hyphens. It can't start or end with a hyphen.",
    taken: "This link is taken by another store. Choose another one.",
    saved: "Store link updated",
    noSlug: "You haven't chosen a store link yet. Finish setting up your store to pick one.",
    setup: "Choose link",
    shareTitle: "My store",
  },
  ar: {
    title: "رابط المتجر",
    current: "رابط متجرك",
    currentHint: "الرابط الذي يصل من خلاله الزوار إلى متجرك.",
    edit: "تعديل",
    copy: "نسخ",
    copied: "تم النسخ",
    share: "مشاركة",
    save: "حفظ",
    cancel: "إلغاء",
    invalid: "استخدم من 3 إلى 30 حرفًا لاتينيًا (a-z) أو أرقامًا أو شرطات، ولا يبدأ أو ينتهي بشرطة.",
    taken: "هذا الرابط مستخدم لمتجر آخر. اختر رابطًا غيره.",
    saved: "تم تحديث رابط المتجر",
    noSlug: "لم تختر رابط متجرك بعد. أكمل إعداد متجرك لاختياره.",
    setup: "اختيار الرابط",
    shareTitle: "متجري",
  },
};

export function StoreLink() {
  const { lang } = usePrefs();
  const c = copy[lang];

  const [slug, setSlug] = useState("");
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const tour = useDemo();
  const [draft, setDraft] = useState("");
  const [slugError, setSlugError] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    setSlug(loadSetup()?.slug ?? "");
    setReady(true);
  }, []);

  const url = slug ? `${PREFIX}${slug}` : "";
  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(""), 1600);
  };

  const copyUrl = async () => {
    if (tour) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; /* clipboard blocked: do not claim it was copied */
    }
    flashMsg(c.copied);
  };

  const share = async () => {
    if (tour) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: c.shareTitle, text: url });
      } catch {
        /* cancelled */
      }
    } else {
      void copyUrl();
    }
  };

  const saveSlug = async () => {
    const v = draft.trim();
    if (!isSlug(v)) {
      setSlugError(SLUG_RULE.test(v) && RESERVED_SLUGS.has(v) ? reservedSlugError[lang] : c.invalid);
      return;
    }
    /* a store link belongs to one store: a signed-in account asks Dukkan first (the save is refused anyway if taken) */
    if (onServer() && v !== slug) {
      const r = await merchantCall(`/api/shop/slug?slug=${encodeURIComponent(v)}`, "GET");
      if (r?.data.result === "taken") {
        setSlugError(c.taken);
        return;
      }
    }
    const s = loadSetup();
    if (s) saveSetup({ ...s, slug: v });
    setSlug(v);
    setEditing(false);
    setSlugError("");
    flashMsg(c.saved);
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="store" subtabs={[c.title]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-extrabold">{c.current}</h1>
              <p className="mt-1 text-sm text-muted">{c.currentHint}</p>
            </div>
            {slug && !editing && (
              <button
                type="button"
                disabled={tour}
                title={tour ? demoOffText(lang) : undefined}
                onClick={() => {
                  setDraft(slug);
                  setSlugError("");
                  setEditing(true);
                }}
                className={`rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white ${demoOff}`}
              >
                {c.edit}
              </button>
            )}
          </div>

          {!ready ? null : !slug ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-5 py-5">
              <p className="text-sm text-muted">{c.noSlug}</p>
              <a href="/onboarding" className="rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{c.setup}</a>
            </div>
          ) : editing ? (
            <div className="mt-5">
              <div dir="ltr" className={`flex h-12 items-center overflow-hidden rounded-xl border bg-card text-sm transition focus-within:ring-2 ${slugError ? "border-rose-500 focus-within:ring-rose-500/25" : "border-fg/15 focus-within:border-primary focus-within:ring-primary/25"}`}>
                <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">{PREFIX}</span>
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(typedSlug(e.target.value));
                    setSlugError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && saveSlug()}
                  spellCheck={false}
                  autoCapitalize="none"
                  aria-label={c.current}
                  className="h-full flex-1 bg-transparent px-3 outline-none"
                />
              </div>
              {slugError && <p className="mt-2 text-xs text-rose-600">{slugError}</p>}
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={saveSlug} className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{c.save}</button>
                <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-soft px-5 py-5">
              <p dir="ltr" className="break-all text-lg font-bold">{url}</p>
              <div className="flex items-center gap-4 text-sm font-semibold text-primary">
                <button type="button" onClick={copyUrl} className="hover:underline">{flash === c.copied ? c.copied : c.copy}</button>
                <button type="button" onClick={share} className="hover:underline">{c.share}</button>
              </div>
            </div>
          )}
          {flash === c.saved && <p role="status" className="mt-3 text-sm font-semibold text-primary">{c.saved}</p>}
        </section>
      </main>
    </div>
  );
}
