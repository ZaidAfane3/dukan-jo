"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readPhoto } from "@/components/designer/image";
import { area, Badge, Btn, card, field, Loaded, send, useApi, useFmt, useT } from "@/components/diwan/ui";
import { ticketPicture } from "@/components/diwan/TicketBits";
import { CATEGORY, KIND, PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER, systemLine, type TKind, type TPriority, type TStatus } from "@/components/diwan/ticketWords";

/* One ticket (support, bug or idea): the shop it came from, the whole conversation with internal notes (shown apart and
   never sent to the merchant), the reply box with ready answers, and status / priority / assignee. Opening this page is
   written to the activity log by the server. */

type Msg = { id: string; author: "merchant" | "staff" | "system"; internal: boolean; body: string; at: string; staff: { id: string; name: string } | null; pictures: string[] };
type Ticket = {
  number: number; kind: TKind; category: number; subject: string; status: TStatus; priority: TPriority; assigneeId: string | null;
  where: string; created: string; updated: string;
  shop: { accountId: string; name: string; owner: string; email: string; phone: string; slug: string | null; status: string | null };
  messages: Msg[];
};
type Data = { ticket: Ticket; staff: { id: string; name: string; role: string }[]; me: string };
type Canned = { title: string; body_en: string; body_ar: string };

export default function TicketPage() {
  const number = String(useParams()?.number ?? "");
  const s = useApi<Data>(/^\d+$/.test(number) ? `/api/diwan/tickets/${number}` : null);
  return <Loaded s={s}>{(d) => <TicketView d={d} reload={s.reload} />}</Loaded>;
}

