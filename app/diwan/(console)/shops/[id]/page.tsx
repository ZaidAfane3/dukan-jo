"use client";

import Link from "next/link";
import { useRef, useState, use } from "react";
import { ActivityText, type ActivityRow } from "@/components/diwan/ActivityLine";
import { ContactDialog } from "@/components/diwan/Contact";
import { ticketHref } from "@/components/diwan/TicketChat";
import { MARK_METHODS, MethodBadge, methodText, Select, STATUS_LOOK, StatusBadge, StatusIcon, storeLink, storeLinkHref, todayJo, type ShopStatus } from "@/components/diwan/shopBits";
import { PRIORITY, STATUS as TICKET_STATUS, KIND, type TKind, type TPriority, type TStatus } from "@/components/diwan/ticketWords";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { ShopSkeleton } from "@/components/diwan/skeletons";
import { OwnPasswordField, passwordAgainWords } from "@/components/diwan/passwordAgain";
import { REASON_WORDS, type ReportReason } from "@/components/storeReports";
import type { Bi } from "@/components/storefront/config";
import { findTheme } from "@/components/themes";
import { latin } from "@/components/digits";

type Shop = {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  store_phone: string;
  setup_done: number;
  published: boolean;
  paused: boolean;
  ship_mode: string;
  /* its own courier's name (ship_mode "own"), and whether customers may pick up their orders */
  ship_name?: string;
  pickup?: boolean;
  /* the ways to pay the merchant chose ("cliq,cash", "" none yet); null: never chosen, every way Dukkan has on */
  store_pays?: string | null;
  pickup_city: string;
  pickup_address: string;
  shop_status: string;
  suspend_reason: string | null;
  suspended_at: string | null;
  product_count: number;
  order_count: number;
  /* order_count and total_sales are the merchant's Home's numbers (his own orders and his store page's, no test orders) */
  /* of order_count, the orders customers placed on its public page */
  storefront_orders: number;
  /* the same apart: through the store page (store_orders) and added by the merchant (his saved orders) */
  store_orders?: number;
  store_sales?: string;
  hand_orders?: number;
  hand_sales?: string;
  /* card and CliQ orders placed on its page while payment is not open: test orders, in neither number */
  storefront_test?: number;
  /* visitors of its store at its link over the last 30 days (each day's visitors added up) */
  visitors_30?: number;
  /* what it still needs before it can sell (safeOrder readyToSell): no way to pay on, no way to get orders */
  not_ready?: ("pay" | "delivery")[];
  total_sales: string;
  first_product_at: string | null;
  published_at: string | null;
  first_order_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  owner: string;
  email: string;
  phone: string;
  last_login_at: string | null;
  login_count: number;
  totp_on: boolean;
  signed_up: string;
  status: string;
};
/* a part of the store's history: its newest rows and how many there are; null when this role can't see that part */
type Part<R> = { rows: R[]; count: number } | null;
type PayRow = { id: string; amount: string; method: string; reference: string; paid_on: string; note: string; marked_by: string | null };
type ThemeRow = { id: string; theme_id: string; theme_name: Bi | null; price: string; method: string | null; paid_at: string };
type TicketRow = { number: number; subject: string; kind: TKind; status: TStatus; priority: TPriority; created_at: string; updated_at: string };
type DocRow = {
  id: string; kind: "courier_proof" | "commercial_registration" | "other"; status: "waiting" | "approved" | "rejected"; created_at: string; seq: number;
  /* when the merchant removed it (the row stays as a record, without its file), or null */
  removed_at: string | null;
};
type ReportRow = { id: string; reason: ReportReason; status: "new" | "checking" | "closed"; reporter_kind: "customer" | "staff"; created_at: string };
type DeletionRow = { order_no: string; reason: string; deleted_by: string; deleted_at: string };
/* the theme the store uses now (app/api/diwan/shops/[id]/route.ts ThemeInUse): when it was chosen is not saved, so not shown */
type ThemeInUse = { id: string; name: Bi | null; kind: "free" | "listed" | "code" | "removed"; how: "free" | "bought" | "not_bought"; shownFree?: boolean };
type Detail = {
  shop: Shop;
  theme: ThemeInUse | null;
  payments: (Part<PayRow> & { total: string | null }) | null;
  themes: Part<ThemeRow>;
  tickets: Part<TicketRow>;
  documents: Part<DocRow>;
  reports: Part<ReportRow>;
  deletions: Part<DeletionRow>;
  activity: Part<ActivityRow>;
  can: { status: boolean; billing: boolean; themes?: boolean };
};

type Panel = null | "suspend" | "reactivate" | "paid" | "totp";

const docTone: Record<DocRow["status"], Tone> = { waiting: "amber", approved: "green", rejected: "red" };
const reportTone: Record<ReportRow["status"], Tone> = { new: "red", checking: "amber", closed: "grey" };

