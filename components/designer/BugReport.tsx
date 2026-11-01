"use client";

/* "Bug or idea?" in the theme designer: a small button in the corner opens a side tab where the merchant first says whether
   something is not working or he has an idea, then writes it and adds pictures: snaps of the screen (as many as he wants, up to
   the ticket's limit) or pictures he uploads. It is sent as a support ticket (components/Support.tsx keeps them), in "Store
   design", with its kind (bug or idea) and where he was in the designer.
   The snap uses the browser's own screen capture (getDisplayMedia): the browser asks once each time, and the tab is hidden
   while the picture is taken so it shows the page, not the form. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "../content";
import { pushNotification } from "../notifications";
import { cleanLine, cleanLines, visibleLength } from "../safe";
import { ACCOUNT_LIMITS, cleanTickets, TICKET_MIN, TICKET_PICTURES, type Ticket } from "../safeAccount";
import { readPhoto } from "./image";

const KEY = "seen-tickets";
/* "Store design" in the support categories (content.ts, support.categories) */
const DESIGN_CATEGORY = 3;

type Kind = "bug" | "idea";

const words = {
  en: {
    open: "Bug or idea?",
    title: "Bug or idea",
    kindLabel: "What would you like to send?",
    kinds: { bug: "A bug", idea: "An idea" },
    kindHints: { bug: "Something is not working", idea: "Something could be better" },
    intro: { bug: "Tell us what went wrong and show us. We read every report.", idea: "Tell us what would make designing your store easier. We read every idea." },
    what: { bug: "What happened?", idea: "What is your idea?" },
    whatPh: { bug: "For example: when I change the banner color, the title disappears.", idea: "For example: I wish I could pick a different color for each button." },
    tooShort: { bug: "Write a little more, so we can find it (at least 10 letters).", idea: "Write a little more, so we understand your idea (at least 10 letters)." },
    pics: "Pictures",
    optional: "Optional",
    picsHint: { bug: "Snap the screen as many times as you need, or upload pictures.", idea: "Snap the screen or upload a picture if it helps show your idea." },
    snap: "Snap the screen",
    snapping: "Snapping…",
    upload: "Upload",
    remove: "Remove this picture",
    full: "That is the most pictures one report can have.",
    snapNo: "The screen could not be snapped. You can upload a picture instead.",
    snapNone: "This browser cannot snap the screen. You can upload a picture instead.",
    send: { bug: "Send the report", idea: "Send the idea" },
    cancel: "Cancel",
    close: "Close",
    sent: { bug: "Thank you! Your report was sent as ticket", idea: "Thank you! Your idea was sent as ticket" },
    see: "See it in Support tickets",
    another: { bug: "Report another one", idea: "Send another idea" },
    subject: { bug: "Bug in the theme designer", idea: "Idea for the theme designer" },
    where: "Where",
  },
  ar: {
    open: "خطأ أو اقتراح؟",
    title: "خطأ أو اقتراح",
    kindLabel: "ماذا تريد أن ترسل؟",
    kinds: { bug: "خطأ", idea: "اقتراح" },
    kindHints: { bug: "شيء لا يعمل", idea: "فكرة تجعله أفضل" },
    intro: { bug: "أخبرنا بما حدث وأرنا إياه. نقرأ كل بلاغ.", idea: "أخبرنا بما يجعل تصميم متجرك أسهل. نقرأ كل اقتراح." },
    what: { bug: "ماذا حدث؟", idea: "ما اقتراحك؟" },
    whatPh: { bug: "مثال: عندما أغيّر لون الغلاف يختفي العنوان.", idea: "مثال: أتمنى لو أستطيع اختيار لون مختلف لكل زر." },
    tooShort: { bug: "اكتب أكثر قليلًا حتى نجده (10 أحرف على الأقل).", idea: "اكتب أكثر قليلًا حتى نفهم فكرتك (10 أحرف على الأقل)." },
    pics: "الصور",
    optional: "اختياري",
    picsHint: { bug: "التقط صورة للشاشة كلما احتجت، أو ارفع صورًا.", idea: "التقط صورة للشاشة أو ارفع صورة إن كانت توضّح فكرتك." },
    snap: "التقط صورة للشاشة",
    snapping: "جارٍ الالتقاط…",
    upload: "رفع صورة",
    remove: "إزالة هذه الصورة",
    full: "هذا أكبر عدد من الصور في بلاغ واحد.",
    snapNo: "تعذّر التقاط الشاشة. يمكنك رفع صورة بدلًا من ذلك.",
    snapNone: "هذا المتصفح لا يلتقط الشاشة. يمكنك رفع صورة بدلًا من ذلك.",
    send: { bug: "إرسال البلاغ", idea: "إرسال الاقتراح" },
    cancel: "إلغاء",
    close: "إغلاق",
    sent: { bug: "شكرًا لك! أُرسل بلاغك كتذكرة", idea: "شكرًا لك! أُرسل اقتراحك كتذكرة" },
    see: "عرضها في تذاكر الدعم",
    another: { bug: "الإبلاغ عن خطأ آخر", idea: "إرسال اقتراح آخر" },
    subject: { bug: "خطأ في مصمم الثيم", idea: "اقتراح لمصمم الثيم" },
    where: "المكان",
  },
};

