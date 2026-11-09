"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "../Prefs";
import { ArchMarker, DiwanMark, Icon, iconForPath } from "./icons";
import { DIWAN_NAV, NAV_GROUPS } from "./nav";
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

  const nav = (
    <nav className="flex flex-col gap-7 px-4 py-6">
      {(Object.keys(NAV_GROUPS) as (keyof typeof NAV_GROUPS)[]).map((g) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            {/* the group's name in quiet small capitals (English) or plain (Arabic), with a hairline to the edge */}
            <p className="mb-2 flex items-center gap-3 ps-3 text-[13px] font-medium text-muted [font-variant-caps:all-small-caps] tracking-[0.04em]">
              <span className="shrink-0">{t(NAV_GROUPS[g].en, NAV_GROUPS[g].ar)}</span>
              <span aria-hidden className="h-px flex-1 bg-fg/10" />
            </p>
            <div className="space-y-px">
              {list.map((i) => {
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
              })}
            </div>
          </div>
        );
      })}
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
