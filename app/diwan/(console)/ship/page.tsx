"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LIMITS, type Bi, type DukkanShip } from "@/components/diwan/platformSettings";
import { Dialog } from "@/components/diwan/dialogs";
import { area, Badge, Btn, card, DataTable, field, Loaded, LoadMore, PageHead, send, td, useApi, useFmt, useMore, useT } from "@/components/diwan/ui";

/* Dukkan Ship, Dukkan's own delivery (owners). Its one price for every order and every city comes first: the checkout
   charges it on every new order of a store that delivers with Dukkan Ship (the server prices each order again from this
   setting, server/storeOrders.ts; an order already placed keeps the delivery fee it was placed with). Then the cities it
   picks up from and delivers to, what merchants read about it, and the stores that use it. Everything is the one
   platform setting "dukkan_ship", saved with PUT /api/diwan/settings (checked by the server, written to the activity log
   with what it was before and the reason). */

type History = { at: string; by: string | null; reason: string | null; from: number; to: number };
type Data = { value: DukkanShip; saved: boolean; updatedAt: string | null; by: string | null; stores: number; canSeeStores: boolean; history: History[] };

export default function ShipPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Data>("/api/diwan/ship");
  return (
    <div>
      <PageHead
        title={t("Dukkan Ship", "دكّان شب")}
        sub={
          s.data
            ? t(`Dukkan's own delivery. ${f.num(s.data.stores)} ${s.data.stores === 1 ? "store delivers" : "stores deliver"} with it.`, `خدمة التوصيل الخاصة بدكّان. ${f.num(s.data.stores)} متجر يوصّل بها.`)
            : t("Dukkan's own delivery.", "خدمة التوصيل الخاصة بدكّان.")
        }
      />
      <Loaded s={s}>
        {(d) => (
          <div className="space-y-6">
            <PriceCard d={d} onSaved={s.reload} />
            <div className="grid gap-6 xl:grid-cols-2">
              <Cities d={d} onSaved={s.reload} />
              <Words d={d} onSaved={s.reload} />
            </div>
            {d.canSeeStores ? (
              <Stores total={d.stores} />
            ) : (
              <p className={`${card} text-sm text-muted`}>{t(`${f.num(d.stores)} stores deliver with Dukkan Ship.`, `${f.num(d.stores)} متجر يوصّل بدكّان شب.`)}</p>
            )}
          </div>
        )}
      </Loaded>
    </div>
  );
}

/* who changed the setting last, and when (as Platform settings shows it) */
function ChangedLine({ d }: { d: Data }) {
  const t = useT();
  const f = useFmt();
  return (
    <span className="text-xs text-muted">
      {d.updatedAt
        ? t(`Changed ${f.dateTime(d.updatedAt)}${d.by ? ` by ${d.by}` : ""}`, `عُدّل ${f.dateTime(d.updatedAt)}${d.by ? ` بواسطة ${d.by}` : ""}`)
        : t("Never changed: the starting value", "لم يُعدّل: القيمة الأولى")}
    </span>
  );
}

/** Saves the whole Dukkan Ship setting with one part changed. Resolves to "" when saved, or what went wrong. */
async function saveShip(d: Data, part: Partial<DukkanShip>, reason = ""): Promise<string> {
  const r = await send("/api/diwan/settings", "PUT", { key: "dukkan_ship", value: { ...d.value, ...part }, reason });
  return r.ok ? "" : r.status === 400 ? "invalid" : "failed";
}

/* ---------------- the price ---------------- */

