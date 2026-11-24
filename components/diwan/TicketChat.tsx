"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { dateLocale } from "@/components/content";
import { pickPicture } from "@/components/designer/image";
import { imageRules, uploadProblemFor, type FileKind } from "@/components/safe";
import { usePrefs } from "@/components/Prefs";
import { arCount } from "@/components/undo";
import { ContactButton } from "@/components/diwan/Contact";
import { ShopAndOwner } from "@/components/diwan/shopBits";
import { area, Badge, Btn, card, field, Loaded, refusedWords, send, useApi, useFmt, useT } from "@/components/diwan/ui";
import { ChatSkeleton } from "@/components/diwan/skeletons";
import { BACKGROUND, toSignIn } from "@/components/diwan/signInAgain";
import { ticketPicture } from "@/components/diwan/TicketBits";
import { useTicketStream } from "@/components/ticketStream";
import { CATEGORY, KIND, PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER, systemLine, type TKind, type TPriority, type TStatus } from "@/components/diwan/ticketWords";

/* what a ticket's picture may be on the server (server/tickets.ts checkPictures): never a GIF, which stays a GIF */
const TICKET_PICTURE_RULE = { ...imageRules.photo, kinds: ["png", "jpeg", "webp"] as FileKind[] };

/* One ticket (support, bug or idea) as a conversation between Dukkan's team and the merchant: his messages on one side,
   the team's replies on the other (orange), internal notes in dashed amber (never sent to him), status lines in the
   middle. The newest message is at the bottom and the page opens there; the box to write in sits under the conversation
   like a chat's, with two clearly different modes (a reply he reads, or a note only staff see). Beside it: the store
   (its contact details behind a Contact button) and status / priority / assignee. Opening this page is written to the
   activity log by the server. */

type Msg = { id: string; author: "merchant" | "staff" | "system"; internal: boolean; body: string; at: string; staff: { id: string; name: string } | null; pictures: string[] };
type Ticket = {
  number: number; kind: TKind; category: number; subject: string; status: TStatus; priority: TPriority; assigneeId: string | null;
  where: string; created: string; updated: string;
  shop: { accountId: string; name: string; owner: string; storePhone: string; slug: string | null; status: string | null };
  messages: Msg[];
};
type Data = { ticket: Ticket; staff: { id: string; name: string; role: string }[]; me: string };
type Canned = { title: string; body_en: string; body_ar: string };
type Fields = { status: TStatus; priority: TPriority; assignee: string };

/* The open ticket is live (owner 2026-11-24: like a real chat): a stream from the server says the moment the merchant
   (or another staff member) writes, and it loads again at once (components/ticketStream.ts). It also checks by itself
   every SLOW_MS while the stream is open, and every REFRESH_MS (as before the stream) while it can't be. */
const REFRESH_MS = 3_000;
const SLOW_MS = 30_000;
/** A failed send: no connection (status 0) or the server down is the connection message, anything else the page's own */
const offline = (status: number) => status === 0 || status >= 500;

/** Where Diwan opens a ticket: support tickets under Tickets, bug reports and ideas under Bugs and ideas (they are kept
    as tickets too, for one conversation with replies and statuses, but they are their own thing for the team) */
export const ticketHref = (kind: string, number: number | string) => (kind === "bug" || kind === "idea" ? `/diwan/feedback/${number}` : `/diwan/tickets/${number}`);

/** The ticket page, shared by /diwan/tickets/<n> (support) and /diwan/feedback/<n> (bugs and ideas). A ticket opened
    under the other one moves to its own address, so the sidebar, the back link and the title always match what it is. */
export function TicketChat({ area }: { area: "tickets" | "feedback" }) {
  const number = String(useParams()?.number ?? "");
  const router = useRouter();
  const s = useApi<Data>(/^\d+$/.test(number) ? `/api/diwan/tickets/${number}` : null);
  const kind = s.data?.ticket.kind;
  const wrong = !!kind && (kind === "support") !== (area === "tickets");
  useEffect(() => {
    if (wrong && kind) router.replace(ticketHref(kind, number));
  }, [wrong, kind, number, router]);
  if (wrong) return null;
  /* a new view per ticket: the composer always opens in "Reply", never in the mode the last ticket was left in */
  return <Loaded s={s} skeleton={<ChatSkeleton />}>{(d) => <TicketView key={d.ticket.number} first={d} />}</Loaded>;
}

