"use client";

import Link from "next/link";
import { REASON_WORDS, type ReportReason } from "../storeReports";
import { actionWords, documentKindWords, documentNumber, settingWords } from "./activityWords";
import { can, roleName } from "./perms";
import { methodText } from "./shopBits";
import { PRIORITY, STATUS, type TPriority, type TStatus } from "./ticketWords";
import { useFmt, useStaff, useT } from "./ui";

/* One activity-log line in full words: what was done, to which ticket (a link to it), and what changed from what to
   what ("Changed ticket #1001 priority: Normal → High", "Assigned ticket #1001 to Sara", "Rejected Proof of delivery
   #002"). The facts come from the
   server (server/activityDetail.ts), which sends only safe ones; this file only puts them into words, with the same
   names for statuses and priorities as the pages they belong to. Shared by the activity page and a store's page. */

export type Change = { field: string; from: string | null; to: string | null };
/* the document a review was about: its kind, its number among its store's documents of that kind, and whether the
   merchant has removed it since; publicId is its address, as its card on the Documents page is named (#doc-<publicId>) */
export type DocumentFacts = { kind: string; seq: number | null; removed: boolean; publicId?: string };
export type Detail = {
  changes?: Change[]; title?: string; amount?: string; method?: string; member?: string; count?: number; changedFields?: string[];
  /* a Diwan page's title in both languages: the line shows the staff's language, else the other */
  titles?: { en: string; ar: string };
  /* a document review: the status it left (said even when only the note changed) and the document, when it is still known */
  status?: string; document?: DocumentFacts;
  /* a staff sign-in: with the emailed code, or the password alone on a remembered browser */
  via?: "email" | "remembered";
};
export type ActivityRow = {
  id: string;
  at: string;
  staffId: string | null;
  staffName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  shop: { id: string; name: string } | null;
  detail: Detail | null;
};

type T = (en: string, ar: string) => string;

const FIELD: Record<string, [string, string]> = {
  status: ["status", "الحالة"],
  priority: ["priority", "الأولوية"],
  assignee: ["assigned to", "مسندة إلى"],
  role: ["role", "الدور"],
  email: ["email", "البريد"],
  active: ["access", "الدخول"],
  notes: ["notes", "الملاحظات"],
  note: ["note", "الملاحظة"],
  name: ["name", "الاسم"],
  description: ["description", "الوصف"],
  price: ["price", "السعر"],
  mode: ["who has it", "لمن تعمل"],
  accountIds: ["stores", "المتاجر"],
  version: ["version", "الإصدار"],
  featured: ["featured", "مميز"],
  sort: ["order", "الترتيب"],
  reason: ["reason", "السبب"],
  tagline: ["tagline", "الشعار"],
  about: ["about", "الوصف"],
  features: ["features", "المزايا"],
  tags: ["tags", "الوسوم"],
  demo: ["demo store", "المتجر التجريبي"],
  title: ["title", "العنوان"],
  body: ["text", "النص"],
  slug: ["address", "العنوان في الرابط"],
  /* a corrected payment (shop.payment_edit) */
  amount: ["amount", "المبلغ"],
  method: ["method", "الطريقة"],
  paidOn: ["paid on", "تاريخ الدفع"],
  reference: ["reference", "المرجع"],
};

/* statuses of the other things Diwan changes (store reports, documents, pop-ups, pages, themes, developers' work) */
const OTHER_STATUS: Record<string, [string, string]> = {
  checking: ["Checking", "قيد التحقق"],
  waiting: ["Waiting", "بانتظار المراجعة"],
  approved: ["Approved", "مقبول"],
  rejected: ["Rejected", "مرفوض"],
  draft: ["Draft", "مسودة"],
  live: ["Live", "منشور"],
  hidden: ["Hidden", "مخفي"],
  ended: ["Ended", "منتهٍ"],
  review: ["In review", "قيد المراجعة"],
  sent: ["Sent", "مُرسل"],
  removed: ["Removed", "محذوف"],
  blocked: ["Blocked", "محظور"],
};

