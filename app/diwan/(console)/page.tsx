"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateLocale } from "@/components/content";
import { ArchWindow, Icon, iconForPath } from "@/components/diwan/icons";
import { DIWAN_NAV } from "@/components/diwan/nav";
import { can } from "@/components/diwan/perms";
import { StatusBadge, storeLink } from "@/components/diwan/shopBits";
import { ATTENTION, card, DataTable, Figures, Loaded, PageHead, tdDense, useApi, useFmt, useStaff, useT } from "@/components/diwan/ui";
import { HomeSkeleton } from "@/components/diwan/skeletons";
import { usePrefs } from "@/components/Prefs";

type Overview = {
  total: number;
  newWeek: number;
  active: number;
  inactive: number;
  suspended: number;
  published: number;
  waiting: { tickets: number; reports: number; documents: number };
  newest: { id: string; name: string; slug: string | null; owner: string; created_at: string; setup_done: number; status: string }[];
};

const RUQAA = { fontFamily: "var(--font-ruqaa), var(--font-sans)" };

/* Diwan's first page: a welcome, the shops in figures and what waits for the team. Everything comes live from the database
   (counts and totals only: Diwan never looks at a merchant's products, orders or customers). */
export default function OverviewPage() {
  const staff = useStaff();
  /* a staff member who can't see shops (the Marketing role) gets the marketing home instead of the shops' figures */
  if (staff && !can(staff, "shops.read")) return <PortalHome />;
  return <ShopsOverview />;
}

