"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityText, type ActivityRow } from "@/components/diwan/ActivityLine";
import { actionWords } from "@/components/diwan/activityWords";
import { ShopLink, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { Btn, DataTable, field, Loaded, LoadMore, PageHead, td, useFmt, useMore, useT } from "@/components/diwan/ui";
import { ActivitySkeleton } from "@/components/diwan/skeletons";
import { FilterBar } from "@/components/diwan/Filters";
import { oneOf, shaped, useListScroll, useListState } from "@/components/diwan/useListState";

/* The activity log: Diwan's own staff, when they signed in and what they changed, newest first. What they only opened is
   not kept, and a line says what happened in plain words, nothing deeper. It can only be added to (the database refuses
   changes and deletions), so this page only reads it; "Load more" adds the older lines below. */

type Data = { rows: ActivityRow[]; next: string | null; staff: { id: string; name: string; active: boolean }[]; actions: string[]; shopName: string | null };
type Filters = { staff: string; kind: string; action: string; from: string; to: string };
const none: Filters = { staff: "", kind: "", action: "", from: "", to: "" };
/* the filters applied, kept in the address so Back from a store brings the log back as it was */
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const LIST = { staff: shaped(/^[0-9]{1,12}$/), kind: oneOf(["", "signin"]), action: shaped(/^[\w.:-]{1,80}$/), from: shaped(DAY), to: shaped(DAY) };

export default function ActivityPage() {
  const t = useT();
  const f = useFmt();
  const [filters, setFilters] = useListState(LIST);
  const [draft, setDraft] = useState<Filters>(filters);
  /* one store's lines only, from its page's "See all" (?shop=) */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const url = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v.trim()) q.set(k, v.trim());
    if (shop) q.set("shop", shop);
    return `/api/diwan/activity?${q}`;
  }, [filters, shop]);
  const s = useMore<Data>(url, (d) => (d.next ? `before=${d.next}` : null));
  useListScroll(s);
  /* the choices stay while new lines load */
  const [choices, setChoices] = useState<Pick<Data, "staff" | "actions"> | null>(null);
  useEffect(() => {
    if (s.data) setChoices({ staff: s.data.staff, actions: s.data.actions });
  }, [s.data]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters(draft);
  };
  const clear = () => (setDraft(none), setFilters(none));
  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <PageHead
        title={t("Activity log", "سجل النشاط")}
        sub={t("When Diwan's team signed in and what they changed. Nothing here can be edited or deleted.", "متى سجّل فريق الديوان دخوله وما الذي غيّره. لا يمكن تعديل أي شيء هنا أو حذفه.")}
      />

      <ShopOnly id={shop} name={s.data?.shopName} onClear={() => setShop("")} />

      <FilterBar count={Object.values(filters).filter((v) => v.trim()).length} onClear={clear}>
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="ac-staff" className={label}>{t("Team member", "العضو")}</label>
            <select id="ac-staff" className={field} value={draft.staff} onChange={(e) => setDraft({ ...draft, staff: e.target.value })}>
              <option value="">{t("Everyone", "الجميع")}</option>
              {choices?.staff.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : ` (${t("no access", "بلا دخول")})`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ac-action" className={label}>{t("What", "ماذا")}</label>
            <select
              id="ac-action"
              className={field}
              value={draft.kind === "signin" ? "@signin" : draft.action}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value === "@signin" ? "signin" : "", action: e.target.value === "@signin" ? "" : e.target.value })}
            >
              <option value="">{t("Everything", "كل شيء")}</option>
              <option value="@signin">{t("Sign-ins only", "تسجيلات الدخول فقط")}</option>
              {choices?.actions.map((a) => <option key={a} value={a}>{actionWords(t, a)}</option>)}
            </select>
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
            <Btn type="button" kind="ghost" onClick={clear}>{t("Clear", "مسح")}</Btn>
          </div>
        </form>
      </FilterBar>

      <Loaded s={s} skeleton={<ActivitySkeleton />}>
        {(d) => (
          <>
            <DataTable
              head={[t("When", "الوقت"), t("Who", "من"), t("What happened", "ماذا حدث"), t("Store", "المتجر"), t("Reason", "السبب")]}
              empty={d.rows.length ? false : t("Nothing in the log matches yet.", "لا يوجد في السجل ما يطابق بعد.")}
            >
              {d.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap`}>{f.dateTime(r.at)}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.staffName ? <bdi>{r.staffName}</bdi> : <span className="text-muted">{t("Not signed in", "غير مسجّل")}</span>}</td>
                  <td className={`${td} max-w-md font-medium`}>
                    <ActivityText row={r} />
                  </td>
                  {/* the store the line is about (the store itself, or its ticket, report, document or payment) */}
                  <td className={td}>{r.shop ? <ShopLink id={r.shop.id}>{r.shop.name}</ShopLink> : "—"}</td>
                  <td className={`${td} max-w-xs break-words`}>{r.reason ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
            <LoadMore s={s} />
          </>
        )}
      </Loaded>
    </div>
  );
}
