/* The names shared by the page's first script (components/loadFailScript.ts) and the pages' error pages
   (components/LoadError.tsx), kept apart from that script so the pages' code doesn't carry its text. */

/** The note in this tab that a page was just loaded again because of a failed file (read and written by both) */
export const RELOADED = "dukkan-reloaded";
/** How long that note stops a second reload of the same page */
export const AGAIN_AFTER = 60_000;
/** Set on window by PrefsProvider once the page's code is running */
export const UP = "__dukkanUp";
