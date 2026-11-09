"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Btn, DataTable, field, Loaded, PageHead, td, useApi, useFmt, useT } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

/* The activity log: everything staff opened or changed, newest first, 50 lines a page. It can only be added to (the
   database refuses changes and deletions), so this page only reads it. */

type Row = {
  id: string; at: string; staffId: string | null; staffName: string | null; action: string; targetType: string | null;
  targetId: string | null; reason: string | null; ip: string; meta: unknown;
};
type Data = { rows: Row[]; next: string | null; staff: { id: string; name: string; active: boolean }[]; actions: string[]; targetTypes: string[] };
type Filters = { staff: string; action: string; target_type: string; target_id: string; from: string; to: string };
const none: Filters = { staff: "", action: "", target_type: "", target_id: "", from: "", to: "" };

/** Where a log line's target opens in Diwan, when it has a page */
function targetHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "shop" && /^\d+$/.test(id)) return `/diwan/shops/${id}`;
  if (type === "ticket" && /^\d+$/.test(id)) return `/diwan/tickets/${id}`;
  return null;
}

export default function ActivityPage() {
  const t = useT();
  const f = useFmt();
  const [draft, setDraft] = useState<Filters>(none);
  const [filters, setFilters] = useState<Filters>(none);
  /* the pages seen so far: each entry is the "before" id that page started at ("" for the first) */
  const [pages, setPages] = useState<string[]>([""]);
  const before = pages[pages.length - 1];
  const url = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v.trim()) q.set(k, v.trim());
    if (before) q.set("before", before);
    return `/api/diwan/activity?${q}`;
  }, [filters, before]);
  const s = useApi<Data>(url);
  /* the choices stay while a new page loads */
  const [choices, setChoices] = useState<Pick<Data, "staff" | "actions" | "targetTypes"> | null>(null);
  useEffect(() => {
    if (s.data) setChoices({ staff: s.data.staff, actions: s.data.actions, targetTypes: s.data.targetTypes });
  }, [s.data]);
  const [open, setOpen] = useState<string | null>(null);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters(draft);
    setPages([""]);
  };
  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <PageHead title={t("Activity log", "سجل النشاط")} sub={t("Everything staff opened or changed. Nothing here can be edited or removed.", "كل ما فتحه الفريق أو غيّره. لا يمكن تعديل أي شيء هنا أو حذفه.")} />

      <FilterBar count={Object.values(filters).filter((v) => v.trim()).length} onClear={() => { setDraft(none); setFilters(none); setPages([""]); }}>
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="ac-staff" className={label}>{t("Staff", "العضو")}</label>
          <select id="ac-staff" className={field} value={draft.staff} onChange={(e) => setDraft({ ...draft, staff: e.target.value })}>
            <option value="">{t("Everyone", "الجميع")}</option>
            {choices?.staff.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : ` (${t("no access", "بلا دخول")})`}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ac-action" className={label}>{t("Action", "الإجراء")}</label>
          <select id="ac-action" className={field} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
            <option value="">{t("Any", "أي إجراء")}</option>
            {choices?.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ac-type" className={label}>{t("Target type", "نوع الهدف")}</label>
          <select id="ac-type" className={field} value={draft.target_type} onChange={(e) => setDraft({ ...draft, target_type: e.target.value })}>
            <option value="">{t("Any", "أي نوع")}</option>
            {choices?.targetTypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ac-id" className={label}>{t("Target id", "رقم الهدف")}</label>
          <input id="ac-id" className={field} dir="ltr" maxLength={80} value={draft.target_id} onChange={(e) => setDraft({ ...draft, target_id: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ac-from" className={label}>{t("From", "من")}</label>
          <input id="ac-from" type="date" className={field} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ac-to" className={label}>{t("To", "إلى")}</label>
          <input id="ac-to" type="date" className={field} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2">
          <Btn type="submit">{t("Show", "عرض")}</Btn>
          <Btn type="button" kind="ghost" onClick={() => { setDraft(none); setFilters(none); setPages([""]); }}>{t("Clear", "مسح")}</Btn>
        </div>
      </form>
      </FilterBar>

      <Loaded s={s}>
        {(d) => (
          <>
            <DataTable
              head={[t("When", "الوقت"), t("Staff", "العضو"), t("Action", "الإجراء"), t("Target", "الهدف"), t("Reason", "السبب"), t("IP", "العنوان")]}
              empty={d.rows.length ? false : t("Nothing in the log matches yet.", "لا يوجد في السجل ما يطابق بعد.")}
            >
              {d.rows.map((r) => {
                const href = targetHref(r.targetType, r.targetId);
                const target = r.targetType ? `${r.targetType}${r.targetId ? ` #${r.targetId}` : ""}` : "—";
                return (
                  <tr key={r.id}>
                    <td className={`${td} whitespace-nowrap`}>{f.dateTime(r.at)}</td>
                    <td className={td}>{r.staffName ?? <span className="text-muted">{t("Not signed in", "غير مسجّل")}</span>}</td>
                    <td className={td}>
                      <code dir="ltr" className="rounded bg-soft px-1.5 py-0.5 text-xs">{r.action}</code>
                      {r.meta != null && (
                        <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="ms-2 text-xs font-semibold text-primary hover:underline">
                          {open === r.id ? t("Hide details", "إخفاء التفاصيل") : t("Details", "التفاصيل")}
                        </button>
                      )}
                      {open === r.id && <pre dir="ltr" className="mt-2 max-h-64 max-w-md overflow-auto whitespace-pre-wrap break-all rounded-lg bg-soft p-2 text-start text-xs">{JSON.stringify(r.meta, null, 2)}</pre>}
                    </td>
                    <td className={td}>{href ? <Link href={href} className="font-semibold text-primary hover:underline">{target}</Link> : target}</td>
                    <td className={`${td} max-w-xs break-words`}>{r.reason ?? "—"}</td>
                    <td className={`${td} text-xs text-muted`} dir="ltr">{r.ip}</td>
                  </tr>
                );
              })}
            </DataTable>
            <div className="mt-4 flex items-center gap-2">
              <Btn kind="ghost" disabled={pages.length < 2 || s.loading} onClick={() => setPages((p) => p.slice(0, -1))}>{t("Newer", "الأحدث")}</Btn>
              <Btn kind="ghost" disabled={!d.next || s.loading} onClick={() => d.next && setPages((p) => [...p, d.next!])}>{t("Older", "الأقدم")}</Btn>
              <span className="text-xs text-muted">{t(`Page ${pages.length}`, `الصفحة ${pages.length}`)}</span>
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}
