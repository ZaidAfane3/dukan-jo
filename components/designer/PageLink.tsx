"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { editLocked } from "../demoSandbox";
import { picFill } from "../storefront/parts";
import { load as loadPages, pageTemplates, savePages } from "../InfoPages";
import { input } from "./controls";

/* Where a button can lead: a part of this page, a page of the store (one he wrote, or one that starts from a ready template), or a web address.
   A link is stored as plain text: "" (nowhere), the id of a part of the page, "page:5" (a page of the store) or a web address. */

/** Opens a page of the store in the designer (given by the designer around its forms) */
export const OpenPage = createContext<((id: number) => void) | null>(null);

/** The parts of the page being designed (the list is given by the designer around the forms) */
export const LinkTargets = createContext<{ id: string; name: string; /* switched off in Page elements: customers do not see it */ hidden?: boolean; /* shows nothing to customers yet (no reviews, no pictures…) */ empty?: boolean }[]>([]);

const words = {
  en: {
    nowhere: "Nowhere",
    here: "A part of this page",
    pages: "A page of the store",
    web: "A web address",
    webPh: "shop.com",
    newPage: "+ Make a new page…",
    title: "New page",
    start: "Start from",
    pageTitle: "Page title",
    content: "Page text",
    create: "Create the page",
    cancel: "Cancel",
    errTitle: "Write the page title",
    hint: "Write the page title. The page is added to the store and its link to the footer. You write its text after it is made.",
    demo: "Pages cannot be made in the demo",
    full: "The browser has no room to save the page",
    open: "Open this page to design it",
    hidden: "(hidden)",
    empty: "(empty for now)",
    shop: "All products page",
    shopAll: "All products",
    shopCat: (c: string) => `All products: ${c}`,
  },
  ar: {
    nowhere: "لا شيء",
    here: "جزء من هذه الصفحة",
    pages: "صفحة من المتجر",
    web: "عنوان موقع",
    webPh: "shop.com",
    newPage: "+ إنشاء صفحة جديدة…",
    title: "صفحة جديدة",
    start: "ابدأ من",
    pageTitle: "عنوان الصفحة",
    content: "نص الصفحة",
    create: "إنشاء الصفحة",
    cancel: "إلغاء",
    errTitle: "اكتب عنوان الصفحة",
    hint: "اكتب عنوان الصفحة. تُضاف الصفحة إلى المتجر ورابطها إلى التذييل، وتكتب نصها بعد إنشائها.",
    demo: "لا يمكن إنشاء صفحات في النسخة التجريبية",
    full: "لا توجد مساحة في المتصفح لحفظ الصفحة",
    open: "افتح هذه الصفحة لتصميمها",
    hidden: "(مخفي)",
    empty: "(فارغ حاليًا)",
    shop: "صفحة كل المنتجات",
    shopAll: "كل المنتجات",
    shopCat: (c: string) => `كل المنتجات: ${c}`,
  },
};

/** The published pages of the store (read again when the list changes) */
export function useStorePages(lang: Lang, version = 0) {
  const [list, setList] = useState<{ id: number; title: string }[]>([]);
  useEffect(() => {
    const other = lang === "ar" ? "en" : "ar";
    setList(loadPages().filter((p) => p.published).map((p) => ({ id: p.id, title: p.title[lang] || p.title[other] })));
  }, [lang, version]);
  return list;
}

/** The categories of his products (they can be links: the all-products page on that category) */
function useCategories() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem("seen-products") || "[]") as { categories?: unknown; category?: unknown; deletedAt?: unknown }[];
      const seen = new Set<string>();
      for (const p of Array.isArray(all) ? all : []) {
        if (p.deletedAt) continue;
        for (const c of Array.isArray(p.categories) ? p.categories : [p.category]) if (typeof c === "string" && c.trim()) seen.add(c.trim());
      }
      setList(Array.from(seen));
    } catch {
      setList([]);
    }
  }, []);
  return list;
}

