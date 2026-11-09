"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { Lang } from "./content";
import { usePrefs } from "./Prefs";
import { cleanSiteContent, localize, SITE_DEFAULTS, type SiteContent, type SiteView } from "./siteContent";

/* How the landing page reads the words Diwan edits (components/siteContent.ts). The first paint uses SITE_DEFAULTS
   (today's texts) so it is never empty and the server and the browser draw the same thing; the saved content is then
   fetched once per page load and kept here, so every section, and a return to the page later, uses the same copy without
   asking again. If the fetch fails the page simply keeps the defaults. */

let cache: SiteContent | null = null;
let pending: Promise<SiteContent> | null = null;

function load(): Promise<SiteContent> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/api/platform/site", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    /* cleaned again here: whatever the answer holds, only safe links and texts reach the page */
    .then((j) => (cache = j ? cleanSiteContent(j).content : SITE_DEFAULTS))
    .catch(() => SITE_DEFAULTS)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/* Diwan's preview puts a draft (and the language to show it in) here, so the same components draw what is being edited
   before it is saved. */
const Forced = createContext<{ content: SiteContent; lang: Lang } | null>(null);

export function SiteContentProvider({ content, lang, children }: { content: SiteContent; lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ content, lang }), [content, lang]);
  return createElement(Forced.Provider, { value }, children);
}

/** The landing page's content in both languages */
export function useSiteContent(): SiteContent {
  const forced = useContext(Forced);
  const [content, setContent] = useState<SiteContent>(() => cache ?? SITE_DEFAULTS);
  useEffect(() => {
    if (forced) return;
    let alive = true;
    load().then((c) => alive && setContent(c));
    return () => {
      alive = false;
    };
  }, [forced]);
  return forced?.content ?? content;
}

/** The language the content is shown in: the visitor's, or the one Diwan's preview asks for */
export function useSiteLang(): Lang {
  const forced = useContext(Forced);
  const { lang } = usePrefs();
  return forced?.lang ?? lang;
}

/** The content in the language on screen, plus that language */
export function useSite(): { s: SiteView; lang: Lang } {
  const content = useSiteContent();
  const lang = useSiteLang();
  const s = useMemo(() => localize(content, lang), [content, lang]);
  return { s, lang };
}

/** Puts the landing page's title and description (Diwan > Website > Search engines) on the page, in the language on
    screen. app/layout.tsx keeps the English ones as what the page is first sent with. */
export function SiteMeta() {
  const { s } = useSite();
  const { title, description } = s.seo;
  useEffect(() => {
    document.title = title;
    let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = description;
  }, [title, description]);
  return null;
}
