"use client";

import { useEffect, useRef, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { pushNotification } from "./notifications";
import { usePrefs } from "./Prefs";
import { cleanLine, cleanLines, visibleLength } from "./safe";
import { RequiredMark, RequiredNote, requiredNote } from "./Required";
import { ACCOUNT_LIMITS, cleanTickets, TICKET_MIN, TICKET_PICTURES, type Ticket } from "./safeAccount";
import { readPhoto } from "./designer/image";

const KEY = "seen-tickets";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

function loadTickets(): Ticket[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    /* anything can be written into this browser storage: only well-formed tickets are kept */
    return raw ? cleanTickets(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function Support() {
  const { lang } = usePrefs();
  const s = content[lang].support;
  const locale = dateLocale(lang);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(0);
  const [message, setMessage] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [pictureNote, setPictureNote] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${s.title}`;
  }, [lang, s]);

  useEffect(() => {
    setTickets(loadTickets());
    setReady(true);
  }, []);

  /* Tickets are kept for this browser session only. */
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(tickets));
    } catch {
      /* storage unavailable */
    }
  }, [tickets, ready]);

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
    const read = (await Promise.all(list.slice(0, Math.max(0, room)).map((f) => readPhoto(f, 1200)))).filter((u): u is string => !!u);
    setPictures((p) => [...p, ...read].slice(0, TICKET_PICTURES));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (visibleLength(subject) < TICKET_MIN.subject) next.subject = s.errSubject;
    if (visibleLength(message) < TICKET_MIN.message) next.message = s.errMessage;
    setErrors(next);
    if (Object.keys(next).length) return;

    /* the next number after the highest one, so a number is never used twice */
    const id = `#${tickets.reduce((m, t) => Math.max(m, Number(t.id.slice(1))), 1000) + 1}`;
    setTickets((list) => [{ id, subject: cleanLine(subject, ACCOUNT_LIMITS.subject), category, message: cleanLines(message, ACCOUNT_LIMITS.message), status: 0, created: Date.now(), pictures }, ...list]);
    pushNotification("ticketCreated", { id });
    setSubject("");
    setMessage("");
    setPictures([]);
    setPictureNote("");
    setCategory(0);
    setCreating(false);
  };

  const toggle = (id: string) => setTickets((list) => list.map((t) => (t.id === id ? { ...t, status: t.status === 0 ? 1 : 0 } : t)));

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
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-extrabold">{s.title}</h1><button type="button" onClick={() => setCreating(true)} className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-onink transition hover:bg-deep"> + {s.newTicket} </button></div>
          <p className="mt-1 text-xs text-muted">{s.note}</p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-fg/10">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead className="bg-soft/70">
                <tr>{s.cols.map((c) => <th key={c} className={th}>{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-fg/10">
                {tickets.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-soft/40">
                    <td className={td}>
                      <p className="font-semibold">{t.subject}</p>
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
                    <td className={`${td} text-muted`}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t.created))}</td>
                    <td className={td}>
                      <button type="button" onClick={() => toggle(t.id)} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                        {t.status === 0 ? s.close : s.reopen}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && (
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
            <div className="mt-2"><RequiredNote text={requiredNote[lang]} /></div>
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
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  ))}
                  {pictures.length < TICKET_PICTURES && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-fg/20 text-muted transition hover:border-primary hover:text-primary">
                      <span className="grid justify-items-center gap-1 text-[11px] font-semibold">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
                        {s.addPicture}
                      </span>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { void addPictures(e.target.files); e.target.value = ""; }} />
                {pictureNote && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{pictureNote}</p>}
              </div>
            </div>
            <p className="mt-4 text-xs text-muted">{s.note}</p>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{s.send}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{s.cancel}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
