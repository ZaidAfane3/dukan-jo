"use client";

import Link from "next/link";
import { DemoStrip } from "./DemoBoot";
import { demoActive } from "./demoSandbox";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { Logo } from "./Nav";
import {
  NOTIFICATION_TAB,
  getNotifications,
  markAllRead,
  markRead,
  onNotificationsChange,
  pushNotification,
  type AppNotification,
} from "./notifications";
import { GlobalSearch } from "./GlobalSearch";
import { LangSwitch, usePrefs } from "./Prefs";
import { ordersCopy } from "./ordersContent";
import { ProfileMenu } from "./ProfileMenu";

type Section = "home" | "pages" | "domain" | "orders" | "products" | "marketing" | "reports" | "support" | "settings";

const ico = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const icons = {
  home: <svg {...ico}><path d="M4 11 12 4l8 7v9H4v-9ZM10 20v-6h4v6" /></svg>,
  orders: <svg {...ico}><path d="M3 4h2l2.4 11h11l2-8H6.2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01" /></svg>,
  products: <svg {...ico}><path d="M9 3h6l1 4-4 2-4-2 1-4ZM8 8c-1 4-2 8-3 13h14c-1-5-2-9-3-13" /></svg>,
  marketing: <svg {...ico}><path d="M4 10v4l12 5V5L4 10ZM8 15l1 5h3l-1-4M19 9v6" /></svg>,
  channels: <svg {...ico}><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></svg>,
  reports: <svg {...ico}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  apps: <svg {...ico}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><path d="M17 14v6M14 17h6" /></svg>,
  settings: <svg {...ico}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>,
  ticket: <svg {...ico}><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM20 14h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1ZM17 19a3 3 0 0 1-3 2h-2" /></svg>,
  bell: <svg {...ico}><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4l2-2ZM10 21a2 2 0 0 0 4 0" /></svg>,
  shield: <svg {...ico}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  language: <svg {...ico}><path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 7M12 6c-.5 3-3 6-7 7.5M13 20l4-9 4 9M14.4 17h5.2" /></svg>,
  doc: <svg {...ico}><path d="M6 3h9l4 4v14H6V3Z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>,
  receipt: <svg {...ico}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6" /></svg>,
  exportIcon: <svg {...ico}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>,
  menu: <svg {...ico}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  palette: <svg {...ico}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.6-.4-1 .2-2 1.3-2H17a4 4 0 0 0 4-4c0-5-4-10.4-9-10.4Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15.5" cy="7.5" r="1" /></svg>,
  chevron: <svg {...ico} className="h-4 w-4 shrink-0"><path d="m15 6-6 6 6 6" /></svg>,
};

/* ====================================================================
   Notifications: the bell and its panel
   ==================================================================== */

