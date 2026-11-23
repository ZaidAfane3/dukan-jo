"use client";

import { useEffect, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { merchantCall, onServer } from "./merchantApi";
import { NOTIFY_CHANNELS, NOTIFY_EVENTS, OLD_LOCAL_KEY, fromOldLocal, fullNotifyPrefs, defaultNotifyPrefs, notifyLive, type NotifyChannel, type NotifyEvent, type NotifyPrefs } from "./notifyPrefs";
import { usePrefs } from "./Prefs";
import { bounceIfSuspended } from "./suspended";
import { dropUndos, offerUndo } from "./undo";
import { usePageTitle } from "./pageTitle";

/* Which events should reach him by email (and, later, by WhatsApp: each one has its own switch).
   A signed-in merchant's choices are kept on Dukkan's server (/api/notification-prefs, table notification_prefs), and
   server/notify.ts reads the email switch of an event before it emails him about it. Only the switches that do something
   today can be flipped (notifyPrefs.ts notifyLive: new orders and the two stock alerts, by email). WhatsApp is not built,
   and customers can't send ratings or questions to Dukkan yet, so those switches are shown off, can't be flipped and
   say "Coming soon"; what was saved for them before stays saved as it was. Each switch is saved as it is flipped (shown
   at once, put back if the server refuses it). Choices this browser kept before that are handed to the server once, if
   it has none yet, then forgotten here. In the tour (or signed out) nothing is sent: the choices stay in this browser's
   storage, as before (the tour's storage is its own copy, demoSandbox.ts). The bell shows every event whatever he
   chose here: it is his record of what happened. */

const rows: Record<"en" | "ar", Record<NotifyEvent, string>> = {
  en: {
    newOrder: "New orders",
    storeRating: "Store rating",
    productRating: "Product rating",
    shippingRating: "Shipping company rating",
    customerQuestion: "A question from a customer",
    lowStock: "A product is almost out of stock",
    outOfStock: "Products have run out",
  },
  ar: {
    newOrder: "طلبات جديدة",
    storeRating: "تقييم المتجر",
    productRating: "تقييم المنتجات",
    shippingRating: "تقييم شركة الشحن",
    customerQuestion: "إرسال سؤال من عميل",
    lowStock: "تنبيه قرب انتهاء كمية منتج",
    outOfStock: "نبهني عند نفاد كمية المنتجات",
  },
};

const copy = {
  en: {
    title: "Customize notifications",
    tab: "Customize notifications",
    type: "Notification type",
    whatsapp: "WhatsApp",
    email: "Email",
    saved: "Saved",
    savedLocal: "Saved on this device",
    failed: "Couldn't save. Check your connection and try again.",
    loading: "Loading your choices…",
    loadFailed: "Couldn't load your choices. Check your connection and try again.",
    retry: "Try again",
    hint: "Choose which events Dukkan emails you about. Every one also shows in the bell, whatever you choose.",
    notYet: "WhatsApp messages, ratings and customer questions are coming soon.",
    soon: "Coming soon",
    /* the undo note at the bottom (UndoToast.tsx) */
    undoOn: (ch: string, row: string) => `${ch} turned on for “${row}”`,
    undoOff: (ch: string, row: string) => `${ch} turned off for “${row}”`,
  },
  ar: {
    title: "تخصيص الإشعارات",
    tab: "تخصيص الإشعارات",
    type: "نوع الإشعار",
    whatsapp: "واتساب",
    email: "البريد الإلكتروني",
    saved: "تم الحفظ",
    savedLocal: "تم الحفظ على هذا الجهاز",
    failed: "تعذّر الحفظ. تحقق من اتصالك وحاول مجددًا.",
    loading: "جارٍ تحميل اختياراتك…",
    loadFailed: "تعذّر تحميل اختياراتك. تحقق من اتصالك وحاول مجددًا.",
    retry: "حاول مجددًا",
    hint: "اختر الأحداث التي يرسل لك دكان عنها بريدًا إلكترونيًا. كلها تظهر أيضًا في الإشعارات مهما اخترت.",
    notYet: "رسائل واتساب والتقييمات وأسئلة العملاء قريبًا.",
    soon: "قريبًا",
    undoOn: (ch: string, row: string) => `فُعّل ${ch} لـ«${row}»`,
    undoOff: (ch: string, row: string) => `أُوقف ${ch} لـ«${row}»`,
  },
};

const API = "/api/notification-prefs";

/* ---------------- this browser (the tour, or signed out) ---------------- */

function readLocal(): string | null {
  try {
    return localStorage.getItem(OLD_LOCAL_KEY);
  } catch {
    return null;
  }
}

/* kept in the shape the page always used: { whatsapp: [...], email: [...] } in the events' order */
function writeLocal(p: NotifyPrefs) {
  try {
    localStorage.setItem(OLD_LOCAL_KEY, JSON.stringify({ whatsapp: NOTIFY_EVENTS.map((e) => p[e].whatsapp), email: NOTIFY_EVENTS.map((e) => p[e].email) }));
  } catch {
    /* storage unavailable */
  }
}

function forgetLocal() {
  try {
    localStorage.removeItem(OLD_LOCAL_KEY);
  } catch {
    /* storage unavailable */
  }
}

/* ---------------- the page ---------------- */

type Phase = "loading" | "ready" | "failed";
type Status = null | "saved" | "savedLocal" | "failed";

export function NotificationPrefs() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const labels = rows[lang];

  const [phase, setPhase] = useState<Phase>("loading");
  const [prefs, setPrefsState] = useState<NotifyPrefs>(defaultNotifyPrefs);
  const [status, setStatus] = useState<Status>(null);
  const [attempt, setAttempt] = useState(0);
  const server = useRef(false);
  /* the switches as shown, for the saves queued behind each other */
  const current = useRef<NotifyPrefs>(prefs);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPrefs = (next: NotifyPrefs | ((p: NotifyPrefs) => NotifyPrefs)) => {
    const value = typeof next === "function" ? next(current.current) : next;
    current.current = value;
    setPrefsState(value);
  };

  const show = (s: Status) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(s);
    /* "Saved" goes away after a moment; a failure stays until the next save */
    if (s === "saved" || s === "savedLocal") statusTimer.current = setTimeout(() => setStatus(null), 1500);
  };

  usePageTitle(`${brandName(lang)} | ${c.title}`);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    /* only this page can flip its switches back */
    dropUndos("notify-prefs");
  }, []);

  useEffect(() => {
    let alive = true;
    server.current = onServer();
    if (!server.current) {
      setPrefs(fromOldLocal(readLocal()) ?? defaultNotifyPrefs());
      setPhase("ready");
      return;
    }
    setPhase("loading");
    void (async () => {
      const r = await merchantCall(API, "GET");
      if (!alive) return;
      if (r?.status === 401) void bounceIfSuspended();
      if (r?.status !== 200 || r.data.result !== "ok") return void setPhase("failed");
      let loaded = fullNotifyPrefs(r.data.prefs);
      /* what this browser kept before the choices lived on the server: handed over once, only while the server has none */
      const raw = readLocal();
      if (raw !== null) {
        const old = fromOldLocal(raw);
        if (old && r.data.saved !== true) {
          const m = await merchantCall(API, "PUT", { prefs: old, first: true });
          if (!alive) return;
          /* not handed over: kept here for the next visit, and the page waits for the server rather than show a guess */
          if (m?.status !== 200 || m.data.result !== "ok") return void setPhase("failed");
          loaded = fullNotifyPrefs(m.data.prefs);
        }
        forgetLocal();
      }
      setPrefs(loaded);
      setPhase("ready");
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const toggle = (event: NotifyEvent, ch: NotifyChannel, undoing = false) => {
    /* a "Coming soon" switch is never flipped: its saved value waits as it is */
    if (phase !== "ready" || !notifyLive(event, ch)) return;
    const was = current.current[event][ch];
    setPrefs((p) => ({ ...p, [event]: { ...p[event], [ch]: !was } }));
    /* an Undo flips it back the same way (saved like any flip), unless it was flipped again since */
    if (!undoing)
      offerUndo({
        scope: "notify-prefs",
        label: (l) => (was ? copy[l].undoOff : copy[l].undoOn)(copy[l][ch], rows[l][event]),
        undo: () => {
          if (current.current[event][ch] !== !was) return false;
          toggle(event, ch, true);
        },
      });

    if (!server.current) {
      writeLocal(current.current);
      show("savedLocal");
      return;
    }

    /* one save at a time, in order; each sends this event's switches as they are when it goes */
    pending.current++;
    queue.current = queue.current.then(async () => {
      const r = await merchantCall(API, "PUT", { prefs: { [event]: current.current[event] } });
      pending.current--;
      if (r?.status === 200 && r.data.result === "ok") {
        /* the server's copy is shown once nothing else is on its way (another device may have changed other rows) */
        if (!pending.current) setPrefs(fullNotifyPrefs(r.data.prefs));
        show("saved");
        return;
      }
      if (r?.status === 401) void bounceIfSuspended();
      /* refused or offline: this switch goes back, unless he has flipped it again since */
      setPrefs((p) => (p[event][ch] === !was ? { ...p, [event]: { ...p[event], [ch]: was } } : p));
      show("failed");
    });
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="settings" subtabs={[c.tab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-fg/10">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4l2-2ZM10 21a2 2 0 0 0 4 0" />
              </svg>
              <div>
                <h1 className="text-xl font-extrabold">{c.title}</h1>
                <p className="mt-0.5 text-xs text-muted">{c.hint}</p>
                <p className="mt-1 text-xs text-muted">{c.notYet}</p>
              </div>
            </div>
            {status === "failed" ? (
              <p role="alert" className="text-sm font-semibold text-rose-600">{c.failed}</p>
            ) : status ? (
              <p role="status" className="text-sm font-semibold text-primary">{status === "saved" ? c.saved : c.savedLocal}</p>
            ) : null}
          </div>

          <div className="flex bg-soft/70 px-5 py-3 text-xs font-bold text-muted sm:px-7">
            <span className="flex-1">{c.type}</span>
            {NOTIFY_CHANNELS.map((ch) => (
              <span key={ch} className="w-20 text-center sm:w-28">
                {c[ch]}
                {/* WhatsApp is not built yet: the whole column waits */}
                {!NOTIFY_EVENTS.some((e) => notifyLive(e, ch)) && <span className="block text-[10px] font-semibold text-primary">{c.soon}</span>}
              </span>
            ))}
          </div>

          {phase === "failed" ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm sm:px-7">
              <span className="text-muted">{c.loadFailed}</span>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-xl px-4 py-2 font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/5">
                {c.retry}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-fg/10" aria-busy={phase === "loading"}>
              {phase === "loading" && <li className="sr-only" role="status">{c.loading}</li>}
              {NOTIFY_EVENTS.map((event) => (
                <li key={event}>
                  <div className="flex items-center px-5 py-4 text-sm sm:px-7">
                    <span className="flex-1 font-medium">
                      {labels[event]}
                      {/* nothing can tell Dukkan about this event yet (no ratings or questions reach it) */}
                      {!NOTIFY_CHANNELS.some((ch) => notifyLive(event, ch)) && (
                        <span className="ms-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-primary">{c.soon}</span>
                      )}
                    </span>
                    {NOTIFY_CHANNELS.map((ch) =>
                      phase === "loading" ? (
                        /* nothing is shown as on or off before the server says which */
                        <span key={ch} className="grid w-20 place-items-center sm:w-28">
                          <span aria-hidden className="block h-6 w-11 animate-pulse rounded-full bg-fg/10 motion-reduce:animate-none" />
                        </span>
                      ) : !notifyLive(event, ch) ? (
                        /* "Coming soon": shown off and can't be flipped, whatever was saved for it */
                        <span key={ch} title={c.soon} className="grid w-20 cursor-not-allowed place-items-center sm:w-28">
                          <input type="checkbox" role="switch" checked={false} disabled readOnly className="sr-only" aria-label={`${labels[event]}: ${c[ch]} (${c.soon})`} />
                          <span aria-hidden dir="ltr" className="relative h-6 w-11 rounded-full bg-fg/10">
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white/70 shadow" />
                          </span>
                        </span>
                      ) : (
                        <label key={ch} className="grid w-20 cursor-pointer place-items-center sm:w-28">
                          <input type="checkbox" role="switch" checked={prefs[event][ch]} onChange={() => toggle(event, ch)} className="peer sr-only" aria-label={`${labels[event]}: ${c[ch]}`} />
                          <span aria-hidden dir="ltr" className="relative h-6 w-11 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
