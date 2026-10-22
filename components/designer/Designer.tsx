"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brandName } from "../content";
import { LangSwitch, usePrefs } from "../Prefs";
import { accountName, accountPhone, loadSetup, saveSetup, type SavedSetup } from "../setup";
import { StorefrontTheme } from "../storefront/StorefrontTheme";
import { DesignerSkeleton } from "../StoreSkeletons";
import { clearTemplate, loadConfig, loadTemplate, saveConfig, saveTemplate } from "../storefront/storage";
import { defaultConfig } from "../storefront/config";
import { Canvas } from "./Canvas";
import { HEX } from "./controls";
import { dc } from "./copy";
import { IdentityPanel, OptionsPanel, PagesPanel, TextsPanel, type Draft, type Focus } from "./panels";

const ico = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const railIcons = {
  collapse: <svg {...ico}><path d="M4 7h16M4 12h10M4 17h16" /></svg>,
  pages: <svg {...ico}><rect x="4" y="3" width="16" height="18" rx="2.500" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  identity: <svg {...ico}><path d="M4 9 5.500 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></svg>,
  texts: <svg {...ico}><path d="M5 6h14M12 6v13M9 19h6" /></svg>,
  options: <svg {...ico}><path d="M12 3a9 9 0 1 0 0 18c1.100 0 1.500-.8 1.200-1.600-.4-1 .2-2 1.300-2H17a4 4 0 0 0 4-4c0-5-4-10.400-9-10.400Z" /><circle cx="7.500" cy="11" r="1" /><circle cx="10.500" cy="7" r="1" /><circle cx="15.500" cy="7.500" r="1" /></svg>,
  more: <svg {...ico}><circle cx="5" cy="12" r="1.200" /><circle cx="12" cy="12" r="1.200" /><circle cx="19" cy="12" r="1.200" /></svg>,
  eye: <svg {...ico}><path d="M2 12s3.500-6 10-6 10 6 10 6-3.500 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.500" /></svg>,
  exit: <svg {...ico}><path d="M12 3v8M6.300 6.800a8 8 0 1 0 11.400 0" /></svg>,
  chevron: <svg {...ico} className="h-4 w-4"><path d="m6 9 6 6 6-6" /></svg>,
};

type Tab = "pages" | "identity" | "options" | "texts";
const TASKS = 6; /* the store design task is the last one of the setup list */

function initial(): Draft {
  const s = loadSetup();
  return {
    config: loadConfig(),
    identity: { name: s?.name || accountName(), description: s?.description ?? "", color: s?.color ?? "#004956", phone: s?.phone || accountPhone() },
  };
}

