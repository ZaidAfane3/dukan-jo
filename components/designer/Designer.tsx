"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "../content";
import { demoActive } from "../demoSandbox";
import { findTheme, previewProducts, saveDesignAsTheme, type ThemeInfo } from "../themes";
import { NewPageDialog, OpenPage, useStorePages } from "./PageLink";
import { PageEditor } from "./PageEditor";
import { load as loadPages, savePages } from "../InfoPages";
import { freshMine, loadMine, resetMine, saveMine } from "./mineTemplate";
import { LangSwitch, usePrefs } from "../Prefs";
import { accountName, accountPhone, loadSetup, saveSetup, type SavedSetup } from "../setup";
import { StorefrontTheme } from "../storefront/StorefrontTheme";
import { DesignerSkeleton } from "../StoreSkeletons";
import { clearTemplate, loadConfig, loadTemplate, saveConfig, saveTemplate } from "../storefront/storage";
import { defaultConfig } from "../storefront/config";
import { Canvas } from "./Canvas";
import { HEX, input } from "./controls";
import { dc } from "./copy";
import { IdentityPanel, OptionsPanel, TextColorNow, PagesPanel, ProductPicturePanel, TextsPanel, type Draft, type Focus } from "./panels";
import { saveProductFocus, type StoreProduct } from "../storefront/useStoreData";

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

