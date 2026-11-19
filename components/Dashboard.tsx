"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brandName, content, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { AnimatedNumber, Money, RefreshButton, mulberry32 } from "./Reports";
import { demoActive } from "./demoSandbox";
import { ordersCopy, type StatusKey } from "./ordersContent";
import { loadSetup } from "./setup";
import { shipServes, usePublicSettings } from "./platformPublic";
import { liveMissing, SellNeeds, sellWords, ShipDefaultNote, storeLiveNow, useSellReady } from "./ReadyToSell";
import { cleanOrder, money, parseList, typedMoney } from "./records";
import { Skeleton } from "./Skeleton";
import { latestOrders, ordersReport, rangeSpan, salesFigures, salesSeries } from "./storeNumbers";
import { useStoreOrders } from "./useStoreOrders";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { ThemeAccessNotice } from "./ThemeAccessNotice";
import { useStoreVisits } from "./storeVisits";
import { dropUndos, offerUndo } from "./undo";
import { storeIsLive } from "./storefront/storage";
import { loadMaintenance, MAINTENANCE_KEY } from "./maintenance";
import { STORE_STATUS_EVENT } from "./StoreStatus";
import { onServer } from "./merchantApi";
import { storeAddress, storeUrl } from "./siteAddress";
import { ShareMenu } from "./ShareMenu";
import { usePageTitle } from "./pageTitle";

const TOTAL_TASKS = 6;

const icon = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";

/* A real store's home page: what Dukkan does not count yet says so, instead of showing a 0 that looks like a fact. A
   signed-in store's visitors are counted by Dukkan's server (components/storeVisits.ts). */
const words = {
  en: {
    notTracked: "Not tracked yet", visitsNote: "{brand} counts the visitors of a store that is signed in and open at its link.", cartsNote: "{brand} does not keep the carts customers leave yet.", avgOrder: "Average order", open: "Open order {id}",
    visitors: "Visitors", lastHour: "Visitors in the last hour", visitsViews: "{visits} visits · {views} page views",
    noVisitors: "No visitors yet", shareHint: "Share your store's link on WhatsApp or Instagram. Visitors show here within a minute.",
    /* the server leaves out the merchant's own visits (signed in on that browser), Dukkan's staff and programs */
    ownVisits: "Your own visits aren't counted",
    /* the orders (his browser's and his store's) could not be read */
    loadFailed: "Your orders couldn't be loaded. Check your connection and try again.", visitsFailed: "Your visitor numbers couldn't be loaded.", retry: "Try again",
    expected: "Orders waiting for delivery: {n} · expected {amount}",
    notCharged: "Card or CliQ test orders not counted (nothing was charged): {n}",
    testOrders: "Test orders not counted: {n} (card or CliQ, nothing charged)",
    liveTitle: "Your store is live", liveSub: "Customers can visit it now at", liveOpen: "Open your store", liveShare: "Share the link", liveHide: "Hide",
  },
  ar: {
    notTracked: "لا يُتتبّع بعد", visitsNote: "يحسب {brand} زوار المتجر المسجّل الدخول والمفتوح على رابطه.", cartsNote: "لا يحفظ {brand} السلات التي يتركها العملاء بعد.", avgOrder: "متوسط الطلب", open: "فتح الطلب {id}",
    visitors: "الزوار", lastHour: "الزوار في آخر ساعة", visitsViews: "{visits} زيارة · {views} مشاهدة صفحة",
    noVisitors: "لا زوار بعد", shareHint: "شارك رابط متجرك على واتساب أو إنستغرام. يظهر الزوار هنا خلال دقيقة.",
    ownVisits: "زياراتك أنت لا تُحتسب",
    loadFailed: "تعذّر تحميل طلباتك. تحقق من الاتصال وحاول مرة أخرى.", visitsFailed: "تعذّر تحميل أرقام الزوار.", retry: "حاول مرة أخرى",
    expected: "طلبات بانتظار التوصيل: {n} · المتوقَّع {amount}",
    notCharged: "طلبات تجريبية بالبطاقة أو كليك لا تُحتسب (لم يُخصم أي مبلغ): {n}",
    testOrders: "طلبات تجريبية لا تُحتسب: {n} (بطاقة أو كليك، لم يُخصم أي مبلغ)",
    liveTitle: "متجرك مفتوح الآن", liveSub: "يستطيع العملاء زيارته الآن على", liveOpen: "افتح متجرك", liveShare: "شارك الرابط", liveHide: "إخفاء",
  },
};

