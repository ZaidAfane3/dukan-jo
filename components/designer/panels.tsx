"use client";

import { useEffect, useRef, useState } from "react";
import { latin } from "../digits";
import type { Lang } from "../content";
import { defaultConfig, fontFamily, heroTitleFamily, newBanners, newCollection, newRibbon, newSlides, newTextSection, newTiles, type Banner, type DisplayFont, type HeroBg, type PatternKey, type HeroFont, type ThemeFont, type Tile, type Slide, type MarkKey, type Perk, type Review, type PerkIcon, type SectionConfig, type SectionType, type StorefrontConfig } from "../storefront/config";
import { icons as storeIcons, LogoMark, markKeys, onColor, resolveLogo, sampleMarks } from "../storefront/parts";
import { demoActive } from "../demoSandbox";
import { loadSetup } from "../setup";
import { patterns } from "../storefront/patterns";
import { FocusPicker, type Focus as PicFocus } from "../FocusPicker";
import { readLogo, readPhoto } from "./image";
import { readProducts } from "../storefront/useStoreData";
import { deleteMedia, putMedia, useMediaUrl } from "../storefront/mediaStore";
import { ColorPicker, Field, input, SecondsPicker, Toggle } from "./controls";
import { dc, sampleTexts } from "./copy";

export type Identity = { name: string; description: string; color: string; phone: string };
export type Draft = { config: StorefrontConfig; identity: Identity };
export type Update = (fn: (d: Draft) => Draft) => void;
export type Focus = { id: string; field?: string; n: number } | null;

const icon = { viewBox: "0 0 24 24", className: "h-[18px] w-[18px]", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const ic = {
  edit: <svg {...icon}><path d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4ZM14 6l4 4" /></svg>,
  eye: <svg {...icon}><path d="M2 12s3.500-6 10-6 10 6 10 6-3.500 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.500" /></svg>,
  eyeOff: <svg {...icon}><path d="M3 3l18 18M10.600 6.100A10 10 0 0 1 12 6c6.500 0 10 6 10 6a17 17 0 0 1-3.200 3.800M6.300 7.800A16 16 0 0 0 2 12s3.500 6 10 6c1.300 0 2.500-.3 3.600-.7" /></svg>,
  up: <svg {...icon}><path d="m6 15 6-6 6 6" /></svg>,
  down: <svg {...icon}><path d="m6 9 6 6 6-6" /></svg>,
  copy: <svg {...icon}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  trash: <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  plus: <svg {...icon}><path d="M12 5v14M5 12h14" /></svg>,
  back: <svg {...icon} className="h-5 w-5 rtl:rotate-180"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  more: <svg {...icon}><circle cx="5" cy="12" r="1.200" /><circle cx="12" cy="12" r="1.200" /><circle cx="19" cy="12" r="1.200" /></svg>,
  gear: <svg {...icon}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.800l-.4 2.700a7 7 0 0 0-2 1.200l-2.300-1-2 3.400 2 1.500a7 7 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-1a7 7 0 0 0 2 1.200l.4 2.700h4.400l.4-2.700a7 7 0 0 0 2-1.200l2.300 1 2-3.400-2-1.500c.1-.4.1-.8.1-1.200Z" /></svg>,
  megaphone: <svg {...icon}><path d="M4 10v4h3l7 4V6l-7 4H4ZM17 9a4 4 0 0 1 0 6" /></svg>,
  headset: <svg {...icon}><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM20 14h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" /></svg>,
  badge: <svg {...icon}><path d="M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  share: <svg {...icon}><circle cx="6" cy="12" r="2.500" /><circle cx="18" cy="6" r="2.500" /><circle cx="18" cy="18" r="2.500" /><path d="m8.200 10.800 7.600-3.600M8.200 13.200l7.600 3.600" /></svg>,
  chevron: <svg {...icon} className="h-4 w-4"><path d="m6 9 6 6 6-6" /></svg>,
  close: <svg {...icon}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  search: <svg {...icon}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></svg>,
  types: {
    hero: <svg {...icon}><rect x="3" y="5" width="18" height="11" rx="3" /><path d="M7 20h10" /></svg>,
    perks: <svg {...icon}><rect x="3" y="6" width="5" height="12" rx="1.500" /><rect x="10" y="6" width="5" height="12" rx="1.500" /><rect x="17" y="6" width="4" height="12" rx="1.500" /></svg>,
    featured: <svg {...icon}><path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" /></svg>,
    discounts: <svg {...icon}><path d="M4 12 12 4h8v8l-8 8-8-8Z" /><circle cx="15.500" cy="8.500" r="1" /></svg>,
    text: <svg {...icon}><path d="M5 6h14M5 11h14M5 16h9" /></svg>,
    reviews: <svg {...icon}><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-1-2V6Z" /><path d="m9 10 1.500 1.500L14 8" /></svg>,
    slides: <svg {...icon}><rect x="3" y="6" width="18" height="12" rx="2.500" /><path d="m3 15 5-4 4 3 3-2 6 4M8.500 9.500h.01" /></svg>,
    tiles: <svg {...icon}><rect x="3" y="4" width="5" height="16" rx="1.500" /><rect x="9.500" y="4" width="5" height="16" rx="1.500" /><rect x="16" y="4" width="5" height="16" rx="1.500" /></svg>,
    banners: <svg {...icon}><rect x="3" y="4" width="18" height="16" rx="2.500" /><path d="M7 14h6M7 10h9" /></svg>,
    ribbon: <svg {...icon}><rect x="2.500" y="8" width="19" height="8" rx="1.500" /><path d="M7 12h.01M12 12h.01M17 12h.01" /></svg>,
    collection: <svg {...icon}><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z" /></svg>,
    products: <svg {...icon}><rect x="4" y="4" width="7" height="7" rx="1.500" /><rect x="13" y="4" width="7" height="7" rx="1.500" /><rect x="4" y="13" width="7" height="7" rx="1.500" /><rect x="13" y="13" width="7" height="7" rx="1.500" /></svg>,
  } satisfies Record<SectionType, React.ReactNode>,
};

const noText = { en: "", ar: "" };

/** How many texts of the store are written in `from` but have nothing in the other language yet. */
function missingTexts(cfg: StorefrontConfig, from: Lang): number {
  const other = from === "ar" ? "en" : "ar";
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 2 && typeof o.en === "string" && typeof o.ar === "string") {
        if (String(o[from]).trim() && !String(o[other]).trim()) n++;
        return;
      }
      keys.forEach((k) => walk(o[k]));
    }
  };
  walk({ sections: cfg.sections, announcement: cfg.announcement, nav: cfg.nav, texture: cfg.texture, footer: cfg.footer });
  return n;
}

/** A row of choices: one is on. */
function Seg<T extends string>({ value, options, onChange, cols = 2 }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${value === o.key ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The color of one text: a swatch that opens the color picker, and a way back to the automatic color. */
function ColorChip({ lang, label, value, onChange, onReset }: { lang: Lang; label: string; value: string | undefined; onChange: (v: string) => void; onReset: () => void }) {
  const lx = dc[lang].luxe;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-fg/80">{label}</span>
      <div className="flex items-center gap-2" dir="ltr">
        {value && <button type="button" onClick={onReset} className="text-xs font-semibold text-primary hover:underline">{lx.sizeReset}</button>}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-fg/15 px-2 py-1 transition hover:bg-soft">
          <input type="color" value={value || "#1c1a17"} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
          <span className="min-w-[4.5rem] text-xs font-bold uppercase tabular-nums">{value || lx.colorAuto}</span>
        </label>
      </div>
    </div>
  );
}

/** A text size with a - and a + (2 px at a time), and a way back to the theme's own size. */
function Stepper({ lang, label, value, auto, onChange, onReset, min = 10, max = 160 }: { lang: Lang; label: string; value: number; auto: boolean; onChange: (v: number) => void; onReset: () => void; min?: number; max?: number }) {
  const lx = dc[lang].luxe;
  const go = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  const btn = "grid h-8 w-8 place-items-center rounded-lg border border-fg/15 text-base font-bold transition hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-fg/80">{label}</span>
      <div className="flex items-center gap-1.5" dir="ltr">
        {!auto && <button type="button" onClick={onReset} className="me-1 text-xs font-semibold text-primary hover:underline">{lx.sizeReset}</button>}
        <button type="button" className={btn} disabled={value <= min} onClick={() => go(-2)} aria-label={lx.sizeSmaller} title={lx.sizeSmaller}>−</button>
        <span className="w-12 text-center text-sm font-bold tabular-nums">{value}px</span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => go(2)} aria-label={lx.sizeBigger} title={lx.sizeBigger}>+</button>
      </div>
    </div>
  );
}

const roundBtnSm = "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";
const menuBtn = "flex items-center gap-1.5 rounded-md border border-fg/15 px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-soft hover:text-fg";
const roundBtn = "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";

/* ------------------------------------------------------------------ */