const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();
const lockIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

function TicketView({ first }: { first: Data }) {
  const t = useT();
  const f = useFmt();
  /* the ticket as last loaded: the first load, then each quiet refresh */
  const [d, setD] = useState(first);
  const tk = d.ticket;
  const [big, setBig] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const canned = useApi<{ replies: Canned[] }>("/api/diwan/tickets/canned");
  const back = tk.kind === "support" ? { href: "/diwan/tickets", label: t("All tickets", "كل التذاكر") } : { href: "/diwan/feedback", label: t("Bugs and ideas", "الأخطاء والأفكار") };
  const merchantName = tk.shop.name || tk.shop.owner;
  const scroller = useRef<HTMLDivElement>(null);
  const { lang } = usePrefs();
  /* a message's time of day, in the page's language (its day is on the line above it) */
  const time = (v: string) => new Date(v).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });

  /* Status, priority and assignee show the new choice at once; the server's answer then confirms it (the ticket is
     loaded again) or puts it back with a message. */
  const [pending, setPending] = useState<Partial<Fields>>({});
  const [saving, setSaving] = useState<keyof Fields | null>(null);
  const savingRef = useRef<keyof Fields | null>(null);
  const [saved, setSaved] = useState<keyof Fields | null>(null);
  const [err, setErr] = useState("");
  const shown: Fields = { status: pending.status ?? tk.status, priority: pending.priority ?? tk.priority, assignee: pending.assignee ?? tk.assigneeId ?? "" };

  /* Loads the ticket again without a loading screen: after each change, and each time the live stream (or its fallback
     check) says it changed while the tab is in view, so a message the merchant (or another staff member) writes shows up here without reopening the ticket. A
     failed load says nothing and the next one tries again; only the newest answer is used. The loaded ticket holds
     the saved choices, so the waiting values go, except the one still being saved. */
  const asked = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++asked.current;
    try {
      /* a load the page makes by itself, not something the staff member did: it does not keep the session from
         ending after 60 minutes with nothing done (server/staff.ts staffFromToken) */
      const r = await fetch(`/api/diwan/tickets/${first.ticket.number}`, { credentials: "same-origin", cache: "no-store", headers: BACKGROUND });
      if (r.status === 401) {
        toSignIn();
        return;
      }
      const j = r.ok ? await r.json() : null;
      if (n !== asked.current || !j?.ticket) return;
      setD(j as Data);
      setPending((p) => {
        const k = savingRef.current;
        return k && p[k] !== undefined ? { [k]: p[k] } : {};
      });
    } catch {
      /* no connection: the next refresh tries again */
    }
  }, [first.ticket.number]);
  useTicketStream(`/api/diwan/tickets/${first.ticket.number}/events`, () => void refresh(), { fastMs: REFRESH_MS, slowMs: SLOW_MS });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* The conversation opens on what the merchant wrote last (or, with nothing from him, the newest real message), near
     the top of the box, so his problem is in view and not a run of status lines. After that it follows each new message,
     but only while it is scrolled to the bottom: someone who scrolled up to read is left where he is. */
  const atBottom = useRef(true);
  const opened = useRef(false);
  const onScroll = () => {
    const el = scroller.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const real = tk.messages.filter((m) => m.author !== "system");
  const focusId = ([...real].reverse().find((m) => m.author === "merchant") ?? real[real.length - 1])?.id ?? null;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!opened.current) {
      opened.current = true;
      const target = focusId ? el.querySelector<HTMLElement>(`[data-msg="${CSS.escape(focusId)}"]`) : null;
      el.scrollTop = target ? Math.max(0, target.offsetTop - 16) : el.scrollHeight;
      onScroll();
      return;
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tk.messages.length]);
  /* the runs of status lines opened to show each change (by the id of their first line) */
  const [openRuns, setOpenRuns] = useState<Set<string>>(() => new Set());

  const change = async (k: keyof Fields, v: string) => {
    setPending((p) => ({ ...p, [k]: v }));
    savingRef.current = k;
    setSaving(k);
    setSaved(null);
    setErr("");
    let r: Awaited<ReturnType<typeof send>> = { ok: false, status: 0, data: null };
    try {
      r = await send(`/api/diwan/tickets/${tk.number}`, "PATCH", k === "assignee" ? { assignee: v || null } : { [k]: v });
    } finally {
      savingRef.current = null;
      setSaving(null);
    }
    if (!r.ok || r.data?.result !== "ok") {
      /* back to what is really saved */
      setPending((p) => ({ ...p, [k]: undefined }));
      setErr(
        refusedWords(t, r) ??
          (offline(r.status) || r.ok
            ? t("It could not be saved. Check the connection and try again.", "تعذّر الحفظ. تحقّق من الاتصال وحاول مرة أخرى.")
            : t("The change was not saved. Try again.", "لم يُحفظ التغيير. حاول مجددًا.")),
      );
    } else {
      setSaved(k);
      setTimeout(() => setSaved((x) => (x === k ? null : x)), 2000);
    }
    void refresh();
  };

  const label = "mb-1 flex items-center justify-between text-xs font-medium text-muted";
  const savedMark = (k: keyof Fields) =>
    saving === k ? <span>{t("Saving…", "جارٍ الحفظ…")}</span> : saved === k ? <span className="text-emerald-700 dark:text-emerald-400">{t("Saved", "حُفظ")}</span> : null;

  /* one status line (a change of status, priority or assignee) */
  const sysLine = (m: Msg) => (
    <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-fg/[0.05] px-3 py-1 text-center text-xs text-muted">
      {systemLine(m.body, t)}
      {m.staff ? ` · ${m.staff.name}` : ""} · <bdi>{time(m.at)}</bdi>
      {m.internal && <span className="ms-1">({t("staff only", "للفريق فقط")})</span>}
    </p>
  );
  /* the conversation, with a line for each new day. Status lines one after another (on one day) fold into one compact
     "N changes" line that opens to show them; a single one shows as it is. */
  let lastDay = "";
  const items: React.ReactNode[] = [];
  const msgs = tk.messages;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const day = new Date(m.at).toDateString();
    if (day !== lastDay)
      items.push(
        <div key={`day-${m.id}`} className="my-2 flex items-center gap-3 text-[11px] font-semibold text-muted">
          <span className="h-px flex-1 bg-fg/10" />
          {f.date(m.at)}
          <span className="h-px flex-1 bg-fg/10" />
        </div>,
      );
    lastDay = day;
    if (m.author === "system") {
      const run = [m];
      while (i + 1 < msgs.length && msgs[i + 1].author === "system" && new Date(msgs[i + 1].at).toDateString() === day) run.push(msgs[++i]);
      if (run.length === 1) {
        items.push(sysLine(m));
        continue;
      }
      const open = openRuns.has(m.id);
      const runFrom = time(run[0].at);
      const runTo = time(run[run.length - 1].at);
      const toggle = () =>
        setOpenRuns((x) => {
          const n = new Set(x);
          if (n.has(m.id)) n.delete(m.id);
          else n.add(m.id);
          return n;
        });
      items.push(
        <div key={`run-${m.id}`} className="space-y-1.5">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-fg/[0.05] px-3 py-1 text-xs font-medium text-muted transition hover:bg-fg/[0.09] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t(`${f.num(run.length)} changes`, arCount(run.length, { one: "تغيير واحد", two: "تغييران", few: "تغييرات", many: "تغييرًا" }))}
            {/* one time when the run began and ended in the same minute; a range only when they differ. Each time is
                isolated (bdi) so "07:08 م" keeps its own order inside the range. */}
            <span className="opacity-70">
              ·{" "}
              {runFrom === runTo ? (
                <bdi>{runFrom}</bdi>
              ) : (
                <>
                  <bdi>{runFrom}</bdi>–<bdi>{runTo}</bdi>
                </>
              )}
            </span>
            <svg aria-hidden viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {open && run.map(sysLine)}
        </div>,
      );
      continue;
    }
    const staffSide = m.author === "staff";
    const who = staffSide ? m.staff?.name ?? t("Dukkan team", "فريق دكان") : merchantName;
    /* an internal note is a sticky note on the thread (app/globals.css), never a chat bubble */
    const bubble = m.internal
      ? "sticky-note !rounded-[3px] mt-2 -rotate-[0.6deg] rtl:rotate-[0.6deg]"
      : staffSide
        ? "rounded-se-md bg-primary/[0.12] ring-1 ring-primary/25"
        : "rounded-ss-md bg-card ring-1 ring-fg/10";
    items.push(
      <div key={m.id} data-msg={m.id} className={`flex items-end gap-2.5 ${staffSide ? "flex-row-reverse" : ""}`}>
        <span
          aria-hidden
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
            m.internal ? "bg-amber-500/20 text-amber-800 dark:text-amber-200" : staffSide ? "bg-primary text-white dark:text-page" : "bg-fg/10 text-fg"
          }`}
        >
          {initial(who)}
        </span>
        <div className={`min-w-0 max-w-[78%] rounded-2xl px-4 py-2.5 ${bubble}`}>
          {m.internal && (
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              {lockIcon}
              {t("Internal note · only staff", "ملاحظة داخلية · للفريق فقط")}
            </p>
          )}
          <p className={`text-xs font-bold ${staffSide && !m.internal ? "text-deep dark:text-primary" : ""}`}>{who}</p>
          {m.body && <p dir="auto" className="mt-0.5 whitespace-pre-wrap break-words text-start text-sm">{m.body}</p>}
          {!!m.pictures.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.pictures.map((p) => (
                <button key={p} type="button" onClick={() => setBig(ticketPicture(tk.number, p))} title={t("Open the picture", "فتح الصورة")} aria-label={t("Open the picture", "فتح الصورة")} className="overflow-hidden rounded-lg ring-1 ring-fg/15 transition hover:ring-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ticketPicture(tk.number, p)} alt="" loading="lazy" className="h-20 w-20 object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-end text-[11px] text-muted">{time(m.at)}</p>
        </div>
      </div>,
    );
  }

  return (
    <div>
      <Link href={back.href} className="text-sm font-medium text-primary hover:underline">← {back.label}</Link>
      <div className="mb-5 mt-2 flex flex-wrap items-start gap-3">
        {/* what it is and its number: "Ticket #1001", "Bug report #1003", "Idea #1004" */}
        <span className="mt-0.5 whitespace-nowrap rounded-xl bg-primary/10 px-3 py-1.5 text-lg font-extrabold text-primary ring-1 ring-primary/25">
          {tk.kind === "bug" ? t("Bug report", "بلاغ خطأ") : tk.kind === "idea" ? t("Idea", "فكرة") : t("Ticket", "تذكرة")} <span dir="ltr" className="font-mono">#{tk.number}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold">{tk.subject}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={KIND[tk.kind].tone}>{t(KIND[tk.kind].en, KIND[tk.kind].ar)}</Badge>
            <Badge tone={STATUS[shown.status].tone}>{t(STATUS[shown.status].en, STATUS[shown.status].ar)}</Badge>
            <Badge tone={PRIORITY[shown.priority].tone}>{t(PRIORITY[shown.priority].en, PRIORITY[shown.priority].ar)}</Badge>
            <Badge>{t(CATEGORY[tk.category]?.en ?? "Other", CATEGORY[tk.category]?.ar ?? "أخرى")}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          <section className={`${card} flex h-[calc(100dvh-14rem)] min-h-[32rem] flex-col overflow-hidden p-0`} aria-label={t("Conversation", "المحادثة")}>
            <div ref={scroller} onScroll={onScroll} className="diwan-scroll relative flex-1 space-y-3 overflow-y-auto bg-fg/[0.015] px-4 py-5 sm:px-6">
              {tk.where && (
                <p className="rounded-xl bg-soft px-3 py-2 text-xs">
                  <span className="font-semibold">{t("Where in the designer: ", "المكان في المصمم: ")}</span>
                  {tk.where}
                </p>
              )}
              {items}
            </div>
            <Composer
              number={tk.number}
              merchant={merchantName}
              canned={canned.data?.replies ?? []}
              manage={manage}
              onManage={() => setManage((v) => !v)}
              onSent={() => {
                /* his own message is shown at the bottom, wherever he had scrolled */
                atBottom.current = true;
                void refresh();
              }}
            />
          </section>
          {manage && canned.data && (
            <section className={card}>
              <h2 className="mb-3 font-bold">{t("Ready answers", "الردود الجاهزة")}</h2>
              <CannedEditor initial={canned.data.replies} onSaved={canned.reload} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Store", "المتجر")}</p>
            <ShopAndOwner id={tk.shop.accountId} shop={tk.shop.name} owner={tk.shop.owner} className="mt-1 text-lg" />
            {tk.shop.status === "suspended" && <div className="mt-2"><Badge tone="red">{t("Suspended", "موقوف")}</Badge></div>}
            <p className="mt-3 text-xs text-muted">{t("Opened", "فُتحت")} {f.dateTime(tk.created)} · {t("last activity", "آخر نشاط")} {f.ago(tk.updated)}</p>
            <ContactButton shopId={tk.shop.accountId} info={{ owner: tk.shop.owner, storePhone: tk.shop.storePhone }} className="mt-3" />
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <label className={label} htmlFor="st">
                {t("Status", "الحالة")} {savedMark("status")}
              </label>
              <select id="st" className={field} value={shown.status} disabled={!!saving} onChange={(e) => void change("status", e.target.value)}>
                {STATUS_ORDER.map((x) => <option key={x} value={x}>{t(STATUS[x].en, STATUS[x].ar)}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">{t("Solved or closed tells the merchant.", "عند الحل أو الإغلاق يصل إشعار للتاجر.")}</p>
            </div>
            <div>
              <label className={label} htmlFor="pr">
                {t("Priority", "الأولوية")} {savedMark("priority")}
              </label>
              <select id="pr" className={field} value={shown.priority} disabled={!!saving} onChange={(e) => void change("priority", e.target.value)}>
                {PRIORITY_ORDER.map((x) => <option key={x} value={x}>{t(PRIORITY[x].en, PRIORITY[x].ar)}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="as">
                {t("Assigned to", "مسندة إلى")} {savedMark("assignee")}
              </label>
              <select id="as" className={field} value={shown.assignee} disabled={!!saving} onChange={(e) => void change("assignee", e.target.value)}>
                <option value="">{t("No one", "لا أحد")}</option>
                {d.staff.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === d.me ? t(" (me)", " (أنا)") : ""}</option>)}
              </select>
              {shown.assignee !== d.me && (
                <button type="button" disabled={!!saving} onClick={() => void change("assignee", d.me)} className="mt-1 text-xs font-semibold text-primary hover:underline">
                  {t("Assign to me", "أسندها إليّ")}
                </button>
              )}
            </div>
            {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</p>}
          </section>
        </aside>
      </div>

      {big && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}

/* ---------------- the box to write in, with ready answers ---------------- */

/* Two modes that can't be mistaken for each other: "Reply to merchant" in the page's own colours (he reads it and is
   told), "Internal note" all in amber with a lock and a line that says he is not told. The mode stays after sending,
   but each ticket opens in Reply (the view is new per ticket). */
function Composer({ number, merchant, canned, manage, onManage, onSent }: { number: number; merchant: string; canned: Canned[]; manage: boolean; onManage: () => void; onSent: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [pics, setPics] = useState<string[]>([]);
  /* pictures still being read: Send waits for them, so a reply never goes without them */
  const [reading, setReading] = useState(0);
  /* why a picked picture was not added (too many, too big, a kind the server refuses): said, never dropped quietly */
  const [picNote, setPicNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const note = mode === "note";

  const insert = (v: string) => {
    const [i, lang] = v.split(":");
    const c = canned[Number(i)];
    if (!c) return;
    const body = lang === "ar" ? c.body_ar || c.body_en : c.body_en || c.body_ar;
    setText((x) => (x.trim() ? `${x.trimEnd()}\n\n${body}` : body));
  };

  const add = async (files: FileList | null) => {
    if (!files) return;
    const all = Array.from(files);
    const list = all.slice(0, Math.max(0, 5 - pics.length - reading));
    setPicNote(all.length > list.length ? t("A message has up to 5 pictures: the rest were not added.", "للرسالة 5 صور على الأكثر: لم تُضف البقية.") : "");
    if (!list.length) return;
    setReading((n) => n + list.length);
    const picked = await Promise.all(list.map((f) => pickPicture(f, TICKET_PICTURE_RULE, 1600, "image/jpeg", 0.78)));
    setReading((n) => Math.max(0, n - list.length));
    const read: string[] = [];
    for (const p of picked) {
      if ("url" in p && /^data:image\/(jpeg|png|webp);/.test(p.url)) read.push(p.url);
      else setPicNote(uploadProblemFor("problem" in p ? p.problem : "type", TICKET_PICTURE_RULE, t("en", "ar") as "en" | "ar"));
    }
    setPics((p) => [...p, ...read].slice(0, 5));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pics.length) return;
    if (reading > 0) return setErr(t("Pictures are still loading. Send again in a moment.", "ما زالت الصور قيد التحميل. أرسل مرة أخرى بعد لحظة."));
    setBusy(true);
    setErr("");
    let r: Awaited<ReturnType<typeof send>> = { ok: false, status: 0, data: null };
    try {
      r = await send(`/api/diwan/tickets/${number}/reply`, "POST", { body: text, internal: note, pictures: pics });
    } finally {
      setBusy(false);
    }
    /* not sent: the text and pictures stay, to send again */
    if (!r.ok || r.data?.result !== "ok")
      return setErr(
        r.data?.field === "pictures"
          ? t("One of the pictures could not be sent. Remove it and try again.", "تعذّر إرسال إحدى الصور. احذفها وحاول مرة أخرى.")
          : offline(r.status) || r.ok
            ? note
              ? t("It could not be saved. Check the connection and try again.", "تعذّر الحفظ. تحقّق من الاتصال وحاول مرة أخرى.")
              : t("It could not be sent. Check the connection and try again.", "تعذّر الإرسال. تحقّق من الاتصال وحاول مرة أخرى.")
            : t("It was not sent. Try again.", "لم يُرسل. حاول مرة أخرى."),
      );
    setText("");
    setPics([]);
    setPicNote("");
    onSent();
  };

  const tab = (m: "reply" | "note", label: string, icon?: React.ReactNode) => {
    const on = mode === m;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => setMode(m)}
        className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          on
            ? m === "note"
              ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
              : "border-primary bg-card text-fg"
            : "border-transparent text-muted hover:text-fg"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <form
      onSubmit={submit}
      className={`border-t-2 transition-colors ${note ? "border-amber-500/70 bg-amber-50 dark:bg-amber-500/[0.07]" : "border-fg/10 bg-card"}`}
    >
      <div role="tablist" aria-label={t("Who reads it", "من يقرأ ما تكتبه")} className="flex gap-1 px-3 pt-2">
        {tab("reply", t("Reply to merchant", "الرد على التاجر"))}
        {tab("note", t("Internal note", "ملاحظة داخلية"), lockIcon)}
      </div>
      <div className="space-y-2 px-4 pb-3 pt-2">
        {note ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            {lockIcon}
            {t("Only Dukkan staff see this note. The merchant is not told.", "لا يرى هذه الملاحظة إلا فريق دكان. لا يُبلَّغ التاجر.")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${field} h-9 max-w-xs py-1 text-sm`} value="" onChange={(e) => insert(e.target.value)} disabled={!canned.length} aria-label={t("Insert a ready answer", "إدراج رد جاهز")}>
              <option value="">{canned.length ? t("Insert a ready answer…", "إدراج رد جاهز…") : t("No ready answers yet", "لا توجد ردود جاهزة بعد")}</option>
              {canned.flatMap((c, i) => [
                c.body_en ? <option key={`${i}en`} value={`${i}:en`}>{c.title} (English)</option> : null,
                c.body_ar ? <option key={`${i}ar`} value={`${i}:ar`}>{c.title} (العربية)</option> : null,
              ])}
            </select>
            <button type="button" onClick={onManage} className="text-xs font-semibold text-primary hover:underline">
              {manage ? t("Hide ready answers", "إخفاء الردود الجاهزة") : t("Manage ready answers", "إدارة الردود الجاهزة")}
            </button>
          </div>
        )}
        {note ? (
          /* the note is written on a sticky note (app/globals.css .sticky-note): it drops in each time the tab is picked */
          <div key="note" className="sticky-note sticky-note-in mt-4 px-4 pb-4 pt-3 focus-within:ring-2 focus-within:ring-amber-500/60">
            <textarea
              className="sticky-note-lines block w-full resize-y border-0 bg-transparent text-sm text-inherit outline-none placeholder:text-[rgb(var(--note-ink)/0.5)]"
              rows={4}
              dir="auto"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              aria-label={t("Internal note", "ملاحظة داخلية")}
              placeholder={t("Write a note for the team…", "اكتب ملاحظة للفريق…")}
            />
          </div>
        ) : (
          <textarea
            className={area}
            rows={3}
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            aria-label={t("Reply to merchant", "الرد على التاجر")}
            placeholder={t(`Write to ${merchant}… they will see this`, `اكتب إلى ${merchant}… سيرى ما تكتبه`)}
          />
        )}
        {!!pics.length && (
          <div className="flex flex-wrap gap-2">
            {pics.map((p, i) => (
              <span key={i} className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-fg/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPics((l) => l.filter((_, j) => j !== i))} className="absolute end-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white" aria-label={t("Remove", "إزالة")}>×</button>
              </span>
            ))}
          </div>
        )}
        {picNote && <p className="text-sm text-amber-700 dark:text-amber-300">{picNote}</p>}
        {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="ghost" type="button" className="h-9 px-3" disabled={pics.length + reading >= 5} onClick={() => fileRef.current?.click()}>
            {t("Add a picture", "إضافة صورة")} <span dir="ltr" className="text-muted">{pics.length}/5</span>
          </Btn>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          {note ? (
            <button
              type="submit"
              disabled={busy || (!text.trim() && !pics.length)}
              className="ms-auto inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lockIcon}
              {busy ? t("Saving…", "جارٍ الحفظ…") : t("Save note", "حفظ الملاحظة")}
            </button>
          ) : (
            <Btn type="submit" className="ms-auto" disabled={busy || (!text.trim() && !pics.length)}>
              {busy ? t("Sending…", "جارٍ الإرسال…") : t("Send to merchant", "إرسال للتاجر")}
            </Btn>
          )}
        </div>
      </div>
    </form>
  );
}