function NotificationBell() {
  const { lang } = usePrefs();
  const n = content[lang].notifications;
  const locale = dateLocale(lang);

  const [list, setList] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setList(getNotifications());
    /* A first visit gets one welcome message. */
    try {
      if (getNotifications().length === 0 && !sessionStorage.getItem("seen-welcomed")) {
        sessionStorage.setItem("seen-welcomed", "1");
        pushNotification("welcome");
      }
    } catch {
      /* ignore */
    }
    sync();
    return onNotificationsChange(sync);
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = list.filter((x) => !x.read).length;
  const shown = list.filter((x) => tab === 0 || NOTIFICATION_TAB[x.kind] === tab);

  const textOf = (item: AppNotification) => {
    let t = n.templates[item.kind].replace("{brand}", brandName(lang));
    if (item.kind === "taskDone") {
      t = t.replace("{task}", content[lang].onboarding.tasks[Number(item.params.task)]?.title ?? "");
    } else {
      for (const [k, v] of Object.entries(item.params)) t = t.replace(`{${k}}`, v);
    }
    return t;
  };

  const ago = (ts: number) => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const minutes = Math.max(1, Math.floor((Date.now() - ts) / 60000));
    if (minutes < 60) return rtf.format(-minutes, "minute");
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return rtf.format(-hours, "hour");
    return rtf.format(-Math.floor(hours / 24), "day");
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        data-nav-item
        aria-label={n.title}
        aria-expanded={open}
        title={n.title}
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-fg/15 text-fg transition hover:bg-soft"
      >
        {icons.bell}
        {unread > 0 && (
          <span className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label={n.title} className="absolute end-0 top-full z-50 mt-3 w-[26rem] max-w-[92vw] animate-[fadeIn_0.2s_ease] overflow-hidden rounded-2xl border border-fg/10 bg-card text-fg shadow-2xl">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <h2 className="text-lg font-bold">{n.title}</h2>
            <button type="button" onClick={markAllRead} disabled={unread === 0} className="text-xs font-semibold text-primary transition hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline">
              {n.markAll}
            </button>
          </div>

          <div role="tablist" className="mx-4 mt-4 flex gap-1 overflow-x-auto rounded-xl bg-soft p-1 text-sm font-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {n.tabs.map((label, i) => (
              <button key={label} role="tab" aria-selected={tab === i} type="button" onClick={() => setTab(i)} className={`shrink-0 rounded-lg px-4 py-2 transition ${tab === i ? "bg-card font-semibold shadow-sm" : "text-muted hover:text-fg"}`}>
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-3 max-h-72 divide-y divide-fg/10 overflow-y-auto">
            {shown.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => markRead(item.id)} className={`flex w-full items-center gap-3 px-5 py-4 text-start transition-colors hover:bg-soft/60 ${item.read ? "" : "bg-primary/5"}`}>
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-primary">
                    {icons.bell}
                    {!item.read && <span className="absolute -start-1 bottom-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${item.read ? "font-medium" : "font-bold"}`}>{textOf(item)}</span>
                    <span className="mt-1 block text-xs text-muted">{ago(item.ts)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted">{n.empty}</p>}

          <div className="border-t border-fg/10">
            <button type="button" onClick={() => setTab(0)} className="w-full py-3.5 text-center text-sm font-semibold text-primary transition hover:bg-soft/60">
              {n.viewAll}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   Sidebar + header
   ==================================================================== */

/**
 * The navigation shell shared by every dashboard page: a sidebar (on the
 * right in Arabic, on the left in English) with icons and expandable
 * Marketing and Reports menus, plus a header strip with the page tabs, the
 * support tickets icon, notifications, language and theme.
 * Only pages that exist are links, the rest are shown but inactive.
 */
export function DashboardBar({
  active,
  subtabs,
  activeSub,
  subHrefs,
  action,
}: {
  active: Section;
  subtabs: string[];
  activeSub: number;
  subHrefs?: (string | null)[];
  action?: React.ReactNode;
}) {
  const { lang } = usePrefs();
  const pathname = usePathname();
  /* The platform tour does not show the delivery options page */
  const [tour, setTour] = useState(false);
  useEffect(() => setTour(demoActive()), []);
  const nav = content[lang].onboarding.nav;
  /* Page tabs in the header that the sidebar already shows as menu items are left out, so nothing appears twice */
  const inSidebar = new Set<string>();
  const sb = content[lang].sidebar;
  const mk = content[lang].marketing.menu;
  const rp = content[lang].reports.menu;
  const support = content[lang].support;

  type Entry = {
    key: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    section?: Section;
    sub?: { label: string; href: string | null }[];
  };

  /* Entries without a link are not built yet. */
  const entries: Entry[] = [
    { key: "home", label: nav[1], icon: icons.home, href: "/dashboard", section: "home" },
    {
      key: "orders",
      label: nav[2],
      icon: icons.orders,
      section: "orders",
      sub: ordersCopy[lang].menu.map((label, i) => ({ label, href: ["/orders", "/orders/invoices"][i] })),
    },
    { key: "products", label: nav[3], icon: icons.products, href: "/products", section: "products" },
    {
      key: "marketing",
      label: nav[4],
      icon: icons.marketing,
      section: "marketing",
      sub: mk.map((label, i) => ({ label, href: ["/marketing/abandoned-carts", "/marketing/coupons", "/marketing/repurchase", "/marketing/free-delivery"][i] ?? null })),
    },
    {
      key: "store",
      label: lang === "ar" ? "المتجر" : "Store",
      icon: icons.channels,
      section: "domain",
      sub: [
        { label: lang === "ar" ? "تصميم المتجر" : "Store design", href: "/design" },
        { label: lang === "ar" ? "دومين المتجر" : "Store domain", href: "/domain" },
        ...(tour ? [] : [{ label: lang === "ar" ? "خيارات التوصيل" : "Delivery options", href: "/delivery" }]),
      ],
    },
    { key: "pages", label: lang === "ar" ? "الصفحات التعريفية" : "Info pages", icon: icons.doc, href: "/pages", section: "pages" },
    {
      key: "reports",
      label: nav[6],
      icon: icons.reports,
      section: "reports",
      sub: [{ label: rp[0], href: "/reports" }],
    },
  ];

  entries.filter((e) => e.section === active).forEach((e) => e.sub?.forEach((s) => inSidebar.add(s.label)));

  /* In settings, the sidebar lists the settings pages instead. Only Account settings exists so far. */
  const settingsIcons = [icons.settings, icons.bell];
  const settingsEntries: Entry[] = content[lang].settings.entries.map((label, i) => ({
    key: `settings-${i}`,
    label,
    icon: settingsIcons[i],
    href: i === 0 ? "/settings" : i === 1 && !tour ? "/settings/notifications" : undefined,
    section: i === 0 ? ("settings" as Section) : undefined,
  }));

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(active === "domain" ? "store" : active === "orders" || active === "marketing" || active === "reports" ? active : null);

  /* Remember whether the sidebar was collapsed. The page padding follows it through a CSS variable. */
  useEffect(() => {
    try {
      if (localStorage.getItem("seen-sidebar") === "collapsed") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.side = collapsed ? "collapsed" : "open";
    try {
      localStorage.setItem("seen-sidebar", collapsed ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const narrow = collapsed; /* icon-only on large screens */
  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors";

  return (
    <>
      {/* Sidebar */}
      <aside
        aria-label={sb.main}
        className={`fixed inset-y-0 start-0 z-40 flex w-[var(--side-w)] flex-col border-e border-fg/10 bg-card transition-[width,transform] duration-300 max-lg:w-72 ${
          mobileOpen ? "" : "max-lg:-translate-x-full max-lg:rtl:translate-x-full"
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-fg/10 px-4 ${narrow ? "lg:justify-center" : ""}`}>
          <span className={narrow ? "lg:[&_a]:gap-0 lg:[&>a>span:last-child]:hidden" : ""}>
            <Logo />
          </span>
        </div>

        {/* Quick switch: home, apps, settings. The current area is the raised tab. */}
        {!narrow && (
          <div className="mx-4 mt-4 flex gap-1 rounded-xl bg-soft p-1 max-lg:flex">
            <Link href="/dashboard" aria-label={nav[1]} className={`grid h-10 flex-[2] place-items-center rounded-lg transition ${active !== "settings" ? "bg-card text-primary shadow-sm" : "text-muted hover:text-fg"}`}>{icons.home}</Link>
            <Link href="/settings" aria-label={content[lang].settings.tab} title={content[lang].settings.tab} className={`grid h-10 flex-1 place-items-center rounded-lg transition ${active === "settings" ? "bg-card text-primary shadow-sm" : "text-muted hover:text-fg"}`}>{icons.settings}</Link>
          </div>
        )}

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {active === "settings" && !narrow && (
            <p className="mb-2 rounded-xl bg-black/[0.06] px-3 py-3 text-sm font-bold dark:bg-white/[0.09]">{content[lang].settings.group}</p>
          )}
          {(active === "settings" ? settingsEntries : entries).map((e) => {
            const isActive = active === "settings" ? e.href === pathname : e.section === active;
            const hasSub = !!e.sub;
            const expanded = hasSub && openKey === e.key && !narrow;
            const state = `${isActive ? "bg-black/[0.07] dark:bg-white/[0.1] font-bold text-fg" : "text-muted hover:bg-soft/60 hover:text-fg"} active:bg-fg/[0.14]`;

            const label = (
              <>
                {e.icon}
                <span className={`min-w-0 flex-1 truncate text-start ${narrow ? "lg:hidden" : ""}`}>{e.label}</span>
                {hasSub && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full bg-primary ${narrow ? "lg:hidden" : ""}`} />}
              </>
            );

            return (
              <div key={e.key} data-side-item>
                {hasSub ? (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    title={e.label}
                    onClick={() => {
                      if (narrow) setCollapsed(false);
                      setOpenKey((k) => (k === e.key ? null : e.key));
                    }}
                    className={`${row} ${state}`}
                  >
                    {label}
                  </button>
                ) : e.href ? (
                  <Link href={e.href} title={e.label} onClick={() => setMobileOpen(false)} className={`${row} ${state}`}>
                    {label}
                  </Link>
                ) : (
                  <span aria-disabled="true" title={`${e.label} (${sb.soon})`} className={`${row} cursor-not-allowed text-muted/70`}>
                    {label}
                  </span>
                )}

                {expanded && (
                  <ul className="mt-1 space-y-0.5 border-s border-fg/10 ps-3 ms-[1.4rem]">
                    {e.sub!.map((s) =>
                      s.href ? (
                        <li key={s.label} className="relative">
                          {pathname === s.href && <span aria-hidden className="absolute -start-[13px] bottom-1.5 top-1.5 w-[3px] rounded-full bg-primary" />}
                          <Link href={s.href} onClick={() => setMobileOpen(false)} aria-current={pathname === s.href ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm transition-colors active:bg-fg/[0.14] ${pathname === s.href ? "bg-black/[0.07] dark:bg-white/[0.1] font-semibold text-fg" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`}>
                            {s.label}
                          </Link>
                        </li>
                      ) : (
                        <li key={s.label}>
                          <span aria-disabled="true" title={sb.soon} className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-muted/60">{s.label}</span>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse (large screens) and close (small screens) */}
        <div className="shrink-0 border-t border-fg/10 p-3">
          <button
            type="button"
            onClick={() => (mobileOpen ? setMobileOpen(false) : setCollapsed((c) => !c))}
            aria-label={mobileOpen ? sb.close : collapsed ? sb.expand : sb.collapse}
            title={collapsed ? sb.expand : sb.collapse}
            className={`${row} text-muted hover:bg-soft/60 hover:text-fg ${narrow ? "lg:justify-center" : ""}`}
          >
            <span className={`transition-transform ${collapsed ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180"}`}>{icons.chevron}</span>
            <span className={narrow ? "lg:hidden" : ""}>{mobileOpen ? sb.close : sb.collapse}</span>
          </button>
        </div>
      </aside>

      {/* Dark backdrop behind the drawer on small screens */}
      {mobileOpen && <button type="button" aria-label={sb.close} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}

      {/* Header strip: tabs on one side, tools on the other */}
      <header className="sticky top-0 z-30 border-b border-fg/10 bg-card/90 backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 md:flex-nowrap md:gap-4 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label={sb.open} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-fg/15 lg:hidden">
              {icons.menu}
            </button>
            <div className="flex gap-6 overflow-x-auto text-sm font-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {subtabs.map((t, i) => (inSidebar.has(t) ? null : { t, i })).filter((x): x is { t: string; i: number } => !!x).map(({ t, i }) => {
                const cls = `shrink-0 border-b-2 py-5 ${i === activeSub ? "border-primary font-semibold text-fg" : "border-transparent text-muted"}`;
                const href = subHrefs?.[i];
                return href && i !== activeSub ? (
                  <Link key={t} href={href} data-nav-item className={`${cls} transition-colors hover:text-fg`}>{t}</Link>
                ) : (
                  <span key={t} data-nav-item className={cls}>{t}</span>
                );
              })}
            </div>
          </div>

          <GlobalSearch />

          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Link
              href="/support"
              data-nav-item
              aria-label={support.title}
              className={`group relative grid h-9 w-9 place-items-center rounded-lg border text-fg transition hover:bg-soft ${active === "support" ? "border-primary bg-soft" : "border-fg/15"}`}
            >
              {icons.ticket}
              <span role="tooltip" className="pointer-events-none absolute end-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-onink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {support.title}
              </span>
            </Link>
            <NotificationBell />
            <LangSwitch iconOnly />
            <ProfileMenu />
          </div>
        </div>
      </header>
      {/* Outside the sticky header, so it scrolls away with the page and is there again at the top */}
      <DemoStrip />
    </>
  );
}
