"use client";

import { LoadErrorPage } from "@/components/LoadError";
import { usePrefs } from "@/components/Prefs";

/* A Diwan page that fails while opening: the error is shown in the page's place and Diwan's menu stays, so staff can go
   on to another tab (components/LoadError.tsx; a page that didn't arrive is first loaded again by itself). */
export default function DiwanError({ error }: { error: Error & { digest?: string } }) {
  const { lang } = usePrefs();
  return <LoadErrorPage error={error} lang={lang} inside />;
}