function Accordion({ title, info, open, onToggle, children }: { title: string; info: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="border-b border-fg/10">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start">
        <span className="text-sm font-bold text-black dark:text-white">{title}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-full border border-fg/15 text-muted transition-transform ${open ? "rotate-180" : ""}`}>{ic.chevron}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="mb-3 text-xs leading-relaxed text-muted">{info}</p>
          {children}
        </div>
      )}
    </section>
  );
}

const newId = (type: string) => `${type}-${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`;

function defaultSection(type: SectionType, lang: Lang): SectionConfig {
  if (type === "text") return newTextSection(newId("text"));
  if (type === "collection") return newCollection(newId("collection"));
  if (type === "slides") return newSlides(newId("slides"));
  if (type === "tiles") return newTiles(newId("tiles"));
  if (type === "banners") return newBanners(newId("banners"));
  if (type === "ribbon") return newRibbon(newId("ribbon"));
  const base = defaultConfig.sections.find((s) => s.type === type);
  const copy = base ? (JSON.parse(JSON.stringify(base)) as SectionConfig) : (null as never);
  copy.id = newId(type);
  copy.visible = true;
  void lang;
  return copy;
}

/* ------------------------------------------------------------------ */
/*  Store pages: header, page elements, footer                         */
/* ------------------------------------------------------------------ */

export function PagesPanel({ lang, draft, update, editing, setEditing, focus }: { lang: Lang; draft: Draft; update: Update; editing: string | null; setEditing: (id: string | null) => void; focus: Focus }) {
  const t = dc[lang];
  const [open, setOpen] = useState({ header: false, elements: true, footer: false });
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sub, setSub] = useState<SubKey | null>(null);
  const cfg = draft.config;

  /* Clicking the header or footer in the preview opens that group here. */
  useEffect(() => {
    if (focus?.id === "header") {
      setOpen({ header: true, elements: false, footer: false });
      setSub(null);
    }
    if (focus?.id === "announcement") {
      setOpen({ header: true, elements: false, footer: false });
      setSub("announcement");
    }
    if (focus?.id === "footer") {
      setOpen({ header: false, elements: false, footer: true });
      setSub(null);
    }
  }, [focus]);

  const setCfg = (fn: (c: StorefrontConfig) => StorefrontConfig) => update((d) => ({ ...d, config: fn(d.config) }));
  const setSections = (fn: (s: SectionConfig[]) => SectionConfig[]) => setCfg((c) => ({ ...c, sections: fn(c.sections) }));

  const move = (i: number, dir: -1 | 1) =>
    setSections((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const dropOn = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      setSections((all) => {
        const from = all.findIndex((x) => x.id === dragId);
        const to = all.findIndex((x) => x.id === targetId);
        if (from < 0 || to < 0) return all;
        const n = [...all];
        const [item] = n.splice(from, 1);
        n.splice(to, 0, item);
        return n;
      });
    }
    setDragId(null);
    setOverId(null);
  };

  if (editing) {
    const s = cfg.sections.find((x) => x.id === editing);
    if (s) return <ElementForm lang={lang} section={s} focusField={focus?.id === s.id ? focus.field : undefined} nonce={focus?.n ?? 0} onBack={() => setEditing(null)} onChange={(next) => setSections((all) => all.map((x) => (x.id === s.id ? next : x)))} onDelete={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setEditing(null); }} />;
  }

  if (sub) {
    return (
      <SubShell lang={lang} title={t.rows[sub]} onBack={() => setSub(null)}>
        {sub === "headerSettings" && <HeaderSettingsForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "announcement" && <AnnouncementForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "footerSettings" && <FooterSettingsForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "service" && <ServiceForm lang={lang} draft={draft} update={update} />}
        {sub === "certificate" && <CertificateForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "social" && <SocialForm lang={lang} cfg={cfg} setCfg={setCfg} />}
      </SubShell>
    );
  }

  return (
    <div>
      <Accordion title={t.sectionsTitle.header} info={t.sectionsInfo.header} open={open.header} onToggle={() => setOpen((o) => ({ ...o, header: !o.header }))}>
        <ul>
          <RowLink icon={ic.gear} label={t.rows.headerSettings} onClick={() => setSub("headerSettings")} />
          <RowLink icon={ic.megaphone} label={t.rows.announcement} onClick={() => setSub("announcement")} badge={cfg.announcement.show} />
        </ul>
      </Accordion>


      <Accordion title={t.sectionsTitle.elements} info={t.sectionsInfo.elements} open={open.elements} onToggle={() => setOpen((o) => ({ ...o, elements: !o.elements }))}>
        <ul className="space-y-1.5">
          {cfg.sections.map((s, i) => (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => {
                setDragId(s.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(s.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(s.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`relative rounded-lg border bg-card transition ${overId === s.id && dragId && dragId !== s.id ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragId === s.id ? "opacity-40" : s.visible ? "" : "opacity-55"}`}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <span aria-hidden title={t.actions.drag} className="grid h-7 w-5 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-soft text-primary">{ic.types[s.type]}</span>
                <button type="button" onClick={() => setEditing(s.id)} className="flex min-w-0 flex-1 items-center gap-1.5 px-1 text-start text-sm font-semibold">
                  <span className="truncate">{t.elements[s.type]}</span>
                  {!s.visible && <span className="shrink-0 text-muted">{ic.eyeOff}</span>}
                </button>
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t.actions.up} title={t.actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === cfg.sections.length - 1} onClick={() => move(i, 1)} aria-label={t.actions.down} title={t.actions.down}>{ic.down}</button>
                <button type="button" className={roundBtnSm} onClick={() => setMenuId(menuId === s.id ? null : s.id)} aria-expanded={menuId === s.id} aria-label={t.more} title={t.more}>{ic.more}</button>
              </div>

              {menuId === s.id && (
                <div className="flex flex-wrap gap-1 border-t border-fg/10 px-2 py-1.5">
                  <button type="button" onClick={() => { setEditing(s.id); setMenuId(null); }} className={menuBtn}>{ic.edit}{t.actions.edit}</button>
                  <button type="button" onClick={() => { setSections((all) => all.map((x) => (x.id === s.id ? ({ ...x, visible: !x.visible } as SectionConfig) : x))); setMenuId(null); }} className={menuBtn}>{s.visible ? ic.eyeOff : ic.eye}{s.visible ? t.actions.hide : t.actions.show}</button>
                  <button type="button" onClick={() => { setSections((all) => { const n = [...all]; n.splice(i + 1, 0, { ...(JSON.parse(JSON.stringify(s)) as SectionConfig), id: newId(s.type) }); return n; }); setMenuId(null); }} className={menuBtn}>{ic.copy}{t.actions.duplicate}</button>
                  <button type="button" onClick={() => { setConfirm(s.id); setMenuId(null); }} className={`${menuBtn} hover:!text-rose-600`}>{ic.trash}{t.actions.delete}</button>
                </div>
              )}

              {confirm === s.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-b-lg bg-rose-500/10 px-3 py-2">
                  <span className="text-xs text-rose-700 dark:text-rose-400">{t.deleteAsk}</span>
                  <button type="button" onClick={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setConfirm(null); }} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white">{t.deleteYes}</button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-fg/20 px-3 py-1 text-xs font-semibold">{t.cancel}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setPicker(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
          {ic.plus}
          {t.actions.add}
        </button>
      </Accordion>

      <Accordion title={t.sectionsTitle.footer} info={t.sectionsInfo.footer} open={open.footer} onToggle={() => setOpen((o) => ({ ...o, footer: !o.footer }))}>
        <ul>
          <RowLink icon={ic.gear} label={t.rows.footerSettings} onClick={() => setSub("footerSettings")} />
          <RowLink icon={ic.headset} label={t.rows.service} onClick={() => setSub("service")} />
          <RowLink icon={ic.badge} label={t.rows.certificate} onClick={() => setSub("certificate")} badge={!!cfg.footer.certificate.number.trim()} />
          <RowLink icon={ic.share} label={t.rows.social} onClick={() => setSub("social")} />
        </ul>
      </Accordion>

      {picker && (
        <Picker
          lang={lang}
          onClose={() => setPicker(false)}
          onPick={(type) => {
            const s = defaultSection(type, lang);
            setSections((all) => [...all, s]);
            setPicker(false);
            setEditing(s.id);
          }}
        />
      )}
    </div>
  );
}

function Picker({ lang, onClose, onPick }: { lang: Lang; onClose: () => void; onPick: (t: SectionType) => void }) {
  const t = dc[lang];
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const types = (Object.keys(t.elements) as SectionType[]).filter((k) => t.elements[k].toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t.picker.title} className="dash w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.picker.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.picker.close} className={roundBtn}>{ic.close}</button>
        </div>
        <label className="relative mt-4 block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">{ic.search}</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.picker.search} aria-label={t.picker.search} className={`${input} h-11 ps-11`} />
        </label>
        {types.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t.picker.none}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {types.map((k) => (
              <li key={k}>
                <button type="button" onClick={() => onPick(k)} className="flex h-full w-full flex-col items-center gap-3 rounded-2xl border border-fg/15 p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-soft text-primary">{ic.types[k]}</span>
                  {t.elements[k]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ElementForm({ lang, section, focusField, nonce, onBack, onChange, onDelete }: { lang: Lang; section: SectionConfig; focusField?: string; nonce: number; onBack: () => void; onChange: (s: SectionConfig) => void; onDelete: () => void }) {
  const t = dc[lang];
  /* The delete button at the bottom of the form asks once before it deletes */
  const [asking, setAsking] = useState(false);
  const askBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /* The question opens at the very bottom: bring it into view so he does not have to look for it */
    if (asking) askBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [asking]);
  const s = section;

  /* Opened by clicking a part of the store: put the cursor in that part's field. */
  useEffect(() => {
    if (!focusField) return;
    const id = setTimeout(() => (document.querySelector(`[data-field="${focusField}"]`) as HTMLElement | null)?.focus(), 60);
    return () => clearTimeout(id);
  }, [focusField, nonce, section.id]);
  const text = (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area = false, field?: string) => (
    <Field label={label}>
      {area ? (
        <textarea data-field={field} value={v[lang]} onChange={(e) => set({ ...v, [lang]: e.target.value })} rows={area ? 6 : 3} maxLength={600} className={`${input} resize-y py-3`} />
      ) : (
        <input data-field={field} value={v[lang]} onChange={(e) => set({ ...v, [lang]: e.target.value })} maxLength={60} className={`${input} h-11`} />
      )}
    </Field>
  );

  let body: React.ReactNode;
  if (s.type === "hero") {
    const split = s.settings.layout === "split";
    const full = !!s.settings.fullWidth;
    const defaults = { title: split ? (full ? 100 : 48) : 36, subtitle: split ? (full ? 24 : 15) : 15, eyebrow: 34, price: 26, detail: 13, button: split ? 15 : 14 };
    type HeroKey = keyof typeof defaults;
    const setSize = (key: HeroKey, v: number | undefined) => onChange({ ...s, settings: { ...s.settings, sizes: { ...(s.settings.sizes ?? {}), [key]: v } } });
    const stepper = (key: HeroKey) => (
      <Stepper lang={lang} label={t.luxe.textSize} value={s.settings.sizes?.[key] ?? defaults[key]} auto={s.settings.sizes?.[key] === undefined} onChange={(v) => setSize(key, v)} onReset={() => setSize(key, undefined)} />
    );
    const setColor = (key: HeroKey, v: string | undefined) => onChange({ ...s, settings: { ...s.settings, colors: { ...(s.settings.colors ?? {}), [key]: v } } });
    const colorChip = (key: HeroKey) => (
      <ColorChip lang={lang} label={t.luxe.textColor} value={s.settings.colors?.[key]} onChange={(v) => setColor(key, v)} onReset={() => setColor(key, undefined)} />
    );
    const withSize = (node: React.ReactNode, key: HeroKey) => (
      <div className="space-y-2">
        {node}
        {stepper(key)}
        {colorChip(key)}
      </div>
    );
    body = (
      <>
        {withSize(text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title, false, "title"), "title")}
        <Field label={t.luxe.titleFont}>
          <div className="grid grid-cols-2 gap-2">
            {(["", "readex", "plex", "elegant", "cairo", "tajawal", "ruqaa", "lemonada", "amiri"] as HeroFont[]).map((k) => {
              const on = (s.settings.titleFont ?? "") === k;
              const name = k === "" ? t.luxe.fontDefault : k === "ruqaa" ? t.luxe.fontRuqaa : k === "lemonada" ? t.luxe.fontLemonada : k === "amiri" ? t.luxe.fontAmiri : t.options.fonts[k];
              return (
                <button key={k || "same"} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, titleFont: k } })} aria-pressed={on} className={`rounded-xl border px-3 py-2.5 text-start transition ${on ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                  <span className="block truncate text-base font-bold leading-snug" style={{ fontFamily: heroTitleFamily(k) }}>{t.options.fontSample}</span>
                  <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
                </button>
              );
            })}
          </div>
        </Field>
        {withSize(text(s.settings.subtitle, (subtitle) => onChange({ ...s, settings: { ...s.settings, subtitle } }), t.form.subtitle, true, "subtitle"), "subtitle")}
        {withSize(text(s.settings.button, (button) => onChange({ ...s, settings: { ...s.settings, button } }), t.form.button, false, "button"), "button")}
        <Field label={t.form.heroLayout}>
          <div className="grid grid-cols-2 gap-2">
            {(["banner", "split"] as const).map((k) => (
              <button key={k} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, layout: k } })} aria-pressed={(s.settings.layout ?? "banner") === k} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${(s.settings.layout ?? "banner") === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                {k === "banner" ? t.form.layoutBanner : t.form.layoutSplit}
              </button>
            ))}
          </div>
        </Field>
        {s.settings.layout === "split" && (
          <div className="space-y-3 rounded-xl bg-soft/70 p-3">
            <p className="text-xs leading-relaxed text-muted">{t.form.heroPhotoHint}</p>
            <PhotoPicker lang={lang} value={s.settings.photo ?? ""} onChange={(photo) => onChange({ ...s, settings: { ...s.settings, photo } })} max={1200} />
            <Field label={t.form.heroPhotoSide}>
              <div className="grid grid-cols-2 gap-2">
                {(["start", "end"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, photoSide: k } })} aria-pressed={(s.settings.photoSide ?? "start") === k} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${(s.settings.photoSide ?? "start") === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                    {k === "start" ? t.form.sideStart : t.form.sideEnd}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}
        {s.settings.layout === "split" && (
          <div className="space-y-4 rounded-xl bg-soft/70 p-3">
            {withSize(text(s.settings.eyebrow ?? noText, (eyebrow) => onChange({ ...s, settings: { ...s.settings, eyebrow } }), t.luxe.heroEyebrow, false, "eyebrow"), "eyebrow")}
            <Field label={t.luxe.heroPrice}>
              <input data-field="price" value={s.settings.price ?? ""} onChange={(e) => onChange({ ...s, settings: { ...s.settings, price: e.target.value } })} maxLength={30} className={`${input} h-11`} />
              <div className="mt-2 space-y-2">{stepper("price")}{colorChip("price")}</div>
            </Field>
            {withSize(text(s.settings.size ?? noText, (size) => onChange({ ...s, settings: { ...s.settings, size } }), t.luxe.heroSize), "detail")}
            {text(s.settings.button2 ?? noText, (button2) => onChange({ ...s, settings: { ...s.settings, button2 } }), t.luxe.heroButton2, false, "button2")}
          </div>
        )}
        {/* The backgrounds and the product cards belong to the plain banner. In the photo-beside-text layout the panel color above is the color. */}
        {s.settings.layout !== "split" && <HeroBackgrounds lang={lang} settings={s.settings} onChange={(settings) => onChange({ ...s, settings })} />}
        {s.settings.layout !== "split" && <Toggle on={s.settings.showCards ?? true} onChange={(showCards) => onChange({ ...s, settings: { ...s.settings, showCards } })} label={t.form.showCards} />}
      </>
    );
  } else if (s.type === "featured" || s.type === "discounts") {
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } } as SectionConfig), t.form.title)}
        <Field label={t.form.count}>
          <div className="flex gap-2">
            {[2, 3, 4, 6, 8].map((n) => (
              <button key={n} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, count: n } } as SectionConfig)} aria-pressed={s.settings.count === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.count === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                {n}
              </button>
            ))}
          </div>
        </Field>
      </>
    );
  } else if (s.type === "products") {
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title)}
        <Field label={t.form.columns}>
          <div className="flex gap-2">
            {([2, 3, 4] as const).map((n) => (
              <button key={n} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, columns: n } })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t.luxe.limit}>
          <Seg value={String(s.settings.limit ?? 0)} cols={4} onChange={(v) => onChange({ ...s, settings: { ...s.settings, limit: Number(v) } })} options={[0, 4, 8, 12].map((n) => ({ key: String(n), label: n === 0 ? t.luxe.limitAll : String(n) }))} />
        </Field>
        <Toggle on={s.settings.showFilters} onChange={(showFilters) => onChange({ ...s, settings: { ...s.settings, showFilters } })} label={t.form.filters} />
      </>
    );
  } else if (s.type === "slides") {
    body = <SlidesForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "tiles") {
    body = <TilesForm lang={lang} s={s} onChange={onChange} text={text} />;
  } else if (s.type === "banners") {
    body = <BannersForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "ribbon") {
    body = <RibbonForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "collection") {
    body = <CollectionForm lang={lang} s={s} onChange={onChange} text={text} />;
  } else if (s.type === "reviews") {
    const items = s.settings.items ?? [];
    const setItem = (i: number, patch: Partial<Review>) => onChange({ ...s, settings: { ...s.settings, items: items.map((r, j) => (j === i ? { ...r, ...patch } : r)) } });
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title, false, "title")}
        <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.form.reviewsHint}</p>
        {items.map((r, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-center gap-2">
              <input value={r.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t.form.reviewName} aria-label={t.form.reviewName} maxLength={40} className={`${input} h-10 flex-1`} />
              <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })} aria-label={t.form.removeReview} title={t.form.removeReview} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
            </div>
            <textarea value={r.text} onChange={(e) => setItem(i, { text: e.target.value })} placeholder={t.form.reviewText} aria-label={t.form.reviewText} rows={3} maxLength={240} className={`${input} resize-none py-2.5`} />
            <div className="flex items-center gap-1" role="group" aria-label={t.form.reviewStars}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} type="button" onClick={() => setItem(i, { stars: n })} aria-label={`${n}`} aria-pressed={r.stars === n} className="p-0.5">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={n <= r.stars ? "#f5b301" : "#d1d5db"} aria-hidden>
                    <path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length < 12 && (
          <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { name: "", text: "", stars: 5 }] } })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.form.addReview}
          </button>
        )}
      </>
    );
  } else if (s.type === "text") {
    const set = (patch: Partial<typeof s.settings>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
    body = (
      <>
        {text(s.settings.title, (title) => set({ title }), t.form.title, false, "title")}
        {text(s.settings.body, (b) => set({ body: b }), t.form.body, true, "body")}
        <Field label={t.form.align}>
          <div className="flex gap-2">
            {(["start", "center"] as const).map((a) => (
              <button key={a} type="button" onClick={() => set({ align: a })} aria-pressed={s.settings.align === a} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.align === a ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                {a === "start" ? t.form.alignStart : t.form.alignCenter}
              </button>
            ))}
          </div>
        </Field>
        <Toggle on={s.settings.tint} onChange={(tint) => set({ tint })} label={t.form.tint} />
        <Field label={t.form.samples} hint={t.form.samplesHint}>
          <ul className="space-y-2">
            {sampleTexts.map((x) => (
              <li key={x.name.en}>
                <button type="button" onClick={() => set({ title: x.title, body: x.body })} className="w-full rounded-xl border border-fg/15 px-4 py-2.5 text-start text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                  {x.name[lang]}
                </button>
              </li>
            ))}
          </ul>
        </Field>
      </>
    );
  } else if (s.type === "perks") {
    const items = s.settings.items ?? [];
    const setItem = (i: number, patch: Partial<Perk>) => onChange({ ...s, settings: { ...s.settings, items: items.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
    const icons: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
    body = (
      <>
        <p className="text-sm font-bold text-black dark:text-white">{t.form.items}</p>
        {items.map((p, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-start gap-2">
              <IconChoice lang={lang} value={p.icon} image={p.image} onPick={(icon) => setItem(i, { icon })} onImage={(image) => setItem(i, { icon: "image", image })} />
              <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })} aria-label={t.form.removeItem} title={t.form.removeItem} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
            </div>
            <input value={p.title[lang]} onChange={(e) => setItem(i, { title: { ...p.title, [lang]: e.target.value } })} placeholder={t.form.itemTitle} aria-label={t.form.itemTitle} maxLength={40} className={`${input} h-10`} />
            <input value={p.desc[lang]} onChange={(e) => setItem(i, { desc: { ...p.desc, [lang]: e.target.value } })} placeholder={t.form.itemDesc} aria-label={t.form.itemDesc} maxLength={60} className={`${input} h-10`} />
          </div>
        ))}
        {items.length < 4 && (
          <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { icon: "gift", title: { en: "", ar: "" }, desc: { en: "", ar: "" } }] } })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.form.addItem}
          </button>
        )}
      </>
    );
  } else {
    body = <p className="text-sm text-muted">{t.form.noSettings}</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.form.back} className={roundBtn}>{ic.back}</button>
        <div>
          <p className="text-xs text-muted">{t.form.now}</p>
          <p className="font-bold text-black dark:text-white">{t.elements[s.type]}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">{body}</div>

      {/* Deleting the element: the last thing in its form */}
      <div className="border-t border-fg/10 p-4">
        {asking ? (
          <div ref={askBox} className="rounded-xl bg-rose-500/10 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{t.deleteAsk}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onDelete} className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700">{t.deleteYes}</button>
              <button type="button" onClick={() => setAsking(false)} className="h-10 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{t.cancel}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAsking(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/50 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
            {ic.trash}
            {t.actions.delete}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Store identity                                                     */
/* ------------------------------------------------------------------ */

export function IdentityPanel({ lang, draft, update, showErrors, attn }: { lang: Lang; draft: Draft; update: Update; showErrors: boolean; attn?: string | null }) {
  const t = dc[lang].identity;
  const id = draft.identity;
  const set = (patch: Partial<Identity>) => update((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  return (
    <div className="space-y-5 p-4">
      <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
      <div data-attn="name" className={attn === "name" ? "attention" : ""}>
      <Field label={`${t.name} *`} hint={t.nameHint} error={showErrors && id.name.trim().length < 2 ? t.errName : undefined}>
        <input value={id.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} className={`${input} h-11`} />
      </Field>
      </div>
      <Field label={t.logo} hint={t.logoHint}>
        <LogoChoice lang={lang} draft={draft} update={update} />
      </Field>
      <Field label={t.favicon} hint={t.faviconHint}>
        <FaviconChoice lang={lang} draft={draft} update={update} />
      </Field>
      <Field label={t.description}>
        <textarea value={id.description} onChange={(e) => set({ description: e.target.value })} placeholder={t.descriptionPh} rows={4} maxLength={200} className={`${input} resize-none py-3`} />
      </Field>
      <div data-attn="color" className={attn === "color" ? "attention" : ""}>
      <Field label={t.color}>
        <ColorPicker value={id.color} onChange={(color) => set({ color })} label={t.hex} bad={t.hexBad} />
      </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Design options                                                     */
/* ------------------------------------------------------------------ */

/** The website background: none, a picture or GIF, or a looping video. */
function PageBackground({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang].pageBg;
  const bg = draft.config.pageBackground;
  const url = useMediaUrl(bg.kind === "none" ? "" : bg.media);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof bg>) => update((d) => ({ ...d, config: { ...d.config, pageBackground: { ...d.config.pageBackground, ...patch } } }));

  const take = async (file: File | undefined) => {
    if (!file || demoActive()) return;
    const isVideo = /^video\/(mp4|webm)$/.test(file.type);
    const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
    if ((!isVideo && !isImage) || file.size > (isVideo ? 25_000_000 : 12_000_000)) return setProblem(t.bad);
    setBusy(true);
    const id = `bg-${Date.now().toString(36)}`;
    const ok = await putMedia(id, file);
    setBusy(false);
    if (!ok) return setProblem(t.failed);
    setProblem("");
    if (bg.media) void deleteMedia(bg.media);
    set({ kind: isVideo ? "video" : "image", media: id, name: file.name, size: file.size });
  };

  const remove = () => {
    if (demoActive()) return;
    if (bg.media) void deleteMedia(bg.media);
    set({ kind: "none", media: "", name: "", size: 0 });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-black dark:text-white">{t.title}</p>
        <p className="mt-0.5 text-xs text-muted">{t.hint}</p>
      </div>

      {bg.kind === "none" ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{busy ? "…" : t.upload}</span>
        </label>
      ) : (
        <div className="space-y-3 rounded-xl border border-fg/10 p-3">
          <div className="flex items-center gap-3">
            <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-soft ring-1 ring-black/10">
              {url && bg.kind === "video" ? (
                <video src={url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-primary">{bg.kind === "video" ? t.video : t.image}</span>
              <span className="block truncate text-xs text-muted" dir="ltr">{bg.name}</span>
              <span className="block text-xs text-muted" dir="ltr">{(bg.size / 1_000_000).toFixed(1)} {t.sizeMb}</span>
            </span>
            <button type="button" onClick={remove} aria-label={t.remove} title={t.remove} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/50 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
            {busy ? "…" : t.upload}
          </label>
          <div>
            <p className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              <span>{t.veil}</span>
              <span dir="ltr" className="text-xs text-muted">{bg.veil}%</span>
            </p>
            <input type="range" min={0} max={90} value={bg.veil} onChange={(e) => set({ veil: Number(e.target.value) })} aria-label={t.veil} className="h-1.5 w-full cursor-pointer accent-[rgb(var(--primary))]" />
            <p className="mt-1 text-xs text-muted">{t.veilHint}</p>
          </div>
        </div>
      )}
      {problem && <p className="text-xs text-rose-600">{problem}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{dc[lang].form.sizeLabel}:</b> {t.spec}</span>
      </p>
    </div>
  );
}

export function OptionsPanel({ lang, draft, update, attn }: { lang: Lang; draft: Draft; update: Update; attn?: string | null }) {
  const t = dc[lang].options;
  const th = draft.config.theme;
  const lx = dc[lang].luxe;
  const set = (patch: Partial<StorefrontConfig["theme"]>) => update((d) => ({ ...d, config: { ...d.config, theme: { ...d.config.theme, ...patch } } }));
  return (
    <div className="space-y-5 p-4">
      <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
      <PageBackground lang={lang} draft={draft} update={update} />
      <div data-attn="background" className={attn === "background" ? "attention" : ""}>
      <Field label={t.background}>
        <ColorPicker value={th.background} onChange={(background) => set({ background })} label={t.background} bad={dc[lang].identity.hexBad} list={["#ffffff", "#f4f1ea", "#ead7b8", "#b9e3d4", "#b6d3f4", "#f6bfca", "#d3d6dc"]} />
      </Field>
      </div>
      <div data-attn="text" className={attn === "text" ? "attention" : ""}>
      <Field label={t.text}>
        <ColorPicker value={th.text} onChange={(text) => set({ text })} label={t.text} bad={dc[lang].identity.hexBad} list={["#12262b", "#1f2937", "#111111", "#2b2118", "#1b2a41", "#3b1f2b"]} />
      </Field>
      </div>
      <Field label={t.titles}>
        <ColorPicker value={th.titleColor || th.text} onChange={(titleColor) => set({ titleColor })} label={t.titles} bad={dc[lang].identity.hexBad} list={["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"]} />
        {th.titleColor && (
          <button type="button" onClick={() => set({ titleColor: "" })} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {t.sameAsText}
          </button>
        )}
      </Field>
      <Field label={t.font}>
        <div className="grid grid-cols-2 gap-2">
          {(["readex", "plex", "elegant", "cairo", "tajawal"] as const).map((k) => (
            <button key={k} type="button" onClick={() => set({ font: k })} aria-pressed={(th.font ?? "readex") === k} className={`rounded-xl border px-3 py-3 text-start transition ${(th.font ?? "readex") === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              <span className="block text-base font-bold leading-snug" style={{ fontFamily: fontFamily[k] || undefined }}>{t.fontSample}</span>
              <span className="mt-1 block text-[11px] font-semibold text-muted">{t.fonts[k]}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={lx.headingFont}>
        <div className="grid grid-cols-2 gap-2">
          {(["", "readex", "plex", "elegant", "cairo", "tajawal"] as const).map((k) => {
            const on = (th.headingFont ?? "") === k;
            return (
              <button key={k || "same"} type="button" onClick={() => set({ headingFont: k })} aria-pressed={on} className={`rounded-xl border px-3 py-3 text-start transition ${on ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                {k ? (
                  <>
                    <span className="block text-base font-bold leading-snug" style={{ fontFamily: fontFamily[k as ThemeFont] }}>{t.fontSample}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-muted">{t.fonts[k as ThemeFont]}</span>
                  </>
                ) : (
                  <span className="block text-sm font-semibold">{lx.sameAsFont}</span>
                )}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label={lx.titleStyle}>
        <Seg value={th.titleStyle ?? "bold"} onChange={(titleStyle) => set({ titleStyle })} options={[{ key: "bold", label: lx.titleBold }, { key: "light", label: lx.titleLight }]} />
      </Field>
      <Field label={lx.sectionTitleSize}>
        <Stepper lang={lang} label={lx.textSize} value={th.sectionTitleSize ?? (th.titleStyle === "light" ? 34 : 24)} auto={th.sectionTitleSize === undefined} min={14} max={80} onChange={(sectionTitleSize) => set({ sectionTitleSize })} onReset={() => set({ sectionTitleSize: undefined })} />
      </Field>
      <Field label={lx.spacing}>
        <Seg value={th.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} options={[{ key: "normal", label: lx.spaceNormal }, { key: "airy", label: lx.spaceAiry }]} />
      </Field>
      <div data-section="cards">
        <p className="mb-2 text-sm font-semibold">{t.cards}</p>
        {(["showName", "showCategory", "showPrice", "showOldPrice", "showBadge", "showStock", "showHeart", "showAdd"] as const).map((k) => (
          <Toggle key={k} on={draft.config.cards[k]} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, [k]: v } } }))} label={t[k]} />
        ))}
        <Toggle on={draft.config.cards.showNotes} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, showNotes: v } } }))} label={lx.showNotes} />
      </div>
      <Field label={lx.cardInfo}>
        <Seg value={draft.config.cards.info ?? "stack"} onChange={(info) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, info } } }))} options={[{ key: "stack", label: lx.infoStack }, { key: "row", label: lx.infoRow }]} />
      </Field>
      <Field label={t.cardImage}>
        <div className="grid grid-cols-3 gap-2">
          {(["portrait", "square", "wide"] as const).map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, image: r } } }))} aria-pressed={draft.config.cards.image === r} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${draft.config.cards.image === r ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              <span className="border-2 border-current" style={{ width: r === "wide" ? 40 : r === "square" ? 30 : 26, height: r === "wide" ? 30 : r === "square" ? 30 : 34, borderRadius: 6 }} />
              {t.imageKinds[r]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{lx.cropNote}</p>
      </Field>
      <Field label={t.cardStyle}>
        <div className="grid grid-cols-3 gap-2">
          {(["shadow", "outline", "flat"] as const).map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, style: r } } }))} aria-pressed={draft.config.cards.style === r} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${draft.config.cards.style === r ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {t.styleKinds[r]}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t.corners}>
        <div className="grid grid-cols-3 gap-2">
          {(["none", "md", "xl"] as const).map((r) => (
            <button key={r} type="button" onClick={() => set({ radius: r })} aria-pressed={th.radius === r} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${th.radius === r ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              <span className="h-8 w-12 border-2 border-current" style={{ borderRadius: r === "none" ? 0 : r === "md" ? 8 : 16 }} />
              {t.corner[r]}
            </button>
          ))}
        </div>
      </Field>
      <div className="space-y-3">
        <p className="text-sm font-semibold">{lx.texture}</p>
        <Field label={lx.patternTitle}>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "stars", "dots", "lines", "diamonds", "waves"] as PatternKey[]).map((k) => {
              const on = draft.config.texture.pattern === k;
              const name = { none: lx.patNone, stars: lx.patStars, dots: lx.patDots, lines: lx.patLines, diamonds: lx.patDiamonds, waves: lx.patWaves }[k];
              return (
                <button key={k} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, texture: { ...d.config.texture, pattern: k } } }))} aria-pressed={on} className={`rounded-xl border p-2 text-center transition ${on ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                  <span aria-hidden className="relative mb-1.5 block h-10 overflow-hidden rounded-lg bg-card ring-1 ring-fg/10">
                    {k !== "none" && <span className="absolute inset-0 opacity-70" style={{ background: "rgb(var(--fg))", WebkitMaskImage: `url("${patterns[k].url}")`, maskImage: `url("${patterns[k].url}")`, WebkitMaskSize: `${patterns[k].w}px ${patterns[k].h}px`, maskSize: `${patterns[k].w}px ${patterns[k].h}px` }} />}
                  </span>
                  <span className="text-xs font-semibold">{name}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={lx.watermark}>
          <input value={draft.config.texture.watermark[lang]} onChange={(e) => update((d) => ({ ...d, config: { ...d.config, texture: { ...d.config.texture, watermark: { ...d.config.texture.watermark, [lang]: e.target.value } } } }))} placeholder={lx.watermarkPh} maxLength={12} className={`${input} h-11`} />
        </Field>
      </div>
    </div>
  );
}

export function TextsPanel({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang].texts;
  const tx = draft.config.texts;
  const set = (k: keyof StorefrontConfig["texts"], v: string) => update((d) => ({ ...d, config: { ...d.config, texts: { ...d.config.texts, [k]: { ...d.config.texts[k], [lang]: v } } } }));
  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
        <p className="mt-1 text-xs text-muted">{t.hint}</p>
      </div>
      {(["search", "viewAll", "allFilter", "noProducts"] as const).map((k) => (
        <Field key={k} label={t[k]}>
          <input value={tx[k][lang]} onChange={(e) => set(k, e.target.value)} maxLength={60} className={`${input} h-11`} />
        </Field>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picking a sample icon or uploading a picture                       */
/* ------------------------------------------------------------------ */

const tile = "grid h-11 w-11 place-items-center rounded-xl border transition";

const upIcon = <svg {...icon} className="h-5 w-5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" /></svg>;

/**
 * "Upload your own picture". It is a big, clearly labelled box (also a drop target), so nobody misses it.
 * With a picture already chosen it shows that picture with Change and Remove.
 */
function UploadBox({ lang, current, onImage, onRemove, size, spec, words }: { lang: Lang; current?: string; onImage: (url: string) => void; onRemove?: () => void; size?: number; spec: string; words: string[] }) {
  const t = dc[lang].form;
  const [bad, setBad] = useState(false);
  const [over, setOver] = useState(false);

  const take = async (f: File | undefined) => {
    if (!f) return;
    const url = await readLogo(f, size);
    setBad(!url);
    if (url) onImage(url);
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary/40 ${over ? "border-primary bg-primary/15" : "border-primary/50 bg-primary/5 hover:bg-primary/10"}`}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label={words[0]} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-black/10" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-primary">{current ? words[1] : words[0]}</span>
          <span className="block text-xs text-muted">{t.uploadHint}</span>
        </span>
      </label>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {spec}</span>
      </p>
      {current && onRemove && (
        <button type="button" onClick={onRemove} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">
          {t.removeImage}
        </button>
      )}
      {bad && <p className="mt-2 text-xs text-rose-600">{t.uploadBad}</p>}
    </div>
  );
}

