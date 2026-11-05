"use client";

import Link from "next/link";
import { StatusBadge, storeLink } from "@/components/diwan/shopBits";
import { card, DataTable, Loaded, PageHead, Stat, td, useApi, useFmt, useT } from "@/components/diwan/ui";

type Overview = {
  total: number;
  newWeek: number;
  active: number;
  inactive: number;
  suspended: number;
  paying: number;
  expiring: number;
  expiringTrials: number;
  waiting: { tickets: number; domains: number; reports: number; documents: number };
  newest: { id: string; name: string; slug: string | null; owner: string; created_at: string; setup_done: number; status: string }[];
};

/* Diwan's first page: the shops at a glance and what waits for staff elsewhere. Everything comes live from the database. */
export default function OverviewPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Overview>("/api/diwan/overview");

  return (
    <>
      <PageHead title={t("Overview", "نظرة عامة")} sub={t("Live numbers from every Dukkan store.", "أرقام مباشرة من كل متاجر دكّان.")} />
      <Loaded s={s}>
        {(d) => (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label={t("Stores", "المتاجر")} value={f.num(d.total)} hint={d.suspended ? t(`${d.suspended} suspended`, `${d.suspended} موقوف`) : undefined} />
              <Stat label={t("New sign-ups this week", "تسجيلات جديدة هذا الأسبوع")} value={f.num(d.newWeek)} hint={t("Last 7 days", "آخر 7 أيام")} />
              <Stat
                label={t("Active / inactive", "نشط / غير نشط")}
                value={`${f.num(d.active)} / ${f.num(d.inactive)}`}
                hint={t("Active: the merchant was here in the last 14 days", "نشط: دخل التاجر خلال آخر 14 يومًا")}
              />
              <Stat label={t("Paying merchants", "التجار الدافعون")} value={f.num(d.paying)} hint={t("On a paid plan now", "على باقة مدفوعة الآن")} />
              <Stat
                label={t("Ending in 14 days", "تنتهي خلال 14 يومًا")}
                value={f.num(d.expiring)}
                hint={t(`${d.expiringTrials} of them trials`, `منها ${d.expiringTrials} تجريبية`)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { href: "/diwan/tickets", n: d.waiting.tickets, label: t("Open tickets", "تذاكر مفتوحة") },
                { href: "/diwan/domains", n: d.waiting.domains, label: t("Domains awaiting setup", "نطاقات بانتظار الإعداد") },
                { href: "/diwan/complaints", n: d.waiting.reports, label: t("New store reports", "بلاغات متاجر جديدة") },
                { href: "/diwan/documents", n: d.waiting.documents, label: t("Documents waiting", "مستندات بانتظار المراجعة") },
              ].map((x) => (
                <Link key={x.href} href={x.href} className={`${card} block transition hover:ring-primary/40`}>
                  <p className="text-sm text-muted">{x.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${x.n ? "text-primary" : ""}`}>{f.num(x.n)}</p>
                </Link>
              ))}
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">{t("Newest shops", "أحدث المتاجر")}</h2>
                <Link href="/diwan/shops" className="text-sm font-semibold text-primary hover:underline">
                  {t("All shops", "كل المتاجر")}
                </Link>
              </div>
              <DataTable
                head={[t("Store", "المتجر"), t("Owner", "المالك"), t("Status", "الحالة"), t("Setup", "الإعداد"), t("Signed up", "التسجيل")]}
                empty={!d.newest.length && t("No shops have signed up yet.", "لم يسجّل أي متجر بعد.")}
              >
                {d.newest.map((r) => (
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
                    <td className={td}>{r.owner}</td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={`${td} tabular-nums`}>{r.setup_done}/6</td>
                    <td className={td}>{f.date(r.created_at)}</td>
                  </tr>
                ))}
              </DataTable>
            </section>
          </div>
        )}
      </Loaded>
    </>
  );
}