function PriceCard({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const t = useT();
  const f = useFmt();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "invalid" | "failed">("idle");
  const [saved, setSaved] = useState(false);
  const start = () => {
    setPrice(String(d.value.price));
    setReason("");
    setState("idle");
    setOpen(true);
  };
  /* the same rules as the server (platformSettings.ts dukkan_ship): 0 to LIMITS.shipPrice JOD, at most 3 decimals */
  const n = Number(price);
  const ok = /^\d{1,3}(\.\d{1,3})?$/.test(price.trim()) && n >= 0 && n <= LIMITS.shipPrice;
  const same = ok && n === d.value.price;
  const submit = async () => {
    if (!ok || same || state === "busy") return;
    setState("busy");
    const why = await saveShip(d, { price: n }, reason.trim());
    if (why) return setState(why as "invalid" | "failed");
    setOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
    onSaved();
  };
  return (
    <section className={`${card} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">{t("Delivery price for every order", "سعر التوصيل لكل طلب")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("The same price for every city.", "السعر نفسه لكل المدن.")}</p>
          <p className="mt-4 text-5xl font-extrabold tabular-nums tracking-tight">{f.jod(d.value.price)}</p>
          <p className="mt-2 text-sm text-muted">{t("What a customer pays for delivery on each order from a store that delivers with Dukkan Ship.", "ما يدفعه العميل للتوصيل في كل طلب من متجر يوصّل بدكّان شب.")}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Btn onClick={start}>{t("Change the price", "تغيير السعر")}</Btn>
          {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t("Price saved", "حُفظ السعر")}</span>}
        </div>
      </div>
      <div className="mt-4 border-t border-fg/10 pt-3">
        <ChangedLine d={d} />
      </div>

      <h3 className="mt-6 text-sm font-semibold">{t("Price changes", "تغييرات السعر")}</h3>
      {d.history.length ? (
        <ul className="mt-2 divide-y divide-fg/[0.06] text-sm">
          {d.history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
              <span className="font-semibold tabular-nums">
                {f.jod(h.from)} <span aria-hidden className="text-muted rtl:inline-block rtl:-scale-x-100">→</span>
                <span className="sr-only">{t(" to ", " إلى ")}</span> {f.jod(h.to)}
              </span>
              <span className="text-muted">{h.by ?? t("Someone removed", "عضو محذوف")}</span>
              <span className="text-muted">{f.dateTime(h.at)}</span>
              {h.reason && <span className="w-full text-xs text-muted">{t("Reason: ", "السبب: ")}{h.reason}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("The price has not been changed yet.", "لم يتغير السعر بعد.")}</p>
      )}

      {open && (
        <Dialog
          title={t("Change the delivery price", "تغيير سعر التوصيل")}
          body={t("One price for every order and every city.", "سعر واحد لكل طلب ولكل المدن.")}
          onClose={() => setOpen(false)}
          onSubmit={submit}
          busy={state === "busy"}
          footer={
            <>
              <Btn type="button" kind="ghost" onClick={() => setOpen(false)} disabled={state === "busy"}>{t("Cancel", "إلغاء")}</Btn>
              <Btn type="submit" disabled={!ok || same || state === "busy"}>{state === "busy" ? t("Saving…", "جارٍ الحفظ…") : t("Save the price", "حفظ السعر")}</Btn>
            </>
          }
        >
          <label htmlFor="ship-price" className="mb-1 block text-sm font-medium">{t("Price per order", "السعر لكل طلب")}</label>
          <div className="flex items-center gap-2">
            <input
              id="ship-price"
              data-autofocus
              type="number"
              inputMode="decimal"
              min={0}
              max={LIMITS.shipPrice}
              step="0.001"
              dir="ltr"
              className={`${field} max-w-[10rem] text-lg font-semibold tabular-nums`}
              value={price}
              onChange={(x) => setPrice(x.target.value)}
              aria-invalid={!ok}
              aria-describedby="ship-price-help"
            />
            <span className="text-sm font-semibold text-muted">{t("JOD", "د.أ")}</span>
          </div>
          <p id="ship-price-help" className={`mt-1 text-xs ${ok ? "text-muted" : "text-red-600 dark:text-red-400"}`}>
            {t(`From 0 to ${LIMITS.shipPrice} JOD, up to 3 decimals. 0 is free delivery.`, `من 0 إلى ${LIMITS.shipPrice} د.أ، حتى 3 خانات عشرية. 0 يعني توصيلًا مجانيًا.`)}
          </p>
          <label htmlFor="ship-reason" className="mb-1 mt-4 block text-sm font-medium">{t("Reason (optional, kept in the activity log)", "السبب (اختياري، يُحفظ في سجل النشاط)")}</label>
          <textarea id="ship-reason" rows={2} maxLength={300} className={area} value={reason} onChange={(x) => setReason(x.target.value)} />
          {ok && !same && (
            <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm ring-1 ring-primary/25">
              {t(`New orders will be charged ${f.jod(n)} for delivery; orders already placed keep their price.`, `ستُحتسب ${f.jod(n)} للتوصيل على الطلبات الجديدة؛ والطلبات السابقة تبقى بسعرها.`)}
            </p>
          )}
          {state === "invalid" && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{t("Not saved: the server refused this price.", "لم يُحفظ: رفض الخادم هذا السعر.")}</p>}
          {state === "failed" && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{t("Not saved. Try again.", "لم يُحفظ. حاول مجددًا.")}</p>}
        </Dialog>
      )}
    </section>
  );
}

/* ---------------- cities and words ---------------- */

/* A list of English and Arabic lines (cities, points) edited as rows */
function BiRows({ name, rows, setRows, max, maxRows, add }: { name: string; rows: Bi[]; setRows: (v: Bi[]) => void; max: number; maxRows: number; add: string }) {
  const t = useT();
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={`${name} ${i + 1} (${t("English", "إنجليزي")})`} dir="ltr" className={field} maxLength={max} value={r.en} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, en: x.target.value } : y)))} />
          <input aria-label={`${name} ${i + 1} (${t("Arabic", "عربي")})`} dir="rtl" className={field} maxLength={max} value={r.ar} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, ar: x.target.value } : y)))} />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="shrink-0 text-sm text-red-600 hover:underline dark:text-red-400">{t("Remove", "حذف")}</button>
        </div>
      ))}
      {rows.length < maxRows && (
        <button type="button" onClick={() => setRows([...rows, { en: "", ar: "" }])} className="text-sm font-semibold text-primary hover:underline">{add}</button>
      )}
    </div>
  );
}

/* empty rows are left out; a row with only one language is sent as it is, so the server refuses it and nothing half written is saved */
const filled = (l: Bi[]) => l.filter((x) => x.en.trim() || x.ar.trim());

function useSave(d: Data, onSaved: () => void) {
  const [state, setState] = useState<"idle" | "busy" | "saved" | "bad">("idle");
  const save = async (part: Partial<DukkanShip>) => {
    setState("busy");
    const why = await saveShip(d, part);
    if (why) return setState("bad");
    setState("saved");
    setTimeout(() => setState((x) => (x === "saved" ? "idle" : x)), 2500);
    onSaved();
  };
  return { state, save };
}

function SaveRow({ state, onSave, d }: { state: string; onSave: () => void; d: Data }) {
  const t = useT();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Btn onClick={onSave} disabled={state === "busy"}>{state === "busy" ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
      {state === "saved" && <span className="text-sm text-emerald-700 dark:text-emerald-300">{t("Saved", "تم الحفظ")}</span>}
      {state === "bad" && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{t("Not saved: check the values.", "لم يُحفظ: تحقق من القيم.")}</span>}
      <span className="ms-auto"><ChangedLine d={d} /></span>
    </div>
  );
}

function Cities({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const t = useT();
  const [rows, setRows] = useState(d.value.cities);
  useEffect(() => setRows(d.value.cities), [d.value.cities]);
  const s = useSave(d, onSaved);
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("Cities", "المدن")}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {t("Where Dukkan Ship picks orders up from a store and delivers them to customers: one list for both. A customer outside these cities can't choose delivery.", "المدن التي يستلم منها دكّان شب الطلبات من المتجر ويوصّلها إلى العملاء: قائمة واحدة للاثنين. العميل خارج هذه المدن لا يستطيع اختيار التوصيل.")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.value.cities.map((c) => (
          <span key={c.en} className="rounded-full bg-soft px-3 py-1 text-sm font-medium ring-1 ring-fg/10">{t(c.en, c.ar)}</span>
        ))}
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">{t("Edit the list (English, Arabic)", "تعديل القائمة (إنجليزي، عربي)")}</p>
        <BiRows name={t("City", "مدينة")} rows={rows} setRows={setRows} max={LIMITS.city} maxRows={LIMITS.shipCities} add={t("+ Add a city", "+ إضافة مدينة")} />
      </div>
      <SaveRow d={d} state={s.state} onSave={() => s.save({ cities: filled(rows) })} />
    </section>
  );
}

function Words({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const t = useT();
  const [policy, setPolicy] = useState(d.value.policy);
  const [features, setFeatures] = useState(d.value.features);
  useEffect(() => setPolicy(d.value.policy), [d.value.policy]);
  useEffect(() => setFeatures(d.value.features), [d.value.features]);
  const s = useSave(d, onSaved);
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("What merchants read", "ما يقرؤه التجار")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("Shown with the price when a merchant chooses how to deliver (setup and the Delivery page).", "يظهر مع السعر عندما يختار التاجر طريقة التوصيل (الإعداد وصفحة التوصيل).")}</p>
      <p className="mb-1 mt-4 text-sm font-medium">{t("Short line under the price", "سطر قصير تحت السعر")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label={t("Short line (English)", "السطر القصير (إنجليزي)")} dir="ltr" className={field} maxLength={LIMITS.shipPolicy} value={policy.en} onChange={(x) => setPolicy({ ...policy, en: x.target.value })} />
        <input aria-label={t("Short line (Arabic)", "السطر القصير (عربي)")} dir="rtl" className={field} maxLength={LIMITS.shipPolicy} value={policy.ar} onChange={(x) => setPolicy({ ...policy, ar: x.target.value })} />
      </div>
      <p className="mb-2 mt-4 text-sm font-medium">{t("What it includes (English, Arabic)", "ما تشمله (إنجليزي، عربي)")}</p>
      <BiRows name={t("Point", "ميزة")} rows={features} setRows={setFeatures} max={LIMITS.shipFeature} maxRows={LIMITS.shipFeatures} add={t("+ Add a point", "+ إضافة ميزة")} />
      <SaveRow d={d} state={s.state} onSave={() => s.save({ policy, features: filled(features) })} />
    </section>
  );
}

/* ---------------- the stores using it ---------------- */

type StoreRow = { id: string; name: string; slug: string | null; owner: string | null; city: string; status: "open" | "paused" | "suspended"; published: boolean; order_count: number };
type StoresData = { rows: StoreRow[]; total: number; page: number; pages: number };

function Stores({ total }: { total: number }) {
  const t = useT();
  const f = useFmt();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  /* the search runs a moment after typing stops */
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);
  const s = useMore<StoresData>(`/api/diwan/ship/stores?q=${encodeURIComponent(q)}`, (d) => (d.page < d.pages ? `page=${d.page + 1}` : null));
  const statusWord = (r: StoreRow) =>
    r.status === "suspended" ? <Badge tone="red">{t("Suspended", "موقوف")}</Badge>
      : r.status === "paused" ? <Badge tone="amber">{t("Paused", "متوقف مؤقتًا")}</Badge>
        : r.published ? <Badge tone="green">{t("Open", "مفتوح")}</Badge>
          : <Badge>{t("Not open yet", "لم يُفتح بعد")}</Badge>;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{t("Stores using Dukkan Ship", "المتاجر التي تستخدم دكّان شب")} <span className="font-normal text-muted">({f.num(total)})</span></h2>
          <p className="mt-0.5 text-sm text-muted">{t("Newest first. Search by store name or link, or an owner's full email or mobile.", "الأحدث أولًا. ابحث باسم المتجر أو رابطه، أو بالبريد أو الجوال الكامل للمالك.")}</p>
        </div>
        <input type="search" aria-label={t("Search stores", "ابحث في المتاجر")} placeholder={t("Search stores", "ابحث في المتاجر")} className={`${field} w-full sm:w-72`} value={typed} onChange={(x) => setTyped(x.target.value)} />
      </div>
      {s.error ? (
        <p role="alert" className={`${card} text-sm text-red-600 dark:text-red-400`}>{t("The stores couldn't be loaded.", "تعذّر تحميل المتاجر.")} <button type="button" className="font-semibold underline" onClick={s.reload}>{t("Try again", "حاول مجددًا")}</button></p>
      ) : (
        <DataTable
          head={[t("Store", "المتجر"), t("Link", "الرابط"), t("Pickup city", "مدينة الاستلام"), t("Status", "الحالة"), t("Orders", "الطلبات")]}
          empty={s.data && !s.data.rows.length ? (q ? t("No store matches this search.", "لا يوجد متجر يطابق هذا البحث.") : t("No store delivers with Dukkan Ship yet.", "لا يوجد متجر يوصّل بدكّان شب بعد.")) : false}
        >
          {(s.data?.rows ?? []).map((r) => {
            const name = r.name || t("Store with no name", "متجر بلا اسم");
            return (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/diwan/shops/${r.id}`} className="font-semibold text-primary hover:underline">{name}</Link>
                  {r.owner && r.owner !== r.name && <p className="text-xs text-muted">{r.owner}</p>}
                </td>
                <td className={td}>{r.slug ? <code dir="ltr" className="text-xs">/{r.slug}</code> : <span className="text-muted">—</span>}</td>
                <td className={td}>{r.city || <span className="text-muted">—</span>}</td>
                <td className={td}>{statusWord(r)}</td>
                <td className={`${td} tabular-nums`}>{f.num(r.order_count)}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <LoadMore s={s} total={s.data?.total} />
    </section>
  );
}