/* `mine` is Saad's private copy of the demo template at /saad (temporary, see mineTemplate.ts): fully editable, saved under its own key. */
export function Designer({ mine: mineProp = false }: { mine?: boolean | string } = {}) {
  /* /saad shows the demo template; /saad/<theme> shows a ready theme of the theme store (kept under its own key) */
  const themeId = typeof mineProp === "string" && findTheme(mineProp) ? mineProp : undefined;
  const mine = !!mineProp;
  const { lang } = usePrefs();
  const t = dc[lang];
  const router = useRouter();

  const [draft, setDraft] = useState<Draft | null>(null);
  /* Ctrl+Z takes back the last edit, Ctrl+Shift+Z (or Ctrl+Y) puts it back. A burst of changes (typing, dragging a slider) is one step. */
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const hist = useRef<{ past: Draft[]; future: Draft[]; at: number }>({ past: [], future: [], at: 0 });
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<Tab>("pages");
  const [panelOpen, setPanelOpen] = useState(true);
  const [editing, setEditingRaw] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [pagesMenu, setPagesMenu] = useState(false);
  /* The dialog that makes a page of the store */
  const [makingPage, setMakingPage] = useState(false);
  /* The page of the store open in the preview and in the side panel (null: the home page) */
  const [openedPage, setOpenedPage] = useState<number | null>(null);
  const [pagesVersion, setPagesVersion] = useState(0);
  /* The product page is open in the preview (the page of the first product) */
  const [productView, setProductView] = useState(false);
  /* The page asked about in the trash question of the page menu */
  const [delAsk, setDelAsk] = useState<number | null>(null);
  const storePages = useStorePages(lang, pagesVersion);
  /* The page open in the designer, with its elements */
  const pageRec = useMemo(() => (openedPage === null ? null : loadPages().find((p) => p.id === openedPage) ?? null), [openedPage, pagesVersion]);
  /* A click in the preview on the header, the footer or the product cards edits the whole store, even while a page is open */
  const [pagePanel, setPagePanel] = useState(true);
  useEffect(() => {
    setEditingRaw(null);
    setPagePanel(true);
  }, [openedPage]);
  /* If the page open in the designer is gone (deleted from the menu or from the dashboard), go back to the home page */
  useEffect(() => {
    if (openedPage !== null && !loadPages().some((p) => p.id === openedPage)) setOpenedPage(null);
  }, [openedPage, pagesVersion]);
  const [moreMenu, setMoreMenu] = useState(false);
  /* The name being typed to save this design as a theme (null: the form is closed) */
  const [themeName, setThemeName] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  /* /design?template=1: the admin edits the starter template, the default design that every new store begins with */
  const [templateMode, setTemplateMode] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [attn, setAttn] = useState<{ id: "name" | "color" | "background" | "text"; tab: Tab; n: number } | null>(null);
  const [flash, setFlash] = useState<"saved" | "errors" | "full" | "demo" | "theme" | "themeFail" | null>(null);
  /* In the platform tour the designer can be opened and looked at, but nothing in it can be changed or uploaded */
  const [readOnly, setReadOnly] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  /* The side panel is one scrolling area for every tab. When a click in the preview opens a panel, it must start where that click
     belongs (the top, or the product card settings), not wherever the last panel was scrolled to. */
  const panelBox = useRef<HTMLDivElement>(null);
  const scrollPanel = (to: "top" | "cards") =>
    setTimeout(() => {
      const box = panelBox.current;
      if (!box) return;
      const el = to === "cards" ? box.querySelector<HTMLElement>('[data-section="cards"]') : null;
      const top = el ? el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8 : 0;
      box.scrollTo({ top, behavior: "auto" });
    }, 60);
  /* /design?theme=... opens the designer with a theme from the theme store loaded and ready to edit (kept only if he saves) */
  const [trying, setTrying] = useState<ThemeInfo | null>(null);
  /* The picture editor: the product whose picture was clicked in the preview (null: closed), and the points chosen for the sample products */
  const [pic, setPic] = useState<{ id: number; name: string; image: string; focus: { x: number; y: number } } | null>(null);
  const [focusOverrides, setFocusOverrides] = useState<Record<number, { x: number; y: number }>>({});
  const tryProducts = useMemo(
    () => (trying || mine ? previewProducts(lang, trying ?? findTheme(themeId)).map((p) => (focusOverrides[p.id] ? { ...p, focus: focusOverrides[p.id] } : p)) : undefined),
    [trying, mine, themeId, lang, focusOverrides],
  );
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${t.title}`;
  }, [lang, t]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ro = mine ? false : demoActive();
    setReadOnly(ro);
    const template = !ro && !mine && q.get("template") === "1";
    const d = initial();
    if (mine) {
      const m = loadMine(lang, themeId);
      d.config = m.config;
      d.identity = m.identity;
    }
    const baseline = JSON.stringify(d);
    if (template) d.config = loadTemplate() ?? defaultConfig;
    const tryTheme = !ro && !template && !mine ? findTheme(q.get("theme")) : null;
    if (tryTheme) d.config = tryTheme.build(lang, { samples: true, storeName: d.identity.name });
    setTrying(tryTheme);
    setTemplateMode(template);
    /* Without his own products the template would look empty, so it is shown with sample products */
    setSample(template || q.get("sample") === "1");
    setDraft(d);
    setSaved(tryTheme ? baseline : JSON.stringify(d));
  }, []);

  const dirty = draft !== null && JSON.stringify(draft) !== saved;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const redo = (k === "z" && e.shiftKey) || k === "y";
      if (k !== "z" && k !== "y") return;
      /* A picture or dialog is open on top: leave the keys to it */
      if (document.querySelector('[role="dialog"]')) return;
      const h = hist.current;
      const cur = draftRef.current;
      if (!cur) return;
      const target = redo ? h.future.pop() : h.past.pop();
      e.preventDefault();
      if (!target) return;
      (redo ? h.past : h.future).push(cur);
      h.at = 0;
      setDraft(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* At /saad the store's name is the made-up one in the page's language. The language is only known after the first render, so it is set again here (never over unsaved edits). */
  useEffect(() => {
    if (!mine || !draft || dirty) return;
    const identity = freshMine(lang, themeId).identity;
    if (JSON.stringify(identity) === JSON.stringify(draft.identity)) return;
    const next = { ...draft, identity };
    setDraft(next);
    setSaved(JSON.stringify(next));
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPic(null);
    setPanelOpen(true);
    setSelected(id);
    if (id === "identity" || id === "cards") setPagePanel(false);
    if (id === "identity") {
      setTab("identity");
      scrollPanel("top");
      return;
    }
    if (id === "cards") {
      setTab("options");
      scrollPanel("cards");
      return;
    }
    setPagePanel(!(id === "header" || id === "footer" || id === "announcement"));
    setTab("pages");
    scrollPanel("top");
    setFocus({ id, field, n: Date.now() });
    setEditingRaw(id === "header" || id === "footer" || id === "announcement" ? null : id);
  };

  /* In the tour nothing can be changed: every field is switched off (an upload button says it is not available in the demo),
     and buttons that would change the design show a note instead. */
  const ready = draft !== null;
  useEffect(() => {
    if (!readOnly || !ready) return;
    const el = root.current;
    if (!el) return;
    const lockAll = () => {
      el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select").forEach((f) => {
        if (!f.disabled) f.disabled = true;
        if (f.type === "file") {
          const label = f.closest("label");
          if (label && !label.dataset.demoOff) label.dataset.demoOff = t.demoNoUpload;
          f.title = t.demoNoUpload;
        } else {
          f.title = t.demoBlocked;
        }
      });
    };
    lockAll();
    const watcher = new MutationObserver(lockAll);
    watcher.observe(el, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [readOnly, ready, t.demoBlocked, t.demoNoUpload]);

  if (!draft) return <DesignerSkeleton />;

  /* The one way the panels change the design. In the tour it changes nothing and says why. */
  const update = (fn: (d: Draft) => Draft) => {
    if (readOnly) {
      setFlash("demo");
      setTimeout(() => setFlash((f) => (f === "demo" ? null : f)), 3000);
      return;
    }
    const h = hist.current;
    const now = Date.now();
    if (draftRef.current && now - h.at > 700) {
      h.past.push(draftRef.current);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
    }
    h.at = now;
    setDraft((d) => d && fn(d));
  };

  /* Clicking a product's picture opens its picture editor */
  const selectProduct = (p: StoreProduct) => {
    if (!p.image) return;
    setPanelOpen(true);
    setSelected("cards");
    setPic({ id: p.id, name: p.name, image: p.image, focus: focusOverrides[p.id] ?? p.focus ?? { x: 50, y: 50 } });
    scrollPanel("top");
  };
  /* Dragging a colored button in the preview: it moves to the place of the one it is dropped over */
  const reorderChips = (sectionId: string, from: number, to: number) =>
    update((dr) => ({
      ...dr,
      config: {
        ...dr.config,
        sections: dr.config.sections.map((sec) => {
          if (sec.id !== sectionId || sec.type !== "chips" || to < 0 || to >= sec.settings.items.length) return sec;
          const items = [...sec.settings.items];
          const [x] = items.splice(from, 1);
          items.splice(to, 0, x);
          return { ...sec, settings: { ...sec.settings, items } };
        }),
      },
    }));
  /* The chosen point is kept with the product (sample products of a theme try-out live only on screen) */
  const setPicFocus = (f: { x: number; y: number }) => {
    if (!pic) return;
    setPic({ ...pic, focus: f });
    if (pic.id < 0 || mine || trying) setFocusOverrides((m) => ({ ...m, [pic.id]: f }));
    else saveProductFocus(pic.id, f);
  };
  /* Designing a page: its elements are edited with the same panel as the home page's, and saved with the page */
  const viewDraft: Draft = pageRec ? { ...draft, config: { ...draft.config, sections: pageRec.sections ?? [] } } : draft;
  const viewUpdate = (fn: (d: Draft) => Draft) => {
    if (!pageRec) return update(fn);
    if (readOnly) {
      setFlash("demo");
      setTimeout(() => setFlash((f) => (f === "demo" ? null : f)), 3000);
      return;
    }
    const next = fn(viewDraft);
    savePages(loadPages().map((p) => (p.id === pageRec.id ? { ...p, sections: next.config.sections } : p)));
    window.dispatchEvent(new Event("storage"));
    setPagesVersion((v) => v + 1);
  };
  const blockedNote = () => {
    setFlash("demo");
    setTimeout(() => setFlash((x) => (x === "demo" ? null : x)), 3000);
  };

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
    if (!(mine ? saveMine(draft.config, themeId) : templateMode ? saveTemplate(draft.config) : saveConfig(draft.config))) {
      setFlash("full");
      setTimeout(() => setFlash(null), 4000);
      return false;
    }
    if (templateMode || mine) {
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
        setPic(null);
        scrollPanel("top");
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
    <div ref={root} className="dash relative flex h-screen flex-col overflow-hidden bg-page">
      {/* Top bar */}
      <div ref={bar} className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-fg/10 bg-card px-4">
        <span className="hidden text-sm font-extrabold sm:block">{t.themeName}</span>
        {templateMode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.templateBadge}
          </span>
        ) : mine ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.mineBadge}
          </span>
        ) : readOnly ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.demoView}
          </span>
        ) : trying ? (
          <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 sm:inline-flex">
            {t.trying}: {trying.name[lang]}
          </span>
        ) : (
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 sm:inline-flex">
          {t.published}
        </span>
        )}

        <div className="relative">
          <button type="button" onClick={() => { setPagesMenu((o) => !o); setMoreMenu(false); }} aria-expanded={pagesMenu} className={`${pill} flex items-center gap-2`}>
            {openedPage !== null ? storePages.find((p) => p.id === openedPage)?.title ?? t.pages[0] : productView ? t.pages[1] : t.pages[0]}
            <span className={`transition-transform ${pagesMenu ? "rotate-180" : ""}`}>{railIcons.chevron}</span>
          </button>
          {pagesMenu && (
            <ul className="absolute start-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10">
              {t.pages.slice(0, 2).map((p, i) => (
                <li key={p}>
                  <button
                    type="button"
                    disabled={i > 1}
                    onClick={() => { setPagesMenu(false); setOpenedPage(null); setProductView(i === 1); }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition ${(i === 0 && openedPage === null && !productView) || (i === 1 && productView) ? "bg-primary/15 font-bold text-primary" : i <= 1 ? "font-bold hover:bg-soft" : "text-muted/70"}`}
                  >
                    {p}
                    {i > 1 && <span className="text-[10px] font-semibold">{t.soon}</span>}
                  </button>
                </li>
              ))}
              {storePages.map((p) => (
                <li key={p.id}>
                  {delAsk === p.id ? (
                    <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2">
                      <span className="flex-1 text-xs text-rose-700 dark:text-rose-400">{lang === "ar" ? "حذف هذه الصفحة؟" : "Delete this page?"}</span>
                      <button type="button" disabled={readOnly} onClick={() => { savePages(loadPages().filter((x) => x.id !== p.id)); window.dispatchEvent(new Event("storage")); setPagesVersion((v) => v + 1); if (openedPage === p.id) setOpenedPage(null); setDelAsk(null); }} className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40">{lang === "ar" ? "نعم" : "Yes"}</button>
                      <button type="button" onClick={() => setDelAsk(null)} className="rounded-md border border-fg/20 px-2.5 py-1 text-xs font-semibold">{lang === "ar" ? "لا" : "No"}</button>
                    </div>
                  ) : (
                    <div className={`flex items-center rounded-xl transition hover:bg-soft ${openedPage === p.id ? "bg-primary/15" : ""}`}>
                      <button type="button" onClick={() => { setPagesMenu(false); setOpenedPage(p.id); setProductView(false); setPanelOpen(true); }} className={`min-w-0 flex-1 truncate px-3 py-2.5 text-start text-sm font-medium ${openedPage === p.id ? "font-bold text-primary" : ""}`}>
                        {p.title}
                      </button>
                      <button type="button" disabled={readOnly} onClick={() => setDelAsk(p.id)} aria-label={lang === "ar" ? "حذف الصفحة" : "Delete the page"} title={lang === "ar" ? "حذف الصفحة" : "Delete the page"} className="me-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-30">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
              <li className="mt-1 border-t border-fg/10 pt-1">
                <button type="button" disabled={readOnly} title={readOnly ? t.demoBlocked : undefined} onClick={() => { setPagesMenu(false); setMakingPage(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
                  + {lang === "ar" ? "صفحة جديدة" : "New page"}
                </button>
              </li>
            </ul>
          )}
          {makingPage && <NewPageDialog lang={lang} onClose={() => setMakingPage(false)} onCreated={(id) => { setMakingPage(false); setPagesVersion((v) => v + 1); setOpenedPage(id); setProductView(false); setPanelOpen(true); }} />}
        </div>

        <div className="flex-1" />

        <span aria-live="polite" className="hidden text-xs font-semibold md:block">
          {flash === "theme" ? <span className="text-primary">{t.themeSaved}</span> : flash === "themeFail" ? <span className="text-rose-600">{t.themeFail}</span> : flash === "demo" ? <span className="text-amber-700 dark:text-amber-300">{t.demoBlocked}</span> : flash === "saved" ? <span className="text-primary">{t.saving}</span> : flash === "errors" && attn ? (
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
          <button type="button" onClick={() => { setMoreMenu((o) => !o); setPagesMenu(false); setThemeName(null); }} aria-label={t.more} aria-expanded={moreMenu} className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15 transition hover:bg-soft">
            {railIcons.more}
          </button>
          {moreMenu && (
            <div className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10">
              <a href="/store?original=1" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.starter}</a>
              {templateMode && (
                <a href="/store?starter=1" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{t.templatePreview}</a>
              )}
              {mine && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(t.mineResetAsk)) return;
                    resetMine(themeId);
                    const f = freshMine(lang, themeId);
                    setDraft({ config: f.config, identity: f.identity });
                    setSaved(JSON.stringify({ config: f.config, identity: f.identity }));
                    setEditing(null);
                    setMoreMenu(false);
                  }}
                  className="block w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft"
                >
                  {t.mineReset}
                </button>
              )}
              {themeName === null ? (
                <button type="button" disabled={readOnly} title={readOnly ? t.demoBlocked : undefined} onClick={() => setThemeName(t.themeDefaultName)} className="block w-full rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">{t.saveAsTheme}</button>
              ) : (
                <div className="rounded-xl bg-soft p-3">
                  <input autoFocus value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder={t.themeNamePh} aria-label={t.themeNamePh} maxLength={40} className={`${input} h-10`} />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const r = saveDesignAsTheme(themeName.trim() || t.themeDefaultName, draft.config);
                        setThemeName(null);
                        setMoreMenu(false);
                        setFlash(r === "ok" ? "theme" : "themeFail");
                        setTimeout(() => setFlash(null), 3500);
                      }}
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-onink"
                    >
                      {t.save}
                    </button>
                    <button type="button" onClick={() => setThemeName(null)} className="rounded-md border border-fg/20 px-3 py-1.5 text-xs font-semibold">{t.cancel}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!mine && (
        <a href="/preview" target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-lg border border-fg/15 px-3 text-sm font-semibold transition hover:bg-soft">
          {railIcons.eye}
          {t.previewBtn}
        </a>
        )}

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
          <TextColorNow.Provider value={draft.config.theme.text}>
          <OpenPage.Provider value={(id) => { setOpenedPage(id); setProductView(false); setPanelOpen(true); }}>
          <aside className="flex max-h-[45vh] shrink-0 flex-col border-b border-fg/10 bg-card lg:max-h-none lg:w-[20rem] lg:border-b-0 lg:border-e">
            <div ref={panelBox} className="min-h-0 flex-1 overflow-y-auto">
              {!pic && openedPage !== null && pagePanel && (
                <>
                  {editing === null && <PageEditor lang={lang} id={openedPage} onBack={() => setOpenedPage(null)} onChanged={() => setPagesVersion((v) => v + 1)} />}
                  <PagesPanel lang={lang} draft={viewDraft} update={viewUpdate} editing={editing} setEditing={setEditing} focus={focus} onlyElements />
                </>
              )}
              {pic && <ProductPicturePanel lang={lang} name={pic.name} image={pic.image} value={pic.focus} onChange={setPicFocus} onBack={() => setPic(null)} blocked={readOnly} onBlocked={blockedNote} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "pages" && <PagesPanel lang={lang} draft={draft} update={update} editing={editing} setEditing={setEditing} focus={focus} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "identity" && <IdentityPanel lang={lang} draft={draft} update={update} showErrors={showErrors} attn={attn?.id} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "texts" && <TextsPanel lang={lang} draft={draft} update={update} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "options" && <OptionsPanel lang={lang} draft={draft} update={update} attn={attn?.id} />}
            </div>
            <div className="shrink-0 border-t border-fg/10 p-3">
              <p className="mb-2 text-xs text-muted">{templateMode ? t.templateNote : t.note}</p>
              <button type="button" onClick={save} disabled={!dirty} className="h-10 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40">
                {t.save}
              </button>
            </div>
          </aside>
          </OpenPage.Provider>
          </TextColorNow.Provider>
        )}

        {/* Preview: the store can be made smaller to see it all, and moved around */}
        <Canvas lang={lang}>
          <StorefrontTheme
            config={draft.config}
            device="auto"
            interactive={false}
            sample={sample}
            products={tryProducts}
            owner
            showPage={openedPage}
            showProduct={productView}
            design={{ selected, select, selectProduct, reorderChips, openPage: (id) => { setOpenedPage(id); setProductView(false); if (id !== null) setPanelOpen(true); } }}
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
