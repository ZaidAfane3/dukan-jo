"use client";

import Link from "next/link";
import { useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

/* Documents: papers shops send for checking (courier proof, commercial registration). Staff approve
   or reject each one with a note; the merchant's bell is told (documentStatus) and the activity log keeps it. Live
   data from /api/diwan/documents. Merchants can't upload files yet (there is no file storage), so this stays empty
   until uploads exist. */

type Status = "waiting" | "approved" | "rejected";
type Kind = "courier_proof" | "commercial_registration" | "other";
type Row = { id: string; shopId: string; shopName: string; shopEmail: string; kind: Kind; name: string; hasFile: boolean; status: Status; note: string; reviewer: string | null; createdAt: string };
type Data = { counts: Partial<Record<Status, number>>; documents: Row[] };

const tone: Record<Status, Tone> = { waiting: "amber", approved: "green", rejected: "red" };
const FILTERS = ["waiting", "approved", "rejected", "all"] as const;

export default function DocumentsPage() {
  const t = useT();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("waiting");
  const [kind, setKind] = useState("");
  const s = useApi<Data>(`/api/diwan/documents?${new URLSearchParams({ status, ...(kind ? { kind } : {}) })}`);

  const statusName = (x: (typeof FILTERS)[number]) =>
    ({ waiting: t("Waiting", "بانتظار المراجعة"), approved: t("Approved", "مقبول"), rejected: t("Rejected", "مرفوض"), all: t("All", "الكل") })[x];
  const kindName = (k: Kind) =>
    ({ courier_proof: t("Courier proof", "إثبات شركة التوصيل"), commercial_registration: t("Commercial registration", "السجل التجاري"), other: t("Other", "أخرى") })[k];
  const count = (x: (typeof FILTERS)[number], c: Data["counts"] | undefined) =>
    !c ? null : x === "all" ? Object.values(c).reduce((a, b) => a + (b ?? 0), 0) : c[x] ?? 0;

  return (
    <div>
      <PageHead
        title={t("Documents", "المستندات")}
        sub={t("Papers stores send for checking. Approve or reject each one; the merchant is told.", "الأوراق التي ترسلها المتاجر للمراجعة. اقبل كل مستند أو ارفضه، ويُبلَّغ التاجر.")}
      />

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
      <FilterBar count={kind ? 1 : 0} onClear={() => setKind("")} className="mb-4">
        <select className={`${field} sm:max-w-xs`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("Kind", "النوع")}>
          <option value="">{t("Every kind", "كل الأنواع")}</option>
          {(["courier_proof", "commercial_registration", "other"] as Kind[]).map((k) => (
            <option key={k} value={k}>{kindName(k)}</option>
          ))}
        </select>
      </FilterBar>

      <Loaded s={s}>
        {(d) =>
          d.documents.length === 0 ? (
            <div className={`${card} text-center text-sm text-muted`}>
              <p>{t("No documents here.", "لا توجد مستندات هنا.")}</p>
              <p className="mt-1 text-xs">{t("Stores can't upload papers yet: uploads come once file storage is set up.", "لا تستطيع المتاجر رفع الأوراق بعد: يأتي الرفع بعد تجهيز تخزين الملفات.")}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {d.documents.map((row) => (
                <DocCard key={row.id} row={row} statusName={statusName} kindName={kindName} onDone={s.reload} />
              ))}
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

function DocCard({ row, statusName, kindName, onDone }: { row: Row; statusName: (x: Status) => string; kindName: (k: Kind) => string; onDone: () => void }) {
  const t = useT();
  const f = useFmt();
  const [next, setNext] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!next) return;
    if (next === "rejected" && !note.trim()) return setErr(t("Say why: the merchant reads this note.", "اكتب السبب: يقرأ التاجر هذه الملاحظة."));
    setBusy(true);
    const r = await send(`/api/diwan/documents/${row.id}`, "POST", { status: next, note });
    setBusy(false);
    if (r.ok) {
      setNext(null);
      onDone();
    } else setErr(t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold">{row.name}</p>
          <p className="mt-1 text-sm">
            <Link href={`/diwan/shops/${row.shopId}`} className="font-semibold text-primary hover:underline">{row.shopName}</Link>
            <span dir="ltr" className="ms-2 text-xs text-muted">{row.shopEmail}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {f.dateTime(row.createdAt)}
            {row.reviewer && <> · {t(`Reviewed by ${row.reviewer}`, `راجعه ${row.reviewer}`)}</>}
            {!row.hasFile && <> · {t("No file yet", "لا يوجد ملف بعد")}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={tone[row.status]}>{statusName(row.status)}</Badge>
          <Badge>{kindName(row.kind)}</Badge>
        </div>
      </div>
      {row.note && <p className="mt-3 whitespace-pre-line rounded-xl bg-soft px-3 py-2 text-sm">{row.note}</p>}

      {next ? (
        <form onSubmit={save} className="mt-4 space-y-3 border-t border-fg/10 pt-4">
          <label htmlFor={`doc-${row.id}`} className="block text-sm font-medium">
            {next === "rejected" ? t("Why it is rejected (the merchant sees this)", "سبب الرفض (يراه التاجر)") : t("Note for the merchant (optional)", "ملاحظة للتاجر (اختيارية)")}
          </label>
          <textarea id={`doc-${row.id}`} className={area} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" kind={next === "rejected" ? "danger" : "primary"} disabled={busy}>
              {busy ? t("Saving…", "جارٍ الحفظ…") : next === "approved" ? t("Approve", "قبول") : t("Reject", "رفض")}
            </Btn>
            <Btn type="button" kind="ghost" onClick={() => setNext(null)}>{t("Cancel", "إلغاء")}</Btn>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-fg/10 pt-4">
          <Btn className="h-9 px-3" onClick={() => { setNext("approved"); setNote(""); setErr(""); }}>{t("Approve", "قبول")}</Btn>
          <Btn kind="ghost" className="h-9 px-3" onClick={() => { setNext("rejected"); setNote(""); setErr(""); }}>{t("Reject", "رفض")}</Btn>
        </div>
      )}
    </div>
  );
}
