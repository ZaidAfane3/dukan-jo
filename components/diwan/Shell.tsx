"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "../Prefs";
import { DiwanMark, GROUP_ICON, Icon, iconForPath } from "./icons";
import { DIWAN_NAV, NAV_GROUPS, type NavGroup } from "./nav";
import { can, roleName as roleWords, type Role } from "./perms";
import { send, StaffContext, useT } from "./ui";

export type ShellStaff = { name: string; email: string; role: Role };

/* Diwan's look. A diwan is the hall where guests are received; its doorway, the pointed arch, is the one shape Diwan
   repeats (the mark and the welcome's window). The page is warm paper in the light and
   Dukkan's warm dark in the dark; orange is for what is chosen; saffron only for what needs someone (ui.tsx ATTENTION).
   The name is set in Ruq'ah, the hand of Arabic letters and signs. The rest stays quiet: it is a work tool, so the top
   bar is the same paper as the page, with orange only for the mark. */
const RUQAA = { fontFamily: "var(--font-ruqaa), var(--font-sans)" };
/** Diwan's paper: a warm off-white in the light, the app's own page colour in the dark */
export const PAPER = "bg-[#f6f2ea] dark:bg-page";
/* which sidebar sections this browser keeps open, the one opened last at the end */
const OPEN_KEY = "diwan-nav-open";
/* whether this browser keeps the sidebar slim (icons only) */
const RAIL_KEY = "diwan-nav-rail";
/* at most this many sections are open at once: opening one more closes the one opened longest ago */
const MAX_OPEN = 2;