export function Designer() {
  const { lang } = usePrefs();
  const t = dc[lang];
  const router = useRouter();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<Tab>("pages");
  const [panelOpen, setPanelOpen] = useState(true);
  const [editing, setEditingRaw] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [pagesMenu, setPagesMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sample, setSample] = useState(false);
  /* /design?template=1: the admin edits the starter template that new stores begin with */
  const [templateMode, setTemplateMode] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [attn, setAttn] = useState<{ id: "name" | "color" | "background" | "text"; tab: Tab; n: number } | null>(null);
  const [flash, setFlash] = useState<"saved" | "errors" | "full" | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${t.title}`;
  }, [lang, t]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const template = q.get("template") === "1";
    const d = initial();
    if (template) d.config = loadTemplate() ?? defaultConfig;
    setTemplateMode(template);
    /* Without his own products the template would look empty, so it is shown with sample products */
    setSample(template || q.get("sample") === "1");
    setDraft(d);
    setSaved(JSON.stringify(d));
  }, []);

  const dirty = draft !== null && JSON.stringify(draft) !== saved;

  /* Closing the tab or reloading with unsaved changes asks first. */
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  /* Menus close on an outside click or Escape. */
  useEffect(() => {
    if (!pagesMenu && !moreMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!bar.current?.contains(e.target as Node)) {
        setPagesMenu(false);
        setMoreMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPagesMenu(false);
        setMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pagesMenu, moreMenu]);

  /* The panel and the preview share one idea of "what is being edited". */
  const setEditing = (id: string | null) => {
    setEditingRaw(id);
    setSelected(id);
  };

  /* Clicking a part of the store in the preview opens its settings in the panel. */
  const select = (id: string, field?: string) => {
    setPanelOpen(true);
    setSelected(id);
    if (id === "identity") {
      setTab("identity");
      return;
    }
    if (id === "cards") {
      setTab("options");
      return;
    }
    setTab("pages");
    setFocus({ id, field, n: Date.now() });
    setEditingRaw(id === "header" || id === "footer" || id === "announcement" ? null : id);
  };

  if (!draft) return <DesignerSkeleton />;

  const valid = (d: Draft) => d.identity.name.trim().length >= 2 && HEX.test(d.identity.color) && HEX.test(d.config.theme.background) && HEX.test(d.config.theme.text);

  /* The first thing that stops a save, and where it lives */
  const firstProblem = (d: Draft): { id: "name" | "color" | "background" | "text"; tab: Tab } | null => {
    if (!templateMode && d.identity.name.trim().length < 2) return { id: "name", tab: "identity" };
    if (!templateMode && !HEX.test(d.identity.color)) return { id: "color", tab: "identity" };
    if (!HEX.test(d.config.theme.background)) return { id: "background", tab: "options" };
    if (!HEX.test(d.config.theme.text)) return { id: "text", tab: "options" };
    return null;
  };

  /* Take him to the field: open its panel, scroll to it, put the cursor in it, and make it shake and glow. */
  const showProblem = (p: { id: "name" | "color" | "background" | "text"; tab: Tab }) => {
    setTab(p.tab);
    setPanelOpen(true);
    setEditingRaw(null);
    setAttn({ ...p, n: Date.now() });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-attn="${p.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
    }, 120);
    setTimeout(() => setAttn((a) => (a && a.id === p.id ? null : a)), 6000);
  };

  const save = (): boolean => {
    const problem = firstProblem(draft);
    if (problem) {
      setShowErrors(true);
      setFlash("errors");
      showProblem(problem);
      setTimeout(() => setFlash(null), 6000);
      return false;
    }
    if (!(templateMode ? saveTemplate(draft.config) : saveConfig(draft.config))) {
      setFlash("full");
      setTimeout(() => setFlash(null), 4000);
      return false;
    }
    if (templateMode) {
      /* The template belongs to the platform, not to any store, so the store's own data stays as it is */
      setSaved(JSON.stringify(draft));
      setFlash("saved");
      setTimeout(() => setFlash(null), 2000);
      return true;
    }
    const prev = loadSetup();
    const next: SavedSetup = {
      name: draft.identity.name.trim(),
      description: draft.identity.description.trim(),
      color: draft.identity.color,
      phone: draft.identity.phone.trim(),
      slug: prev?.slug ?? "",
      done: prev && prev.done.length === TASKS ? prev.done.map((v, i) => (i === TASKS - 1 ? true : v)) : Array.from({ length: TASKS }, (_, i) => i === TASKS - 1),
      pickup: prev?.pickup,
      logo: prev?.logo,
      product: prev?.product ?? null,
      shipping: prev?.shipping ?? null,
    };
    saveSetup(next);
    setSaved(JSON.stringify(draft));
    setFlash("saved");
    setTimeout(() => setFlash(null), 2000);
    return true;
  };

  const leave = () => router.push("/dashboard");
  const tryExit = () => (dirty ? setExiting(true) : leave());

  const colorOk = HEX.test(draft.identity.color) ? draft.identity.color : undefined;
  const railBtn = (key: Tab, label: string, ic: React.ReactNode) => (
    <button
      type="button"
      onClick={() => {
        setTab(key);
        setPanelOpen(true);
        setEditing(null);
        setSelected(null);
      }}
      aria-label={label}
      title={label}
      aria-pressed={tab === key && panelOpen}
      className={`relative grid h-9 w-9 place-items-center rounded-xl transition ${tab === key && panelOpen ? "bg-primary/15 text-primary" : "text-muted hover:bg-fg/10 hover:text-fg"}`}
    >
      {ic}
      {attn && attn.tab === key && <span aria-hidden className="absolute end-1.5 top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-card" />}
    </button>
  );

  const pill = "rounded-xl border border-fg/15 px-3 py-2 text-sm font-semibold transition hover:bg-soft";

  return (
    <div className="dash flex h-screen flex-col bg-page">
      {/* Top bar */}
      <div ref={bar} className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-fg/10 bg-card px-4">
        <span className="hidden text-sm font-extrabold sm:block">{t.themeName}</span>
        {templateMode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.templateBadge}
          </span>
        ) : (
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 sm:inline-flex">
          {t.published}
        </span>
        )}

        <div className="relative">
          <button type="button" onClick={() => { setPagesMenu((o) => !o); setMoreMenu(false); }} aria-expanded={pagesMenu} className={`${pill} flex items-center gap-2`}>
            {t.pages[0]}
            <span className={`transition-transform ${pagesMenu ? "rotate-180" : ""}`}>{railIcons.chevron}</span>
          </button>
          {pagesMenu && (
            <ul className="absolute start-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10">
              {t.pages.map((p, i) => (
                <li key={p}>
                  <button
                    type="button"
                    disabled={i !== 0}
                    onClick={() => setPagesMenu(false)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition ${i === 0 ? "bg-primary/15 font-bold text-primary" : "text-muted/70"}`}
                  >
                    {p}
                    {i !== 0 && <span className="text-[10px] font-semibold">{t.soon}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1" />

        <span aria-live="polite" className="hidden text-xs font-semibold md:block">
          {flash === "saved" ? <span className="text-primary">{t.saving}</span> : flash === "errors" && attn ? (
            <button type="button" onClick={() => showProblem(attn)} className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-400">
              <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
              {t.problems[attn.id]}
              <span className="font-bold underline">{t.problemGo}</span>
            </button>
          ) : flash === "errors" ? <span className="text-rose-600">{t.errorsSave}</span> : flash === "full" ? <span className="text-rose-600">{t.errorsStorage}</span> : dirty ? <span className="text-amber-600">{t.unsaved}</span> : null}
        </span>
        {templateMode && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(t.restoreMainAsk)) return;
              setDraft((d) => d && { ...d, config: defaultConfig });
              clearTemplate();
              setEditing(null);
            }}
            className="h-9 rounded-xl border border-amber-500/50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-500/15 dark:text-amber-300"
          >
            {t.restoreMain}
          </button>
        )}
        <button type="button" onClick={save} disabled={!dirty} className="h-9 rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40">
          {t.save}
        </button>

        <LangSwitch iconOnly />

        <div className="relative">
          <button type="button" onClick={() => { setMoreMenu((o) => !o); setPagesMenu(false); setConfirmReset(false); }} aria-label={t.more} aria-expanded={moreMenu} className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15 transition hover:bg-soft">
            {railIcons.more}
          </button>
          {moreMenu && (
            <div className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10">
              <a href="/store" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.preview}</a>
              <a href="/store?original=1" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.starter}</a>
              {templateMode && (
                <a href="/store?starter=1" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.templatePreview}</a>
              )}
              <a href="/store?demo=1" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.demo}</a>
              <button type="button" role="menuitemcheckbox" aria-checked={sample} onClick={() => setSample((v) => !v)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft">
                <span>
                  {t.sample}
                  <span className="mt-0.5 block text-xs font-normal text-muted">{t.sampleHint}</span>
                </span>
                <span aria-hidden dir="ltr" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${sample ? "bg-primary" : "bg-fg/20"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sample ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
              {confirmReset ? (
                <div className="rounded-xl bg-rose-500/10 p-3">
                  <p className="text-xs text-rose-700 dark:text-rose-400">{t.resetAsk}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setDraft((d) => d && { ...d, config: templateMode ? defaultConfig : loadTemplate() ?? defaultConfig }); if (templateMode) clearTemplate(); setEditing(null); setConfirmReset(false); setMoreMenu(false); }} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white">{t.resetYes}</button>
                    <button type="button" onClick={() => setConfirmReset(false)} className="rounded-md border border-fg/20 px-3 py-1 text-xs font-semibold">{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmReset(true)} className="block w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft">{t.reset}</button>
              )}
              <Link href="/dashboard" onClick={(e) => { if (dirty) { e.preventDefault(); setExiting(true); setMoreMenu(false); } }} className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.dashboard}</Link>
            </div>
          )}
        </div>

        <a href="/preview" target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-lg border border-fg/15 px-3 text-sm font-semibold transition hover:bg-soft">
          {railIcons.eye}
          {t.previewBtn}
        </a>

        <button type="button" onClick={tryExit} aria-label={t.exit} title={t.exit} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-500/10">
          {railIcons.exit}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Icon rail */}
        <nav aria-label={t.title} className="flex shrink-0 items-center gap-2 border-b border-fg/10 bg-card p-2 lg:w-12 lg:flex-col lg:border-b-0 lg:border-e lg:py-3">
          <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? t.rail.collapse : t.rail.expand} title={panelOpen ? t.rail.collapse : t.rail.expand} className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-fg/10 hover:text-fg">
            {railIcons.collapse}
          </button>
          {railBtn("pages", t.rail.pages, railIcons.pages)}
          {!templateMode && railBtn("identity", t.rail.identity, railIcons.identity)}
          {railBtn("options", t.rail.options, railIcons.options)}
          {railBtn("texts", t.rail.texts, railIcons.texts)}
        </nav>

        {/* Panel */}
        {panelOpen && (
          <aside className="flex max-h-[45vh] shrink-0 flex-col border-b border-fg/10 bg-card lg:max-h-none lg:w-[20rem] lg:border-b-0 lg:border-e">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "pages" && <PagesPanel lang={lang} draft={draft} update={(fn) => setDraft((d) => d && fn(d))} editing={editing} setEditing={setEditing} focus={focus} />}
              {tab === "identity" && <IdentityPanel lang={lang} draft={draft} update={(fn) => setDraft((d) => d && fn(d))} showErrors={showErrors} attn={attn?.id} />}
              {tab === "texts" && <TextsPanel lang={lang} draft={draft} update={(fn) => setDraft((d) => d && fn(d))} />}
              {tab === "options" && <OptionsPanel lang={lang} draft={draft} update={(fn) => setDraft((d) => d && fn(d))} attn={attn?.id} />}
            </div>
            <div className="shrink-0 border-t border-fg/10 p-3">
              <p className="mb-2 text-xs text-muted">{templateMode ? t.templateNote : t.note}</p>
              <button type="button" onClick={save} disabled={!dirty} className="h-10 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40">
                {t.save}
              </button>
            </div>
          </aside>
        )}

        {/* Preview: the store can be made smaller to see it all, and moved around */}
        <Canvas lang={lang}>
          <StorefrontTheme
            config={draft.config}
            device="auto"
            interactive={false}
            sample={sample}
            owner
            design={{ selected, select }}
            store={{ name: draft.identity.name, description: draft.identity.description, color: colorOk, phone: draft.identity.phone }}
          />
        </Canvas>
      </div>

      {exiting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-label={t.modal.title} className="dash w-full max-w-md rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{t.modal.title}</h2>
            <p className="mt-2 text-sm text-muted">{t.modal.body}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={() => { if (save()) leave(); else setExiting(false); }} className="h-11 flex-1 rounded-xl bg-ink px-4 text-sm font-semibold text-onink transition hover:bg-deep">{t.modal.saveExit}</button>
              <button type="button" onClick={() => { setSaved(JSON.stringify(draft)); leave(); }} className="h-11 flex-1 rounded-xl border border-rose-500/50 px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{t.modal.leave}</button>
              <button type="button" onClick={() => setExiting(false)} className="h-11 flex-1 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">{t.modal.stay}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
