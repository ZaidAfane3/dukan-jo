import type { NextRequest } from "next/server";

/* The language someone uses Dukkan in. The page keeps it in the browser (localStorage "seen-lang") and in a cookie of the
   same name (components/Prefs.tsx), so the server can read it when they sign in. It is saved on their account (accounts.lang,
   staff.lang) and the emails sent while they are away (notices, staff changes) go out in it alone. */

export type SiteLang = "ar" | "en";
export const LANG_COOKIE = "seen-lang";

export const langOf = (v: unknown): SiteLang | null => (v === "ar" || v === "en" ? v : null);

/** The language in this request's cookie, or null when the browser never chose one */
export const cookieLang = (req: NextRequest): SiteLang | null => langOf(req.cookies.get(LANG_COOKIE)?.value);