/* a category's name from its link; a link that does not decode shows as written instead of breaking the form */
const safeDecode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** One button's destination */
export function LinkPicker({ lang, value, onChange, label, web = true }: { lang: Lang; value: string; onChange: (v: string) => void; label: string; /* false: no "web address" choice (a link he already had still shows) */ web?: boolean }) {
  const w = words[lang];
  const sections = useContext(LinkTargets);
  const openPage = useContext(OpenPage);
  const [version, setVersion] = useState(0);
  const pages = useStorePages(lang, version);
  const [making, setMaking] = useState(false);
  const isPage = /^page:\d+$/.test(value);
  const isShop = /^shop(:.+)?$/.test(value);
  const isSection = sections.some((s) => s.id === value);
  const [webMode, setWebMode] = useState(false);
  const cats = useCategories();
  const kind = value === "" && !webMode ? "" : isPage || isShop ? value : isSection ? `section:${value}` : "web";
  /* a category's link: its name written as a link part (Arabic letters and spaces stay safe) */
  const catLink = (c: string) => `shop:${encodeURIComponent(c)}`;

  return (
    <div className="space-y-2">
      <select
        aria-label={label}
        value={kind}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__new") return setMaking(true);
          setWebMode(v === "web");
          if (v === "web") onChange(isPage || isShop || isSection ? "" : value);
          else onChange(v.startsWith("section:") ? v.slice(8) : v);
        }}
        className={`${input} h-10`}
      >
        <option value="">{w.nowhere}</option>
        {/* only the parts customers see; a hidden one stays listed (marked) while a link already leads there */}
        {sections.some((s) => !(s.hidden || s.empty) || s.id === value) && (
          <optgroup label={w.here}>
            {sections.filter((s) => !(s.hidden || s.empty) || s.id === value).map((s) => (
              <option key={s.id} value={`section:${s.id}`}>{s.hidden ? `${s.name} ${w.hidden}` : s.empty ? `${s.name} ${w.empty}` : s.name}</option>
            ))}
          </optgroup>
        )}
        <optgroup label={w.shop}>
          <option value="shop">{w.shopAll}</option>
          {cats.map((c) => (
            <option key={c} value={catLink(c)}>{w.shopCat(c)}</option>
          ))}
          {/* a category he linked before that no product has any more still shows, so the choice is not lost */}
          {isShop && value !== "shop" && !cats.some((c) => catLink(c) === value) && <option value={value}>{w.shopCat(safeDecode(value.slice(5)))}</option>}
        </optgroup>
        <optgroup label={w.pages}>
          {pages.map((p) => (
            <option key={p.id} value={`page:${p.id}`}>{p.title}</option>
          ))}
          <option value="__new">{w.newPage}</option>
        </optgroup>
        {(web || kind === "web") && <option value="web">{w.web}</option>}
      </select>
      {isPage && openPage && (
        <button type="button" onClick={() => openPage(Number(value.slice(5)))} className="text-xs font-semibold text-primary hover:underline">{w.open}</button>
      )}
      {kind === "web" && <input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder={w.webPh} aria-label={w.web} maxLength={160} className={`${input} h-10 text-start`} />}
      {making && (
        <NewPageDialog
          lang={lang}
          onClose={() => setMaking(false)}
          onCreated={(id) => {
            setVersion((v) => v + 1);
            setMaking(false);
            setWebMode(false);
            onChange(`page:${id}`);
          }}
        />
      )}
    </div>
  );
}

