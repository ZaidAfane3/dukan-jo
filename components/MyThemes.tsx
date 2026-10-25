"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { ThemePreview } from "./ThemePreview";
import { themeWords } from "./themesContent";
import { applyTheme, customizeTheme, deleteSavedTheme, findTheme, loadThemeState, resetCopy, saveDesignAsTheme, savedThemeInfo, type ThemeInfo, type ThemeState } from "./themes";
import { input } from "./designer/controls";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-6";

type Note = "" | "applied" | "failed" | "saved" | "full" | "limit" | "reset";

/* What can be done with each kind of theme:
   - a bought theme: use it, customize it (never deleted);
   - a customized copy of a bought theme: use it, customize it, reset it to the original (never deleted);
   - a design he saved from his own store: use it, customize it, delete it. */
export function MyThemes() {
  const { lang } = usePrefs();
  const router = useRouter();
  const w = themeWords[lang].mine;
  const [state, setState] = useState<ThemeState | null>(null);
  const [asking, setAsking] = useState<{ id: string; kind: "use" | "reset" | "delete" } | null>(null);
  const [note, setNote] = useState<Note>("");
  const [naming, setNaming] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${w.title}`;
  }, [lang, w]);
  useEffect(() => setState(loadThemeState()), []);

  const bought = (state?.owned ?? []).map((o) => ({ at: o.at, theme: findTheme(o.id) })).filter((x): x is { at: number; theme: ThemeInfo } => !!x.theme);
  const saved = (state?.custom ?? []).map((c) => ({ at: c.at, theme: savedThemeInfo(c) }));
  const all = [...bought.map((x) => ({ ...x, kind: "bought" as const })), ...saved.map((x) => ({ ...x, kind: x.theme.from ? ("copy" as const) : ("saved" as const) }))];

  const refresh = () => setState(loadThemeState());
  const done = (n: Note) => {
    refresh();
    setAsking(null);
    setNote(n);
  };

  const use = (t: ThemeInfo) => done(applyTheme(t, lang) ? "applied" : "failed");

  /* "Customize": a bought theme gets its own copy in My themes (once), then the designer opens on it */
  const customize = (t: ThemeInfo, kind: "bought" | "copy" | "saved") => {
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

        {state && all.length === 0 && (
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

        {all.map(({ at, theme: t, kind }) => {
          const active = state?.active === t.id;
          const ask = asking?.id === t.id ? asking.kind : null;
          const base = t.from ? findTheme(t.from) : null;
          return (
            <section key={t.id} className={`${card} grid items-start gap-6 md:grid-cols-[320px_1fr]`}>
              <ThemePreview theme={t} height={300} />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-extrabold">{t.name[lang]}</h2>
                  {active && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{w.inUse}</span>}
                  {kind === "copy" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.copyTag}</span>}
                  {kind === "saved" && <span className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{w.savedTag}</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{kind === "copy" && base ? `${w.copyOf} ${base.name[lang]}` : t.tagline[lang]}</p>
                <p className="mt-2 text-xs text-muted">
                  {kind === "bought" ? w.boughtOn : w.savedOn}: {new Date(at).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" })}
                </p>

                {ask ? (
                  <div className={`mt-5 rounded-xl p-4 ${ask === "use" ? "bg-amber-500/12" : "bg-rose-500/10"}`}>
                    <p className="text-sm">{ask === "use" ? w.applyAsk : ask === "reset" ? w.resetAsk : w.deleteAsk}</p>
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
                  <div className="mt-5 flex flex-wrap gap-3">
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
      </main>
    </div>
  );
}