/** A value in words: the ticket page's names for a ticket's status and priority, a role's name, and so on */
function valueWords(t: T, action: string, field: string, v: string | null): string {
  if (v == null || v === "") return t("none", "لا شيء");
  if (action.startsWith("ticket.")) {
    if (field === "status" && STATUS[v as TStatus]) return t(STATUS[v as TStatus].en, STATUS[v as TStatus].ar);
    if (field === "priority" && PRIORITY[v as TPriority]) return t(PRIORITY[v as TPriority].en, PRIORITY[v as TPriority].ar);
  }
  if (field === "role") {
    const r = roleName(v as never);
    return t(r.en, r.ar);
  }
  if (field === "reason" && REASON_WORDS[v as ReportReason]) return t(REASON_WORDS[v as ReportReason].en, REASON_WORDS[v as ReportReason].ar);
  if (field === "active") return v === "true" ? t("has access", "له دخول") : t("no access", "بلا دخول");
  if (field === "featured") return v === "true" ? t("yes", "نعم") : t("no", "لا");
  if (action === "shop.payment_edit" && field === "method") return methodText(t, v);
  if (action === "shop.payment_edit" && field === "amount") {
    /* written as Diwan writes an amount (ui.tsx f.jod): "30", "12.50", "4.125", not the stored "30.000" */
    const n = Number(v);
    const x = !Number.isFinite(n) ? String(v) : Math.round(n * 1000) % 1000 === 0 ? String(Math.round(n)) : n.toFixed(3).replace(/0$/, "");
    return t(`${x} JOD`, `${x} د.أ`);
  }
  if (field === "status") {
    if (v === "new") return t("New", "جديد");
    if (v === "closed") return t("Closed", "مغلق");
    if (OTHER_STATUS[v]) return t(OTHER_STATUS[v][0], OTHER_STATUS[v][1]);
  }
  return v;
}

const fieldWords = (t: T, f: string) => (FIELD[f] ? t(FIELD[f][0], FIELD[f][1]) : f);
/* an arrow that points the way the text reads */
const arrow = (t: T) => t(" → ", " ← ");

/** "status: Open → Solved" */
function changeWords(t: T, action: string, c: Change, withName = true): string {
  const from = c.from == null || c.from === "" ? null : valueWords(t, action, c.field, c.from);
  const to = valueWords(t, action, c.field, c.to);
  return `${withName ? `${fieldWords(t, c.field)}: ` : ""}${from ? `${from}${arrow(t)}` : ""}${to}`;
}

/** The ticket's number as a link, for staff who may open tickets */
function TicketRef({ n }: { n: string }) {
  const staff = useStaff();
  const label = <span dir="ltr">#{n}</span>;
  return staff && can(staff, "tickets") ? (
    <Link href={`/diwan/tickets/${n}`} className="font-semibold text-primary hover:underline">
      {label}
    </Link>
  ) : (
    <b>{label}</b>
  );
}

/** A document by its kind and number ("Proof of delivery #002", as its card says), a link to the store's documents
    for staff who may open them, and a word when the merchant has removed it since */
function DocumentRef({ doc, shopId }: { doc: DocumentFacts; shopId: string | null }) {
  const t = useT();
  const staff = useStaff();
  const label = (
    <>
      {documentKindWords(t, doc.kind)}
      {doc.seq != null && (
        <>
          {" "}
          <span dir="ltr">{documentNumber(doc.seq)}</span>
        </>
      )}
    </>
  );
  /* every status, so an approved or rejected one shows too; the page scrolls to the card (#doc-<publicId>) */
  const href = `/diwan/documents?${shopId ? `shop=${shopId}&` : ""}status=all${doc.publicId && /^[A-Za-z0-9]+$/.test(doc.publicId) ? `#doc-${doc.publicId}` : ""}`;
  return (
    <>
      {staff && can(staff, "documents") ? (
        <Link href={href} className="font-semibold text-primary hover:underline">
          {label}
        </Link>
      ) : (
        <b>{label}</b>
      )}
      {doc.removed && <span className="text-muted">{t(" (removed by the merchant)", " (حذفه التاجر)")}</span>}
    </>
  );
}