/** Makes a page of the store: he picks a ready page to start from, then writes its title and text */
export function NewPageDialog({ lang, onClose, onCreated }: { lang: Lang; onClose: () => void; onCreated: (id: number) => void }) {
  const w = words[lang];
  const other = lang === "ar" ? "en" : "ar";
  const [tpl, setTpl] = useState(pageTemplates[0]);
  const [title, setTitle] = useState(pageTemplates[0].title[lang]);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = () => {
    if (editLocked()) return setError(w.demo);
    if (!title.trim()) return setError(w.errTitle);
    const list = loadPages();
    const id = list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    /* Untouched, the ready page keeps both of its languages; written by him, the text is in the language he wrote it in */
    const same = title === tpl.title[lang];
    const page = {
      id,
      type: 0 as const,
      published: true,
      footer: true,
      title: same ? tpl.title : ({ [lang]: title.trim(), [other]: "" } as { en: string; ar: string }),
      content: tpl.content,
      created: Date.now(),
    };
    if (!savePages([page, ...list])) return setError(w.full);
    /* the store preview reads its pages again */
    window.dispatchEvent(new Event("storage"));
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={w.title} className="dash max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
        <h2 className="text-lg font-bold">{w.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{w.hint}</p>

        <p className="mt-4 text-sm font-semibold">{w.start}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pageTemplates.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={tpl.id === p.id}
              onClick={() => {
                setTpl(p);
                setTitle(p.title[lang]);
                setError("");
              }}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${tpl.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}
            >
              {p.name[lang]}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold">
          {w.pageTitle}
          <input value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} maxLength={60} className={`${input} mt-1.5 h-11`} />
        </label>

        {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={create} className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:opacity-90">{w.create}</button>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Moving a picture inside its frame ---------------- */

const moveWords = {
  en: { hint: "Drag the picture inside the frame, and use the slider to zoom.", zoom: "Zoom", reset: "Put it back in the middle" },
  ar: { hint: "اسحب الصورة داخل الإطار، واستخدم الشريط للتكبير والتصغير.", zoom: "التكبير", reset: "إرجاعها إلى الوسط" },
};

/** The frame a picture is shown in, drawn at a small size: he pulls the picture with the mouse (or a finger) to where it fits */
export function PictureMover({ lang, image, value, onChange, ratio, radius, fill = false, video = false }: { lang: Lang; image: string; /* `image` is a looping video (the page background): it is moved the same way */ video?: boolean; value?: { x: number; y: number; zoom: number }; /* the picture always fills its frame: it pans and zooms in, never leaving a gap */ fill?: boolean; onChange: (v: { x: number; y: number; zoom: number }) => void; ratio: string; radius: string }) {
  const w = moveWords[lang];
  const v = value ?? { x: 0, y: 0, zoom: 1 };
  const grab = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const lim = fill ? 50 : 90;
  const clamp = (n: number) => Math.round(Math.max(-lim, Math.min(lim, n)));
  if (!image) return null;
  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-muted">{w.hint}</p>
      <div
        className="relative mx-auto w-44 touch-none select-none overflow-hidden bg-soft ring-2 ring-primary/40"
        style={{ aspectRatio: ratio, borderRadius: radius, cursor: grab.current ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          grab.current = { px: e.clientX, py: e.clientY, x: v.x, y: v.y };
        }}
        onPointerMove={(e) => {
          const g = grab.current;
          if (!g) return;
          const r = e.currentTarget.getBoundingClientRect();
          onChange({ ...v, x: clamp(g.x + ((e.clientX - g.px) / r.width) * 100), y: clamp(g.y + ((e.clientY - g.py) / r.height) * 100) });
        }}
        onPointerUp={() => (grab.current = null)}
        onPointerCancel={() => (grab.current = null)}
      >
        {video ? (
          <video src={image} muted loop autoPlay playsInline draggable={false} className="pointer-events-none h-full w-full object-cover" style={fill ? picFill(v) : { transform: `translate(${v.x}%, ${v.y}%) scale(${v.zoom})` }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" draggable={false} className="h-full w-full object-cover" style={fill ? picFill(v) : { transform: `translate(${v.x}%, ${v.y}%) scale(${v.zoom})` }} />
        )}
      </div>
      <label className="flex items-center gap-3 text-xs font-semibold text-fg/80">
        {w.zoom}
        <input type="range" min={fill ? 100 : 50} max={300} value={Math.round(v.zoom * 100)} onChange={(e) => onChange({ ...v, zoom: Number(e.target.value) / 100 })} className="h-2 flex-1 accent-primary" />
        <span className="w-10 text-end tabular-nums" dir="ltr">{Math.round(v.zoom * 100)}%</span>
      </label>
      {(v.x !== 0 || v.y !== 0 || v.zoom !== 1) && (
        <button type="button" onClick={() => onChange({ x: 0, y: 0, zoom: 1 })} className="text-sm font-semibold text-primary hover:underline">{w.reset}</button>
      )}
    </div>
  );
}
