"use client";

import { ShopAndOwner, ShopLink, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { ComplaintsSkeleton } from "@/components/diwan/skeletons";
import { FilterBar } from "@/components/diwan/Filters";
import { oneOf, useListScroll, useListState } from "@/components/diwan/useListState";
import { REASON_WORDS, REPORT_LIMITS, REPORT_REASONS, type ReportReason } from "@/components/storeReports";
import { storeAddress } from "@/components/siteAddress";
import { arCount } from "@/components/undo";

/* Store reports: what customers sent with "Report this store" in a store's footer, and what staff found themselves.
   Staff check each one (New → Checking → Closed) and keep notes the reporter and the shop never see. Suspending a
   store is done on its shop page. Every change goes to the activity log. Live data from /api/diwan/complaints. */

type Status = "new" | "checking" | "closed";
type Row = {
  id: string;
  shopId: string;
  shopName: string;
  ownerName: string;
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
/* the tab and filters, kept in the address so Back from a store brings the list back as it was */
const LIST = { status: oneOf(FILTERS, "open"), reason: oneOf(["", ...REPORT_REASONS]), from: oneOf(["", "customer", "staff"]) };

export default function ComplaintsPage() {
  const t = useT();
  const [list, setList] = useListState(LIST);
  const status = list.status as (typeof FILTERS)[number];
  const { reason, from } = list;
  const setStatus = (x: (typeof FILTERS)[number]) => setList({ status: x });
  const setReason = (x: string) => setList({ reason: x });
  const setFrom = (x: string) => setList({ from: x });
  const sp = useSearchParams();
  const [adding, setAdding] = useState(false);
  /* one store's reports only, from its page's "See all" (?shop=); every status then */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const [shopStatusSet, setShopStatusSet] = useState(false);
  if (shop && !shopStatusSet) {
    setShopStatusSet(true);
    /* unless the address already says which tab (Back to a list staff had changed) */
    if (!sp?.has("status")) setStatus("all");
  }
  const s = useApi<Data>(`/api/diwan/complaints?${new URLSearchParams({ status, ...(reason ? { reason } : {}), ...(from ? { from } : {}), ...(shop ? { shop } : {}) })}`);
  useListScroll(s);

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
      <ShopOnly id={shop} name={s.data?.reports[0] ? s.data.reports[0].shopName || s.data.reports[0].ownerName : null} onClear={() => setShop("")} />
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
      <FilterBar count={(reason ? 1 : 0) + (from ? 1 : 0)} onClear={() => setList({ reason: "", from: "" })} className="mb-4">
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

      <Loaded s={s} skeleton={<ComplaintsSkeleton />}>
        {(d) =>
          d.reports.length === 0 ? (
            <p className={`${card} text-center text-sm text-muted`}>{t("No reports here.", "لا توجد بلاغات هنا.")}</p>
          ) : (
            <StoreGroups reports={d.reports} statusName={statusName} onDone={s.reload} />
          )
        }
      </Loaded>
    </div>
  );
}

/* The reports grouped by store: one card per store (in the order of its newest report), its reports inside, newest
   first. Each report's handling (status and notes) opens behind its own "Handle" button, one at a time. */
function StoreGroups({ reports, statusName, onDone }: { reports: Row[]; statusName: (x: Status) => string; onDone: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups: Row[][] = [];
  const at = new Map<string, number>();
  for (const r of reports) {
    const i = at.get(r.shopId);
    if (i === undefined) {
      at.set(r.shopId, groups.length);
      groups.push([r]);
    } else groups[i].push(r);
  }
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <StoreCard
          key={g[0].shopId}
          rows={g}
          statusName={statusName}
          openId={openId}
          setOpenId={setOpenId}
          onDone={() => {
            setOpenId(null);
            onDone();
          }}
        />
      ))}
    </div>
  );
}

function StoreCard({ rows, statusName, openId, setOpenId, onDone }: { rows: Row[]; statusName: (x: Status) => string; openId: string | null; setOpenId: (id: string | null) => void; onDone: () => void }) {
  const t = useT();
  const f = useFmt();
  const top = rows[0];
  const suspended = top.shopStatus === "suspended";
  const n = rows.length;
  const countWords = t(`${f.num(n)} ${n === 1 ? "report" : "reports"}`, arCount(n, { one: "بلاغ واحد", two: "بلاغان", few: "بلاغات", many: "بلاغًا" }));
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            <ShopAndOwner id={top.shopId} shop={top.shopName} owner={top.ownerName} />
            {top.shopSlug && <span dir="ltr" className="block text-xs font-normal text-muted">{storeAddress(top.shopSlug)}</span>}
          </div>
          <p className="mt-1 text-xs text-muted">
            {countWords}
            {top.shopReports > n && <> · {t(`${f.num(top.shopReports)} about this store in all`, `${f.num(top.shopReports)} عن هذا المتجر في المجموع`)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {suspended && <Badge tone="red">{t("Store suspended", "المتجر موقوف")}</Badge>}
          {/* the link says what can still be done there: suspend it, or nothing more when it is already suspended */}
          <ShopLink id={top.shopId} className="text-sm font-semibold text-primary hover:underline">
            {suspended ? t("Open the store (already suspended)", "افتح المتجر (موقوف بالفعل)") : t("Open the store (suspend it there)", "افتح المتجر (الإيقاف من هناك)")}
          </ShopLink>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-fg/[0.07] border-t border-fg/10">
        {rows.map((row) => (
          <ReportItem key={row.id} row={row} statusName={statusName} open={openId === row.id} onToggle={() => setOpenId(openId === row.id ? null : row.id)} onDone={onDone} />
        ))}
      </ul>
    </section>
  );
}

function ReportItem({ row, statusName, open, onToggle, onDone }: { row: Row; statusName: (x: Status) => string; open: boolean; onToggle: () => void; onDone: () => void }) {
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
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={tone[row.status]}>{statusName(row.status)}</Badge>
            <Badge tone={row.reason === "other" ? "grey" : "red"}>{t(REASON_WORDS[row.reason].en, REASON_WORDS[row.reason].ar)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {f.dateTime(row.createdAt)} · {row.from === "staff" ? t("Found by staff", "وجده الفريق") : t("From a customer", "من عميل")}
            {row.contact && <> · <span dir="ltr">{row.contact}</span></>}
          </p>
        </div>
        <Btn type="button" kind="ghost" className="h-9 px-3" aria-expanded={open} aria-controls={`rf-${row.id}`} onClick={onToggle}>
          {open ? t("Close", "إغلاق") : t("Handle", "معالجة")}
        </Btn>
      </div>
      <p dir="auto" className="mt-2 whitespace-pre-line break-words rounded-xl bg-soft px-3 py-2 text-start text-sm">{row.body}</p>

      {open && (
        <form id={`rf-${row.id}`} onSubmit={save} className="mt-3 rounded-xl p-3 ring-1 ring-fg/10">
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
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
              <textarea id={`rn-${row.id}`} dir="auto" className={area} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-red-600">{err}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn type="submit" disabled={busy || !changed}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
            <Btn type="button" kind="ghost" onClick={onToggle} disabled={busy}>{t("Cancel", "إلغاء")}</Btn>
          </div>
        </form>
      )}
    </li>
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
        <textarea id="ar-body" dir="auto" className={area} rows={3} maxLength={REPORT_LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Add report", "إضافة البلاغ")}</Btn>
        <Btn type="button" kind="ghost" onClick={() => onDone(false)}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}
