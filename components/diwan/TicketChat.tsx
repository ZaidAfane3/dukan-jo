"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dateLocale } from "@/components/content";
import { readPhoto } from "@/components/designer/image";
import { usePrefs } from "@/components/Prefs";
import { ContactButton } from "@/components/diwan/Contact";
import { ShopAndOwner } from "@/components/diwan/shopBits";
import { area, Badge, Btn, card, field, Loaded, send, useApi, useFmt, useT } from "@/components/diwan/ui";
import { ticketPicture } from "@/components/diwan/TicketBits";
import { CATEGORY, KIND, PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER, systemLine, type TKind, type TPriority, type TStatus } from "@/components/diwan/ticketWords";

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
  shop: { accountId: string; name: string; owner: string; email: string; phone: string; storePhone: string; slug: string | null; status: string | null };
  messages: Msg[];
};
type Data = { ticket: Ticket; staff: { id: string; name: string; role: string }[]; me: string };
type Canned = { title: string; body_en: string; body_ar: string };
type Fields = { status: TStatus; priority: TPriority; assignee: string };

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
  return <Loaded s={s}>{(d) => <TicketView key={d.ticket.number} d={d} reload={s.reload} />}</Loaded>;
}

const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();
const lockIcon = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

function TicketView({ d, reload }: { d: Data; reload: () => void }) {
  const t = useT();
  const f = useFmt();
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
  const [saved, setSaved] = useState<keyof Fields | null>(null);
  const [err, setErr] = useState("");
  const shown: Fields = { status: pending.status ?? tk.status, priority: pending.priority ?? tk.priority, assignee: pending.assignee ?? tk.assigneeId ?? "" };
  /* the reloaded ticket now holds the choice: the waiting value is no longer needed */
  useEffect(() => setPending({}), [tk.status, tk.priority, tk.assigneeId, tk.updated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* the conversation opens at its newest message, and follows each new one */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tk.messages.length]);

  const change = async (k: keyof Fields, v: string) => {
    setPending((p) => ({ ...p, [k]: v }));
    setSaving(k);
    setSaved(null);
    setErr("");
    const r = await send(`/api/diwan/tickets/${tk.number}`, "PATCH", k === "assignee" ? { assignee: v || null } : { [k]: v });
    setSaving(null);
    if (!r.ok) {
      setPending((p) => ({ ...p, [k]: undefined }));
      setErr(
        r.status === 403
          ? t("Your role can't change this, or the page is out of date. Reload it and try again.", "دورك لا يسمح بهذا التغيير، أو الصفحة قديمة. أعد تحميلها وحاول مجددًا.")
          : t("The change was not saved. Try again.", "لم يُحفظ التغيير. حاول مجددًا."),
      );
    } else {
      setSaved(k);
      setTimeout(() => setSaved((x) => (x === k ? null : x)), 2000);
    }
    reload();
  };

  const label = "mb-1 flex items-center justify-between text-xs font-medium text-muted";
  const savedMark = (k: keyof Fields) =>
    saving === k ? <span>{t("Saving…", "جارٍ الحفظ…")}</span> : saved === k ? <span className="text-emerald-700 dark:text-emerald-400">{t("Saved", "حُفظ")}</span> : null;

  /* the conversation, with a line for each new day */
  let lastDay = "";
  const items = tk.messages.map((m) => {
    const day = new Date(m.at).toDateString();
    const sep = day !== lastDay ? (
      <div key={`day-${m.id}`} className="my-2 flex items-center gap-3 text-[11px] font-semibold text-muted">
        <span className="h-px flex-1 bg-fg/10" />
        {f.date(m.at)}
        <span className="h-px flex-1 bg-fg/10" />
      </div>
    ) : null;
    lastDay = day;
    if (m.author === "system")
      return [
        sep,
        <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-fg/[0.05] px-3 py-1 text-center text-xs text-muted">
          {systemLine(m.body, t)}
          {m.staff ? ` · ${m.staff.name}` : ""} · {time(m.at)}
          {m.internal && <span className="ms-1">({t("staff only", "للفريق فقط")})</span>}
        </p>,
      ];
    const staffSide = m.author === "staff";
    const who = staffSide ? m.staff?.name ?? t("Dukkan team", "فريق دكّان") : merchantName;
    const bubble = m.internal
      ? "border-2 border-dashed border-amber-500/70 bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-50"
      : staffSide
        ? "rounded-se-md bg-primary/[0.12] ring-1 ring-primary/25"
        : "rounded-ss-md bg-card ring-1 ring-fg/10";
    return [
      sep,
      <div key={m.id} className={`flex items-end gap-2.5 ${staffSide ? "flex-row-reverse" : ""}`}>
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
    ];
  });

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
            <div ref={scroller} className="diwan-scroll flex-1 space-y-3 overflow-y-auto bg-fg/[0.015] px-4 py-5 sm:px-6">
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
              onSent={reload}
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
            <ContactButton info={{ owner: tk.shop.owner, email: tk.shop.email, phone: tk.shop.phone, storePhone: tk.shop.storePhone }} className="mt-3" />
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <label className={label} htmlFor="st">
                {t("Status", "الحالة")} {savedMark("status")}
              </label>
              <select id="st" className={field} value={shown.status} disabled={saving === "status"} onChange={(e) => void change("status", e.target.value)}>
                {STATUS_ORDER.map((x) => <option key={x} value={x}>{t(STATUS[x].en, STATUS[x].ar)}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">{t("Solved or closed tells the merchant.", "عند الحل أو الإغلاق يصل إشعار للتاجر.")}</p>
            </div>
            <div>
              <label className={label} htmlFor="pr">
                {t("Priority", "الأولوية")} {savedMark("priority")}
              </label>
              <select id="pr" className={field} value={shown.priority} disabled={saving === "priority"} onChange={(e) => void change("priority", e.target.value)}>
                {PRIORITY_ORDER.map((x) => <option key={x} value={x}>{t(PRIORITY[x].en, PRIORITY[x].ar)}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="as">
                {t("Assigned to", "مسندة إلى")} {savedMark("assignee")}
              </label>
              <select id="as" className={field} value={shown.assignee} disabled={saving === "assignee"} onChange={(e) => void change("assignee", e.target.value)}>
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
    const list = Array.from(files).slice(0, Math.max(0, 5 - pics.length));
    const read = (await Promise.all(list.map((f) => readPhoto(f, 1600)))).filter((u): u is string => !!u && /^data:image\/(jpeg|png|webp);/.test(u));
    setPics((p) => [...p, ...read].slice(0, 5));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pics.length) return;
    setBusy(true);
    setErr("");
    const r = await send(`/api/diwan/tickets/${number}/reply`, "POST", { body: text, internal: note, pictures: pics });
    setBusy(false);
    if (!r.ok) return setErr(t("It was not sent. Try again.", "لم يُرسل. حاول مرة أخرى."));
    setText("");
    setPics([]);
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
            {t("Only Dukkan staff see this note. The merchant is not told.", "لا يرى هذه الملاحظة إلا فريق دكّان. لا يُبلَّغ التاجر.")}
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
        <textarea
          className={`${area} ${note ? "border-amber-400 bg-white/70 focus:border-amber-500 focus:ring-amber-500/25 dark:border-amber-500/40 dark:bg-black/20" : ""}`}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          aria-label={note ? t("Internal note", "ملاحظة داخلية") : t("Reply to merchant", "الرد على التاجر")}
          placeholder={note ? t("Write a note for the team…", "اكتب ملاحظة للفريق…") : t(`Write to ${merchant}… they will see this`, `اكتب إلى ${merchant}… سيرى ما تكتبه`)}
        />
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
        {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="ghost" type="button" className="h-9 px-3" disabled={pics.length >= 5} onClick={() => fileRef.current?.click()}>
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
    const r = await send("/api/diwan/tickets/canned", "PUT", { replies: list });
    setBusy(false);
    setMsg(r.ok ? t("Saved.", "تم الحفظ.") : t("Not saved: each one needs a title and a text in at least one language.", "لم يُحفظ: كل رد يحتاج عنوانًا ونصًا بلغة واحدة على الأقل."));
    if (r.ok) onSaved();
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