/** One line of the log, in words */
export function ActivityText({ row }: { row: ActivityRow }) {
  const t = useT();
  const f = useFmt();
  const d = row.detail ?? {};
  const changes = d.changes ?? [];
  const ticket = row.targetType === "ticket" && row.targetId && /^\d+$/.test(row.targetId) ? row.targetId : null;
  const more = d.changedFields?.length ? t(`changed: ${d.changedFields.map((x) => fieldWords(t, x)).join(", ")}`, `تغيّر: ${d.changedFields.map((x) => fieldWords(t, x)).join("، ")}`) : "";

  if (ticket && row.action === "ticket.update") {
    const assign = changes.find((c) => c.field === "assignee");
    const rest = changes.filter((c) => c.field !== "assignee");
    /* one change says itself in one sentence; several are listed after the ticket */
    if (assign && !rest.length)
      return assign.to ? (
        <>
          {t("Assigned ticket ", "أسند التذكرة ")}
          <TicketRef n={ticket} />
          {t(` to ${assign.to}`, ` إلى ${assign.to}`)}
          {assign.from && <span className="text-muted">{t(` (was ${assign.from})`, ` (كانت مع ${assign.from})`)}</span>}
        </>
      ) : (
        <>
          {t("Unassigned ticket ", "ألغى إسناد التذكرة ")}
          <TicketRef n={ticket} />
          {assign.from && <span className="text-muted">{t(` (was ${assign.from})`, ` (كانت مع ${assign.from})`)}</span>}
        </>
      );
    if (rest.length === 1 && !assign)
      return (
        <>
          {t("Changed ticket ", "غيّر التذكرة ")}
          <TicketRef n={ticket} /> {changeWords(t, row.action, rest[0])}
        </>
      );
    const parts = [
      ...rest.map((c) => changeWords(t, row.action, c)),
      ...(assign ? [assign.to ? t(`assigned to ${assign.to}`, `أُسندت إلى ${assign.to}`) : t("unassigned", "أُلغي الإسناد")] : []),
    ];
    return (
      <>
        {t("Changed ticket ", "غيّر التذكرة ")}
        <TicketRef n={ticket} />
        {parts.length ? `: ${parts.join(" · ")}` : ""}
      </>
    );
  }
  if (ticket && (row.action === "ticket.reply" || row.action === "ticket.note"))
    return (
      <>
        {row.action === "ticket.reply" ? t("Replied to ticket ", "ردّ على التذكرة ") : t("Added a team note to ticket ", "أضاف ملاحظة داخلية للتذكرة ")}
        <TicketRef n={ticket} />
        {d.count ? t(` with ${d.count} picture${d.count > 1 ? "s" : ""}`, ` مع ${d.count} صورة`) : ""}
      </>
    );

  /* a document review names the document; an old line whose document is gone keeps the plain words below */
  if (row.action === "document.review" && d.document) {
    const status = changes.find((c) => c.field === "status");
    const noteOnly = !status && !!d.changedFields?.includes("note");
    const verb =
      status?.to === "approved"
        ? t("Approved ", "قبِل ")
        : status?.to === "rejected"
          ? t("Rejected ", "رفض ")
          : noteOnly && d.status === "rejected"
            ? t("Changed the rejection note on ", "غيّر ملاحظة الرفض على ")
            : noteOnly
              ? t("Changed the note on ", "غيّر الملاحظة على ")
              : t("Reviewed ", "راجع ");
    return (
      <>
        {verb}
        <DocumentRef doc={d.document} shopId={row.shop?.id ?? null} />
        {status && <span className="block text-[13px] font-normal text-muted">{changeWords(t, row.action, status, false)}</span>}
      </>
    );
  }

  /* every other line: what was done, on what, then what changed */
  const bits: string[] = [];
  if (d.member) bits.push(d.member);
  /* a page's title in the staff's language, else the other (server/activityDetail.ts withPageTitles) */
  if (d.titles) bits.push(`“${t(d.titles.en || d.titles.ar, d.titles.ar || d.titles.en)}”`);
  else if (d.title) bits.push(`“${d.title}”`);
  if (row.action === "shop.payment" && d.amount) bits.push(`${f.jod(d.amount)}${d.method ? `${t(", ", "، ")}${methodText(t, d.method)}` : ""}`);
  if (row.action === "settings.change" && row.targetId) bits.push(settingWords(t, row.targetId));
  const said = [
    ...changes.map((c) => changeWords(t, row.action, c, !(row.action === "document.review" || (row.action === "staff.role" && c.field === "role")))),
    ...(more ? [more] : []),
  ];
  if (typeof d.count === "number" && (row.action === "shops.export" || row.action === "payments.export")) said.push(f.count(d.count, ["row", "rows"], { one: "صف واحد", two: "صفّان", few: "صفوف", many: "صفًا" }));
  if (row.action === "staff.login" && d.via === "remembered") said.push(t("with the password, on a remembered browser (no code)", "بكلمة المرور، من متصفح محفوظ (دون رمز)"));
  if (row.action === "staff.login" && d.via === "email") said.push(t("with the password and the emailed code", "بكلمة المرور ورمز البريد"));
  if (typeof d.count === "number" && row.action === "staff.devices_forgotten") said.push(f.count(d.count, ["browser", "browsers"], { one: "متصفح واحد", two: "متصفحان", few: "متصفحات", many: "متصفحًا" }));
  if (typeof d.count === "number" && row.action === "campaign.stop") said.push(t("not sent to ", "لم تُرسل إلى ") + f.count(d.count, ["customer", "customers"], { one: "عميل واحد", two: "عميلين", few: "عملاء", many: "عميلًا" }));
  if (typeof d.count === "number" && row.action === "tickets.canned.save") said.push(f.count(d.count, ["ready reply", "ready replies"], { one: "رد جاهز واحد", two: "ردّان جاهزان", few: "ردود جاهزة", many: "ردًا جاهزًا" }));
  return (
    <>
      {actionWords(t, row.action)}
      {bits.length ? `: ${bits.join(" · ")}` : ""}
      {said.length > 0 && <span className="block text-[13px] font-normal text-muted">{said.join(" · ")}</span>}
    </>
  );
}
