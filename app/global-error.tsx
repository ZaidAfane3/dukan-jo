"use client";

import { useState } from "react";
import { LoadErrorPage, savedPrefs } from "@/components/LoadError";
import "./globals.css";

/* When even the site's frame fails (app/layout.tsx; every other failure is app/error.tsx's): this page replaces the
   whole document, so it brings its own <html> and reads the saved language and look itself (no PrefsProvider here). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [prefs] = useState(savedPrefs);
  return (
    <html lang={prefs.lang} dir={prefs.lang === "ar" ? "rtl" : "ltr"} data-theme={prefs.dark ? "dark" : "light"}>
      <body>
        <LoadErrorPage error={error} lang={prefs.lang} />
      </body>
    </html>
  );
}
