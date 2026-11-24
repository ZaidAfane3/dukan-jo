"use client";

import { LoadErrorPage } from "@/components/LoadError";
import { usePrefs } from "@/components/Prefs";

/* Any page that fails while opening (the merchant dashboard, the site's pages, a store): Dukkan's own error page in the
   visitor's language, and one reload by itself when part of the page didn't arrive (components/LoadError.tsx). */
export default function PageError({ error }: { error: Error & { digest?: string } }) {
  const { lang } = usePrefs();
  return <LoadErrorPage error={error} lang={lang} />;
}
