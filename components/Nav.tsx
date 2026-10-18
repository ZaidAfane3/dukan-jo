"use client";

import { useEffect, useState } from "react";
import { LangSwitch, ThemeToggle, usePrefs } from "./Prefs";

const linkDefs = [
  { key: "solutions", href: "#solutions" },
  { key: "industries", href: "#industries" },
  { key: "themes", href: "#design" },
  { key: "pricing", href: "#pricing" },
] as const;

export function Logo() {
  return (
    <a href="#" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-fg">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      </span>
      Seen
    </a>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = usePrefs();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-lg transition-all duration-300 ${
        scrolled ? "bg-card/80 shadow-[0_1px_0_rgba(20,18,58,0.08)]" : "bg-soft/70"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <ul className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          {linkDefs.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-fg">
                {t[l.key]}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          <ThemeToggle />
          <a href="#" className="hidden rounded-lg border border-fg/15 px-4 py-2 text-sm font-semibold transition hover:bg-card sm:block">
            {t.login}
          </a>
          <a href="#" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep">
            {t.start}
          </a>
        </div>
      </nav>
    </header>
  );
}
