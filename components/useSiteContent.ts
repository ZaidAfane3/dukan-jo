"use client";

import { useEffect, useMemo } from "react";
import type { Lang } from "./content";
import { usePrefs } from "./Prefs";
import { usePageTitle } from "./pageTitle";
import { localize, SITE_DEFAULTS, type SiteContent, type SiteView } from "./siteContent";

/* How the landing page reads its words (components/siteContent.ts). Since 2026-11-16 they come from the code only: the
   website is changed by editing siteContent.ts, not from Diwan, so nothing is fetched from the server and nothing saved
   in the database can change what the page says. The server and the browser therefore always draw the same thing. */

/** The landing page's content in both languages */
export function useSiteContent(): SiteContent {
  return SITE_DEFAULTS;
}

/** The language the content is shown in: the visitor's */
export function useSiteLang(): Lang {
  return usePrefs().lang;
}

/** The content in the language on screen, plus that language */
export function useSite(): { s: SiteView; lang: Lang } {
  const lang = useSiteLang();
  const s = useMemo(() => localize(SITE_DEFAULTS, lang), [lang]);
  return { s, lang };
}

/** Puts the landing page's title and description (the `seo` part of components/siteContent.ts) on the page, in the
    language on screen. app/layout.tsx keeps the English ones as what the page is first sent with. */
export function SiteMeta() {
  const { s } = useSite();
  const { title, description } = s.seo;
  usePageTitle(title);
  useEffect(() => {
    let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.name = "description";
      document.head.appendChild(m);
    }
    m.content = description;
  }, [description]);
  return null;
}