function CannedEditor({ initial, onSaved }: { initial: Canned[]; onSaved: () => void }) {
  const t = useT();
  const [list, setList] = useState<Canned[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const edit = (i: number, k: keyof Canned, v: string) => setList((l) => l.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const save = async () => {
    setBusy(true);
    setMsg("");
    let r: Awaited<ReturnType<typeof send>> = { ok: false, status: 0, data: null };
    try {
      r = await send("/api/diwan/tickets/canned", "PUT", { replies: list });
    } finally {
      setBusy(false);
    }
    const ok = r.ok && r.data?.result === "ok";
    setMsg(
      ok
        ? t("Saved.", "تم الحفظ.")
        : offline(r.status) || r.ok
          ? t("It could not be saved. Check the connection and try again.", "تعذّر الحفظ. تحقّق من الاتصال وحاول مرة أخرى.")
          : t("Not saved: each one needs a title and a text in at least one language.", "لم يُحفظ: كل رد يحتاج عنوانًا ونصًا بلغة واحدة على الأقل."),
    );
    if (ok) onSaved();
  };
  return (
    <div className="space-y-3 rounded-xl bg-soft p-3">
      {list.map((c, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-fg/10">
          <div className="flex gap-2">
            <input className={field} value={c.title} maxLength={80} onChange={(e) => edit(i, "title", e.target.value)} placeholder={t("Title (for staff)", "العنوان (للفريق)")} />
            <Btn kind="ghost" type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>{t("Remove", "حذف")}</Btn>
          </div>
          <textarea className={area} rows={3} dir="ltr" value={c.body_en} maxLength={3000} onChange={(e) => edit(i, "body_en", e.target.value)} placeholder={t("Text in English", "النص بالإنجليزية")} />
          <textarea className={area} rows={3} dir="rtl" value={c.body_ar} maxLength={3000} onChange={(e) => edit(i, "body_ar", e.target.value)} placeholder={t("Text in Arabic", "النص بالعربية")} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="ghost" type="button" disabled={list.length >= 50} onClick={() => setList((l) => [...l, { title: "", body_en: "", body_ar: "" }])}>{t("Add a ready answer", "إضافة رد جاهز")}</Btn>
        <Btn type="button" disabled={busy} onClick={() => void save()}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save ready answers", "حفظ الردود الجاهزة")}</Btn>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
