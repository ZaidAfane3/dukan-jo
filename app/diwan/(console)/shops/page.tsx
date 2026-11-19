"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Select, StatusBadge, statusOptions, statusText, storeLink, storeLinkHref } from "@/components/diwan/shopBits";
import { Btn, DataTable, downloadCsv, field, Loaded, PageHead, send, tdDense as td, LoadMore, useFmt, useMore, useT } from "@/components/diwan/ui";
import { tell } from "@/components/diwan/dialogs";
import { askOwnPassword, passwordAgainWords } from "@/components/diwan/passwordAgain";
import { ShopsSkeleton } from "@/components/diwan/skeletons";
import { FilterBar } from "@/components/diwan/Filters";
import { oneOf, typedText, useListScroll, useListState } from "@/components/diwan/useListState";

type Row = {
  id: string;
  name: string;
  slug: string | null;
  owner: string;
  email: string;
  phone: string;
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
type List = { rows: Row[]; total: number; page: number; pages: number; canExport: boolean };

const FILTERS = ["status", "setup", "published", "ship", "sort"] as const;
/* a link or email in the table: one line, cut with "…" past a set width */
const clip = "block max-w-[8.5rem] truncate text-xs text-muted rtl:text-end";
type Filters = Record<(typeof FILTERS)[number], string>;
/* the search, filters and sort, kept in the address so Back from a store brings the list back as it was */
const LIST = {
  q: typedText(100),
  status: oneOf(["", "open", "paused", "suspended"]),
  setup: oneOf(["", "done", "partial", "none"]),
  published: oneOf(["", "yes", "no"]),
  ship: oneOf(["", "yes", "no"]),
  sort: oneOf(["newest", "seen", "name", "products", "orders", "sales"]),
};

/* Every shop, searched and filtered by the server. A row opens the shop. */
export default function ShopsPage() {
  const t = useT();
  const f = useFmt();
  const [list, setList] = useListState(LIST);
  const typed = list.q;
  const setTyped = (q: string) => setList({ q });
  const [q, setQ] = useState(typed.trim());
  const filters: Filters = { status: list.status, setup: list.setup, published: list.published, ship: list.ship, sort: list.sort };
  const [exporting, setExporting] = useState(false);

  /* the search runs a moment after typing stops */
  useEffect(() => {
    const h = setTimeout(() => {
      setQ(typed.trim());
    }, 350);
    return () => clearTimeout(h);
  }, [typed]);

  const params = new URLSearchParams({ ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const s = useMore<List>(`/api/diwan/shops?${params}`, (d, n) => (n < d.pages ? `page=${n + 1}` : null));
  useListScroll(s);
  const setFilter = (k: keyof Filters) => (v: string) => setList({ [k]: v });

  /* the file holds every merchant's contacts: the staff member's own password first (server/staffConfirm.ts passwordAgain) */
  const exportCsv = async () => {
    const myPassword = await askOwnPassword(t, {
      title: t("Export the store list", "تصدير قائمة المتاجر"),
      body: t("The file holds the merchants' names, emails and mobiles. Type your own password to confirm.", "يحوي الملف أسماء التجار وبريدهم وجوالاتهم. اكتب كلمة مرورك للتأكيد."),
      confirm: t("Export", "تصدير"),
    });
    if (myPassword === null) return;
    setExporting(true);
    const r = await send(`/api/diwan/shops/export?${params}`, "POST", { myPassword });
    const j = r.data;
    setExporting(false);
    if (!r.ok || !j?.rows) {
      if (r.status !== 401) await tell({ title: t("Not exported", "لم يتم التصدير"), body: passwordAgainWords(t, j) ?? t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.") });
      return;
    }
    downloadCsv(`dukkan-stores-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["id", "store", "link", "owner", "email", "phone", "status", "setup", "published", "dukkan ship", "products", "orders", "total sales JOD", "last seen", "signed up"],
      ...(j.rows as Row[]).map((r) => [
        r.id,
        r.name,
        storeLink(r.slug),
        r.owner,
        r.email,
        r.phone,
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
        title={t("Stores", "المتاجر")}
        sub={s.data ? f.count(s.data.total, ["store matches", "stores match"], { one: "متجر واحد مطابق", two: "متجران مطابقان", few: "متاجر مطابقة", many: "متجرًا مطابقًا" }) : undefined}
        actions={
          s.data?.canExport ? (
            <Btn kind="ghost" onClick={exportCsv} disabled={exporting || !s.data.total}>
              {exporting ? t("Preparing…", "جارٍ التجهيز…") : t("Export CSV", "تصدير CSV")}
            </Btn>
          ) : undefined
        }
      />

      <FilterBar
        className="mb-4"
        count={(["status", "setup", "published", "ship"] as const).filter((k) => filters[k]).length}
        onClear={() => {
          setList({ status: "", setup: "", published: "", ship: "" });
        }}
        search={
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={100}
            placeholder={t("Store name or link, owner's name, or the full email or mobile", "اسم المتجر أو رابطه، اسم المالك، أو البريد أو الجوال كاملًا")}
            aria-label={t("Search stores", "البحث في المتاجر")}
            className={field}
          />
        }
      >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Select label={t("Status", "الحالة")} value={filters.status} onChange={setFilter("status")} options={[{ value: "", label: `${t("Status", "الحالة")}: ${all}` }, ...statusOptions(t)]} />
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
      </FilterBar>
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

      <Loaded s={s} skeleton={<ShopsSkeleton />}>
        {(d) => (
          <>
            {/* seven columns with narrow padding, so the whole table fits its card from 1280 wide: the setup steps sit
                under the status, and the two dates share one column. Sideways scrolling is left only for small screens. */}
            <DataTable
              dense
              head={[
                t("Store", "المتجر"),
                t("Owner", "المالك"),
                t("Status", "الحالة"),
                t("Products", "المنتجات"),
                t("Orders", "الطلبات"),
                t("Total sales", "إجمالي المبيعات"),
                t("Dates", "التواريخ"),
              ]}
              empty={
                !d.rows.length &&
                (q || Object.entries(filters).some(([k, v]) => k !== "sort" && v)
                  ? q
                    ? t(
                        "No stores found. You can search by store name, link, the owner's name (full words), the full email, or the full mobile number.",
                        "لا توجد متاجر. يمكنك البحث باسم المتجر أو الرابط أو اسم المالك (كلمات كاملة) أو البريد الإلكتروني كاملًا أو رقم الجوال كاملًا.",
                      )
                    : t("No stores match these filters.", "لا توجد متاجر مطابقة لهذه الفلاتر.")
                  : t("No stores have signed up yet.", "لم يسجّل أي متجر بعد."))
              }
            >
              {d.rows.map((r) => (
                <tr key={r.id} className="hover:bg-soft/50">
                  {/* the store's name and under it its link, in one column so the whole table fits its card at 1440 wide.
                      The link shows only what tells stores apart (/its-link-name; Dukkan's address is the same for all, and
                      the whole address is in its tooltip). A long one, or a long email, is cut short with "…" on one line,
                      never broken mid-word; in Arabic it is still written left to right, lined up with the name above it. */}
                  <td className={td}>
                    <Link href={`/diwan/shops/${r.id}`} title={r.name || undefined} dir="auto" className="block max-w-[11rem] truncate font-semibold text-primary hover:underline ltr:text-left rtl:text-right">
                      {r.name || t("(no name yet)", "(بلا اسم بعد)")}
                    </Link>
                    {r.slug && (
                      /* every store lives at Dukkan's address followed by its link name: it opens in a new tab */
                      <a
                        href={storeLinkHref(r.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        title={storeLink(r.slug)}
                        className={`mt-0.5 ${clip} hover:text-primary hover:underline`}
                      >
                        /{r.slug}
                      </a>
                    )}
                  </td>
                  <td className={td}>
                    <p title={r.owner} dir="auto" className="max-w-[8.5rem] truncate ltr:text-left rtl:text-right">{r.owner}</p>
                    <p dir="ltr" title={r.email} className={clip}>
                      {r.email}
                    </p>
                    <p dir="ltr" className="whitespace-nowrap text-xs text-muted rtl:text-end">
                      {r.phone}
                    </p>
                  </td>
                  <td className={td} title={statusText(t, r.status)}>
                    <StatusBadge status={r.status} compact />
                    <p className="mt-1 whitespace-nowrap text-xs text-muted">
                      {t("Setup", "الإعداد")} <span dir="ltr" className="tabular-nums">{r.setup_done}/6</span>
                    </p>
                  </td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{f.num(r.product_count)}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{f.num(r.order_count)}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{f.jod(r.total_sales)}</td>
                  <td className={`${td} whitespace-nowrap text-xs`}>
                    <p>
                      <span className="text-muted">{t("Seen", "ظهر")}</span> {f.ago(r.last_seen_at)}
                    </p>
                    <p className="mt-0.5">
                      <span className="text-muted">{t("Joined", "سجّل")}</span> {f.date(r.created_at)}
                    </p>
                  </td>
                </tr>
              ))}
            </DataTable>
            <LoadMore s={s} total={d.total} />
          </>
        )}
      </Loaded>
    </>
  );
}