/* a speech bubble with a small spark: fits a report and an idea alike */
const feedbackIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" /><path d="M12 8v4M12 15.5h.01" />
  </svg>
);

const ideaIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
  </svg>
);

const bugIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 2l1.9 1.9M16 2l-1.9 1.9" /><path d="M9 7.1V6a3 3 0 0 1 6 0v1.1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" /><path d="M12 20v-9M6.5 9C4.6 8.8 3 7.2 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
  </svg>
);

/** One snap of this browser tab, as a JPEG no wider than 1600 px; null when he says no or the browser cannot */
async function snapScreen(): Promise<string | null> {
  const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (o?: unknown) => Promise<MediaStream> };
  if (!md?.getDisplayMedia) return null;
  let stream: MediaStream | null = null;
  try {
    /* the current tab is offered first where the browser supports it */
    stream = await md.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" });
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    /* the browser's own "sharing" bar can take a moment to go: wait for a real frame */
    await new Promise((r) => setTimeout(r, 350));
    const w = video.videoWidth || 1, h = video.videoHeight || 1;
    const scale = Math.min(1, 1600 / w);
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    cv.getContext("2d")?.drawImage(video, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL("image/jpeg", 0.85);
    return url.length > 30 ? url : null;
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

/** The button in the corner of the designer and the tab it opens. `where` says what he was editing (sent with the report).
    `lift`: on a phone or a tablet the settings fill the screen down to the strip that says what saving does, so the button is a small
    icon at the end of that strip (the strip leaves it room). */
export function BugReport({ lang, where, lift }: { lang: Lang; where: string; lift?: boolean }) {
  const w = words[lang];
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [text, setText] = useState("");
  const [pics, setPics] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  /* while a snap is taken the tab steps out of the way */
  const [hidden, setHidden] = useState(false);
  const [sentId, setSentId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const room = TICKET_PICTURES - pics.length;
  const add = (list: string[]) => setPics((p) => [...p, ...list].slice(0, TICKET_PICTURES));

  const snap = async () => {
    if (room <= 0) return setNote(w.full);
    setNote("");
    setHidden(true);
    /* two frames, so the page is drawn without the tab before the browser asks */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const url = await snapScreen();
    setHidden(false);
    if (url) add([url]);
    else setNote((navigator.mediaDevices as { getDisplayMedia?: unknown } | undefined)?.getDisplayMedia ? w.snapNo : w.snapNone);
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    setNote(list.length > room ? w.full : "");
    const read = (await Promise.all(list.slice(0, Math.max(0, room)).map((f) => readPhoto(f, 1600)))).filter((u): u is string => !!u);
    add(read);
  };

  const send = () => {
    if (visibleLength(text) < TICKET_MIN.message) return setError(true);
    let tickets: Ticket[] = [];
    try {
      const raw = sessionStorage.getItem(KEY);
      tickets = raw ? cleanTickets(JSON.parse(raw)) : [];
    } catch {
      /* storage unavailable: the report still gets its number */
    }
    /* the next number after the highest one, the same way Support numbers its tickets */
    const id = `#${tickets.reduce((m, t) => Math.max(m, Number(t.id.slice(1))), 1000) + 1}`;
    const message = cleanLines(`${text.trim()}\n\n${w.where}: ${where}`, ACCOUNT_LIMITS.message);
    const ticket: Ticket = { id, subject: cleanLine(w.subject[kind], ACCOUNT_LIMITS.subject), category: DESIGN_CATEGORY, message, status: 0, created: Date.now(), pictures: pics, kind };
    try {
      sessionStorage.setItem(KEY, JSON.stringify([ticket, ...tickets]));
    } catch {
      /* too big for this browser's storage: kept without its pictures */
      try {
        sessionStorage.setItem(KEY, JSON.stringify([{ ...ticket, pictures: [] }, ...tickets]));
      } catch {
        /* storage unavailable */
      }
    }
    pushNotification("ticketCreated", { id });
    setSentId(id);
    setText("");
    setPics([]);
    setNote("");
    setError(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setSentId(""); setOpen(true); }}
        aria-label={w.open}
        title={w.open}
        className={`fixed end-4 z-40 flex items-center gap-2 rounded-full bg-card text-xs font-bold text-fg shadow-lg ring-1 ring-fg/10 transition hover:-translate-y-0.5 hover:text-primary ${lift ? "bottom-3 p-2.5" : "bottom-4 px-3.5 py-2"} ${open || hidden ? "invisible" : ""}`}
      >
        <span className="text-primary">{feedbackIcon}</span>
        {!lift && w.open}
      </button>

      {open && (
        <div className={`fixed inset-0 z-[70] flex justify-end ${hidden ? "invisible" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label={w.title} className="dash flex h-full w-full max-w-[24rem] animate-[fadeIn_0.2s_ease] flex-col border-s border-fg/10 bg-card text-fg shadow-2xl">
            <div className="flex items-center gap-3 border-b border-fg/10 px-5 py-4">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${kind === "bug" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{kind === "bug" ? bugIcon : ideaIcon}</span>
              <h2 className="flex-1 text-base font-extrabold">{w.title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={w.close} title={w.close} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            {sentId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </span>
                <p className="text-sm font-semibold">{w.sent[kind]} <span dir="ltr" className="font-extrabold">{sentId}</span></p>
                <Link href="/support" className="text-sm font-semibold text-primary hover:underline">{w.see}</Link>
                <button type="button" onClick={() => setSentId("")} className="mt-2 rounded-xl border border-fg/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-soft">{w.another[kind]}</button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  <div>
                    <p id="bug-kind" className="mb-2 text-sm font-semibold">{w.kindLabel}</p>
                    <div role="radiogroup" aria-labelledby="bug-kind" className="grid grid-cols-2 gap-2">
                      {(["bug", "idea"] as const).map((k) => {
                        const on = kind === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => { setKind(k); setError(false); textRef.current?.focus(); }}
                            className={`flex items-start gap-2.5 rounded-xl border p-3 text-start transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-fg/15 hover:bg-soft"}`}
                          >
                            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${k === "bug" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{k === "bug" ? bugIcon : ideaIcon}</span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold">{w.kinds[k]}</span>
                              <span className="block text-[11px] leading-snug text-muted">{w.kindHints[k]}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{w.intro[kind]}</p>
                  <div>
                    <label htmlFor="bug-what" className="mb-2 block text-sm font-semibold">{w.what[kind]}<span className="ms-1 text-rose-600">*</span></label>
                    <textarea id="bug-what" ref={textRef} value={text} onChange={(e) => { setText(e.target.value); if (error) setError(false); }} placeholder={w.whatPh[kind]} rows={5} maxLength={1000} aria-required aria-invalid={error} className={`w-full resize-none rounded-xl border bg-card px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 ${error ? "border-rose-500" : "border-fg/15"}`} />
                    {error && <p className="mt-1.5 text-xs text-rose-600">{w.tooShort[kind]}</p>}
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                      {w.pics}
                      <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{w.optional}</span>
                      <span dir="ltr" className="ms-auto text-xs font-normal tabular-nums text-muted">{pics.length}/{TICKET_PICTURES}</span>
                    </p>
                    <p className="mb-3 text-xs text-muted">{w.picsHint[kind]}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void snap()} disabled={room <= 0 || hidden} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                        {hidden ? w.snapping : w.snap}
                      </button>
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={room <= 0} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-fg/20 text-sm font-semibold transition hover:bg-soft disabled:opacity-40">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>
                        {w.upload}
                      </button>
                    </div>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
                    {note && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-400">{note}</p>}
                    {!!pics.length && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {pics.map((p, i) => (
                          <span key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-fg/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p} alt="" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => setPics((list) => list.filter((_, j) => j !== i))} aria-label={w.remove} title={w.remove} className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-rose-600">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 border-t border-fg/10 px-5 py-4">
                  <button type="button" onClick={send} className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:bg-deep">{w.send[kind]}</button>
                  <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{w.cancel}</button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
