"use client";

import Link from "next/link";
import { useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";
import { REASON_WORDS, REPORT_LIMITS, REPORT_REASONS, type ReportReason } from "@/components/storeReports";

/* Store reports: what customers sent with "Report this store" in a store's footer, and what staff found themselves.
   Staff check each one (New → Checking → Closed) and keep notes the reporter and the shop never see. Suspending a
   store is done on its shop page. Every change goes to the activity log. Live data from /api/diwan/complaints. */

type Status = "new" | "checking" | "closed";
type Row = {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string | null;
  shopStatus: "active" | "suspended" | null;
  shopReports: number;
  from: "customer" | "staff";
  contact: string;
  reason: ReportReason;
  body: string;
  status: Status;
  notes: string;
  handler: string | null;
  createdAt: string;
  updatedAt: string;
};
type Data = { counts: Partial<Record<Status, number>>; reports: Row[] };

const tone: Record<Status, Tone> = { new: "red", checking: "amber", closed: "grey" };
const FILTERS = ["open", "new", "checking", "closed", "all"] as const;

export default function ComplaintsPage() {
  const t = useT();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("open");
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [adding, setAdding] = useState(false);
  const s = useApi<Data>(`/api/diwan/complaints?${new URLSearchParams({ status, ...(reason ? { reason } : {}), ...(from ? { from } : {}) })}`);

  const statusName = (x: (typeof FILTERS)[number]) =>
    ({ open: t("To do", "للمتابعة"), new: t("New", "جديد"), checking: t("Checking", "قيد التحقق"), closed: t("Closed", "مغلق"), all: t("All", "الكل") })[x];
  const count = (x: (typeof FILTERS)[number], c: Data["counts"] | undefined) =>
    !c ? null : x === "open" ? (c.new ?? 0) + (c.checking ?? 0) : x === "all" ? Object.values(c).reduce((a, b) => a + (b ?? 0), 0) : c[x] ?? 0;

  return (
    <div>
      <PageHead
        title={t("Store reports", "بلاغات المتاجر")}
        sub={t("Reports about stores from customers and staff. Check each one; suspend a store from its store page.", "بلاغات عن المتاجر من العملاء والفريق. تحقّق من كل بلاغ، وأوقف المتجر من صفحته.")}
        actions={!adding && <Btn onClick={() => setAdding(true)}>{t("Add a report", "إضافة بلاغ")}</Btn>}
      />
      {adding && <AddReport onDone={(added) => { setAdding(false); if (added) s.reload(); }} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((x) => (
          <button
            key={x}
            aria-pressed={status === x}
            onClick={() => setStatus(x)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${status === x ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
          >
            {statusName(x)}
            {count(x, s.data?.counts) !== null && <span className="ms-1.5 tabular-nums opacity-75">{count(x, s.data?.counts)}</span>}
          </button>
        ))}
      </div>
      <FilterBar count={(reason ? 1 : 0) + (from ? 1 : 0)} onClear={() => { setReason(""); setFrom(""); }} className="mb-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={field} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t("Reason", "السبب")}>
            <option value="">{t("Every reason", "كل الأسباب")}</option>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{t(REASON_WORDS[r].en, REASON_WORDS[r].ar)}</option>
            ))}
          </select>
          <select className={field} value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("From", "المصدر")}>
            <option value="">{t("Customers and staff", "العملاء والفريق")}</option>
            <option value="customer">{t("From customers", "من العملاء")}</option>
            <option value="staff">{t("Found by staff", "وجدها الفريق")}</option>
          </select>
        </div>
      </FilterBar>

      <Loaded s={s}>
        {(d) =>
          d.reports.length === 0 ? (
            <p className={`${card} text-center text-sm text-muted`}>{t("No reports here.", "لا توجد بلاغات هنا.")}</p>
          ) : (
            <div className="grid gap-3">
              {d.reports.map((row) => (
                <ReportCard key={row.id} row={row} statusName={statusName} onDone={s.reload} />
              ))}
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

function ReportCard({ row, statusName, onDone }: { row: Row; statusName: (x: Status) => string; onDone: () => void }) {
  const t = useT();
  const f = useFmt();
  const [status, setStatus] = useState<Status>(row.status);
  const [notes, setNotes] = useState(row.notes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const changed = status !== row.status || notes !== row.notes;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await send(`/api/diwan/complaints/${row.id}`, "PATCH", { status, notes });
    setBusy(false);
    if (r.ok) onDone();
    else setErr(t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
  };

  return (
    <form onSubmit={save} className={card}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            <Link href={`/diwan/shops/${row.shopId}`} className="text-primary hover:underline">{row.shopName}</Link>
            {row.shopSlug && <span dir="ltr" className="ms-2 text-xs font-normal text-muted">dukkan.store/{row.shopSlug}</span>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {f.dateTime(row.createdAt)} · {row.from === "staff" ? t("Found by staff", "وجده الفريق") : t("From a customer", "من عميل")}
            {row.contact && <> · <span dir="ltr">{row.contact}</span></>}
            {row.shopReports > 1 && <> · {t(`${row.shopReports} reports about this store`, `${row.shopReports} بلاغات عن هذا المتجر`)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={tone[row.status]}>{statusName(row.status)}</Badge>
          <Badge tone={row.reason === "other" ? "grey" : "red"}>{t(REASON_WORDS[row.reason].en, REASON_WORDS[row.reason].ar)}</Badge>
          {row.shopStatus === "suspended" && <Badge tone="red">{t("Store suspended", "المتجر موقوف")}</Badge>}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line break-words rounded-xl bg-soft px-3 py-2 text-sm">{row.body}</p>

      <div className="mt-4 grid gap-3 border-t border-fg/10 pt-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor={`rs-${row.id}`} className="mb-1.5 block text-sm font-medium">{t("Status", "الحالة")}</label>
          <select id={`rs-${row.id}`} className={field} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(["new", "checking", "closed"] as Status[]).map((x) => (
              <option key={x} value={x}>{statusName(x)}</option>
            ))}
          </select>
          {row.handler && <p className="mt-2 text-xs text-muted">{t(`Handled by ${row.handler}`, `يتابعه ${row.handler}`)} · {f.ago(row.updatedAt)}</p>}
        </div>
        <div>
          <label htmlFor={`rn-${row.id}`} className="mb-1.5 block text-sm font-medium">{t("Staff notes (only Dukkan sees these)", "ملاحظات الفريق (لا يراها إلا دكان)")}</label>
          <textarea id={`rn-${row.id}`} className={area} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn type="submit" disabled={busy || !changed}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        <Link href={`/diwan/shops/${row.shopId}`} className="text-sm font-semibold text-primary hover:underline">
          {t("Open the store (suspend it there)", "افتح المتجر (الإيقاف من هناك)")}
        </Link>
      </div>
    </form>
  );
}

/* A report staff found themselves: which shop (its number, its owner's email or its store link), why, and what */
function AddReport({ onDone }: { onDone: (added: boolean) => void }) {
  const t = useT();
  const [shop, setShop] = useState("");
  const [reason, setReason] = useState<ReportReason>("scam");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < REPORT_LIMITS.min) return setErr(t(`Write at least ${REPORT_LIMITS.min} characters.`, `اكتب ${REPORT_LIMITS.min} أحرف على الأقل.`));
    setBusy(true);
    setErr("");
    const r = await send("/api/diwan/complaints", "POST", { shop: shop.trim(), reason, body });
    setBusy(false);
    if (r.ok) onDone(true);
    else
      setErr(
        r.data?.result === "no-shop"
          ? t("No store matches. Use the store's number, its owner's email or its store link.", "لا يوجد متجر مطابق. استخدم رقم المتجر أو بريد صاحبه أو رابط المتجر.")
          : t("Check the fields and try again.", "تحقق من الحقول وحاول مجددًا."),
      );
  };
  const label = "mb-1.5 block text-sm font-medium";

  return (
    <form onSubmit={submit} className={`${card} mb-4 space-y-4`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ar-shop" className={label}>{t("Store (number, owner's email or store link)", "المتجر (الرقم أو بريد صاحبه أو رابطه)")}</label>
          <input id="ar-shop" dir="ltr" className={field} required maxLength={254} value={shop} onChange={(e) => setShop(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ar-reason" className={label}>{t("Reason", "السبب")}</label>
          <select id="ar-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{t(REASON_WORDS[r].en, REASON_WORDS[r].ar)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="ar-body" className={label}>{t("What was found", "ما الذي وُجد")}</label>
        <textarea id="ar-body" className={area} rows={3} maxLength={REPORT_LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Add report", "إضافة البلاغ")}</Btn>
        <Btn type="button" kind="ghost" onClick={() => onDone(false)}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}
