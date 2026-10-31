"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { PreviewEye, PreviewWindow } from "./ThemePopup";
import { ThemePreview } from "./ThemePreview";
import { themeWords } from "./themesContent";
import { applyTheme, customizeTheme, renameTheme, DEFAULT_THEME_ID, deleteSavedTheme, findTheme, freeThemes, isFreeTheme, loadThemeState, resetCopy, saveDesignAsTheme, savedThemeInfo, type ThemeInfo, type ThemeState } from "./themes";
import { input } from "./designer/controls";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-6";

type Note = "" | "applied" | "failed" | "saved" | "full" | "limit" | "reset";

/* What can be done with each kind of theme:
   - Dukkan's two free designs (the default one and «مؤسسو دكان»): always first, use them or customize them (never deleted);
   - a bought theme: use it, customize it (never deleted);
   - a customized copy of a bought theme: use it, customize it, reset it to the original (never deleted);
   - a design he saved from his own store: use it, customize it, delete it. */
/* A small eye beside a theme's name: it opens the theme in a new tab, as a whole store, to look at */
export function MyThemes() {
  const { lang } = usePrefs();
  const router = useRouter();
  const w = themeWords[lang].mine;
  const [state, setState] = useState<ThemeState | null>(null);
  const [asking, setAsking] = useState<{ id: string; kind: "use" | "reset" | "delete" } | null>(null);
  /* the small filter above the cards: the free designs, the themes he bought (and his copies of them), the designs he saved himself */
  const [show, setShow] = useState<"all" | "default" | "bought" | "mine">("all");
  const [note, setNote] = useState<Note>("");
  const [naming, setNaming] = useState<string | null>(null);
  /* the theme shown in the preview window (the eye, or a click on its picture) */
  const [previewing, setPreviewing] = useState<ThemeInfo | null>(null);
  /* the theme whose name he is changing, and the name typed so far */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${w.title}`;
  }, [lang, w]);
  useEffect(() => setState(loadThemeState()), []);

  /* a free design he "bought" in the theme store is already among the free ones */
  const bought = (state?.owned ?? []).filter((o) => !isFreeTheme(o.id)).map((o) => ({ at: o.at, theme: findTheme(o.id) })).filter((x): x is { at: number; theme: ThemeInfo } => !!x.theme);
  const saved = (state?.custom ?? []).map((c) => ({ at: c.at, theme: savedThemeInfo(c) }));
  /* Drawn once the browser's state is read: the previews show his own store, which the server cannot know (no hydration mismatch) */
  /* the name he gave a theme, if he renamed it */
  const named = (t: ThemeInfo): ThemeInfo => (state?.names?.[t.id] ? { ...t, name: { en: state.names[t.id], ar: state.names[t.id] } } : t);
  const all = !state ? [] : [...freeThemes.map((t) => ({ at: 0, theme: named(t), kind: "default" as const })), ...bought.map((x) => ({ ...x, theme: named(x.theme), kind: "bought" as const })), ...saved.map((x) => ({ ...x, kind: x.theme.from ? ("copy" as const) : ("saved" as const) }))];
  const saveName = () => {
    if (renaming) setState(renameTheme(renaming.id, renaming.name));
    setRenaming(null);
  };

  const refresh = () => setState(loadThemeState());
  const done = (n: Note) => {
    refresh();
    setAsking(null);
    setNote(n);
  };

  const use = (t: ThemeInfo) => done(applyTheme(t, lang) ? "applied" : "failed");

  /* "Customize": a bought theme gets its own copy in My themes (once), then the designer opens on it */
  const customize = (t: ThemeInfo, kind: "default" | "bought" | "copy" | "saved") => {
    if (kind === "bought") {
      if (customizeTheme(t, lang) === "ok") router.push("/design");
      else done("full");
      return;
    }
    if (state?.active === t.id || applyTheme(t, lang)) router.push("/design");
    else done("failed");
  };

  const saveCurrent = () => {
    const r = saveDesignAsTheme((naming ?? "").trim() || w.defaultName);
    setNaming(null);
    done(r === "ok" ? "saved" : r);
  };

  const noteText: Record<Exclude<Note, "">, string> = { applied: w.applied, failed: w.failed, saved: w.saved, full: w.full, limit: w.limit, reset: w.resetDone };
  const good = note === "applied" || note === "saved" || note === "reset";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="domain" subtabs={[w.title]} activeSub={0} />

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

        {state && all.length === freeThemes.length && (
          <section className={`${card} grid place-items-center py-16 text-center`}>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-soft text-primary">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.6-.4-1 .2-2 1.3-2H17a4 4 0 0 0 4-4c0-5-4-10.4-9-10.4Z" />
                <circle cx="7.5" cy="11" r="1" />
                <circle cx="10.5" cy="7" r="1" />
                <circle cx="15.5" cy="7.5" r="1" />
              </svg>
            </span>
            <h2 className="mt-5 text-lg font-extrabold">{w.emptyTitle}</h2>
            <p className="mt-1 text-sm text-muted">{w.emptyBody}</p>
            <Link href="/themes" className="mt-6 h-11 rounded-xl bg-ink px-8 text-sm font-semibold leading-[2.75rem] text-onink transition hover:bg-deep">{w.visit}</Link>
          </section>
        )}

        {/* the themes side by side: three in a row on a big screen, two on a tablet, one on a phone */}
        {(() => {
          const group = (k: (typeof all)[number]["kind"]) => (k === "default" ? "default" : k === "saved" ? "mine" : "bought");
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
        {all.filter((x) => show === "all" || (show === "default" ? x.kind === "default" : show === "mine" ? x.kind === "saved" : x.kind === "bought" || x.kind === "copy")).map(({ at, theme: t, kind }) => {
          /* Dukkan's default design is the one in use until he picks another theme (or when the one he picked is gone) */
          const active = state?.active === t.id || (t.id === DEFAULT_THEME_ID && !all.some((x) => x.theme.id === state?.active));
          const ask = asking?.id === t.id ? asking.kind : null;
          const base = t.from ? findTheme(t.from) : null;
          return (
            <section key={t.id} className={`${card} flex flex-col gap-5 ${active ? "ring-2 ring-primary/60" : ""}`}>
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
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  {renaming?.id === t.id ? (
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: t.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onBlur={saveName}
                      maxLength={40}
                      aria-label={lang === "ar" ? "اسم الثيم" : "Theme name"}
                      className={`${input} h-10 min-w-0 flex-1 text-lg font-extrabold`}
                    />
                  ) : (
                    <>
                      <h2 className="text-xl font-extrabold">{t.name[lang]}</h2>
                      <button type="button" onClick={() => setRenaming({ id: t.id, name: t.name[lang] })} aria-label={lang === "ar" ? "إعادة التسمية" : "Rename"} title={lang === "ar" ? "إعادة التسمية" : "Rename"} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-fg/15 text-muted transition hover:bg-soft hover:text-fg">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </button>
                    </>
                  )}
                  <PreviewEye onOpen={() => setPreviewing(t)} />
                  {active && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{w.inUse}</span>}
                  {kind === "copy" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.copyTag}</span>}
                  {kind === "saved" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.savedTag}</span>}
                  {kind === "default" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{t.id === DEFAULT_THEME_ID ? w.defaultTag : w.freeTag}</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{kind === "copy" && base ? `${w.copyOf} ${base.name[lang]}` : t.tagline[lang]}</p>
                <p className="mt-2 text-xs text-muted">
                  {kind === "default" ? w.defaultNote : `${kind === "bought" ? w.boughtOn : w.savedOn}: ${new Date(at).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" })}`}
                </p>

                {ask ? (
                  <div className={`mt-5 rounded-xl p-4 ${ask === "use" ? "bg-amber-500/12" : "bg-rose-500/10"}`}>
                    <p className="text-sm">{ask === "use" ? w.applyAsk : ask === "reset" ? w.resetAsk : w.deleteAsk}</p>
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
                          else if (ask === "reset") done(resetCopy(t.id, lang) === "ok" ? "reset" : "failed");
                          else {
                            deleteSavedTheme(t.id);
                            done("");
                          }
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
                    {/* A copy of a bought theme is never deleted, it can be reset. A design he saved himself can be deleted. A bought theme has neither. */}
                    {kind === "copy" && (
                      <button type="button" onClick={() => { setNote(""); setAsking({ id: t.id, kind: "reset" }); }} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{w.reset}</button>
                    )}
                    {kind === "saved" && (
                      <button type="button" onClick={() => { setNote(""); setAsking({ id: t.id, kind: "delete" }); }} className="h-11 rounded-xl border border-rose-500/50 px-6 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{w.delete}</button>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
        </div>
      </main>
      {previewing && <PreviewWindow theme={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}