function ShopsOverview() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Overview>("/api/diwan/overview");

  return (
    <>
      <Welcome />
      <Loaded s={s} skeleton={<HomeSkeleton />}>
        {(d) => {
          const waiting = [
            { href: "/diwan/tickets", n: d.waiting.tickets, one: t("open ticket", "تذكرة مفتوحة"), many: t("open tickets", "تذاكر مفتوحة") },
            { href: "/diwan/complaints", n: d.waiting.reports, one: t("new store report", "بلاغ متجر جديد"), many: t("new store reports", "بلاغات متاجر جديدة") },
            { href: "/diwan/documents", n: d.waiting.documents, one: t("document to check", "مستند بانتظار المراجعة"), many: t("documents to check", "مستندات بانتظار المراجعة") },
          ].filter((w) => w.n > 0);
          return (
            <div className="space-y-12">
              <section aria-label={t("Stores in figures", "المتاجر بالأرقام")}>
                <Figures
                  items={[
                    {
                      label: t("Stores", "المتاجر"),
                      value: f.num(d.total),
                      note: d.suspended ? t(`${f.num(d.suspended)} suspended`, `${f.num(d.suspended)} موقوف`) : t("none suspended", "لا متجر موقوف"),
                      /* how many can be visited: every store but the suspended ones (the Active box says who came in lately) */
                      extra: <Share part={d.total - d.suspended} whole={d.total} label={t(`${f.num(d.total - d.suspended)} not suspended`, `${f.num(d.total - d.suspended)} غير موقوف`)} />,
                    },
                    { label: t("New this week", "جديدة هذا الأسبوع"), value: f.num(d.newWeek), note: t("signed up in the last 7 days", "سجّلت خلال آخر 7 أيام") },
                    { label: t("Active", "النشطة"), value: f.num(d.active), note: t(`owner came in during the last 14 days · ${f.num(d.inactive)} quiet`, `دخلها صاحبها خلال آخر 14 يومًا · ${f.num(d.inactive)} بلا دخول`) },
                    {
                      label: t("Published", "منشورة"),
                      value: f.num(d.published),
                      note: `${t("of", "من")} ${f.count(d.total, ["store", "stores"], { one: "متجر واحد", two: "متجرين", few: "متاجر", many: "متجرًا" })}`,
                      extra: <Share part={d.published} whole={d.total} />,
                    },
                  ]}
                />
              </section>

              <div className="grid gap-10 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                <section>
                  <h2 className="mb-3 text-lg font-extrabold tracking-tight">{t("Waiting for the team", "بانتظار الفريق")}</h2>
                  {waiting.length ? (
                    <ul className={`${card} divide-y divide-fg/[0.06] p-0`}>
                      {waiting.map((w) => (
                        <li key={w.href}>
                          <Link href={w.href} className="group flex items-baseline gap-3 px-5 py-4 transition-colors hover:bg-fg/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                            <span className={`min-w-[2ch] text-2xl font-extrabold tabular-nums ${ATTENTION}`}>{f.num(w.n)}</span>
                            {/* after the number: one, else the plural; in Arabic 11 and more take the singular too («11 تذكرة مفتوحة») */}
                            <span className="text-[15px]">{w.n === 1 || (t("en", "ar") === "ar" && w.n % 100 >= 11) ? w.one : w.many}</span>
                            <span aria-hidden className="ms-auto text-fg/30 transition group-hover:translate-x-0.5 group-hover:text-primary rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 motion-reduce:transform-none">
                              →
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-fg/10 pt-4 text-[15px] text-muted">{t("Nothing waiting. Enjoy the calm.", "لا شيء ينتظر. استمتع بالهدوء.")}</p>
                  )}
                </section>

                <section className="min-w-0">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-extrabold tracking-tight">{t("Newest stores", "أحدث المتاجر")}</h2>
                    <Link href="/diwan/shops" className="text-sm font-semibold text-primary hover:underline">
                      {t("All stores", "كل المتاجر")}
                    </Link>
                  </div>
                  {/* dense and fitted to its column: the store and owner names truncate (in full in their tooltip), so
                      the table never scrolls sideways */}
                  <DataTable
                    dense
                    fit
                    head={[t("Store", "المتجر"), t("Owner", "المالك"), t("Status", "الحالة"), t("Setup", "الإعداد"), t("Signed up", "التسجيل")]}
                    empty={!d.newest.length && t("No stores have signed up yet.", "لم يسجّل أي متجر بعد.")}
                  >
                    {d.newest.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-fg/[0.025]">
                        {/* max-w-0 with a share of the width: the cell takes that share and truncates what is longer */}
                        <td className={`${tdDense} w-[45%] max-w-0`}>
                          <Link href={`/diwan/shops/${r.id}`} title={r.name || undefined} dir="auto" className="block truncate font-bold text-fg hover:text-primary hover:underline">
                            {r.name || t("(no name yet)", "(بلا اسم بعد)")}
                          </Link>
                          {r.slug && (
                            <p dir="ltr" title={storeLink(r.slug)} className="mt-0.5 truncate text-xs text-muted rtl:text-end">
                              {storeLink(r.slug)}
                            </p>
                          )}
                        </td>
                        <td className={`${tdDense} w-[25%] max-w-0 text-muted`}>
                          <span title={r.owner} dir="auto" className="block truncate">
                            {r.owner}
                          </span>
                        </td>
                        <td className={`${tdDense} whitespace-nowrap`}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className={`${tdDense} whitespace-nowrap`}>
                          <SetupMeter done={r.setup_done} />
                        </td>
                        <td className={`${tdDense} whitespace-nowrap text-muted`}>{f.date(r.created_at)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </section>
              </div>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

/* The marketing home: the welcome, then an index of the pages this staff member may open */
function PortalHome() {
  const t = useT();
  const staff = useStaff();
  const about: Record<string, { en: string; ar: string }> = {
    "/diwan/themes": { en: "Make, price and release themes in the theme store.", ar: "اصنع الثيمات وسعّرها وانشرها في متجر الثيمات." },
    "/diwan/pages": { en: "Guides and news merchants read in their dashboard.", ar: "أدلة وأخبار يقرؤها التجار في لوحة التحكم." },
    "/diwan/popups": { en: "Pop-ups merchants see once in their dashboard.", ar: "نوافذ يراها التجار مرة واحدة في لوحة التحكم." },
    "/diwan/announcements": { en: "Notices in the merchants' bell and banner.", ar: "إشعارات في جرس التجار وشريط الإعلانات." },
    "/diwan/marketplace": { en: "Outside developers and the work they send.", ar: "المطورون الخارجيون وما يرسلونه من أعمال." },
    "/diwan/flags": { en: "Turn features on or off, for everyone or some stores.", ar: "شغّل الميزات أو أوقفها للجميع أو لبعض المتاجر." },
    "/diwan/activity": { en: "Who changed what, and when.", ar: "من غيّر ماذا، ومتى." },
  };
  const list = staff ? DIWAN_NAV.filter((i) => i.href !== "/diwan" && can(staff, i.perm)) : [];
  return (
    <>
      <Welcome line={t("What Dukkan sends out to merchants, in one place. Pick up where you left off.", "كل ما ترسله دكّان إلى التجار، في مكان واحد. تابع من حيث توقفت.")} />
      <PageHead title={t("Marketing", "التسويق")} eyebrow={t("Your pages", "صفحاتك")} />
      <ul className={`${card} divide-y divide-fg/[0.06] p-0`}>
        {list.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-fg/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
              <Icon name={iconForPath(i.href)} className="h-5 w-5 shrink-0 text-fg/45 group-hover:text-primary" strokeWidth={1.6} />
              <span className="min-w-0">
                <span className="block font-bold">{t(i.en, i.ar)}</span>
                {about[i.href] && <span className="mt-0.5 block text-sm text-muted">{t(about[i.href].en, about[i.href].ar)}</span>}
              </span>
              <span aria-hidden className="ms-auto text-fg/30 transition group-hover:translate-x-0.5 group-hover:text-primary rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 motion-reduce:transform-none">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/* The welcome: good morning or evening by the clock of whoever is looking, and today's date, framed by one arch, the
   window of the diwan. It is a short, quiet strip: a soft warm tint with orange only for the name and the arch, so the
   page's figures stay the first thing to read. In English the Arabic greeting sits on the far side, in Ruq'ah. */
function Welcome({ line }: { line?: string }) {
  const t = useT();
  const { lang } = usePrefs();
  const staff = useStaff();
  /* the hour is read in the browser only (the server does not know the staff member's clock) */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const h = now?.getHours() ?? 9;
  const morning = h >= 5 && h < 12;
  const greetEn = morning ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
  const greetAr = morning ? "صباح الخير" : "مساء الخير";
  const first = (staff?.name ?? "").split(/\s+/)[0];
  const today = now ? now.toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" }) : " ";
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-soft/60 ring-1 ring-primary/15 dark:bg-soft/50">
      {/* the window: one small arch on the far side, faint */}
      <ArchWindow className="pointer-events-none absolute bottom-0 end-4 h-[130%] w-auto text-primary opacity-30 sm:end-6" />
      <div className="relative flex items-center gap-6 px-5 py-4 sm:px-7 sm:py-5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-muted">{today}</p>
          <h1 className="mt-0.5 text-[20px] font-bold leading-snug tracking-tight sm:text-[22px]">
            {lang === "ar" ? greetAr : greetEn}
            {first && (
              <span className="text-primary">
                {lang === "ar" ? "، " : ", "}
                {first}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-fg/65">{line ?? t("Here is Dukkan today.", "هذه دكّان اليوم.")}</p>
        </div>
        {lang === "en" && (
          <p lang="ar" dir="rtl" className="relative hidden shrink-0 pe-28 text-[24px] leading-none text-primary/80 sm:block" style={RUQAA}>
            {greetAr}
          </p>
        )}
      </div>
    </div>
  );
}

/* How much of a whole a part is, as one thin orange line (no colour for the rest) */
function Share({ part, whole, label }: { part: number; whole: number; label?: string }) {
  if (!whole) return null;
  return (
    <div className="mt-3 max-w-[10rem]">
      <div className="h-[3px] overflow-hidden rounded-full bg-fg/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (part / whole) * 100)}%` }} />
      </div>
      {label && <p className="mt-1.5 text-xs text-muted">{label}</p>}
    </div>
  );
}

/* How far a new shop is with its 6 setup steps: six short strokes */
function SetupMeter({ done }: { done: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2" title={t(`${done} of 6 steps`, `${done} من 6 خطوات`)}>
      <span className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-3 w-[3px] rounded-full ${i < done ? "bg-primary" : "bg-fg/15"}`} />
        ))}
      </span>
      <span className="text-xs tabular-nums text-muted">{done}/6</span>
    </span>
  );
}
