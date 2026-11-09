"use client";

import Link from "next/link";
import { useState } from "react";
import { METHODS, MethodBadge, methodText, Select, todayJo } from "@/components/diwan/shopBits";
import { Btn, card, DataTable, downloadCsv, field, Loaded, PageHead, td, useApi, useFmt, useT } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

type Pay = {
  id: string;
  shop_id: string;
  shop: string | null;
  owner: string;
  email: string;
  amount: string;
  method: string;
  reference: string;
  paid_on: string;
  note: string;
  marked_by: string | null;
};
/* a card with a little less room inside (a second padding class would lose to the card's own p-5) */
const tile = card.replace("p-5", "p-4");
/* the method the list is narrowed to: its card outlined in teal */
const tileOn = tile.replace("ring-1 ring-fg/[0.08]", "ring-2 ring-primary");

type Use = { count: number; total: string; stores: number };
type Data = { rows: Pay[]; count: number; total: string; page: number; pages: number; methods: (Use & { method: string })[]; all: Use };

/* Payments stores made to Dukkan, as staff marked them received (a store's page, "Mark as paid"). At the top, how stores
   pay: for each method the payments, the JOD and how many stores used it, over the dates and search chosen; a method's
   card also filters the list to it. Dukkan has no plans for now, so a payment stands on its own. */
export default function PaymentsPage() {
  const t = useT();
  const f = useFmt();
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...(method ? { method } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const s = useApi<Data>(`/api/diwan/payments?${params}&page=${page}`);
  const pickMethod = (m: string) => (setMethod(m), setPage(1));

  const exportCsv = async () => {
    const r = await fetch(`/api/diwan/payments?${params}&export=1`, { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.rows) return;
    downloadCsv(`dukkan-payments-${todayJo()}.csv`, [
      ["id", "store id", "store", "owner", "email", "paid on", "amount JOD", "method", "reference", "marked by", "note"],
      ...(j.rows as Pay[]).map((r) => [r.id, r.shop_id, r.shop ?? "", r.owner, r.email, String(r.paid_on).slice(0, 10), r.amount, r.method, r.reference, r.marked_by ?? "", r.note]),
    ]);
  };

  return (
    <>
      <PageHead
        title={t("Payments", "المدفوعات")}
        sub={t("What stores paid Dukkan, and how they paid it.", "ما دفعته المتاجر لدكّان، وكيف دفعته.")}
        actions={
          <Btn kind="ghost" onClick={exportCsv} disabled={!s.data?.count}>
            {t("Export CSV", "تصدير CSV")}
          </Btn>
        }
      />

      <FilterBar
        count={(from ? 1 : 0) + (to ? 1 : 0)}
        onClear={() => (setFrom(""), setTo(""), setPage(1))}
        search={
          <input
            type="search"
            maxLength={100}
            value={q}
            onChange={(e) => (setQ(e.target.value), setPage(1))}
            placeholder={t("Store, reference, or the full email or mobile", "المتجر أو المرجع، أو البريد أو الهاتف كاملًا")}
            aria-label={t("Search payments", "البحث في المدفوعات")}
            className={field}
          />
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("Paid from", "مدفوعة من")}</span>
            <input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("Paid until", "حتى")}</span>
            <input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className={field} />
          </label>
        </div>
      </FilterBar>

      <Loaded s={s}>
        {(d) => (
          <div className="space-y-6">
            <section aria-labelledby="pay-methods">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="pay-methods" className="text-lg font-extrabold tracking-tight">
                  {t("How stores paid", "كيف دفعت المتاجر")}
                </h2>
                <p className="text-sm text-muted">
                  {t("All methods", "كل الطرق")}: <b className="text-fg">{f.jod(d.all.total)}</b> · {t(`${f.num(d.all.count)} payments`, `${f.num(d.all.count)} دفعة`)} ·{" "}
                  {t(`${f.num(d.all.stores)} stores`, `${f.num(d.all.stores)} متجر`)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {d.methods.map((m) => {
                  const on = method === m.method;
                  return (
                    <button
                      key={m.method}
                      type="button"
                      aria-pressed={on}
                      title={on ? t("Show every method", "عرض كل الطرق") : t("Show only this method", "عرض هذه الطريقة فقط")}
                      onClick={() => pickMethod(on ? "" : m.method)}
                      className={`${on ? tileOn : tile} text-start transition hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                    >
                      <MethodBadge method={m.method} />
                      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight">{f.jod(m.total)}</p>
                      <p className="mt-1 text-xs text-muted">
                        {t(`${f.num(m.count)} payments`, `${f.num(m.count)} دفعة`)} · {t(`${f.num(m.stores)} stores`, `${f.num(m.stores)} متجر`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select
                  label={t("Method", "الطريقة")}
                  value={method}
                  onChange={pickMethod}
                  options={[{ value: "", label: t("Every method", "كل الطرق") }, ...METHODS.map((m) => ({ value: m, label: methodText(t, m) }))]}
                />
                <p className="text-sm text-muted">
                  {t(`${f.num(d.count)} payments`, `${f.num(d.count)} دفعة`)} · {t("total", "المجموع")} <b className="text-fg">{f.jod(d.total)}</b>
                </p>
              </div>
              <DataTable
                head={[t("Paid on", "تاريخ الدفع"), t("Store", "المتجر"), t("Amount", "المبلغ"), t("Method", "الطريقة"), t("Reference", "المرجع"), t("Marked by", "سجّلها"), t("Note", "ملاحظة")]}
                empty={!d.rows.length && (d.all.count ? t("No payments match.", "لا توجد مدفوعات مطابقة.") : t("No payments yet.", "لا توجد مدفوعات بعد."))}
              >
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${td} whitespace-nowrap`}>{f.date(r.paid_on)}</td>
                    <td className={td}>
                      <Link href={`/diwan/shops/${r.shop_id}`} className="font-semibold text-primary hover:underline">
                        {r.shop || r.owner}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{f.jod(r.amount)}</td>
                    <td className={td}>
                      <MethodBadge method={r.method} />
                    </td>
                    <td className={td} dir="ltr">
                      {r.reference || "—"}
                    </td>
                    <td className={td}>{r.marked_by ?? "—"}</td>
                    <td className={td}>{r.note || "—"}</td>
                  </tr>
                ))}
              </DataTable>
              {d.pages > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    {t("Previous", "السابق")}
                  </Btn>
                  <span className="tabular-nums text-muted">
                    {f.num(d.page)} / {f.num(d.pages)}
                  </span>
                  <Btn kind="ghost" disabled={page >= d.pages} onClick={() => setPage((p) => p + 1)}>
                    {t("Next", "التالي")}
                  </Btn>
                </div>
              )}
            </section>
          </div>
        )}
      </Loaded>
    </>
  );
}
