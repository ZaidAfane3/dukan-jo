"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { pushNotification, serverMode } from "./notifications";
import { usePrefs } from "./Prefs";
import { cleanLine, cleanLines, visibleLength } from "./safe";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { ACCOUNT_LIMITS, cleanTickets, ticketKind, TICKET_MIN, TICKET_PICTURES, type Ticket } from "./safeAccount";
import { readPhoto } from "./designer/image";
import {
  createTicket, fetchThread, fetchTickets, pictureUrl, replyTicket, sendable, setTicketOpen,
  type MerchantStatus, type Sent, type ServerTicket, type Thread,
} from "./ticketsApi";
import { usePageTitle } from "./pageTitle";
import { pageText, useMerchant } from "./FromDukkan";
import type { MerchantPage } from "./dukkanPages";
import { replyWithin, usePublicSettings } from "./platformPublic";
import { signedInAs } from "./demoSandbox";

/* Support tickets. Signed in (and not in the tour), tickets go to Dukkan (app/api/tickets): the list comes from the
   server, a ticket opens as a conversation with Dukkan's replies, and the merchant answers there. In the tour or signed
   out, tickets stay in this browser as before. */

const KEY = "seen-tickets";
/** The bell asks Support to open a ticket when the page is already open (detail: the ticket number) */
export const OPEN_TICKET_EVENT = "dukkan-open-ticket";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
const kindBadge = (kind: "bug" | "idea") =>
  `rounded-full px-2 py-0.5 text-[11px] font-bold ${kind === "bug" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-amber-500/15 text-amber-800 dark:text-amber-400"}`;
const statusTone: Record<MerchantStatus, string> = {
  open: "bg-primary/15 text-deep dark:text-primary",
  reply: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  solved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-fg/10 text-muted",
};

function loadTickets(): Ticket[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    /* anything can be written into this browser storage: only well-formed tickets are kept */
    return raw ? cleanTickets(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/* The help articles block: Dukkan's published pages for merchants (the From Dukkan pages, /from-dukkan) */
const helpWords = {
  en: { title: "Help articles", search: "Search help articles", searchPh: "Search by title", none: "No article matches this search." },
  ar: { title: "مقالات المساعدة", search: "ابحث في مقالات المساعدة", searchPh: "ابحث بالعنوان", none: "لا توجد مقالة تطابق هذا البحث." },
};

const clockIcon = <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const searchIcon = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;

const xIcon = <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;
const picIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>;

/* A new ticket is held for a moment before it goes to Dukkan, with an Undo (like an email's "undo send"): the form
   closes at once, a bar says it is being sent, and Undo opens the form again with everything still in it. */
const HOLD_MS = 3000;
/* a ticket on its way: kept for this browser session BEFORE it is sent, and crossed out only once the server says it
   has it. A page that is closed or reloaded while it is on its way may never hear the answer, so the next time the
   Support page is opened the form opens with it, unless the list shows it arrived after all.
   The tab's storage is not kept per account (only localStorage is, see demoSandbox.ts installAccounts), so each
   account's draft has its own key and names the account that wrote it ("" signed out or in the tour). It is only ever
   brought back for that account: someone else signing in on this tab never sees it, nor writes over it. */
const DRAFT_KEY = "seen-ticket-draft";
const draftOwner = () => signedInAs() ?? "";
const draftKey = (owner: string) => `${DRAFT_KEY}:${owner}`;
/* tickets of this page still on their way (kept across the app's own page changes): while one is, its kept draft is not
   brought back, it may still arrive */
let onTheirWay = 0;
type HeldDraft = { owner: string; subject: string; category: number; message: string; pictures: string[] };

function keepHeld(d: HeldDraft) {
  try {
    sessionStorage.setItem(draftKey(d.owner), JSON.stringify(d));
  } catch {
    try {
      /* the pictures did not fit: the words alone */
      sessionStorage.setItem(draftKey(d.owner), JSON.stringify({ ...d, pictures: [] }));
    } catch {
      /* storage unavailable */
    }
  }
}

function dropHeld(owner: string) {
  try {
    sessionStorage.removeItem(draftKey(owner));
  } catch {
    /* storage unavailable */
  }
}

/** This account's ticket kept on its way (keepHeld), or null */
function readHeld(owner: string): HeldDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(owner));
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    /* never another account's words (a key written by hand, say) */
    if (d.owner !== owner || typeof d.subject !== "string" || typeof d.message !== "string") return null;
    return {
      owner,
      subject: d.subject.slice(0, ACCOUNT_LIMITS.subject),
      message: d.message.slice(0, ACCOUNT_LIMITS.message),
      category: typeof d.category === "number" && Number.isInteger(d.category) && d.category >= 0 ? d.category : 0,
      pictures: Array.isArray(d.pictures) ? d.pictures.filter((p): p is string => typeof p === "string" && p.startsWith("data:image/")).slice(0, TICKET_PICTURES) : [],
    };
  } catch {
    /* storage unavailable or a broken draft: nothing to bring back */
    return null;
  }
}

