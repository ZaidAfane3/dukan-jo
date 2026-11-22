"use client";

import { useRef, useState } from "react";
import { shaped, typedText, useListScroll, useListState } from "@/components/diwan/useListState";
import { METHODS, MethodBadge, methodText, PayLogo, Select, ShopAndOwner, ShopOnly, todayJo, useUrlParam } from "@/components/diwan/shopBits";
import { Btn, card, DataTable, downloadCsv, field, Loaded, LoadMore, PageHead, send, td, useFmt, useMore, useT } from "@/components/diwan/ui";
import { tell } from "@/components/diwan/dialogs";
import { askOwnPassword, passwordAgainWords } from "@/components/diwan/passwordAgain";
import { PaymentsSkeleton } from "@/components/diwan/skeletons";
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
type Data = {
  rows: Pay[]; count: number; total: string; page: number; pages: number; methods: (Use & { method: string })[]; all: Use;
  /* how many of each kind match the other filters, for the tabs */
  kinds: { payment: number; theme: number };
  /* the store's name when the list is narrowed to one store */
  shopName: string | null;
};

/* The page's tabs, kept in the address (?tab=) so a tab can be linked: everything, the payments staff marked as received
   (a store's page, "Mark as paid"), and the themes merchants bought in the theme store. Dukkan has no plans, so these
   two are everything stores pay it today. */
const TABS = ["", "store", "themes"] as const;
type Tab = (typeof TABS)[number];
const KIND_OF: Record<Tab, string> = { "": "", store: "payment", themes: "theme" };

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
/* the method, dates and search, kept in the address so Back from a store brings the list back as it was (the tab and
   the store are in it already: ?tab=, ?shop=) */
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const LIST = { method: shaped(/^[a-z_-]{1,30}$/), from: shaped(DAY), to: shaped(DAY), q: typedText(100) };

