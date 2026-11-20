import { signedInAs } from "./demoSandbox";
import { ACCOUNT_LIMITS, TICKET_PICTURES } from "./safeAccount";

/* Support ticket drafts: a new ticket the merchant has started and not sent yet, kept so he can finish it later.

   Each account has its own drafts, never seen by another one: they are kept under the account's name
   ("dukkan-ticket-drafts:<email>", like serverSync.ts keeps "dukkan-outbox:<email>") and only this account's key is
   ever read. Signed in, they stay in this browser (localStorage) until he sends or deletes them; signed out or in the
   tour, only for this tab (sessionStorage; in the tour that is the tour's own copy, see demoSandbox.ts). They are not
   sent to Dukkan: the "dukkan-" keys are never part of the store's saved data.

   Two kinds: one he saved ("Save as draft"), and one kept by itself while he types (auto), so a closed tab, a crash or
   a page left without asking never loses his words. An auto draft shows as "Unsaved draft" until he saves, sends or
   discards it. While he edits a saved draft, the changes go to an auto draft that points at it (of), so "Discard"
   leaves the saved one as it was. */

export type TicketDraft = {
  id: string;
  subject: string;
  category: number;
  message: string;
  pictures: string[];
  /* last changed (ms) */
  at: number;
  /* kept by itself while typing, never saved on purpose */
  auto: boolean;
  /* auto only: the saved draft being edited */
  of?: string;
  /* the pictures did not fit in the browser's storage: the words were kept without them */
  noPictures?: boolean;
};

/** At most this many drafts per account (saved and auto together) */
export const DRAFTS_MAX = 10;
/* the pictures of all of an account's drafts together, in characters: the browser's storage is shared with the
   store's own data, which must never be the one that runs out of room */
const PICTURES_BUDGET = 1_500_000;

const PREFIX = "dukkan-ticket-drafts:";
const owner = () => signedInAs() ?? "";
const area = (who: string): Storage | null => {
  try {
    return who ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const newDraftId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function clean(x: unknown): TicketDraft | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  if (typeof d.id !== "string" || !/^[a-z0-9]{4,24}$/.test(d.id) || typeof d.subject !== "string" || typeof d.message !== "string") return null;
  return {
    id: d.id,
    subject: d.subject.slice(0, ACCOUNT_LIMITS.subject),
    message: d.message.slice(0, ACCOUNT_LIMITS.message),
    category: typeof d.category === "number" && Number.isInteger(d.category) && d.category >= 0 ? d.category : 0,
    pictures: Array.isArray(d.pictures) ? d.pictures.filter((p): p is string => typeof p === "string" && p.startsWith("data:image/")).slice(0, TICKET_PICTURES) : [],
    at: typeof d.at === "number" && Number.isFinite(d.at) ? d.at : 0,
    auto: d.auto === true,
    of: typeof d.of === "string" ? d.of : undefined,
    noPictures: d.noPictures === true || undefined,
  };
}

/** This account's drafts, newest first. Anything broken or hand-written in the storage is left out. */
export function loadDrafts(): TicketDraft[] {
  const who = owner();
  try {
    const raw = area(who)?.getItem(PREFIX + who);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(clean).filter((d): d is TicketDraft => !!d).sort((a, b) => b.at - a.at).slice(0, DRAFTS_MAX) : [];
  } catch {
    return [];
  }
}

function write(who: string, list: TicketDraft[]): boolean {
  const s = area(who);
  if (!s) return false;
  try {
    if (list.length) s.setItem(PREFIX + who, JSON.stringify(list));
    else s.removeItem(PREFIX + who);
    return true;
  } catch {
    return false;
  }
}

/* the pictures' size in all the drafts but one */
const picturesSize = (list: TicketDraft[], except: string) => list.reduce((n, d) => (d.id === except ? n : n + d.pictures.reduce((m, p) => m + p.length, 0)), 0);

export type PutResult = "ok" | "no-pictures" | "full" | "error";

/** Keeps a draft (a new one, or in place of the one with its id). When its pictures don't fit, the words are kept
    without them ("no-pictures"). "full": DRAFTS_MAX already, none of them auto to make room. */
export function putDraft(d: TicketDraft): PutResult {
  const who = owner();
  let list = loadDrafts().filter((x) => x.id !== d.id);
  if (list.length >= DRAFTS_MAX) {
    /* the oldest auto draft makes room for a new one; saved drafts are only ever deleted by him */
    const oldestAuto = [...list].reverse().find((x) => x.auto && x.id !== d.of);
    if (!oldestAuto) return "full";
    list = list.filter((x) => x.id !== oldestAuto.id);
  }
  const fits = d.pictures.reduce((m, p) => m + p.length, 0) + picturesSize(list, d.id) <= PICTURES_BUDGET;
  if (fits && write(who, [d, ...list])) return "ok";
  const words = { ...d, pictures: [], noPictures: d.pictures.length > 0 || d.noPictures };
  if (write(who, [words, ...list])) return d.pictures.length ? "no-pictures" : "ok";
  return "error";
}

/** Deletes one of this account's drafts */
export function removeDraft(id: string | null | undefined) {
  if (!id) return;
  const who = owner();
  const list = loadDrafts();
  if (list.some((d) => d.id === id)) write(who, list.filter((d) => d.id !== id));
}
