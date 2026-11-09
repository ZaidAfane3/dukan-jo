"use client";

import { useEffect, useState } from "react";
import { content } from "./content";
import { markRead, onNotificationsChange, refreshServerNotifications, serverMode, unreadAnnouncements, type AppNotification } from "./notifications";
import { usePrefs } from "./Prefs";

/** Dukkan's announcements that are shown as a banner, on top of the merchant's home page, in his language. Dismissing
    one marks it read (it stays in the bell). Signed in only; never in the tour. */
export function AnnouncementBanner() {
  const { lang } = usePrefs();
  const [list, setList] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!serverMode()) return;
    const sync = () => setList(unreadAnnouncements().filter((a) => a.params.banner === "1"));
    sync();
    void refreshServerNotifications();
    return onNotificationsChange(sync);
  }, []);

  if (!list.length) return null;
  return (
    <div className="space-y-3">
      {list.map((a) => (
        <AnnouncementCard key={a.id} lang={lang} title={lang === "ar" ? a.params.titleAr : a.params.titleEn} body={lang === "ar" ? a.params.bodyAr : a.params.bodyEn} onDismiss={() => markRead(a.id)} />
      ))}
    </div>
  );
}

/** One announcement as the banner on the home page. Also drawn by Diwan's preview (components/diwan/MerchantPreview.tsx). */
export function AnnouncementCard({ lang, title, body, onDismiss }: { lang: "en" | "ar"; title: string; body: string; onDismiss?: () => void }) {
  const w = content[lang].notifications.server;
  return (
    <section role="status" className="flex items-start gap-3 rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/25">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10v4l12 5V5L4 10ZM8 15l1 5h3l-1-4M19 9v6" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{w.announcement}</p>
        <h2 className="break-words font-bold">{title}</h2>
        <p className="mt-1 whitespace-pre-line break-words text-sm text-muted">{body}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label={w.dismiss} title={w.dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-fg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </section>
  );
}