export default function PaymentsPage() {
  const t = useT();
  const f = useFmt();
  const [tabParam, setTab] = useUrlParam("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam) ? (tabParam as Tab) : "";
  const kind = KIND_OF[tab];
  /* one store only, from its page's "See all" (?shop=) */
  const [shopParam, setShop] = useUrlParam("shop");
  const shop = /^\d+$/.test(shopParam) ? shopParam : "";
  const [list, setList] = useListState(LIST);
  const { method, from, to, q } = list;
  const setMethod = (x: string) => setList({ method: x });
  const setFrom = (x: string) => setList({ from: x });
  const setTo = (x: string) => setList({ to: x });
  const setQ = (x: string) => setList({ q: x });
  const params = new URLSearchParams({ ...(kind ? { kind } : {}), ...(shop ? { shop } : {}), ...(method ? { method } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const s = useMore<Data>(`/api/diwan/payments?${params}`, (d, n) => (n < d.pages ? `page=${n + 1}` : null));
  useListScroll(s);
  const pickMethod = (m: string) => setMethod(m);
  const whatFor = (r: Pay) => (r.kind === "theme" ? t(`Theme: ${themeLabel(t, r)}`, `ثيم: ${themeLabel(t, r)}`) : t("Payment", "دفعة"));

  /* The file holds the owners' names and emails: the staff member's own password first, as for the store list
     (server/staffConfirm.ts passwordAgain). One file per click: the button waits while the file is made, and a failure
     says so. */
  const [exporting, setExporting] = useState(false);
  const exportBusy = useRef(false);
  const exportCsv = async () => {
    if (exportBusy.current) return;
    exportBusy.current = true;
    try {
      const myPassword = await askOwnPassword(t, {
        title: t("Export the payments", "تصدير المدفوعات"),
        body: t("The file holds the owners' names and emails. Type your own password to confirm.", "يحوي الملف أسماء أصحاب المتاجر وبريدهم. اكتب كلمة مرورك للتأكيد."),
        confirm: t("Export", "تصدير"),
      });
      if (myPassword === null) return;
      setExporting(true);
      const r = await send(`/api/diwan/payments?${params}`, "POST", { myPassword });
      const j = r.data;
      if (!r.ok || !Array.isArray(j?.rows)) {
        if (r.status !== 401)
          await tell({
            title: t("Not exported", "لم يتم التصدير"),
            body:
              passwordAgainWords(t, j) ??
              (r.status === 0
                ? t("Diwan can't be reached right now. Check the connection and try again.", "تعذّر الوصول إلى الديوان الآن. تحقّق من الاتصال وحاول مجددًا.")
                : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.")),
          });
        return;
      }
      saveCsv(j.rows as Pay[]);
    } finally {
      exportBusy.current = false;
      setExporting(false);
    }
  };
  const saveCsv = (rows: Pay[]) =>
    downloadCsv(`dukkan-payments-${todayJo()}.csv`, [
      ["kind", "id", "store id", "store", "owner", "email", "paid on", "amount JOD", "method", "what for", "theme", "reference", "marked by", "note"],
      ...rows.map((r) => [
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

  return (
    <>
      <PageHead
        title={t("Payments", "المدفوعات")}
        sub={t("What stores paid Dukkan, and how they paid it.", "ما دفعته المتاجر لدكّان، وكيف دفعته.")}
        actions={
          <Btn kind="ghost" onClick={exportCsv} disabled={exporting || !s.data?.count} aria-busy={exporting}>
            {exporting ? t("Preparing…", "جارٍ التجهيز…") : t("Export CSV", "تصدير CSV")}
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

      <ShopOnly id={shop} name={s.data?.shopName} onClear={() => setShop("")} />

      <Loaded s={s} skeleton={<PaymentsSkeleton />}>
        {(d) => (
          <div className="space-y-6">
            <section aria-labelledby="pay-methods">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="pay-methods" className="text-lg font-extrabold tracking-tight">
                  {t("How stores paid", "كيف دفعت المتاجر")}
                </h2>
                <p className="text-sm text-muted">
                  {t("All methods", "كل الطرق")}: <b className="text-fg">{f.jod(d.all.total)}</b> · {f.count(d.all.count, ["payment", "payments"], { one: "دفعة واحدة", two: "دفعتان", few: "دفعات", many: "دفعة" })} ·{" "}
                  {f.count(d.all.stores, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}
                </p>
              </div>
              {/* the cards fill the row whatever the number of methods: two by two on narrow screens, then one row of
                  equal columns (wrapping when they would get too narrow) */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
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
                      <span className="mt-3 block text-2xl font-extrabold tabular-nums tracking-tight">{f.jod(m.total)}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {f.count(m.count, ["payment", "payments"], { one: "دفعة واحدة", two: "دفعتان", few: "دفعات", many: "دفعة" })} · {f.count(m.stores, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              {/* the tabs: everything, the payments staff marked, the themes bought */}
              <div role="tablist" aria-label={t("Kind of payment", "نوع الدفعة")} className="flex flex-wrap gap-2 border-b border-fg/10">
                {TABS.map((x) => {
                  const on = tab === x;
                  return (
                    <button
                      key={x || "all"}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(x)}
                      className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        on ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"
                      }`}
                    >
                      {x === "" ? t("All", "الكل") : x === "store" ? t("Store payments", "دفعات المتاجر") : t("Theme purchases", "شراء الثيمات")}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select
                  label={t("Method", "الطريقة")}
                  value={method}
                  onChange={pickMethod}
                  options={[{ value: "", label: t("Every method", "كل الطرق") }, ...METHODS.map((m) => ({ value: m, label: methodText(t, m) }))]}
                />
                <p className="text-sm text-muted">
                  {f.count(d.count, ["payment", "payments"], { one: "دفعة واحدة", two: "دفعتان", few: "دفعات", many: "دفعة" })} · {t("total", "المجموع")} <b className="text-fg">{f.jod(d.total)}</b>
                </p>
              </div>
              {tab === "themes" ? (
                /* a theme bought: which theme, by which store, for how much, and how it was paid at the theme store's checkout */
                <DataTable
                  head={[t("Bought on", "تاريخ الشراء"), t("Store", "المتجر"), t("Theme", "الثيم"), t("Price", "السعر"), t("Method", "الطريقة"), t("Paid through", "طريقة الدفع")]}
                  empty={!d.rows.length && (d.kinds.theme ? t("No theme purchases match.", "لا توجد مشتريات ثيمات مطابقة.") : t("No themes bought yet.", "لم تُشترَ أي ثيمات بعد."))}
                >
                  {d.rows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td className={`${td} whitespace-nowrap`}>{f.date(r.paid_on)}</td>
                      {/* the store gets the room it needs: a long name or owner ends in "…" (full on hover) instead of wrapping */}
                      <td className={`${td} min-w-[12rem] max-w-[18rem]`}>
                        <ShopAndOwner id={r.shop_id} shop={r.shop} owner={r.owner} truncate />
                      </td>
                      <td className={`${td} min-w-[10rem] font-medium`}>{themeLabel(t, r)}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{f.jod(r.amount)}</td>
                      <td className={td}>
                        <MethodBadge method={r.method} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>
                        {r.method ? t("Theme store checkout", "الدفع في متجر الثيمات") : t("Not recorded", "غير مسجّلة")}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <DataTable
                  head={[
                    t("Paid on", "تاريخ الدفع"),
                    t("Store", "المتجر"),
                    ...(tab === "" ? [t("What for", "البيان")] : []),
                    t("Amount", "المبلغ"),
                    t("Method", "الطريقة"),
                    t("Reference", "المرجع"),
                    t("Marked by", "سجّلها"),
                    t("Note", "ملاحظة"),
                  ]}
                  empty={!d.rows.length && (d.all.count ? t("No payments match.", "لا توجد مدفوعات مطابقة.") : t("No payments yet.", "لا توجد مدفوعات بعد."))}
                >
                  {d.rows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td className={`${td} whitespace-nowrap`}>{f.date(r.paid_on)}</td>
                      {/* the store gets the room it needs: a long name or owner ends in "…" (full on hover) instead of wrapping */}
                      <td className={`${td} min-w-[12rem] max-w-[18rem]`}>
                        <ShopAndOwner id={r.shop_id} shop={r.shop} owner={r.owner} truncate />
                      </td>
                      {tab === "" && <td className={td}>{whatFor(r)}</td>}
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{f.jod(r.amount)}</td>
                      <td className={td}>
                        <MethodBadge method={r.method} />
                      </td>
                      <td className={`${td} whitespace-nowrap`} dir="ltr">
                        {r.reference || "—"}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{r.marked_by ?? (r.kind === "theme" ? t("Theme store", "متجر الثيمات") : "—")}</td>
                      <td className={`${td} min-w-[10rem] max-w-[18rem] break-words`} dir="auto">{r.note || "—"}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
              <LoadMore s={s} total={d.count} />
            </section>
          </div>
        )}
      </Loaded>
    </>
  );
}