/** Adds a section to the open ones as the newest, closing the oldest when there would be too many */
const withOpen = (list: NavGroup[], g: NavGroup | null) => (!g || list.includes(g) ? list : [...list, g].slice(-MAX_OPEN));

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
  /* the tab's title in the staff's language, with the page's name (the menu's own words); set again on every page
     change and language switch. Overview, and pages that are not in the menu, keep Diwan's own line. */
  const pageName = DIWAN_NAV.filter((i) => i.href !== "/diwan").find((i) => active(i.href));
  const tabTitle = pageName ? t(`Diwan | ${pageName.en}`, `ديوان | ${pageName.ar}`) : t("Diwan | Dukkan staff", "ديوان | فريق دكّان");
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);

  const signOut = async () => {
    await send("/api/diwan/auth/logout", "POST");
    window.location.href = "/diwan/login";
  };

  /* The sections fold, and no more than two are open at once, so the menu stays short: opening a third closes the one
     opened longest ago. The section holding the page you are on opens by itself. The open sections are kept in this
     browser only, a convenience: without storage the menu simply starts from the page you are on. */
  const groups = (Object.keys(NAV_GROUPS) as NavGroup[]).filter((g) => items.some((i) => i.group === g));
  const here = items.find((i) => i.group && active(i.href))?.group ?? null;
  const [openList, setOpenList] = useState<NavGroup[]>(here ? [here] : []);
  /* the sidebar can be made slim, icons only, to give the page more room; also kept in this browser only */
  const [rail, setRail] = useState(false);
  /* the slim sidebar slides only when someone asks for it, not when the page opens with it already slim */
  const [railReady, setRailReady] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        const kept = saved.filter((g): g is NavGroup => groups.includes(g)).slice(-MAX_OPEN);
        setOpenList((l) => withOpen(kept, here ?? l[0] ?? null));
      }
      setRail(localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      /* storage blocked or unreadable: start from the page you are on, with the full sidebar */
    }
    setRailReady(true);
  }, []);
  /* going to a page in a section that is closed opens it again (watching the address too: a shop's page and the shop
     list are both in Stores, so the section alone would not change) */
  useEffect(() => {
    setOpenList((l) => withOpen(l, here));
  }, [here, path]);
  const isOpen = (g: NavGroup) => openList.includes(g);
  const toggle = (g: NavGroup) =>
    setOpenList((l) => {
      const next = l.includes(g) ? l.filter((x) => x !== g) : withOpen(l, g);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* not kept, still works */
      }
      return next;
    });
  const flipRail = () =>
    setRail((r) => {
      try {
        localStorage.setItem(RAIL_KEY, r ? "0" : "1");
      } catch {
        /* not kept, still works */
      }
      return !r;
    });

  /* a page in the menu; in the slim sidebar only its icon shows, and its name is in the tooltip and for screen readers */
  const link = (i: (typeof items)[number], slim = false) => {
    const on = active(i.href);
    const label = t(i.en, i.ar);
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={on ? "page" : undefined}
        aria-label={slim ? label : undefined}
        title={slim ? label : undefined}
        className={`relative flex items-center rounded-lg py-2 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          slim ? "justify-center px-0" : "gap-3 pe-3 ps-3"
        } ${on ? "bg-card font-semibold text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-fg/[0.07]" : "text-fg/70 hover:bg-fg/[0.04] hover:text-fg"}`}
      >
        <Icon name={iconForPath(i.href)} className={`h-[18px] w-[18px] shrink-0 ${on ? "text-primary" : "text-fg/45"}`} strokeWidth={on ? 1.9 : 1.6} />
        {!slim && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  /* The menu. Full: Overview alone at the top, then the sections that fold. Slim: every page as an icon, the sections
     told apart by a thin line. */
  const nav = (slim: boolean) => (
    <nav className={`flex flex-col py-5 ${slim ? "px-2.5" : "px-3"}`} aria-label={t("Diwan menu", "قائمة الديوان")}>
      {/* Overview stands alone, above the sections */}
      <div className="space-y-px">{items.filter((i) => !i.group).map((i) => link(i, slim))}</div>
      {slim ? (
        <div className="mt-4 space-y-2 border-t border-fg/[0.08] pt-2">
          {groups.map((g, n) => (
            <div key={g} role="group" aria-label={t(NAV_GROUPS[g].en, NAV_GROUPS[g].ar)} className={`space-y-px ${n ? "border-t border-fg/[0.08] pt-2" : ""}`}>
              {items.filter((i) => i.group === g).map((i) => link(i, true))}
            </div>
          ))}
        </div>
      ) : (
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
                  <Icon name={GROUP_ICON[g]} className={`h-[18px] w-[18px] shrink-0 ${g === here ? "text-primary" : "text-fg/45"}`} strokeWidth={1.7} />
                  <span className="flex-1 truncate">{t(NAV_GROUPS[g].en, NAV_GROUPS[g].ar)}</span>
                  {/* closed: how many pages are inside, and an orange dot when the page you are on is one of them */}
                  {!openG && g === here && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  {!openG && <span className="text-[11px] font-medium tabular-nums text-muted">{list.length}</span>}
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-fg/40 transition-transform duration-200 ${openG ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {openG && (
                  <div id={`diwan-nav-${g}`} className="mb-2 ms-4 mt-px space-y-px border-s border-fg/10 ps-2">
                    {list.map((i) => link(i))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );

  const railWord = rail ? t("Expand sidebar", "توسيع القائمة") : t("Collapse sidebar", "طيّ القائمة");

  return (
    <StaffContext.Provider value={staff}>
      <div className={`min-h-screen text-fg ${PAPER}`}>
        <header className={`sticky top-0 z-30 border-b border-fg/[0.08] ${PAPER}`}>
          <div className="flex h-14 items-center gap-3 px-4">
            <button className="rounded-lg p-2 text-fg/70 hover:bg-fg/[0.05] hover:text-fg lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={t("Menu", "القائمة")} aria-expanded={open} aria-controls="diwan-menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/diwan" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <DiwanMark className="h-7 w-7 text-primary" />
              {/* the name in Ruq'ah, in both languages; then, quietly, what it is */}
              <span lang="ar" className="translate-y-[-1px] text-[23px] leading-none text-fg" style={RUQAA}>
                الديوان
              </span>
              <span className="hidden h-6 w-px bg-fg/15 sm:block" aria-hidden />
              <span className="hidden text-[12px] leading-tight text-muted sm:block">
                <span className="block font-semibold text-fg/85">{t("Diwan", "ديوان دكّان")}</span>
                {t("Dukkan's staff console", "لوحة فريق العمل")}
              </span>
            </Link>
            <div className="ms-auto flex items-center gap-2">
              <LangSwitch iconOnly />
              <ThemeToggle />
              <span className="hidden border-s border-fg/10 ps-3 text-start text-xs leading-tight md:block">
                <span className="block font-semibold">{staff.name}</span>
                <span className="text-muted">{roleName}</span>
              </span>
              <button onClick={signOut} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fg/70 transition-colors hover:bg-fg/[0.05] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {t("Sign out", "خروج")}
              </button>
            </div>
          </div>
        </header>
        <div className="flex">
          {/* The sidebar: as tall as the window under the top bar, it stays put while the page scrolls and scrolls on its own
              (with a thin scrollbar that shows only under the mouse, globals.css .diwan-scroll). The button at its foot
              makes it slim toward its own edge: the left in English, the right in Arabic. */}
          <aside
            className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-hidden border-e border-fg/[0.08] lg:flex ${rail ? "w-[4.5rem]" : "w-64"} ${
              railReady ? "transition-[width] duration-200 ease-out motion-reduce:transition-none" : ""
            } ${PAPER}`}
          >
            <div id="diwan-sidebar" className="diwan-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {nav(rail)}
            </div>
            <div className={`border-t border-fg/[0.08] py-2 ${rail ? "px-2.5" : "px-3"}`}>
              <button
                type="button"
                onClick={flipRail}
                aria-label={railWord}
                title={rail ? railWord : undefined}
                aria-expanded={!rail}
                aria-controls="diwan-sidebar"
                className={`flex w-full items-center rounded-lg py-2 text-[13px] font-medium text-fg/55 transition-colors hover:bg-fg/[0.04] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  rail ? "justify-center px-0" : "gap-3 px-3"
                }`}
              >
                {/* a panel with an arrow toward its edge (or away from it, to open); mirrored in Arabic, where the sidebar is on the right */}
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d={rail ? "m14 9 3 3-3 3" : "m16 15-3-3 3-3"} />
                </svg>
                {!rail && <span className="truncate">{railWord}</span>}
              </button>
            </div>
          </aside>
          {open && (
            <div className="fixed inset-0 top-14 z-20 bg-black/35 lg:hidden" onClick={() => setOpen(false)}>
              <aside id="diwan-menu" className={`diwan-scroll h-full w-72 max-w-[85vw] overflow-y-auto shadow-xl ${PAPER}`} onClick={(e) => e.stopPropagation()}>
                {/* on a phone the top bar has no room for who is signed in */}
                <div className="border-b border-fg/10 px-7 py-3 text-xs md:hidden">
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-muted">{roleName}</p>
                </div>
                {nav(false)}
              </aside>
            </div>
          )}
          <main className="min-w-0 flex-1 px-4 pb-16 pt-8 sm:px-8 lg:px-12">{children}</main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
