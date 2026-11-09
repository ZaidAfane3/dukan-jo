"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, td, useApi, useFmt, useT } from "@/components/diwan/ui";
import { PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER } from "@/components/diwan/ticketWords";
import { Pager, type TicketRow } from "@/components/diwan/TicketBits";
import { FilterBar } from "@/components/diwan/Filters";

/* Support tickets from merchants, live from the database: counts per status, filters, sorting and pages. Opening one
   (its own page) is written to the activity log. Bug reports and ideas have their own board (/diwan/feedback). */

type Data = {
  rows: TicketRow[]; total: number; page: number; pageSize: number; counts: Record<string, number>;
  staff: { id: string; name: string }[]; me: string;
};
type Filters = { status: string; priority: string; assignee: string; q: string; sort: string };

export default function TicketsPage() {
  const t = useT();
  const f = useFmt();
  const [filters, setFilters] = useState<Filters>({ status: "active", priority: "", assignee: "", q: "", sort: "updated" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    p.set("page", String(page));
    return `/api/diwan/tickets?${p}`;
  }, [filters, page]);
  const s = useApi<Data>(url);
  const set = (k: keyof Filters, v: string) => {
    setFilters((x) => ({ ...x, [k]: v }));
    setPage(1);
  };
  const counts = s.data?.counts ?? {};
  const active = STATUS_ORDER.filter((x) => x !== "resolved" && x !== "closed").reduce((n, x) => n + (counts[x] ?? 0), 0);
  const all = Object.values(counts).reduce((n, x) => n + x, 0);
  const tabs: { key: string; label: string; n: number }[] = [
    { key: "active", label: t("Needs work", "قيد العمل"), n: active },
    ...STATUS_ORDER.map((x) => ({ key: x, label: t(STATUS[x].en, STATUS[x].ar), n: counts[x] ?? 0 })),
    { key: "", label: t("All", "الكل"), n: all },
  ];
  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <PageHead title={t("Tickets", "التذاكر")} sub={t("Support requests from merchants. Replies go to the merchant's Support page and bell.", "طلبات الدعم من التجار. الردود تصل إلى صفحة الدعم وجرس الإشعارات عند التاجر.")} />

      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.key || "all"}
            role="tab"
            aria-selected={filters.status === x.key}
            onClick={() => set("status", x.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filters.status === x.key ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
          >
            {x.label} <span dir="ltr" className="ms-1 tabular-nums opacity-75">{f.num(x.n)}</span>
          </button>
        ))}
      </div>

      <FilterBar
        count={(filters.priority ? 1 : 0) + (filters.assignee ? 1 : 0) + (filters.sort !== "updated" ? 1 : 0)}
        onClear={() => setFilters((x) => ({ ...x, priority: "", assignee: "", sort: "updated" }))}
        search={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set("q", q.trim());
            }}
            className="flex gap-2"
          >
            <input id="tq" className={field} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Store, email, number or subject", "المتجر أو البريد أو الرقم أو الموضوع")} placeholder={t("Store, email, number or subject…", "المتجر أو البريد أو الرقم أو الموضوع…")} />
            <Btn kind="ghost" type="submit">{t("Find", "بحث")}</Btn>
          </form>
        }
      >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="tp">{t("Priority", "الأولوية")}</label>
          <select id="tp" className={field} value={filters.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="">{t("Any", "الكل")}</option>
            {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{t(PRIORITY[p].en, PRIORITY[p].ar)}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="ta">{t("Assigned to", "مسندة إلى")}</label>
          <select id="ta" className={field} value={filters.assignee} onChange={(e) => set("assignee", e.target.value)}>
            <option value="">{t("Anyone", "أي أحد")}</option>
            <option value="mine">{t("Me", "أنا")}</option>
            <option value="unassigned">{t("No one yet", "غير مسندة")}</option>
            {s.data?.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="ts">{t("Sort by", "الترتيب")}</label>
          <select id="ts" className={field} value={filters.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="updated">{t("Latest activity", "آخر نشاط")}</option>
            <option value="created">{t("Newest", "الأحدث")}</option>
            <option value="priority">{t("Priority", "الأولوية")}</option>
          </select>
        </div>
      </div>
      </FilterBar>

      <Loaded s={s}>
        {(d) => (
          <>
            <DataTable
              head={[t("Ticket", "التذكرة"), t("Store", "المتجر"), t("Status", "الحالة"), t("Priority", "الأولوية"), t("Assigned", "المسؤول"), t("Last activity", "آخر نشاط")]}
              empty={d.rows.length === 0 && t("No tickets match.", "لا توجد تذاكر مطابقة.")}
            >
              {d.rows.map((r) => (
                <tr key={r.number} className="hover:bg-soft/50">
                  <td className={td}>
                    <Link href={`/diwan/tickets/${r.number}`} className="font-semibold text-primary hover:underline">
                      <span dir="ltr">#{r.number}</span> {r.subject}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted">{r.preview}</p>
                  </td>
                  <td className={td}>
                    <Link href={`/diwan/shops/${r.accountId}`} className="font-medium hover:underline">{r.shop}</Link>
                    <p className="text-xs text-muted" dir="ltr">{r.email}</p>
                  </td>
                  <td className={td}><Badge tone={STATUS[r.status].tone}>{t(STATUS[r.status].en, STATUS[r.status].ar)}</Badge></td>
                  <td className={td}><Badge tone={PRIORITY[r.priority].tone}>{t(PRIORITY[r.priority].en, PRIORITY[r.priority].ar)}</Badge></td>
                  <td className={`${td} text-sm`}>{r.assignee ? r.assignee.name : <span className="text-muted">—</span>}</td>
                  <td className={`${td} whitespace-nowrap text-sm`}>
                    {f.ago(r.updated)}
                    <p className="text-xs text-muted">{r.lastAuthor === "merchant" ? t("Merchant wrote last", "آخر رسالة من التاجر") : r.lastAuthor === "staff" ? t("We wrote last", "آخر رسالة منّا") : ""}</p>
                  </td>
                </tr>
              ))}
            </DataTable>
            <Pager page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </Loaded>
    </div>
  );
}
