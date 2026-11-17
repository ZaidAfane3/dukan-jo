"use client";

import { useCatalog } from "./catalog";
import { usePublicSettings } from "./platformPublic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { PreviewEye, PreviewWindow } from "./ThemePopup";
import { ThemePreview } from "./ThemePreview";
import { priceText } from "./ThemeStore";
import { themeWords } from "./themesContent";
import { applyTheme, copyName, copyTheme, customizeTheme, renameTheme, DEFAULT_THEME_ID, defaultTheme, deleteSavedTheme, findTheme, freeThemes, isFreeTheme, loadThemeState, NAME_MAX, refreshThemeAccess, resetCopy, saveDesignAsTheme, savedThemeInfo, unboughtBase, unboughtIn, type ThemeInfo, type ThemeState } from "./themes";
import { THEME_NOT_BOUGHT } from "./serverSync";
import { input } from "./designer/controls";
import { dropUndos, offerUndo, snapshot, storageUndo } from "./undo";
import type { Lang } from "./content";
import { usePageTitle } from "./pageTitle";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-6";
/* what a change in My themes can write: the themes he has (seen-themes) and the store design (seen-storefront) */
const STORED = ["seen-themes", "seen-storefront"];
/* the undo note at the bottom (UndoToast.tsx) */
const undoWords: Record<Lang, Record<"used" | "deleted" | "reset" | "copied" | "saved" | "renamed", (n: string) => string>> = {
  en: {
    used: (n) => `Theme in use: ${n}`,
    deleted: (n) => `Theme deleted: ${n}`,
    reset: (n) => `Theme reset to its original design: ${n}`,
    copied: (n) => `Copy added: ${n}`,
    saved: (n) => `Design saved as a theme: ${n}`,
    renamed: (n) => `Theme renamed: ${n}`,
  },
  ar: {
    used: (n) => `صار الثيم المستخدم: ${n}`,
    deleted: (n) => `حُذف الثيم: ${n}`,
    reset: (n) => `عاد الثيم إلى تصميمه الأصلي: ${n}`,
    copied: (n) => `أُضيفت نسخة: ${n}`,
    saved: (n) => `حُفظ التصميم كثيم: ${n}`,
    renamed: (n) => `تغيّر اسم الثيم: ${n}`,
  },
};

type Note = "" | "applied" | "failed" | "saved" | "full" | "limit" | "reset" | "copied" | "switched";
type Kind = "default" | "bought" | "copy" | "saved" | "dup";

/* What can be done with each kind of theme:
   - Dukkan's two free designs (the default one and «مؤسسو دكان»): always first, use them or customize them (never deleted);
   - a bought theme: use it, customize it (never deleted);
   - a customized copy of a bought theme: use it, customize it, reset it to the original (never deleted);
   - a design he saved from his own store: use it, customize it, delete it;
   - a copy he made of any of them ("Make a copy"): use it, customize it, delete it (the theme it came from stays).
   Every one of them can be renamed and copied. */