/* "Your store is live" on the home page, once every setup task is done: shown for a week from the first time, or until
   he hides it. A "seen-" key, so it stays hidden on his other devices too */
const LIVE_KEY = "seen-live-card";
const LIVE_DAYS = 7;

function liveCardShown(): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as { since?: unknown; hidden?: unknown } | null;
    const since = typeof raw?.since === "number" && Number.isFinite(raw.since) ? raw.since : Date.now();
    if (!raw || typeof raw.since !== "number") localStorage.setItem(LIVE_KEY, JSON.stringify({ since }));
    return raw?.hidden !== true && Date.now() - since < LIVE_DAYS * 86_400_000;
  } catch {
    return true;
  }
}

function hideLiveCard() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as { since?: unknown } | null;
    localStorage.setItem(LIVE_KEY, JSON.stringify({ since: typeof raw?.since === "number" ? raw.since : Date.now(), hidden: true }));
  } catch {
    /* storage blocked: hidden until the page opens again */
  }
}

/* The monthly sales goal he sets on the home page. A "seen-" key, so it is kept on the server with the rest of his store */
const GOAL_KEY = "seen-goal";

function readGoal(): number {
  try {
    return money(localStorage.getItem(GOAL_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

function NotTracked({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-3xl bg-soft text-muted">
        <svg {...icon} className="h-9 w-9"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      </span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1 max-w-[16rem] text-sm text-muted">{note}</p>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-3xl bg-soft text-primary">
        <svg {...icon} className="h-9 w-9"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      </span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1 max-w-[16rem] text-sm text-muted">{hint}</p>
    </div>
  );
}

/** 950 stays 950; 1,250 becomes 1.2K; 15,300 becomes 15K; 2,400,000 becomes 2.4M. Short enough for a narrow bar. */
function short(n: number): string {
  const f = (v: number, unit: string) => `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return f(n / 1000, "K");
  return f(n / 1_000_000, "M");
}

export function Dashboard() {
  const { lang } = usePrefs();
  const h = content[lang].home;
  const r = content[lang].reports;
  const cur = r.currency;
  const w = words[lang];

  const [sample, setSample] = useState(false);
  /* In the platform tour everything is already made-up data, so the sample switch is not needed */
  const [tour, setTour] = useState(false);
  /* In the tour the latest orders are the same orders the Orders page lists */
  const [tourOrders, setTourOrders] = useState<{ name: string; total: string; status: StatusKey }[]>([]);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  /* the saved setup was read (until then neither the setup card nor the live card shows, so neither flashes) */
  const [setupRead, setSetupRead] = useState(false);
  /* every task is done: his store's link and where "Open your store" goes, while the live card is still shown */
  const [liveCard, setLiveCard] = useState<{ slug: string; href: string } | null>(null);
  /* what customers can't do yet: order delivery (no delivery choice: safeOrder storeDelivery, while pickup is on) */
  const [noShipping, setNoShipping] = useState(false);
  /* whether the store can sell (safeOrder readyToSell: a way to pay that is on, and pickup or a valid delivery choice),
     and whether customers can see it now (its design saved, not under maintenance) */
  const sell = useSellReady();
  const [liveNow, setLiveNow] = useState(false);
  /* the store is published but paused (under maintenance): said at the top, so he never forgets it is closed */
  const [paused, setPaused] = useState(false);
  /* his Dukkan Ship pickup city as saved ("" when he does not use Dukkan Ship): a city Diwan took off the list is said here
     too, not only on Delivery options (the bell tells him once) */
  const [shipCity, setShipCity] = useState("");
  const platform = usePublicSettings();
  /* live with no delivery choice saved: it delivers with Dukkan Ship by default (ReadyToSell shipsByDefault) */
  const shipDefault = liveNow && sell.read && sell.shipDefault;
  const [goal, setGoal] = useState(0);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  /* A signed-in store's visitors, from Dukkan's server (read again every minute); the tour keeps its made-up ones */
  const visitors = useStoreVisits();
  const realVisits = visitors.on && !sample ? visitors.stats : null;
  /* A real store's orders (his browser's and, signed in, the ones customers placed on his store: the same list the
     Orders page shows) and products: read when the page opens, every minute, when he comes back to the tab and by
     each refresh button (useStoreOrders.ts) */
  const data = useStoreOrders();
  /* before the first answer the numbers are grey blocks, not zeros that read as "no sales" */
  const numbersLoading = !sample && data.state === "loading";
  const numbersFailed = !sample && data.state === "failed";

  usePageTitle(`${brandName(lang)} | ${h.pageTitle}`);

  useEffect(() => {
    const s = loadSetup();
    setNoShipping(!s?.shipping);
    setShipCity(s?.shipping?.mode === "seen" ? s.shipping.city : "");
    setLiveNow(storeLiveNow());
    if (s) {
      setName(s.name);
      setDoneCount(s.done.filter(Boolean).length);
      /* the store opens to customers with the design's first save (the last task); signed in, it is at its own address,
         otherwise "Open your store" shows it as customers would see it (as the profile menu does) */
      if (s.done.filter(Boolean).length >= TOTAL_TASKS && s.slug && liveCardShown())
        setLiveCard({ slug: s.slug, href: onServer() && storeIsLive() ? storeUrl(s.slug) : "/store" });
    }
    setSetupRead(true);
    /* In the platform tour the home page starts with its sample numbers on, so it is not empty */
    if (demoActive()) {
      setSample(true);
      setTour(true);
      try {
        const list = parseList(localStorage.getItem("seen-orders"), cleanOrder);
        setTourOrders(list.sort((a, b) => b.created - a.created).slice(0, 3).map((x) => ({ name: x.customer, total: String(x.total), status: x.status })));
      } catch {
        /* the sample list stays */
      }
      /* The store in the tour already has a monthly target */
      setGoal(2500);
      setNow(new Date());
    } else {
      setGoal(readGoal());
      setNow(new Date());
    }
  }, []);

  /* paused or opened from the profile menu (or in another tab): the home page follows */
  useEffect(() => {
    const read = () => {
      setPaused(storeIsLive() && loadMaintenance().on);
      setLiveNow(storeLiveNow());
    };
    read();
    const onStorage = (e: StorageEvent) => (e.key === null || e.key.endsWith(MAINTENANCE_KEY)) && read();
    window.addEventListener(STORE_STATUS_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STORE_STATUS_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /* The tour draws a fresh set of sample numbers; a real store reads its orders (and its visitors) again */
  const reloadVisits = visitors.reload;
  const reloadOrders = data.reload;
  const refresh = useCallback((id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    if (!demoActive()) {
      void Promise.all([reloadVisits(), reloadOrders()]).finally(() => {
        setNow(new Date());
        setBusy((b) => ({ ...b, [id]: false }));
      });
      return;
    }
    window.setTimeout(() => {
      setSeed((s) => s + 1);
      setBusy((b) => ({ ...b, [id]: false }));
    }, 900);
  }, [reloadOrders, reloadVisits]);

  /* the goal as it is now, for an undo (it checks the goal was not changed again since) */
  const goalNow = useRef(0);
  useEffect(() => {
    goalNow.current = goal;
  }, [goal]);
  /* only this page shows the goal: its undo goes when it closes */
  useEffect(() => () => dropUndos("home"), []);
  /* A real store's goal is kept, so it is still there tomorrow and on his other devices */
  const putGoal = (v: number) => {
    goalNow.current = v;
    setGoal(v);
    if (tour) return;
    try {
      localStorage.setItem(GOAL_KEY, String(v));
    } catch {
      /* storage blocked: the goal lasts until the page closes */
    }
  };
  /* with an Undo that puts the goal before back */
  const keepGoal = (v: number) => {
    const was = goalNow.current;
    if (v === was) return;
    putGoal(v);
    offerUndo({
      scope: "home",
      label: (l) => (l === "ar" ? `تغيّر هدف المبيعات الشهري إلى ${v} د.أ` : `Monthly sales goal changed to ${v} JOD`),
      undo: () => {
        if (goalNow.current !== v) return false;
        putGoal(was);
      },
    });
  };

  /* ---------- Chart data (all zero for a new store) ---------- */
  /* a real store's "today" moves on with each read of its orders (every minute), so a page left open past midnight follows */
  const today = (!sample && data.at) || now || new Date(2026, 0, 1);
  const year = today.getFullYear();
  const month = today.getMonth();
  const locale = dateLocale(lang);
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(today);
  const monthShort = (m: number) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, m, 1));

  const length = mode === "daily" ? new Date(year, month + 1, 0).getDate() : 12;
  const current = mode === "daily" ? today.getDate() - 1 : month;
  const rnd = mulberry32(seed * 9973 + (mode === "daily" ? 1 : 2));
  /* The tour's made-up numbers (unchanged); a real store's come from its own orders (storeNumbers.ts) */
  const real = salesSeries(data.orders, today, mode);
  const sales = sample
    ? Array.from({ length }, (_, i) => {
        const v = Math.round((mode === "daily" ? 20 + rnd() * 140 : 600 + rnd() * 2400) * 100) / 100;
        return i <= current ? v : 0;
      })
    : real.sales;
  const orders = sample ? sales.map((v) => (v ? Math.max(1, Math.round(v / (16 + rnd() * 12))) : 0)) : real.orders;
  /* A real store's figures beside the chart are this month's in both views, like the title says (and the goal is a
     monthly one); the tour keeps adding up its chart */
  const thisMonth = sample ? null : salesFigures(data.orders, data.products, rangeSpan(2, today));
  const netSales = thisMonth ? thisMonth.sales : sales.reduce((a, b) => a + b, 0);
  /* every real order placed this month, whatever its status (as Reports counts orders): a new order shows at once. Card
     or CliQ test orders (storeNumbers.ts isTestOrder: nothing was charged) are not his orders' count (ordersReport and the
     chart leave them out): a small note says how many there were */
  const monthOrders = thisMonth ? ordersReport(data.orders, rangeSpan(2, today)) : null;
  const orderTotal = monthOrders ? monthOrders.all : orders.reduce((a, b) => a + b, 0);
  const testOrders = monthOrders?.test ?? 0;
  const visits = sample ? Math.round(netSales * (6 + rnd() * 3)) + 1 + Math.floor(rnd() * 8) : 0;
  const peak = Math.max(...sales, 1);
  const shown = hover ?? current;
  const label = mode === "daily" ? `${shown + 1} ${monthShort(month)}` : monthShort(shown);

  /* ---------- Smaller cards ---------- */
  const rndSmall = mulberry32(seed * 7717 + 3);
  const lastHour = Array.from({ length: 12 }, () => (sample ? Math.round(2 + rndSmall() * 14) : 0));
  const lastHourMax = Math.max(...lastHour, 1);
  const abandoned = sample ? Math.round(6 + rndSmall() * 18) : 0;
  const lost = sample ? Math.round(abandoned * (18 + rndSmall() * 14) * 100) / 100 : 0;
  const latest: { name: string; total: string; status: string; id?: number }[] =
    tour && tourOrders.length
      ? tourOrders.map((x) => ({ ...x, status: ordersCopy[lang].statuses[x.status] }))
      : sample
        ? h.latestSample
        : latestOrders(data.orders).map((o) => ({ id: o.id, name: o.customer, total: fmt(o.total), status: ordersCopy[lang].statuses[o.status] }));

  const goalProgress = goal > 0 ? Math.min((netSales / goal) * 100, 100) : 0;

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="home" subtabs={[h.summaryTab]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-6 px-5 py-8 md:px-10">
        {/* Dukkan's announcements meant for this shop (signed in only) */}
        <AnnouncementBanner />
        {/* a paid theme in use that was never bought: the store goes back to the free theme, and this says so once */}
        <ThemeAccessNotice />
        {/* Greeting */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{name ? h.welcome.replace("{name}", name) : h.welcomeNoName}</h1>
            <p className="mt-1 text-sm text-muted">{h.welcomeSub}</p>
          </div>
        </div>

        {/* The store is paused: customers see the maintenance page until he opens it again from the account menu */}
        {!tour && paused && (
          <p role="status" className="flex items-start gap-2.5 rounded-xl bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
            <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            <span>
              <span className="font-bold">{lang === "ar" ? "متجرك متوقف (قيد الصيانة)." : "Your store is paused (under maintenance)."}</span>{" "}
              {lang === "ar"
                ? "يرى العملاء صفحة الصيانة ولا يستطيعون الطلب. لفتحه مجددًا استخدم مفتاح «المتجر قيد الصيانة» في قائمة الحساب أعلى الصفحة."
                : "Customers see a maintenance page and can't order. To open it again, use the \"Store under maintenance\" switch in the account menu at the top of the page."}
            </span>
          </p>
        )}

        {/* Setup progress, until every task is done. The tour shows a store that is already running, so it has none. */}
        {!tour && setupRead && doneCount < TOTAL_TASKS && (
          <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{h.setupTitle}</h2>
              <p dir="auto" className="mt-1 text-sm text-muted">
                {h.setupProgress.replace("{done}", String(doneCount)).replace("{total}", String(TOTAL_TASKS))}
              </p>
              <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_TASKS} aria-valuenow={doneCount}>
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(doneCount / TOTAL_TASKS) * 100}%` }} />
              </div>
            </div>
            <a href="/onboarding" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">
              {h.setupCta}
            </a>
          </section>
        )}

        {/* What stops customers ordering, each with a link to fix it on Delivery options (the tour's store has both) */}
        {/* Not ready to sell: what is missing before the store can go live (the setup's own checklist), each a link to fix
            it on Delivery options. A store already live stays live (it is never taken offline for it): the same list
            then warns that customers can't complete an order, once Diwan's settings are in (a change there can cause it) */}
        {!tour && setupRead && sell.read && liveMissing(sell.missing, shipDefault).length > 0 && (!liveNow || sell.checked) && (
          <SellNeeds lang={lang} missing={liveMissing(sell.missing, shipDefault)} title={liveNow ? sellWords[lang].liveNotReady : undefined} />
        )}
        {/* a live store that never chose how it delivers delivers with Dukkan Ship by default (pickup on or off): it says so
            and asks him to choose, instead of "customers can't complete an order" */}
        {!tour && setupRead && shipDefault && sell.checked && <ShipDefaultNote lang={lang} />}
        {/* Dukkan Ship no longer picks up from his saved city: he chooses another on Delivery options */}
        {!tour && setupRead && sell.checked && !shipServes(platform, shipCity) && (
          <p role="alert" className="rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">
            {content[lang].onboarding.shipping.cityGone.split("{city}")[0]}
            <bdi>{shipCity}</bdi>
            {content[lang].onboarding.shipping.cityGone.split("{city}")[1] ?? ""}{" "}
            <a href="/delivery" className="font-bold underline underline-offset-2">{lang === "ar" ? "خيارات التوصيل" : "Delivery options"}</a>
          </p>
        )}
        {/* not live yet, ready to sell with pickup only: delivery is not offered until he chooses how he delivers */}
        {!tour && setupRead && sell.ok && noShipping && !shipDefault && (
          <p role="status" className="rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">
            {lang === "ar" ? "لا يستطيع العملاء طلب التوصيل حتى تختار طريقة التوصيل." : "Customers can't order delivery until you choose how you deliver."}{" "}
            <a href="/delivery" className="font-bold underline underline-offset-2">{lang === "ar" ? "خيارات التوصيل" : "Delivery options"}</a>
          </p>
        )}

        {/* Setup is done: the store is live. Open it or share its link (for a week, or until he hides it) */}
        {!tour && liveCard && liveNow && sell.ok && (
          <section className={`${card} relative flex flex-wrap items-center justify-between gap-4 pe-12`}>
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white" aria-hidden>
                <svg {...icon}><path d="m5 12 5 5 9-10" /></svg>
              </span>
              <div className="min-w-0">
                <h2 className="font-bold">{w.liveTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  {w.liveSub} <span dir="ltr" className="break-all font-semibold text-fg">{storeAddress(liveCard.slug)}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href={liveCard.href} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">
                {w.liveOpen}
              </a>
              <ShareMenu url={storeUrl(liveCard.slug)} title={name || w.liveTitle} lang={lang} fileName={`${liveCard.slug}-qr`} label={w.liveShare} className="rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white" />
            </div>
            <button type="button" onClick={() => { hideLiveCard(); setLiveCard(null); }} aria-label={w.liveHide} title={w.liveHide} className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-fg">
              <svg {...icon} className="h-4 w-4"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </section>
        )}

        {/* Month summary */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <svg {...icon} className="h-5 w-5 text-primary"><circle cx="12" cy="12" r="9" /><path d="M12 3v9h9" /></svg>
              {h.summaryTitle.replace("{month}", monthYear)}
            </h2>
            <div className="flex items-center gap-2">
              <div role="group" className="flex rounded-lg border border-fg/15 p-0.5 text-xs font-semibold">
                {(["daily", "monthly"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHover(null); }} className={`rounded-md px-3 py-1.5 transition ${mode === m ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                    {m === "daily" ? h.daily : h.monthly}
                  </button>
                ))}
              </div>
              <RefreshButton busy={!!busy.summary} onClick={() => refresh("summary")} label={r.refresh} />
            </div>
          </div>

          {/* The chart is always on the left and the figures on the right, in both languages */}
          <div dir="ltr" className={`mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] transition-opacity duration-300 ${busy.summary ? "opacity-40" : ""}`}>
            {/* Chart */}
            <div dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="rounded-xl bg-soft px-4 py-3 text-xs" dir="auto">
                <p className="font-bold">{label}</p>
                <p className="mt-1 text-muted">{h.netSales}: <span dir="ltr" className="font-semibold text-fg">{fmt(sales[shown] ?? 0)} {cur}</span></p>
                <p className="text-muted">{h.totalOrders}: <span className="font-semibold text-fg">{orders[shown] ?? 0}</span></p>
              </div>
              {numbersLoading && <Skeleton className="mt-4 h-32 w-full" />}
              <div dir="ltr" className={`mt-4 flex h-32 items-end gap-1 ${numbersLoading ? "hidden" : ""}`} role="img" aria-label={h.chartLabel}>
                {sales.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${mode === "daily" ? i + 1 : monthShort(i)}: ${v} ${cur}`}
                    className={`flex-1 rounded-sm transition-all duration-500 ${i === shown ? "bg-deep" : i === current ? "bg-primary" : "bg-primary/35 hover:bg-primary/60"}`}
                    style={{ height: `${v ? Math.max((v / peak) * 100, 12) : 28}%`, opacity: v || i === current ? 1 : 0.55 }}
                  />
                ))}
              </div>
            </div>

            {/* Totals */}
            <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-5" aria-busy={numbersLoading || undefined}>
              {numbersFailed && (
                <div role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm">
                  <p className="text-rose-600 dark:text-rose-400">{w.loadFailed}</p>
                  <button type="button" onClick={() => refresh("summary")} disabled={!!busy.summary} className="mt-2 rounded-lg border border-fg/15 bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-soft disabled:opacity-60">{w.retry}</button>
                </div>
              )}
              {([
                /* a signed-in store: this month's visitors (each day's visitors added up); a store that is not signed in has
                   no public store to count, so it says so rather than show a 0 */
                visitors.on && !sample
                  ? {
                      title: w.visitors,
                      node: <AnimatedNumber value={realVisits?.month.visitors ?? 0} />,
                      ico: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" />,
                      loading: !visitors.loaded,
                      failed: visitors.loaded && !realVisits,
                      /* his own visits are left out on purpose (server/storeVisits.ts): a 0 after he opened his store says why */
                      note: realVisits && realVisits.month.visitors === 0 ? w.ownVisits : undefined,
                    }
                  : { title: h.visits, node: sample ? <AnimatedNumber value={visits} /> : <span className="text-base font-semibold text-muted">{w.notTracked}</span>, ico: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" /> },
                {
                  title: h.netSales,
                  node: <Money value={netSales} currency={cur} />,
                  glyph: cur,
                  loading: numbersLoading,
                  failed: numbersFailed,
                  /* the same rule as Reports (storeNumbers.ts saleState): a sale is a delivered order; orders on their way
                     are shown apart, and card or CliQ test orders (nothing charged) are not counted */
                  note: thisMonth && (thisMonth.expected.orders || thisMonth.notCharged)
                    ? [
                        thisMonth.expected.orders ? w.expected.replace("{n}", String(thisMonth.expected.orders)).replace("{amount}", `${fmt(thisMonth.expected.sales)} ${cur}`) : "",
                        thisMonth.notCharged ? w.notCharged.replace("{n}", String(thisMonth.notCharged)) : "",
                      ].filter(Boolean).join("\n")
                    : undefined,
                },
                { title: h.orders, node: <AnimatedNumber value={orderTotal} />, ico: <path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4" />, loading: numbersLoading, failed: numbersFailed, note: testOrders ? w.testOrders.replace("{n}", String(testOrders)) : undefined },
                ...(thisMonth ? [{ title: w.avgOrder, node: <Money value={thisMonth.average} currency={cur} />, ico: <path d="M4 19h16M7 15l3-4 3 2 4-6" />, loading: numbersLoading, failed: numbersFailed }] : []),
              ] as { title: string; node: React.ReactNode; ico?: React.ReactNode; glyph?: string; loading?: boolean; failed?: boolean; note?: string }[]).map((m) => (
                <div key={m.title} className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-fg/10">{m.glyph ? <span className="text-sm font-bold leading-none">{m.glyph}</span> : <svg {...icon}>{m.ico}</svg>}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{m.title}</p>
                    {m.loading ? (
                      <Skeleton className="mt-1 h-8 w-28" />
                    ) : m.failed ? (
                      /* not a 0: the number is not known */
                      <p className="text-2xl font-bold text-muted">—</p>
                    ) : (
                      <p className="text-2xl font-bold">{m.node}</p>
                    )}
                    {!m.loading && !m.failed && m.note && <p dir="auto" className="mt-0.5 whitespace-pre-line text-xs text-muted">{m.note}</p>}
                  </div>
                </div>
              ))}
              <a href="/reports" className="inline-block rounded-xl border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                {h.viewReports}
              </a>
            </div>
          </div>

          {/* Monthly goal */}
          <div className="mt-6 border-t border-fg/10 pt-5">
            {goal > 0 && !goalOpen ? (
              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{h.goalLabel}</span>
                  <span dir="ltr" className="text-muted">{fmt(netSales)} / {fmt(goal)} {cur}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress)}>
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${goalProgress}%` }} />
                </div>
                <button type="button" onClick={() => { setGoalText(String(goal)); setGoalOpen(true); }} className="mt-3 text-xs font-semibold text-primary hover:underline">{h.goalChange}</button>
              </div>
            ) : goalOpen ? (
              <form
                className="flex flex-wrap items-center gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = money(goalText) ?? 0;
                  if (v > 0) {
                    keepGoal(v);
                    setGoalOpen(false);
                    setGoalText("");
                  }
                }}
              >
                <label className="text-sm font-bold" htmlFor="goal">{h.goalLabel}</label>
                <input id="goal" value={goalText} onChange={(e) => setGoalText(typedMoney(e.target.value))} inputMode="decimal" placeholder={cur} dir="ltr" className="h-11 w-40 rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                <button type="submit" disabled={!((money(goalText) ?? 0) > 0)} className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-onink transition enabled:hover:bg-deep disabled:cursor-not-allowed disabled:opacity-50">{h.goalSave}</button>
                {/* changing a saved goal can be given up: the old one stays */}
                {goal > 0 && (
                  <button type="button" onClick={() => { setGoalOpen(false); setGoalText(""); }} className="h-11 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                )}
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold">{h.goalTitle}</p>
                  <p className="mt-1 text-sm text-muted">{h.goalHint}</p>
                </div>
                <button type="button" onClick={() => setGoalOpen(true)} className="rounded-xl border border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{h.goalBtn}</button>
              </div>
            )}
          </div>
        </section>

        {/* Smaller cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{visitors.on && !sample ? w.lastHour : h.lastHourTitle}</h2>
              {(sample || visitors.on) && <RefreshButton busy={!!busy.hour} onClick={() => refresh("hour")} label={r.refresh} />}
            </div>
            <div className={`flex flex-1 flex-col transition-opacity duration-300 ${busy.hour ? "opacity-40" : ""}`}>
              {sample ? (
                <>
                  <p className="mt-4 text-3xl font-bold"><AnimatedNumber value={lastHour.reduce((a, b) => a + b, 0)} /></p>
                  <p className="text-sm text-muted">{h.visits}</p>
                  <div dir="ltr" className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label={h.lastHourTitle}>
                    {lastHour.map((v, i) => (
                      <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                        <span title={v.toLocaleString("en-US")} className="max-w-full truncate text-[10px] font-bold tabular-nums text-fg/80 sm:text-[11px]">{short(v)}</span>
                        <span className="w-full rounded-sm bg-primary/70 transition-all duration-500" style={{ height: `${Math.max((v / lastHourMax) * 78, 6)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-muted">
                    <span>{lang === "ar" ? "قبل 60 د" : "60 min ago"}</span>
                    <span>{lang === "ar" ? "الآن" : "Now"}</span>
                  </div>
                </>
              ) : visitors.on ? (
                /* a signed-in store: its visitors in the last hour, in steps of 5 minutes */
                visitors.loaded && realVisits && realVisits.days30.views === 0 && realVisits.lastHour.views === 0 ? (
                  <EmptyState title={w.noVisitors} hint={`${w.shareHint} ${w.ownVisits}.`} />
                ) : visitors.loaded && !realVisits ? (
                  <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                    <p className="max-w-[16rem] text-sm text-rose-600 dark:text-rose-400">{w.visitsFailed}</p>
                    <button type="button" onClick={() => refresh("hour")} disabled={!!busy.hour} className="rounded-lg border border-fg/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-soft disabled:opacity-60">{w.retry}</button>
                  </div>
                ) : !realVisits ? (
                  <div aria-busy="true" className="flex flex-1 flex-col">
                    <Skeleton className="mt-4 h-9 w-16" />
                    <Skeleton className="mt-2 h-4 w-40" />
                    <Skeleton className="mt-4 h-32 w-full" />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <p className="mt-4 text-3xl font-bold"><AnimatedNumber value={realVisits?.lastHour.visitors ?? 0} /></p>
                    <p dir="auto" className="text-sm text-muted">
                      {w.visitsViews.replace("{visits}", (realVisits?.lastHour.visits ?? 0).toLocaleString("en-US")).replace("{views}", (realVisits?.lastHour.views ?? 0).toLocaleString("en-US"))}
                    </p>
                    <div dir="ltr" className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label={w.lastHour}>
                      {(realVisits?.minutes ?? Array.from({ length: 12 }, () => 0)).map((v, i, all) => (
                        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                          <span title={v.toLocaleString("en-US")} className="max-w-full truncate text-[10px] font-bold tabular-nums text-fg/80 sm:text-[11px]">{short(v)}</span>
                          <span className="w-full rounded-sm bg-primary/70 transition-all duration-500" style={{ height: `${Math.max((v / Math.max(...all, 1)) * 78, 6)}%` }} />
                        </div>
                      ))}
                    </div>
                    <div dir="ltr" className="mt-1.5 flex justify-between text-[11px] text-muted">
                      <span>{lang === "ar" ? "قبل 60 د" : "60 min ago"}</span>
                      <span>{lang === "ar" ? "الآن" : "Now"}</span>
                    </div>
                  </div>
                )
              ) : (
                <NotTracked title={w.notTracked} note={w.visitsNote.replace("{brand}", brandName(lang))} />
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{h.latestTitle}</h2>
              <RefreshButton busy={!!busy.orders} onClick={() => refresh("orders")} label={r.refresh} />
            </div>
            <div className={`flex flex-1 flex-col transition-opacity duration-300 ${busy.orders ? "opacity-40" : ""}`}>
              {numbersLoading ? (
                <div aria-busy="true" className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
                </div>
              ) : numbersFailed && !latest.length ? (
                <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                  <p className="max-w-[16rem] text-sm text-rose-600 dark:text-rose-400">{w.loadFailed}</p>
                  <button type="button" onClick={() => refresh("orders")} disabled={!!busy.orders} className="rounded-lg border border-fg/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-soft disabled:opacity-60">{w.retry}</button>
                </div>
              ) : latest.length ? (
                <ul className="mt-4 space-y-2">
                  {latest.map((o) => {
                    const row = (
                      <>
                        {/* the name keeps its own direction, so an Arabic name in English (and the other way) is cut at its end, not its start */}
                        <bdi dir="auto" title={o.name} className="block min-w-0 truncate font-semibold ltr:text-left rtl:text-right">{o.name}</bdi>
                        <span dir="ltr" className="shrink-0 text-muted">{o.total} {cur}</span>
                        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-deep dark:text-primary">{o.status}</span>
                      </>
                    );
                    const cls = "flex items-center justify-between gap-3 rounded-xl bg-soft/70 px-3 py-2.5 text-sm";
                    /* a real order opens on the Orders page (?open= is what the search uses too) */
                    return (
                      <li key={o.id ?? o.name}>
                        {o.id ? (
                          <a href={`/orders?open=${o.id}`} aria-label={`${w.open.replace("{id}", String(o.id))}: ${o.name}`} className={`${cls} transition hover:bg-soft`}>{row}</a>
                        ) : (
                          <div className={cls}>{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title={h.empty} hint={h.emptyOrders} />
              )}
            </div>
          </section>

          <section className={`${card} flex flex-col`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{h.cartsTitle}</h2>
              {sample && <RefreshButton busy={!!busy.carts} onClick={() => refresh("carts")} label={r.refresh} />}
            </div>
            {/* the carts customers leave are not kept for a real store yet */}
            {!sample ? (
              <NotTracked title={w.notTracked} note={w.cartsNote.replace("{brand}", brandName(lang))} />
            ) : (
            <div className={`mt-4 flex flex-1 flex-col justify-center gap-5 transition-opacity duration-300 ${busy.carts ? "opacity-40" : ""}`}>
              <div>
                <p className="text-sm text-muted">{h.cartsCount}</p>
                <p className="text-3xl font-bold text-primary"><AnimatedNumber value={abandoned} /></p>
              </div>
              <div>
                <p className="text-sm text-muted">{h.cartsLost}</p>
                <p className="text-3xl font-bold text-rose-500"><Money value={lost} currency={cur} /></p>
              </div>
              <a href="/reports?section=abandoned" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{h.cartsLink}<svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg></a>
            </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
