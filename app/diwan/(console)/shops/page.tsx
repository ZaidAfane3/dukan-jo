"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { planName, Select, StatusBadge, statusOptions, statusText, storeLink } from "@/components/diwan/shopBits";
import { Btn, DataTable, downloadCsv, field, Loaded, PageHead, td, useApi, useFmt, useT } from "@/components/diwan/ui";

type Row = {
  id: string;
  name: string;
  slug: string | null;
  owner: string;
  email: string;
  phone: string;
  plan_en: string | null;
  plan_ar: string | null;
  ends_at: string | null;
  status: string;
  setup_done: number;
  published: boolean;
  paused: boolean;
  ship_mode: string;
  product_count: number;
  order_count: number;
  total_sales: string;
  last_seen_at: string | null;
  created_at: string;
};
type List = { rows: Row[]; total: number; page: number; pages: number; plans: { id: string; name_en: string; name_ar: string }[]; canExport: boolean };

const FILTERS = ["status", "plan", "setup", "published", "ship", "sort"] as const;
type Filters = Record<(typeof FILTERS)[number], string>;

/* Every shop, searched and filtered by the server. A row opens the shop. */
export default function ShopsPage() {
  const t = useT();
  const f = useFmt();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({ status: "", plan: "", setup: "", published: "", ship: "", sort: "newest" });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  /* the search runs a moment after typing stops */
  useEffect(() => {
    const h = setTimeout(() => {
      setQ(typed.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(h);
  }, [typed]);

  const params = new URLSearchParams({ ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const s = useApi<List>(`/api/diwan/shops?${params}&page=${page}`);
  const setFilter = (k: keyof Filters) => (v: string) => {
    setFilters((x) => ({ ...x, [k]: v }));
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    const r = await fetch(`/api/diwan/shops/export?${params}`, { credentials: "same-origin", cache: "no-store" });
    const j = await r.json().catch(() => null);
    setExporting(false);
    if (!r.ok || !j?.rows) return;
    downloadCsv(`dukkan-shops-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["id", "store", "link", "owner", "email", "phone", "plan", "plan ends", "status", "setup", "published", "dukkan ship", "products", "orders", "total sales JOD", "last seen", "signed up"],
      ...(j.rows as Row[]).map((r) => [
        r.id,
        r.name,
        storeLink(r.slug),
        r.owner,
        r.email,
        r.phone,
        r.plan_en ?? "",
        r.ends_at ? r.ends_at.slice(0, 10) : "",
        r.status,
        `${r.setup_done}/6`,
        r.published ? "yes" : "no",
        r.ship_mode === "seen" ? "yes" : "no",
        r.product_count,
        r.order_count,
        r.total_sales,
        r.last_seen_at ?? "",
        r.created_at,
      ]),
    ]);
  };

  const all = t("All", "الكل");
  return (
    <>
      <PageHead
        title={t("Shops", "المتاجر")}
        sub={s.data ? t(`${s.data.total} shops match`, `${s.data.total} متجرًا مطابقًا`) : undefined}
        actions={
          s.data?.canExport ? (
            <Btn kind="ghost" onClick={exportCsv} disabled={exporting || !s.data.total}>
              {exporting ? t("Preparing…", "جارٍ التجهيز…") : t("Export CSV", "تصدير CSV")}
            </Btn>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <input
          type="search"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          maxLength={100}
          placeholder={t("Store name or link, or the full email or mobile", "اسم المتجر أو رابطه، أو البريد أو الهاتف كاملًا")}
          aria-label={t("Search shops", "البحث في المتاجر")}
          className={`${field} sm:col-span-2 lg:col-span-4 xl:col-span-2`}
        />
        <Select label={t("Status", "الحالة")} value={filters.status} onChange={setFilter("status")} options={[{ value: "", label: `${t("Status", "الحالة")}: ${all}` }, ...statusOptions(t)]} />
        <Select
          label={t("Plan", "الباقة")}
          value={filters.plan}
          onChange={setFilter("plan")}
          options={[{ value: "", label: `${t("Plan", "الباقة")}: ${all}` }, ...(s.data?.plans ?? []).map((p) => ({ value: String(p.id), label: planName(t, p) }))]}
        />
        <Select
          label={t("Setup", "الإعداد")}
          value={filters.setup}
          onChange={setFilter("setup")}
          options={[
            { value: "", label: `${t("Setup", "الإعداد")}: ${all}` },
            { value: "done", label: t("Setup finished (6/6)", "اكتمل الإعداد (6/6)") },
            { value: "partial", label: t("Setup started", "بدأ الإعداد") },
            { value: "none", label: t("Setup not started", "لم يبدأ الإعداد") },
          ]}
        />
        <Select
          label={t("Published", "منشور")}
          value={filters.published}
          onChange={setFilter("published")}
          options={[
            { value: "", label: `${t("Published", "النشر")}: ${all}` },
            { value: "yes", label: t("Published", "منشور") },
            { value: "no", label: t("Not published", "غير منشور") },
          ]}
        />
        <Select
          label={t("Dukkan Ship", "شحن دكّان")}
          value={filters.ship}
          onChange={setFilter("ship")}
          options={[
            { value: "", label: `${t("Dukkan Ship", "شحن دكّان")}: ${all}` },
            { value: "yes", label: t("Uses Dukkan Ship", "يستخدم شحن دكّان") },
            { value: "no", label: t("Own delivery", "توصيل خاص") },
          ]}
        />
      </div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-muted">{t("Sort by", "الترتيب حسب")}</span>
        <Select
          label={t("Sort by", "الترتيب حسب")}
          value={filters.sort}
          onChange={setFilter("sort")}
          options={[
            { value: "newest", label: t("Newest", "الأحدث") },
            { value: "seen", label: t("Last seen", "آخر ظهور") },
            { value: "name", label: t("Name", "الاسم") },
            { value: "products", label: t("Products", "المنتجات") },
            { value: "orders", label: t("Orders", "الطلبات") },
            { value: "sales", label: t("Total sales", "إجمالي المبيعات") },
          ]}
        />
      </div>

      <Loaded s={s}>
        {(d) => (
          <>
            <DataTable
              head={[
                t("Store", "المتجر"),
                t("Owner", "المالك"),
                t("Plan", "الباقة"),
                t("Status", "الحالة"),
                t("Setup", "الإعداد"),
                t("Products", "المنتجات"),
                t("Orders", "الطلبات"),
                t("Total sales", "إجمالي المبيعات"),
                t("Last seen", "آخر ظهور"),
                t("Signed up", "التسجيل"),
              ]}
              empty={
                !d.rows.length &&
                (q || Object.entries(filters).some(([k, v]) => k !== "sort" && v)
                  ? t("No shops match this search.", "لا توجد متاجر مطابقة للبحث.")
                  : t("No shops have signed up yet.", "لم يسجّل أي متجر بعد."))
              }
            >
              {d.rows.map((r) => (
                <tr key={r.id} className="hover:bg-soft/50">
                  <td className={td}>
                    <Link href={`/diwan/shops/${r.id}`} className="font-semibold text-primary hover:underline">
                      {r.name || t("(no name yet)", "(بلا اسم بعد)")}
                    </Link>
                    {r.slug && (
                      <p dir="ltr" className="text-xs text-muted">
                        {storeLink(r.slug)}
                      </p>
                    )}
                  </td>
                  <td className={td}>
                    <p>{r.owner}</p>
                    <p dir="ltr" className="text-xs text-muted">
                      {r.email}
                    </p>
                    <p dir="ltr" className="text-xs text-muted">
                      {r.phone}
                    </p>
                  </td>
                  <td className={td}>
                    <p>{r.plan_en ? planName(t, r) : "—"}</p>
                    {r.ends_at && <p className="text-xs text-muted">{t("ends", "تنتهي")} {f.date(r.ends_at)}</p>}
                  </td>
                  <td className={td} title={statusText(t, r.status)}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={`${td} tabular-nums`}>{r.setup_done}/6</td>
                  <td className={`${td} tabular-nums`}>{f.num(r.product_count)}</td>
                  <td className={`${td} tabular-nums`}>{f.num(r.order_count)}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{f.jod(r.total_sales)}</td>
                  <td className={`${td} whitespace-nowrap`}>{f.ago(r.last_seen_at)}</td>
                  <td className={`${td} whitespace-nowrap`}>{f.date(r.created_at)}</td>
                </tr>
              ))}
            </DataTable>
            {d.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
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
          </>
        )}
      </Loaded>
    </>
  );
}
