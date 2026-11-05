"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const xIcon = <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;
const picIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>;

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

  useEffect(() => {
    document.title = `${brandName(lang)} | ${s.title}`;
  }, [lang, s]);

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

    let id: string;
    if (server) {
      if (busy) return;
      setBusy(true);
      const r = await createTicket({ subject: cleanLine(subject, ACCOUNT_LIMITS.subject), category, message: cleanLines(message, ACCOUNT_LIMITS.message), pictures, kind: "support" });
      setBusy(false);
      if (!r.ok) return setFormError(failText(r));
      id = `#${r.data.number}`;
      void reload();
    } else {
      /* the next number after the highest one, so a number is never used twice */
      id = `#${tickets.reduce((m, t) => Math.max(m, Number(t.id.slice(1))), 1000) + 1}`;
      setTickets((list) => [{ id, subject: cleanLine(subject, ACCOUNT_LIMITS.subject), category, message: cleanLines(message, ACCOUNT_LIMITS.message), status: 0, created: Date.now(), pictures }, ...list]);
    }
    pushNotification("ticketCreated", { id });
    setSubject("");
    setMessage("");
    setPictures([]);
    setPictureNote("");
    setCategory(0);
    setCreating(false);
  };

  const toggle = (id: string) => setTickets((list) => list.map((t) => (t.id === id ? { ...t, status: t.status === 0 ? 1 : 0 } : t)));

  const toggleRemote = async (t: ServerTicket) => {
    const r = await setTicketOpen(t.number, t.status === "closed");
    if (r.ok) setRemote((list) => list?.map((x) => (x.number === t.number ? { ...x, status: r.data.status, updated: Date.now() } : x)) ?? list);
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
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-extrabold">{s.title}</h1><button type="button" onClick={() => { setFormError(""); setCreating(true); }} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onink transition hover:bg-deep"> + {s.newTicket} </button></div>
          {server !== null && <p className="mt-1 text-xs text-muted">{server ? sv.note : s.note}</p>}

          {kinded && (
            <div role="radiogroup" aria-label={s.filterLabel} className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">{s.filterLabel}</span>
              {(["all", "bug", "idea"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => setShow(k)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${show === k ? "bg-ink text-onink" : "bg-soft text-fg hover:bg-fg/10"}`}>
                  {s.filters[k]}
                  <span dir="ltr" className="ms-1.5 tabular-nums opacity-70">
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
                <button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                  {s.newTicket}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={s.newTicket} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{s.newTicket}</h2>
            {hasErrors(errors) && <div className="mt-2"><RequiredNote text={requiredNote[lang]} show /></div>}
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="t-subject" className="mb-2 block text-sm font-semibold">{s.subject}<RequiredMark /></label>
                <input id="t-subject" ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={s.subjectPh} maxLength={80} aria-required aria-invalid={!!errors.subject} className={`${field} h-11`} />
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
                <textarea id="t-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.messagePh} rows={5} maxLength={1000} aria-required aria-invalid={!!errors.message} className={`${field} resize-none py-3`} />
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
   One ticket as a conversation (signed in only)
   ==================================================================== */

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
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetchThread(number);
    if (r.ok) {
      setT(r.data.ticket);
      setFailed("");
      /* opening it marks Dukkan's replies as seen: the list and the bell catch up */
      onChanged();
    } else setFailed(r.why === "none" ? "none" : "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  useEffect(() => {
    setT(null);
    void load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
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
    await load();
  };

  const toggle = async () => {
    if (!t) return;
    const r = await setTicketOpen(number, t.status === "closed");
    if (r.ok) await load();
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
          </div>
          <button type="button" onClick={onClose} aria-label={sv.back} title={sv.back} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-page/40 px-5 py-5">
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
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "rounded-ee-md bg-primary/10" : "rounded-es-md bg-card ring-1 ring-fg/10"}`}>
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
            <textarea id="t-reply" value={text} onChange={(e) => setText(e.target.value)} placeholder={sv.replyPh} rows={3} maxLength={1000} className={`${field} resize-none py-3`} />
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
