"use client";

/* The "Undo" note at the bottom of the screen (components/undo.ts): what was just done, and an Undo button with a ring
   that fills up while it can still be pressed. It stops while the mouse is on it or it has the focus, Esc closes it,
   and Ctrl+Z / Cmd+Z undoes too (never inside a text box, where it undoes the typing). Mounted once, by the dashboard bar. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrefs } from "./Prefs";
import type { Lang } from "./content";
import { UNDO_TOAST_MS, canUndo, hideUndo, hideUndoNote, runUndo, useUndo } from "./undo";

const words: Record<Lang, { undo: string; undoHint: string; close: string; undone: string; changed: string; offline: string }> = {
  en: {
    undo: "Undo",
    undoHint: "Undo (Ctrl+Z or ⌘Z)",
    close: "Close",
    undone: "Undone",
    changed: "Can't undo: it changed since.",
    offline: "Can't undo right now: no connection. Check your connection and try again.",
  },
  ar: {
    undo: "تراجع",
    undoHint: "تراجع (Ctrl+Z أو ⌘Z)",
    close: "إغلاق",
    undone: "تم التراجع",
    changed: "تعذّر التراجع: تغيّر منذ ذلك الحين.",
    offline: "تعذّر التراجع الآن: لا يوجد اتصال. تحقق من اتصالك وحاول مرة أخرى.",
  },
};

const R = 15;
const RING = 2 * Math.PI * R;

/* a key press in a place that keeps Ctrl+Z for itself: text boxes and editable text */
const typingIn = (t: EventTarget | null) => {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return true;
  if (t.tagName !== "INPUT") return false;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes((t as HTMLInputElement).type);
};

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function UndoToast() {
  const { lang } = usePrefs();
  const w = words[lang];
  const { toast, note } = useUndo();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [held, setHeld] = useState({ hover: false, focus: false });
  const [left, setLeft] = useState(Math.ceil(UNDO_TOAST_MS / 1000));
  const ring = useRef<SVGCircleElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const noteBox = useRef<HTMLDivElement>(null);
  const paused = held.hover || held.focus;
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => setMounted(true), []);

  /* Never over the page's main button: the toast shows at the start of the screen's bottom, where a form's Save button
     often is (right after he pressed it). When it would cover that button (the one he just pressed, or a page's submit
     button) it moves to the other side, and when that side is taken too it sits just above the button. Checked when it
     shows and while the page scrolls or resizes under it. */
  const [place, setPlace] = useState<{ side: "start" | "end"; lift: number }>({ side: "start", lift: 0 });
  const placeNow = useRef(place);
  const shown = toast?.id ?? note?.id ?? null;
  useEffect(() => {
    if (shown === null) return;
    placeNow.current = { side: "start", lift: 0 };
    setPlace(placeNow.current);
    let frame = 0;
    const covered = (r: DOMRect) => {
      const mains = Array.from(document.querySelectorAll<HTMLElement>('main button[type="submit"], main [data-main-action]'));
      const a = document.activeElement;
      if (a instanceof HTMLElement && a.tagName === "BUTTON" && a.closest("main")) mains.push(a);
      return mains.filter((b) => {
        const q = b.getBoundingClientRect();
        return q.width > 0 && q.right > r.left && q.left < r.right && q.bottom > r.top && q.top < r.bottom;
      });
    };
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = box.current ?? noteBox.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        /* where it would sit on the other side: the same size, mirrored across the screen */
        const other = new DOMRect(window.innerWidth - r.right, r.top, r.width, r.height);
        const now = placeNow.current;
        /* lifted, it is measured where it would sit without the lift */
        const here = now.lift ? new DOMRect(r.left, window.innerHeight - 24 - r.height, r.width, r.height) : r;
        const hitHere = covered(here);
        let next = now;
        if (!hitHere.length) next = now.lift ? { side: now.side, lift: 0 } : now;
        else if (!covered(other).length) next = { side: now.side === "start" ? "end" : "start", lift: 0 };
        else {
          /* both sides taken: just above the highest button it would cover */
          const top = Math.min(...hitHere.map((b) => b.getBoundingClientRect().top));
          const lift = Math.max(0, Math.round(window.innerHeight - top + 12));
          if (lift !== now.lift) next = { side: now.side, lift };
        }
        if (next !== now) {
          placeNow.current = next;
          setPlace(next);
        }
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true, capture: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check, { capture: true });
      window.removeEventListener("resize", check);
    };
  }, [shown]);

  /* the ring fills up over UNDO_TOAST_MS of time the toast is really seen: stopped while held, or while the tab is hidden */
  useEffect(() => {
    if (!toast) return;
    setHeld({ hover: false, focus: false });
    let used = 0;
    let last = performance.now();
    let frame = 0;
    let shownLeft = -1;
    const tick = (now: number) => {
      /* no frames come while the tab is hidden: the first one back would count all that time, so one frame never counts
         more than a moment (the toast goes on where it stopped) */
      const dt = Math.min(250, Math.max(0, now - last));
      last = now;
      if (!pausedRef.current && !document.hidden) used += dt;
      const part = Math.min(1, used / UNDO_TOAST_MS);
      if (ring.current) ring.current.style.strokeDashoffset = String(RING * (1 - part));
      const s = Math.max(0, Math.ceil((UNDO_TOAST_MS - used) / 1000));
      if (s !== shownLeft) {
        shownLeft = s;
        setLeft(s);
      }
      if (part >= 1) {
        /* the focus was on its button: it goes back to the page instead of being lost */
        if (box.current?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
        hideUndo(toast.id);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [toast]);

  /* "Undone" / "Can't undo" shows for a moment */
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => hideUndoNote(note.id), note.kind === "undone" ? 2200 : 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  /* Ctrl+Z / Cmd+Z undoes the last change (not inside a text box, and not under an open dialog); Esc closes the toast */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toast) {
        hideUndo(toast.id);
        return;
      }
      const z = e.code === "KeyZ" || (e.key ?? "").toLowerCase() === "z";
      if (!z || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.defaultPrevented) return;
      if (typingIn(e.target) || typingIn(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!canUndo()) return;
      e.preventDefault();
      void runUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast]);

  if (!mounted) return null;

  return createPortal(
    /* above the page, its bar and side menu, but under dialogs (z-50): centred on a phone, at the start on a wide screen */
    <div
      role="status"
      aria-live="polite"
      style={place.lift ? { bottom: place.lift } : undefined}
      className={`dash pointer-events-none fixed inset-x-0 bottom-4 z-[45] flex px-4 lg:bottom-6 ${place.side === "end" ? "justify-end lg:pe-6" : "justify-center lg:justify-start lg:ps-[calc(var(--side-w)+1.5rem)]"}`}
    >
      {toast ? (
        <div
          ref={box}
          key={toast.id}
          onMouseEnter={() => setHeld((h) => ({ ...h, hover: true }))}
          onMouseLeave={() => setHeld((h) => ({ ...h, hover: false }))}
          onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld((h) => ({ ...h, focus: false }))}
          className="pointer-events-auto flex w-full max-w-md animate-[fadeIn_0.2s_ease] items-center gap-3 rounded-2xl bg-[rgb(var(--brand-ink))] py-2.5 pe-2 ps-4 text-white shadow-2xl ring-1 ring-white/10"
        >
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{toast.label(lang)}</p>
          <button
            type="button"
            onClick={() => void runUndo(toast.id)}
            title={w.undoHint}
            aria-keyshortcuts="Control+Z Meta+Z"
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl px-2.5 text-sm font-bold text-primary outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="relative grid h-8 w-8 place-items-center" aria-hidden>
              {/* the ring fills clockwise from the top (the other way in Arabic, which reads the other way) */}
              <svg viewBox="0 0 36 36" className="absolute inset-0 h-8 w-8 -rotate-90 rtl:-scale-y-100">
                <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                {!reduce && <circle ref={ring} cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING} />}
              </svg>
              {reduce ? (
                <span dir="ltr" className="text-[10px] font-bold tabular-nums">{left}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
              )}
            </span>
            {w.undo}
          </button>
          <button
            type="button"
            onClick={() => hideUndo(toast.id)}
            aria-label={w.close}
            title={w.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ) : note ? (
        <div ref={noteBox} key={note.id} className="pointer-events-auto flex animate-[fadeIn_0.2s_ease] items-center gap-2 rounded-2xl bg-[rgb(var(--brand-ink))] px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10">
          {note.kind === "undone" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
          )}
          {note.kind === "undone" ? w.undone : note.kind === "offline" ? w.offline : w.changed}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
