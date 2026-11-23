"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { decideTab, subscribeTab, tabState, tabTaking, takeThisTab, type TabState } from "./oneTab";
import { usePrefs } from "./Prefs";

const words = {
  en: {
    title: "Dukkan is open in another tab",
    body: "You can use Dukkan in one tab at a time, so your changes are never lost.",
    use: "Use here",
    taking: "Opening here…",
    close: "Or close this tab.",
  },
  ar: {
    title: "دكان مفتوح في تبويب آخر",
    body: "يمكنك استخدام دكان في تبويب واحد فقط في كل مرة، حتى لا تضيع تعديلاتك أبدًا.",
    use: "استخدمه هنا",
    taking: "جارٍ الفتح هنا…",
    close: "أو أغلق هذا التبويب.",
  },
};

/** Covers the whole page while another tab of this account is the active one (oneTab.ts). Mounted once, by DemoBoot,
    on every page: it shows nothing anywhere else. Decided before the page is first painted, so a normal single tab never
    sees it flash. Everything behind it is made inert. */
export function OtherTabScreen() {
  const { lang } = usePrefs();
  const pathname = usePathname();
  const [state, setState] = useState<TabState>("off");
  const [taking, setTaking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /* before the first paint, and again after moving to another page */
  useLayoutEffect(() => {
    decideTab();
    const sync = () => {
      setState(tabState());
      setTaking(tabTaking());
    };
    sync();
    return subscribeTab(sync);
  }, [pathname]);

  /* nothing behind the screen can be reached, by mouse or keyboard, and the page under it does not scroll */
  useEffect(() => {
    if (state !== "inactive") return;
    const others = Array.from(document.body.children).filter((el) => el !== box.current) as HTMLElement[];
    others.forEach((el) => el.setAttribute("inert", ""));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      others.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = overflow;
    };
  }, [state]);

  if (state !== "inactive") return null;
  const w = words[lang];
  return createPortal(
    <div ref={box} role="dialog" aria-modal="true" aria-labelledby="other-tab-title" className="dash fixed inset-0 z-[200] grid place-items-center bg-page p-4 text-fg">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl ring-1 ring-fg/10 sm:p-7">
        <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="13" height="11" rx="2" />
            <path d="M8 19h11a2 2 0 0 0 2-2V9" />
          </svg>
        </span>
        <h2 id="other-tab-title" className="mt-4 text-lg font-bold">{w.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{w.body}</p>
        <button
          type="button"
          autoFocus
          disabled={taking}
          onClick={() => void takeThisTab()}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-onink shadow-sm transition hover:bg-deep disabled:cursor-wait disabled:opacity-70"
        >
          {taking ? w.taking : w.use}
        </button>
        {/* a tab the merchant opened himself can't be closed by the page: only said */}
        <p className="mt-3 text-xs text-muted">{w.close}</p>
      </div>
    </div>,
    document.body,
  );
}
