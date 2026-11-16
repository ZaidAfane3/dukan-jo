"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isStaffPage } from "./diwan/nav";
import { merchantCall } from "./merchantApi";
import { popupSlot } from "./MerchantPopup";
import { serverMode } from "./notifications";
import { usePrefs } from "./Prefs";

/* When Dukkan's team rejects a document the merchant sent (Diwan: Documents), the merchant is told in a pop-up the next
   time a dashboard page opens: which document, the reason the team wrote, and what to do next (send a new one, or
   contact support). It shows once per rejection: closing it, or pressing either button, marks it read on the server
   (app/api/documents/[id] POST), and a new rejection of the same document shows again. It shares the tab's one pop-up
   place with Dukkan's other pop-ups (MerchantPopup.tsx) and comes first. Signed in only; never in the platform tour,
   never on staff pages. */

type Doc = { id: string; kind: string; name: string; status: string; note: string; seq: number; rejectionSeen: boolean };

const words = {
  en: {
    title: "A document was not accepted",
    intro: "Dukkan's team checked a document you sent and couldn't accept it.",
    reason: "The reason our team gave",
    noReason: "No reason was written. Contact support to find out more.",
    resend: "Send a new one",
    support: "Contact support",
    close: "Close",
    kinds: { courier_proof: "Proof of delivery", commercial_registration: "Commercial registration", other: "Document" } as Record<string, string>,
  },
  ar: {
    title: "لم يُقبل أحد مستنداتك",
    intro: "راجع فريق دكّان مستندًا أرسلته ولم يتمكن من قبوله.",
    reason: "السبب الذي ذكره فريقنا",
    noReason: "لم يُكتب سبب. تواصل مع الدعم لمعرفة المزيد.",
    resend: "أرسل مستندًا جديدًا",
    support: "تواصل مع الدعم",
    close: "إغلاق",
    kinds: { courier_proof: "إثبات التوصيل", commercial_registration: "السجل التجاري", other: "مستند" } as Record<string, string>,
  },
};

/* where each kind of document is sent from */
const RESEND: Record<string, string> = { courier_proof: "/delivery" };

export function DocumentRejected() {
  const { lang } = usePrefs();
  const w = words[lang];
  const [doc, setDoc] = useState<Doc | null>(null);
  const box = useRef<HTMLDivElement>(null);

  /* asked once per page view, a moment after the page opens (before Dukkan's other pop-ups, which wait a little longer) */
  useEffect(() => {
    if (!serverMode() || isStaffPage(window.location.pathname, window.location.search)) return;
    let gone = false;
    const timer = window.setTimeout(async () => {
      if (popupSlot.open) return;
      const r = await merchantCall("/api/documents", "GET");
      const list = (r?.status === 200 && Array.isArray(r.data.documents) ? r.data.documents : []) as Doc[];
      /* the newest rejection not read yet */
      const d = list.filter((x) => x.status === "rejected" && !x.rejectionSeen).pop();
      if (gone || !d || popupSlot.open) return;
      popupSlot.open = true;
      setDoc(d);
    }, 700);
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, []);

  /* read: marked on the server, and the tab's pop-up place is free again */
  const done = () => {
    if (doc) void merchantCall(`/api/documents/${doc.id}`, "POST", { action: "seen" });
    popupSlot.open = false;
    setDoc(null);
  };
  useEffect(() => () => {
    if (doc) popupSlot.open = false;
  }, [doc]);

  /* while it is open: Esc closes it, Tab stays inside it, the page under it does not scroll, and the focus comes back after */
  useEffect(() => {
    if (!doc) return;
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return done();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  if (!doc) return null;
  const kindName = w.kinds[doc.kind] ?? w.kinds.other;
  const resend = RESEND[doc.kind];
  return (
    <div className="dash fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={done}>
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="doc-rejected-title"
        aria-describedby="doc-rejected-reason"
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="dk-pop w-full max-w-md rounded-2xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M10 12l4 4M14 12l-4 4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="doc-rejected-title" className="text-lg font-extrabold">{w.title}</h2>
            <p className="mt-1 text-sm text-muted">{w.intro}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-soft px-4 py-3">
          <p className="font-bold">
            {kindName} {doc.seq ? <span dir="ltr" className="text-muted">#{String(doc.seq).padStart(3, "0")}</span> : null}
          </p>
          <p className="mt-0.5 break-words text-xs text-muted"><bdi>{doc.name}</bdi></p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{w.reason}</p>
          <p id="doc-rejected-reason" className="mt-1.5 whitespace-pre-line rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm leading-relaxed">
            {doc.note.trim() ? <bdi>{doc.note}</bdi> : w.noReason}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {resend && (
            <Link href={resend} onClick={done} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-onink transition hover:bg-deep">
              {w.resend}
            </Link>
          )}
          <Link href="/support" onClick={done} className="rounded-xl border border-fg/20 px-4 py-2.5 text-sm font-semibold transition hover:bg-soft">
            {w.support}
          </Link>
          <button type="button" onClick={done} className="ms-auto rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-soft hover:text-fg">
            {w.close}
          </button>
        </div>
      </div>
      <style>{`@keyframes dkPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}.dk-pop{animation:dkPop .25s ease-out}@media (prefers-reduced-motion: reduce){.dk-pop{animation:none}}`}</style>
    </div>
  );
}