/** Icons for the perks: sample icons with their names, or his own picture. */
function IconChoice({ lang, value, image, onPick, onImage }: { lang: Lang; value: PerkIcon | "image"; image?: string; onPick: (i: PerkIcon) => void; onImage: (url: string) => void }) {
  const t = dc[lang].form;
  const list: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {list.map((k) => {
          const on = value === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition ${on ? "border-primary bg-primary text-white shadow-sm" : "border-fg/15 text-fg hover:border-primary/60 hover:bg-primary/5"}`}
            >
              {storeIcons[k]}
              {t.icons[k]}
            </button>
          );
        })}
      </div>
      <UploadBox lang={lang} current={value === "image" ? image : undefined} onImage={onImage} size={256} spec={t.sizes.perk} words={t.ups.icon} />
    </div>
  );
}

/** The store logo: the logo from setup, the first letter, sample marks, or his own picture. */
function LogoChoice({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const logo = draft.config.identity.logo;
  const set = (patch: Partial<typeof logo>) => update((d) => ({ ...d, config: { ...d.config, identity: { ...d.config.identity, logo: { ...d.config.identity.logo, ...patch } } } }));
  const name = draft.identity.name || "?";
  const setupLogo = loadSetup()?.logo ?? "";
  const pick = (on: boolean) => `${tile} ${on ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-fg/15 hover:bg-soft"}`;
  return (
    <div className="space-y-3" style={{ ["--sf-primary" as string]: HEXISH.test(draft.identity.color) ? draft.identity.color : "#004956", ["--sf-on" as string]: "#fff" }}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => set({ kind: "auto" })} aria-pressed={logo.kind === "auto"} title={t.identity.logoAuto} aria-label={t.identity.logoAuto} className={pick(logo.kind === "auto")}>
          <LogoMark logo={resolveLogo({ ...logo, kind: "auto" }, setupLogo)} name={name} className="h-8 w-8 rounded-lg text-sm" />
        </button>
        <button type="button" onClick={() => set({ kind: "letter" })} aria-pressed={logo.kind === "letter"} title={t.identity.logoLetter} aria-label={t.identity.logoLetter} className={pick(logo.kind === "letter")}>
          <LogoMark logo={{ ...logo, kind: "letter" }} name={name} className="h-8 w-8 rounded-lg text-sm" />
        </button>
        {markKeys.map((k: MarkKey) => (
          <button key={k} type="button" onClick={() => set({ kind: "sample", sample: k })} aria-pressed={logo.kind === "sample" && logo.sample === k} aria-label={k} className={pick(logo.kind === "sample" && logo.sample === k)}>
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--sf-primary)", color: "#fff" }}>
              <svg {...icon} className="h-4 w-4">{sampleMarks[k]}</svg>
            </span>
          </button>
        ))}
      </div>
      <UploadBox lang={lang} current={logo.kind === "image" ? logo.image : undefined} onImage={(image) => set({ kind: "image", image })} onRemove={() => set({ kind: "auto", image: "" })} size={256} spec={t.form.sizes.logo} words={t.form.ups.logo} />
    </div>
  );
}

const HEXISH = /^#[0-9a-f]{6}$/i;

/** The tab icon: upload a picture and see how the browser tab will look. */
function FaviconChoice({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const icon = draft.config.identity.favicon;
  const set = (favicon: string) => update((d) => ({ ...d, config: { ...d.config, identity: { ...d.config.identity, favicon } } }));
  return (
    <div className="space-y-3">
      <UploadBox lang={lang} current={icon || undefined} onImage={set} onRemove={() => set("")} size={64} spec={t.form.sizes.favicon} words={t.form.ups.favicon} />
      <div>
        <p className="mb-1.5 text-xs text-muted">{t.identity.tabPreview}</p>
        <div className="flex w-56 items-center gap-2 rounded-t-xl bg-soft px-3 py-2 text-xs">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-sm bg-fg/20" />
          )}
          <span className="truncate font-medium">{draft.identity.name || "…"}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero banner backgrounds: add, order, and set how they change       */
/* ------------------------------------------------------------------ */

type HeroSettings = Extract<SectionConfig, { type: "hero" }>["settings"];

function HeroBackgrounds({ lang, settings, onChange }: { lang: Lang; settings: HeroSettings; onChange: (s: HeroSettings) => void }) {
  const t = dc[lang].form;
  const list: HeroBg[] = settings.backgrounds?.length ? settings.backgrounds : [{ kind: "color", color: "", image: "" }];
  const [bad, setBad] = useState(false);
  const set = (backgrounds: HeroBg[]) => onChange({ ...settings, backgrounds });
  const edit = (i: number, patch: Partial<HeroBg>) => set(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  const photos = list.filter((b) => b.kind === "image").length;

  const pickPhoto = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    const url = await readPhoto(file);
    setBad(!url);
    if (url) apply(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-black dark:text-white">{t.backgrounds}</p>
        <p className="mt-0.5 text-xs text-muted">{t.backgroundsHint}</p>
      </div>

      <ol className="space-y-3">
        {list.map((b, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
              <span
                className="h-10 w-16 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ background: b.kind === "image" && b.image ? `center / cover url(${b.image})` : `linear-gradient(120deg, ${b.color || draftColor}, color-mix(in srgb, ${b.color || draftColor} 62%, #6fe3cf))` }}
              />
              <span className="flex-1 truncate text-sm font-semibold">{b.kind === "image" ? t.bgPicture : b.color ? t.bgColor : t.bgStoreColor}</span>
              <button type="button" className={roundBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
              <button type="button" className={roundBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
              <button type="button" className={`${roundBtn} hover:!text-rose-600`} disabled={list.length === 1} onClick={() => set(list.filter((_, j) => j !== i))} aria-label={t.removeBg} title={t.removeBg}>{ic.trash}</button>
            </div>

            {b.kind === "color" ? (
              <>
                <ColorPicker value={b.color || draftColor} onChange={(color) => edit(i, { color })} label={t.bgColor} bad={dc[lang].identity.hexBad} list={["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"]} />
                {b.color && (
                  <button type="button" onClick={() => edit(i, { color: "" })} className="text-sm font-semibold text-primary hover:underline">
                    {t.useStoreColor}
                  </button>
                )}
              </>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, (image) => edit(i, { image })); }} />
                {ic.plus}
                {t.ups.cover[0]}
                <span className="text-xs font-normal text-muted">({t.sizes.banner.split(" (")[0]})</span>
              </label>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {list.length < 6 && (
          <button type="button" onClick={() => set([...list, { kind: "color", color: "#348d9c", image: "" }])} className="flex items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.addColor}
          </button>
        )}
        {list.length < 6 && photos < 4 && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, (image) => set([...list, { kind: "image", color: "", image }])); }} />
            {ic.plus}
            {t.addPicture}
          </label>
        )}
      </div>
      {bad && <p className="text-xs text-rose-600">{dc[lang].form.photoBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.sizes.banner}</span>
      </p>
      <p className="text-xs text-muted">{t.picturesNote}</p>

      {list.length > 1 && (
        <div className="space-y-3 rounded-xl bg-soft/70 p-3">
          <Toggle on={settings.autoplay ?? true} onChange={(autoplay) => onChange({ ...settings, autoplay })} label={t.autoplay} />
          {(settings.autoplay ?? true) && (
            <Field label={t.every}>
              <SecondsPicker value={settings.seconds || 5} onChange={(n) => onChange({ ...settings, seconds: n })} unit={t.seconds} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

const draftColor = "#004956";

/* ------------------------------------------------------------------ */
/*  Pinned products: pick which products show, name it, set the count  */
/* ------------------------------------------------------------------ */

type CollectionEl = Extract<SectionConfig, { type: "collection" }>;

function CollectionForm({ lang, s, onChange, text }: { lang: Lang; s: CollectionEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string) => React.ReactNode }) {
  const t = dc[lang].form;
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<{ id: number; name: string; category: string }[]>([]);
  useEffect(() => setProducts(readProducts()), []);
  const ids = s.settings.productIds ?? [];
  const set = (patch: Partial<CollectionEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const toggle = (id: number) => set({ productIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  const shown = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || p.category.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), dc[lang].form.title, false, "title")}
      <Field label={t.collectionLimit}>
        <div className="flex gap-2">
          {[2, 3, 4, 6, 8, 12].map((n) => (
            <button key={n} type="button" onClick={() => set({ count: n })} aria-pressed={s.settings.count === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.count === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t.columns}>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} type="button" onClick={() => set({ columns: n })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Field>

      <div>
        <p className="text-sm font-bold text-black dark:text-white">{t.collection}</p>
        <p className="mt-0.5 text-xs text-muted">{t.collectionHint}</p>
        {products.length === 0 ? (
          <div className="mt-3 rounded-xl bg-soft px-4 py-4 text-sm text-muted">
            <p>{t.collectionNone}</p>
            <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{t.addProducts}</a>
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.collectionSearch} aria-label={t.collectionSearch} className={`${input} mt-3 h-10`} />
            <p className="mt-2 text-xs font-semibold text-primary">
              {ids.filter((id) => products.some((p) => p.id === id)).length} {t.collectionPicked}
            </p>
            <ul className="mt-2 max-h-64 divide-y divide-fg/10 overflow-y-auto rounded-xl border border-fg/10">
              {shown.map((p) => {
                const order = ids.indexOf(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-fg/[0.04]">
                      <input type="checkbox" checked={order >= 0} onChange={() => toggle(p.id)} className="peer sr-only" />
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-xs font-bold text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                        {order >= 0 ? order + 1 : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        {p.category && <span className="block truncate text-xs text-muted">{p.category}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {ids.length === 0 && <p className="mt-2 text-xs text-muted">{t.collectionEmpty}</p>}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Header and footer: rows that open their own small forms            */
/* ------------------------------------------------------------------ */

type SubKey = "headerSettings" | "announcement" | "footerSettings" | "service" | "certificate" | "social";
type SetCfg = (fn: (c: StorefrontConfig) => StorefrontConfig) => void;

/** A row that opens a form. The "‹" says it can be pressed. */
function RowLink({ icon: ico, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-start text-sm font-medium transition hover:bg-fg/[0.04]">
        <span className="text-muted">{ico}</span>
        <span className="flex-1">{label}</span>
        {badge && <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />}
        <span className="text-muted rtl:rotate-180">
          <svg {...icon} className="h-4 w-4"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>
    </li>
  );
}

function SubShell({ lang, title, onBack, children }: { lang: Lang; title: string; onBack: () => void; children: React.ReactNode }) {
  const t = dc[lang];
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.form.back} className={roundBtn}>{ic.back}</button>
        <div>
          <p className="text-xs text-muted">{t.sub.now}</p>
          <p className="text-sm font-bold text-black dark:text-white">{title}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

/** Clicking a product's picture in the preview opens this: choose the part of the picture that stays visible. */
export function ProductPicturePanel({ lang, name, image, value, onChange, onBack, blocked, onBlocked }: { lang: Lang; name: string; image: string; value: PicFocus; onChange: (f: PicFocus) => void; onBack: () => void; blocked: boolean; onBlocked: () => void }) {
  const t = dc[lang];
  return (
    <SubShell lang={lang} title={name} onBack={onBack}>
      <p className="text-xs leading-relaxed text-muted">{t.luxe.picNote}</p>
      <FocusPicker image={image} value={value} onChange={onChange} disabled={blocked} onBlocked={onBlocked} labels={{ tall: t.options.imageKinds.portrait, square: t.options.imageKinds.square, wide: t.options.imageKinds.wide, center: t.luxe.picCenter }} />
    </SubShell>
  );
}

function HeaderSettingsForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang];
  const lx = t.luxe;
  /* Turning the language button on opens a pop-up that explains what he must do */
  const [langNote, setLangNote] = useState(false);
  useEffect(() => {
    if (!langNote) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLangNote(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [langNote]);
  const tog = (key: keyof StorefrontConfig["header"], label: string) => (
    <Toggle key={key} on={cfg.header[key]} onChange={(v) => setCfg((c) => ({ ...c, header: { ...c.header, [key]: v } }))} label={label} />
  );
  return (
    <>
      <div className="space-y-1">
        {tog("showMenu", t.header.showMenu)}
        {!cfg.header.showMenu && <Tip text={t.header.tipMenu} />}
        {tog("showSearch", t.header.showSearch)}
        {tog("showUser", t.header.showUser)}
        {tog("showCart", t.header.showCart)}
        {!cfg.header.showCart && <Tip text={t.header.tipCart} />}
        <Toggle on={cfg.header.showLanguage} onChange={(v) => { setCfg((c) => ({ ...c, header: { ...c.header, showLanguage: v } })); if (v) setLangNote(true); }} label={lx.langButton} />
        {cfg.header.showLanguage && missingTexts(cfg, lang) > 0 && <Tip text={lx.langMissing.replace("{n}", String(missingTexts(cfg, lang)))} />}
        {tog("sticky", t.header.sticky)}
        <Toggle on={cfg.identity.showLogo} onChange={(v) => setCfg((c) => ({ ...c, identity: { ...c.identity, showLogo: v } }))} label={t.header.showLogo} />
      </div>
      <Field label={t.header.align}>
        <div className="flex gap-2">
          {(["start", "center"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setCfg((c) => ({ ...c, identity: { ...c.identity, align: a } }))} aria-pressed={cfg.identity.align === a} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${cfg.identity.align === a ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {t.header[a]}
            </button>
          ))}
        </div>
      </Field>
      <Field label={lx.navStyle}>
        <Seg value={cfg.nav.style} onChange={(style) => setCfg((c) => ({ ...c, nav: { ...c.nav, style } }))} options={[{ key: "button", label: lx.navButton }, { key: "links", label: lx.navLinks }]} />
      </Field>
      {cfg.nav.style === "links" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">{lx.navHint}</p>
          {cfg.nav.links.map((l, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-fg/10 p-2.5">
              <div className="flex items-center gap-2">
                <input value={l[lang] ?? ""} onChange={(e) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) } }))} placeholder={lx.navLink} aria-label={lx.navLink} maxLength={20} className={`${input} h-10 flex-1`} />
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.filter((_, j) => j !== i) } }))} aria-label={lx.navRemove} title={lx.navRemove}>{ic.trash}</button>
              </div>
              <label className="flex items-center justify-between gap-2 text-xs font-semibold text-fg/80">
                {lx.navTarget}
                <select value={l.to ?? ""} onChange={(e) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, to: e.target.value || undefined } : x)) } }))} className={`${input} h-9 w-auto max-w-[60%]`}>
                  <option value="">{lx.navNone}</option>
                  {cfg.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>{t.elements[sec.type]}</option>
                  ))}
                  <option value="footer">{lx.navFooter}</option>
                </select>
              </label>
            </div>
          ))}
          {cfg.nav.links.length < 8 && (
            <button type="button" onClick={() => setCfg((c) => ({ ...c, nav: { ...c.nav, links: [...c.nav.links, { en: "", ar: "" }] } }))} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
              {ic.plus}
              {lx.navAdd}
            </button>
          )}
        </div>
      )}
      {langNote && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && setLangNote(false)}>
          <div role="dialog" aria-modal="true" aria-label={lx.langButton} className="dash w-full max-w-md rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{lx.langButton}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{lx.langHint}</p>
            <button type="button" autoFocus onClick={() => setLangNote(false)} className="mt-5 h-11 w-full rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep">{lx.langOk}</button>
          </div>
        </div>
      )}
    </>
  );
}

function AnnouncementForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang].sub.announcement;
  const a = cfg.announcement;
  const set = (patch: Partial<StorefrontConfig["announcement"]>) => setCfg((c) => ({ ...c, announcement: { ...c.announcement, ...patch } }));
  const edit = (i: number, patch: Partial<StorefrontConfig["announcement"]["messages"][number]>) => set({ messages: a.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const last = a.messages[a.messages.length - 1];
  const seg = (on: boolean) => `h-10 flex-1 rounded-lg text-sm font-semibold transition ${on ? "bg-ink text-onink" : "text-muted hover:bg-fg/5"}`;
  return (
    <>
      <Toggle on={a.show} onChange={(show) => set({ show })} label={t.show} />

      <Field label={t.motion}>
        <div className="flex gap-1 rounded-xl border border-fg/15 bg-card p-1">
          <button type="button" aria-pressed={a.motion === "fade"} onClick={() => set({ motion: "fade" })} className={seg(a.motion === "fade")}>{t.fade}</button>
          <button type="button" aria-pressed={a.motion === "ticker"} onClick={() => set({ motion: "ticker" })} className={seg(a.motion === "ticker")}>{t.ticker}</button>
        </div>
        <p className="mt-1.5 text-xs text-muted">{a.motion === "ticker" ? t.tickerHint : t.fadeHint}</p>
      </Field>

      {a.motion === "fade" && a.messages.length > 1 && (
        <Field label={t.every}>
          <SecondsPicker value={a.seconds} onChange={(seconds) => set({ seconds })} unit={t.sec} presets={[3, 4, 6, 8]} />
        </Field>
      )}

      <ol className="space-y-4">
        {a.messages.map((m, i) => (
          <li key={i} className="space-y-3 rounded-2xl border border-fg/10 bg-fg/[0.02] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-black dark:text-white">{t.message} {i + 1}</p>
              {a.messages.length > 1 && (
                <button type="button" onClick={() => set({ messages: a.messages.filter((_, j) => j !== i) })} aria-label={t.remove} title={t.remove} className={`${roundBtnSm} hover:!text-rose-600`}>{ic.trash}</button>
              )}
            </div>
            <input value={m.text[lang]} onChange={(e) => edit(i, { text: { ...m.text, [lang]: e.target.value } })} aria-label={t.text} placeholder={t.text} maxLength={90} className={`${input} h-11`} />
            <input dir="ltr" value={m.link} onChange={(e) => edit(i, { link: e.target.value })} aria-label={t.link} placeholder={t.link} maxLength={160} className={`${input} h-10 text-start`} />
            <div>
              <p className="mb-2 text-xs font-semibold text-fg/80">{a.motion === "ticker" && i > 0 ? t.colorFirst : t.color}</p>
              <ColorPicker value={m.color} onChange={(color) => edit(i, { color })} label={t.color} bad={dc[lang].identity.hexBad} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-fg/80">{t.textColor}</p>
                {m.textColor && <button type="button" onClick={() => edit(i, { textColor: "" })} className="text-xs font-semibold text-primary hover:underline">{t.auto}</button>}
              </div>
              <ColorPicker value={m.textColor || onColor(m.color)} onChange={(textColor) => edit(i, { textColor })} label={t.textColor} bad={dc[lang].identity.hexBad} list={["#ffffff", "#12262b", "#ffd166", "#96edd9", "#ffb4b4"]} />
            </div>
          </li>
        ))}
      </ol>

      {a.messages.length < 5 && (
        <button
          type="button"
          onClick={() => set({ messages: [...a.messages, { text: { en: "", ar: "" }, link: "", color: last.color, textColor: last.textColor }] })}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10"
        >
          {ic.plus}
          {t.add}
        </button>
      )}
    </>
  );
}

function FooterSettingsForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang];
  const f = cfg.footer;
  const set = (patch: Partial<StorefrontConfig["footer"]>) => setCfg((c) => ({ ...c, footer: { ...c.footer, ...patch } }));
  const tog = (key: "showLogo" | "showLinks" | "showContact" | "showSocial", label: string) => <Toggle key={key} on={f[key]} onChange={(v) => set({ [key]: v })} label={label} />;
  return (
    <>
      <div className="space-y-1">
        {tog("showLogo", t.footer.showLogo)}
        {tog("showLinks", t.footer.showLinks)}
        {tog("showContact", t.footer.showContact)}
        {tog("showSocial", t.footer.showSocial)}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold">{t.luxe.footerColors}</p>
        {(["background", "text"] as const).map((key) => (
          <Field key={key} label={key === "background" ? t.luxe.footerBg : t.luxe.footerText}>
            {f[key] ? (
              <>
                <ColorPicker value={f[key]} onChange={(v) => set({ [key]: v })} label={key} bad={t.identity.hexBad} list={key === "background" ? ["#16120f", "#1c1a17", "#2b2118", "#004956", "#f4f1ea", "#ffffff"] : ["#e9e1d3", "#ffffff", "#c9a46a", "#1c1a17", "#12262b"]} />
                <button type="button" onClick={() => set({ [key]: "" })} className="mt-2 text-sm font-semibold text-primary hover:underline">{t.luxe.footerAutoBack}</button>
              </>
            ) : (
              <button type="button" onClick={() => set({ [key]: key === "background" ? "#16120f" : "#e9e1d3" })} className="w-full rounded-xl border border-dashed border-fg/25 px-3 py-2.5 text-start text-sm font-medium text-muted transition hover:bg-soft">{t.luxe.footerAuto}</button>
            )}
          </Field>
        ))}
      </div>
      <Field label={t.footerFields.about} hint={t.footerFields.aboutHint}>
        <textarea data-field="about" value={f.about[lang]} onChange={(e) => set({ about: { ...f.about, [lang]: e.target.value } })} rows={3} maxLength={200} className={`${input} resize-none py-3`} />
      </Field>
      <Field label={t.footerFields.address}>
        <input value={f.address[lang]} onChange={(e) => set({ address: { ...f.address, [lang]: e.target.value } })} maxLength={100} className={`${input} h-11`} />
      </Field>
    </>
  );
}

