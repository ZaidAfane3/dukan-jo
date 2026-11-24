"use client";

/* "Undo send" for what a merchant sends to Dukkan (a new ticket in Support.tsx, a bug report or idea from the designer in
   designer/BugReport.tsx, a reply on a ticket), like an email's: it is held for a moment before it goes, a bar says it
   is being sent with an Undo, and Undo brings it back as he left it. Leaving the page (or closing what sent it) in those
   seconds sends it at once, so it is never dropped quietly, and closing the tab asks first.

   A draft (keepDraft) is the text being sent, kept in this browser session for the account that wrote it from just
   before the request starts until the server confirms it: one that could not be sent after its page was left comes back
   the next time that form opens (takeDraft), for that account only. */

import { useEffect, useRef, useState } from "react";
import type { Lang } from "./content";
import { signedInAs } from "./demoSandbox";
import { leaveUnasked } from "./serverSync";

/** How long it is held before it goes */
export const HOLD_MS = 3000;

export const heldWords: Record<Lang, { ticket: string; report: string; idea: string; reply: string; undo: string }> = {
  en: { ticket: "Sending your ticket…", report: "Sending your report…", idea: "Sending your idea…", reply: "Sending your reply…", undo: "Undo" },
  ar: { ticket: "جارٍ إرسال تذكرتك…", report: "جارٍ إرسال بلاغك…", idea: "جارٍ إرسال اقتراحك…", reply: "جارٍ إرسال ردّك…", undo: "تراجع" },
};

/** Holds a send for HOLD_MS. `hold()` starts it (false when one is held already), `undo()` stops it before it went
    (false: too late, it is being sent), `holding` is true meanwhile. `deliver` sends it (the newest one the page made).
    `alive` is false once the component that holds it is gone (it was sent because the page was left); `leaving` is true
    once the tab itself is being closed or reloaded while it was held (it was sent then: the request should outlive the
    page, e.g. ticketsApi.ts createTicket's `leaving`, and a failed answer may never come, so its draft stays kept). */
export function useHeldSend(deliver: () => Promise<void> | void) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;
  const alive = useRef(true);
  const leaving = useRef(false);
  /* sends it now, if it is still held */
  const now = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    void deliverRef.current();
  };
  /* leaving the page (or closing what holds it) while it is held sends it at once */
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      now();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* back from the browser's back-forward cache: the page is in use again */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) leaving.current = false;
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  /* closing the tab in those few seconds asks first: a tab that is gone can't send it (not when the tab is left on
     purpose, signed out by another tab or reloading itself: serverSync.ts leaveUnasked; it is sent as the page goes) */
  useEffect(() => {
    if (!holding) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (leaveUnasked()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    /* the tab is going anyway (a phone often asks nothing): it is sent now, as well as the browser still allows */
    const onHide = () => {
      if (!timer.current) return;
      leaving.current = true;
      setHolding(false);
      now();
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);
  const hold = () => {
    if (timer.current) return false;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      void deliverRef.current();
    }, HOLD_MS);
    return true;
  };
  const undo = () => {
    /* too late: the time is over and it is being sent */
    if (!timer.current) return false;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    return true;
  };
  return { holding, hold, undo, alive, leaving };
}

/** The bar at the bottom while it is held: what is being sent, and Undo */
export function HeldSendBar({ text, undo, onUndo }: { text: string; undo: string; onUndo: () => void }) {
  return (
    <div role="status" data-undo-avoid className="fixed inset-x-0 bottom-6 z-[90] mx-auto flex w-fit max-w-[92vw] items-center gap-4 rounded-full border-2 border-primary bg-transparent px-5 py-3 text-sm font-semibold text-primary backdrop-blur-md">
      <span>{text}</span>
      <button type="button" onClick={onUndo} className="rounded-full border border-primary px-4 py-1.5 transition hover:bg-primary/10">
        {undo}
      </button>
    </div>
  );
}

/* A draft is kept per account, under "<key>:<email>" ("" signed out or in the tour), and names the account that wrote it:
   the tab's storage is not kept per account (only localStorage is, see demoSandbox.ts installAccounts), so another
   account signed in on this tab never gets it, nor writes over it. The account is taken when the draft is kept: the
   browser may be signed out (or into another account) by the time the answer comes, so keepDraft gives it back for
   dropDraft. */
export const draftOwner = () => signedInAs() ?? "";
const draftKey = (k: string, owner: string) => `${k}:${owner}`;

/** Keeps the text being sent (with its pictures when they fit) until it went: call it just before the request starts.
    Gives back the account it is kept for (pass it to dropDraft). */
export function keepDraft(k: string, draft: Record<string, unknown> & { pictures?: string[] }, owner = draftOwner()): string {
  try {
    sessionStorage.setItem(draftKey(k, owner), JSON.stringify({ ...draft, owner }));
  } catch {
    try {
      /* the pictures did not fit: the words alone */
      sessionStorage.setItem(draftKey(k, owner), JSON.stringify({ ...draft, pictures: [], owner }));
    } catch {
      /* storage unavailable */
    }
  }
  return owner;
}

/** It went (or the form still shows it): the kept draft is no longer needed */
export function dropDraft(k: string, owner = draftOwner()) {
  try {
    sessionStorage.removeItem(draftKey(k, owner));
  } catch {
    /* storage unavailable */
  }
}

/** A draft of this account that could not be sent after its page was left, taken out to open the form with it; null
    when none (never another account's words: a key written by hand, say) */
export function takeDraft(k: string, owner = draftOwner()): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(draftKey(k, owner));
    if (!raw) return null;
    sessionStorage.removeItem(draftKey(k, owner));
    const d: unknown = JSON.parse(raw);
    return d && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>).owner === owner ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
