"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { logOut, readyToLogOut } from "./accounts";
import type { Lang } from "./content";
import { signedInAs } from "./demoSandbox";

/* "Log out", wherever the merchant chooses it (the account menu, the sign-in page's guest button). A log out makes this
   browser forget the account (accounts.ts logOut, forgetAccount.ts), so first everything still waiting is sent and
   waited for. When something could not be sent (no connection, the server not answering), he is asked: wait and try
   again, or log out anyway and lose it. His support ticket drafts are kept only in this browser and never sent: when he
   has some, he is told they will be removed and asked once. Asked in the page: the dashboard never uses the browser's
   own windows. */

const words = {
  en: {
    saving: "Saving your changes before logging out…",
    leaving: "Logging out…",
    unsaved: "You have changes that aren't saved yet",
    unsavedBody: "They couldn't reach Dukkan. Check your connection, then try again. If you log out now, they'll be lost.",
    retry: "Wait and try again",
    retrying: "Trying again…",
    anyway: "Log out anyway",
    confirm: "Log out?",
    logout: "Log out",
    cancel: "Cancel",
    drafts: (n: number) => (n === 1 ? "Your ticket draft on this device will be removed." : `Your ${n} ticket drafts on this device will be removed.`),
  },
  ar: {
    saving: "جارٍ حفظ تغييراتك قبل تسجيل الخروج…",
    leaving: "جارٍ تسجيل الخروج…",
    unsaved: "لديك تغييرات لم تُحفظ بعد",
    unsavedBody: "تعذّر إرسالها إلى دكان. تحقق من اتصالك ثم حاول مجددًا. إذا سجّلت الخروج الآن فستضيع.",
    retry: "انتظر وحاول مجددًا",
    retrying: "جارٍ المحاولة…",
    anyway: "سجّل الخروج على أي حال",
    confirm: "تسجيل الخروج؟",
    logout: "تسجيل الخروج",
    cancel: "إلغاء",
    drafts: (n: number) => (n === 1 ? "ستُحذف مسودة التذكرة المحفوظة على هذا الجهاز." : n === 2 ? "ستُحذف مسودتا التذاكر المحفوظتان على هذا الجهاز." : `ستُحذف مسودات التذاكر المحفوظة على هذا الجهاز (${n}).`),
  },
};

type Ask = { saved: boolean; drafts: number };

/** The log out with its questions. `start(then)` begins it; `then` runs once the account is signed out (where the page
    goes next). `dialog` is drawn by the page, outside anything that closes meanwhile (a menu). */
export function useLogOut(lang: Lang) {
  const t = words[lang];
  /* sending what waits before anything is asked */
  const [checking, setChecking] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [retrying, setRetrying] = useState(false);
  /* the log out itself (the server told, at most 5 s: accounts.ts logOut) */
  const [leaving, setLeaving] = useState(false);
  const then = useRef<() => void>(() => {});
  const running = useRef(false);
  const first = useRef<HTMLButtonElement>(null);

  const finish = async () => {
    setAsk(null);
    setLeaving(true);
    try {
      await logOut();
    } finally {
      running.current = false;
      setLeaving(false);
      then.current();
    }
  };

  /* sends what waits (at most `waitMs`), then logs out, or asks when something could not go or drafts would be removed */
  const check = async (waitMs?: number): Promise<Ask> => {
    const r = await readyToLogOut(waitMs);
    if (r.saved && !r.drafts) void finish();
    else setAsk(r);
    return r;
  };

  const start = (after: () => void) => {
    if (running.current) return;
    then.current = after;
    /* nobody signed in (the guest button, the tour): nothing to send or to ask */
    if (!signedInAs()) {
      void logOut();
      after();
      return;
    }
    running.current = true;
    setChecking(true);
    void check().finally(() => setChecking(false));
  };

  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    /* he chose to wait: longer than the first time */
    void check(15_000).finally(() => setRetrying(false));
  };

  /* staying signed in: nothing is lost, the waiting changes go on trying by themselves */
  const stay = () => {
    if (retrying) return;
    setAsk(null);
    running.current = false;
  };

  useEffect(() => {
    if (ask) first.current?.focus();
  }, [ask]);

  const btn = "h-11 flex-1 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60";
  const dialog = checking || leaving ? (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <p role="status" className="dash rounded-2xl bg-card px-5 py-4 text-sm font-semibold text-fg shadow-2xl ring-1 ring-fg/10">{checking ? t.saving : t.leaving}</p>
    </div>
  ) : ask ? (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && stay()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-ask"
        aria-describedby="logout-body"
        onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), stay())}
        className="dash my-8 w-full max-w-md rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10"
      >
        <p id="logout-ask" className="text-base font-bold leading-relaxed">{ask.saved ? t.confirm : t.unsaved}</p>
        <div id="logout-body" className="mt-1 space-y-1 text-sm text-muted">
          {!ask.saved && <p>{t.unsavedBody}</p>}
          {ask.drafts > 0 && <p>{t.drafts(ask.drafts)}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {ask.saved ? (
            <>
              <button type="button" onClick={() => void finish()} className={`${btn} border border-rose-500/50 text-rose-600 hover:bg-rose-500/10`}>{t.logout}</button>
              <button ref={first} type="button" onClick={stay} className={`${btn} border border-fg/20 hover:bg-soft`}>{t.cancel}</button>
            </>
          ) : (
            <>
              <button ref={first} type="button" onClick={retry} disabled={retrying} aria-busy={retrying} className={`${btn} bg-ink text-onink hover:bg-deep`}>{retrying ? t.retrying : t.retry}</button>
              <button type="button" onClick={() => void finish()} disabled={retrying} className={`${btn} border border-rose-500/50 text-rose-600 hover:bg-rose-500/10`}>{t.anyway}</button>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  /* drawn at the page's root: a bar with a blur or a transform would hold a fixed layer inside itself */
  return { start, dialog: dialog && typeof document !== "undefined" ? createPortal(dialog, document.body) : null, busy: checking || leaving || !!ask };
}