/* The kept ticket reached Dukkan after all: the list has a ticket with its subject and first words */
const arrived = (d: HeldDraft, list: ServerTicket[]) => {
  const subject = cleanLine(d.subject, ACCOUNT_LIMITS.subject);
  const words = cleanLines(d.message, ACCOUNT_LIMITS.message).slice(0, 140).trim();
  return list.some((t) => t.subject === subject && t.preview.trim().startsWith(words));
};
const holdWords = {
  en: { sending: "Sending your ticket…", undo: "Undo" },
  ar: { sending: "جارٍ إرسال تذكرتك…", undo: "تراجع" },
};
/* said in the form when it opens with a ticket kept on its way (see DRAFT_KEY) */
const maybeSentWords = {
  en: "This ticket may not have been sent when you left the page. Check that it is not in your tickets, then send it again.",
  ar: "ربما لم تُرسل هذه التذكرة عند مغادرتك الصفحة. تأكّد أنها ليست ضمن تذاكرك، ثم أرسلها مرة أخرى.",
};

export function Support() {
  const { lang } = usePrefs();
  const s = content[lang].support;
  const sv = s.server;
  const locale = dateLocale(lang);

  /* null until the page knows whether a merchant is signed in (the first render matches the server's) */
  const [server, setServer] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [remote, setRemote] = useState<ServerTicket[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(0);
  const [message, setMessage] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [pictureNote, setPictureNote] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  /* bugs, ideas or every ticket (the filter shows once a ticket is one or the other) */
  const [show, setShow] = useState<"all" | "bug" | "idea">("all");
  /* the ticket open as a conversation (signed in only) */
  const [openNo, setOpenNo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  /* a new ticket held before it is sent (HOLD_MS): its timer, and the send as the newest render made it */
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliverRef = useRef<() => Promise<void> | void>(() => {});
  const alive = useRef(true);
  /* the page is being closed or reloaded (pagehide): an answer may never come, so a failed send keeps its draft */
  const leaving = useRef(false);
  /* back from the browser's back-forward cache: the page is in use again */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) leaving.current = false;
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  /* leaving the page while a ticket is held sends it at once (it is never dropped quietly) */
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!holdTimer.current) return;
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      void deliverRef.current();
    };
  }, []);
  /* a ticket kept on its way when the page was left (DRAFT_KEY): once the list is in, it is crossed out when it arrived
     after all, else the form opens with it and says so (the list could not load: it opens, as it may not have) */
  const heldChecked = useRef(false);
  useEffect(() => {
    if (heldChecked.current || server === null || (server && remote === null && !loadError) || onTheirWay > 0) return;
    heldChecked.current = true;
    const owner = draftOwner();
    const d = readHeld(owner);
    if (!d) return;
    dropHeld(owner);
    if (server && remote && arrived(d, remote)) return;
    setSubject(d.subject);
    setMessage(d.message);
    if (d.category < content[lang].support.categories.length) setCategory(d.category);
    setPictures(d.pictures);
    setFormError(maybeSentWords[lang]);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, remote, loadError]);
  /* closing the tab in those few seconds asks first: a tab that is gone can't send it */
  useEffect(() => {
    if (!holding) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    /* the tab is going anyway (a phone often asks nothing): it is sent now, as well as the browser still allows (its
       draft is kept first, see deliver) */
    const onHide = () => {
      if (!holdTimer.current) return;
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      leaving.current = true;
      void deliverRef.current();
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onHide);
    };
  }, [holding]);
  /* how soon Dukkan usually answers: set in Diwan (platform setting support_reply_hours) */
  const replyHours = usePublicSettings().support_reply_hours;

  usePageTitle(`${brandName(lang)} | ${s.title}`);

  const reload = useCallback(async () => {
    const r = await fetchTickets();
    if (r.ok) {
      setRemote(r.data.tickets);
      setLoadError(false);
    } else setLoadError(true);
  }, []);

  useEffect(() => {
    const on = serverMode();
    setServer(on);
    if (on) {
      void reload();
      /* the bell (or a link) can name a ticket to open: /support?ticket=1001 */
      const n = Number(new URLSearchParams(window.location.search).get("ticket"));
      if (Number.isInteger(n) && n > 0) setOpenNo(n);
    } else setTickets(loadTickets());
    setReady(true);
  }, [reload]);

  useEffect(() => {
    if (!server) return;
    const onOpen = (e: Event) => {
      const n = Number((e as CustomEvent).detail);
      if (Number.isInteger(n) && n > 0) setOpenNo(n);
    };
    window.addEventListener(OPEN_TICKET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TICKET_EVENT, onOpen);
  }, [server]);

  /* Signed out or in the tour, tickets are kept for this browser session only. */
  useEffect(() => {
    if (!ready || server) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(tickets));
    } catch {
      /* storage unavailable */
    }
  }, [tickets, ready, server]);

  useEffect(() => {
    if (!creating) return;
    subjectRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCreating(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  /* Each picture is checked and shrunk (components/designer/image.ts) before it is kept; never more than 5 */
  const addPictures = async (files: FileList | null) => {
    if (!files) return;
    const room = TICKET_PICTURES - pictures.length;
    const list = Array.from(files);
    setPictureNote(list.length > room ? s.picturesFull : "");
    let read = (await Promise.all(list.slice(0, Math.max(0, room)).map((f) => readPhoto(f, 1200)))).filter((u): u is string => !!u);
    if (server) {
      const ok = sendable(read);
      if (ok.length < read.length) setPictureNote(sv.picturesBad);
      read = ok;
    }
    setPictures((p) => [...p, ...read].slice(0, TICKET_PICTURES));
  };

  const failText = (r: Sent<unknown>) => (r.ok ? "" : r.why === "too-many" ? sv.tooMany : r.field === "pictures" ? sv.picturesBad : sv.sendFailed);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (visibleLength(subject) < TICKET_MIN.subject) next.subject = s.errSubject;
    if (visibleLength(message) < TICKET_MIN.message) next.message = s.errMessage;
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;
    if (busy || holding) return;
    /* held for HOLD_MS before it is sent (deliver below); the form's words stay as they are until then */
    setCreating(false);
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void deliverRef.current();
    }, HOLD_MS);
  };

  /** Undo, while the ticket is held: nothing was sent, and the form opens again as he left it */
  const undoSend = () => {
    /* too late: the time is over and it is being sent */
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    setCreating(true);
  };

  /** Sends the held ticket (the time to undo is over, or the page is being left) */
  const deliver = async () => {
    setHolding(false);
    let id: string;
    if (server) {
      /* the account it is sent as, taken now: the browser may be signed out (or into another account) by the time the
         answer comes */
      const owner = draftOwner();
      /* kept before it goes, and crossed out only when the server says it has it: a page closed or reloaded meanwhile
         may never hear the answer (see DRAFT_KEY) */
      keepHeld({ owner, subject, category, message, pictures });
      setBusy(true);
      onTheirWay++;
      const r = await createTicket(
        { subject: cleanLine(subject, ACCOUNT_LIMITS.subject), category, message: cleanLines(message, ACCOUNT_LIMITS.message), pictures, kind: "support" },
        { leaving: leaving.current },
      );
      onTheirWay--;
      setBusy(false);
      if (r.ok) dropHeld(owner);
      else {
        /* not sent, and he has left the page meanwhile (or it is closing): his words stay kept, and the form opens with
           them next time */
        if (!alive.current || leaving.current) return;
        /* not sent: the form comes back with his words and says why (nothing left to bring back later) */
        dropHeld(owner);
        setCreating(true);
        return setFormError(failText(r));
      }
      id = `#${r.data.number}`;
      /* the new ticket is in the list at once (so nobody sends it twice while the list is fetched again), then the
         server's copy replaces it */
      const now = Date.now();
      const sent: ServerTicket = { number: r.data.number, kind: "support", category, subject: cleanLine(subject, ACCOUNT_LIMITS.subject), status: "open", created: now, updated: now, preview: cleanLines(message, ACCOUNT_LIMITS.message).slice(0, 140), pictures: [], unread: false };
      setRemote((list) => [sent, ...(list ?? []).filter((t) => t.number !== sent.number)]);
      void reload();
    } else {
      /* the next number after the highest one, so a number is never used twice */
      id = `#${tickets.reduce((m, t) => Math.max(m, Number(t.id.slice(1))), 1000) + 1}`;
      const list = [{ id, subject: cleanLine(subject, ACCOUNT_LIMITS.subject), category, message: cleanLines(message, ACCOUNT_LIMITS.message), status: 0 as const, created: Date.now(), pictures }, ...tickets];
      setTickets(list);
      /* written here too: when the page was left during the hold, the effect that keeps the list no longer runs */
      try {
        sessionStorage.setItem(KEY, JSON.stringify(list));
      } catch {
        /* storage unavailable */
      }
    }
    pushNotification("ticketCreated", { id });
    setSubject("");
    setMessage("");
    setPictures([]);
    setPictureNote("");
    setCategory(0);
    setCreating(false);
  };

  deliverRef.current = deliver;

  const toggle = (id: string) => setTickets((list) => list.map((t) => (t.id === id ? { ...t, status: t.status === 0 ? 1 : 0 } : t)));

  /* a close or reopen that was not saved: a message under that row's buttons; the status shown stays the server's */
  const [rowError, setRowError] = useState<{ number: number; text: string } | null>(null);
  const toggleRemote = async (t: ServerTicket) => {
    setRowError(null);
    const r = await setTicketOpen(t.number, t.status === "closed");
    if (r.ok) setRemote((list) => list?.map((x) => (x.number === t.number ? { ...x, status: r.data.status, updated: Date.now() } : x)) ?? list);
    else setRowError({ number: t.number, text: r.why === "too-many" ? sv.tooMany : sv.saveFailed });
  };

  const kindOfRemote = (t: ServerTicket) => (t.kind === "support" ? undefined : t.kind);
  const count = server ? (remote ?? []).length : tickets.length;
  const kinded = server ? (remote ?? []).some((t) => kindOfRemote(t)) : tickets.some((t) => ticketKind(t));
  const shown = show === "all" || !kinded ? tickets : tickets.filter((t) => ticketKind(t) === show);
  const shownRemote = show === "all" || !kinded ? remote ?? [] : (remote ?? []).filter((t) => kindOfRemote(t) === show);
  const shownCount = server ? shownRemote.length : shown.length;
  const when = (ts: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));

  const th = "px-4 py-3 text-start text-xs font-bold text-muted";
  const td = "px-4 py-4 text-sm";

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="support"
        subtabs={[s.title]}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-extrabold">{s.title}</h1><button type="button" disabled={holding || busy} onClick={() => { setFormError(""); setCreating(true); }} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onink transition hover:bg-deep disabled:opacity-50"> + {s.newTicket} </button></div>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-semibold text-fg">{clockIcon}{replyWithin(replyHours, lang)}</p>
          {server !== null && <p className="mt-2 text-xs text-muted">{server ? sv.note : s.note}</p>}

          <HelpArticles />

          {kinded && (
            <div role="radiogroup" aria-label={s.filterLabel} className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">{s.filterLabel}</span>
              {(["all", "bug", "idea"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => setShow(k)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${show === k ? "bg-ink text-onink" : "bg-soft text-fg hover:bg-fg/10"}`}>
                  {/* the gap keeps the count apart from the word in both directions (a margin on the dir="ltr" count
                      lands on its far side in Arabic: "الكل7") */}
                  {s.filters[k]}
                  <span dir="ltr" className="tabular-nums opacity-70">
                    {k === "all" ? count : server ? (remote ?? []).filter((t) => kindOfRemote(t) === k).length : tickets.filter((t) => ticketKind(t) === k).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>{(server ? sv.cols : s.cols).map((c) => <th key={c} className={th}>{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {server
                  ? shownRemote.map((t) => {
                      const kind = kindOfRemote(t);
                      return (
                        <tr key={t.number} onClick={() => setOpenNo(t.number)} className="cursor-pointer transition-colors hover:bg-soft/40">
                          <td className={td}>
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                              {t.subject}
                              {kind && <span className={kindBadge(kind)}>{s.kinds[kind]}</span>}
                              {t.unread && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">{sv.newReply}</span>}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted"><span dir="ltr">#{t.number}</span> · {t.preview}</p>
                            {!!t.pictures.length && (
                              <div className="mt-2 flex gap-1.5" aria-label={`${t.pictures.length} ${s.picturesCount}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {t.pictures.map((p) => <img key={p} src={pictureUrl(t.number, p)} alt="" loading="lazy" className="h-9 w-9 rounded-md object-cover ring-1 ring-fg/10" />)}
                              </div>
                            )}
                          </td>
                          <td className={`${td} text-muted`}>{s.categories[t.category] ?? ""}</td>
                          <td className={td}>
                            <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusTone[t.status]}`}>
                              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                              {sv.statuses[t.status]}
                            </span>
                          </td>
                          <td className={`${td} text-muted`}>{when(t.updated)}</td>
                          <td className={td} onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setOpenNo(t.number)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-deep">{sv.view}</button>
                              <button type="button" onClick={() => void toggleRemote(t)} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                                {t.status === "closed" ? s.reopen : s.close}
                              </button>
                            </div>
                            {rowError?.number === t.number && <p role="alert" className="mt-1.5 text-xs text-rose-600">{rowError.text}</p>}
                          </td>
                        </tr>
                      );
                    })
                  : shown.map((t) => {
                      const kind = ticketKind(t);
                      return (
                        <tr key={t.id} className="transition-colors hover:bg-soft/40">
                          <td className={td}>
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                              {t.subject}
                              {kind && <span className={kindBadge(kind)}>{s.kinds[kind]}</span>}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted"><span dir="ltr">{t.id}</span> · {t.message}</p>
                            {!!t.pictures?.length && (
                              <div className="mt-2 flex gap-1.5" aria-label={`${t.pictures.length} ${s.picturesCount}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {t.pictures.map((p, i) => <img key={i} src={p} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-fg/10" />)}
                              </div>
                            )}
                          </td>
                          <td className={`${td} text-muted`}>{s.categories[t.category]}</td>
                          <td className={td}>
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${t.status === 0 ? "bg-primary/15 text-deep dark:text-primary" : "bg-fg/10 text-muted"}`}>
                              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                              {s.statuses[t.status]}
                            </span>
                          </td>
                          <td className={`${td} text-muted`}>{when(t.created)}</td>
                          <td className={td}>
                            <button type="button" onClick={() => toggle(t.id)} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                              {t.status === 0 ? s.close : s.reopen}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {server && remote === null && !loadError && <p className="px-4 py-10 text-center text-sm text-muted">{sv.loading}</p>}
            {server && loadError && (
              <p role="alert" className="px-4 py-10 text-center text-sm text-rose-600">
                {sv.loadFailed}{" "}
                <button type="button" onClick={() => void reload()} className="font-semibold underline">{sv.retry}</button>
              </p>
            )}
            {count > 0 && shownCount === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{s.noneOfKind}</p>}
            {ready && count === 0 && (!server || remote !== null) && (
              <div className="px-4 py-14 text-center">
                <p className="font-bold">{s.empty}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{s.emptyHint}</p>
                <button type="button" disabled={holding || busy} onClick={() => setCreating(true)} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50">
                  {s.newTicket}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {holding && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-4 rounded-full border-2 border-primary bg-transparent px-5 py-3 text-sm font-semibold text-primary backdrop-blur-md">
          <span>{holdWords[lang].sending}</span>
          <button type="button" onClick={undoSend} className="rounded-full border border-primary px-4 py-1.5 transition hover:bg-primary/10">
            {holdWords[lang].undo}
          </button>
        </div>
      )}
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={s.newTicket} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{s.newTicket}</h2>
            {hasErrors(errors) && <div className="mt-2"><RequiredNote text={requiredNote[lang]} show /></div>}
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="t-subject" className="mb-2 block text-sm font-semibold">{s.subject}<RequiredMark /></label>
                <input id="t-subject" ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={s.subjectPh} dir="auto" maxLength={80} aria-required aria-invalid={!!errors.subject} className={`${field} h-11`} />
                {errors.subject && <p className="mt-1.5 text-xs text-rose-600">{errors.subject}</p>}
              </div>
              <div>
                <label htmlFor="t-category" className="mb-2 block text-sm font-semibold">{s.category}</label>
                <select id="t-category" value={category} onChange={(e) => setCategory(Number(e.target.value))} className={`${field} h-11`}>
                  {s.categories.map((c, i) => <option key={c} value={i}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="t-message" className="mb-2 block text-sm font-semibold">{s.message}<RequiredMark /></label>
                <textarea id="t-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.messagePh} dir="auto" rows={5} maxLength={1000} aria-required aria-invalid={!!errors.message} className={`${field} resize-none py-3`} />
                {errors.message && <p className="mt-1.5 text-xs text-rose-600">{errors.message}</p>}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  {s.pictures}
                  <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{s.optional}</span>
                  <span dir="ltr" className="ms-auto text-xs font-normal tabular-nums text-muted">{pictures.length}/{TICKET_PICTURES}</span>
                </p>
                <p className="mb-3 text-xs text-muted">{s.picturesHint}</p>
                <div className="flex flex-wrap gap-2">
                  {pictures.map((p, i) => (
                    <span key={i} className="relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-fg/15">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setPictures((list) => list.filter((_, j) => j !== i))} aria-label={s.removePicture} title={s.removePicture} className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-rose-600">
                        {xIcon}
                      </button>
                    </span>
                  ))}
                  {pictures.length < TICKET_PICTURES && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-fg/20 text-muted transition hover:border-primary hover:text-primary">
                      <span className="grid justify-items-center gap-1 text-[11px] font-semibold">
                        {picIcon}
                        {s.addPicture}
                      </span>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept={server ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,image/gif"} multiple hidden onChange={(e) => { void addPictures(e.target.files); e.target.value = ""; }} />
                {pictureNote && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{pictureNote}</p>}
              </div>
            </div>
            <p className="mt-4 text-xs text-muted">{server ? sv.note : s.note}</p>
            {formError && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{formError}</p>}
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={busy} className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep disabled:opacity-60">{busy ? sv.sending : s.send}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{s.cancel}</button>
            </div>
          </form>
        </div>
      )}

      {server && openNo !== null && (
        <ThreadView
          number={openNo}
          onClose={() => {
            setOpenNo(null);
            /* the address no longer names a ticket, so a reload shows the list */
            if (window.location.search.includes("ticket=")) window.history.replaceState(null, "", window.location.pathname);
          }}
          onChanged={() => void reload()}
        />
      )}
    </div>
  );
}

/* ====================================================================
   Help articles: Dukkan's published pages (signed in only), searched by title
   ==================================================================== */

function HelpArticles() {
  const { lang } = usePrefs();
  const w = helpWords[lang];
  const [q, setQ] = useState("");
  /* the same list as /from-dukkan (app/api/dukkan-pages); signed out, in the tour, failed or empty: no block */
  const st = useMerchant("/api/dukkan-pages", (d) => (Array.isArray(d.pages) ? (d.pages as MerchantPage[]) : []), 0);
  const pages = st.kind === "ok" ? st.data : null;
  const shown = useMemo(() => {
    if (!pages) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return pages;
    /* the title in either language, so a merchant reading Arabic still finds a page by its English name */
    return pages.filter((p) => `${p.titleEn} ${p.titleAr}`.toLowerCase().includes(needle));
  }, [pages, q]);

  if (st.kind === "loading")
    return (
      <div className="mt-5 border-t border-fg/10 pt-5" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded-full bg-fg/10 motion-reduce:animate-none" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-soft ring-1 ring-fg/10 motion-reduce:animate-none" />)}
        </div>
      </div>
    );
  if (!pages?.length) return null;

  return (
    <section aria-labelledby="help-articles" className="mt-5 border-t border-fg/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="help-articles" className="text-base font-bold">{w.title}</h2>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">{w.search}</span>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">{searchIcon}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={w.searchPh} dir="auto" maxLength={80} className={`${field} h-10 ps-9`} />
        </label>
      </div>
      {shown.length ? (
        <ul className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const x = pageText(p, lang);
            return (
              <li key={p.slug} className="min-w-0">
                <Link href={`/from-dukkan/${p.slug}`} className="block h-full rounded-xl bg-soft/50 px-4 py-3 ring-1 ring-fg/10 transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <p dir="auto" className="break-words text-sm font-semibold">{x.title}</p>
                  {x.summary && <p dir="auto" className="mt-0.5 line-clamp-2 break-words text-xs text-muted">{x.summary}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-soft/50 px-4 py-6 text-center text-sm text-muted">{w.none}</p>
      )}
    </section>
  );
}

/* ====================================================================
   One ticket as a conversation (signed in only)
   ==================================================================== */

/** How often an open conversation asks for new messages (while the tab is in view) */
const THREAD_REFRESH_MS = 15_000;

function ThreadView({ number, onClose, onChanged }: { number: number; onClose: () => void; onChanged: () => void }) {
  const { lang } = usePrefs();
  const s = content[lang].support;
  const sv = s.server;
  const locale = dateLocale(lang);
  const [t, setT] = useState<Thread | null>(null);
  const [failed, setFailed] = useState<"none" | "error" | "">("");
  const [text, setText] = useState("");
  const [pics, setPics] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /* only the newest answer is used; what the last one held, to tell the list only when something changed */
  const asked = useRef(0);
  const last = useRef<string | null>(null);
  const atBottom = useRef(true);

  /* Loads the conversation: on opening, after each change, and every few seconds while it is open and the tab is in
     view (THREAD_REFRESH_MS), so Dukkan's replies show up without closing it. The text being written and its pictures
     are never touched. Once the conversation shows, a failed load says nothing and the next one tries again. */
  const load = useCallback(async () => {
    const n = ++asked.current;
    const r = await fetchThread(number);
    if (n !== asked.current) return;
    if (r.ok) {
      const next = r.data.ticket;
      setT(next);
      setFailed("");
      const mark = `${next.status}|${next.messages.length}|${next.messages[next.messages.length - 1]?.id ?? ""}`;
      /* opening it marks Dukkan's replies as seen: the list and the bell catch up */
      if (mark !== last.current) onChanged();
      last.current = mark;
    } else if (last.current === null) setFailed(r.why === "none" ? "none" : "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  useEffect(() => {
    setT(null);
    last.current = null;
    atBottom.current = true;
    void load();
    const inView = () => document.visibilityState === "visible" && void load();
    const timer = window.setInterval(inView, THREAD_REFRESH_MS);
    document.addEventListener("visibilitychange", inView);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", inView);
    };
  }, [load]);

  /* follows each new message only while the conversation is scrolled to the bottom: reading higher up is left alone */
  const onScroll = () => {
    const el = listRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    if (atBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [t?.messages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (big) setBig(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [big, onClose]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const room = TICKET_PICTURES - pics.length;
    const list = Array.from(files);
    setNote(list.length > room ? s.picturesFull : "");
    const read = (await Promise.all(list.slice(0, Math.max(0, room)).map((f) => readPhoto(f, 1200)))).filter((u): u is string => !!u);
    const ok = sendable(read);
    if (ok.length < read.length) setNote(sv.picturesBad);
    setPics((p) => [...p, ...ok].slice(0, TICKET_PICTURES));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || (visibleLength(text) < 1 && !pics.length)) return;
    setBusy(true);
    setError("");
    const r = await replyTicket(number, cleanLines(text, ACCOUNT_LIMITS.message), pics);
    setBusy(false);
    if (!r.ok) return setError(r.why === "too-many" ? sv.tooMany : r.field === "pictures" ? sv.picturesBad : sv.sendFailed);
    setText("");
    setPics([]);
    setNote("");
    /* his own message is shown at the bottom, wherever he had scrolled */
    atBottom.current = true;
    await load();
  };

  const toggle = async () => {
    if (!t) return;
    setToggleError("");
    const r = await setTicketOpen(number, t.status === "closed");
    /* not saved: a message by the button, and the status shown stays the server's (loaded again, quietly) */
    if (!r.ok) setToggleError(r.why === "too-many" ? sv.tooMany : sv.saveFailed);
    await load();
  };

  const systemText = (body: string) =>
    body === "merchant:closed" ? sv.system.closedByYou : body === "merchant:reopened" ? sv.system.reopenedByYou : body === "status:resolved" ? sv.system.solved : body === "status:closed" ? sv.system.closed : "";
  const when = (ts: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={t ? t.subject : `#${number}`} className="dash flex h-full w-full max-w-2xl flex-col overflow-hidden bg-card text-fg shadow-2xl ring-1 ring-fg/10 sm:h-[min(90vh,52rem)] sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-fg/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted"><span dir="ltr">#{number}</span>{t && <> · {s.categories[t.category] ?? ""}</>}</p>
            <h2 className="mt-0.5 break-words text-lg font-extrabold">{t?.subject ?? ""}</h2>
            {t && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusTone[t.status]}`}>
                  <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                  {sv.statuses[t.status]}
                </span>
                {t.kind !== "support" && <span className={kindBadge(t.kind)}>{s.kinds[t.kind]}</span>}
                <button type="button" onClick={() => void toggle()} className="rounded-lg border border-primary/50 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                  {t.status === "closed" ? s.reopen : s.close}
                </button>
              </div>
            )}
            {toggleError && <p role="alert" className="mt-1.5 text-xs text-rose-600">{toggleError}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={sv.back} title={sv.back} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-4 overflow-y-auto bg-page/40 px-5 py-5">
          {!t && !failed && <p className="py-10 text-center text-sm text-muted">{sv.loading}</p>}
          {failed && <p role="alert" className="py-10 text-center text-sm text-rose-600">{failed === "none" ? sv.notFound : sv.loadFailed}</p>}
          {t?.where && <p className="rounded-xl bg-soft px-3 py-2 text-xs text-muted"><span className="font-semibold">{sv.where}:</span> {t.where}</p>}
          {t?.messages.map((m) => {
            if (m.from === "system") {
              const line = systemText(m.body);
              return line ? <p key={m.id} className="text-center text-xs text-muted">{line} · {when(m.at)}</p> : null;
            }
            const mine = m.from === "me";
            return (
              /* the same chat look as Diwan's side: the merchant's own messages on his side, Dukkan's replies on the other,
                 each with a small round mark of who wrote it */
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${mine ? "bg-fg/10 text-fg" : "bg-primary text-white dark:text-page"}`}>
                  {(mine ? sv.you : sv.dukkan).trim().charAt(0).toUpperCase()}
                </span>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "rounded-ee-md bg-primary/10" : "rounded-es-md bg-card ring-1 ring-fg/10"}`}>
                  <p className={`text-xs font-bold ${mine ? "text-deep dark:text-primary" : "text-fg"}`}>{mine ? sv.you : sv.dukkan}</p>
                  {m.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                  {!!m.pictures.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.pictures.map((p) => (
                        <button key={p} type="button" onClick={() => setBig(pictureUrl(number, p))} aria-label={sv.enlarge} title={sv.enlarge} className="overflow-hidden rounded-lg ring-1 ring-fg/15 transition hover:ring-primary">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pictureUrl(number, p)} alt="" loading="lazy" className="h-16 w-16 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted">{when(m.at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {t && (
          <form onSubmit={send} className="border-t border-fg/10 px-5 py-4">
            {t.status === "closed" && <p className="mb-2 text-xs text-muted">{sv.closedNote}</p>}
            <label htmlFor="t-reply" className="sr-only">{sv.replyLabel}</label>
            <textarea id="t-reply" value={text} onChange={(e) => setText(e.target.value)} placeholder={sv.replyPh} dir="auto" rows={3} maxLength={1000} className={`${field} resize-none py-3`} />
            {!!pics.length && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pics.map((p, i) => (
                  <span key={i} className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-fg/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPics((list) => list.filter((_, j) => j !== i))} aria-label={s.removePicture} title={s.removePicture} className="absolute end-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white transition hover:bg-rose-600">
                      {xIcon}
                    </button>
                  </span>
                ))}
              </div>
            )}
            {note && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{note}</p>}
            {error && <p role="alert" className="mt-1.5 text-xs text-rose-600">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={pics.length >= TICKET_PICTURES} className="flex h-10 items-center gap-2 rounded-xl border border-fg/20 px-3 text-xs font-semibold transition hover:bg-soft disabled:opacity-40">
                {picIcon}
                {s.addPicture}
                <span dir="ltr" className="tabular-nums text-muted">{pics.length}/{TICKET_PICTURES}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
              <button type="submit" disabled={busy || (visibleLength(text) < 1 && !pics.length)} className="ms-auto h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition hover:bg-deep disabled:opacity-50">
                {busy ? sv.sending : sv.sendReply}
              </button>
            </div>
          </form>
        )}
      </section>

      {big && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4" onMouseDown={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}
