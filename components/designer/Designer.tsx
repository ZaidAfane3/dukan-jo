"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { brandName } from "../content";
import { demoActive, setOwnCopy } from "../demoSandbox";
import { adoptTheme, baseTheme, defaultTheme, findTheme, loadThemeState, previewProducts, saveDesignAsTheme, withoutUnboughtLooks, type ThemeInfo } from "../themes";
import { NewPageDialog, OpenPage, useStorePages } from "./PageLink";
import { PageEditor } from "./PageEditor";
import { load as loadPages, savePages, setPagesScope } from "../InfoPages";
import { freshMine, loadMine, resetMine, saveMine } from "./mineTemplate";
import { LangSwitch, usePrefs } from "../Prefs";
import { oneSided, startingWords, textsNow, TRANSLATE_WORDS } from "./translations";
import { accountName, accountPhone, loadSetup, saveSetup, type SavedSetup } from "../setup";
import { StorefrontTheme } from "../storefront/StorefrontTheme";
import { DesignerSkeleton } from "../StoreSkeletons";
import { clearTemplate, loadConfig, loadTemplate, saveConfig, saveTemplate, storeIsLive } from "../storefront/storage";
import { defaultConfig, headingFamily, type PicEdit, type SectionMove } from "../storefront/config";
import { Canvas } from "./Canvas";
import { HEX, input } from "./controls";
import { dc } from "./copy";
import { BugReport } from "./BugReport";
import { legibleOn } from "../storefront/footerColors";
import { OptionsPanel, PageLookNow, SampleProducts, StoreColorNow, UsingTheme, TextColorNow, PagesPanel, ProductPicturePanel, TextsPanel, okEmail, okPhone, type Draft, type Focus } from "./panels";
import { hasStoreContact, visibleLength } from "../safe";
import type { Design } from "../storefront/sections";

/* What can stop a save. The last four live in the footer's contact form. */
type Problem = "name" | "color" | "background" | "text" | "email" | "whatsapp" | "phone" | "contact";
const footerProblem = { email: "email", whatsapp: "whatsapp", phone: "phone", contact: "phone" } as const;
import { readProducts, saveProductFocus, type StoreProduct } from "../storefront/useStoreData";
import type { StorefrontConfig } from "../storefront/config";
import type { Lang } from "../content";
import { shownMobile } from "../phone";
import { savedPhone } from "../safeAccount";

/* The design as text for "is anything changed?": keys in one order, and what draws the same as nothing (a value taken away, an
   empty group of settings, words left empty in both languages) left out, so a value changed and then put back by hand is no change */
const isBlankWords = (o: Record<string, unknown>) => {
  const k = Object.keys(o);
  return k.length === 2 && o.en === "" && o.ar === "";
};
function sameAs(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sameAs);
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) {
    const x = sameAs((v as Record<string, unknown>)[k]);
    if (x === undefined) continue;
    if (x && typeof x === "object" && !Array.isArray(x) && (!Object.keys(x).length || isBlankWords(x as Record<string, unknown>))) continue;
    out[k] = x;
  }
  return out;
}
const designText = (d: unknown) => JSON.stringify(sameAs(d));

const ico = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/* The switch that fills the preview with sample products (see sampleChoice) */
const SAMPLE_WORDS = {
  en: { label: "Preview with sample products", hint: "Only in this preview. They are never saved or shown in your store." },
  ar: { label: "معاينة بمنتجات تجريبية", hint: "في هذه المعاينة فقط، ولا تُحفظ ولا تظهر في متجرك." },
};

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
  undo: <svg {...ico} className="h-4 w-4"><path d="M9 14 4 9l5-5M4 9h10.500a5.500 5.500 0 0 1 0 11H11" /></svg>,
  redo: <svg {...ico} className="h-4 w-4"><path d="m15 14 5-5-5-5M20 9H9.500a5.500 5.500 0 0 0 0 11H13" /></svg>,
  check: <svg {...ico} className="h-4 w-4" strokeWidth={2.2}><path d="m5 12.500 4.500 4.500L19 7" /></svg>,
  /* save: an arrow down into a tray */
  save: <svg {...ico} className="h-4 w-4" strokeWidth={2}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  /* back to the original: an arrow turning back */
  reset: <svg {...ico} className="h-4 w-4"><path d="M4 12a8 8 0 1 0 2.300-5.700M4 4v4.500h4.500" /></svg>,
  /* keep this design as a theme */
  bookmark: <svg {...ico} className="h-4 w-4"><path d="M7 4h10v16l-5-3.500L7 20V4Z" /></svg>,
  /* opens in a new tab */
  external: <svg {...ico} className="h-4 w-4"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
};

/* Texts of the top bar that live only in this file */
const barText = {
  en: { undo: "Undo (Ctrl+Z)", redo: "Redo (Ctrl+Shift+Z)", savedExcept: "Everything was saved except looks from themes you haven't bought" },
  ar: { undo: "تراجع (Ctrl+Z)", redo: "إعادة (Ctrl+Shift+Z)", savedExcept: "حُفظ كل شيء، ما عدا أشكال الثيمات غير المشتراة" },
};

type Tab = "pages" | "identity" | "options" | "texts";

/* the settings panel's width on a big screen (px): the usual one, and how narrow and wide he can drag it */
const PANEL_W = 320;
const PANEL_MIN = 288;
const PANEL_MAX = 640;
const PANEL_KEY = "dukkan-designer-panel";

/** Where two designs differ, as paths ("config.footer.about"). `leaf` says what kind of value changed there:
    "text", "number", or null when it is not a single value (a toggle, a list that grew or shrank, a part added or removed). */
function changedPaths(a: unknown, b: unknown, path = "", out: { path: string; leaf: "text" | "number" | null }[] = []) {
  if (a === b || out.length > 12) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b) && !(Array.isArray(a) && a.length !== (b as unknown[]).length)) {
    const x = a as Record<string, unknown>;
    const y = b as Record<string, unknown>;
    for (const k of Array.from(new Set([...Object.keys(x), ...Object.keys(y)]))) changedPaths(x[k], y[k], `${path}.${k}`, out);
    return out;
  }
  out.push({ path, leaf: typeof a === "string" && typeof b === "string" ? "text" : typeof a === "number" && typeof b === "number" ? "number" : null });
  return out;
}
const TASKS = 6; /* the store design task is the last one of the setup list */

function initial(): Draft {
  const s = loadSetup();
  return {
    config: loadConfig(),
    identity: { name: s?.name || accountName(), description: s?.description ?? "", color: s?.color ?? "#004956", phone: shownMobile(s?.phone || accountPhone()) },
  };
}