function ServiceForm({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const f = draft.config.footer;
  const set = (patch: Partial<StorefrontConfig["footer"]>) => update((d) => ({ ...d, config: { ...d.config, footer: { ...d.config.footer, ...patch } } }));
  return (
    <>
      <p className="text-xs text-muted">{t.sub.service.hint}</p>
      <Field label={t.footerFields.servicePhone} hint={t.footerFields.servicePhoneHint}>
        <span dir="ltr" className="flex h-11 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">+962</span>
          <input
            data-field="phone"
            value={draft.identity.phone}
            onChange={(e) => update((d) => ({ ...d, identity: { ...d.identity, phone: latin(e.target.value).replace(/[^\d\s]/g, "").replace(/^[\s0]+/, "") } }))}
            inputMode="tel"
            className="h-full flex-1 bg-transparent px-3 outline-none"
          />
        </span>
      </Field>
      <Field label={t.sub.service.whatsapp}>
        <span className="relative block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#1fa855]">{storeIcons.whatsapp}</span>
          <input dir="ltr" value={f.whatsapp} onChange={(e) => set({ whatsapp: latin(e.target.value).replace(/[^\d+\s]/g, "") })} inputMode="tel" maxLength={20} placeholder="+962 7X XXX XXXX" className={`${input} h-11 text-start ps-10`} />
        </span>
      </Field>
      <Field label={t.sub.service.telegram}>
        <span className="relative block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#229ed9]">{storeIcons.telegram}</span>
          <input dir="ltr" value={f.telegram} onChange={(e) => set({ telegram: e.target.value })} maxLength={40} placeholder="@name" className={`${input} h-11 text-start ps-10`} />
        </span>
      </Field>
      <Field label={t.footerFields.email}>
        <input dir="ltr" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={80} className={`${input} h-11 text-start`} />
      </Field>
    </>
  );
}

function CertificateForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang].sub.certificate;
  const c = cfg.footer.certificate;
  const set = (patch: Partial<typeof c>) => setCfg((x) => ({ ...x, footer: { ...x.footer, certificate: { ...x.footer.certificate, ...patch } } }));
  return (
    <>
      <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.hint}</p>
      <Field label={t.kind}>
        <div className="grid grid-cols-3 gap-2">
          {(["commercial", "license", "other"] as const).map((k) => (
            <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={c.kind === k} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${c.kind === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {t[k]}
            </button>
          ))}
        </div>
      </Field>
      {/* "Other" opens a field where he writes what it is */}
      {c.kind === "other" && (
        <Field label={t.otherName}>
          <input autoFocus value={c.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder={t.otherNamePh} maxLength={40} className={`${input} h-11`} />
        </Field>
      )}
      <Field label={t.number}>
        <input dir="ltr" value={c.number} onChange={(e) => set({ number: latin(e.target.value).slice(0, 30) })} maxLength={30} className={`${input} h-11 text-start`} />
      </Field>
      <Field label={t.logo}>
        <UploadBox lang={lang} current={c.logo || undefined} onImage={(logo) => set({ logo })} onRemove={() => set({ logo: "" })} size={256} spec={t.logoSpec} words={dc[lang].form.ups.license} />
      </Field>
      <Field label={t.url}>
        <input dir="ltr" value={c.url} onChange={(e) => set({ url: e.target.value })} maxLength={160} placeholder="https://" className={`${input} h-11 text-start`} />
      </Field>
    </>
  );
}

function SocialForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang];
  const f = cfg.footer;
  const names: { k: keyof StorefrontConfig["footer"]["social"]; label: string }[] = [
    { k: "instagram", label: t.footerFields.instagram },
    { k: "facebook", label: t.footerFields.facebook },
    { k: "x", label: t.footerFields.x },
    { k: "youtube", label: t.footerFields.youtube },
    { k: "snapchat", label: t.sub.social.snapchat },
    { k: "tiktok", label: t.sub.social.tiktok },
  ];
  return (
    <>
      <p className="text-xs text-muted">{t.footerFields.socialHint}</p>
      <div className="space-y-3">
        {names.map((n) => (
          <input key={n.k} dir="ltr" value={f.social[n.k]} onChange={(e) => setCfg((c) => ({ ...c, footer: { ...c.footer, social: { ...c.footer.social, [n.k]: e.target.value } } }))} placeholder={n.label} aria-label={n.label} maxLength={120} className={`${input} h-11 text-start`} />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated pictures: his pictures and GIFs                           */
/* ------------------------------------------------------------------ */

type SlidesEl = Extract<SectionConfig, { type: "slides" }>;

function SlidesForm({ lang, s, onChange }: { lang: Lang; s: SlidesEl; onChange: (s: SectionConfig) => void }) {
  const t = dc[lang].form;
  const slides = s.settings.slides ?? [];
  const [bad, setBad] = useState(false);
  const set = (patch: Partial<SlidesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Slide>) => set({ slides: slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const n = [...slides];
    [n[i], n[j]] = [n[j], n[i]];
    set({ slides: n });
  };
  const add = async (file: File | undefined) => {
    if (!file) return;
    const url = await readPhoto(file);
    setBad(!url);
    if (url) set({ slides: [...slides, { image: url, link: "" }] });
  };

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.slidesHint}</p>

      {slides.length > 0 && (
        <ol className="space-y-3">
          {slides.map((x, i) => (
            <li key={i} className="space-y-2.5 rounded-xl border border-fg/10 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.image} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                <span className="flex-1" />
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ slides: slides.filter((_, j) => j !== i) })} aria-label={t.removeSlide} title={t.removeSlide}>{ic.trash}</button>
              </div>
              <input dir="ltr" value={x.link} onChange={(e) => edit(i, { link: e.target.value })} placeholder={t.slideLink} aria-label={t.slideLink} maxLength={160} className={`${input} h-10 text-start`} />
            </li>
          ))}
        </ol>
      )}

      {slides.length < 8 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void add(f); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{t.addSlide}</span>
        </label>
      )}
      {bad && <p className="text-xs text-rose-600">{t.photoBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.slidesSpec}</span>
      </p>

      <Field label={t.shapeLabel}>
        <div className="grid grid-cols-2 gap-2">
          {(["wide", "standard"] as const).map((r) => (
            <button key={r} type="button" onClick={() => set({ ratio: r })} aria-pressed={s.settings.ratio === r} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${s.settings.ratio === r ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {r === "wide" ? t.shapeWide : t.shapeStandard}
            </button>
          ))}
        </div>
      </Field>

      {slides.length > 1 && (
        <div className="space-y-3 rounded-xl bg-soft/70 p-3">
          <Toggle on={s.settings.autoplay ?? true} onChange={(autoplay) => set({ autoplay })} label={t.autoplay} />
          {(s.settings.autoplay ?? true) && (
            <Field label={t.every}>
              <SecondsPicker value={s.settings.seconds || 5} onChange={(n) => set({ seconds: n })} unit={t.seconds} />
            </Field>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  One picture the merchant uploads (shrunk, kept with the store)     */
/* ------------------------------------------------------------------ */

function PhotoPicker({ lang, value, onChange, max = 1200 }: { lang: Lang; value: string; onChange: (v: string) => void; max?: number }) {
  const t = dc[lang].form;
  const [bad, setBad] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const url = await readPhoto(file, max);
    setBad(!url);
    if (url) onChange(url);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-2.5 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="truncate text-sm font-bold text-primary">{value ? t.picChange : t.pic}</span>
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className={`${roundBtn} hover:!text-rose-600`} aria-label={t.picRemove} title={t.picRemove}>{ic.trash}</button>
        )}
      </div>
      {bad && <p className="text-xs text-rose-600">{t.picBad}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picture tiles: a row of pictures with names and links              */
/* ------------------------------------------------------------------ */

type TilesEl = Extract<SectionConfig, { type: "tiles" }>;
type BannersEl = Extract<SectionConfig, { type: "banners" }>;

function TilesForm({ lang, s, onChange, text }: { lang: Lang; s: TilesEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string) => React.ReactNode }) {
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const [bad, setBad] = useState(false);
  const set = (patch: Partial<TilesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Tile>) => set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    set({ items: n });
  };
  const add = async (files: FileList | null) => {
    if (!files) return;
    const made = await Promise.all(Array.from(files).map((f) => readPhoto(f, 900)));
    const ok = made.filter((u): u is string => !!u);
    setBad(ok.length < files.length);
    set({ items: [...items, ...ok.map((image) => ({ image, label: { en: "", ar: "" }, link: "" }))].slice(0, 10) });
  };

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), t.title, false, "title")}
      <p className="text-xs leading-relaxed text-muted">{t.tilesHint}</p>

      {items.length > 0 && (
        <ol className="space-y-3">
          {items.map((x, i) => (
            <li key={i} className="space-y-2.5 rounded-xl border border-fg/10 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.image} alt="" className="h-12 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                <span className="flex-1" />
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label={t.removeTile} title={t.removeTile}>{ic.trash}</button>
              </div>
              <input value={x.label?.[lang] ?? ""} onChange={(e) => edit(i, { label: { ...(x.label ?? { en: "", ar: "" }), [lang]: e.target.value } })} placeholder={t.tileLabel} aria-label={t.tileLabel} maxLength={40} className={`${input} h-10`} />
              <input dir="ltr" value={x.link} onChange={(e) => edit(i, { link: e.target.value })} placeholder={t.tileLink} aria-label={t.tileLink} maxLength={160} className={`${input} h-10 text-start`} />
              {s.settings.style === "editorial" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-fg/80">{lx.tileChip}</p>
                  <Seg value={x.chip ?? "light"} onChange={(chip) => edit(i, { chip })} options={[{ key: "light", label: lx.chipLight }, { key: "dark", label: lx.chipDark }]} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {items.length < 10 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const el = e.currentTarget; void add(el.files).then(() => { el.value = ""; }); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{t.addTile}</span>
        </label>
      )}
      {bad && <p className="text-xs text-rose-600">{t.picBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.tilesSpec}</span>
      </p>

      <Field label={lx.tilesStyle}>
        <Seg value={s.settings.style ?? "classic"} onChange={(style) => set({ style })} options={[{ key: "classic", label: lx.tilesClassic }, { key: "editorial", label: lx.tilesEditorial }]} />
      </Field>

      <Field label={t.tilesPerRow}>
        <div className="flex gap-2">
          {([3, 4, 5] as const).map((n) => (
            <button key={n} type="button" onClick={() => set({ columns: n })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Promo banners: a picture with a title, text and button on top      */
/* ------------------------------------------------------------------ */

function BannersForm({ lang, s, onChange }: { lang: Lang; s: BannersEl; onChange: (s: SectionConfig) => void }) {
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const set = (next: Banner[]) => onChange({ ...s, settings: { ...s.settings, items: next } });
  const fonts: { key: DisplayFont; label: string }[] = [{ key: "default", label: lx.fontDefault }, { key: "ruqaa", label: lx.fontRuqaa }, { key: "lemonada", label: lx.fontLemonada }, { key: "amiri", label: lx.fontAmiri }];
  const edit = (i: number, patch: Partial<Banner>) => set(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const bi = (i: number, k: "title" | "text" | "button" | "eyebrow", v: string) => edit(i, { [k]: { ...(items[i][k] ?? { en: "", ar: "" }), [lang]: v } } as Partial<Banner>);

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.bannersHint}</p>
      <Field label={lx.bannerHeight}>
        <Seg value={s.settings.height ?? "normal"} onChange={(height) => onChange({ ...s, settings: { ...s.settings, height } })} options={[{ key: "normal", label: lx.heightNormal }, { key: "tall", label: lx.heightTall }]} />
      </Field>
      {items.map((x, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
            <span className="flex-1" />
            <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set(items.filter((_, j) => j !== i))} aria-label={t.removeBanner} title={t.removeBanner}>{ic.trash}</button>
          </div>
          <PhotoPicker lang={lang} value={x.image} onChange={(image) => edit(i, { image })} max={1600} />
          <input value={x.title?.[lang] ?? ""} onChange={(e) => bi(i, "title", e.target.value)} placeholder={t.bannerTitle} aria-label={t.bannerTitle} maxLength={60} className={`${input} h-10`} />
          <textarea value={x.text?.[lang] ?? ""} onChange={(e) => bi(i, "text", e.target.value)} placeholder={t.bannerText} aria-label={t.bannerText} rows={2} maxLength={140} className={`${input} resize-none py-2.5`} />
          <input value={x.button?.[lang] ?? ""} onChange={(e) => bi(i, "button", e.target.value)} placeholder={t.bannerButton} aria-label={t.bannerButton} maxLength={30} className={`${input} h-10`} />
          <input dir="ltr" value={x.link} onChange={(e) => edit(i, { link: e.target.value })} placeholder={t.bannerLink} aria-label={t.bannerLink} maxLength={160} className={`${input} h-10 text-start`} />
          <input value={x.eyebrow?.[lang] ?? ""} onChange={(e) => bi(i, "eyebrow", e.target.value)} placeholder={lx.bannerEyebrow} aria-label={lx.bannerEyebrow} maxLength={40} className={`${input} h-10`} />
          <Field label={lx.bannerFont}>
            <Seg value={x.font ?? "default"} onChange={(font) => edit(i, { font })} options={fonts} />
          </Field>
          <Field label={lx.bannerTextFont}>
            <Seg value={x.textFont ?? "default"} onChange={(textFont) => edit(i, { textFont })} options={fonts} />
          </Field>
          <Stepper lang={lang} label={lx.titleSize} value={x.titleSize ?? 84} auto={x.titleSize === undefined} min={20} max={200} onChange={(titleSize) => edit(i, { titleSize })} onReset={() => edit(i, { titleSize: undefined })} />
          <Stepper lang={lang} label={lx.textSize} value={x.textSize ?? (x.textFont && x.textFont !== "default" ? 20 : 15)} auto={x.textSize === undefined} min={10} max={60} onChange={(textSize) => edit(i, { textSize })} onReset={() => edit(i, { textSize: undefined })} />
          <Field label={lx.bannerTitleColor}>
            <ColorPicker value={x.titleColor || "#ffffff"} onChange={(titleColor) => edit(i, { titleColor })} label={lx.bannerTitleColor} bad={dc[lang].identity.hexBad} list={["#ffffff", "#d9b776", "#b03a5b", "#1c1a17", "#004956"]} />
          </Field>
          <Field label={lx.bannerPanel}>
            <Seg value={x.panel ?? "none"} cols={3} onChange={(panel) => edit(i, { panel })} options={[{ key: "none", label: lx.panelNone }, { key: "light", label: lx.panelLight }, { key: "dark", label: lx.panelDark }]} />
          </Field>
          {(x.panel === "light" || x.panel === "dark") && (
            <Field label={lx.bannerPanelColor}>
              <ColorPicker value={x.panelColor || (x.panel === "dark" ? "#12100d" : "#fff5f8")} onChange={(panelColor) => edit(i, { panelColor })} label={lx.bannerPanelColor} bad={dc[lang].identity.hexBad} list={["#fff5f8", "#ffffff", "#f4efe6", "#12100d", "#16120f", "#004956", "#b03a5b"]} />
              {x.panelColor && (
                <button type="button" onClick={() => edit(i, { panelColor: "" })} className="mt-2 text-sm font-semibold text-primary hover:underline">{lx.bannerPanelAuto}</button>
              )}
            </Field>
          )}
          {(x.panel === "light" || x.panel === "dark") && (
            <Field label={lx.bannerPosition}>
              <Seg value={x.position ?? "top-start"} onChange={(position) => edit(i, { position })} options={[{ key: "top-start", label: lx.posTopStart }, { key: "top-end", label: lx.posTopEnd }, { key: "bottom-start", label: lx.posBottomStart }, { key: "bottom-end", label: lx.posBottomEnd }]} />
            </Field>
          )}
          <Field label={lx.bannerButtonStyle}>
            <Seg value={x.buttonStyle ?? "filled"} onChange={(buttonStyle) => edit(i, { buttonStyle })} options={[{ key: "filled", label: lx.btnFilled }, { key: "outline", label: lx.btnOutline }]} />
          </Field>
          <ColorChip lang={lang} label={lx.bannerEyebrowColor} value={x.eyebrowColor} onChange={(eyebrowColor) => edit(i, { eyebrowColor })} onReset={() => edit(i, { eyebrowColor: undefined })} />
          <ColorChip lang={lang} label={lx.bannerTextColor} value={x.textColor} onChange={(textColor) => edit(i, { textColor })} onReset={() => edit(i, { textColor: undefined })} />
          <ColorChip lang={lang} label={lx.bannerButtonColor} value={x.accent} onChange={(accent) => edit(i, { accent })} onReset={() => edit(i, { accent: undefined })} />
        </div>
      ))}

      {items.length < 3 && (
        <button type="button" onClick={() => set([...items, { image: "", title: { en: "", ar: "" }, text: { en: "", ar: "" }, button: { en: "", ar: "" }, link: "" }])} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/10">
          {ic.plus}
          {t.addBanner}
        </button>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.bannersSpec}</span>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes ribbon: a dark strip of short words                          */
/* ------------------------------------------------------------------ */

type RibbonEl = Extract<SectionConfig, { type: "ribbon" }>;

function RibbonForm({ lang, s, onChange }: { lang: Lang; s: RibbonEl; onChange: (s: SectionConfig) => void }) {
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const set = (patch: Partial<RibbonEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{lx.ribbonHint}</p>
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex items-center gap-2">
            <input value={w[lang] ?? ""} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) })} placeholder={lx.ribbonWord} aria-label={lx.ribbonWord} maxLength={24} className={`${input} h-10 flex-1`} />
            <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label={lx.ribbonRemove} title={lx.ribbonRemove}>{ic.trash}</button>
          </li>
        ))}
      </ol>
      {items.length < 12 && (
        <button type="button" onClick={() => set({ items: [...items, { en: "", ar: "" }] })} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
          {ic.plus}
          {lx.ribbonAdd}
        </button>
      )}
      <Field label={lx.ribbonBg}>
        <ColorPicker value={s.settings.background} onChange={(background) => set({ background })} label={lx.ribbonBg} bad={dc[lang].identity.hexBad} list={["#16120f", "#1c1a17", "#2b2118", "#004956", "#ffffff"]} />
      </Field>
      <Field label={lx.ribbonText}>
        <ColorPicker value={s.settings.color} onChange={(color) => set({ color })} label={lx.ribbonText} bad={dc[lang].identity.hexBad} list={["#c9a46a", "#d9b776", "#e9e1d3", "#ffffff", "#1c1a17"]} />
      </Field>
    </>
  );
}

/** A small amber note that appears when a choice may make the store harder to use. */
function Tip({ text }: { text: string }) {
  return (
    <p role="note" className="flex items-start gap-2 rounded-xl bg-amber-500/12 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 2.500 20h19L12 3ZM12 10v4.500M12 17.500v.01" />
      </svg>
      {text}
    </p>
  );
}
