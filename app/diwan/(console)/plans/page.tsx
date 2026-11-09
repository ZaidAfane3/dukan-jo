"use client";

import Link from "next/link";
import { useState } from "react";
import { METHODS, methodText, planName, Select, todayJo } from "@/components/diwan/shopBits";
import { Badge, Btn, card, DataTable, downloadCsv, field, Loaded, PageHead, send, td, useApi, useFmt, useT } from "@/components/diwan/ui";
import { FilterBar } from "@/components/diwan/Filters";

type Plan = {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  price_month: string;
  price_year: string;
  max_products: number | null;
  custom_domain: boolean;
  max_staff: number | null;
  active: boolean;
  current: number;
  ever: number;
};
type Sub = {
  id: string;
  shop_id: string;
  shop: string | null;
  slug: string | null;
  owner: string;
  email: string;
  name_en: string;
  name_ar: string;
  plan_key: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  set_by: string | null;
  note: string | null;
};
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

type Tab = "plans" | "subs" | "payments";

/* Plans and what shops pay: the plans on offer, subscriptions ending soon or ended, and payments received. */
export default function PlansPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("plans");
  const tabs: [Tab, string][] = [
    ["plans", t("Plans", "الباقات")],
    ["subs", t("Subscriptions", "الاشتراكات")],
    ["payments", t("Payments", "المدفوعات")],
  ];
  return (
    <>
      <PageHead title={t("Plans and payments", "الباقات والمدفوعات")} />
      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-card p-1 ring-1 ring-fg/10 sm:inline-flex">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-primary text-white" : "hover:bg-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "plans" ? <Plans /> : tab === "subs" ? <Subscriptions /> : <Payments />}
    </>
  );
}

/* ---------------- plans ---------------- */

const blank = { nameEn: "", nameAr: "", priceMonth: "0", priceYear: "0", maxProducts: "", customDomain: true, maxStaff: "", active: true };