/* One shop: who owns it, how far it got, and its whole history with Dukkan (payments, themes bought, tickets,
   documents, reports about it, deleted orders, the activity log), each part with its count, its newest rows and a "See
   all" to the full list narrowed to this store. A part shows only to staff whose role may open its own page (the server
   sends nothing for the others). The actions are only shown to staff whose role allows them (the server checks again).
   The owner's email and mobile are behind the Contact button, not printed on the page. */
export default function ShopPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const t = useT();
  const f = useFmt();
  const s = useApi<Detail>(`/api/diwan/shops/${encodeURIComponent(params.id)}`);
  const [panel, setPanel] = useState<Panel>(null);
  const [contact, setContact] = useState(false);
  /* a suspend or reactivate the server just confirmed, shown at once over the page it was made on: loading the whole
     page again takes a few seconds, and until then it would still show the old state. The fresh page replaces it. */
  const [changed, setChanged] = useState<{ on: Detail; shop: Partial<Shop> } | null>(null);

  return (
    <Loaded s={s} skeleton={<ShopSkeleton />}>
      {(d) => {
        const updating = !!changed && changed.on === d;
        const sh: Shop = updating ? { ...d.shop, ...changed.shop } : d.shop;
        const id = sh.id;
        const suspended = sh.shop_status === "suspended";
        const themeName = (r: ThemeRow) => {
          const n = r.theme_name ?? findTheme(r.theme_id)?.name;
          return (n && t(n.en, n.ar)) || r.theme_id;
        };
        const docName = (k: DocRow["kind"]) =>
          ({ courier_proof: t("Proof of delivery", "إثبات التوصيل"), commercial_registration: t("Commercial registration", "السجل التجاري"), other: t("Other document", "مستند آخر") })[k];
        const docStatus = (x: DocRow["status"]) => ({ waiting: t("Waiting", "بانتظار المراجعة"), approved: t("Approved", "مقبول"), rejected: t("Rejected", "مرفوض") })[x];
        const reportStatus = (x: ReportRow["status"]) => ({ new: t("New", "جديد"), checking: t("Checking", "قيد التحقق"), closed: t("Closed", "مغلق") })[x];
        return (
          <>
            <Link href="/diwan/shops" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
              ← {t("Stores", "المتاجر")}
            </Link>
            {/* no "Stores" line above the title: the link back just above already says where this page belongs */}
            <PageHead
              eyebrow=""
              title={sh.name || t("(no store name yet)", "(لا اسم للمتجر بعد)")}
              sub={sh.slug ? storeLink(sh.slug) : t("No store link chosen yet", "لم يُختر رابط المتجر بعد")}
            />

            {/* where the store stands, said in one line with its mark: open since when, under maintenance, or suspended
                and why (the merchant reads that reason word for word) */}
            {(() => {
              const key = (["open", "paused", "suspended"].includes(sh.status) ? sh.status : "open") as ShopStatus;
              const look = STATUS_LOOK[key];
              const line =
                key === "suspended"
                  ? t(`Suspended by Dukkan on ${f.date(sh.suspended_at)}`, `أوقفته دكّان في ${f.date(sh.suspended_at)}`)
                  : key === "paused"
                    ? t("Under maintenance: its merchant paused the store", "تحت الصيانة: أوقف التاجر متجره مؤقتًا")
                    : sh.published
                      ? t(`Open, published since ${f.date(sh.published_at)}`, `مفتوح، منشور منذ ${f.date(sh.published_at)}`)
                      : t(`Open since ${f.date(sh.created_at)}, not published yet`, `مفتوح منذ ${f.date(sh.created_at)}، لم يُنشر بعد`);
              return (
                <div className={`mb-6 flex items-center gap-4 rounded-2xl px-5 py-4 ring-1 ${look.band}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${look.icon}`}>
                    <StatusIcon status={key} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{line}</p>
                    {key === "suspended" && sh.suspend_reason && <p className="mt-0.5 break-words text-sm opacity-90">{sh.suspend_reason}</p>}
                    {/* the store can't take an order: no way to pay is on, or customers have no way to get their orders */}
                    {!!sh.not_ready?.length && (
                      <p className="mt-0.5 text-sm font-semibold opacity-90">
                        {t("Not ready to sell: ", "غير جاهز للبيع: ")}
                        {sh.not_ready.map((m) => (m === "pay" ? t("no way to pay is on", "لا طريقة دفع مفعّلة") : t("no delivery or pickup", "لا توصيل ولا استلام"))).join(t(" · ", " · "))}
                      </p>
                    )}
                    {key === "suspended" && <p className="mt-1 text-xs opacity-75">{t("The merchant sees this reason when they try to sign in.", "يرى التاجر هذا السبب عند محاولة الدخول.")}</p>}
                    {updating && (
                      <p role="status" className="mt-1 text-xs opacity-75">
                        {t("Done. Updating the rest of the page…", "تم. جارٍ تحديث بقية الصفحة…")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* what staff can do for this store: roomy cards, each saying what it does */}
            <section aria-label={t("Actions", "الإجراءات")} className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
              <ActionCard
                icon="mail"
                title={t("Contact the merchant", "التواصل مع التاجر")}
                line={t("Email, call or WhatsApp the owner.", "راسل المالك أو اتصل به أو عبر واتساب.")}
                onClick={() => setContact(true)}
              />
              {d.can.billing && (
                <ActionCard
                  icon="cash"
                  title={t("Mark a payment as received", "تسجيل دفعة مستلمة")}
                  line={t("Record money the store paid Dukkan.", "سجّل مبلغًا دفعه المتجر لدكّان.")}
                  onClick={() => setPanel("paid")}
                />
              )}
              {d.can.status && sh.totp_on && (
                <ActionCard
                  icon="key"
                  title={t("Turn off the 2-step code", "إيقاف رمز التحقق")}
                  line={t("Only after checking it is really the owner.", "فقط بعد التأكد أنه المالك فعلًا.")}
                  onClick={() => setPanel("totp")}
                />
              )}
              {d.can.status &&
                (suspended ? (
                  <ActionCard
                    icon="unlock"
                    title={t("Reactivate the store", "إعادة تفعيل المتجر")}
                    line={t("The merchant can sign in and sell again.", "يستطيع التاجر الدخول والبيع من جديد.")}
                    onClick={() => setPanel("reactivate")}
                  />
                ) : (
                  <ActionCard
                    icon="lock"
                    danger
                    title={t("Suspend the store", "إيقاف المتجر")}
                    line={t("Signs the merchant out and closes the store.", "يُخرج التاجر ويغلق المتجر.")}
                    onClick={() => setPanel("suspend")}
                  />
                ))}
            </section>
            {contact && <ContactDialog info={{ owner: sh.owner, email: sh.email, phone: sh.phone, storePhone: sh.store_phone }} onClose={() => setContact(false)} />}

            {panel && (
              <ActionPanel
                key={panel}
                panel={panel}
                d={d}
                close={() => setPanel(null)}
                done={(shop) => {
                  setPanel(null);
                  if (shop) setChanged({ on: d, shop });
                  s.reload();
                }}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info title={t("Owner", "المالك")}>
                <Line k={t("Name", "الاسم")} v={sh.owner} />
                <Line k={t("Signed up", "التسجيل")} v={f.dateTime(sh.signed_up)} />
                <Line k={t("Last sign-in", "آخر تسجيل دخول")} v={f.dateTime(sh.last_login_at)} />
                <Line k={t("Sign-ins", "مرات الدخول")} v={f.num(sh.login_count)} />
                <Line k={t("Last seen", "آخر ظهور")} v={f.ago(sh.last_seen_at)} />
                <Line k={t("2-step code", "رمز التحقق بخطوتين")} v={sh.totp_on ? t("On", "مفعّل") : t("Off", "غير مفعّل")} />
                <p className="pt-2 text-xs text-muted">{t("Email and mobile: Contact the merchant, above.", "البريد والجوال: «التواصل مع التاجر» في الأعلى.")}</p>
              </Info>
              <Info title={t("Store", "المتجر")}>
                {/* the store's only address: Dukkan's, followed by its link name (Dukkan connects no other domain) */}
                <Line
                  k={t("Store link", "رابط المتجر")}
                  v={
                    sh.slug ? (
                      /* on one line, cut with "…" when the card is narrow (the whole address in its tooltip), never broken
                         in the middle of a word */
                      <a href={storeLinkHref(sh.slug)} target="_blank" rel="noopener noreferrer" title={storeLink(sh.slug)} className="block truncate text-primary hover:underline">
                        {storeLink(sh.slug)}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                  ltr
                />
                <Line
                  k={t("Color", "اللون")}
                  v={
                    sh.color ? (
                      <span className="inline-flex items-center gap-2" dir="ltr">
                        <span className="h-4 w-4 rounded-full ring-1 ring-fg/20" style={{ background: /^#[0-9a-f]{6}$/i.test(sh.color) ? sh.color : undefined }} />
                        {sh.color}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Line k={t("Setup", "الإعداد")} v={`${sh.setup_done}/6`} />
                <Line
                  k={t("Published", "منشور")}
                  v={sh.published ? `${t("Yes", "نعم")}${sh.published_at ? ` · ${f.date(sh.published_at)}` : ""}` : t("No", "لا")}
                />
                {d.theme && <ThemeLine theme={d.theme} link={!!d.can.themes} />}
                <Line k={t("Paused for maintenance", "متوقف للصيانة")} v={sh.paused ? t("Yes", "نعم") : t("No", "لا")} />
                {/* the way it delivers, as the merchant chose it: Dukkan Ship, its own courier (by name), pickup only, or none yet.
                    A live store with no choice saved (from before one was asked for) delivers with Dukkan Ship by default
                    (safeOrder checkoutShipMode, server/shops.ts SHIP_SQL), pickup on or off */}
                <Line
                  k={t("Delivery", "التوصيل")}
                  v={(() => {
                    const way =
                      sh.ship_mode === "seen"
                        ? t("Dukkan Ship", "شحن دكّان")
                        : sh.ship_mode === "own"
                          ? sh.ship_name
                            ? t(`Own courier: ${sh.ship_name}`, `مندوب خاص: ${sh.ship_name}`)
                            : t("Own courier", "مندوب خاص")
                          : sh.published
                            ? t("Dukkan Ship (default, not chosen)", "شحن دكّان (تلقائي، لم يُختر)")
                            : null;
                    if (way) return sh.pickup ? `${way}${t(" · pickup too", " · والاستلام من المتجر")}` : way;
                    return sh.pickup ? t("Pickup only", "استلام من المتجر فقط") : t("Not chosen yet", "لم يُختر بعد");
                  })()}
                />
                <Line
                  k={t("Ways to pay", "طرق الدفع")}
                  v={sh.store_pays == null ? t("All Dukkan has on (not chosen)", "كل ما يتيحه دكّان (لم يختر)") : sh.store_pays === "" ? t("None yet", "لا شيء بعد") : sh.store_pays.split(",").map((p) => (p === "cliq" ? t("CliQ", "كليك") : p === "cash" ? t("Cash on delivery", "الدفع عند الاستلام") : t("Card", "بطاقة"))).join(" · ")}
                />
                {sh.ship_mode === "seen" && (
                  <>
                    <Line k={t("Pickup city", "مدينة الاستلام")} v={sh.pickup_city || "—"} />
                    <Line k={t("Pickup address", "عنوان الاستلام")} v={sh.pickup_address || "—"} />
                  </>
                )}
              </Info>
              <Info title={t("Status and numbers", "الحالة والأرقام")}>
                <Line k={t("Status", "الحالة")} v={<StatusBadge status={sh.status} />} />
                <Line k={t("Products", "المنتجات")} v={f.num(sh.product_count)} />
                {/* two figures, each labelled: what came through the store page (counted by Dukkan's server) and what the
                    merchant added himself (server/shops.ts STORE_PAGE_SQL) */}
                <Line k={t("Orders through the store page", "الطلبات عبر صفحة المتجر")} v={f.num(sh.store_orders ?? 0)} />
                <Line k={t("Orders the merchant added", "طلبات أضافها التاجر")} v={f.num(sh.hand_orders ?? 0)} />
                {(sh.storefront_test ?? 0) > 0 && <Line k={t("Test orders not counted", "طلبات تجريبية غير محسوبة")} v={f.num(sh.storefront_test ?? 0)} />}
                <Line k={t("Visitors, last 30 days", "الزوار، آخر 30 يومًا")} v={f.num(sh.visitors_30 ?? 0)} />
                <Line k={t("Sales through the store page", "المبيعات عبر صفحة المتجر")} v={f.jod(sh.store_sales ?? "0")} />
                <Line k={t("Sales the merchant added", "مبيعات أضافها التاجر")} v={f.jod(sh.hand_sales ?? "0")} />
                {/* a date, or why there is none: none yet, or some counted without the date of the first being recorded */}
                <Line
                  k={t("First product", "أول منتج")}
                  v={sh.first_product_at ? f.date(sh.first_product_at) : sh.product_count > 0 ? t("Not recorded", "غير مسجّل") : t("No products yet", "لا منتجات بعد")}
                />
                <Line
                  k={t("First order", "أول طلب")}
                  v={sh.first_order_at ? f.date(sh.first_order_at) : sh.order_count > 0 || (sh.storefront_orders ?? 0) > 0 ? t("Not recorded", "غير مسجّل") : t("No orders yet", "لا طلبات بعد")}
                />
                <p className="pt-2 text-xs text-muted">
                  {t(
                    "Store page figures are counted by Dukkan from the orders customers placed; added figures are the orders the merchant added himself, which Dukkan can't check. Card and CliQ test orders are not counted, and sales are the paid orders (delivered, or marked paid when added by hand), without cancelled and refunded ones.",
                    "أرقام صفحة المتجر يحسبها دكّان من الطلبات التي قدّمها العملاء، والأرقام المضافة هي طلبات أضافها التاجر بنفسه ولا يستطيع دكّان التحقق منها. الطلبات التجريبية بالبطاقة وكليك غير محسوبة، والمبيعات هي الطلبات المدفوعة (المُسلَّمة، أو المدفوعة إن أُضيفت يدويًا)، دون الملغاة والمستردة.",
                  )}
                </p>
              </Info>
            </div>

            {/* the store's history with Dukkan, newest first in each part */}
            <h2 className="mb-4 mt-10 text-xl font-extrabold tracking-tight">{t("History with Dukkan", "السجل مع دكّان")}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {d.payments && (
                <Part
                  title={t("Payments", "المدفوعات")}
                  count={d.payments.count}
                  note={d.payments.count ? t(`total ${f.jod(d.payments.total)}`, `المجموع ${f.jod(d.payments.total)}`) : undefined}
                  all={[{ href: `/diwan/payments?tab=store&shop=${id}`, label: t("See all", "عرض الكل") }]}
                  empty={t("No payments marked yet.", "لم تُسجَّل أي دفعة بعد.")}
                >
                  {d.payments.rows.map((r) => (
                    <Item key={r.id} lead={<b className="tabular-nums">{f.jod(r.amount)}</b>} sub={[f.date(r.paid_on), r.marked_by ? t(`marked by ${r.marked_by}`, `سجّلها ${r.marked_by}`) : "", r.reference].filter(Boolean).join(" · ")}>
                      <MethodBadge method={r.method} />
                    </Item>
                  ))}
                </Part>
              )}
              {d.themes && (
                <Part
                  title={t("Themes bought", "الثيمات المشتراة")}
                  count={d.themes.count}
                  all={[{ href: `/diwan/payments?tab=themes&shop=${id}`, label: t("See all", "عرض الكل") }]}
                  empty={t("No themes bought yet.", "لم تُشترَ أي ثيمات بعد.")}
                >
                  {d.themes.rows.map((r) => (
                    <Item
                      key={r.id}
                      lead={<b>{themeName(r)}</b>}
                      sub={[f.date(r.paid_at), Number(r.price) > 0 ? f.jod(r.price) : t("Free", "مجاني")].join(" · ")}
                    >
                      <span className="flex flex-col items-end gap-1">
                        {Number(r.price) > 0 ? <MethodBadge method={r.method} /> : <Badge>{t("Free", "مجاني")}</Badge>}
                        {d.theme?.id === r.theme_id && <Badge tone="primary">{t("In use", "مستخدم")}</Badge>}
                      </span>
                    </Item>
                  ))}
                </Part>
              )}
              {d.tickets && (
                <Part
                  title={t("Tickets", "التذاكر")}
                  count={d.tickets.count}
                  all={[
                    { href: `/diwan/tickets?shop=${id}`, label: t("Support tickets", "تذاكر الدعم") },
                    { href: `/diwan/feedback?shop=${id}`, label: t("Bugs and ideas", "الأخطاء والأفكار") },
                  ]}
                  empty={t("No tickets yet.", "لا توجد تذاكر بعد.")}
                >
                  {d.tickets.rows.map((r) => (
                    <Item
                      key={r.number}
                      lead={
                        <Link href={ticketHref(r.kind, r.number)} className="font-semibold hover:text-primary hover:underline">
                          <span dir="ltr" className="text-primary">#{r.number}</span>{" "}
                          {r.subject}
                        </Link>
                      }
                      sub={[
                        r.kind !== "support" ? t(KIND[r.kind].en, KIND[r.kind].ar) : "",
                        t(PRIORITY[r.priority]?.en ?? r.priority, PRIORITY[r.priority]?.ar ?? r.priority),
                        t(`updated ${f.ago(r.updated_at)}`, `آخر تحديث ${f.ago(r.updated_at)}`),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      {TICKET_STATUS[r.status] && <Badge tone={TICKET_STATUS[r.status].tone}>{t(TICKET_STATUS[r.status].en, TICKET_STATUS[r.status].ar)}</Badge>}
                    </Item>
                  ))}
                </Part>
              )}
              {d.documents && (
                <Part
                  title={t("Documents", "المستندات")}
                  count={d.documents.count}
                  all={[{ href: `/diwan/documents?shop=${id}&status=all`, label: t("See all", "عرض الكل") }]}
                  empty={t("No documents sent yet.", "لم تُرسل أي مستندات بعد.")}
                >
                  {d.documents.rows.map((r) => (
                    <Item
                      key={r.id}
                      lead={
                        <Link href={`/diwan/documents?shop=${id}&status=all#doc-${r.id}`} className="font-semibold hover:text-primary hover:underline">
                          {docName(r.kind)} <span dir="ltr" className="text-muted">#{String(r.seq).padStart(3, "0")}</span>
                        </Link>
                      }
                      sub={
                        r.removed_at
                          ? t(`sent ${f.date(r.created_at)} · removed ${f.date(r.removed_at)}`, `أُرسل ${f.date(r.created_at)} · حُذف ${f.date(r.removed_at)}`)
                          : t(`sent ${f.date(r.created_at)}`, `أُرسل ${f.date(r.created_at)}`)
                      }
                    >
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={docTone[r.status]}>{docStatus(r.status)}</Badge>
                        {r.removed_at && <Badge tone="grey">{t("Removed by the merchant", "حذفه التاجر")}</Badge>}
                      </div>
                    </Item>
                  ))}
                </Part>
              )}
              {d.reports && (
                <Part
                  title={t("Reports about this store", "بلاغات عن هذا المتجر")}
                  count={d.reports.count}
                  all={[{ href: `/diwan/complaints?shop=${id}`, label: t("See all", "عرض الكل") }]}
                  empty={t("No reports about this store.", "لا توجد بلاغات عن هذا المتجر.")}
                >
                  {d.reports.rows.map((r) => (
                    <Item
                      key={r.id}
                      lead={<b>{REASON_WORDS[r.reason] ? t(REASON_WORDS[r.reason].en, REASON_WORDS[r.reason].ar) : r.reason}</b>}
                      sub={[f.date(r.created_at), r.reporter_kind === "staff" ? t("found by staff", "وجده الفريق") : t("from a customer", "من عميل")].join(" · ")}
                    >
                      <Badge tone={reportTone[r.status]}>{reportStatus(r.status)}</Badge>
                    </Item>
                  ))}
                </Part>
              )}
              {d.deletions && (
                <Part title={t("Deleted orders", "الطلبات المحذوفة")} count={d.deletions.count} empty={t("No orders deleted.", "لم تُحذف أي طلبات.")}>
                  {d.deletions.rows.map((r, i) => (
                    <Item key={`${r.order_no}-${i}`} lead={<b dir="ltr">#{r.order_no}</b>} sub={[f.dateTime(r.deleted_at), r.deleted_by].filter(Boolean).join(" · ")}>
                      <span dir="auto" className="max-w-[12rem] truncate text-xs text-muted ltr:text-left rtl:text-right">{r.reason}</span>
                    </Item>
                  ))}
                </Part>
              )}
              {d.activity && (
                <Part
                  wide
                  title={t("Activity about this store", "النشاط على هذا المتجر")}
                  count={d.activity.count}
                  all={[{ href: `/diwan/activity?shop=${id}`, label: t("See all", "عرض الكل") }]}
                  empty={t("Nothing logged yet.", "لا يوجد نشاط مسجّل بعد.")}
                >
                  {d.activity.rows.map((r) => (
                    <Item key={r.id} lead={<span className="font-medium"><ActivityText row={r} /></span>} sub={[f.dateTime(r.at), r.staffName ?? "", r.reason ?? ""].filter(Boolean).join(" · ")} />
                  ))}
                </Part>
              )}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

const actionIcons: Record<string, React.ReactNode> = {
  mail: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </>
  ),
};

/** One action for the store: a large, clear button with its mark, its name and a line on what it does */
function ActionCard({ icon, title, line, onClick, danger = false }: { icon: string; title: string; line: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[5.5rem] items-start gap-3.5 rounded-xl bg-card p-4 text-start ring-1 transition hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 motion-reduce:hover:translate-y-0 ${
        danger ? "ring-red-500/25 hover:ring-red-500/50 focus-visible:ring-red-500" : "ring-fg/[0.08] hover:ring-primary/40 focus-visible:ring-primary"
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${danger ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {actionIcons[icon]}
        </svg>
      </span>
      <span className="min-w-0">
        <span className={`block text-[15px] font-bold ${danger ? "text-red-700 dark:text-red-300" : ""}`}>{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">{line}</span>
      </span>
    </button>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="mb-3 font-bold">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

/** "Theme in use": its name (to the Themes page, for staff who may open it), and whether it is free or bought. A store
    that never chose a theme uses Dukkan's default design, so it shows that one's name. */
function ThemeLine({ theme: th, link }: { theme: ThemeInUse; link: boolean }) {
  const t = useT();
  const n = th.name ?? findTheme(th.id)?.name;
  const name = (n && t(n.en, n.ar)) || th.id;
  const how =
    th.how === "bought" ? <Badge tone="primary">{t("Bought", "مُشترى")}</Badge>
    /* a paid theme with no purchase: customers see the store with the free theme (server/publicStore.ts) */
    : th.how === "not_bought" && th.shownFree ? <Badge tone="amber">{t("No purchase recorded: customers see the free theme", "لا يوجد شراء مسجّل: يرى العملاء الثيم المجاني")}</Badge>
    : th.how === "not_bought" ? <Badge tone="amber">{t("No purchase recorded", "لا يوجد شراء مسجّل")}</Badge>
    : <Badge tone="green">{t("Free", "مجاني")}</Badge>;
  return (
    <Line
      k={t("Theme in use", "الثيم المستخدم")}
      v={
        <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {link && th.kind !== "removed" ? (
            <Link href="/diwan/themes" className="text-primary hover:underline">
              <bdi>{name}</bdi>
            </Link>
          ) : (
            <bdi>{name}</bdi>
          )}
          {how}
          {th.kind === "removed" && <span className="w-full text-xs font-normal text-muted">{t("No longer in the theme list", "لم يعد في قائمة الثيمات")}</span>}
        </span>
      }
    />
  );
}

function Line({ k, v, ltr }: { k: string; v: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-end font-medium" dir={ltr ? "ltr" : undefined}>
        {v || "—"}
      </dd>
    </div>
  );
}

/** A part of the store's history: its title and count, its newest rows, and the links to the full lists */
function Part({ title, count, note, all, empty, wide, children }: { title: string; count: number; note?: string; all?: { href: string; label: string }[]; empty: string; wide?: boolean; children: React.ReactNode }) {
  const t = useT();
  const f = useFmt();
  return (
    <section className={`${card} flex flex-col p-0 ${wide ? "lg:col-span-2" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-fg/[0.07] px-5 py-3.5">
        <h3 className="font-bold">{title}</h3>
        <span className="rounded-full bg-fg/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">{f.num(count)}</span>
        {note && <span className="text-xs text-muted">{note}</span>}
        {!!count && !!all?.length && (
          <span className="ms-auto flex flex-wrap gap-3">
            {all.map((a) => (
              <Link key={a.href} href={a.href} className="text-sm font-semibold text-primary hover:underline">
                {a.label}
              </Link>
            ))}
          </span>
        )}
      </header>
      {count ? <ul className="divide-y divide-fg/[0.06]">{children}</ul> : <p className="px-5 py-6 text-sm text-muted">{empty}</p>}
      {count > 5 && <p className="border-t border-fg/[0.06] px-5 py-2 text-xs text-muted">{t(`The newest 5 of ${f.num(count)}`, `أحدث 5 من ${f.num(count)}`)}</p>}
    </section>
  );
}

function Item({ lead, sub, children }: { lead: React.ReactNode; sub?: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="break-words">{lead}</div>
        {sub && <p className="mt-0.5 break-words text-xs text-muted">{sub}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </li>
  );
}

/* ---------------- actions ---------------- */

function ActionPanel({ panel, d, close, done }: { panel: Exclude<Panel, null>; d: Detail; close: () => void; done: (shop?: Partial<Shop>) => void }) {
  const t = useT();
  const sh = d.shop;
  const base = `/api/diwan/shops/${sh.id}`;
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pay, setPay] = useState({ amount: "", method: "cliq", reference: "", paidOn: todayJo() });
  const [busy, setBusy] = useState(false);
  /* every action here needs the staff member's own password with it (server/staffConfirm.ts passwordAgain) */
  const [myPassword, setMyPassword] = useState("");
  /* a second press before the first answer is ignored at once (the busy state can arrive a frame late) */
  const sending = useRef(false);
  /* this form's key for a payment: the server saves one payment per key, however many times it arrives */
  const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("");
  const [payKey, setPayKey] = useState(newKey);
  const [error, setError] = useState("");

  const errors: Record<string, string> = {
    "reason-needed": t("Write a reason (at least 5 characters).", "اكتب السبب (5 أحرف على الأقل)."),
    invalid: t("Check the fields.", "تحقق من الحقول."),
    already: t("Already done.", "تم ذلك بالفعل."),
    "not-allowed": t("Your role can't do this.", "صلاحياتك لا تسمح بذلك."),
  };

  /* shop: what the store's state is once the server said yes, for the page to show before it has loaded again */
  const go = async (url: string, body: unknown, shop?: Partial<Shop>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    const r = await send(url, "POST", { ...(body as object), myPassword });
    sending.current = false;
    setBusy(false);
    if (!r.ok) return setError(passwordAgainWords(t, r.data) ?? errors[r.data?.result] ?? t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
    setMyPassword("");
    /* the next payment marked from this form is a new one */
    setPayKey(newKey());
    done(shop);
  };

  const reasonBox = (label: string, required = true) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && " *"}
      </span>
      {/* dir="auto": a reason written in Arabic runs right to left from its first letter */}
      <textarea rows={2} maxLength={500} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
    </label>
  );

  let title = "";
  let body: React.ReactNode = null;
  let submit: () => void = () => {};
  let ok = true;
  let danger = false;

  if (panel === "suspend") {
    title = t("Suspend this store", "إيقاف هذا المتجر");
    danger = true;
    ok = reason.trim().length >= 5;
    body = (
      <>
        <p className="text-sm text-muted">
          {t(
            "The merchant is signed out everywhere, can't sign in and can't save anything until the store is reactivated.",
            "يُسجَّل خروج التاجر من كل الأجهزة، ولا يستطيع الدخول أو الحفظ حتى يُعاد تفعيل المتجر.",
          )}
        </p>
        {/* the merchant reads it word for word on the suspended-store page (components/SuspendedNotice.tsx) */}
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {t(
            "The merchant sees this reason exactly as you write it: when they try to sign in, in any tab they had open, and in their notifications. Write it for them, calmly and clearly, and say what they can do.",
            "يرى التاجر هذا السبب كما تكتبه تمامًا: عند محاولة الدخول، وفي أي صفحة كانت مفتوحة لديه، وفي إشعاراته. اكتبه موجّهًا إليه بهدوء ووضوح، واذكر ما يمكنه فعله.",
          )}
        </p>
        {reasonBox(t("Reason shown to the merchant", "السبب الذي يظهر للتاجر"))}
      </>
    );
    submit = () =>
      go(`${base}/status`, { action: "suspend", reason }, { shop_status: "suspended", status: "suspended", suspend_reason: reason.trim(), suspended_at: new Date().toISOString() });
  } else if (panel === "reactivate") {
    title = t("Reactivate this store", "إعادة تفعيل هذا المتجر");
    body = reasonBox(t("Note (optional)", "ملاحظة (اختياري)"), false);
    submit = () =>
      go(`${base}/status`, { action: "reactivate", reason }, { shop_status: "active", status: sh.paused ? "paused" : "open", suspend_reason: null, suspended_at: null });
  } else if (panel === "totp") {
    title = t("Turn off the merchant's 2-step code", "إيقاف رمز التحقق للتاجر");
    ok = reason.trim().length >= 5;
    body = (
      <>
        <p className="text-sm text-muted">
          {t(
            "Only after checking it is really the owner (for example a call to the mobile on the account). Their next sign-in needs only the password.",
            "فقط بعد التأكد من أنه المالك فعلًا (مثلًا باتصال على جوال الحساب). يحتاج دخوله التالي إلى كلمة المرور فقط.",
          )}
        </p>
        {reasonBox(t("How you checked it is the owner", "كيف تأكدت من أنه المالك"))}
      </>
    );
    submit = () => go(`${base}/totp`, { reason });
  } else if (panel === "paid") {
    title = t("Mark a payment as received", "تسجيل دفعة مستلمة");
    ok = /^\d{1,7}(\.\d{1,3})?$/.test(pay.amount) && Number(pay.amount) > 0 && !!pay.paidOn;
    const P = (k: keyof typeof pay) => (v: string) => setPay((x) => ({ ...x, [k]: v }));
    body = (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Amount (JOD) *", "المبلغ (د.أ) *")}</span>
            <input inputMode="decimal" dir="ltr" value={pay.amount} onChange={(e) => P("amount")(latin(e.target.value).replace(/[^\d.]/g, ""))} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Method *", "الطريقة *")}</span>
            <Select label={t("Method", "الطريقة")} value={pay.method} onChange={P("method")} className="w-full" options={MARK_METHODS.map((m) => ({ value: m, label: methodText(t, m) }))} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Paid on *", "تاريخ الدفع *")}</span>
            <input type="date" value={pay.paidOn} max={todayJo()} onChange={(e) => P("paidOn")(e.target.value)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Reference", "المرجع")}</span>
            <input maxLength={100} dir="ltr" value={pay.reference} onChange={(e) => P("reference")(e.target.value)} className={field} />
          </label>
        </div>
        <input maxLength={300} dir="auto" placeholder={t("Note (optional)", "ملاحظة (اختياري)")} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
      </>
    );
    /* a payment on its own: Dukkan has no plans or free trial, so nothing is extended with it */
    submit = () => go(`${base}/payments`, { ...pay, note, key: payKey });
  }

  return (
    <section className={`${card} mb-6 space-y-4 ring-2 ${danger ? "ring-red-500/40" : "ring-primary/30"}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {body}
      <div className="max-w-sm">
        <OwnPasswordField t={t} value={myPassword} onChange={setMyPassword} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn kind={danger ? "danger" : "primary"} disabled={busy || !ok || !myPassword} onClick={submit}>
          {busy ? t("Working…", "جارٍ التنفيذ…") : t("Confirm", "تأكيد")}
        </Btn>
        <Btn kind="ghost" onClick={close}>
          {t("Cancel", "إلغاء")}
        </Btn>
      </div>
    </section>
  );
}
