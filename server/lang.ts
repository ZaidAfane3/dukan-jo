import type { NextRequest } from "next/server";

/* The language someone uses Dukkan in. The page keeps it in the browser (localStorage "seen-lang") and in a cookie of the
   same name (components/Prefs.tsx). It is saved on their account (accounts.lang, staff.lang) at every sign-in (the cookie,
   server/auth.ts noteLogin, server/staff.ts) and again each time they switch language while signed in (app/api/prefs/lang),
   so the emails sent while they are away (notices, staff changes) always go out in the language they use now. */

export type SiteLang = "ar" | "en";
export const LANG_COOKIE = "seen-lang";

export const langOf = (v: unknown): SiteLang | null => (v === "ar" || v === "en" ? v : null);

/** The language in this request's cookie, or null when the browser never chose one */
export const cookieLang = (req: NextRequest): SiteLang | null => langOf(req.cookies.get(LANG_COOKIE)?.value);
