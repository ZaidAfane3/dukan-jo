"use client";

import { useEffect } from "react";

/* The browser tab's title of a merchant or landing page, in the language on screen.

   Each page's file (app/<page>/page.tsx) sends a fixed title with the page (Next's `metadata`, in Arabic: the language
   every page is first drawn in). Next can put that <title> in the page after the page has already set its own (the
   metadata streams in, or is drawn again on a move inside the app), and the tab then kept the fixed one: "Dukkan |
   Create account" on an Arabic page. So the page's title is set when the page opens and whenever its language changes,
   and put back whenever something else replaces it while the page is open.

   One watcher for the whole tab; the page opened last is the one whose title shows (during a move inside the app the
   new page's title wins, and if two were ever open at once the one under it comes back when the top one closes). */

const open: { title: string }[] = [];
let watcher: MutationObserver | null = null;

function apply() {
  const top = open[open.length - 1];
  if (top && document.title !== top.title) document.title = top.title;
}

/** Keeps the tab's title at `title` while the component is on the page (setting it again when `title` changes). */
export function usePageTitle(title: string) {
  useEffect(() => {
    const me = { title };
    open.push(me);
    apply();
    if (!watcher && typeof MutationObserver !== "undefined") {
      /* a <title> added or its words changed by someone else: ours goes back (setting it here changes it to the same
         words, so this stops at once) */
      watcher = new MutationObserver(apply);
      watcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    return () => {
      const i = open.indexOf(me);
      if (i >= 0) open.splice(i, 1);
      if (open.length) apply();
      else {
        watcher?.disconnect();
        watcher = null;
      }
    };
  }, [title]);
}
