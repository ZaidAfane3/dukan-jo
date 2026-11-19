"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LIMITS, type Bi, type DukkanShip } from "@/components/diwan/platformSettings";
import { Dialog } from "@/components/diwan/dialogs";
import { area, Badge, Btn, card, DataTable, field, Loaded, LoadMore, PageHead, send, td, useApi, useFmt, useMore, useT } from "@/components/diwan/ui";
import { ShipSkeleton } from "@/components/diwan/skeletons";
import { useUrlParam } from "@/components/diwan/shopBits";
import { ShipOrders } from "@/components/diwan/ShipOrders";
import { typedText, useListScroll, useListState } from "@/components/diwan/useListState";

/* Dukkan Ship, Dukkan's own delivery. Two tabs, kept in the address (?tab=settings) so a reload or a shared link opens
   the same one: Orders (the first), the customer orders of stores that deliver with it, for staff to pick up, deliver
   and mark (components/diwan/ShipOrders.tsx); and Settings. In Settings its one price for every order and every city
   comes first: the checkout charges it on every new order of a store that delivers with Dukkan Ship (the server prices each order again from this
   setting, server/storeOrders.ts; an order already placed keeps the delivery fee it was placed with). Then the cities it
   picks up from and delivers to, what merchants read about it, and the stores that use it. Everything is the one
   platform setting "dukkan_ship", saved with PUT /api/diwan/settings (checked by the server, written to the activity log
   with what it was before and the reason). */

type History = { id: string; at: string; by: string | null; reason: string | null; from: number; to: number };
/* cityCounts: the stores picking up from each city of value.cities (same order); goneCities: the pickup cities stores
   saved that are no longer on the list, with how many stores each */
type Data = {
  value: DukkanShip; saved: boolean; updatedAt: string | null; by: string | null; stores: number; canSeeStores: boolean;
  /* every recorded price change, newest first: the first page, the id to ask for the older ones from (null: no more), and
     whether the price now is not where the newest one ended (a change was never recorded) */
  history: History[]; historyNext?: string | null; historyGap?: boolean;
  cityCounts?: number[]; goneCities?: { city: string; n: number }[];
};

export default function ShipPage() {
  const t = useT();
  const f = useFmt();
  const [tabParam, setTab] = useUrlParam("tab");
  const tab = tabParam === "settings" ? "settings" : "orders";
  /* the settings load only when their tab is open */
  const s = useApi<Data>(tab === "settings" ? "/api/diwan/ship" : null);
  const tabs = [
    { key: "orders", label: t("Orders", "الطلبات") },
    { key: "settings", label: t("Settings", "الإعدادات") },
  ] as const;
  return (
    <div>
      <PageHead
        title={t("Dukkan Ship", "شحن دكّان")}
        sub={
          tab === "settings" && s.data
            ? `${t("Dukkan's own delivery.", "خدمة التوصيل الخاصة بدكّان.")} ${s.data.stores === 0 ? t("No store delivers with it yet.", "لا يوصّل بها أي متجر بعد.") : f.count(s.data.stores, ["store delivers with it.", "stores deliver with it."], { one: "يوصّل بها متجر واحد.", two: "يوصّل بها متجران.", few: "متاجر توصّل بها.", many: "متجرًا يوصّل بها." })}`
            : t("Dukkan's own delivery.", "خدمة التوصيل الخاصة بدكّان.")
        }
      />
      <div role="tablist" aria-label={t("Dukkan Ship", "شحن دكّان")} className="mb-6 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key === "orders" ? "" : x.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tab === x.key ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "orders" ? <ShipOrders /> : <Loaded s={s} skeleton={<ShipSkeleton />}>
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
              <p className={`${card} text-sm text-muted`}>{d.stores === 0 ? t("No store delivers with Dukkan Ship yet.", "لا يوصّل أي متجر عبر شحن دكّان بعد.") : f.count(d.stores, ["store delivers with Dukkan Ship.", "stores deliver with Dukkan Ship."], { one: "يوصّل متجر واحد عبر شحن دكّان.", two: "يوصّل متجران عبر شحن دكّان.", few: "متاجر توصّل عبر شحن دكّان.", many: "متجرًا يوصّل عبر شحن دكّان." })}</p>
            )}
          </div>
        )}
      </Loaded>}
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
        : d.history.length
          ? /* changes were recorded but the saved setting is gone: never "never changed" above a change */
            t("The saved setting wasn't found, so Dukkan Ship uses the starting values.", "لم يُعثر على الإعداد المحفوظ، لذا يستخدم شحن دكّان القيم الأولى.")
          : t("Never changed: the starting value", "لم يُعدّل: القيمة الأولى")}
    </span>
  );
}

