"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

/* Domains: the ones shops connect themselves and the ones they buy through Dukkan. Staff set each one up outside
   Diwan (DNS, the registrar) and move it along here: Checking, Active, or Failed with a note. Each change goes to the
   merchant's bell (domainStatus) and to the activity log. Live data from /api/diwan/domains. */

type Status = "awaiting" | "checking" | "active" | "failed" | "removed";
type Row = {
  id: string;
  shopId: string;
  shopName: string;
  shopEmail: string;
  name: string;
  kind: "connect" | "bought";
  status: Status;
  note: string;
  years: number | null;
  renewsAt: string | null;
  autoRenew: boolean;
  paid: number;
  papersNeeded: boolean;
  createdAt: string;
  updatedAt: string;
};
type Data = { counts: Partial<Record<Status, number>>; domains: Row[] };

const tone: Record<Status, Tone> = { awaiting: "amber", checking: "blue", active: "green", failed: "red", removed: "grey" };
const FILTERS = ["open", "awaiting", "checking", "active", "failed", "removed", "all"] as const;

export default function DomainsPage() {
  const t = useT();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("open");
  const [kind, setKind] = useState("");
  const [papers, setPapers] = useState(false);
  const [sort, setSort] = useState("new");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);

  const qs = new URLSearchParams({ status, sort, ...(kind ? { kind } : {}), ...(papers ? { papers: "1" } : {}), ...(q ? { q } : {}) });
  const s = useApi<Data>(`/api/diwan/domains?${qs}`);

  const statusName = (x: (typeof FILTERS)[number]) =>
    ({
      open: t("To do", "للمتابعة"),
      awaiting: t("Awaiting setup", "بانتظار الإعداد"),
      checking: t("Checking", "قيد الفحص"),
      active: t("Active", "فعّال"),
      failed: t("Failed", "فشل"),
      removed: t("Removed", "محذوف"),
      all: t("All", "الكل"),
    })[x];
  const count = (x: (typeof FILTERS)[number], c: Data["counts"] | undefined) =>
    !c ? null : x === "open" ? (c.awaiting ?? 0) + (c.checking ?? 0) : x === "all" ? Object.values(c).reduce((a, b) => a + (b ?? 0), 0) : c[x] ?? 0;

  return (
    <div>
      <PageHead
        title={t("Domains", "النطاقات")}
        sub={t(
          "Domains stores connect or buy. Set each one up, then mark it Checking, Active or Failed. The merchant is told each time.",
          "النطاقات التي تربطها المتاجر أو تشتريها. جهّز كل نطاق ثم اجعله قيد الفحص أو فعّالًا أو فاشلًا، ويُبلَّغ التاجر في كل مرة.",
        )}
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t("Status", "الحالة")}>
        {FILTERS.map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={status === x}
            onClick={() => setStatus(x)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${status === x ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
          >
            {statusName(x)}
            {count(x, s.data?.counts) !== null && <span className="ms-1.5 tabular-nums opacity-75">{count(x, s.data?.counts)}</span>}
          </button>
        ))}
      </div>

      <FilterBar
        className="mb-4"
        count={(kind ? 1 : 0) + (sort !== "new" ? 1 : 0) + (papers ? 1 : 0)}
        onClear={() => { setKind(""); setSort("new"); setPapers(false); }}
        search={<input className={field} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t("Search domain, store or email", "ابحث بالنطاق أو المتجر أو البريد")} aria-label={t("Search", "بحث")} />}
      >
      <div className="grid gap-3 sm:grid-cols-3">
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("Kind", "النوع")}>
          <option value="">{t("Connected and bought", "المربوطة والمشتراة")}</option>
          <option value="connect">{t("Connected by the store", "يربطها المتجر")}</option>
          <option value="bought">{t("Bought through Dukkan", "مشتراة من دكان")}</option>
        </select>
        <select className={field} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("Sort", "الترتيب")}>
          <option value="new">{t("Newest first", "الأحدث أولًا")}</option>
          <option value="old">{t("Oldest first", "الأقدم أولًا")}</option>
          <option value="updated">{t("Recently changed", "المعدّلة مؤخرًا")}</option>
        </select>
        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={papers} onChange={(e) => setPapers(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" />
          {t("Needs papers (.jo, .com.jo)", "تحتاج أوراقًا (.jo و .com.jo)")}
        </label>
      </div>
      </FilterBar>

      <Loaded s={s}>
        {(d) =>
          d.domains.length === 0 ? (
            <p className={`${card} text-center text-sm text-muted`}>{t("No domains here.", "لا توجد نطاقات هنا.")}</p>
          ) : (
            <div className="grid gap-3">
              {d.domains.map((row) => (
                <DomainCard key={row.id} row={row} statusName={statusName} onDone={s.reload} />
              ))}
              {d.domains.length >= 200 && <p className="text-center text-xs text-muted">{t("Showing the first 200. Narrow the filters to see the rest.", "يظهر أول 200. ضيّق البحث لرؤية الباقي.")}</p>}
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

function DomainCard({ row, statusName, onDone }: { row: Row; statusName: (x: Status) => string; onDone: () => void }) {
  const t = useT();
  const f = useFmt();
  /* the status being set, with its note */
  const [next, setNext] = useState<"checking" | "active" | "failed" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const open = (s: "checking" | "active" | "failed") => {
    setNext(s);
    setNote(s === row.status ? row.note : "");
    setErr("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!next) return;
    if (next === "failed" && !note.trim()) return setErr(t("Say why it failed: the merchant reads this note.", "اكتب سبب الفشل: يقرأ التاجر هذه الملاحظة."));
    setBusy(true);
    const r = await send(`/api/diwan/domains/${row.id}`, "POST", { status: next, note });
    setBusy(false);
    if (r.ok) {
      setNext(null);
      onDone();
    } else setErr(r.data?.result === "removed" ? t("The store removed this domain.", "حذف المتجر هذا النطاق.") : t("That didn't work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p dir="ltr" className="break-all text-start text-lg font-bold">{row.name}</p>
          <p className="mt-1 text-sm">
            <Link href={`/diwan/shops/${row.shopId}`} className="font-semibold text-primary hover:underline">{row.shopName}</Link>
            <span dir="ltr" className="ms-2 text-xs text-muted">{row.shopEmail}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={tone[row.status]}>{statusName(row.status)}</Badge>
          <Badge tone={row.kind === "bought" ? "primary" : "grey"}>{row.kind === "bought" ? t("Bought", "مشترى") : t("Connected", "مربوط")}</Badge>
          {row.papersNeeded && <Badge tone="amber">{t("Needs papers", "يحتاج أوراقًا")}</Badge>}
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="inline text-muted">{t("Added: ", "أُضيف: ")}</dt><dd className="inline">{f.dateTime(row.createdAt)}</dd></div>
        <div><dt className="inline text-muted">{t("Changed: ", "عُدّل: ")}</dt><dd className="inline">{f.ago(row.updatedAt)}</dd></div>
        {row.kind === "bought" && (
          <>
            <div><dt className="inline text-muted">{t("Paid: ", "المدفوع: ")}</dt><dd className="inline">{f.jod(row.paid)} · {t(`${row.years ?? 1} yr`, `${row.years ?? 1} سنة`)}</dd></div>
            <div><dt className="inline text-muted">{row.autoRenew ? t("Renews: ", "يتجدد: ") : t("Ends: ", "ينتهي: ")}</dt><dd className="inline">{f.date(row.renewsAt)}</dd></div>
          </>
        )}
      </dl>
      {row.note && <p className="mt-3 whitespace-pre-line rounded-xl bg-soft px-3 py-2 text-sm">{row.note}</p>}

      {row.status !== "removed" &&
        (next ? (
          <form onSubmit={save} className="mt-4 space-y-3 border-t border-fg/10 pt-4">
            <label htmlFor={`dn-${row.id}`} className="block text-sm font-medium">
              {next === "failed"
                ? t("Why it failed (the merchant sees this)", "سبب الفشل (يراه التاجر)")
                : t("Note for the merchant (optional)", "ملاحظة للتاجر (اختيارية)")}
            </label>
            <textarea id={`dn-${row.id}`} className={area} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
            <div className="flex flex-wrap gap-2">
              <Btn type="submit" kind={next === "failed" ? "danger" : "primary"} disabled={busy}>
                {busy ? t("Saving…", "جارٍ الحفظ…") : t(`Mark ${statusName(next)}`, `اجعله: ${statusName(next)}`)}
              </Btn>
              <Btn type="button" kind="ghost" onClick={() => setNext(null)}>{t("Cancel", "إلغاء")}</Btn>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-fg/10 pt-4">
            {(["checking", "active", "failed"] as const).map((x) => (
              <Btn key={x} kind={x === "failed" ? "ghost" : x === "active" ? "primary" : "ghost"} className="h-9 px-3" onClick={() => open(x)}>
                {x === row.status ? t(`Edit note (${statusName(x)})`, `تعديل الملاحظة (${statusName(x)})`) : statusName(x)}
              </Btn>
            ))}
          </div>
        ))}
    </div>
  );
}