function Plans() {
  const t = useT();
  const f = useFmt();
  const s = useApi<{ plans: Plan[] }>("/api/diwan/plans");
  const [editing, setEditing] = useState<{ id: string | null; v: typeof blank } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    const v = editing.v;
    const body = { ...v, maxProducts: v.maxProducts === "" ? null : Number(v.maxProducts), maxStaff: v.maxStaff === "" ? null : Number(v.maxStaff) };
    const r = editing.id ? await send(`/api/diwan/plans/${editing.id}`, "PATCH", body) : await send("/api/diwan/plans", "POST", body);
    setBusy(false);
    if (!r.ok)
      return setError(
        r.data?.result === "trial-stays"
          ? t("The trial plan stays on offer: every new store starts on it.", "تبقى الباقة التجريبية متاحة: كل متجر جديد يبدأ بها.")
          : t("Check the fields: both names, prices in JOD, limits as whole numbers or empty.", "تحقق من الحقول: الاسمان، والأسعار بالدينار، والحدود أرقام صحيحة أو فارغة."),
      );
    setEditing(null);
    s.reload();
  };

  const remove = async (p: Plan) => {
    if (!confirm(t(`Delete the plan "${p.name_en}"?`, `حذف الباقة "${p.name_ar}"؟`))) return;
    const r = await send(`/api/diwan/plans/${p.id}`, "DELETE");
    if (!r.ok) alert(t("This plan has subscriptions, so it can't be deleted. Switch it off instead.", "لهذه الباقة اشتراكات فلا يمكن حذفها. أوقفها بدلًا من ذلك."));
    s.reload();
  };

  const set = (k: keyof typeof blank) => (v: string | boolean) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: v } } : e));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Btn onClick={() => (setEditing({ id: null, v: { ...blank } }), setError(""))}>{t("New plan", "باقة جديدة")}</Btn>
      </div>

      {editing && (
        <section className={`${card} space-y-4 ring-2 ring-primary/30`}>
          <h2 className="text-lg font-bold">{editing.id ? t("Edit plan", "تعديل الباقة") : t("New plan", "باقة جديدة")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label={t("Name (English) *", "الاسم (إنجليزي) *")}>
              <input dir="ltr" maxLength={40} value={editing.v.nameEn} onChange={(e) => set("nameEn")(e.target.value)} className={field} />
            </Labeled>
            <Labeled label={t("Name (Arabic) *", "الاسم (عربي) *")}>
              <input dir="rtl" maxLength={40} value={editing.v.nameAr} onChange={(e) => set("nameAr")(e.target.value)} className={field} />
            </Labeled>
            <Labeled label={t("Monthly price (JOD)", "السعر الشهري (د.أ)")}>
              <input inputMode="decimal" dir="ltr" value={editing.v.priceMonth} onChange={(e) => set("priceMonth")(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
            </Labeled>
            <Labeled label={t("Yearly price (JOD)", "السعر السنوي (د.أ)")}>
              <input inputMode="decimal" dir="ltr" value={editing.v.priceYear} onChange={(e) => set("priceYear")(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
            </Labeled>
            <Labeled label={t("Most products (empty: no limit)", "أقصى عدد منتجات (فارغ: بلا حد)")}>
              <input type="number" min={0} value={editing.v.maxProducts} onChange={(e) => set("maxProducts")(e.target.value)} className={field} />
            </Labeled>
            <Labeled label={t("Most staff (empty: no limit)", "أقصى عدد موظفين (فارغ: بلا حد)")}>
              <input type="number" min={0} value={editing.v.maxStaff} onChange={(e) => set("maxStaff")(e.target.value)} className={field} />
            </Labeled>
            <label className="flex items-center gap-2 text-sm sm:mt-6">
              <input type="checkbox" checked={editing.v.customDomain} onChange={(e) => set("customDomain")(e.target.checked)} />
              {t("Own domain allowed", "يسمح بنطاق خاص")}
            </label>
            <label className="flex items-center gap-2 text-sm sm:mt-6">
              <input type="checkbox" checked={editing.v.active} onChange={(e) => set("active")(e.target.checked)} />
              {t("On offer (can be given to stores)", "متاحة (يمكن منحها للمتاجر)")}
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Btn disabled={busy} onClick={save}>
              {t("Save", "حفظ")}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)}>
              {t("Cancel", "إلغاء")}
            </Btn>
          </div>
        </section>
      )}

      <Loaded s={s}>
        {(d) => (
          <DataTable
            head={[t("Plan", "الباقة"), t("Monthly", "شهريًا"), t("Yearly", "سنويًا"), t("Products", "المنتجات"), t("Own domain", "نطاق خاص"), t("Staff", "الموظفون"), t("Stores now", "متاجر حاليًا"), t("Status", "الحالة"), ""]}
            empty={!d.plans.length && t("No plans yet.", "لا توجد باقات بعد.")}
          >
            {d.plans.map((p) => (
              <tr key={p.id}>
                <td className={td}>
                  <p className="font-semibold">{planName(t, p)}</p>
                  <p dir="ltr" className="text-xs text-muted">
                    {p.key}
                  </p>
                </td>
                <td className={`${td} tabular-nums`}>{f.jod(p.price_month)}</td>
                <td className={`${td} tabular-nums`}>{f.jod(p.price_year)}</td>
                <td className={td}>{p.max_products ?? t("No limit", "بلا حد")}</td>
                <td className={td}>{p.custom_domain ? t("Yes", "نعم") : t("No", "لا")}</td>
                <td className={td}>{p.max_staff ?? t("No limit", "بلا حد")}</td>
                <td className={`${td} tabular-nums`}>{f.num(p.current)}</td>
                <td className={td}>{p.active ? <Badge tone="green">{t("On offer", "متاحة")}</Badge> : <Badge>{t("Off", "موقوفة")}</Badge>}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <button
                    className="me-3 text-sm font-semibold text-primary hover:underline"
                    onClick={() => {
                      setError("");
                      setEditing({
                        id: p.id,
                        v: {
                          nameEn: p.name_en,
                          nameAr: p.name_ar,
                          priceMonth: String(Number(p.price_month)),
                          priceYear: String(Number(p.price_year)),
                          maxProducts: p.max_products == null ? "" : String(p.max_products),
                          customDomain: p.custom_domain,
                          maxStaff: p.max_staff == null ? "" : String(p.max_staff),
                          active: p.active,
                        },
                      });
                    }}
                  >
                    {t("Edit", "تعديل")}
                  </button>
                  {p.key !== "trial" && p.ever === 0 && (
                    <button className="text-sm font-semibold text-red-600 hover:underline" onClick={() => remove(p)}>
                      {t("Delete", "حذف")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Loaded>
      <p className="text-xs text-muted">
        {t("A plan that stores have had can't be deleted: switch it off instead.", "لا يمكن حذف باقة اشتركت بها متاجر: أوقفها بدلًا من ذلك.")}
      </p>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- subscriptions ---------------- */

async function fetchRows<T>(url: string): Promise<T[] | null> {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const j = await r.json().catch(() => null);
  return r.ok && j?.rows ? (j.rows as T[]) : null;
}

function Subscriptions() {
  const t = useT();
  const f = useFmt();
  const [view, setView] = useState("ending");
  const [days, setDays] = useState("14");
  const q = `view=${view}&days=${days}`;
  const s = useApi<{ rows: Sub[] }>(`/api/diwan/subscriptions?${q}`);

  const exportCsv = async () => {
    const rows = await fetchRows<Sub>(`/api/diwan/subscriptions?${q}&export=1`);
    if (!rows) return;
    downloadCsv(`dukkan-subscriptions-${view}-${todayJo()}.csv`, [
      ["id", "store id", "store", "owner", "email", "plan", "status", "starts", "ends", "set by", "note"],
      ...rows.map((r) => [r.id, r.shop_id, r.shop ?? "", r.owner, r.email, r.name_en, r.status, r.starts_at, r.ends_at ?? "", r.set_by ?? "", r.note ?? ""]),
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          label={t("Show", "عرض")}
          value={view}
          onChange={setView}
          options={[
            { value: "ending", label: t("Ending soon", "تنتهي قريبًا") },
            { value: "expired", label: t("Expired (no current plan)", "منتهية (بلا باقة حالية)") },
            { value: "all", label: t("All subscriptions", "كل الاشتراكات") },
          ]}
        />
        {view === "ending" && (
          <Select
            label={t("Within", "خلال")}
            value={days}
            onChange={setDays}
            options={["7", "14", "30", "60"].map((n) => ({ value: n, label: t(`Next ${n} days`, `خلال ${n} يومًا`) }))}
          />
        )}
        <Btn kind="ghost" className="ms-auto" onClick={exportCsv}>
          {t("Export CSV", "تصدير CSV")}
        </Btn>
      </div>
      <Loaded s={s}>
        {(d) => (
          <DataTable
            head={[t("Store", "المتجر"), t("Owner", "المالك"), t("Plan", "الباقة"), t("Status", "الحالة"), t("From", "من"), t("Until", "حتى"), t("Set by", "بواسطة")]}
            empty={
              !d.rows.length &&
              (view === "ending"
                ? t("Nothing ends in this period.", "لا شيء ينتهي في هذه الفترة.")
                : view === "expired"
                  ? t("No store is without a plan.", "لا يوجد متجر بلا باقة.")
                  : t("No subscriptions yet.", "لا توجد اشتراكات بعد."))
            }
          >
            {d.rows.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/diwan/shops/${r.shop_id}`} className="font-semibold text-primary hover:underline">
                    {r.shop || t("(no name yet)", "(بلا اسم بعد)")}
                  </Link>
                </td>
                <td className={td}>
                  <p>{r.owner}</p>
                  <p dir="ltr" className="text-xs text-muted">
                    {r.email}
                  </p>
                </td>
                <td className={td}>{planName(t, r)}</td>
                <td className={td}>{r.status}</td>
                <td className={td}>{f.date(r.starts_at)}</td>
                <td className={td}>{f.date(r.ends_at)}</td>
                <td className={td}>{r.set_by ?? t("Sign-up", "التسجيل")}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Loaded>
    </div>
  );
}

/* ---------------- payments ---------------- */

function Payments() {
  const t = useT();
  const f = useFmt();
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...(method ? { method } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const s = useApi<{ rows: Pay[]; count: number; total: string; page: number; pages: number }>(`/api/diwan/payments?${params}&page=${page}`);

  const exportCsv = async () => {
    const rows = await fetchRows<Pay>(`/api/diwan/payments?${params}&export=1`);
    if (!rows) return;
    downloadCsv(`dukkan-payments-${todayJo()}.csv`, [
      ["id", "store id", "store", "owner", "email", "paid on", "amount JOD", "method", "reference", "marked by", "note"],
      ...rows.map((r) => [r.id, r.shop_id, r.shop ?? "", r.owner, r.email, String(r.paid_on).slice(0, 10), r.amount, r.method, r.reference, r.marked_by ?? "", r.note]),
    ]);
  };

  return (
    <div className="space-y-4">
      <FilterBar
        className=""
        count={(method ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0)}
        onClear={() => { setMethod(""); setFrom(""); setTo(""); setPage(1); }}
        search={<input type="search" maxLength={100} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder={t("Store, reference, or the full email or mobile", "المتجر أو المرجع، أو البريد أو الهاتف كاملًا")} aria-label={t("Search payments", "البحث في المدفوعات")} className={field} />}
      >
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          label={t("Method", "الطريقة")}
          value={method}
          onChange={(v) => (setMethod(v), setPage(1))}
          options={[{ value: "", label: t("Every method", "كل الطرق") }, ...METHODS.map((m) => ({ value: m, label: methodText(t, m) }))]}
        />
        <input type="date" aria-label={t("From", "من")} value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className={field} />
        <input type="date" aria-label={t("To", "إلى")} value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className={field} />
      </div>
      </FilterBar>
      <Loaded s={s}>
        {(d) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {t(`${d.count} payments`, `${d.count} دفعة`)} · {t("total", "المجموع")} <b className="text-fg">{f.jod(d.total)}</b>
              </p>
              <Btn kind="ghost" onClick={exportCsv} disabled={!d.count}>
                {t("Export CSV", "تصدير CSV")}
              </Btn>
            </div>
            <DataTable
              head={[t("Paid on", "تاريخ الدفع"), t("Store", "المتجر"), t("Amount", "المبلغ"), t("Method", "الطريقة"), t("Reference", "المرجع"), t("Marked by", "سجّلها"), t("Note", "ملاحظة")]}
              empty={!d.rows.length && t("No payments match.", "لا توجد مدفوعات مطابقة.")}
            >
              {d.rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{f.date(r.paid_on)}</td>
                  <td className={td}>
                    <Link href={`/diwan/shops/${r.shop_id}`} className="font-semibold text-primary hover:underline">
                      {r.shop || r.owner}
                    </Link>
                  </td>
                  <td className={`${td} tabular-nums`}>{f.jod(r.amount)}</td>
                  <td className={td}>{methodText(t, r.method)}</td>
                  <td className={td} dir="ltr">
                    {r.reference}
                  </td>
                  <td className={td}>{r.marked_by ?? "—"}</td>
                  <td className={td}>{r.note}</td>
                </tr>
              ))}
            </DataTable>
            {d.pages > 1 && (
              <div className="flex items-center justify-center gap-3 text-sm">
                <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("Previous", "السابق")}
                </Btn>
                <span className="tabular-nums text-muted">
                  {d.page} / {d.pages}
                </span>
                <Btn kind="ghost" disabled={page >= d.pages} onClick={() => setPage((p) => p + 1)}>
                  {t("Next", "التالي")}
                </Btn>
              </div>
            )}
          </>
        )}
      </Loaded>
    </div>
  );
}
