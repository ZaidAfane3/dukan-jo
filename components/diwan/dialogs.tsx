"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { area, Btn, field, useT } from "./ui";

/* Diwan's own dialogs, instead of the browser's confirm / prompt / alert: those look like a warning from the browser,
   can't be read in the page's language and direction, and some browsers let people switch them off for a site, which
   would silently skip every question. A page asks with askConfirm / askText / tell and awaits the answer; one
   DialogHost, mounted by the console's layout, draws the question. Dialog is the frame they share, and pages use it
   for their own forms (the staff page's new password). Questions asked while one is open wait their turn. */

export type ConfirmOptions = { title: string; body?: string; confirm?: string; cancel?: string; danger?: boolean };
export type TextOptions = {
  title: string; body?: string; label: string; initial?: string | null; placeholder?: string;
  optional?: boolean; multiline?: boolean; maxLength?: number; confirm?: string; cancel?: string;
};
export type TellOptions = { title: string; body?: string; ok?: string };

type Ask =
  | { id: number; kind: "confirm"; o: ConfirmOptions; done: (v: boolean) => void }
  | { id: number; kind: "text"; o: TextOptions; done: (v: string | null) => void }
  | { id: number; kind: "tell"; o: TellOptions; done: () => void };

/* the questions waiting to be shown, first one on screen; kept outside React so any page or helper can ask */
let queue: Ask[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function ask(a: Ask) {
  /* no host on this page (it is mounted for every console page): answer "no" rather than act without asking */
  if (!listeners.size) {
    console.error("Diwan dialog asked with no DialogHost mounted");
    if (a.kind === "confirm") a.done(false);
    else if (a.kind === "text") a.done(null);
    else a.done();
    return;
  }
  queue = [...queue, a];
  changed();
}

function finish(id: number) {
  queue = queue.filter((q) => q.id !== id);
  changed();
}

/** Asks a yes/no question. Resolves to true only when they confirm; Escape, the backdrop and Cancel give false. */
export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((done) => ask({ id: nextId++, kind: "confirm", o, done }));
}

/** Asks for a line (or a few lines) of text. Resolves to what they typed, or null when they cancel. */
export function askText(o: TextOptions): Promise<string | null> {
  return new Promise((done) => ask({ id: nextId++, kind: "text", o, done }));
}

/** Tells them something that needs reading before going on. Resolves when they close it. */
export function tell(o: TellOptions): Promise<void> {
  return new Promise((done) => ask({ id: nextId++, kind: "tell", o, done }));
}

