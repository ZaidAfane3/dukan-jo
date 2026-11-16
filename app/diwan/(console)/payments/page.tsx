"use client";

import Link from "next/link";
import { useState } from "react";
import { METHODS, MethodBadge, methodText, PayLogo, Select, todayJo } from "@/components/diwan/shopBits";
import { Btn, card, DataTable, downloadCsv, field, Loaded, LoadMore, PageHead, td, useFmt, useMore, useT } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";
import type { Bi } from "@/components/storefront/config";
import { findTheme } from "@/components/themes";

type Pay = {
  /* a payment staff marked as received, or a theme bought in the theme store */
  kind: "payment" | "theme";
  id: string;
  shop_id: string;
  shop: string | null;
  owner: string;
  email: string;
  amount: string;
  /* empty for a theme bought before the checkout recorded the way to pay */
  method: string | null;
  reference: string;
  paid_on: string;
  note: string;
  marked_by: string | null;
  theme_id: string | null;
  /* the theme store's name for it (catalog_themes); empty for a code theme whose name Diwan never changed */
  theme_name: Bi | null;
};
/* a card with a little less room inside (a second padding class would lose to the card's own p-5) */
const tile = card.replace("p-5", "p-4");
/* the method the list is narrowed to: its card outlined in orange */
const tileOn = tile.replace("ring-1 ring-fg/[0.08]", "ring-2 ring-primary");

type Use = { count: number; total: string; stores: number };
type Data = { rows: Pay[]; count: number; total: string; page: number; pages: number; methods: (Use & { method: string })[]; all: Use };

/* A theme's name in the language shown: the theme store's own name for it, else the code theme's (components/themes.ts),
   else its code name */
const themeLabel = (t: (en: string, ar: string) => string, r: Pay) => {
  const name = r.theme_name ?? findTheme(r.theme_id)?.name;
  return (name && t(name.en, name.ar)) || r.theme_id || "";
};

/* Payments stores made to Dukkan: the themes merchants bought in the theme store (only those with a price) and the
   payments staff marked received (a store's page, "Mark as paid"), together, newest first. At the top, how stores pay:
   for each method the payments, the JOD and how many stores used it, over the kind, dates and search chosen; a method's
   card also filters the list to it. A marked payment stands on its own; theme purchases come from the theme store. */
export default function PaymentsPage() {
  const t = useT();
  const f = useFmt();
  const [kind, setKind] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const params = new URLSearchParams({ ...(kind ? { kind } : {}), ...(method ? { method } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const s = useMore<Data>(`/api/diwan/payments?${params}`, (d, n) => (n < d.pages ? `page=${n + 1}` : null));
  const pickMethod = (m: string) => setMethod(m);
  const whatFor = (r: Pay) => (r.kind === "theme" ? t(`Theme: ${themeLabel(t, r)}`, `ثيم: ${themeLabel(t, r)}`) : t("Payment", "دفعة"));

  const exportCsv = async () => {
    const r = await fetch(`/api/diwan/payments?${params}&export=1`, { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.rows) return;
    downloadCsv(`dukkan-payments-${todayJo()}.csv`, [
      ["kind", "id", "store id", "store", "owner", "email", "paid on", "amount JOD", "method", "what for", "theme", "reference", "marked by", "note"],
      ...(j.rows as Pay[]).map((r) => [
        r.kind === "theme" ? "theme purchase" : "marked payment",
        r.id,
        r.shop_id,
        r.shop ?? "",
        r.owner,
        r.email,
        String(r.paid_on).slice(0, 10),
        r.amount,
        r.method ?? "",
        whatFor(r),
        r.kind === "theme" ? themeLabel(t, r) : "",
        r.reference,
        r.marked_by ?? "",
        r.note,
      ]),
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
        onClear={() => (setFrom(""), setTo(""))}
        search={
          <input
            type="search"
            maxLength={100}
            value={q}
            onChange={(e) => (setQ(e.target.value))}
            placeholder={t("Store, reference, or the full email or mobile", "المتجر أو المرجع، أو البريد أو الهاتف كاملًا")}
            aria-label={t("Search payments", "البحث في المدفوعات")}
            className={field}
          />
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("Paid from", "مدفوعة من")}</span>
            <input type="date" value={from} onChange={(e) => (setFrom(e.target.value))} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">{t("Paid until", "حتى")}</span>
            <input type="date" value={to} onChange={(e) => (setTo(e.target.value))} className={field} />
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                      <span className="flex items-center gap-2.5 text-sm font-semibold">
                        <PayLogo method={m.method} className="h-9 w-14" />
                        {methodText(t, m.method)}
                      </span>
                      <p className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight">{f.jod(m.total)}</p>
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
                <div className="flex flex-wrap gap-2">
                  <Select
                    label={t("Kind of payment", "نوع الدفعة")}
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "", label: t("All", "الكل") },
                      { value: "theme", label: t("Theme purchases", "شراء الثيمات") },
                      { value: "payment", label: t("Marked payments", "دفعات مسجّلة") },
                    ]}
                  />
                  <Select
                    label={t("Method", "الطريقة")}
                    value={method}
                    onChange={pickMethod}
                    options={[{ value: "", label: t("Every method", "كل الطرق") }, ...METHODS.map((m) => ({ value: m, label: methodText(t, m) }))]}
                  />
                </div>
                <p className="text-sm text-muted">
                  {t(`${f.num(d.count)} payments`, `${f.num(d.count)} دفعة`)} · {t("total", "المجموع")} <b className="text-fg">{f.jod(d.total)}</b>
                </p>
              </div>
              <DataTable
                head={[t("Paid on", "تاريخ الدفع"), t("Store", "المتجر"), t("What for", "البيان"), t("Amount", "المبلغ"), t("Method", "الطريقة"), t("Reference", "المرجع"), t("Marked by", "سجّلها"), t("Note", "ملاحظة")]}
                empty={!d.rows.length && (d.all.count ? t("No payments match.", "لا توجد مدفوعات مطابقة.") : t("No payments yet.", "لا توجد مدفوعات بعد."))}
              >
                {d.rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <td className={`${td} whitespace-nowrap`}>{f.date(r.paid_on)}</td>
                    <td className={td}>
                      <Link href={`/diwan/shops/${r.shop_id}`} className="font-semibold text-primary hover:underline">
                        {r.shop || r.owner}
                      </Link>
                    </td>
                    <td className={td}>{whatFor(r)}</td>
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
              <LoadMore s={s} total={d.count} />
            </section>
          </div>
        )}
      </Loaded>
    </>
  );
}
