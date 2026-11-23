"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { askConfirm, Dialog } from "./dialogs";
import { area, Badge, Btn, card, Empty, field, Loaded, LoadMore, refusedWords, send, useFmt, useMore, useT, type Tone } from "./ui";

/* Dukkan Ship's orders: every customer order of a store that delivers with Dukkan Ship, for Dukkan's staff to pick up
   at the store and deliver. Staff mark each one delivered or not delivered (with the reason). Marking it delivered
   also marks the merchant's own order delivered and puts a note in the merchant's bell (done by the server,
   PATCH /api/diwan/ship/orders/<id>). Live from GET /api/diwan/ship/orders, newest first, 50 at a time. */

type ShipState = "waiting" | "delivered" | "failed";
type ShipOrder = {
  id: string;
  number: number;
  createdAt: string;
  status: "pending" | "review" | "processing" | "shipping" | "delivered" | "cancelled" | "refunded";
  ship: { state: ShipState; note: string | null; at: string | null; by: string | null };
  store: { id: string; name: string; slug: string | null; phone: string; pickupCity: string; pickupAddress: string };
  customer: { name: string; phone: string | null; email: string | null; city: string | null; address: string | null; note: string | null };
  items: { name: string; qty: number; size?: string }[];
  total: number;
  delivery: number;
  pay: "cliq" | "cash" | "card";
  payment: "test" | "unpaid" | "paid";
};
type Tab = "waiting" | "delivered" | "failed" | "cancelled" | "all";
type Data = { result: "ok"; rows: ShipOrder[]; next: string | null; total: number; counts: Record<Tab, number> };

/* the merchant's own words for their order's status, as their Orders page shows them (components/ordersContent.ts) */
const MERCHANT_STATUS: Record<ShipOrder["status"], { en: string; ar: string }> = {
  pending: { en: "Awaiting payment", ar: "بانتظار الدفع" },
  review: { en: "Awaiting review", ar: "بانتظار المراجعة" },
  processing: { en: "Processing", ar: "قيد التنفيذ" },
  shipping: { en: "Out for delivery", ar: "جاري التوصيل" },
  delivered: { en: "Delivered", ar: "تم التوصيل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
  refunded: { en: "Refunded", ar: "مسترجع" },
};

/* Dukkan's delivery state as one word; an order the merchant cancelled or refunded before delivery is its own state */
const STATE: Record<Tab, { en: string; ar: string; tone: Tone }> = {
  waiting: { en: "To deliver", ar: "بانتظار التوصيل", tone: "amber" },
  delivered: { en: "Delivered", ar: "تم التوصيل", tone: "green" },
  failed: { en: "Not delivered", ar: "لم يُسلَّم", tone: "red" },
  cancelled: { en: "Cancelled by store", ar: "ألغاه المتجر", tone: "grey" },
  all: { en: "All", ar: "الكل", tone: "grey" },
};
const TABS: Tab[] = ["waiting", "delivered", "failed", "cancelled", "all"];

/* quick reasons for "Not delivered", so the courier doesn't type the common ones */
const REASONS = [
  { en: "Customer didn't answer", ar: "العميل لم يرد" },
  { en: "Wrong address", ar: "العنوان غير صحيح" },
  { en: "Customer refused the order", ar: "العميل رفض الطلب" },
];
const REASON_MAX = 300;

const stopped = (o: ShipOrder) => o.status === "cancelled" || o.status === "refunded";
/* what the badge says: cancelled only while Dukkan hadn't marked it yet (a delivered or failed mark stays shown) */
const stateOf = (o: ShipOrder): Tab => (o.ship.state === "waiting" && stopped(o) ? "cancelled" : o.ship.state);
/* a phone number as a tel: link (only digits and a leading +) */
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export function ShipOrders() {
  const t = useT();
  const f = useFmt();
  const [tab, setTab] = useState<Tab>("waiting");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  /* the search runs a moment after typing stops */
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);
  const s = useMore<Data>(`/api/diwan/ship/orders?tab=${tab}&q=${encodeURIComponent(q)}`, (d) => (d.next ? `before=${encodeURIComponent(d.next)}` : null));
  const [open, setOpen] = useState<string | null>(null);
  /* a line saying what was just done, since the order often leaves the list it was in (delivered leaves "To deliver") */
  const [done, setDone] = useState("");
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(""), 5000);
    return () => clearTimeout(id);
  }, [done]);

  if (s.error === "not-allowed") return <Loaded s={s}>{() => null}</Loaded>;

  const counts = s.data?.counts;
  const emptyWords = q
    ? t("No order matches this search.", "لا يوجد طلب يطابق هذا البحث.")
    : tab === "waiting" ? t("No order is waiting for delivery.", "لا يوجد طلب بانتظار التوصيل.")
      : tab === "delivered" ? t("No order has been delivered yet.", "لم يُوصَّل أي طلب بعد.")
        : tab === "failed" ? t("No order is marked not delivered.", "لا يوجد طلب مُعلَّم بأنه لم يُسلَّم.")
          : tab === "cancelled" ? t("No store cancelled an order before delivery.", "لم يلغِ أي متجر طلبًا قبل توصيله.")
            : t("No Dukkan Ship order yet.", "لا توجد طلبات شحن دكان بعد.");

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{t("Orders to pick up and deliver", "طلبات للاستلام والتوصيل")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {counts
              ? t(`${f.num(counts.waiting)} ${counts.waiting === 1 ? "order" : "orders"} to deliver. Newest first.`, `${f.num(counts.waiting)} طلب بانتظار التوصيل. الأحدث أولًا.`)
              : t("Newest first.", "الأحدث أولًا.")}
          </p>
        </div>
        <input
          type="search"
          aria-label={t("Search by store name or link, or order number", "ابحث باسم المتجر أو رابطه، أو برقم الطلب")}
          placeholder={t("Store or order number", "المتجر أو رقم الطلب")}
          className={`${field} w-full sm:w-72`}
          value={typed}
          onChange={(x) => setTyped(x.target.value)}
        />
      </div>

      {/* only the words on the tabs: the owner wants no numbers beside tabs in Diwan */}
      <div role="tablist" aria-label={t("Delivery state", "حالة التوصيل")} className="mb-4 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => (setTab(k), setOpen(null))}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
          >
            {t(STATE[k].en, STATE[k].ar)}
          </button>
        ))}
      </div>

      {done && <p role="status" className="mb-3 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300">{done}</p>}

      <Loaded s={s}>
        {(d) =>
          d.rows.length ? (
            <ul className="space-y-3">
              {d.rows.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  open={open === o.id}
                  onToggle={() => setOpen((x) => (x === o.id ? null : o.id))}
                  onChanged={(words) => {
                    setDone(words);
                    s.reload();
                  }}
                  onStale={s.reload}
                />
              ))}
            </ul>
          ) : (
            <div className={card}><Empty title={emptyWords} /></div>
          )
        }
      </Loaded>
      <LoadMore s={s} total={s.data?.total} />
    </section>
  );
}

