"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "../Prefs";
import { safeNext } from "./safeNext";

/* When a staff session ends (12 hours, or 60 minutes with nothing done) the next request answers 401 and the page goes
   to the sign-in. Before it goes, the text typed on the page and not sent yet (a ticket reply, a note, a form) is kept
   in this tab only (sessionStorage, gone when the tab closes, and dropped after 12 hours), and the sign-in is given
   the page's address (?next=), so a staff member who signs in again comes back to the same page with that text put back
   in its fields. Only an address inside Diwan on this same site is followed (safeNext). Passwords and codes are never
   kept. */

const KEY = "diwan-drafts";
/* a session lasts 12 hours at most: text older than that is not put back */
const KEEP_MS = 12 * 3600_000;
/* how long a page that just opened is watched to put the text back (its fields can appear only once its data loaded) */
const RESTORE_MS = 10_000;

type Kept = { at: number; page: string; fields: { key: string; value: string }[] };

/** Where the sign-in form goes once signed in: the page the staff member was on (?next=), else the overview */
export const nextPage = () => (typeof window === "undefined" ? "/diwan" : safeNext(new URLSearchParams(window.location.search).get("next")));

/** The header a page's own background load (a ticket looked at again every few seconds) sends, so it is not counted as
    the staff member doing something: the 60 minutes with nothing done still end the session (server/staff.ts) */
export const BACKGROUND = { "X-Diwan-Background": "1" } as const;

const here = () => `${window.location.pathname}${window.location.search}`;

type TextField = HTMLInputElement | HTMLTextAreaElement;
/* fields people type text into; never passwords, codes, files, choices, dates or the list searches (those are in the
   address already) */
const TYPED = new Set(["", "text", "email", "url", "tel", "number"]);
const typedFields = (): TextField[] =>
  Array.from(document.querySelectorAll<TextField>("textarea, input")).filter(
    (el) =>
      !el.disabled &&
      !el.readOnly &&
      (el instanceof HTMLTextAreaElement || TYPED.has(el.type)) &&
      el.autocomplete !== "one-time-code" &&
      !/password/i.test(el.autocomplete),
  );

/* a field's name on the page: what it is called (its name, label or hint) and which of the fields with that name it
   is, so it is found again once the page is open again. React's own ids (":r1:", "«r1»") can change, so they come last. */
function keysOf(list: TextField[]): string[] {
  const seen = new Map<string, number>();
  return list.map((el) => {
    const label = el.labels?.[0]?.textContent?.trim() ?? "";
    const name = el.name || el.getAttribute("aria-label") || el.placeholder || label || (/[:«]/.test(el.id) ? "" : el.id);
    const base = `${el.tagName}|${name}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/** Keeps the text typed on this page (in this tab only) and opens the sign-in, which comes back here afterwards */
export function toSignIn() {
  if (typeof window === "undefined") return;
  try {
    const list = typedFields();
    const keys = keysOf(list);
    const fields = list.map((el, i) => ({ key: keys[i], value: el.value })).filter((f) => f.value.trim());
    if (fields.length) sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), page: here(), fields } satisfies Kept));
  } catch {
    /* storage blocked or full: the sign-in still brings the staff member back to the page */
  }
  const page = here();
  window.location.href = page.startsWith("/diwan/login") ? "/diwan/login" : `/diwan/login?next=${encodeURIComponent(page)}`;
}

/** Forgets any kept text (signing out on purpose) */
export function forgetDrafts() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}

function takeKept(): Kept | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const k = JSON.parse(raw) as Kept;
    if (!k || typeof k.at !== "number" || Date.now() - k.at > KEEP_MS || !Array.isArray(k.fields)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (k.page !== here()) return null;
    sessionStorage.removeItem(KEY);
    return k;
  } catch {
    return null;
  }
}

/* sets a field the way typing would, so the page's own state (React) takes the text */
function put(el: TextField, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Puts the kept text back once the page it was typed on is open again, and says so in a short line at the bottom.
    Mounted once by the console's frame (Shell); `page` is the address, so it looks again on every page change. */
export function DraftsBack({ page }: { page: string }) {
  const { lang } = usePrefs();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const kept = takeKept();
    if (!kept) return;
    const left = new Map(kept.fields.map((f) => [f.key, f.value]));
    let stopped = false;
    /* the page's fields can arrive late, and loading its data can fill them again: the text is put back until the
       staff member types or clicks, or for RESTORE_MS at most */
    const tryPut = () => {
      if (stopped) return;
      const list = typedFields();
      const keys = keysOf(list);
      list.forEach((el, i) => {
        const v = left.get(keys[i]);
        if (v !== undefined && el.value !== v) {
          put(el, v);
          setShown(true);
        }
      });
    };
    const stop = () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(end);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
    const timer = window.setInterval(tryPut, 300);
    const end = window.setTimeout(stop, RESTORE_MS);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    tryPut();
    return stop;
  }, [page]);
  useEffect(() => {
    if (!shown) return;
    const h = window.setTimeout(() => setShown(false), 8000);
    return () => window.clearTimeout(h);
  }, [shown]);
  if (!shown) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl bg-fg px-4 py-2.5 text-sm text-page shadow-lg">
      {lang === "ar" ? "انتهت جلستك فسجّلت الدخول مجددًا؛ أعدنا النص الذي كتبته ولم يُرسل بعد." : "Your session had ended, so you signed in again; the text you typed and had not sent yet is back."}
      <button type="button" onClick={() => setShown(false)} className="ms-3 font-semibold underline underline-offset-2">
        {lang === "ar" ? "حسنًا" : "OK"}
      </button>
    </div>
  );
}