/** Saves only the part of the Dukkan Ship setting one card changes; the server merges it into what is saved now, so
    another card's save never undoes it. Resolves to "" when saved, or what went wrong; `kept` gets the whole value
    the server saved (after its own clean-up, e.g. a city written twice kept once). */
async function saveShip(_d: Data, part: Partial<DukkanShip>, reason = "", kept?: (v: DukkanShip) => void): Promise<string> {
  const r = await send("/api/diwan/settings", "PUT", { key: "dukkan_ship", part, reason });
  if (r.ok && r.data?.value) kept?.(r.data.value as DukkanShip);
  return r.ok ? "" : r.status === 400 ? "invalid" : "failed";
}

/** A card's draft of one saved value. When the saved value changes (any card saved, the page reloaded it), the draft
    follows it only if it had no unsaved edits; unfinished edits are kept. */
function useDraft<T>(saved: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [draft, setDraft] = useState(saved);
  const last = useRef(JSON.stringify(saved));
  useEffect(() => {
    const now = JSON.stringify(saved);
    if (now === last.current) return;
    const before = last.current;
    last.current = now;
    setDraft((cur) => (JSON.stringify(cur) === before ? saved : cur));
  }, [saved]);
  return [draft, setDraft];
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
  /* the price the server just confirmed, shown at once over the page it was saved on: the reload behind it takes a moment
     on a slow connection, and until then the big price would still be the old one next to "Price saved". The fresh page
     replaces it. */
  const [justSaved, setJustSaved] = useState<{ on: Data; price: number } | null>(null);
  const current = justSaved && justSaved.on === d ? justSaved.price : d.value.price;
  /* the older price changes loaded with "Show older", kept only while the page they follow is the one shown (a reload
     starts again from the newest) */
  const [older, setOlder] = useState<{ on: Data; rows: History[]; next: string | null } | null>(null);
  const [olderState, setOlderState] = useState<"idle" | "busy" | "failed">("idle");
  const mine = older && older.on === d ? older : null;
  const history = mine ? [...d.history, ...mine.rows] : d.history;
  const next = mine ? mine.next : (d.historyNext ?? null);
  const showOlder = async () => {
    if (!next || olderState === "busy") return;
    setOlderState("busy");
    const r = await fetch(`/api/diwan/ship?before=${encodeURIComponent(next)}`, { credentials: "same-origin", cache: "no-store" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (!j || !Array.isArray(j.rows)) return setOlderState("failed");
    setOlder({ on: d, rows: [...(mine?.rows ?? []), ...j.rows], next: j.next ?? null });
    setOlderState("idle");
  };
  const start = () => {
    setPrice(String(current));
    setReason("");
    setState("idle");
    setOpen(true);
  };
  /* the same rules as the server (platformSettings.ts dukkan_ship): 0 to LIMITS.shipPrice JOD, at most 3 decimals */
  const n = Number(price);
  const ok = /^\d{1,3}(\.\d{1,3})?$/.test(price.trim()) && n >= 0 && n <= LIMITS.shipPrice;
  const same = ok && n === current;
  const submit = async () => {
    if (!ok || same || state === "busy") return;
    setState("busy");
    /* the price the server kept (its answer), or the one sent when the answer has none */
    let kept = n;
    const why = await saveShip(d, { price: n }, reason.trim(), (v) => {
      if (typeof v.price === "number") kept = v.price;
    });
    if (why) return setState(why as "invalid" | "failed");
    setJustSaved({ on: d, price: kept });
    setState("idle");
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
          <p className="mt-4 text-5xl font-extrabold tabular-nums tracking-tight">{f.jod(current)}</p>
          <p className="mt-2 text-sm text-muted">{t("What a customer pays for delivery on each order from a store that delivers with Dukkan Ship.", "ما يدفعه العميل للتوصيل في كل طلب من متجر يوصّل عبر شحن دكّان.")}</p>
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
      {d.historyGap && (
        <p className="mt-2 text-xs text-muted">
          {d.history.length
            ? t(
                `Some changes weren't recorded: the newest change listed ends at ${f.jod(d.history[0].to)}, but the price is ${f.jod(d.value.price)}.`,
                `بعض التغييرات لم تُسجَّل: آخر تغيير في القائمة ينتهي عند ${f.jod(d.history[0].to)}، لكن السعر ${f.jod(d.value.price)}.`,
              )
            : t("Earlier changes weren't recorded.", "تغييرات سابقة لم تُسجَّل.")}
        </p>
      )}
      {history.length ? (
        <ul className="mt-2 divide-y divide-fg/[0.06] text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
              <span className="font-semibold tabular-nums">
                {/* one arrow, read out as "to" (never the arrow and the word both) */}
                {f.jod(h.from)} <span role="img" aria-label={t("to", "إلى")} className="text-muted rtl:inline-block rtl:-scale-x-100">→</span> {f.jod(h.to)}
              </span>
              <span className="text-muted">{h.by ?? t("Someone removed", "عضو محذوف")}</span>
              <span className="text-muted">{f.dateTime(h.at)}</span>
              {h.reason && <span className="w-full text-xs text-muted">{t("Reason: ", "السبب: ")}{h.reason}</span>}
            </li>
          ))}
        </ul>
      ) : d.historyGap ? null : (
        <p className="mt-2 text-sm text-muted">{t("The price has not been changed yet.", "لم يتغير السعر بعد.")}</p>
      )}
      {next && (
        <div className="mt-3 flex flex-col items-start gap-1">
          <Btn kind="ghost" onClick={showOlder} disabled={olderState === "busy"}>
            {olderState === "busy" ? t("Loading…", "جارٍ التحميل…") : t("Show older changes", "عرض التغييرات الأقدم")}
          </Btn>
          {olderState === "failed" && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{t("Couldn't load more. Try again.", "تعذّر تحميل المزيد. حاول مجددًا.")}</p>}
        </div>
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
          <textarea id="ship-reason" dir="auto" rows={2} maxLength={300} className={area} value={reason} onChange={(x) => setReason(x.target.value)} />
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

/** After a save: the draft becomes what the server kept, unless it was edited again while the save was running (then
    the newer edits stay, still unsaved) */
const keepNewer = <T,>(cur: T, sent: T, kept: T): T => (JSON.stringify(cur) === JSON.stringify(sent) ? kept : cur);

/* empty rows are left out; a row with only one language is sent as it is, so the server refuses it and nothing half written is saved */
const filled = (l: Bi[]) => l.filter((x) => x.en.trim() || x.ar.trim());

function useSave(d: Data, onSaved: () => void) {
  const [state, setState] = useState<"idle" | "busy" | "saved" | "bad">("idle");
  /* `kept`: the card shows what the server really saved, not what was typed */
  const save = async (part: Partial<DukkanShip>, kept?: (v: DukkanShip) => void) => {
    setState("busy");
    const why = await saveShip(d, part, "", kept);
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
  const f = useFmt();
  const [rows, setRows] = useDraft(d.value.cities);
  const s = useSave(d, onSaved);
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("Cities", "المدن")}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {t("Where Dukkan Ship picks orders up from a store and delivers them to customers: one list for both. A customer outside these cities can't choose delivery.", "المدن التي يستلم منها شحن دكّان الطلبات من المتجر ويوصّلها إلى العملاء: قائمة واحدة للاثنين. العميل خارج هذه المدن لا يستطيع اختيار التوصيل.")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.value.cities.map((c, i) => (
          <span key={c.en} className="rounded-full bg-soft px-3 py-1 text-sm font-medium ring-1 ring-fg/10">
            {t(c.en, c.ar)}
            {/* a real space before "·" (not only a margin), so the words never run together, copied or read aloud */}
            {d.cityCounts && " "}
            {d.cityCounts && (
              <span className="ms-0.5 text-xs font-normal tabular-nums text-muted" title={t("Stores picking up from it", "متاجر يُستلم منها")}>
                {/* none: the number alone («إربد · 0»), the chip's title says what it counts */}
                {(d.cityCounts[i] ?? 0) === 0 ? `· ${f.num(0)}` : `· ${f.count(d.cityCounts[i] ?? 0, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}`}
              </span>
            )}
          </span>
        ))}
      </div>
      {/* stores whose saved pickup city was taken off the list: counted apart, never under a city Dukkan Ship serves */}
      {!!d.goneCities?.length && (
        <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm ring-1 ring-amber-500/25">
          <p className="font-semibold text-amber-900 dark:text-amber-200">{t("Pickup cities no longer served", "مدن استلام لم تعد مخدومة")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {t("These stores still have a city taken off the list. Their merchants are asked to choose another one.", "هذه المتاجر ما زالت على مدينة حُذفت من القائمة، ويُطلب من تجارها اختيار مدينة أخرى.")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.goneCities.map((g) => (
              <li key={g.city} className="rounded-full bg-card px-3 py-1 font-medium ring-1 ring-amber-500/30">
                <bdi>{g.city}</bdi>{" "}
                <span className="ms-0.5 text-xs font-normal tabular-nums text-muted">{`· ${f.count(g.n, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">{t("Edit the list (English, Arabic)", "تعديل القائمة (إنجليزي، عربي)")}</p>
        <BiRows name={t("City", "مدينة")} rows={rows} setRows={setRows} max={LIMITS.city} maxRows={LIMITS.shipCities} add={t("+ Add a city", "+ إضافة مدينة")} />
      </div>
      <SaveRow d={d} state={s.state} onSave={() => { const sent = filled(rows); void s.save({ cities: sent }, (v) => setRows((cur) => keepNewer(cur, rows, v.cities))); }} />
    </section>
  );
}

function Words({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const t = useT();
  const [policy, setPolicy] = useDraft(d.value.policy);
  const [features, setFeatures] = useDraft(d.value.features);
  const s = useSave(d, onSaved);
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("What merchants read", "ما يقرؤه التجار")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("Shown with the price when a merchant chooses how to deliver (setup and the Delivery page).", "يظهر مع السعر عندما يختار التاجر طريقة التوصيل (الإعداد وصفحة التوصيل).")}</p>
      <p className="mb-1 mt-4 text-sm font-medium">{t("Short line under the price", "سطر قصير تحت السعر")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <LineArea id="ship-policy-en" label={t("Short line (English)", "السطر القصير (إنجليزي)")} value={policy.en} onChange={(v) => setPolicy({ ...policy, en: v })} />
        <LineArea id="ship-policy-ar" label={t("Short line (Arabic)", "السطر القصير (عربي)")} value={policy.ar} onChange={(v) => setPolicy({ ...policy, ar: v })} />
      </div>
      <p className="mb-2 mt-4 text-sm font-medium">{t("What it includes (English, Arabic)", "ما تشمله (إنجليزي، عربي)")}</p>
      <BiRows name={t("Point", "ميزة")} rows={features} setRows={setFeatures} max={LIMITS.shipFeature} maxRows={LIMITS.shipFeatures} add={t("+ Add a point", "+ إضافة ميزة")} />
      <SaveRow
        d={d}
        state={s.state}
        onSave={() => {
          /* a line over the limit is refused here (its message is under it), never cut short on the way to the server */
          if (lineLength(policy.en) > LIMITS.shipPolicy || lineLength(policy.ar) > LIMITS.shipPolicy) {
            document.getElementById(lineLength(policy.en) > LIMITS.shipPolicy ? "ship-policy-en" : "ship-policy-ar")?.focus();
            return;
          }
          void s.save({ policy, features: filled(features) }, (v) => { setPolicy((cur) => keepNewer(cur, policy, v.policy)); setFeatures((cur) => keepNewer(cur, features, v.features)); });
        }}
      />
    </section>
  );
}

/* the length the server counts (components/safe.ts cleanLine: spaces run together, none at the ends) */
const lineLength = (v: string) => v.replace(/\s+/g, " ").trim().length;

/** The short line under the price: a box of two rows that grows with its text, so the whole line is always in view (the
    merchant pages show it whole too). It stays one line: Enter adds no line break. A counter shows near the limit; over
    it, a message, and the card's Save refuses it. */
function LineArea({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const t = useT();
  const f = useFmt();
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  const n = lineLength(value);
  const max = LIMITS.shipPolicy;
  const over = n > max;
  return (
    <div>
      <textarea
        ref={box}
        id={id}
        aria-label={label}
        aria-invalid={over}
        aria-describedby={`${id}-count`}
        dir="auto"
        rows={2}
        className={`${area} resize-none overflow-hidden ${over ? "border-red-500 focus:border-red-500" : ""}`}
        value={value}
        onKeyDown={(x) => x.key === "Enter" && x.preventDefault()}
        onChange={(x) => onChange(x.target.value.replace(/[\r\n]+/g, " "))}
      />
      <p id={`${id}-count`} aria-live="polite" className={`mt-1 text-xs ${over ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
        {over
          ? t(`Too long: ${f.num(n)} of ${f.num(max)} characters. Shorten it to save.`, `طويل جدًا: ${f.num(n)} من ${f.num(max)} حرفًا. اختصره لتحفظه.`)
          : n >= max * 0.8
            ? `${f.num(n)} / ${f.num(max)}`
            : ""}
      </p>
    </div>
  );
}

/* ---------------- the stores using it ---------------- */

type StoreRow = { id: string; name: string; slug: string | null; owner: string | null; city: string; status: "open" | "paused" | "suspended"; published: boolean; order_count: number; ship_orders?: number; served?: boolean };
type StoresData = { rows: StoreRow[]; total: number; page: number; pages: number };

/* the stores' search, kept in the address (?q=) so Back from a store brings the list back as it was */
const STORES_LIST = { q: typedText(100) };

function Stores({ total }: { total: number }) {
  const t = useT();
  const f = useFmt();
  const [list, setList] = useListState(STORES_LIST);
  const typed = list.q;
  const setTyped = (x: string) => setList({ q: x });
  const [q, setQ] = useState(typed.trim());
  /* the search runs a moment after typing stops */
  useEffect(() => {
    const id = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(id);
  }, [typed]);
  const s = useMore<StoresData>(`/api/diwan/ship/stores?q=${encodeURIComponent(q)}`, (d) => (d.page < d.pages ? `page=${d.page + 1}` : null));
  useListScroll(s);
  const statusWord = (r: StoreRow) =>
    r.status === "suspended" ? <Badge tone="red">{t("Suspended", "موقوف")}</Badge>
      : r.status === "paused" ? <Badge tone="amber">{t("Paused", "متوقف مؤقتًا")}</Badge>
        : r.published ? <Badge tone="green">{t("Open", "مفتوح")}</Badge>
          : <Badge>{t("Not open yet", "لم يُفتح بعد")}</Badge>;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{t("Stores using Dukkan Ship", "المتاجر التي تستخدم شحن دكّان")} <span className="font-normal text-muted">({f.num(total)})</span></h2>
          <p className="mt-0.5 text-sm text-muted">{t("Newest first. Search by store name or link, or an owner's full email or mobile.", "الأحدث أولًا. ابحث باسم المتجر أو رابطه، أو بالبريد أو الجوال الكامل للمالك.")}</p>
        </div>
        <input type="search" aria-label={t("Search stores", "ابحث في المتاجر")} placeholder={t("Search stores", "ابحث في المتاجر")} className={`${field} w-full sm:w-72`} value={typed} onChange={(x) => setTyped(x.target.value)} />
      </div>
      {s.error ? (
        <p role="alert" className={`${card} text-sm text-red-600 dark:text-red-400`}>{t("The stores couldn't be loaded.", "تعذّر تحميل المتاجر.")} <button type="button" className="font-semibold underline" onClick={s.reload}>{t("Try again", "حاول مجددًا")}</button></p>
      ) : (
        <DataTable
          head={[t("Store", "المتجر"), t("Link", "الرابط"), t("Pickup city", "مدينة الاستلام"), t("Status", "الحالة"), t("Orders", "الطلبات"), t("Dukkan Ship orders", "طلبات شحن دكّان")]}
          empty={s.data && !s.data.rows.length ? (q ? t("No store matches this search.", "لا يوجد متجر يطابق هذا البحث.") : t("No store delivers with Dukkan Ship yet.", "لا يوجد متجر يوصّل عبر شحن دكّان بعد.")) : false}
        >
          {/* while the first rows load: pulsing rows in the table's own columns, not bare headers (the empty message only
              shows once the answer is in) */}
          {!s.data &&
            [0, 1, 2, 3].map((i) => (
              <tr key={`sk-${i}`} aria-hidden className="animate-pulse motion-reduce:animate-none">
                {["w-32", "w-20", "w-16", "w-14", "w-8", "w-8"].map((w, j) => (
                  <td key={j} className={td}>
                    <div className={`h-3 rounded-full bg-fg/10 ${w}`} />
                    {j === 0 && <div className="mt-2 h-2.5 w-20 rounded-full bg-fg/[0.06]" />}
                  </td>
                ))}
              </tr>
            ))}
          {(s.data?.rows ?? []).map((r) => {
            const name = r.name || t("Store with no name", "متجر بلا اسم");
            return (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/diwan/shops/${r.id}`} className="font-semibold text-primary hover:underline">{name}</Link>
                  {r.owner && r.owner !== r.name && <p className="text-xs text-muted">{r.owner}</p>}
                </td>
                <td className={td}>{r.slug ? <code dir="ltr" className="text-xs">/{r.slug}</code> : <span className="text-muted">—</span>}</td>
                <td className={td}>
                  {r.city ? <bdi>{r.city}</bdi> : <span className="text-muted">—</span>}
                  {/* its saved pickup city was taken off Dukkan Ship's list: no courier collects from there now */}
                  {r.served === false && <p className="mt-0.5"><Badge tone="amber">{t("Pickup city no longer served", "مدينة الاستلام لم تعد مخدومة")}</Badge></p>}
                </td>
                <td className={td}>{statusWord(r)}</td>
                <td className={`${td} tabular-nums`}>{f.num(r.order_count)}</td>
                {/* the ones Dukkan Ship delivers (or was asked to); 0 until the server sends it */}
                <td className={`${td} tabular-nums`}>{f.num(r.ship_orders ?? 0)}</td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <LoadMore s={s} total={s.data?.total} />
    </section>
  );
}