/* ---------------- the frame ---------------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* the page behind must not scroll while a dialog is open; counted, so a dialog opened from a dialog unlocks correctly */
let locks = 0;
let before = "";
function lockScroll() {
  if (locks++ === 0) {
    before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (--locks === 0) document.body.style.overflow = before;
}

/** A dialog on a dim backdrop: labelled by its title and described by its text, focus moves in (to the field or
    button marked data-autofocus, else the first one) and goes back to what opened it, Tab stays inside, Escape and a
    click on the backdrop call onClose, and the page behind doesn't scroll. The content is a form, so Enter submits
    (onSubmit). While `busy`, it can't be closed. */
export function Dialog({
  title, body, onClose, onSubmit, children, footer, busy = false, tone = "normal", wide = false,
}: {
  title: string; body?: React.ReactNode; onClose: () => void; onSubmit?: () => void; children?: React.ReactNode;
  footer: React.ReactNode; busy?: boolean; tone?: "normal" | "danger"; wide?: boolean;
}) {
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLFormElement>(null);
  /* the latest values, for the key handler that is set up once */
  const live = useRef({ onClose, busy });
  live.current = { onClose, busy };
  const close = () => !live.current.busy && live.current.onClose();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = panel.current;
    const first = box?.querySelector<HTMLElement>("[data-autofocus]") ?? box?.querySelector<HTMLElement>(FOCUSABLE) ?? box;
    first?.focus();
    if (first instanceof HTMLInputElement) first.select();
    lockScroll();
    return () => {
      unlockScroll();
      /* back to the button that opened it, if it is still on the page */
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    /* a simple trap: from the last control Tab goes to the first, and Shift+Tab the other way */
    const all = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!all.length) {
      e.preventDefault();
      return;
    }
    const firstEl = all[0];
    const lastEl = all[all.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === firstEl || at === panel.current)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && at === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  const view = (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-[#21180a]/45 p-4 backdrop-blur-[2px] dark:bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      onKeyDown={onKeyDown}
    >
      <form
        ref={panel}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
        tabIndex={-1}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          /* drawn on top of the page but still inside its React tree: the submit must not reach a form around the opener */
          e.stopPropagation();
          if (!busy) onSubmit?.();
        }}
        className={`my-auto w-full ${wide ? "max-w-lg" : "max-w-md"} animate-[fadeIn_0.18s_ease] rounded-2xl bg-card p-6 text-fg shadow-[0_24px_60px_-20px_rgba(40,25,5,0.45)] outline-none ring-1 ring-fg/10 motion-reduce:animate-none`}
      >
        <div className="flex items-start gap-3">
          {tone === "danger" && (
            <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold leading-snug tracking-tight">{title}</h2>
            {body && <div id={bodyId} className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</div>}
          </div>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-wrap-reverse justify-end gap-2">{footer}</div>
      </form>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(view, document.body);
}

/* ---------------- the host ---------------- */

/** Draws the questions asked with askConfirm / askText / tell, one at a time. Mounted once, by the console's layout. */
export function DialogHost() {
  const current = useSyncExternalStore(subscribe, () => queue[0] ?? null, () => null);
  if (!current) return null;
  /* a fresh dialog per question, so its field and focus start over */
  if (current.kind === "confirm") return <ConfirmDialog key={current.id} a={current} />;
  if (current.kind === "text") return <TextDialog key={current.id} a={current} />;
  return <TellDialog key={current.id} a={current} />;
}

function ConfirmDialog({ a }: { a: Extract<Ask, { kind: "confirm" }> }) {
  const t = useT();
  const answer = (v: boolean) => {
    finish(a.id);
    a.done(v);
  };
  return (
    <Dialog
      title={a.o.title}
      body={a.o.body}
      tone={a.o.danger ? "danger" : "normal"}
      onClose={() => answer(false)}
      onSubmit={() => answer(true)}
      footer={
        <>
          <Btn type="button" kind="ghost" onClick={() => answer(false)}>{a.o.cancel ?? t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" kind={a.o.danger ? "danger" : "primary"} data-autofocus>{a.o.confirm ?? t("Continue", "متابعة")}</Btn>
        </>
      }
    />
  );
}

function TextDialog({ a }: { a: Extract<Ask, { kind: "text" }> }) {
  const t = useT();
  const o = a.o;
  const [v, setV] = useState(o.initial ?? "");
  const [err, setErr] = useState("");
  const inputId = useId();
  const errId = useId();
  const answer = (x: string | null) => {
    finish(a.id);
    a.done(x);
  };
  const submit = () => {
    if (!o.optional && !v.trim()) {
      setErr(t("Write something first.", "اكتب شيئًا أولًا."));
      return;
    }
    answer(v);
  };
  const props = {
    id: inputId,
    value: v,
    maxLength: o.maxLength,
    placeholder: o.placeholder,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": err ? errId : undefined,
    "data-autofocus": true,
  };
  return (
    <Dialog
      title={o.title}
      body={o.body}
      wide={o.multiline}
      onClose={() => answer(null)}
      onSubmit={submit}
      footer={
        <>
          <Btn type="button" kind="ghost" onClick={() => answer(null)}>{o.cancel ?? t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit">{o.confirm ?? t("Save", "حفظ")}</Btn>
        </>
      }
    >
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {o.label}
        {o.optional && <span className="ms-1 font-normal text-muted">{t("(optional)", "(اختياري)")}</span>}
      </label>
      {o.multiline ? (
        <textarea
          {...props}
          rows={4}
          className={area}
          onChange={(e) => (setV(e.target.value), setErr(""))}
          /* in a box of several lines Enter makes a new line; Ctrl or Cmd + Enter saves */
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && (e.preventDefault(), submit())}
        />
      ) : (
        <input {...props} type="text" className={field} onChange={(e) => (setV(e.target.value), setErr(""))} />
      )}
      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span id={errId} role={err ? "alert" : undefined} className="text-red-600">{err}</span>
        {o.maxLength && v.length > o.maxLength * 0.8 && <span className="tabular-nums text-muted">{v.length} / {o.maxLength}</span>}
      </div>
    </Dialog>
  );
}

function TellDialog({ a }: { a: Extract<Ask, { kind: "tell" }> }) {
  const t = useT();
  const close = () => {
    finish(a.id);
    a.done();
  };
  return (
    <Dialog
      title={a.o.title}
      body={a.o.body}
      onClose={close}
      onSubmit={close}
      footer={<Btn type="submit" data-autofocus>{a.o.ok ?? t("OK", "حسنًا")}</Btn>}
    />
  );
}
