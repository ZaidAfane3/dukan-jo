"use client";

import { useEffect, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { demoOff, demoOffText, useDemo } from "./demoSandbox";
import { usePrefs } from "./Prefs";
import { isNewSlug, isPlatformPage, isSlug, reservedForNew, slugDropped, slugDroppedText, SLUG_RULE, typedSlug } from "./safe";
import { reservedSlugError } from "./safeAccount";
import { loadSetup, saveSetup, SETUP_KEY } from "./setup";
import { SAVE_REFUSED, saveNow } from "./serverSync";
import { merchantCall, onServer } from "./merchantApi";
import { STORE_PREFIX, storeUrl } from "./siteAddress";
import { ShareMenu } from "./ShareMenu";
import { dropUndos, offerUndo } from "./undo";
import type { Lang } from "./content";
import { usePageTitle } from "./pageTitle";
import { Skeleton } from "./Skeleton";

/* the undo note at the bottom (UndoToast.tsx) */
const undoLink: Record<Lang, (s: string) => string> = { en: (s) => `Store link changed to ${s}`, ar: (s) => `تغيّر رابط المتجر إلى ${s}` };

/* The store link: every store lives at Dukkan's address followed by its own link name (components/siteAddress.ts, e.g. dukkan-demo.afaneh.dev/olive). Dukkan
   does not sell domains or connect a merchant's own domain, so this page is only about that link: see it, copy it,
   share it, change it. */

const PREFIX = STORE_PREFIX;
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
    failed: "Couldn't save your store link. Check your connection and try again.",
    saved: "Store link updated",
    noSlug: "You haven't chosen a store link yet. Finish setting up your store to pick one.",
    setup: "Choose link",
    shareTitle: "My store",
    open: "Open my store",
    pageNow: "This link is now one of Dukkan's own pages, so visitors can't reach your store at it. Choose another link.",
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
    failed: "تعذّر حفظ رابط متجرك. تحقق من اتصالك وحاول مرة أخرى.",
    saved: "تم تحديث رابط المتجر",
    noSlug: "لم تختر رابط متجرك بعد. أكمل إعداد متجرك لاختياره.",
    setup: "اختيار الرابط",
    shareTitle: "متجري",
    open: "افتح متجري",
    pageNow: "أصبح هذا الرابط صفحة من صفحات دكان، لذلك لا يصل الزوار إلى متجرك من خلاله. اختر رابطًا آخر.",
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
  /* he typed something a link can't hold (Arabic letters, symbols): said under the box instead of dropped silently */
  const [dropped, setDropped] = useState(false);
  const [flash, setFlash] = useState("");
  /* his store is kept on Dukkan's server (signed in, not the tour), so its address shows it to anyone */
  const [live, setLive] = useState(false);

  usePageTitle(`${brandName(lang)} | ${c.title}`);

  useEffect(() => {
    setSlug(loadSetup()?.slug ?? "");
    setLive(onServer());
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

  /* only this page shows the link: its undo goes when it closes */
  useEffect(() => () => dropUndos("store-link"), []);
  /* a save on its way: a second press (Enter, then Save) waits for it */
  const busy = useRef(false);
  const saveSlug = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await trySaveSlug();
    } finally {
      busy.current = false;
    }
  };
  const trySaveSlug = async () => {
    const v = draft.trim();
    const was = slug;
    /* keeping the link the store already has is always allowed; a different one must be free to choose now */
    if (!(v === slug && isSlug(v)) && !isNewSlug(v)) {
      setSlugError(SLUG_RULE.test(v) && reservedForNew(v) ? reservedSlugError[lang] : c.invalid);
      return;
    }
    /* a store link belongs to one store: a signed-in account asks Dukkan first (the save is refused anyway if taken) */
    const server = onServer() && v !== slug;
    if (server) {
      const r = await merchantCall(`/api/shop/slug?slug=${encodeURIComponent(v)}`, "GET");
      const why = r?.data.result;
      if (why === "taken" || why === "reserved" || why === "invalid") {
        setSlugError(why === "taken" ? c.taken : why === "reserved" ? reservedSlugError[lang] : c.invalid);
        return;
      }
    }
    const s = loadSetup();
    if (s) {
      let before: string | null = null;
      try {
        before = localStorage.getItem(SETUP_KEY);
      } catch {
        before = null;
      }
      saveSetup({ ...s, slug: v });
      /* on Dukkan's server: sent at once, and "updated" only once the server kept it. Not kept (another store took it
         meanwhile, a reserved name, no connection): this browser has the server's setup back (saveNow), the page keeps
         the link it had and says why, so no refused link is left in his saved setup to refuse his later saves (testing S-3) */
      if (server && before !== null) {
        let refusedWhy = "";
        const hear = (e: Event) => (refusedWhy = String((e as CustomEvent<unknown>).detail ?? ""));
        window.addEventListener(SAVE_REFUSED, hear);
        const kept = await saveNow(SETUP_KEY, before).finally(() => window.removeEventListener(SAVE_REFUSED, hear));
        if (!kept) {
          setSlug(loadSetup()?.slug ?? was);
          setSlugError(refusedWhy === "slug-taken" ? c.taken : refusedWhy === "slug-reserved" ? reservedSlugError[lang] : c.failed);
          return;
        }
      }
    }
    setSlug(v);
    setEditing(false);
    setSlugError("");
    setDropped(false);
    flashMsg(c.saved);
    /* an Undo gives the store its link before back, unless the link changed again since or another store took the old one */
    if (!s || !was || was === v) return;
    offerUndo({
      scope: "store-link",
      label: (l) => undoLink[l](v),
      undo: async () => {
        const now = loadSetup();
        if (!now || now.slug !== v) return false;
        if (onServer()) {
          const r = await merchantCall(`/api/shop/slug?slug=${encodeURIComponent(was)}`, "GET");
          if (!r || r.status !== 200 || r.data.result !== "available") return false;
        }
        saveSetup({ ...now, slug: was });
        setSlug(was);
        setDraft(was);
        setEditing(false);
        setSlugError("");
        return true;
      },
    });
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
                  /* a notice left from the last time he edited it would no longer be true */
                  setDropped(false);
                  setEditing(true);
                }}
                className={`rounded-lg border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white ${demoOff}`}
              >
                {c.edit}
              </button>
            )}
          </div>

          {/* a link taken before it became a page of the platform (safe.ts PAGES_ADDED_LATER): kept, but it can't be reached */}
          {ready && slug && !editing && isPlatformPage(slug) && <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">{c.pageNow}</p>}
          {!ready ? (
            /* the link is read from this browser in a moment: its row's shape meanwhile, not a blank card */
            <Skeleton className="mt-5 h-12 w-full rounded-xl" />
          ) : !slug ? (
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
                    setDropped(slugDropped(e.target.value));
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
              {!slugError && dropped && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{slugDroppedText[lang]}</p>}
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={saveSlug} className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{c.save}</button>
                <button type="button" onClick={() => { setEditing(false); setDropped(false); }} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-soft px-5 py-5">
              {/* the address written out; once the store is on Dukkan's server, pressing it opens the store */}
              {live ? (
                <a href={storeUrl(slug)} target="_blank" rel="noopener noreferrer" dir="ltr" className="break-all text-lg font-bold hover:text-primary hover:underline">{url}</a>
              ) : (
                <p dir="ltr" className="break-all text-lg font-bold">{url}</p>
              )}
              <div className="flex items-center gap-4 text-sm font-semibold text-primary">
                <button type="button" onClick={copyUrl} className="hover:underline">{flash === c.copied ? c.copied : c.copy}</button>
                {/* the phone's share sheet, or on a computer a menu: WhatsApp, Facebook, X, Telegram, email, copy, QR code */}
                <ShareMenu url={storeUrl(slug)} title={loadSetup()?.name || c.shareTitle} lang={lang} fileName={`${slug}-qr`} disabled={tour} disabledTitle={demoOffText(lang)} className={`hover:underline ${demoOff}`} />
                {/* the store as his visitors see it, at its address (app/[slug]) */}
                {live && (
                  <a href={storeUrl(slug)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-2 text-white transition hover:opacity-90">
                    {c.open}
                  </a>
                )}
              </div>
            </div>
          )}
          {flash === c.saved && <p role="status" className="mt-3 text-sm font-semibold text-primary">{c.saved}</p>}
        </section>
      </main>
    </div>
  );
}
