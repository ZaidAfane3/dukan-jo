"use client";

import { useEffect, useRef, useState } from "react";
import { brandName, content, type Lang } from "../content";
import { barIcons, menuEntries, type BellItem, type Section, BellPanel } from "../DashboardBar";
import { useT } from "./ui";

/* "How merchants see it": a small copy of the merchant dashboard in Diwan's editors (pop-ups, announcements, pages),
   showing where the item will be for real merchants once they sign in. The side menu, the bell's panel, the banner,
   the pop-up templates and Dukkan's pages are the dashboard's own components; only the page under them is a sketch.
   It is drawn at the dashboard's real size and shrunk to fit, in English or Arabic, on a desktop or a phone. Nothing in
   it can be clicked or focused (inert). */

export type Look = { lang: Lang; phone: boolean };

const DESK = { w: 1100, h: 680 };
const PHONE = { w: 390, h: 760 };

/** Draws its child at a fixed size, shrunk to the width it is given */
function Scaled({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRoom(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /* not a link, button or field in it can be used: it is a picture of the dashboard */
  useEffect(() => inner.current?.setAttribute("inert", ""), [room]);
  const s = room ? Math.min(1, room / w) : 0;
  return (
    <div ref={outer} dir="ltr" className="relative w-full overflow-hidden" style={{ height: h * s }}>
      {s > 0 && (
        <div ref={inner} aria-hidden className="absolute top-0 overflow-hidden rounded-xl shadow-lg ring-1 ring-fg/15" style={{ width: w, height: h, left: (room - w * s) / 2, transform: `scale(${s})`, transformOrigin: "top left" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** The preview's frame: what it shows, the language and the width, and a short caption */
export function PreviewPanel({ look, setLook, caption, tools, children }: {
  look: Look; setLook: (l: Look) => void; caption: string; tools?: React.ReactNode; children: React.ReactNode;
}) {
  const t = useT();
  const seg = (on: boolean) => `h-7 rounded-md px-3 text-xs font-semibold ${on ? "bg-card shadow-sm" : "text-muted hover:text-fg"}`;
  return (
    <section aria-label={t("How merchants see it", "كيف يراه التجار")} className="rounded-2xl bg-soft/60 p-3 ring-1 ring-fg/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{t("How merchants see it", "كيف يراه التجار")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {tools}
          <div className="flex gap-0.5 rounded-lg bg-fg/[0.06] p-0.5" role="group" aria-label={t("Preview language", "لغة المعاينة")}>
            {(["ar", "en"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={look.lang === l} onClick={() => setLook({ ...look, lang: l })} className={seg(look.lang === l)}>{l === "ar" ? "العربية" : "English"}</button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg bg-fg/[0.06] p-0.5" role="group" aria-label={t("Screen", "الشاشة")}>
            {([false, true] as const).map((p) => (
              <button key={String(p)} type="button" aria-pressed={look.phone === p} onClick={() => setLook({ ...look, phone: p })} className={seg(look.phone === p)}>{p ? t("Phone", "جوال") : t("Desktop", "حاسوب")}</button>
            ))}
          </div>
        </div>
      </div>
      {children}
      <p className="mt-2 text-xs text-muted">{caption}</p>
    </section>
  );
}

/** A small set of options for the preview's bar (which view to show) */
export function PreviewTabs<K extends string>({ value, onChange, items, label }: { value: K; onChange: (k: K) => void; items: [K, string][]; label: string }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-fg/[0.06] p-0.5" role="group" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={`h-7 rounded-md px-3 text-xs font-semibold ${value === k ? "bg-card shadow-sm" : "text-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
}

/** Phones side by side (two views of the same thing), or one desktop */
export function Screens({ phone, children }: { phone: boolean; children: React.ReactNode[] }) {
  const list = children.filter(Boolean);
  if (!phone) return <div className="space-y-3">{list}</div>;
  return <div className={`grid gap-3 ${list.length > 1 ? "grid-cols-2" : "mx-auto max-w-[17rem]"}`}>{list}</div>;
}

const bar = (w: string, extra = "") => <span className={`block h-2.5 rounded-full bg-fg/10 ${extra}`} style={{ width: w }} />;

/** The dashboard home under what is shown: the greeting, the figures and the chart, as a sketch */
export function HomeSketch({ lang, phone }: Look) {
  const h = content[lang].home;
  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">{h.welcomeNoName}</h1>
        <p className="mt-1 text-sm text-muted">{h.welcomeSub}</p>
      </div>
      <div className={`grid gap-4 ${phone ? "grid-cols-2" : "grid-cols-4"}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
            {bar("45%")}
            <span className="block h-6 w-2/3 rounded-lg bg-fg/[0.08]" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10">
        {bar("30%")}
        <div className="mt-6 flex h-40 items-end gap-2">
          {[40, 65, 30, 80, 55, 70, 45, 90, 60, 35, 75, 50].slice(0, phone ? 7 : 12).map((v, i) => (
            <span key={i} className="flex-1 rounded-t-md bg-primary/20" style={{ height: `${v}%` }} />
          ))}
        </div>
      </div>
    </>
  );
}

/** Another merchant page (the orders) under what is shown, as a sketch */
export function PageSketch({ lang, phone, title }: Look & { title: string }) {
  return (
    <>
      <h1 className="text-xl font-extrabold">{title}</h1>
      <div className="rounded-2xl bg-card shadow-sm ring-1 ring-fg/10">
        {Array.from({ length: phone ? 6 : 7 }, (_, i) => (
          <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i ? "border-t border-fg/10" : ""}`}>
            {bar(phone ? "30%" : "14%")}
            {bar(phone ? "25%" : "22%")}
            {!phone && bar("12%")}
            <span className="ms-auto h-6 w-16 rounded-full bg-fg/[0.07]" />
          </div>
        ))}
      </div>
    </>
  );
}

/** The side menu, as the dashboard draws it (its own entries and icons), with one entry marked as the page open */
function SideMenu({ lang, active, className }: { lang: Lang; active: Section; className: string }) {
  return (
    <aside className={`flex flex-col border-e border-fg/10 bg-card ${className}`}>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-fg/10 px-4 text-xl font-extrabold">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-white">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></svg>
        </span>
        {brandName(lang)}
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-3">
        {menuEntries(lang).map((e) => {
          const on = e.section === active;
          return (
            <div key={e.key} className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${on ? "bg-black/[0.07] font-bold text-fg ring-2 ring-primary dark:bg-white/[0.1]" : "text-muted"}`}>
              {e.icon}
              <span className="min-w-0 flex-1 truncate">{e.label}</span>
              {e.sub && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** The merchant dashboard: its side menu (on a phone: a button, or the open drawer), its top bar with the bell, the page,
    and what lies over it (a pop-up) */
export function MockDashboard({ lang, phone, active, tab, bell, drawer = false, overlay, children }: Look & {
  active: Section; tab: string;
  /** the bell: how many unread, and its open panel's items (null: closed) */
  bell?: { unread: number; items: BellItem[] | null };
  /** a phone with its side menu open */
  drawer?: boolean;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const size = phone ? PHONE : DESK;
  const unread = bell?.unread ?? 0;
  const side = phone ? 0 : 256;
  return (
    <Scaled w={size.w} h={size.h}>
      <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="dash-mock relative h-full w-full overflow-hidden bg-page text-fg" style={{ fontSize: 15 }}>
        {!phone && <SideMenu lang={lang} active={active} className="absolute inset-y-0 start-0 w-64" />}
        <div className="absolute inset-y-0 end-0 flex flex-col" style={{ insetInlineStart: side }}>
          <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-fg/10 bg-card/90 px-5">
            <div className="flex min-w-0 items-center gap-3">
              {phone && <span className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15">{barIcons.menu}</span>}
              <span className="truncate border-b-2 border-primary py-5 text-sm font-semibold">{tab}</span>
            </div>
            {!phone && <span className="h-9 w-64 rounded-lg bg-soft" />}
            <div className="flex shrink-0 items-center gap-2">
              {!phone && <span className="grid h-9 w-9 place-items-center rounded-lg border border-fg/15">{barIcons.ticket}</span>}
              <span className={`relative grid h-9 w-9 place-items-center rounded-lg border ${bell?.items ? "border-primary bg-soft" : "border-fg/15"}`}>
                {barIcons.bell}
                {unread > 0 && <span className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>}
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{lang === "ar" ? "م" : "S"}</span>
            </div>
            {bell?.items && (
              <BellPanel
                lang={lang} items={bell.items} tab={0} setTab={() => {}} unread={unread} onMarkAll={() => {}} onPick={() => {}}
                className={`absolute top-full z-50 mt-2 ${phone ? "inset-x-3" : "end-5 w-[26rem]"}`}
              />
            )}
          </header>
          <main className={`flex-1 space-y-6 overflow-hidden ${phone ? "px-4 py-6" : "px-8 py-8"}`}>{children}</main>
        </div>
        {phone && drawer && (
          <>
            <div className="absolute inset-0 z-30 bg-black/50" />
            <SideMenu lang={lang} active={active} className="absolute inset-y-0 start-0 z-40 w-72" />
          </>
        )}
        {overlay && <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">{overlay}</div>}
      </div>
    </Scaled>
  );
}
