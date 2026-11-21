"use client";

import { useMemo, useState } from "react";
import { usePrefs } from "@/components/Prefs";
import { MerchantLineText, merchantActionWords, type MerchantLine } from "@/components/diwan/merchantLogWords";
import { ShopLink, ShopOnly, useUrlParam } from "@/components/diwan/shopBits";
import { Btn, DataTable, field, Loaded, LoadMore, PageHead, td, useFmt, useMore, useT } from "@/components/diwan/ui";
import { ActivitySkeleton } from "@/components/diwan/skeletons";
import { FilterBar } from "@/components/diwan/Filters";
import { oneOf, shaped, useListScroll, useListState } from "@/components/diwan/useListState";

/* The merchant log: what merchants did with their accounts and stores (signing up and in, their password, email,
   mobile and 2-step, their setup steps, going live, their store's name, link, theme and delivery), newest first. Never
   their products, orders or customers. It is only added to, so this page only reads it; "Load more" adds older lines. */

type Data = { rows: MerchantLine[]; next: string | null; actions: string[]; shopName: string | null };
type Filters = { kind: string; action: string; from: string; to: string };
const none: Filters = { kind: "", action: "", from: "", to: "" };
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const LIST = { kind: oneOf(["", "account", "store"]), action: shaped(/^[\w.:-]{1,80}$/), from: shaped(DAY), to: shaped(DAY) };

export default function MerchantLogPage() {
  const t = useT();
  const f = useFmt();
  const { lang } = usePrefs();
  const [filters, setFilters] = useListState(LIST);
  const [draft, setDraft] = useState<Filters>(filters);
  /* one store's lines only, from its page's "See all" (?shop=) */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const url = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v.trim()) q.set(k, v.trim());
    if (shop) q.set("shop", shop);
    return `/api/diwan/merchant-log?${q}`;
  }, [filters, shop]);
  const s = useMore<Data>(url, (d) => (d.next ? `before=${d.next}` : null));
  useListScroll(s);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    setFilters(draft);
  };
  const clear = () => (setDraft(none), setFilters(none));
  const label = "mb-1 block text-xs font-medium text-muted";
  const choice = draft.kind ? `@${draft.kind}` : draft.action;
  const actions = s.data?.actions ?? [];

  return (
    <div>
      <PageHead
        title={t("Merchant log", "سجل التجار")}
        sub={t(
          "What merchants did with their accounts and stores: signing in, password and email changes, setup steps, going live and more. Never their products, orders or customers.",
          "ما فعله التجار في حساباتهم ومتاجرهم: تسجيل الدخول، وتغيير كلمة المرور والبريد، وخطوات الإعداد، والنشر وغيرها. دون منتجاتهم أو طلباتهم أو عملائهم.",
        )}
      />

      <ShopOnly id={shop} name={s.data?.shopName} onClear={() => setShop("")} />

      <FilterBar count={Object.values(filters).filter((v) => v.trim()).length} onClear={clear}>
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="ml-action" className={label}>{t("What", "ماذا")}</label>
            <select
              id="ml-action"
              className={field}
              value={choice}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({ ...draft, kind: v.startsWith("@") ? v.slice(1) : "", action: v.startsWith("@") ? "" : v });
              }}
            >
              <option value="">{t("Everything", "كل شيء")}</option>
              <option value="@account">{t("Account only", "الحساب فقط")}</option>
              <option value="@store">{t("Store only", "المتجر فقط")}</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {merchantActionWords(t, a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ml-from" className={label}>{t("From", "من")}</label>
            <input id="ml-from" type="date" className={field} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ml-to" className={label}>{t("To", "إلى")}</label>
            <input id="ml-to" type="date" className={field} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Btn type="submit">{t("Show", "عرض")}</Btn>
            <Btn type="button" kind="ghost" onClick={clear}>{t("Clear", "مسح")}</Btn>
          </div>
        </form>
      </FilterBar>

      <Loaded s={s} skeleton={<ActivitySkeleton />}>
        {(d) => (
          <>
            <DataTable
              head={[t("When", "الوقت"), t("Store", "المتجر"), t("What happened", "ماذا حدث")]}
              empty={d.rows.length ? false : t("Nothing in the log matches yet.", "لا يوجد في السجل ما يطابق بعد.")}
            >
              {d.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap`}>{f.dateTime(r.at)}</td>
                  <td className={td}>{r.shop ? <ShopLink id={r.shop.id}><bdi>{r.shop.name || t("Unnamed store", "متجر بلا اسم")}</bdi></ShopLink> : "—"}</td>
                  <td className={`${td} max-w-xl font-medium`}>
                    <MerchantLineText row={r} t={t} lang={lang} />
                  </td>
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