/* `mine` is Saad's private copy of the demo template at /saad (temporary, see mineTemplate.ts): fully editable, saved under its own key. */
export function Designer({ mine: mineProp = false }: { mine?: boolean | string } = {}) {
  /* /saad shows the demo template; /saad/<theme> shows a ready theme of the theme store (kept under its own key) */
  const themeId = typeof mineProp === "string" && findTheme(mineProp) ? mineProp : undefined;
  const mine = !!mineProp;
  /* Saad's copies keep their own pages (each theme its own list), and are never locked by the tour. Set before anything reads them. */
  setPagesScope(mine ? `saad-pages-${themeId ?? "demo"}` : null);
  setOwnCopy(mine);
  useEffect(() => () => {
    setPagesScope(null);
    setOwnCopy(false);
  }, []);
  const { lang, setLang } = usePrefs();
  const t = dc[lang];
  const tb = barText[lang];
  const router = useRouter();

  const [draft, setDraft] = useState<Draft | null>(null);
  /* Ctrl+Z takes back the last edit, Ctrl+Shift+Z (or Ctrl+Y) puts it back. Typing in one field (or dragging one slider) is one step;
     moving on to another field starts the next one. */
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  /* `key`: the field the last step is still typing in (null: the next change is a step of its own); `tick`: changes made by one click together */
  const hist = useRef<{ past: Draft[]; future: Draft[]; key: string | null; tick: boolean }>({ past: [], future: [], key: null, tick: false });
  /* The last change was typing a text: the preview follows a moment later instead of on every key (see Preview) */
  const [typing, setTyping] = useState(false);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<Tab>("pages");
  const [panelOpen, setPanelOpenRaw] = useState(true);
  /* the panel's width on a big screen: he can drag its edge; remembered on this computer */
  const [panelW, setPanelW] = useState(PANEL_W);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PANEL_KEY));
      if (saved) setPanelW(Math.min(PANEL_MAX, Math.max(PANEL_MIN, saved)));
    } catch {
      /* storage blocked: the usual width */
    }
  }, []);
  const sizePanel = useCallback((w: number) => {
    const next = Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));
    setPanelW(next);
    try {
      localStorage.setItem(PANEL_KEY, String(next));
    } catch {
      /* storage blocked: it lasts for this visit */
    }
  }, []);
  /* dragging the edge: in Arabic the panel is on the right, so moving left makes it wider */
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const x0 = e.clientX, w0 = panelW;
    const move = (ev: PointerEvent) => sizePanel(w0 + (rtl ? x0 - ev.clientX : ev.clientX - x0));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  /* On a phone or a tablet (under 1024px) the panel takes the whole height and the store is shown instead of it, by the Settings / Preview switch.
     Anything that opens the panel (a tap on the store, a rail button) brings the settings back. */
  const [phoneStore, setPhoneStore] = useState(false);
  const setPanelOpen = (v: boolean | ((o: boolean) => boolean)) => {
    setPanelOpenRaw(v);
    if (v === true) setPhoneStore(false);
  };
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 1023px)");
    const on = () => setPhone(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
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
  /* The preview shows the store with its cart open (the cart design is seen there) */
  const [cartView, setCartView] = useState(false);
  /* the sidebar settings are open: the store shows its sidebar open, to see the changes live */
  const [menuView, setMenuView] = useState(false);
  const onSub = useCallback((sub: string | null) => setMenuView(sub === "sidebarSettings"), []);
  const showCartPage = useCallback(() => { setOpenedPage(null); setProductView(false); setCartView(true); }, []);
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
  /* The name of the theme in use, as My themes shows it (his own name for it, a saved design's name, or the theme's) */
  const [activeTheme, setActiveTheme] = useState("");
  /* the theme this page is (or is built over): the options of a theme show only while that theme is used */
  const [usingTheme, setUsingTheme] = useState("");
  useEffect(() => {
    const s = loadThemeState();
    const id = themeId ?? s.active;
    setActiveTheme(s.names?.[id] || s.custom.find((c) => c.id === id)?.name || findTheme(id)?.name[lang] || "");
    setUsingTheme(baseTheme(id));
  }, [themeId, lang]);
  const [sample, setSample] = useState(false);
  /* whether the store has products of its own (read again when the dashboard changes them in another tab) */
  const [hasOwnProducts, setHasOwnProducts] = useState(true);
  useEffect(() => {
    const read = () => setHasOwnProducts(readProducts().length > 0);
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  /* /design?template=1: the admin edits the starter template, the default design that every new store begins with */
  const [templateMode, setTemplateMode] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [attn, setAttn] = useState<{ id: Problem; tab: Tab; n: number } | null>(null);
  const [flash, setFlash] = useState<"saved" | "savedExcept" | "errors" | "full" | "demo" | "theme" | "themeFail" | "empty" | null>(null);
  /* whether customers can see the store yet (it opens with its first save) */
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => setIsOpen(storeIsLive()), []);
  /* In the platform tour the designer can be opened and looked at, but nothing in it can be changed or uploaded */
  const [readOnly, setReadOnly] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  /* The side panel is one scrolling area for every tab. When a click in the preview opens a panel, it must start where that click
     belongs (the top, or the product card settings), not wherever the last panel was scrolled to. */
  const panelBox = useRef<HTMLDivElement>(null);
  const scrollPanel = (to: "top" | "cards" | "productPage") =>
    setTimeout(() => {
      const box = panelBox.current;
      if (!box) return;
      const el = to === "top" ? null : box.querySelector<HTMLElement>(`[data-section="${to}"]`);
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
    /* a look of a theme he has not bought is never in his design (an older save, or one picked before they were hidden) */
    if (!mine && !template) d.config = withoutUnboughtLooks(d.config);
    const baseline = JSON.stringify(d);
    if (template) d.config = loadTemplate() ?? defaultConfig;
    const tryTheme = !ro && !template && !mine ? findTheme(q.get("theme")) : null;
    /* The theme's look on his store: his contact details, socials and pages stay (see adoptTheme) */
    if (tryTheme) d.config = adoptTheme(d.config, tryTheme.build(lang, { samples: true, storeName: d.identity.name }));
    setTrying(tryTheme);
    setTemplateMode(template);
    /* Without his own products the template would look empty, so it is shown with sample products */
    setSample(template || q.get("sample") === "1");
    setDraft(d);
    setSaved(tryTheme ? baseline : JSON.stringify(d));
  }, []);

  /* Kept from one render to the next: the whole design is turned into text only when it changes */
  const savedText = useMemo(() => (saved ? designText(JSON.parse(saved)) : ""), [saved]);
  const dirty = useMemo(() => draft !== null && designText(draft) !== savedText, [draft, savedText]);

  /* Texts written in one language only (changed since the designer opened, or before: his words in one language, the sample
     words of the design the store started from in the other): the other language still shows the old words */
  const startTexts = useRef<ReturnType<typeof textsNow> | null>(null);
  if (draft && !startTexts.current) startTexts.current = textsNow(draft.config);
  const samples = useMemo(
    () => startingWords([usingTheme, trying?.id, themeId], mine ? [freshMine("en", themeId).config, freshMine("ar", themeId).config] : []),
    [usingTheme, trying, themeId, mine],
  );
  const changedIn = useMemo(() => (draft && startTexts.current ? oneSided(startTexts.current, samples, draft.config) : { en: 0, ar: 0 }), [draft, samples]);

  /* One step back (or forward again), from the keys or from the arrows next to the save button */
  const travel = (redo: boolean) => {
    const h = hist.current;
    const cur = draftRef.current;
    if (!cur) return;
    const target = redo ? h.future.pop() : h.past.pop();
    if (!target) return;
    (redo ? h.past : h.future).push(cur);
    h.key = null;
    draftRef.current = target;
    setTyping(false);
    setDraft(target);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const redo = (k === "z" && e.shiftKey) || k === "y";
      if (k !== "z" && k !== "y") return;
      /* A picture or dialog is open on top: leave the keys to it */
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      travel(redo);
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

  /* The leave question keeps the keyboard inside it: it starts on "keep editing", Escape closes it, and Tab goes round its buttons.
     When it closes, the exit button gets the keyboard back. */
  const exitDialog = useRef<HTMLDivElement>(null);
  const exitBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!exiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setExiting(false);
        return;
      }
      if (e.key !== "Tab") return;
      const btns = Array.from(exitDialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      if (btns.length === 0) return;
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      exitBtn.current?.focus();
    };
  }, [exiting]);

  /* An element just added is shown in the preview: it scrolls down to it (see Canvas) */
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null);

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
  /* The panel opens an element it has just added: the preview selects it and scrolls down to it */
  const setEditingView = (id: string | null) => {
    setEditing(id);
    if (id && draft && !(pageRec ? pageRec.sections ?? [] : draft.config.sections).some((s) => s.id === id)) setReveal({ id, n: Date.now() });
  };

  /* Clicking a part of the store in the preview opens its settings in the panel. */
  const select = (id: string, field?: string) => {
    setPic(null);
    setPanelOpen(true);
    setSelected(id);
    if (id === "identity" || id === "cards") setPagePanel(false);
    if (id === "cards") {
      setTab("options");
      scrollPanel("cards");
      return;
    }
    /* the header, its Store identity screen, the announcement bar and the footer are not parts of the page */
    const frame = id === "header" || id === "identity" || id === "footer" || id === "announcement";
    setPagePanel(!frame);
    setTab("pages");
    scrollPanel("top");
    setFocus({ id, field, n: Date.now() });
    setEditingRaw(frame ? null : id);
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

  /* "Save and see it in the theme store" under a look of a theme he has not bought: his design is saved, then that theme opens */
  const saveRef = useRef<() => boolean>(() => false);
  const acts = useRef<Acts>({ select: () => {}, selectProduct: () => {}, moveBit: () => {}, editPic: () => {}, reorderChips: () => {}, openPage: () => {}, sampleProducts: () => {} });
  /* A form of the footer is open in the side panel (its contact, social or licenses forms too): on a phone the preview zooms in on the footer */
  const [footerForm, setFooterForm] = useState(false);
  useEffect(() => {
    const box = panelBox.current;
    if (!box || !panelOpen) return setFooterForm(false);
    const names = [t.rows.footerSettings, t.rows.service, t.rows.social, t.rows.certificate];
    /* the title at the top of an open form (see SubShell in panels.tsx) */
    const check = () => setFooterForm(names.includes(box.querySelector(":scope > div > div:first-child p.font-bold")?.textContent ?? ""));
    check();
    const watcher = new MutationObserver(check);
    watcher.observe(box, { childList: true, subtree: true, characterData: true });
    return () => watcher.disconnect();
  }, [panelOpen, ready, t]);
  useEffect(() => {
    const go = (e: Event) => {
      if (saveRef.current()) router.push((e as CustomEvent<string>).detail);
    };
    window.addEventListener("dk-save-go", go);
    return () => window.removeEventListener("dk-save-go", go);
  }, [router]);

  /* where leaving goes: the dashboard, or the theme store (from its button at the top) */
  const leaveTo = useRef("/dashboard");
  /* he was told the page has no blocks and chose to save it anyway (asked again for every save) */
  const emptyOk = useRef(false);
  /* the page's background and the store color, for the color boxes that warn when a text color vanishes on them */
  const pageBgNow = draft?.config.theme.background ?? "#ffffff";
  const primaryNow = draft ? draft.config.theme.primary || (/^#[0-9a-f]{6}$/i.test(draft.identity.color) ? draft.identity.color : "#004956") : "#004956";
  const pageLook = useMemo(() => ({ bg: pageBgNow, primary: primaryNow }), [pageBgNow, primaryNow]);

  if (!draft) return <DesignerSkeleton />;

  /* The one way the panels change the design. In the tour it changes nothing and says why. */
  const update = (fn: (d: Draft) => Draft) => {
    if (readOnly) {
      setFlash("demo");
      setTimeout(() => setFlash((f) => (f === "demo" ? null : f)), 3000);
      return;
    }
    const cur = draftRef.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    const h = hist.current;
    /* What changed: typing (or a slider) in fields gives their paths; a click, a toggle or a list that grew or shrank gives none */
    const changed = changedPaths(cur, next);
    const typed = typeof window !== "undefined" && window.event?.type === "input" && changed.length > 0 && changed.every((c) => c.leaf !== null);
    const key = typed ? changed.map((c) => c.path).join("|") : null;
    /* Changes made by one click (several updates at once) are one step too */
    if (!h.tick && !(key !== null && key === h.key)) {
      h.past.push(cur);
      if (h.past.length > 100) h.past.shift();
      h.future = [];
    }
    h.key = key;
    if (!h.tick) {
      h.tick = true;
      Promise.resolve().then(() => (hist.current.tick = false));
    }
    /* the next update in this same click builds on this one */
    draftRef.current = next;
    setTyping(typed && changed.every((c) => c.leaf === "text"));
    setDraft(next);
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
  /* a word or a picture moved in the preview, sideways and up or down (null: back to its place) */
  const moveBit = (sectionId: string, key: string, at: SectionMove | null) =>
    update((dr) => ({
      ...dr,
      config: {
        ...dr.config,
        sections: dr.config.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const moves = { ...(sec.moves ?? {}) };
          if (at === null) delete moves[key];
          else moves[key] = at;
          return { ...sec, moves: Object.keys(moves).length ? moves : undefined };
        }),
      },
    }));
  /* a picture edited inside its frame in the preview (null: back as it was) */
  const editPic = (sectionId: string, key: string, at: PicEdit | null) =>
    update((dr) => ({
      ...dr,
      config: {
        ...dr.config,
        sections: dr.config.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          const pics = { ...(sec.pics ?? {}) };
          if (at === null) delete pics[key];
          else pics[key] = at;
          return { ...sec, pics: Object.keys(pics).length ? pics : undefined };
        }),
      },
    }));
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

  const valid = (d: Draft) => visibleLength(d.identity.name) >= 2 && HEX.test(d.identity.color) && HEX.test(d.config.theme.background) && HEX.test(d.config.theme.text);

  /* The first thing that stops a save, and where it lives */
  const firstProblem = (d: Draft): { id: Problem; tab: Tab } | null => {
    if (!templateMode && visibleLength(d.identity.name) < 2) return { id: "name", tab: "pages" };
    if (!templateMode && !HEX.test(d.identity.color)) return { id: "color", tab: "pages" };
    if (!HEX.test(d.config.theme.background)) return { id: "background", tab: "options" };
    if (!HEX.test(d.config.theme.text)) return { id: "text", tab: "options" };
    /* The store's own contact details (a template or a theme copy has none) */
    if (!templateMode && !mine) {
      const f = d.config.footer;
      if (!okEmail(f.email)) return { id: "email", tab: "pages" };
      if (!okPhone(f.whatsapp)) return { id: "whatsapp", tab: "pages" };
      if (!okPhone(d.identity.phone)) return { id: "phone", tab: "pages" };
      if (!hasStoreContact(d.identity.phone, f.whatsapp)) return { id: "contact", tab: "pages" };
    }
    return null;
  };

  /* Take him to the field: open its panel, scroll to it, put the cursor in it, and make it shake and glow. */
  const showProblem = (p: { id: Problem; tab: Tab }) => {
    if (p.id === "email" || p.id === "whatsapp" || p.id === "phone" || p.id === "contact") {
      /* Open the footer's contact form with the cursor in the field */
      select("footer", footerProblem[p.id]);
      setAttn({ ...p, n: Date.now() });
      setTimeout(() => setAttn((a) => (a && a.id === p.id ? null : a)), 6000);
      return;
    }
    /* the name and the store color are in the header's Store identity screen */
    if (p.id === "name" || p.id === "color") select("identity");
    else {
      setTab(p.tab);
      setPanelOpen(true);
      setEditingRaw(null);
    }
    setAttn({ ...p, n: Date.now() });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-attn="${p.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
    }, 120);
    setTimeout(() => setAttn((a) => (a && a.id === p.id ? null : a)), 6000);
  };

  /* asked before a page with no blocks is saved */
  const emptyAsk = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-800 dark:text-amber-300">
      {lang === "ar" ? "الصفحة بلا عناصر: لن يرى العملاء إلا رأس الصفحة وتذييلها." : "This page has no blocks: customers will see only the header and footer."}
      <button type="button" onClick={() => { emptyOk.current = true; setFlash(null); save(); }} className="font-bold underline">{lang === "ar" ? "احفظ على أي حال" : "Save anyway"}</button>
      <button type="button" onClick={() => setFlash(null)} className="font-bold underline">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
    </span>
  );

  const save = (): boolean => {
    const problem = firstProblem(draft);
    if (problem) {
      setShowErrors(true);
      setFlash("errors");
      showProblem(problem);
      setTimeout(() => setFlash(null), 6000);
      return false;
    }
    /* a home page with no blocks shows customers only the header and footer: he confirms it once before it is saved */
    if (!draft.config.sections.length && !emptyOk.current) {
      setFlash("empty");
      return false;
    }
    emptyOk.current = false;
    /* A look of a theme he has not bought can be tried in the preview, but the store keeps only what he owns */
    const kept = mine || templateMode ? draft : { ...draft, config: withoutUnboughtLooks(draft.config) };
    if (!(mine ? saveMine(draft.config, themeId) : templateMode ? saveTemplate(draft.config) : saveConfig(kept.config))) {
      setFlash("full");
      setTimeout(() => setFlash(null), 4000);
      return false;
    }
    setIsOpen(storeIsLive());
    if (templateMode || mine) {
      /* The template belongs to the platform, not to any store, so the store's own data stays as it is */
      setSaved(JSON.stringify(draft));
      setFlash("saved");
      setTimeout(() => setFlash((f) => (f === "saved" ? null : f)), 3000);
      return true;
    }
    const prev = loadSetup();
    const next: SavedSetup = {
      name: draft.identity.name.trim(),
      description: draft.identity.description.trim(),
      color: draft.identity.color,
      phone: savedPhone(draft.identity.phone),
      slug: prev?.slug ?? "",
      done: prev && prev.done.length === TASKS ? prev.done.map((v, i) => (i === TASKS - 1 ? true : v)) : Array.from({ length: TASKS }, (_, i) => i === TASKS - 1),
      pickup: prev?.pickup,
      logo: prev?.logo,
      product: prev?.product ?? null,
      shipping: prev?.shipping ?? null,
    };
    saveSetup(next);
    if (kept !== draft) setDraft(kept);
    setSaved(JSON.stringify(kept));
    /* Looks of themes he has not bought were left out: say so, so he does not think they were kept */
    const what = JSON.stringify(kept) !== JSON.stringify(draft) ? "savedExcept" : "saved";
    setFlash(what);
    setTimeout(() => setFlash((f) => (f === what ? null : f)), what === "savedExcept" ? 6000 : 3000);
    return true;
  };

  saveRef.current = save;
  /* What a click in the preview does. The preview keeps one set of these (see Preview), and they always call the latest ones. */
  acts.current = { select, selectProduct, moveBit, editPic, reorderChips, openPage: (id) => { setOpenedPage(id); setProductView(false); setCartView(false); if (id !== null) setPanelOpen(true); }, sampleProducts: setSample };
  /* the preview with sample products: offered while the store has no products of its own (a theme try-out and his own copy of a
     theme already show the theme's sample products, the starter template always shows them); it is only on screen, never saved */
  const sampleChoice = !trying && !mine && !templateMode && (!hasOwnProducts || sample) ? { on: sample, set: setSample } : null;
  /* the design this page is built on, as it first came (a design he made himself goes back to Dukkan's): the "original design" of the menu */
  const originalTheme = findTheme(trying?.id ?? usingTheme) ?? defaultTheme;

  /* where leaving goes: the dashboard, or the theme store from its button at the top left */
  const leave = () => router.push(leaveTo.current);
  const tryExit = (to = "/dashboard") => { leaveTo.current = to; if (dirty) setExiting(true); else leave(); };

  /* The red frame and the red dot go away as soon as the field they point at is fixed */
  const problemNow = firstProblem(draft);
  const attnNow = attn && problemNow?.id === attn.id ? attn : null;
  /* The save button turns green and says "Saved" for a moment after a save */
  const justSaved = !dirty && (flash === "saved" || flash === "savedExcept");
  /* A save here goes straight to the store customers visit (not the starter template, a private template or the fake demo), so the bar says so */
  const live = !templateMode && !mine && !readOnly;
  /* a store that was never saved can be saved as it is: that first save opens it to customers */
  const canSave = dirty || (live && !isOpen);
  const saveLabel = justSaved ? (
    <span className="inline-flex items-center justify-center gap-1.5">
      {railIcons.check}
      {t.saving}
    </span>
  ) : (
    <span className="inline-flex items-center justify-center gap-1.5">
      {railIcons.save}
      {t.save}
    </span>
  );

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
      aria-pressed={tab === key && panelOpen && !(phone && phoneStore)}
      className={`relative grid h-9 w-9 place-items-center rounded-xl transition ${tab === key && panelOpen && !(phone && phoneStore) ?"bg-primary/15 text-primary" : "text-muted hover:bg-fg/10 hover:text-fg"}`}
    >
      {ic}
      {attnNow && attnNow.tab === key && <span aria-hidden className="absolute end-1.5 top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-card" />}
    </button>
  );

  const pill = "rounded-xl border border-fg/15 px-2 py-2 sm:px-3 text-sm font-semibold transition hover:bg-soft";

  return (
    <div ref={root} className="dash relative flex h-screen flex-col overflow-hidden bg-page">
      {/* Top bar */}
      {/* On a phone the bar takes two rows: the buttons above, the theme's name, its badge and the page being edited below */}
      <div ref={bar} className="relative z-30 flex shrink-0 flex-wrap items-center gap-1 border-b border-fg/10 bg-card px-2 py-1.5 sm:gap-2 sm:px-4 lg:h-12 lg:flex-nowrap lg:gap-3 lg:py-0">
        {/* the way to other themes: the theme store (it asks first when there are changes not saved) */}
        <button type="button" onClick={() => tryExit("/themes")} title={t.themeStore} aria-label={t.themeStore} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#d39e1f] bg-gradient-to-br from-[#ffe680] via-[#f8c841] to-[#e6a817] px-2 py-2 text-sm font-bold text-[#3d2a00] shadow-[0_2px_12px_-3px_rgba(230,168,23,0.75),inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:-translate-y-px hover:brightness-110 sm:px-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Z" /><path d="M5 13.5V20h14v-6.5" /></svg>
          {/* one row from 1024px: the bar's longer words make room for the theme's and the page's names until 1280px */}
          <span className="hidden md:inline lg:hidden xl:inline">{t.themeStore}</span>
        </button>
        <div className="order-last mt-1.5 flex w-full min-w-0 items-center gap-2 border-t border-fg/10 pt-1.5 lg:contents">
        <span className="min-w-0 max-w-[12rem] truncate text-sm font-extrabold">{activeTheme || t.themeName}</span>
        {templateMode ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.templateBadge}
          </span>
        ) : mine ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.mineBadge}
          </span>
        ) : readOnly ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            {t.demoView}
          </span>
        ) : trying ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            <span className="truncate">{t.trying}: {trying.name[lang]}</span>
          </span>
        ) : isOpen ? (
        <span title={t.publishedHint} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {t.published}
        </span>
        ) : (
        /* never saved yet: customers cannot see the store until the first save */
        <span title={t.notLiveHint} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-fg/10 px-3 py-1 text-xs font-bold text-muted">
          {t.notLive}
        </span>
        )}

        {/* On a phone the page being edited sits at the end of the second row, with room for its name */}
        <div className="relative ms-auto min-w-0 shrink-0 lg:ms-0 lg:shrink">
          <button type="button" onClick={() => { setPagesMenu((o) => !o); setMoreMenu(false); }} aria-expanded={pagesMenu} className={`${pill} flex max-w-full items-center gap-2 whitespace-nowrap`}>
            <span className="min-w-0 max-w-[8rem] truncate sm:max-w-[14rem] lg:max-w-[10rem] xl:max-w-none">{openedPage !== null ? storePages.find((p) => p.id === openedPage)?.title ?? t.pages[0] : productView ? t.pages[1] : cartView ? t.cartPage : t.pages[0]}</span>
            <span className={`transition-transform ${pagesMenu ? "rotate-180" : ""}`}>{railIcons.chevron}</span>
          </button>
          {pagesMenu && (
            <ul className="absolute end-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10 lg:end-auto lg:start-0">
              {t.pages.slice(0, 2).map((p, i) => (
                <li key={p}>
                  <button
                    type="button"
                    disabled={i > 1}
                    onClick={() => {
                      setPagesMenu(false); setOpenedPage(null); setProductView(i === 1); setCartView(false);
                      /* the product page: its settings (in Store look) open beside it */
                      if (i === 1) { setPic(null); setPanelOpen(true); setPagePanel(false); setTab("options"); scrollPanel("productPage"); }
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-medium transition ${(i === 0 && openedPage === null && !productView && !cartView) || (i === 1 && productView) ? "bg-primary/15 font-bold text-primary" : i <= 1 ? "font-bold hover:bg-soft" : "text-muted/70"}`}
                  >
                    {p}
                    {i > 1 && <span className="text-[10px] font-semibold">{t.soon}</span>}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { setPagesMenu(false); setOpenedPage(null); setProductView(false); setCartView(true); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-bold transition ${cartView ? "bg-primary/15 text-primary" : "hover:bg-soft"}`}
                >
                  {t.cartPage}
                </button>
              </li>
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
                      <button type="button" onClick={() => { setPagesMenu(false); setOpenedPage(p.id); setProductView(false); setCartView(false); setPanelOpen(true); }} className={`min-w-0 flex-1 truncate px-3 py-2.5 text-start text-sm font-medium ${openedPage === p.id ? "font-bold text-primary" : ""}`}>
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
          {makingPage && <NewPageDialog lang={lang} onClose={() => setMakingPage(false)} onCreated={(id) => { setMakingPage(false); setPagesVersion((v) => v + 1); setOpenedPage(id); setProductView(false); setCartView(false); setPanelOpen(true); }} />}
        </div>
        </div>

        <div className="flex-1" />

        {/* On a phone the bar has no room for the message: a save that was stopped (or a change the tour does not allow) says so
            in a strip under the bar, with the way to the field */}
        {flash === "empty" && (
          <div role="alert" className="absolute inset-x-2 top-full z-40 mt-2 rounded-xl bg-card px-3 py-2 text-xs font-semibold shadow-lg ring-1 ring-fg/10 md:hidden">{emptyAsk}</div>
        )}
        {(flash === "errors" || flash === "full" || flash === "demo" || flash === "themeFail") && (
          <div role="status" className="absolute inset-x-2 top-full z-40 mt-2 flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-semibold shadow-lg ring-1 ring-fg/10 md:hidden">
            {flash === "errors" && attnNow ? (
              <button type="button" onClick={() => showProblem(attnNow)} className="flex min-w-0 flex-1 items-center gap-2 text-start text-rose-700 dark:text-rose-400">
                <span aria-hidden className="h-2 w-2 shrink-0 animate-ping rounded-full bg-rose-500" />
                <span className="min-w-0 flex-1">{t.problems[attnNow.id]}</span>
                <span className="shrink-0 font-bold underline">{t.problemGo}</span>
              </button>
            ) : (
              <span className={`flex-1 ${flash === "demo" ? "text-amber-700 dark:text-amber-300" : "text-rose-600"}`}>
                {flash === "errors" ? t.errorsSave : flash === "full" ? t.errorsStorage : flash === "demo" ? t.demoBlocked : t.themeFail}
              </span>
            )}
            <button type="button" onClick={() => setFlash(null)} aria-label={t.cancel} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-fg/10 hover:text-fg">
              <svg {...ico} className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        )}

        <span aria-live="polite" className="hidden min-w-0 shrink text-xs font-semibold leading-tight md:block">
          {flash === "empty" ? emptyAsk : flash === "theme" ? <span className="text-primary">{t.themeSaved}</span> : flash === "themeFail" ? <span className="text-rose-600">{t.themeFail}</span> : flash === "demo" ? <span className="text-amber-700 dark:text-amber-300">{t.demoBlocked}</span> : flash === "saved" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
              {railIcons.check}
              {live ? <><span className="xl:hidden">{t.saving}</span><span className="hidden xl:inline">{t.savedLive}</span></> : t.saving}
            </span>
          ) : flash === "savedExcept" ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-800 dark:text-amber-300">
              {railIcons.check}
              {tb.savedExcept}
            </span>
          ) : flash === "errors" && attnNow ? (
            <button type="button" onClick={() => showProblem(attnNow)} className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-400">
              <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
              {t.problems[attnNow.id]}
              <span className="font-bold underline">{t.problemGo}</span>
            </button>
          ) : flash === "errors" && problemNow ? <span className="text-rose-600">{t.errorsSave}</span> : flash === "full" ? <span className="text-rose-600">{t.errorsStorage}</span> : problemNow && (problemNow.id === "contact" || problemNow.id === "phone" || problemNow.id === "whatsapp") ? (
            /* a store nobody can reach (no number, or a wrong one) is pointed out all the time, not only after a save */
            <button type="button" onClick={() => showProblem(problemNow)} className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-800 transition hover:bg-amber-500/25 dark:text-amber-300">
              {t.problems[problemNow.id]}
              <span className="font-bold underline">{t.problemGo}</span>
            </button>
          ) : dirty ? (
            /* the longer "customers don't see these yet" only where the bar has room for it */
            <span className="text-amber-600">{live ? <><span className="xl:hidden">{t.unsaved}</span><span className="hidden xl:inline">{t.unsavedLive}</span></> : t.unsaved}</span>
          ) : null}
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
        <div className="flex items-center">
          <button type="button" onClick={() => travel(false)} disabled={readOnly || hist.current.past.length === 0} aria-label={tb.undo} title={tb.undo} className="grid h-9 w-8 place-items-center sm:w-9 rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">
            <span className="rtl:-scale-x-100">{railIcons.undo}</span>
          </button>
          <button type="button" onClick={() => travel(true)} disabled={readOnly || hist.current.future.length === 0} aria-label={tb.redo} title={tb.redo} className="grid h-9 w-8 place-items-center sm:w-9 rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">
            <span className="rtl:-scale-x-100">{railIcons.redo}</span>
          </button>
        </div>
        <button type="button" onClick={save} disabled={!canSave} className={`h-9 shrink-0 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed sm:px-5 ${justSaved ? "bg-emerald-600 text-white" : "bg-ink text-onink hover:bg-deep disabled:opacity-40"}`} aria-label={justSaved ? t.saving : t.save}>
          {/* the only save button, so even on a phone it says what it does (a short word) */}
          <span className="inline-flex items-center gap-1.5 sm:hidden">{justSaved ? railIcons.check : railIcons.save}{justSaved ? t.saving : t.saveShort}</span>
          <span className="hidden sm:inline">{saveLabel}</span>
        </button>

        <div className="relative">
          <button type="button" onClick={() => { setMoreMenu((o) => !o); setPagesMenu(false); setThemeName(null); }} aria-label={t.more} aria-expanded={moreMenu} className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15 transition hover:bg-soft">
            {railIcons.more}
          </button>
          {moreMenu && (
            <div className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-fg/10">
              {sampleChoice && (
                <button type="button" role="switch" aria-checked={sampleChoice.on} onClick={() => sampleChoice.set(!sampleChoice.on)} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft">
                  <span className="min-w-0 flex-1">
                    {SAMPLE_WORDS[lang].label}
                    <span className="mt-0.5 block text-[11px] font-normal text-muted">{SAMPLE_WORDS[lang].hint}</span>
                  </span>
                  <span aria-hidden className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${sampleChoice.on ? "justify-end bg-primary" : "justify-start bg-fg/20"}`}><span className="h-4 w-4 rounded-full bg-white shadow" /></span>
                </button>
              )}
              <button type="button" onClick={() => { setMoreMenu(false); setLang(lang === "ar" ? "en" : "ar"); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft sm:hidden">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></svg>
                {TRANSLATE_WORDS[lang].menu}
              </button>
              <a href={templateMode || mine ? "/store?original=1" : `/store?theme=${originalTheme.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{railIcons.external}{t.starter}</a>
              {!templateMode && !mine && (
                /* the design the store is built on, as it first came, back in the draft: one step Undo can take back, saved only with Save */
                <button
                  type="button"
                  disabled={readOnly}
                  title={readOnly ? t.demoBlocked : undefined}
                  onClick={() => {
                    if (!window.confirm(t.restoreOriginalAsk)) return;
                    setMoreMenu(false);
                    setEditing(null);
                    setSelected(null);
                    update((d) => ({ ...d, config: adoptTheme(d.config, originalTheme.build(lang, { samples: false, storeName: d.identity.name })) }));
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  {railIcons.reset}
                  {t.restoreOriginal}
                </button>
              )}
              {templateMode && (
                <a href="/store?starter=1" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-soft">{railIcons.external}{t.templatePreview}</a>
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
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft"
                >
                  {railIcons.reset}
                  {t.mineReset}
                </button>
              )}
              {themeName === null ? (
                <button type="button" disabled={readOnly} title={readOnly ? t.demoBlocked : undefined} onClick={() => setThemeName(t.themeDefaultName)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">{railIcons.bookmark}{t.saveAsTheme}</button>
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

        {/* The designer's language, the same as the dashboard's: the texts of the store are edited in the language it is in.
            Changing it keeps the changes not saved yet. (On a phone it is in the "more" menu.) */}
        <span className="hidden shrink-0 sm:block"><LangSwitch /></span>

        {!mine && (
        <a href="/preview" target="_blank" rel="noreferrer" aria-label={t.previewBtn} className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-fg/15 px-2.5 text-sm font-semibold transition hover:bg-soft sm:px-3">
          {railIcons.eye}
          <span className="hidden sm:inline lg:hidden xl:inline">{t.previewBtn}</span>
        </a>
        )}

        {/* calm like the buttons beside it (red only under the pointer), with its name where the bar has room */}
        <button ref={exitBtn} type="button" onClick={() => tryExit()} aria-label={t.exit} title={t.exit} className="flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-muted transition hover:bg-rose-500/10 hover:text-rose-600 xl:border xl:border-fg/15 xl:px-3">
          {railIcons.exit}
          <span className="hidden xl:inline">{t.exitShort}</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Icon rail */}
        <nav aria-label={t.title} className="flex shrink-0 items-center gap-2 border-b border-fg/10 bg-card p-2 lg:w-12 lg:flex-col lg:border-b-0 lg:border-e lg:py-3">
          <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? t.rail.collapse : t.rail.expand} title={panelOpen ? t.rail.collapse : t.rail.expand} className="hidden h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-fg/10 hover:text-fg lg:grid">
            {railIcons.collapse}
          </button>
          {railBtn("pages", t.rail.pages, railIcons.pages)}
          {railBtn("options", t.rail.options, railIcons.options)}
          {railBtn("texts", t.rail.texts, railIcons.texts)}
          {/* On a phone or a tablet: the settings or the store, each on the whole screen */}
          <div role="group" aria-label={t.rail.phoneSwitch} className="ms-auto flex shrink-0 rounded-xl border border-fg/15 p-0.5 lg:hidden">
            {([false, true] as const).map((store) => {
              const on = store ? phoneStore || !panelOpen : panelOpen && !phoneStore;
              return (
                <button key={String(store)} type="button" aria-pressed={on} onClick={() => (store ? setPhoneStore(true) : setPanelOpen(true))} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${on ? "bg-ink text-onink" : "text-muted hover:bg-fg/10 hover:text-fg"}`}>
                  {store && railIcons.eye}
                  {store ? t.rail.phonePreview : t.rail.phoneSettings}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Panel. The text color is the one the store draws (an automatic one where his vanishes on the background). */}
        {panelOpen && (
          <TextColorNow.Provider value={legibleOn(draft.config.theme.text, draft.config.theme.background)}>
          <PageLookNow.Provider value={pageLook}>
          <UsingTheme.Provider value={trying?.id ?? usingTheme}>
          <StoreColorNow.Provider value={/^#[0-9a-f]{6}$/i.test(draft.identity.color) ? draft.identity.color : "#004956"}>
          <SampleProducts.Provider value={sampleChoice}>
          <OpenPage.Provider value={(id) => { setOpenedPage(id); setProductView(false); setCartView(false); setPanelOpen(true); }}>
          {/* --sf-heading: the store's titles font, so the font pickers' "like the titles" choice writes in it */}
          <aside className={`relative flex min-h-0 flex-1 flex-col bg-card ${phoneStore ? "max-lg:hidden" : ""} lg:w-[var(--panel-w)] lg:flex-none lg:shrink-0 lg:border-e lg:border-fg/10`} style={{ "--sf-heading": headingFamily(draft.config.theme), "--panel-w": `${panelW}px` } as React.CSSProperties}>
            {/* its edge: drag (or arrow keys) to make the panel wider or narrower, double-click for its usual size */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t.rail.resize}
              title={t.rail.resize}
              aria-valuemin={PANEL_MIN}
              aria-valuemax={PANEL_MAX}
              aria-valuenow={panelW}
              tabIndex={0}
              onPointerDown={startResize}
              onDoubleClick={() => sizePanel(PANEL_W)}
              onKeyDown={(e) => {
                const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
                const step = e.shiftKey ? 64 : 16;
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  sizePanel(panelW + ((e.key === "ArrowRight") !== rtl ? step : -step));
                }
              }}
              className="group absolute inset-y-0 -end-1.5 z-30 hidden w-3 cursor-col-resize touch-none outline-none lg:block"
            >
              <span aria-hidden className="absolute inset-y-0 start-1/2 w-0.5 -translate-x-1/2 bg-primary opacity-0 transition group-hover:opacity-60 group-focus-visible:opacity-100 group-active:opacity-100" />
            </div>
            <div ref={panelBox} className="min-h-0 flex-1 overflow-y-auto">
              {!pic && openedPage !== null && pagePanel && (
                <>
                  {editing === null && <PageEditor lang={lang} id={openedPage} onBack={() => setOpenedPage(null)} onChanged={() => setPagesVersion((v) => v + 1)} />}
                  <PagesPanel lang={lang} draft={viewDraft} update={viewUpdate} editing={editing} setEditing={setEditingView} focus={focus} onlyElements />
                </>
              )}
              {pic && <ProductPicturePanel lang={lang} name={pic.name} image={pic.image} value={pic.focus} onChange={setPicFocus} onBack={() => setPic(null)} blocked={readOnly} onBlocked={blockedNote} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "pages" && <PagesPanel lang={lang} draft={draft} update={update} editing={editing} setEditing={setEditingView} focus={focus} onSub={onSub} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "texts" && <TextsPanel lang={lang} draft={draft} update={update} />}
              {!pic && (openedPage === null || !pagePanel) && tab === "options" && <OptionsPanel lang={lang} draft={draft} update={update} attn={attnNow?.id ?? (productView ? "productPage" : undefined)} />}
            </div>
            {/* What saving does (the one Save button is in the top bar). On a phone or a tablet the round "Bug or idea?" button sits
                at the end of this strip, so the words leave it room. */}
            <div className="shrink-0 border-t border-fg/10 p-3 max-lg:pe-14">
              {(changedIn.en > 0 || changedIn.ar > 0) && (
                /* texts changed in one language only: the other one is still to be written */
                <div role="status" className="mb-2 space-y-1 rounded-lg bg-amber-500/15 px-2.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {changedIn[lang === "ar" ? "en" : "ar"] > 0 && <p>{TRANSLATE_WORDS[lang].there(changedIn[lang === "ar" ? "en" : "ar"])}</p>}
                  {changedIn[lang] > 0 && (
                    <p>
                      {TRANSLATE_WORDS[lang].here(changedIn[lang])}{" "}
                      <button type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="font-bold underline">{TRANSLATE_WORDS[lang].go}</button>
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted">{templateMode ? t.templateNote : live ? t.note : t.noteMine}</p>
            </div>
          </aside>
          </OpenPage.Provider>
          </SampleProducts.Provider>
          </StoreColorNow.Provider>
          </UsingTheme.Provider>
          </PageLookNow.Provider>
          </TextColorNow.Provider>
        )}

        {/* Preview: the store can be made smaller to see it all, and moved around. On a phone or a tablet it gives the screen to the open
            panel; it zooms in on the footer only once it is shown (frameOn), so the footer is in view when he switches to it. */}
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${phone && panelOpen && !phoneStore ? "hidden" : ""}`}>
        <Preview
          lang={lang}
          reveal={reveal}
          frameOn={panelOpen && !pic && !(phone && !phoneStore) && (footerForm || (selected === "footer" && tab === "pages")) ? "footer" : null}
          config={draft.config}
          typing={typing}
          name={draft.identity.name}
          description={draft.identity.description}
          color={colorOk}
          phone={draft.identity.phone}
          selected={selected}
          sample={sample}
          products={tryProducts}
          showPage={openedPage}
          showProduct={productView}
          showCart={cartView}
          showMenu={menuView && tab === "pages"}
          openCart={showCartPage}
          acts={acts}
        />
        </div>
      </div>

      {/* "Bug or idea?": a report or an idea with pictures, sent as a support ticket with its kind and where he was */}
      <BugReport
        lang={lang}
        lift={phone && panelOpen && !phoneStore}
        where={[
          activeTheme || t.themeName,
          openedPage !== null ? storePages.find((p) => p.id === openedPage)?.title ?? t.pages[0] : productView ? t.pages[1] : cartView ? t.cartPage : t.pages[0],
          (() => { const sec = draft.config.sections.find((x) => x.id === (editing ?? selected)); return sec ? t.elements[sec.type] : ""; })(),
        ].filter(Boolean).join(" · ")}
      />

      {exiting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div ref={exitDialog} role="dialog" aria-modal="true" aria-label={t.modal.title} className="dash w-full max-w-sm rounded-3xl bg-card p-6 text-center text-fg shadow-2xl ring-1 ring-fg/10 sm:p-7">
            {/* a soft warning mark, then what happens, then one clear way forward and the two quieter ones under it */}
            <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/15 text-amber-600 ring-8 ring-amber-500/5">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            <h2 className="mt-4 text-lg font-bold">{t.modal.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.modal.body}</p>
            <button type="button" onClick={() => { if (save()) leave(); else setExiting(false); }} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-onink shadow-sm transition hover:bg-deep">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
              {t.modal.saveExit}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" autoFocus onClick={() => setExiting(false)} className="h-11 whitespace-nowrap rounded-xl border border-fg/15 px-3 text-sm font-semibold transition hover:bg-soft">{t.modal.stay}</button>
              <button type="button" onClick={() => { setSaved(JSON.stringify(draft)); leave(); }} className="h-11 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{t.modal.leave}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Acts = Required<Omit<Design, "selected">>;

/**
 * The store in the canvas. It only draws again when what it shows changes, not on every change of the designer around it
 * (a menu, a message, a panel opening). While a text is being typed it follows a moment later: when typing pauses, and at
 * least every quarter of a second, so the side panel keeps up with the keys.
 */
const Preview = memo(function Preview({ lang, reveal, frameOn, config, typing, name, description, color, phone, selected, sample, products, showPage, showProduct, showCart, showMenu, openCart, acts }: {
  lang: Lang;
  reveal: { id: string; n: number } | null;
  frameOn: string | null;
  config: StorefrontConfig;
  typing: boolean;
  name: string;
  description: string;
  color?: string;
  phone: string;
  selected: string | null;
  sample: boolean;
  products?: StoreProduct[];
  showPage: number | null;
  showProduct: boolean;
  showCart: boolean;
  showMenu: boolean;
  openCart: () => void;
  acts: React.MutableRefObject<Acts>;
}) {
  const live = useMemo(() => ({ config, store: { name, description, color, phone } }), [config, name, description, color, phone]);
  const shown = useRef(live);
  const behind = useRef(0); /* when the store started to lag behind the typing */
  const [, catchUp] = useReducer((n: number) => n + 1, 0);
  if (!typing) shown.current = live;
  useEffect(() => {
    if (shown.current === live) return void (behind.current = 0);
    if (!behind.current) behind.current = Date.now();
    const id = setTimeout(() => {
      shown.current = live;
      behind.current = 0;
      catchUp();
    }, Math.max(0, Math.min(120, behind.current + 250 - Date.now())));
    return () => clearTimeout(id);
  }, [live]);

  const now = shown.current;
  const design = useMemo<Design>(
    () => ({ selected, select: (id, field) => acts.current.select(id, field), selectProduct: (p) => acts.current.selectProduct(p), moveBit: (id, key, at) => acts.current.moveBit(id, key, at), editPic: (id, key, at) => acts.current.editPic(id, key, at), reorderChips: (id, from, to) => acts.current.reorderChips(id, from, to), openPage: (id) => acts.current.openPage(id), sampleProducts: (on) => acts.current.sampleProducts(on) }),
    [selected, acts],
  );
  const closeCart = useCallback(() => acts.current.openPage(null), [acts]);
  const store = useMemo(
    () => <StorefrontTheme config={now.config} device="auto" interactive={false} sample={sample} products={products} owner showPage={showPage} showProduct={showProduct} showCart={showCart} showMenu={showMenu} onCartClose={closeCart} onCartOpen={openCart} design={design} store={now.store} />,
    [now, sample, products, showPage, showProduct, showCart, showMenu, closeCart, openCart, design],
  );
  return (
    <Canvas lang={lang} reveal={reveal} frameOn={frameOn}>
      {store}
    </Canvas>
  );
});