/* ---------------- one order ---------------- */

function OrderCard({ o, open, onToggle, onChanged, onStale }: { o: ShipOrder; open: boolean; onToggle: () => void; onChanged: (words: string) => void; onStale: () => void }) {
  const t = useT();
  const f = useFmt();
  const detailsId = useId();
  const st = STATE[stateOf(o)];
  const pieces = o.items.reduce((n, x) => n + x.qty, 0);
  const storeName = o.store.name || t("Store with no name", "متجر بلا اسم");
  return (
    <li className={`${card} p-0`}>
      {/* the whole top opens the order; the Details button does the same for the keyboard */}
      <div
        className="cursor-pointer p-4 sm:p-5"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) return;
          onToggle();
        }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span dir="ltr" className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-[13px] font-bold text-primary ring-1 ring-primary/20">#{o.number}</span>
          <Badge tone={st.tone}>{t(st.en, st.ar)}</Badge>
          {o.payment === "test" && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-500/25 dark:text-sky-300">{t("Test order", "طلب تجريبي")}</span>}
          <span className="text-xs text-muted">{f.dateTime(o.createdAt)}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={onToggle}
            className="ms-auto text-sm font-semibold text-primary hover:underline"
          >
            {open ? t("Close", "إغلاق") : t("Details", "التفاصيل")}
          </button>
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("Pick up from", "الاستلام من")}</p>
            <Link href={`/diwan/shops/${o.store.id}`} className="font-semibold text-primary [overflow-wrap:anywhere] hover:underline">{storeName}</Link>
            <p className="text-xs text-muted">{o.store.pickupCity || "—"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("Deliver to", "التوصيل إلى")}</p>
            <p className="text-start font-semibold [overflow-wrap:anywhere]"><bdi>{o.customer.name || "—"}</bdi></p>
            <p className="text-xs text-muted">{o.customer.city || "—"}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted">{t(`${f.num(pieces)} ${pieces === 1 ? "piece" : "pieces"}`, `${f.num(pieces)} ${pieces === 1 ? "قطعة" : "قطع"}`)}</p>
            <p className="font-semibold tabular-nums">{f.jod(o.total)}</p>
            {o.pay === "cash" && (
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {t(`Cash on delivery: collect ${f.jod(o.total)}`, `الدفع عند الاستلام: حصّل ${f.jod(o.total)}`)}
              </p>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div id={detailsId} className="border-t border-fg/10 p-4 sm:p-5">
          <Details o={o} />
          <Actions o={o} onChanged={onChanged} onStale={onStale} />
        </div>
      )}
    </li>
  );
}

