"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "../Prefs";
import { ArchMarker, DiwanMark, Icon, iconForPath } from "./icons";
import { DIWAN_NAV, NAV_GROUPS, type NavGroup } from "./nav";
import { can, roleName as roleWords, type Role } from "./perms";
import { send, StaffContext, useT } from "./ui";

export type ShellStaff = { name: string; email: string; role: Role };

/* Diwan's look. A diwan is the hall where guests are received; its doorway, the pointed arch, is the one shape Diwan
   repeats (the mark, the welcome's window, the marker of the page you are on). The page is warm paper in the light and
   Dukkan's deep teal in the dark; teal is for what is chosen; saffron only for what needs someone (ui.tsx ATTENTION).
   The name is set in Ruq'ah, the hand of Arabic letters and signs. The rest stays quiet: it is a work tool. */
const RUQAA = { fontFamily: "var(--font-ruqaa), var(--font-sans)" };
/** Diwan's paper: a warm off-white in the light, the app's own page colour in the dark */
export const PAPER = "bg-[#f6f2ea] dark:bg-page";
/* which sidebar sections this browser keeps open or closed */
const FOLDS_KEY = "diwan-nav-folds";

/** Diwan's frame: the sidebar (only the pages this role may open), the top bar and the page. */
export function DiwanShell({ staff, children }: { staff: ShellStaff; children: React.ReactNode }) {
  const t = useT();
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const items = DIWAN_NAV.filter((i) => can(staff, i.perm));
  const active = (href: string) => (href === "/diwan" ? path === "/diwan" : path === href || path.startsWith(href + "/"));
  const rw = roleWords(staff.role);
  const roleName = t(rw.en, rw.ar);
  /* the phone menu closes with Escape, and on any page change */
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  useEffect(() => setOpen(false), [path]);

  const signOut = async () => {
    await send("/api/diwan/auth/logout", "POST");
    window.location.href = "/diwan/login";
  };

  /* The sections fold. The one holding the page you are on opens by itself; a section you opened or closed stays that
     way (kept in this browser only, a convenience: without storage it simply starts from the page you are on). */
  const groups = (Object.keys(NAV_GROUPS) as NavGroup[]).filter((g) => items.some((i) => i.group === g));
  const here = items.find((i) => i.group && active(i.href))?.group ?? null;
  const [folds, setFolds] = useState<Partial<Record<NavGroup, boolean>>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOLDS_KEY) ?? "{}");
      if (saved && typeof saved === "object") setFolds(saved);
    } catch {
      /* storage blocked or unreadable: start from the page you are on */
    }
  }, []);
  /* going to a page in a section you had closed opens it again (watching the address too: a shop's page and the shop
     list are both in Stores, so the section alone would not change) */
  useEffect(() => {
    if (here) setFolds((f) => (f[here] === false ? { ...f, [here]: true } : f));
  }, [here, path]);
  const isOpen = (g: NavGroup) => folds[g] ?? g === here;
  const toggle = (g: NavGroup) =>
    setFolds((f) => {
      const next = { ...f, [g]: !(f[g] ?? g === here) };
      try {
        localStorage.setItem(FOLDS_KEY, JSON.stringify(next));
      } catch {
        /* not kept, still works */
      }
      return next;
    });

  const link = (i: (typeof items)[number]) => {
    const on = active(i.href);
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={on ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-lg py-2 pe-3 ps-3 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          on ? "bg-card font-semibold text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-fg/[0.07]" : "text-fg/70 hover:bg-fg/[0.04] hover:text-fg"
        }`}
      >
        <Icon name={iconForPath(i.href)} className={`h-[18px] w-[18px] shrink-0 ${on ? "text-primary" : "text-fg/45"}`} strokeWidth={on ? 1.9 : 1.6} />
        <span className="truncate">{t(i.en, i.ar)}</span>
        {/* the page you are on: a small arch, Diwan's doorway */}
        {on && <ArchMarker className="ms-auto h-3 w-2.5 shrink-0 text-primary" />}
      </Link>
    );
  };

  const nav = (
    <nav className="flex flex-col px-3 py-5">
      {/* Overview stands alone, above the sections */}
      <div className="space-y-px">{items.filter((i) => !i.group).map(link)}</div>
      <div className="mt-4 space-y-1 border-t border-fg/[0.08] pt-4">
        {groups.map((g) => {
          const list = items.filter((i) => i.group === g);
          const openG = isOpen(g);
          return (
            <div key={g}>
              <button
                type="button"
                onClick={() => toggle(g)}
                aria-expanded={openG}
                aria-controls={`diwan-nav-${g}`}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13.5px] font-semibold transition-colors hover:bg-fg/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  g === here ? "text-fg" : "text-fg/65"
                }`}
              >
                <span className="flex-1 truncate">{t(NAV_GROUPS[g].en, NAV_GROUPS[g].ar)}</span>
                {/* closed: how many pages are inside, and a teal dot when the page you are on is one of them */}
                {!openG && g === here && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />}
                {!openG && <span className="text-[11px] font-medium tabular-nums text-muted">{list.length}</span>}
                <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-fg/40 transition-transform duration-200 ${openG ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openG && (
                <div id={`diwan-nav-${g}`} className="mb-2 ms-4 mt-px space-y-px border-s border-fg/10 ps-2">
                  {list.map(link)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <StaffContext.Provider value={staff}>
      <div className={`min-h-screen text-fg ${PAPER}`}>
        <header className="sticky top-0 z-30 border-b border-black/20 bg-bar text-white">
          <div className="flex h-14 items-center gap-3 px-4">
            <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={t("Menu", "القائمة")} aria-expanded={open} aria-controls="diwan-menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/diwan" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              <DiwanMark className="h-7 w-7 text-white" />
              {/* the name in Ruq'ah, in both languages; then, quietly, what it is */}
              <span lang="ar" className="translate-y-[-1px] text-[23px] leading-none text-white" style={RUQAA}>
                الديوان
              </span>
              <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden />
              <span className="hidden text-[12px] leading-tight text-white/65 sm:block">
                <span className="block font-semibold text-white/90">{t("Diwan", "ديوان دكّان")}</span>
                {t("Dukkan's staff console", "لوحة فريق العمل")}
              </span>
            </Link>
            <div className="ms-auto flex items-center gap-2">
              <LangSwitch iconOnly onDark />
              <ThemeToggle onDark />
              <span className="hidden border-s border-white/15 ps-3 text-start text-xs leading-tight md:block">
                <span className="block font-semibold">{staff.name}</span>
                <span className="text-white/60">{roleName}</span>
              </span>
              <button onClick={signOut} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                {t("Sign out", "خروج")}
              </button>
            </div>
          </div>
        </header>
        <div className="flex">
          <aside className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-e border-fg/[0.08] lg:block ${PAPER}`}>{nav}</aside>
          {open && (
            <div className="fixed inset-0 top-14 z-20 bg-black/35 lg:hidden" onClick={() => setOpen(false)}>
              <aside id="diwan-menu" className={`h-full w-72 max-w-[85vw] overflow-y-auto shadow-xl ${PAPER}`} onClick={(e) => e.stopPropagation()}>
                {/* on a phone the top bar has no room for who is signed in */}
                <div className="border-b border-fg/10 px-7 py-3 text-xs md:hidden">
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-muted">{roleName}</p>
                </div>
                {nav}
              </aside>
            </div>
          )}
          <main className="min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-8 lg:px-12">{children}</main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
