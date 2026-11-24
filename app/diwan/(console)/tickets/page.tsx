"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShopAndOwner, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { Badge, Btn, card, DataTable, field, Loaded, PageHead, td, LoadMore, useFmt, useMore, useT } from "@/components/diwan/ui";
import { TicketsSkeleton } from "@/components/diwan/skeletons";
import { PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER } from "@/components/diwan/ticketWords";
import type { TicketRow } from "@/components/diwan/TicketBits";
import { FilterBar } from "@/components/diwan/Filters";
import { oneOf, shaped, typedText, useListScroll, useListState } from "@/components/diwan/useListState";

/* Support tickets from merchants, live from the database: counts per status, filters, sorting and pages. Opening one
   (its own page) is written to the activity log. Bug reports and ideas have their own board (/diwan/feedback). */

type Data = {
  rows: TicketRow[]; total: number; page: number; pageSize: number; counts: Record<string, number>;
  staff: { id: string; name: string }[]; me: string;
};
type Filters = { status: string; priority: string; assignee: string; q: string; sort: string };
/* the tab, filters, search and sort, kept in the address so Back from a ticket brings the list back as it was */
const LIST = {
  status: oneOf(["active", "", ...STATUS_ORDER]),
  priority: oneOf(["", ...PRIORITY_ORDER]),
  assignee: shaped(/^(mine|unassigned|[0-9]{1,12})$/),
  q: typedText(100),
  sort: oneOf(["updated", "created", "priority"]),
};

export default function TicketsPage() {
  const t = useT();
  const f = useFmt();
  /* one store's tickets only, from its page's "See all" (?shop=); every status then, not only the open ones. "All" is
     then the starting tab, so a tab staff picked (even "Needs work") stays in the address for Back */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const [filters, setFilters] = useListState(LIST, undefined, shop ? { status: "" } : undefined);
  const [q, setQ] = useState(filters.q);
  const router = useRouter();
  const url = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    if (shop) p.set("shop", shop);
    return `/api/diwan/tickets?${p}`;
  }, [filters, shop]);
  const s = useMore<Data>(url, (d, n) => (n * d.pageSize < d.total ? `page=${n + 1}` : null));
  useListScroll(s);
  const set = (k: keyof Filters, v: string) => setFilters({ [k]: v });
  /* the tabs show no numbers (the owner's call, 2026-11-19) */
  const tabs: { key: string; label: string }[] = [
    { key: "active", label: t("Needs work", "قيد العمل") },
    ...STATUS_ORDER.map((x) => ({ key: x, label: t(STATUS[x].en, STATUS[x].ar) })),
    { key: "", label: t("All", "الكل") },
  ];
  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <PageHead title={t("Tickets", "التذاكر")} sub={t("Support requests from merchants. Replies go to the merchant's Support page and bell.", "طلبات الدعم من التجار. الردود تصل إلى صفحة الدعم وجرس الإشعارات عند التاجر.")} />

      <ShopOnly id={shop} name={s.data?.rows[0] ? s.data.rows[0].shop || s.data.rows[0].owner : null} onClear={() => setShop("")} />

      {/* the status tabs at the start of the row, the search and filters at its end (FilterBar) */}
      <FilterBar
        tabs={
          <div role="tablist" className="flex flex-wrap gap-2">
            {tabs.map((x) => (
              <button
                key={x.key || "all"}
                role="tab"
                aria-selected={filters.status === x.key}
                onClick={() => set("status", x.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${filters.status === x.key ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        }
        count={(filters.priority ? 1 : 0) + (filters.assignee ? 1 : 0) + (filters.sort !== "updated" ? 1 : 0)}
        onClear={() => setFilters({ priority: "", assignee: "", sort: "updated" })}
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

      <Loaded s={s} skeleton={<TicketsSkeleton />}>
        {(d) => (
          <>
            <DataTable
              head={[t("Number", "الرقم"), t("Subject", "الموضوع"), t("Store", "المتجر"), t("Status", "الحالة"), t("Priority", "الأولوية"), t("Assigned", "المسؤول"), t("Last activity", "آخر نشاط")]}
              empty={d.rows.length === 0 && t("No tickets match.", "لا توجد تذاكر مطابقة.")}
            >
              {d.rows.map((r) => (
                /* the whole row opens the ticket; the number is its link, for the keyboard and for opening in a new tab */
                <tr
                  key={r.number}
                  className="cursor-pointer transition-colors hover:bg-soft/50"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a, button")) return;
                    router.push(`/diwan/tickets/${r.number}`);
                  }}
                >
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={`/diwan/tickets/${r.number}`} className="inline-flex rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-[13px] font-bold text-primary ring-1 ring-primary/20 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <span dir="ltr">#{r.number}</span>
                    </Link>
                  </td>
                  <td className={td}>
                    {/* the merchant's words, each in its own direction: an English line in the Arabic console ends with its "…" */}
                    <p dir="auto" className="font-semibold ltr:text-left rtl:text-right">{r.subject}</p>
                    <p dir="auto" className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted ltr:text-left rtl:text-right">{r.preview}</p>
                  </td>
                  <td className={td}>
                    <ShopAndOwner id={r.accountId} shop={r.shop} owner={r.owner} />
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
            <LoadMore s={s} total={d.total} />
          </>
        )}
      </Loaded>
    </div>
  );
}