function TicketView({ d, reload }: { d: Data; reload: () => void }) {
  const t = useT();
  const f = useFmt();
  const tk = d.ticket;
  const [big, setBig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const back = tk.kind === "support" ? { href: "/diwan/tickets", label: t("All tickets", "كل التذاكر") } : { href: "/diwan/feedback", label: t("Bugs and ideas", "الأخطاء والأفكار") };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const change = async (body: Record<string, string | null>) => {
    setSaving(true);
    setErr("");
    const r = await send(`/api/diwan/tickets/${tk.number}`, "PATCH", body);
    setSaving(false);
    if (!r.ok) setErr(t("The change was not saved.", "لم يُحفظ التغيير."));
    reload();
  };

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <Link href={back.href} className="text-sm font-medium text-primary hover:underline">← {back.label}</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold"><span dir="ltr" className="text-muted">#{tk.number}</span> {tk.subject}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={KIND[tk.kind].tone}>{t(KIND[tk.kind].en, KIND[tk.kind].ar)}</Badge>
            <Badge tone={STATUS[tk.status].tone}>{t(STATUS[tk.status].en, STATUS[tk.status].ar)}</Badge>
            <Badge tone={PRIORITY[tk.priority].tone}>{t(PRIORITY[tk.priority].en, PRIORITY[tk.priority].ar)}</Badge>
            <Badge>{t(CATEGORY[tk.category]?.en ?? "Other", CATEGORY[tk.category]?.ar ?? "أخرى")}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {tk.where && (
            <p className={`${card} text-sm`}>
              <span className="font-semibold">{t("Where in the designer: ", "المكان في المصمم: ")}</span>
              {tk.where}
            </p>
          )}

          <section className={`${card} space-y-4`}>
            {tk.messages.map((m) => {
              if (m.author === "system") {
                return (
                  <p key={m.id} className="text-center text-xs text-muted">
                    {systemLine(m.body, t)}
                    {m.staff ? ` · ${m.staff.name}` : ""} · {f.dateTime(m.at)}
                    {m.internal && <span className="ms-1">({t("staff only", "للفريق فقط")})</span>}
                  </p>
                );
              }
              const staffSide = m.author === "staff";
              const tone = m.internal
                ? "border-2 border-dashed border-amber-500/60 bg-amber-500/10"
                : staffSide
                  ? "bg-primary/10 ring-1 ring-primary/20"
                  : "bg-soft ring-1 ring-fg/10";
              return (
                <div key={m.id} className={`flex ${staffSide ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${tone}`}>
                    <p className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      {staffSide ? m.staff?.name ?? t("Staff", "الفريق") : tk.shop.owner || tk.shop.name}
                      {m.internal && <Badge tone="amber">{t("Internal note: the merchant can't see this", "ملاحظة داخلية: لا يراها التاجر")}</Badge>}
                      <span className="font-normal text-muted">{f.dateTime(m.at)}</span>
                    </p>
                    {m.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                    {!!m.pictures.length && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.pictures.map((p) => (
                          <button key={p} type="button" onClick={() => setBig(ticketPicture(tk.number, p))} title={t("Open the picture", "فتح الصورة")} className="overflow-hidden rounded-lg ring-1 ring-fg/15 transition hover:ring-primary">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ticketPicture(tk.number, p)} alt="" loading="lazy" className="h-24 w-24 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <ReplyBox number={tk.number} onSent={reload} />
        </div>

        <aside className="space-y-4">
          <section className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Store", "المتجر")}</p>
            <Link href={`/diwan/shops/${tk.shop.accountId}`} className="mt-1 block text-lg font-bold text-primary hover:underline">{tk.shop.name}</Link>
            <p className="text-sm">{tk.shop.owner}</p>
            <p className="text-sm text-muted" dir="ltr">{tk.shop.email}</p>
            <p className="text-sm text-muted" dir="ltr">{tk.shop.phone}</p>
            {tk.shop.status === "suspended" && <div className="mt-2"><Badge tone="red">{t("Suspended", "موقوف")}</Badge></div>}
            <p className="mt-3 text-xs text-muted">{t("Opened", "فُتحت")} {f.dateTime(tk.created)} · {t("last activity", "آخر نشاط")} {f.ago(tk.updated)}</p>
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <label className={label} htmlFor="st">{t("Status", "الحالة")}</label>
              <select id="st" className={field} value={tk.status} disabled={saving} onChange={(e) => void change({ status: e.target.value })}>
                {STATUS_ORDER.map((x) => <option key={x} value={x}>{t(STATUS[x].en, STATUS[x].ar)}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">{t("Solved or closed tells the merchant.", "عند الحل أو الإغلاق يصل إشعار للتاجر.")}</p>
            </div>
            <div>
              <label className={label} htmlFor="pr">{t("Priority", "الأولوية")}</label>
              <select id="pr" className={field} value={tk.priority} disabled={saving} onChange={(e) => void change({ priority: e.target.value })}>
                {PRIORITY_ORDER.map((x) => <option key={x} value={x}>{t(PRIORITY[x].en, PRIORITY[x].ar)}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="as">{t("Assigned to", "مسندة إلى")}</label>
              <select id="as" className={field} value={tk.assigneeId ?? ""} disabled={saving} onChange={(e) => void change({ assignee: e.target.value || null })}>
                <option value="">{t("No one", "لا أحد")}</option>
                {d.staff.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === d.me ? t(" (me)", " (أنا)") : ""}</option>)}
              </select>
              {tk.assigneeId !== d.me && (
                <button type="button" disabled={saving} onClick={() => void change({ assignee: d.me })} className="mt-1 text-xs font-semibold text-primary hover:underline">
                  {t("Assign to me", "أسندها إليّ")}
                </button>
              )}
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
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

/* ---------------- the reply box and ready answers ---------------- */

function ReplyBox({ number, onSent }: { number: number; onSent: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [pics, setPics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [manage, setManage] = useState(false);
  const canned = useApi<{ replies: Canned[] }>("/api/diwan/tickets/canned");
  const fileRef = useRef<HTMLInputElement>(null);

  const insert = (v: string) => {
    const [i, lang] = v.split(":");
    const c = canned.data?.replies[Number(i)];
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
    const r = await send(`/api/diwan/tickets/${number}/reply`, "POST", { body: text, internal: mode === "note", pictures: pics });
    setBusy(false);
    if (!r.ok) return setErr(t("It was not sent. Try again.", "لم يُرسل. حاول مرة أخرى."));
    setText("");
    setPics([]);
    onSent();
  };

  return (
    <form onSubmit={submit} className={`${card} space-y-3 ${mode === "note" ? "ring-2 ring-amber-500/50" : ""}`}>
      <div role="radiogroup" className="inline-flex rounded-xl bg-soft p-1 text-sm font-semibold">
        {(["reply", "note"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-lg px-3.5 py-1.5 transition ${mode === m ? "bg-card shadow-sm" : "text-muted hover:text-fg"}`}>
            {m === "reply" ? t("Reply to merchant", "رد على التاجر") : t("Internal note", "ملاحظة داخلية")}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">
        {mode === "reply"
          ? t("The merchant sees this on his Support page and gets a notification. The ticket then waits for him.", "يرى التاجر هذا في صفحة الدعم ويصله إشعار. ثم تنتظر التذكرة ردّه.")
          : t("Only staff see internal notes. Nothing is sent to the merchant.", "الملاحظات الداخلية للفريق فقط. لا يُرسل شيء للتاجر.")}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${field} max-w-xs`} value="" onChange={(e) => insert(e.target.value)} disabled={!canned.data?.replies.length} aria-label={t("Insert a ready answer", "إدراج رد جاهز")}>
          <option value="">{canned.data?.replies.length ? t("Insert a ready answer…", "إدراج رد جاهز…") : t("No ready answers yet", "لا توجد ردود جاهزة بعد")}</option>
          {canned.data?.replies.flatMap((c, i) => [
            c.body_en ? <option key={`${i}en`} value={`${i}:en`}>{c.title} (English)</option> : null,
            c.body_ar ? <option key={`${i}ar`} value={`${i}:ar`}>{c.title} (العربية)</option> : null,
          ])}
        </select>
        <button type="button" onClick={() => setManage((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
          {manage ? t("Hide ready answers", "إخفاء الردود الجاهزة") : t("Manage ready answers", "إدارة الردود الجاهزة")}
        </button>
      </div>
      {manage && canned.data && <CannedEditor initial={canned.data.replies} onSaved={canned.reload} />}

      <textarea className={area} rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder={mode === "reply" ? t("Write to the merchant…", "اكتب للتاجر…") : t("Write a note for the team…", "اكتب ملاحظة للفريق…")} />
      {!!pics.length && (
        <div className="flex flex-wrap gap-2">
          {pics.map((p, i) => (
            <span key={i} className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-fg/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPics((l) => l.filter((_, j) => j !== i))} className="absolute end-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white" aria-label={t("Remove", "إزالة")}>×</button>
            </span>
          ))}
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="ghost" type="button" disabled={pics.length >= 5} onClick={() => fileRef.current?.click()}>{t("Add a picture", "إضافة صورة")} <span dir="ltr" className="text-muted">{pics.length}/5</span></Btn>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        <Btn type="submit" className="ms-auto" disabled={busy || (!text.trim() && !pics.length)}>
          {busy ? t("Sending…", "جارٍ الإرسال…") : mode === "reply" ? t("Send to merchant", "إرسال للتاجر") : t("Save note", "حفظ الملاحظة")}
        </Btn>
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
