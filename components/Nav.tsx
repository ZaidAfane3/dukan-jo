"use client";

import { useEffect, useRef, useState } from "react";
import { brandName } from "./content";
import { LangSwitch, ThemeToggle } from "./Prefs";
import { linkAttrs } from "./siteContent";
import { useSite, useSiteLang } from "./useSiteContent";

export function Logo({ light = false }: { light?: boolean }) {
  const lang = useSiteLang();
  return (
    <a href="/" data-nav-item className={`flex items-center gap-2 text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-fg"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
        </svg>
      </span>
      {brandName(lang)}
    </a>
  );
}

/* The Resources link opens a small menu with the help links (edited in Diwan > Website). A link with no address is left out. */
function ResourcesMenu() {
  const { s } = useSite();
  const reg = s.legal;
  const links = s.nav.resourceLinks.filter((l) => l.href && l.label);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (links.length === 0 && !reg.number) return null;
  return (
    <li ref={box} data-nav-item className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-1 transition-colors hover:text-fg">
        {s.nav.resources}
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul role="menu" className="absolute start-1/2 top-full z-50 mt-3 w-48 -translate-x-1/2 overflow-hidden rounded-2xl bg-card p-2 text-fg shadow-2xl ring-1 ring-fg/10 rtl:translate-x-1/2">
          {links.map((l, i) => (
            <li key={i}>
              <a {...linkAttrs(l.href)} role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-soft">
                {l.label}
              </a>
            </li>
          ))}
          {/* The same proof of trust as in the footer */}
          {reg.number && <li role="none" className="mt-1 border-t border-fg/10 pt-1">
            <a {...(reg.url ? linkAttrs(reg.url) : {})} role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-soft">
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/jo-ministry.png" alt="" className="h-6 w-auto" />
                {reg.verified}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {reg.label}: <span dir="ltr" className="font-semibold text-fg">{reg.number}</span>
              </span>
            </a>
          </li>}
        </ul>
      )}
    </li>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { s } = useSite();
  const nav = s.nav;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-lg transition-all duration-300 ${
        scrolled ? "bg-card/80 shadow-[0_1px_0_rgba(0,73,86,0.10)]" : "bg-soft/70"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <ul className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          {nav.links.filter((l) => l.href && l.label).map((l, i) => (
            <li key={i} data-nav-item>
              <a {...linkAttrs(l.href)} className="transition-colors hover:text-fg">
                {l.label}
              </a>
            </li>
          ))}
          <ResourcesMenu />
        </ul>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          <ThemeToggle />
          {nav.login.href && (
            <a {...linkAttrs(nav.login.href)} data-nav-item className="hidden rounded-lg border border-fg/15 px-4 py-2 text-sm font-semibold transition hover:bg-card sm:block">
              {nav.login.label}
            </a>
          )}
          {nav.start.href && (
            <a {...linkAttrs(nav.start.href)} data-nav-item className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep">
              {nav.start.label}
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}
