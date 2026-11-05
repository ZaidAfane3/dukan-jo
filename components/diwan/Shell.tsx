"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle } from "../Prefs";
import { DIWAN_NAV, NAV_GROUPS } from "./nav";
import { can, type Role } from "./perms";
import { send, useT } from "./ui";

export type ShellStaff = { name: string; email: string; role: Role };

/** Diwan's frame: the sidebar (only the pages this role may open), the top bar and the page. */
export function DiwanShell({ staff, children }: { staff: ShellStaff; children: React.ReactNode }) {
  const t = useT();
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const items = DIWAN_NAV.filter((i) => can(staff, i.perm));
  const active = (href: string) => (href === "/diwan" ? path === "/diwan" : path === href || path.startsWith(href + "/"));
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
    <nav className="flex flex-col gap-5 p-4">
      {(Object.keys(NAV_GROUPS) as (keyof typeof NAV_GROUPS)[]).map((g) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{t(NAV_GROUPS[g].en, NAV_GROUPS[g].ar)}</p>
            {list.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${active(i.href) ? "bg-primary text-white" : "hover:bg-soft"}`}
              >
                {t(i.en, i.ar)}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-page text-fg">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-bar px-4 text-white">
        <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={t("Menu", "القائمة")} aria-expanded={open} aria-controls="diwan-menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/diwan" className="flex items-baseline gap-2 font-bold">
          <span className="text-lg text-white">{t("Diwan", "الديوان")}</span>
          <span className="hidden text-xs font-medium text-white/70 sm:inline">{t("Dukkan staff", "فريق دكّان")}</span>
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <LangSwitch iconOnly onDark />
          <ThemeToggle onDark />
          <span className="hidden text-end text-xs leading-tight md:block">
            <span className="block font-semibold">{staff.name}</span>
            <span className="text-white/70">{staff.role === "owner" ? t("Owner", "المالك") : t("Support", "الدعم")}</span>
          </span>
          <button onClick={signOut} className="rounded-xl border border-white/25 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10">
            {t("Sign out", "خروج")}
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-e border-fg/10 bg-card lg:block">{nav}</aside>
        {open && (
          <div className="fixed inset-0 top-14 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
            <aside id="diwan-menu" className="h-full w-64 max-w-[85vw] overflow-y-auto bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
              {/* on a phone the top bar has no room for who is signed in */}
              <div className="border-b border-fg/10 px-7 py-3 text-xs md:hidden">
                <p className="font-semibold">{staff.name}</p>
                <p className="text-muted">{staff.role === "owner" ? t("Owner", "المالك") : t("Support", "الدعم")}</p>
              </div>
              {nav}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
