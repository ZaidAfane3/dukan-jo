"use client";

import Link from "next/link";
import { useState } from "react";
import { METHODS, MethodBadge, methodText, Select, StatusBadge, storeLink, todayJo } from "@/components/diwan/shopBits";
import { area, Btn, card, DataTable, field, Loaded, PageHead, send, td, useApi, useFmt, useT } from "@/components/diwan/ui";

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
  pickup_city: string;
  pickup_address: string;
  shop_status: string;
  suspend_reason: string | null;
  suspended_at: string | null;
  product_count: number;
  order_count: number;
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
type Rows = Record<string, any>[];
type Detail = {
  shop: Shop;
  payments: Rows;
  domains: Rows;
  themes: Rows;
  tickets: Rows;
  deletions: Rows;
  reports: Rows;
  documents: Rows;
  visits: Rows;
  activity: Rows;
  can: { status: boolean; billing: boolean; impersonate: boolean; editAsMerchant: boolean };
};

type Panel = null | "suspend" | "reactivate" | "paid" | "impersonate" | "totp";

/* One shop: who owns it, how far it got, its payments, and everything other sections hold about it. Opening
   this page is written to the activity log. The actions are only shown to staff whose role allows them (the server
   checks again). */
export default function ShopPage({ params }: { params: { id: string } }) {
  const t = useT();
  const f = useFmt();
  const s = useApi<Detail>(`/api/diwan/shops/${encodeURIComponent(params.id)}`);
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <Loaded s={s}>
      {(d) => {
        const sh = d.shop;
        const suspended = sh.shop_status === "suspended";
        return (
          <>
            <Link href="/diwan/shops" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
              ← {t("Stores", "المتاجر")}
            </Link>
            <PageHead
              title={sh.name || t("(no name yet)", "(بلا اسم بعد)")}
              sub={sh.slug ? storeLink(sh.slug) : t("No store link chosen yet", "لم يُختر رابط المتجر بعد")}
              actions={
                <>
                  {d.can.impersonate && (
                    <Btn onClick={() => setPanel("impersonate")}>{t("Log in as merchant", "الدخول كتاجر")}</Btn>
                  )}
                  {d.can.billing && (
                    <Btn kind="ghost" onClick={() => setPanel("paid")}>
                      {t("Mark as paid", "تسجيل دفعة")}
                    </Btn>
                  )}
                  {d.can.status && sh.totp_on && (
                    <Btn kind="ghost" onClick={() => setPanel("totp")}>
                      {t("Turn off 2-step code", "إيقاف رمز التحقق")}
                    </Btn>
                  )}
                  {d.can.status &&
                    (suspended ? (
                      <Btn kind="ghost" onClick={() => setPanel("reactivate")}>
                        {t("Reactivate", "إعادة التفعيل")}
                      </Btn>
                    ) : (
                      <Btn kind="danger" onClick={() => setPanel("suspend")}>
                        {t("Suspend", "إيقاف المتجر")}
                      </Btn>
                    ))}
                </>
              }
            />

            {suspended && (
              <p className="mb-6 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300">
                <b>{t("Suspended", "موقوف")}</b> {f.dateTime(sh.suspended_at)} — {sh.suspend_reason}
                <span className="mt-1 block text-xs opacity-80">{t("The merchant sees this reason when they try to sign in.", "يرى التاجر هذا السبب عند محاولة الدخول.")}</span>
              </p>
            )}

            {panel && (
              <ActionPanel
                key={panel}
                panel={panel}
                d={d}
                close={() => setPanel(null)}
                done={() => {
                  setPanel(null);
                  s.reload();
                }}
              />
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info title={t("Owner", "المالك")}>
                <Line k={t("Name", "الاسم")} v={sh.owner} />
                <Line k={t("Email", "البريد")} v={sh.email} ltr />
                <Line k={t("Mobile", "الجوال")} v={sh.phone} ltr />
                <Line k={t("Signed up", "التسجيل")} v={f.dateTime(sh.signed_up)} />
                <Line k={t("Last sign-in", "آخر تسجيل دخول")} v={f.dateTime(sh.last_login_at)} />
                <Line k={t("Sign-ins", "مرات الدخول")} v={f.num(sh.login_count)} />
                <Line k={t("Last seen", "آخر ظهور")} v={f.ago(sh.last_seen_at)} />
                <Line k={t("2-step code", "رمز التحقق بخطوتين")} v={sh.totp_on ? t("On", "مفعّل") : t("Off", "غير مفعّل")} />
              </Info>
              <Info title={t("Store", "المتجر")}>
                <Line k={t("Link", "الرابط")} v={sh.slug ? storeLink(sh.slug) : "—"} ltr />
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
                <Line k={t("Store phone", "هاتف المتجر")} v={sh.store_phone || "—"} ltr />
                <Line k={t("Setup", "الإعداد")} v={`${sh.setup_done}/6`} />
                <Line
                  k={t("Published", "منشور")}
                  v={sh.published ? `${t("Yes", "نعم")}${sh.published_at ? ` · ${f.date(sh.published_at)}` : ""}` : t("No", "لا")}
                />
                <Line k={t("Paused for maintenance", "متوقف للصيانة")} v={sh.paused ? t("Yes", "نعم") : t("No", "لا")} />
                <Line k={t("Dukkan Ship", "شحن دكّان")} v={sh.ship_mode === "seen" ? t("Yes", "نعم") : sh.ship_mode === "own" ? t("Own delivery", "توصيل خاص") : "—"} />
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
                <Line k={t("Orders", "الطلبات")} v={f.num(sh.order_count)} />
                <Line k={t("Total sales", "إجمالي المبيعات")} v={f.jod(sh.total_sales)} />
                <Line k={t("First product", "أول منتج")} v={f.date(sh.first_product_at)} />
                <Line k={t("First order", "أول طلب")} v={f.date(sh.first_order_at)} />
                <p className="pt-2 text-xs text-muted">
                  {t("Total sales leave out cancelled and refunded orders.", "إجمالي المبيعات لا يشمل الطلبات الملغاة والمستردة.")}
                </p>
              </Info>
            </div>

            <div className="mt-8 space-y-8">
              <Section title={t("Payments", "المدفوعات")} empty={t("No payments yet.", "لا توجد مدفوعات بعد.")}
                head={[t("Paid on", "تاريخ الدفع"), t("Amount", "المبلغ"), t("Method", "الطريقة"), t("Reference", "المرجع"), t("Marked by", "سجّلها"), t("Note", "ملاحظة")]}
                rows={d.payments}
                row={(r) => [f.date(r.paid_on), f.jod(r.amount), <MethodBadge key="m" method={r.method} />, r.reference, r.marked_by ?? "—", r.note]}
              />
              <Section title={t("Support visits (log in as merchant)", "زيارات الدعم (الدخول كتاجر)")} empty={t("No visits yet.", "لا توجد زيارات بعد.")}
                head={[t("Started", "البداية"), t("Staff", "الموظف"), t("Reason", "السبب"), t("Mode", "النوع"), t("Ended", "الانتهاء")]}
                rows={d.visits}
                row={(r) => [f.dateTime(r.started_at), r.staff, r.reason, r.view_only ? t("View only", "عرض فقط") : t("Could change", "مع التعديل"), r.ended_at ? f.dateTime(r.ended_at) : new Date(r.ends_at) > new Date() ? t("Open now", "مفتوحة الآن") : f.dateTime(r.ends_at)]}
              />
              <Section title={t("Domains", "النطاقات")} empty={t("No domains yet.", "لا توجد نطاقات بعد.")}
                head={[t("Domain", "النطاق"), t("Kind", "النوع"), t("Status", "الحالة"), t("Renews", "التجديد"), t("Added", "أضيف")]}
                rows={d.domains}
                row={(r) => [<span key="n" dir="ltr">{r.name}</span>, r.kind === "bought" ? t("Bought", "مشترى") : t("Connected", "مربوط"), r.status, f.date(r.renews_at), f.date(r.created_at)]}
              />
              <Section title={t("Themes bought", "الثيمات المشتراة")} empty={t("No themes bought yet.", "لم تُشترَ أي ثيمات بعد.")}
                head={[t("Theme", "الثيم"), t("Price", "السعر"), t("Paid", "الدفع")]}
                rows={d.themes}
                row={(r) => [r.theme_id, f.jod(r.price), f.date(r.paid_at)]}
              />
              <Section title={t("Tickets", "التذاكر")} empty={t("No tickets yet.", "لا توجد تذاكر بعد.")}
                head={[t("Number", "الرقم"), t("Subject", "الموضوع"), t("Kind", "النوع"), t("Status", "الحالة"), t("Opened", "فُتحت")]}
                rows={d.tickets}
                row={(r) => [
                  <Link key="n" href={`/diwan/tickets/${r.number}`} className="font-semibold text-primary hover:underline">
                    #{r.number}
                  </Link>,
                  r.subject,
                  r.kind,
                  r.status,
                  f.date(r.created_at),
                ]}
              />
              <Section title={t("Deleted orders", "الطلبات المحذوفة")} empty={t("No orders deleted.", "لم تُحذف أي طلبات.")}
                head={[t("Order", "الطلب"), t("Reason", "السبب"), t("By", "بواسطة"), t("When", "متى")]}
                rows={d.deletions}
                row={(r) => [r.order_no, r.reason, r.deleted_by, f.dateTime(r.deleted_at)]}
              />
              <Section title={t("Store reports", "بلاغات المتجر")} empty={t("No reports about this store.", "لا توجد بلاغات عن هذا المتجر.")}
                head={[t("Reason", "السبب"), t("Status", "الحالة"), t("Received", "الاستلام")]}
                rows={d.reports}
                row={(r) => [r.reason, r.status, f.date(r.created_at)]}
              />
              <Section title={t("Documents", "المستندات")} empty={t("No documents yet.", "لا توجد مستندات بعد.")}
                head={[t("Kind", "النوع"), t("Name", "الاسم"), t("Status", "الحالة"), t("Sent", "الإرسال")]}
                rows={d.documents}
                row={(r) => [r.kind, r.name, r.status, f.date(r.created_at)]}
              />
              <Section title={t("Activity on this store", "النشاط على هذا المتجر")} empty={t("Nothing logged yet.", "لا يوجد نشاط مسجّل بعد.")}
                head={[t("When", "متى"), t("Staff", "الموظف"), t("Action", "الإجراء"), t("Reason", "السبب")]}
                rows={d.activity}
                row={(r) => [f.dateTime(r.at), r.staff ?? "—", <code key="a" className="text-xs">{r.action}</code>, r.reason ?? ""]}
              />
            </div>
          </>
        );
      }}
    </Loaded>
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

function Line({ k, v, ltr }: { k: string; v: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-end font-medium" dir={ltr ? "ltr" : undefined}>
        {v || "—"}
      </dd>
    </div>
  );
}

function Section({ title, head, rows, row, empty }: { title: string; head: string[]; rows: Rows; row: (r: Record<string, any>) => React.ReactNode[]; empty: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <DataTable head={head} empty={!rows.length && empty}>
        {rows.map((r, i) => (
          <tr key={r.id ?? r.number ?? i}>
            {row(r).map((c, j) => (
              <td key={j} className={td}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

/* ---------------- actions ---------------- */

function ActionPanel({ panel, d, close, done }: { panel: Exclude<Panel, null>; d: Detail; close: () => void; done: () => void }) {
  const t = useT();
  const sh = d.shop;
  const base = `/api/diwan/shops/${sh.id}`;
  const [reason, setReason] = useState("");
  const [viewOnly, setViewOnly] = useState(true);
  const [note, setNote] = useState("");
  const [pay, setPay] = useState({ amount: "", method: "cliq", reference: "", paidOn: todayJo() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const errors: Record<string, string> = {
    "reason-needed": t("Write a reason (at least 5 characters).", "اكتب السبب (5 أحرف على الأقل)."),
    invalid: t("Check the fields.", "تحقق من الحقول."),
    already: t("Already done.", "تم ذلك بالفعل."),
    "not-allowed": t("Your role can't do this.", "صلاحياتك لا تسمح بذلك."),
  };

  const go = async (url: string, body: unknown, after?: (data: any) => void) => {
    setBusy(true);
    setError("");
    const r = await send(url, "POST", body);
    setBusy(false);
    if (!r.ok) return setError(errors[r.data?.result] ?? t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
    if (after) after(r.data);
    else done();
  };

  const reasonBox = (label: string, required = true) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && " *"}
      </span>
      <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
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
    submit = () => go(`${base}/status`, { action: "suspend", reason });
  } else if (panel === "reactivate") {
    title = t("Reactivate this store", "إعادة تفعيل هذا المتجر");
    body = reasonBox(t("Note (optional)", "ملاحظة (اختياري)"), false);
    submit = () => go(`${base}/status`, { action: "reactivate", reason });
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
  } else if (panel === "impersonate") {
    title = t("Log in as merchant", "الدخول كتاجر");
    ok = reason.trim().length >= 5;
    body = (
      <>
        <p className="text-sm text-muted">
          {t(
            "Opens this store's dashboard in this browser for 30 minutes. The merchant gets a message that Dukkan support viewed the store, and the visit is logged.",
            "يفتح لوحة هذا المتجر في هذا المتصفح لمدة 30 دقيقة. تصل التاجر رسالة بأن دعم دكّان عرض المتجر، وتُسجَّل الزيارة.",
          )}
        </p>
        {reasonBox(t("Reason", "السبب"))}
        {d.can.editAsMerchant && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
            {t("View only (changes are refused)", "عرض فقط (تُرفض التعديلات)")}
          </label>
        )}
      </>
    );
    submit = () => go(`${base}/impersonate`, { reason, viewOnly }, () => (window.location.href = "/diwan/enter"));
  } else if (panel === "paid") {
    title = t("Mark a payment as received", "تسجيل دفعة مستلمة");
    ok = /^\d{1,7}(\.\d{1,3})?$/.test(pay.amount) && !!pay.paidOn;
    const P = (k: keyof typeof pay) => (v: string) => setPay((x) => ({ ...x, [k]: v }));
    body = (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Amount (JOD) *", "المبلغ (د.أ) *")}</span>
            <input inputMode="decimal" dir="ltr" value={pay.amount} onChange={(e) => P("amount")(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Method *", "الطريقة *")}</span>
            <Select label={t("Method", "الطريقة")} value={pay.method} onChange={P("method")} className="w-full" options={METHODS.map((m) => ({ value: m, label: methodText(t, m) }))} />
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
        <input maxLength={300} placeholder={t("Note (optional)", "ملاحظة (اختياري)")} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
      </>
    );
    /* a payment on its own: Dukkan has no plans for now, so nothing is extended with it */
    submit = () => go(`${base}/payments`, { ...pay, note });
  }

  return (
    <section className={`${card} mb-6 space-y-4 ring-2 ${danger ? "ring-red-500/40" : "ring-primary/30"}`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {body}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn kind={danger ? "danger" : "primary"} disabled={busy || !ok} onClick={submit}>
          {busy ? t("Working…", "جارٍ التنفيذ…") : t("Confirm", "تأكيد")}
        </Btn>
        <Btn kind="ghost" onClick={close}>
          {t("Cancel", "إلغاء")}
        </Btn>
      </div>
    </section>
  );
}
