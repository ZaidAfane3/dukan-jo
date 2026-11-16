"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContactButton } from "@/components/diwan/Contact";
import { ShopAndOwner, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

/* Documents: papers shops send for checking (courier proof, commercial registration). Staff approve
   or reject each one with a note; the merchant's bell is told (documentStatus) and the activity log keeps it. Live
   data from /api/diwan/documents. Merchants send these from the setup's shipping step and the Delivery page; each card
   opens its file through /api/diwan/documents/[id]/file (a picture opens in a new tab, a PDF downloads). */

type Status = "waiting" | "approved" | "rejected";
type Kind = "courier_proof" | "commercial_registration" | "other";
type Row = {
  id: string; shopId: string; shopName: string; ownerName: string; shopSlug: string | null; shopEmail: string; ownerPhone: string; storePhone: string; kind: Kind; seq: number; name: string;
  partner: string; partnerKind: 0 | 1 | null; hasFile: boolean; mime: string | null; bytes: number | null;
  status: Status; note: string; reviewer: string | null; createdAt: string;
};

/** The file of one document, served by Diwan's file route (never the file itself in the page's JSON) */
const documentFile = (id: string) => `/api/diwan/documents/${id}/file`;

const sizeOf = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
type Data = { counts: Partial<Record<Status, number>>; documents: Row[] };

const tone: Record<Status, Tone> = { waiting: "amber", approved: "green", rejected: "red" };
const FILTERS = ["waiting", "approved", "rejected", "all"] as const;

export default function DocumentsPage() {
  const t = useT();
  /* a store page's links open this page on one store (?shop=) and on every status (?status=all), scrolled to one
     document (#doc-<id>) */
  const sp = useSearchParams();
  const asked = sp?.get("status") ?? "";
  const [status, setStatus] = useState<(typeof FILTERS)[number]>((FILTERS as readonly string[]).includes(asked) ? (asked as (typeof FILTERS)[number]) : "waiting");
  const [kind, setKind] = useState("");
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const s = useApi<Data>(`/api/diwan/documents?${new URLSearchParams({ status, ...(kind ? { kind } : {}), ...(shop ? { shop } : {}) })}`);
  /* once the list is in, the document the link named comes into view */
  const [jumped, setJumped] = useState(false);
  useEffect(() => {
    if (jumped || !s.data || typeof window === "undefined" || !window.location.hash.startsWith("#doc-")) return;
    setJumped(true);
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [s.data, jumped]);

  const statusName = (x: (typeof FILTERS)[number]) =>
    ({ waiting: t("Waiting", "بانتظار المراجعة"), approved: t("Approved", "مقبول"), rejected: t("Rejected", "مرفوض"), all: t("All", "الكل") })[x];
  const kindName = (k: Kind) =>
    ({ courier_proof: t("Proof of delivery", "إثبات التوصيل"), commercial_registration: t("Commercial registration", "السجل التجاري"), other: t("Other document", "مستند آخر") })[k];
  const count = (x: (typeof FILTERS)[number], c: Data["counts"] | undefined) =>
    !c ? null : x === "all" ? Object.values(c).reduce((a, b) => a + (b ?? 0), 0) : c[x] ?? 0;

  return (
    <div>
      <PageHead
        title={t("Documents", "المستندات")}
        sub={t("Papers stores send for checking. Approve or reject each one; the merchant is told.", "الأوراق التي ترسلها المتاجر للمراجعة. اقبل كل مستند أو ارفضه، ويُبلَّغ التاجر.")}
      />

      <ShopOnly id={shop} name={s.data?.documents[0] ? s.data.documents[0].shopName || s.data.documents[0].ownerName : null} onClear={() => setShop("")} />

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
              <p className="mt-1 text-xs">{t("Stores send these when they add their own delivery partner.", "ترسلها المتاجر عند إضافة جهة التوصيل الخاصة بها.")}</p>
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
  const partnerKindName = (k: 0 | 1) => (k === 0 ? t("shipping company", "شركة شحن") : t("a person", "شخص"));

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
    <div id={`doc-${row.id}`} className={`${card} scroll-mt-24 target:ring-2 target:ring-primary`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* what the document is for and its number among this store's documents of that kind, then the file's name */}
          <p className="font-bold">
            {kindName(row.kind)} <span dir="ltr" className="text-muted">#{String(row.seq).padStart(3, "0")}</span>
          </p>
          <p className="mt-0.5 break-words text-xs text-muted"><bdi>{row.name}</bdi></p>
          <div className="mt-1 flex flex-wrap items-start gap-x-2 text-sm">
            <span className="text-muted">{t("Store:", "المتجر:")}</span>
            <ShopAndOwner id={row.shopId} shop={row.shopName} owner={row.ownerName} />
            {row.shopSlug && <span dir="ltr" className="text-xs text-muted">/{row.shopSlug}</span>}
          </div>
          {row.kind === "courier_proof" && (
            <p className="mt-1 text-sm">
              <span className="text-muted">{t("Delivery partner:", "جهة التوصيل:")} </span>
              {row.partner ? (
                <>
                  <bdi className="font-semibold">{row.partner}</bdi>
                  {row.partnerKind !== null && <span className="text-muted"> ({partnerKindName(row.partnerKind)})</span>}
                </>
              ) : (
                <span className="text-muted">{t("Not named yet", "لم يُسمَّ بعد")}</span>
              )}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            {t("Sent", "أُرسل")} {f.dateTime(row.createdAt)}
            {row.reviewer && <> · {t(`Reviewed by ${row.reviewer}`, `راجعه ${row.reviewer}`)}</>}
            {row.hasFile && row.mime && <> · <span dir="ltr">{row.mime === "application/pdf" ? "PDF" : t("Picture", "صورة")}{row.bytes ? `, ${sizeOf(row.bytes)}` : ""}</span></>}
            {!row.hasFile && <> · {t("No file", "لا يوجد ملف")}</>}
          </p>
          {row.hasFile && (
            <a
              href={documentFile(row.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ms-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              {row.mime === "application/pdf" ? t("Download file (PDF)", "تنزيل الملف (PDF)") : t("View file", "عرض الملف")}
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone[row.status]}>{statusName(row.status)}</Badge>
          {/* the merchant's email and mobile stay in the Contact pop-up, not printed on the card */}
          <ContactButton info={{ owner: row.ownerName, email: row.shopEmail, phone: row.ownerPhone, storePhone: row.storePhone }} />
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