/* a label and its value, in a definition list */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const dash = <span className="text-muted">—</span>;

/* everything a courier needs: where to pick up, where to drop off, what is in it, what to collect */
function Details({ o }: { o: ShipOrder }) {
  const t = useT();
  const f = useFmt();
  const box = "rounded-xl bg-soft/60 p-4 ring-1 ring-fg/[0.06]";
  const head = "mb-1 text-sm font-bold";
  const pay = o.pay === "cash" ? t("Cash on delivery", "الدفع عند الاستلام") : o.pay === "cliq" ? t("CliQ", "كليك") : t("Card", "بطاقة");
  return (
    <div className="grid gap-4 text-sm lg:grid-cols-2">
      <section className={box}>
        <h3 className={head}>{t("Pick up", "الاستلام")}</h3>
        <dl>
          <Row label={t("Store", "المتجر")}>
            <Link href={`/diwan/shops/${o.store.id}`} className="text-primary hover:underline">{o.store.name || t("Store with no name", "متجر بلا اسم")}</Link>
            {o.store.slug && <code dir="ltr" className="ms-2 text-xs text-muted">/{o.store.slug}</code>}
          </Row>
          <Row label={t("Phone", "الهاتف")}>{o.store.phone ? <a dir="ltr" href={tel(o.store.phone)} className="text-primary hover:underline">{o.store.phone}</a> : dash}</Row>
          <Row label={t("City", "المدينة")}>{o.store.pickupCity || dash}</Row>
          <Row label={t("Address", "العنوان")}><span dir="auto">{o.store.pickupAddress || dash}</span></Row>
        </dl>
      </section>
      <section className={box}>
        <h3 className={head}>{t("Drop off", "التسليم")}</h3>
        <dl>
          <Row label={t("Customer", "العميل")}><span dir="auto">{o.customer.name || dash}</span></Row>
          <Row label={t("Phone", "الهاتف")}>{o.customer.phone ? <a dir="ltr" href={tel(o.customer.phone)} className="text-primary hover:underline">{o.customer.phone}</a> : dash}</Row>
          <Row label={t("Email", "البريد")}>{o.customer.email ? <a dir="ltr" href={`mailto:${o.customer.email}`} className="text-primary hover:underline">{o.customer.email}</a> : dash}</Row>
          <Row label={t("City", "المدينة")}>{o.customer.city || dash}</Row>
          <Row label={t("Address", "العنوان")}><span dir="auto">{o.customer.address || dash}</span></Row>
          {o.customer.note && <Row label={t("Customer's note", "ملاحظة العميل")}><span dir="auto" className="whitespace-pre-line">{o.customer.note}</span></Row>}
        </dl>
      </section>
      <section className={box}>
        <h3 className={head}>{t("Items", "المنتجات")}</h3>
        {o.items.length ? (
          <ul className="divide-y divide-fg/[0.06]">
            {o.items.map((x, i) => (
              <li key={i} className="flex gap-2 py-1.5">
                <span dir="ltr" className="shrink-0 font-semibold tabular-nums">{f.num(x.qty)} ×</span>
                <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">
                  {x.name}
                  {x.size && <span className="ms-1 text-muted">({t("size", "المقاس")} {x.size})</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("No items listed.", "لا توجد منتجات.")}</p>
        )}
        <dl className="mt-2 border-t border-fg/10 pt-2">
          <Row label={t("Delivery fee", "رسوم التوصيل")}><span className="tabular-nums">{f.jod(o.delivery)}</span></Row>
          <Row label={t("Total", "المجموع")}><span className="font-bold tabular-nums">{f.jod(o.total)}</span></Row>
          <Row label={t("Payment", "الدفع")}>{pay}</Row>
        </dl>
        {o.pay === "cash" && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 font-semibold text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300">
            {t(`Collect ${f.jod(o.total)} from the customer.`, `حصّل ${f.jod(o.total)} من العميل.`)}
          </p>
        )}
        {o.payment === "test" && <p className="mt-2 text-xs text-muted">{t("A test order: no payment is taken yet.", "طلب تجريبي: لا يُؤخذ أي مبلغ بعد.")}</p>}
      </section>
      <section className={box}>
        <h3 className={head}>{t("Status", "الحالة")}</h3>
        <dl>
          <Row label={t("The store's status", "حالة الطلب عند المتجر")}>{t(MERCHANT_STATUS[o.status].en, MERCHANT_STATUS[o.status].ar)}</Row>
          <Row label={t("Dukkan delivery", "توصيل دكان")}><Badge tone={STATE[stateOf(o)].tone}>{t(STATE[stateOf(o)].en, STATE[stateOf(o)].ar)}</Badge></Row>
          {o.ship.state !== "waiting" && (
            <Row label={t("Marked", "عُلِّم")}>
              {f.dateTime(o.ship.at)}
              {t(" by ", " بواسطة ")}
              {o.ship.by ?? t("someone removed", "عضو محذوف")}
            </Row>
          )}
          {o.ship.state === "failed" && o.ship.note && <Row label={t("Reason", "السبب")}><span dir="auto">{o.ship.note}</span></Row>}
        </dl>
      </section>
    </div>
  );
}

/* ---------------- marking it ---------------- */

/* what the server's answer means, in words (null when it worked) */
function useWhy() {
  const t = useT();
  return (r: { ok: boolean; status: number; data: any }) => {
    if (r.ok) return null;
    const res = r.data?.result;
    if (res === "review") return t("Not saved: the store hasn't reviewed this big order yet.", "لم يُحفظ: لم يراجع المتجر هذا الطلب الكبير بعد.");
    if (res === "cancelled" || r.status === 409) return t("Not saved: the store cancelled or refunded this order.", "لم يُحفظ: ألغى المتجر هذا الطلب أو استرجعه.");
    if (res === "none" || r.status === 404) return t("Not saved: this order is no longer there.", "لم يُحفظ: هذا الطلب لم يعد موجودًا.");
    const refused = refusedWords(t, r);
    if (refused) return `${t("Not saved:", "لم يُحفظ:")} ${refused}`;
    if (res === "invalid" || r.status === 400) return t("Not saved: the server refused this. Check the reason.", "لم يُحفظ: رفض الخادم هذا. تحقق من السبب.");
    return t("Not saved. Try again.", "لم يُحفظ. حاول مجددًا.");
  };
}

function Actions({ o, onChanged, onStale }: { o: ShipOrder; onChanged: (words: string) => void; onStale: () => void }) {
  const t = useT();
  const f = useFmt();
  const why = useWhy();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [failing, setFailing] = useState(false);
  const locked = stopped(o);
  /* a big order the merchant has not reviewed yet: the server refuses any mark until he accepts it */
  const inReview = o.status === "review";

  /* one change; a 404 or 409 means the list is out of date, so it is loaded again too */
  const mark = async (state: ShipState, note?: string): Promise<string | null> => {
    setBusy(true);
    setErr("");
    const r = await send(`/api/diwan/ship/orders/${encodeURIComponent(o.id)}`, "PATCH", note === undefined ? { state } : { state, note });
    setBusy(false);
    const w = why(r);
    if (w) {
      if (r.status === 404 || r.status === 409) onStale();
      return w;
    }
    onChanged(
      state === "delivered" ? t(`Order #${o.number} marked delivered.`, `عُلِّم الطلب #${o.number} بأنه تم توصيله.`)
        : state === "failed" ? t(`Order #${o.number} marked not delivered.`, `عُلِّم الطلب #${o.number} بأنه لم يُسلَّم.`)
          : t(`Order #${o.number} is back in To deliver.`, `عاد الطلب #${o.number} إلى بانتظار التوصيل.`),
    );
    return null;
  };

  const delivered = async () => {
    const yes = await askConfirm({
      title: t(`Mark order #${o.number} delivered?`, `تعليم الطلب #${o.number} بأنه تم توصيله؟`),
      body: o.pay === "cash"
        ? t(`Only once the customer has it and ${f.jod(o.total)} was collected. The store sees it as delivered and gets a note in its bell.`, `فقط بعد أن يستلمه العميل وتُحصَّل ${f.jod(o.total)}. يراه المتجر "تم التوصيل" وتصله ملاحظة في جرس الإشعارات.`)
        : t("Only once the customer has it. The store sees it as delivered and gets a note in its bell.", `فقط بعد أن يستلمه العميل. يراه المتجر "تم التوصيل" وتصله ملاحظة في جرس الإشعارات.`),
      confirm: t("Mark delivered", "تم التوصيل"),
    });
    if (!yes) return;
    const w = await mark("delivered");
    if (w) setErr(w);
  };

  const undo = async () => {
    const yes = await askConfirm({
      title: t(`Undo the mark on order #${o.number}?`, `التراجع عن تعليم الطلب #${o.number}؟`),
      body: t("It goes back to the orders to deliver.", "يعود إلى الطلبات بانتظار التوصيل."),
      confirm: t("Undo", "تراجع"),
    });
    if (!yes) return;
    const w = await mark("waiting");
    if (w) setErr(w);
  };

  return (
    <div className="mt-4">
      {locked ? (
        <p className="text-sm text-muted">{t("The store cancelled or refunded this order, so it can't be marked.", "ألغى المتجر هذا الطلب أو استرجعه، فلا يمكن تعليمه.")}</p>
      ) : inReview ? (
        <p className="text-sm text-muted">{t("The store hasn't reviewed this big order yet, so it can't be marked.", "لم يراجع المتجر هذا الطلب الكبير بعد، فلا يمكن تعليمه.")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {o.ship.state !== "delivered" && <Btn onClick={delivered} disabled={busy}>{t("Mark delivered", "تم التوصيل")}</Btn>}
          {o.ship.state !== "failed" && <Btn kind="ghost" onClick={() => (setErr(""), setFailing(true))} disabled={busy}>{t("Not delivered", "لم يُسلَّم")}</Btn>}
          {o.ship.state !== "waiting" && <Btn kind="ghost" onClick={undo} disabled={busy}>{t("Undo", "تراجع")}</Btn>}
          {busy && <span role="status" className="self-center text-sm text-muted">{t("Saving…", "جارٍ الحفظ…")}</span>}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
      {failing && <NotDelivered o={o} onClose={() => setFailing(false)} mark={mark} />}
    </div>
  );
}

/* asks why it couldn't be delivered: the reason is required (1 to 300 characters) and goes with the mark */
function NotDelivered({ o, onClose, mark }: { o: ShipOrder; onClose: () => void; mark: (state: ShipState, note?: string) => Promise<string | null> }) {
  const t = useT();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = note.trim().length > 0 && note.trim().length <= REASON_MAX;
  const submit = async () => {
    if (busy) return;
    if (!ok) return setErr(t("Write the reason first.", "اكتب السبب أولًا."));
    setBusy(true);
    const w = await mark("failed", note.trim());
    setBusy(false);
    if (w) return setErr(w);
    onClose();
  };
  return (
    <Dialog
      title={t(`Order #${o.number} not delivered`, `الطلب #${o.number} لم يُسلَّم`)}
      body={t("Why couldn't it be delivered? The reason is kept with the order.", "لماذا لم يُسلَّم؟ يُحفظ السبب مع الطلب.")}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      footer={
        <>
          <Btn type="button" kind="ghost" onClick={onClose} disabled={busy}>{t("Cancel", "إلغاء")}</Btn>
          <Btn type="submit" kind="danger" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Mark not delivered", "تعليمه بأنه لم يُسلَّم")}</Btn>
        </>
      }
    >
      <p className="mb-2 text-sm font-medium">{t("Quick reasons", "أسباب سريعة")}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REASONS.map((r) => {
          const words = t(r.en, r.ar);
          return (
            <button
              key={r.en}
              type="button"
              aria-pressed={note === words}
              onClick={() => (setNote(words), setErr(""))}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${note === words ? "bg-primary text-white" : "bg-soft ring-1 ring-fg/10 hover:bg-fg/[0.06]"}`}
            >
              {words}
            </button>
          );
        })}
      </div>
      <label htmlFor="ship-fail-note" className="mb-1 block text-sm font-medium">{t("Reason", "السبب")}</label>
      <textarea
        id="ship-fail-note"
        data-autofocus
        rows={3}
        maxLength={REASON_MAX}
        dir="auto"
        className={area}
        value={note}
        onChange={(x) => (setNote(x.target.value), setErr(""))}
        aria-invalid={!!err}
        aria-describedby="ship-fail-help"
      />
      <div id="ship-fail-help" className="mt-1 flex justify-between gap-3 text-xs">
        <span role={err ? "alert" : undefined} className="text-red-600 dark:text-red-400">{err}</span>
        <span className="tabular-nums text-muted" dir="ltr">{note.length} / {REASON_MAX}</span>
      </div>
    </Dialog>
  );
}