/* A small eye beside a theme's name: it opens the theme in a new tab, as a whole store, to look at */
export function MyThemes() {
  const { lang } = usePrefs();
  const router = useRouter();
  const w = themeWords[lang].mine;
  /* the themes he bought keep their names and looks from the theme store's list (a theme made in Diwan comes from it) */
  useCatalog();
  /* the free designs are the default themes Dukkan's staff pick in Diwan */
  usePublicSettings();
  const [state, setState] = useState<ThemeState | null>(null);
  const [asking, setAsking] = useState<{ id: string; kind: "use" | "reset" | "delete" } | null>(null);
  /* the small filter above the cards: the free designs, the themes he bought (and his copies of them), the designs he saved himself */
  const [show, setShow] = useState<"all" | "default" | "bought" | "mine">("all");
  const [note, setNote] = useState<Note>("");
  const [naming, setNaming] = useState<string | null>(null);
  /* the theme shown in the preview window (the eye, or a click on its picture) */
  const [previewing, setPreviewing] = useState<ThemeInfo | null>(null);
  /* the theme whose name he is changing, and the name typed so far */
  const [renaming, setRenaming] = useState<string | null>(null);
  /* the copy just made: marked for a moment so he sees where it went */
  const [fresh, setFresh] = useState("");

  usePageTitle(`${brandName(lang)} | ${w.title}`);
  useEffect(() => setState(loadThemeState()), []);
  /* which paid themes the store really bought (the server's purchases): a copy of one he has not bought can't go on the store */
  useEffect(() => void refreshThemeAccess(), []);

  /* a free design he "bought" in the theme store is already among the free ones */
  const bought = (state?.owned ?? []).filter((o) => !isFreeTheme(o.id)).map((o) => ({ at: o.at, paid: o.paid, theme: findTheme(o.id) })).filter((x): x is { at: number; paid: number; theme: ThemeInfo } => !!x.theme);
  const saved = (state?.custom ?? []).map((c) => ({ at: c.at, theme: savedThemeInfo(c) }));
  /* Drawn once the browser's state is read: the previews show his own store, which the server cannot know (no hydration mismatch) */
  /* the name he gave a theme, if he renamed it */
  const named = (t: ThemeInfo): ThemeInfo => (state?.names?.[t.id] ? { ...t, name: { en: state.names[t.id], ar: state.names[t.id] } } : t);
  const all: { at: number; paid?: number; theme: ThemeInfo; kind: Kind }[] = !state ? [] : [...freeThemes().map((t) => ({ at: 0, theme: named(t), kind: "default" as const })), ...bought.map((x) => ({ ...x, theme: named(x.theme), kind: "bought" as const })), ...saved.map((x) => ({ ...x, kind: typeof x.theme.copyOf === "string" ? ("dup" as const) : x.theme.from ? ("copy" as const) : ("saved" as const) }))];
  const refresh = () => setState(loadThemeState());
  /* only this page can show its themes again after an undo: its undos go when it closes */
  useEffect(() => () => dropUndos("themes"), []);
  /** Runs a change of My themes with an Undo that puts his themes and the store design back as they were, unless one of
      them changed since (the designer, another tab). `name`: the theme's name in each language, for the note. */
  const undoable = <T,>(run: () => T, kind: keyof (typeof undoWords)["en"], name: (l: Lang) => string): T => {
    const before = snapshot(STORED);
    const out = run();
    const undo = storageUndo(before, snapshot(STORED), () => {
      refresh();
      setAsking(null);
      setRenaming(null);
      setNote("");
    });
    /* an undo that would put a paid theme he has not bought back on the store is refused by the same rule as any change
       (themes.ts unboughtIn): it says "changed", not an error, and the store stays as it is */
    if (undo) offerUndo({ scope: "themes", label: (l) => undoWords[l][kind](name(l)), undo: () => (unboughtIn(before["seen-themes"]) ? false : undo()) });
    return out;
  };
  /* a paid theme he has not bought (or his copy of one) can't go on the store: nothing changes, and the page says so
     with a way to buy it (SaveNotice.tsx) */
  const held = (t: ThemeInfo): boolean => {
    const id = unboughtBase(t.id);
    if (!id) return false;
    setAsking(null);
    setNote("");
    window.dispatchEvent(new CustomEvent(THEME_NOT_BOUGHT, { detail: id }));
    return true;
  };

  const saveName = (id: string, name: string) => {
    setState(undoable(() => renameTheme(id, name), "renamed", () => name.trim() || name));
    setRenaming(null);
  };
  const done = (n: Note) => {
    refresh();
    setAsking(null);
    setNote(n);
  };

  const use = (t: ThemeInfo) => {
    if (held(t)) return;
    done(undoable(() => applyTheme(t, lang), "used", (l) => t.name[l]) ? "applied" : "failed");
  };

  /* "Customize": a bought theme gets its own copy in My themes (once), then the designer opens on it */
  const customize = (t: ThemeInfo, kind: Kind) => {
    if (held(t)) return;
    if (kind === "bought") {
      if (customizeTheme(t, lang) === "ok") router.push("/design");
      else done("full");
      return;
    }
    if (state?.active === t.id || applyTheme(t, lang)) router.push("/design");
    else done("failed");
  };

  const saveCurrent = () => {
    const title = (naming ?? "").trim() || w.defaultName;
    const r = undoable(() => saveDesignAsTheme(title), "saved", () => title);
    setNaming(null);
    done(r === "ok" ? "saved" : r);
  };

  /* "Make a copy": a new theme of his own with the same design, not in use, next to the others; the original stays as it is */
  const makeCopy = (t: ThemeInfo) => {
    setRenaming(null);
    setAsking(null);
    const shown = t.name[lang];
    const copied = copyName(shown, w.copySuffix, all.map((x) => x.theme.name[lang]));
    const r = undoable(() => copyTheme(t, copied, shown, lang), "copied", () => copied);
    if (!r.ok) return done(r.why);
    done("copied");
    /* copies are with his own designs: a filter that hides them shows his designs instead */
    if (show !== "all" && show !== "mine") setShow("mine");
    setFresh(r.id);
    window.setTimeout(() => document.getElementById(`theme-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    window.setTimeout(() => setFresh((f) => (f === r.id ? "" : f)), 4000);
  };

  /* the default design's name as My themes shows it (he may have renamed it): the one the store switches to when the theme in use is deleted */
  const defaultName = named(defaultTheme).name[lang];
  const noteText: Record<Exclude<Note, "">, string> = { applied: w.applied, failed: w.failed, saved: w.saved, full: w.full, limit: w.limit, reset: w.resetDone, copied: w.copied, switched: w.deletedSwitched(defaultName) };
  const good = note === "applied" || note === "saved" || note === "reset" || note === "copied" || note === "switched";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="store" subtabs={[w.title]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold">{w.title}</h1>
            <p className="mt-1 text-sm text-muted">{w.sub}</p>
          </div>
          {naming === null && (
            <button type="button" onClick={() => { setNote(""); setNaming(w.defaultName); }} className="h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.saveCurrent}</button>
          )}
        </div>

        {naming !== null && (
          <section className={card}>
            <p className="text-sm text-muted">{w.saveHint}</p>
            <label className="mt-4 block max-w-sm">
              <span className="mb-2 block text-sm font-semibold">{w.nameLabel}</span>
              <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCurrent()} maxLength={40} className={`${input} h-11`} />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={saveCurrent} className="h-10 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{w.save}</button>
              <button type="button" onClick={() => setNaming(null)} className="h-10 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
            </div>
          </section>
        )}

        {note && (
          <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-3 text-sm font-semibold ${good ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
            <span>{noteText[note]}</span>
            {note === "applied" && <Link href="/design" className="underline">{w.openDesigner}</Link>}
          </div>
        )}

        {/* the themes side by side: three in a row on a big screen, two on a tablet, one on a phone */}
        {(() => {
          const group = (k: Kind) => (k === "default" ? "default" : k === "saved" || k === "dup" ? "mine" : "bought");
          const count = (g: "default" | "bought" | "mine") => all.filter((x) => group(x.kind) === g).length;
          return (
            <div role="tablist" aria-label={w.title} className="flex flex-wrap gap-2">
              {(["all", "default", "bought", "mine"] as const).map((g) => {
                const n = g === "all" ? all.length : count(g);
                return (
                  <button key={g} type="button" role="tab" aria-selected={show === g} onClick={() => setShow(g)} className={`h-9 rounded-full border px-4 text-sm font-semibold transition ${show === g ? "border-ink bg-ink text-onink" : "border-fg/15 hover:bg-soft"}`}>
                    {w.filters[g]} <span className={`ms-1 text-xs ${show === g ? "opacity-80" : "text-muted"}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
        <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {all.filter((x) => show === "all" || (show === "default" ? x.kind === "default" : show === "mine" ? x.kind === "saved" || x.kind === "dup" : x.kind === "bought" || x.kind === "copy")).map(({ at, paid, theme: t, kind }) => {
          /* Dukkan's default design is the one in use until he picks another theme (or when the one he picked is gone) */
          const active = state?.active === t.id || (t.id === DEFAULT_THEME_ID && !all.some((x) => x.theme.id === state?.active));
          const ask = asking?.id === t.id ? asking.kind : null;
          const base = t.from ? findTheme(t.from) : null;
          const editing = renaming === t.id;
          return (
            <section key={t.id} id={`theme-${t.id}`} className={`${card} flex scroll-mt-24 flex-col gap-5 transition-shadow duration-700 ${fresh === t.id ? "!ring-2 !ring-primary shadow-xl" : active ? "ring-2 ring-primary/60" : ""}`}>
              {/* like the theme store: the picture is a store with buttons of its own, so it is not inside a real button (a button
                  inside a button) but a box that acts as one, from the mouse and the keys */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreviewing(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewing(t);
                  }
                }}
                aria-label={`${lang === "ar" ? "معاينة" : "Preview"}: ${t.name[lang]}`}
                className="block w-full cursor-pointer rounded-2xl text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <ThemePreview theme={t} height={260} />
              </div>
              {editing ? (
                <RenameForm
                  name={t.name[lang]}
                  taken={all.filter((x) => x.theme.id !== t.id).map((x) => x.theme.name[lang])}
                  onSave={(v) => saveName(t.id, v)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="min-w-0 break-words text-xl font-extrabold">{t.name[lang]}</h2>
                  <button type="button" onClick={() => { setNote(""); setAsking(null); setRenaming(t.id); }} aria-label={`${w.rename}: ${t.name[lang]}`} title={w.rename} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-fg/15 text-muted transition hover:bg-soft hover:text-fg">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                  <PreviewEye onOpen={() => setPreviewing(t)} />
                  {active && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{w.inUse}</span>}
                  {kind === "copy" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.copyTag}</span>}
                  {kind === "dup" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.dupTag}</span>}
                  {kind === "saved" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.savedTag}</span>}
                  {kind === "default" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{t.id === DEFAULT_THEME_ID ? w.defaultTag : w.freeTag}</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{kind === "dup" ? `${w.dupOf} ${t.copyOf}` : kind === "copy" && base ? `${w.copyOf} ${base.name[lang]}` : t.tagline[lang]}</p>
                <p className="mt-2 text-xs text-muted">
                  {kind === "default" ? w.defaultNote : `${kind === "bought" ? w.boughtOn : w.savedOn}: ${new Date(at).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" })}`}
                  {/* what he paid, written as the theme store and Diwan write it (up to 3 decimals: JOD has fils) */}
                  {kind === "bought" && typeof paid === "number" && Number.isFinite(paid) && <> · <span dir="ltr">{priceText(paid, lang, themeWords[lang].store.free)}</span></>}
                </p>

                {ask ? (
                  <div className={`mt-5 rounded-xl p-4 ${ask === "use" ? "bg-amber-500/12" : "bg-rose-500/10"}`}>
                    <p className="text-sm">{ask === "use" ? w.applyAsk : ask === "reset" ? w.resetAsk : active ? w.deleteActiveAsk(defaultName) : kind === "dup" ? w.deleteCopyAsk : w.deleteAsk}</p>
                    {ask === "use" && (
                      <>
                        <p className="mt-2 text-sm font-semibold">{w.applyKeepsTitle}</p>
                        <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
                          {w.applyKeeps.map((k) => <li key={k}>{k}</li>)}
                        </ul>
                      </>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (ask === "use") use(t);
                          else if (ask === "reset") done(undoable(() => resetCopy(t.id, lang), "reset", (l) => t.name[l]) === "ok" ? "reset" : "failed");
                          /* the one in use: the store switches to Dukkan's default design for real (themes.ts deleteSavedTheme) */
                          else if (undoable(() => deleteSavedTheme(t.id, lang), "deleted", (l) => t.name[l]) !== "ok") done("failed");
                          else done(active ? "switched" : "");
                        }}
                        className={`h-10 rounded-xl px-5 text-sm font-semibold text-white transition ${ask === "use" ? "bg-ink hover:bg-deep" : "bg-rose-600 hover:bg-rose-700"}`}
                      >
                        {ask === "use" ? w.applyYes : ask === "reset" ? w.resetYes : w.deleteYes}
                      </button>
                      <button type="button" onClick={() => setAsking(null)} className="h-10 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-3 pt-5">
                    {!active && (
                      <button type="button" onClick={() => { setNote(""); setAsking({ id: t.id, kind: "use" }); }} className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{w.use}</button>
                    )}
                    <button type="button" onClick={() => customize(t, kind)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{w.customize}</button>
                    {/* Every theme can be copied. The customized copy of a bought theme is never deleted, it can be reset. A design he
                        saved himself, and a copy he made, can be deleted. A bought or free theme has neither. */}
                    <div className="flex w-full flex-wrap gap-2">
                      <button type="button" onClick={() => makeCopy(t)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
                        {w.makeCopy}
                      </button>
                      {kind === "copy" && (
                        <button type="button" onClick={() => { setNote(""); setAsking({ id: t.id, kind: "reset" }); }} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg">{w.reset}</button>
                      )}
                      {(kind === "saved" || kind === "dup") && (
                        <button type="button" onClick={() => { setNote(""); setAsking({ id: t.id, kind: "delete" }); }} className="h-9 rounded-lg px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400">{w.delete}</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
            </section>
          );
        })}
        </div>

        {/* Only the free designs so far: they are his, so the page does not say "no themes", it points to more */}
        {state && all.length === freeThemes().length && (
          <section className={`${card} flex flex-wrap items-center justify-between gap-4 px-6 py-5`}>
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-soft text-primary">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.6-.4-1 .2-2 1.3-2H17a4 4 0 0 0 4-4c0-5-4-10.4-9-10.4Z" />
                  <circle cx="7.5" cy="11" r="1" />
                  <circle cx="10.5" cy="7" r="1" />
                  <circle cx="15.5" cy="7.5" r="1" />
                </svg>
              </span>
              <div>
                <h2 className="font-extrabold">{w.emptyTitle}</h2>
                <p className="mt-0.5 text-sm text-muted">{w.emptyBody}</p>
              </div>
            </div>
            <Link href="/themes" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold leading-[2.75rem] text-onink transition hover:bg-deep">{w.visit}</Link>
          </section>
        )}
      </main>
      {previewing && <PreviewWindow theme={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

/* Renaming a theme: a big field across the whole card, with the badges and the card's buttons out of the way. Enter saves, Esc
   cancels; the name is chosen whole so typing replaces it. An empty name, or one another theme in My themes already has, is
   not saved: a short note under the field says why. */
function RenameForm({ name, taken, onSave, onCancel }: { name: string; taken: string[]; onSave: (v: string) => void; onCancel: () => void }) {
  const { lang } = usePrefs();
  const w = themeWords[lang].mine;
  const [value, setValue] = useState(name);
  const [err, setErr] = useState<"" | "empty" | "taken">("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const submit = () => {
    const v = value.trim();
    if (!v) return setErr("empty");
    if (v === name.trim()) return onCancel();
    if (taken.some((x) => x.trim().toLowerCase() === v.toLowerCase())) return setErr("taken");
    onSave(v);
  };
  const id = useRef(`rename-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-1 flex-col"
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold">{w.renameTitle}</label>
        <span dir="ltr" aria-live="polite" className={`text-xs tabular-nums ${value.length >= NAME_MAX ? "font-bold text-amber-700 dark:text-amber-400" : "text-muted"}`}>
          {value.length}/{NAME_MAX}
        </span>
      </div>
      <input
        ref={ref}
        id={id}
        dir="auto"
        value={value}
        maxLength={NAME_MAX}
        onChange={(e) => {
          setValue(e.target.value);
          if (err) setErr("");
        }}
        onKeyDown={(e) => {
          /* Enter saves (not while an Arabic or other keyboard is still composing a word) */
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        aria-invalid={!!err}
        aria-describedby={`${id}-help`}
        autoComplete="off"
        className={`${input} mt-2 h-14 !text-lg font-bold ${err ? "!border-rose-500 focus:!ring-rose-500/25" : ""}`}
      />
      <p id={`${id}-help`} role={err ? "alert" : undefined} className={`mt-2 min-h-[1.25rem] text-sm ${err ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted"}`}>
        {err === "empty" ? w.nameEmpty : err === "taken" ? w.nameTaken : <span className="hidden sm:inline">{w.renameKeys}</span>}
      </p>
      <div className="mt-auto flex flex-wrap gap-3 pt-4">
        <button type="submit" className="h-11 flex-1 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep sm:flex-none">{w.save}</button>
        <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft sm:flex-none">{w.cancel}</button>
      </div>
    </form>
  );
}
