"use client";

import { useEffect, useState } from "react";
import { LEGAL_PAGES, LIMITS, PAY_METHODS, type Bi, type PayMethod, type PlatformSettings, type SettingKey } from "@/components/diwan/platformSettings";
import { THEME_CATALOG } from "@/components/diwan/themeCatalog";
import { askConfirm } from "@/components/diwan/dialogs";
import { Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT } from "@/components/diwan/ui";

/* Platform settings (owners): each setting has its own form and its own Save, checked again by the server, and every save
   is written to the activity log with what it was before. The starter template is edited in the store designer.
   The merchant pages and the stores read them (components/platformPublic.ts; the server re-checks prices and ways to pay),
   so a save here reaches them: open pages pick it up within a minute or when their tab comes back into view. */

type Entry<K extends SettingKey> = { value: PlatformSettings[K]; saved: boolean; updatedAt: string | null; by: string | null };
type Data = { settings: { [K in SettingKey]: Entry<K> }; template: { updatedAt: string; by: string | null } | null };

export default function SettingsPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/settings");
  return (
    <div>
      <PageHead title={t("Platform settings", "إعدادات المنصة")} sub={t("What every store on Dukkan starts with and can choose from.", "ما تبدأ به كل المتاجر في دكّان وما تستطيع الاختيار منه.")} />
      <Loaded s={s}>
        {(d) => (
          <div className="grid gap-6 xl:grid-cols-2">
            <TemplateCard info={d.template} onChange={s.reload} />
            <TrialDays e={d.settings.trial_days} />
            <Payments e={d.settings.payment_methods} />
            <DefaultThemes e={d.settings.default_themes} />
            <Seo e={d.settings.seo_defaults} />
            <DomainPrices e={d.settings.domain_prices} />
            <DukkanShip e={d.settings.dukkan_ship} />
            <div className="xl:col-span-2">
              <Shipping e={d.settings.shipping_companies} />
            </div>
            <div className="xl:col-span-2">
              <LegalTemplates e={d.settings.store_legal_templates} />
            </div>
          </div>
        )}
      </Loaded>
    </div>
  );
}

/* ---------------- one setting's card ---------------- */

function useSaver<K extends SettingKey>(key: K, e: Entry<K>) {
  const [value, setValue] = useState<PlatformSettings[K]>(e.value);
  const [info, setInfo] = useState({ updatedAt: e.updatedAt, by: e.by });
  const [state, setState] = useState<"idle" | "busy" | "saved" | "bad">("idle");
  useEffect(() => setValue(e.value), [e.value]);
  const save = async (v: PlatformSettings[K] = value) => {
    setState("busy");
    const r = await send("/api/diwan/settings", "PUT", { key, value: v });
    if (r.ok) {
      setValue(r.data.value);
      setInfo({ updatedAt: new Date().toISOString(), by: null });
      setState("saved");
      setTimeout(() => setState((x) => (x === "saved" ? "idle" : x)), 2500);
    } else setState("bad");
  };
  return { value, setValue, save, state, info };
}

function Section({ title, sub, info, state, onSave, children }: {
  title: string; sub?: string; info: { updatedAt: string | null; by: string | null }; state: string; onSave: () => void; children: React.ReactNode;
}) {
  const t = useT();
  const f = useFmt();
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{title}</h2>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      <div className="mt-4 space-y-3">{children}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Btn onClick={onSave} disabled={state === "busy"}>{state === "busy" ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        {state === "saved" && <span className="text-sm text-emerald-600">{t("Saved", "تم الحفظ")}</span>}
        {state === "bad" && <span className="text-sm text-red-600">{t("Not saved: check the values.", "لم يُحفظ: تحقق من القيم.")}</span>}
        <span className="ms-auto text-xs text-muted">
          {info.updatedAt ? t(`Changed ${f.dateTime(info.updatedAt)}${info.by ? ` by ${info.by}` : ""}`, `عُدّل ${f.dateTime(info.updatedAt)}${info.by ? ` بواسطة ${info.by}` : ""}`) : t("Never changed: the starting value", "لم يُعدّل: القيمة الأولى")}
        </span>
      </div>
    </section>
  );
}

const label = "mb-1 block text-sm font-medium";

/* ---------------- the settings ---------------- */

function TrialDays({ e }: { e: Entry<"trial_days"> }) {
  const t = useT();
  const s = useSaver("trial_days", e);
  return (
    <Section title={t("Free trial", "الفترة التجريبية")} sub={t("How many days a new store is free.", "عدد الأيام المجانية لكل متجر جديد.")} info={s.info} state={s.state} onSave={() => s.save()}>
      <label htmlFor="set-trial" className={label}>{t("Days", "الأيام")}</label>
      <input id="set-trial" type="number" min={0} max={LIMITS.maxTrial} step={1} className={`${field} max-w-[10rem]`} value={s.value} onChange={(x) => s.setValue(Math.round(Number(x.target.value)))} />
    </Section>
  );
}

const PAY_NAMES = { cod: ["Cash on delivery", "الدفع عند الاستلام"], cliq: ["CliQ", "كليك"], card: ["Card", "البطاقة"], paypal: ["PayPal", "باي بال"] } as const;

/* How each way to pay is shown: its logo (cash has none, so a drawn note), and where Dukkan offers it. A store's checkout
   (components/storefront/Cart.tsx) offers cash, CliQ and card; buying a theme (components/ThemeStore.tsx) offers card,
   CliQ and PayPal. */
const PAY_LOOK: Record<PayMethod, { logo: string | null; h: string; store: boolean; themes: boolean }> = {
  cod: { logo: null, h: "", store: true, themes: false },
  cliq: { logo: "/logos/cliq-tight.png", h: "h-7", store: true, themes: true },
  card: { logo: "/logos/visa.png", h: "h-5", store: true, themes: true },
  paypal: { logo: "/logos/paypal.png", h: "h-5", store: false, themes: true },
};

type PayUse = { orders: number; ordersTotal: number; stores: number; themes: number; themesTotal: number; buyers: number };
const PERIODS = [["30", "Last 30 days", "آخر 30 يومًا"], ["90", "Last 90 days", "آخر 90 يومًا"], ["365", "Last year", "آخر سنة"], ["all", "All time", "كل الوقت"]] as const;

function Payments({ e }: { e: Entry<"payment_methods"> }) {
  const t = useT();
  const f = useFmt();
  const s = useSaver("payment_methods", e);
  /* how much each way to pay was used (app/api/diwan/payment-methods): orders in the stores and themes bought */
  const [days, setDays] = useState<(typeof PERIODS)[number][0]>("30");
  const stats = useApi<{ use: Record<PayMethod, PayUse> }>(`/api/diwan/payment-methods?days=${days}`);
  const jod = (n: number) => `${f.num(n)} ${t("JOD", "د.أ")}`;
  const set = (m: PayMethod, part: Partial<{ on: boolean; note: string }>) => s.setValue({ ...s.value, [m]: { ...s.value[m], ...part } });
  /* a checkout with every way to pay switched off takes no orders: said before saving, not discovered by a merchant */
  const storeOff = PAY_METHODS.every((m) => !PAY_LOOK[m].store || !s.value[m].on);
  const themesOff = PAY_METHODS.every((m) => !PAY_LOOK[m].themes || !s.value[m].on);
  return (
    <Section title={t("Payment methods", "طرق الدفع")} sub={t("Switch a way to pay on or off; the checkouts offer only the ones on, with the note you write under each.", "شغّل طريقة دفع أو أوقفها؛ صفحات الدفع تعرض المفعّلة فقط، مع الملاحظة التي تكتبها لكل منها.")} info={s.info} state={s.state} onSave={() => s.save()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("Use and money processed", "الاستخدام والمبالغ المدفوعة")}</p>
        <select aria-label={t("Period", "الفترة")} className={`${field} !h-9 w-auto`} value={days} onChange={(x) => setDays(x.target.value as typeof days)}>
          {PERIODS.map(([v, en, ar]) => <option key={v} value={v}>{t(en, ar)}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PAY_METHODS.map((m) => {
          const on = s.value[m].on;
          const u = stats.data?.use[m];
          const look = PAY_LOOK[m];
          const name = t(PAY_NAMES[m][0], PAY_NAMES[m][1]);
          return (
            <div key={m} className={`rounded-2xl p-4 ring-1 transition ${on ? "bg-card ring-primary/40" : "bg-soft/60 ring-fg/10"}`}>
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-16 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/5 ${on ? "" : "opacity-50 grayscale"}`}>
                  {look.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={look.logo} alt="" className={`${look.h} w-auto max-w-[80%] object-contain`} />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{name}</p>
                  <p className={`text-xs font-semibold ${on ? "text-emerald-700 dark:text-emerald-300" : "text-muted"}`}>{on ? t("On", "مفعّلة") : t("Off", "متوقفة")}</p>
                </div>
                {/* a switch, read by screen readers as one */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={name}
                  onClick={() => set(m, { on: !on })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${on ? "bg-primary" : "bg-fg/20"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {look.store && <Badge tone={on ? "green" : "grey"}>{t("Store checkout", "الدفع في المتاجر")}</Badge>}
                {look.themes && <Badge tone={on ? "green" : "grey"}>{t("Buying themes", "شراء الثيمات")}</Badge>}
              </div>
              {/* the numbers for this way to pay, in the chosen period */}
              <dl className="mt-3 grid gap-2 rounded-xl bg-soft/70 p-3 text-sm">
                {look.store && (
                  <div>
                    <dt className="text-xs text-muted">{t("Orders in stores", "طلبات المتاجر")}</dt>
                    <dd className="font-bold tabular-nums">
                      {stats.loading && !u ? "…" : u ? <>{jod(u.ordersTotal)} <span className="font-normal text-muted">· {t(`${f.num(u.orders)} orders · ${f.num(u.stores)} stores`, `${f.num(u.orders)} طلب · ${f.num(u.stores)} متجر`)}</span></> : "—"}
                    </dd>
                  </div>
                )}
                {look.themes && (
                  <div>
                    <dt className="text-xs text-muted">{t("Themes bought", "ثيمات مشتراة")}</dt>
                    <dd className="font-bold tabular-nums">
                      {stats.loading && !u ? "…" : u ? <>{jod(u.themesTotal)} <span className="font-normal text-muted">· {t(`${f.num(u.themes)} bought · ${f.num(u.buyers)} stores`, `${f.num(u.themes)} عملية شراء · ${f.num(u.buyers)} متجر`)}</span></> : "—"}
                    </dd>
                  </div>
                )}
              </dl>
              <label htmlFor={`pay-note-${m}`} className="mt-3 block text-xs font-semibold text-muted">{t("Note shown under it (optional)", "ملاحظة تظهر تحتها (اختيارية)")}</label>
              <input
                id={`pay-note-${m}`}
                dir="auto"
                className={`${field} mt-1`}
                maxLength={LIMITS.note}
                disabled={!on}
                placeholder={m === "cliq" ? t("e.g. CliQ alias: dukkan", "مثال: اسم كليك: dukkan") : m === "cod" ? t("e.g. Cash or card to the courier", "مثال: نقدًا أو بالبطاقة للمندوب") : ""}
                value={s.value[m].note}
                onChange={(x) => set(m, { note: x.target.value })}
              />
            </div>
          );
        })}
      </div>
      {(storeOff || themesOff) && (
        <p role="alert" className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-200">
          {storeOff && themesOff
            ? t("Every way to pay is off: stores can't take orders and nobody can buy a theme.", "كل طرق الدفع متوقفة: لن تستقبل المتاجر طلبات ولن يستطيع أحد شراء ثيم.")
            : storeOff
              ? t("No way to pay is on for store checkouts: stores can't take orders.", "لا توجد طريقة دفع مفعّلة للدفع في المتاجر: لن تستقبل المتاجر طلبات.")
              : t("No way to pay is on for buying themes: nobody can buy a theme.", "لا توجد طريقة دفع مفعّلة لشراء الثيمات: لن يستطيع أحد شراء ثيم.")}
        </p>
      )}
    </Section>
  );
}

function DefaultThemes({ e }: { e: Entry<"default_themes"> }) {
  const t = useT();
  const s = useSaver("default_themes", e);
  const toggle = (id: string, on: boolean) => s.setValue(on ? [...s.value, id] : s.value.filter((x) => x !== id));
  return (
    <Section title={t("Default themes", "الثيمات الأساسية")} sub={t("The free themes every store has in My themes. None picked: Dukkan and Mada.", "الثيمات المجانية الموجودة لدى كل متجر في ثيماتي. إن لم تختر شيئًا: دكّان ومدى.")} info={s.info} state={s.state} onSave={() => s.save()}>
      {THEME_CATALOG.map((th) => (
        <label key={th.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={s.value.includes(th.id)} onChange={(x) => toggle(th.id, x.target.checked)} />
          <span className="font-medium">{t(th.name.en, th.name.ar)}</span>
          <code dir="ltr" className="text-xs text-muted">{th.id}</code>
          {th.price > 0 && <Badge>{th.price} JOD</Badge>}
        </label>
      ))}
    </Section>
  );
}

function Seo({ e }: { e: Entry<"seo_defaults"> }) {
  const t = useT();
  const s = useSaver("seo_defaults", e);
  const set = (k: keyof PlatformSettings["seo_defaults"], v: string) => s.setValue({ ...s.value, [k]: v });
  return (
    <Section title={t("Search engine defaults", "إعدادات محركات البحث")} sub={t("Used on a store's pages until the merchant writes his own.", "تُستخدم في صفحات المتجر حتى يكتب التاجر ما يخصه.")} info={s.info} state={s.state} onSave={() => s.save()}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="seo-te" className={label}>{t("Title ending (English)", "نهاية العنوان (إنجليزي)")}</label>
          <input id="seo-te" dir="ltr" className={field} maxLength={LIMITS.suffix} placeholder="| Dukkan" value={s.value.titleSuffix_en} onChange={(x) => set("titleSuffix_en", x.target.value)} />
        </div>
        <div>
          <label htmlFor="seo-ta" className={label}>{t("Title ending (Arabic)", "نهاية العنوان (عربي)")}</label>
          <input id="seo-ta" dir="rtl" className={field} maxLength={LIMITS.suffix} value={s.value.titleSuffix_ar} onChange={(x) => set("titleSuffix_ar", x.target.value)} />
        </div>
        <div>
          <label htmlFor="seo-de" className={label}>{t("Description (English)", "الوصف (إنجليزي)")}</label>
          <textarea id="seo-de" dir="ltr" rows={3} className={`${field} h-auto py-2`} maxLength={LIMITS.description} value={s.value.description_en} onChange={(x) => set("description_en", x.target.value)} />
        </div>
        <div>
          <label htmlFor="seo-da" className={label}>{t("Description (Arabic)", "الوصف (عربي)")}</label>
          <textarea id="seo-da" dir="rtl" rows={3} className={`${field} h-auto py-2`} maxLength={LIMITS.description} value={s.value.description_ar} onChange={(x) => set("description_ar", x.target.value)} />
        </div>
      </div>
    </Section>
  );
}

function DomainPrices({ e }: { e: Entry<"domain_prices"> }) {
  const t = useT();
  const s = useSaver("domain_prices", e);
  /* edited as rows, so an ending can be renamed or added; turned back into { ending: price } on save */
  const [rows, setRows] = useState(() => Object.entries(e.value).map(([ending, price]) => ({ ending, price: String(price) })));
  useEffect(() => setRows(Object.entries(s.value).map(([ending, price]) => ({ ending, price: String(price) }))), [s.value]);
  const save = () => {
    const out: Record<string, number> = {};
    for (const r of rows) if (r.ending.trim()) out[r.ending.trim().toLowerCase()] = Number(r.price);
    s.save(out);
  };
  return (
    <Section title={t("Domain prices", "أسعار النطاقات")} sub={t("Yearly price in JOD for each ending Dukkan sells. An ending not on this list is not sold.", "السعر السنوي بالدينار لكل نهاية يبيعها دكّان. النهاية غير الموجودة هنا لا تُباع.")} info={s.info} state={s.state} onSave={save}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={t("Ending", "النهاية")} dir="ltr" className={`${field} w-32`} placeholder=".com" maxLength={41} value={r.ending} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, ending: x.target.value } : y)))} />
          <input aria-label={t("Price (JOD)", "السعر (د.أ)")} type="number" min={0} step="0.001" className={`${field} w-32`} value={r.price} onChange={(x) => setRows(rows.map((y, j) => (j === i ? { ...y, price: x.target.value } : y)))} />
          <span className="text-xs text-muted">{t("JOD / year", "د.أ / سنة")}</span>
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="ms-auto text-sm text-red-600 hover:underline">{t("Remove", "حذف")}</button>
        </div>
      ))}
      {rows.length < LIMITS.endings && (
        <button type="button" onClick={() => setRows([...rows, { ending: "", price: "0" }])} className="text-sm font-semibold text-primary hover:underline">{t("+ Add an ending", "+ إضافة نهاية")}</button>
      )}
    </Section>
  );
}

function Shipping({ e }: { e: Entry<"shipping_companies"> }) {
  const t = useT();
  const s = useSaver("shipping_companies", e);
  const toRows = (v: PlatformSettings["shipping_companies"]) => v.map((c) => ({ name: c.name, phone: c.phone, cities: c.cities.join("، ") }));
  const [rows, setRows] = useState(() => toRows(e.value));
  useEffect(() => setRows(toRows(s.value)), [s.value]);
  const set = (i: number, k: "name" | "phone" | "cities", v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = () =>
    s.save(rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name, phone: r.phone, cities: r.cities.split(/[,،\n]/).map((c) => c.trim()).filter(Boolean) })));
  return (
    <Section title={t("Shipping companies", "شركات الشحن")} sub={t("Couriers stores can pick, and the cities each one reaches.", "شركات التوصيل التي تختار منها المتاجر، والمدن التي تصلها كل شركة.")} info={s.info} state={s.state} onSave={save}>
      {!rows.length && <p className="text-sm text-muted">{t("No shipping companies yet.", "لا توجد شركات شحن بعد.")}</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-fg/10 p-3 md:grid-cols-[1fr_12rem_2fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor={`sh-n${i}`}>{t("Name", "الاسم")}</label>
            <input id={`sh-n${i}`} className={field} maxLength={LIMITS.companyName} value={r.name} onChange={(x) => set(i, "name", x.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor={`sh-p${i}`}>{t("Phone (optional)", "الهاتف (اختياري)")}</label>
            <input id={`sh-p${i}`} dir="ltr" inputMode="tel" className={field} maxLength={LIMITS.phone} value={r.phone} onChange={(x) => set(i, "phone", x.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted" htmlFor={`sh-c${i}`}>{t("Cities, separated by commas", "المدن، تفصل بينها فواصل")}</label>
            <input id={`sh-c${i}`} className={field} value={r.cities} onChange={(x) => set(i, "cities", x.target.value)} />
          </div>
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="h-10 text-sm text-red-600 hover:underline">{t("Remove", "حذف")}</button>
        </div>
      ))}
      {rows.length < LIMITS.companies && (
        <button type="button" onClick={() => setRows([...rows, { name: "", phone: "", cities: "" }])} className="text-sm font-semibold text-primary hover:underline">{t("+ Add a company", "+ إضافة شركة")}</button>
      )}
    </Section>
  );
}

/* English and Arabic of one line, side by side */
function BiInputs({ id, value, onChange, max, labels }: { id: string; value: Bi; onChange: (v: Bi) => void; max: number; labels: [string, string] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-en`} className="mb-1 block text-xs text-muted">{labels[0]}</label>
        <input id={`${id}-en`} dir="ltr" className={field} maxLength={max} value={value.en} onChange={(x) => onChange({ ...value, en: x.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-ar`} className="mb-1 block text-xs text-muted">{labels[1]}</label>
        <input id={`${id}-ar`} dir="rtl" className={field} maxLength={max} value={value.ar} onChange={(x) => onChange({ ...value, ar: x.target.value })} />
      </div>
    </div>
  );
}

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

function DukkanShip({ e }: { e: Entry<"dukkan_ship"> }) {
  const t = useT();
  const s = useSaver("dukkan_ship", e);
  /* the price is typed as text, so a half-typed amount ("2.") is not turned into a number while it is typed */
  const [price, setPrice] = useState(String(e.value.price));
  useEffect(() => setPrice(String(s.value.price)), [s.value.price]);
  const set = (v: Partial<PlatformSettings["dukkan_ship"]>) => s.setValue({ ...s.value, ...v });
  /* empty rows are left out; a row with only one language is sent as it is, so the server refuses it and nothing half written is saved */
  const filled = (l: Bi[]) => l.filter((x) => x.en.trim() || x.ar.trim());
  const save = () => s.save({ ...s.value, price: Number(price), cities: filled(s.value.cities), features: filled(s.value.features) });
  return (
    <Section title={t("Dukkan Ship", "دكّان شب")} sub={t("Dukkan's own delivery: the flat price of each order (what a store's customer pays for delivery), the cities it picks up from and what merchants read about it.", "خدمة التوصيل الخاصة بدكّان: السعر الثابت لكل طلب (ما يدفعه عميل المتجر للتوصيل)، والمدن التي تستلم منها، وما يقرؤه التجار عنها.")} info={s.info} state={s.state} onSave={save}>
      <div>
        <label htmlFor="ship-price" className={label}>{t("Price per order (JOD)", "السعر لكل طلب (د.أ)")}</label>
        <input id="ship-price" type="number" min={0} max={LIMITS.shipPrice} step="0.001" dir="ltr" className={`${field} max-w-[10rem]`} value={price} onChange={(x) => setPrice(x.target.value)} />
      </div>
      <div>
        <p className={label}>{t("Pickup cities (English, Arabic)", "مدن الاستلام (إنجليزي، عربي)")}</p>
        <BiRows name={t("City", "مدينة")} rows={s.value.cities} setRows={(cities) => set({ cities })} max={LIMITS.city} maxRows={LIMITS.shipCities} add={t("+ Add a city", "+ إضافة مدينة")} />
      </div>
      <div>
        <p className={label}>{t("Short policy under the price", "سياسة قصيرة تحت السعر")}</p>
        <BiInputs id="ship-policy" value={s.value.policy} onChange={(policy) => set({ policy })} max={LIMITS.shipPolicy} labels={[t("English", "إنجليزي"), t("Arabic", "عربي")]} />
      </div>
      <div>
        <p className={label}>{t("What it includes (English, Arabic)", "ما تشمله (إنجليزي، عربي)")}</p>
        <BiRows name={t("Point", "ميزة")} rows={s.value.features} setRows={(features) => set({ features })} max={LIMITS.shipFeature} maxRows={LIMITS.shipFeatures} add={t("+ Add a point", "+ إضافة ميزة")} />
      </div>
    </Section>
  );
}

const LEGAL_NAMES = { returns: ["Return policy", "سياسة الاسترجاع"], terms: ["Terms and conditions", "الأحكام والشروط"], privacy: ["Privacy policy", "سياسة الخصوصية"] } as const;

function LegalTemplates({ e }: { e: Entry<"store_legal_templates"> }) {
  const t = useT();
  const s = useSaver("store_legal_templates", e);
  return (
    <Section title={t("Store legal pages", "الصفحات القانونية للمتاجر")} sub={t("The return, terms and privacy pages a new store starts with. Each store edits its own copy; stores that already have their pages keep them.", "صفحات الاسترجاع والأحكام والخصوصية التي يبدأ بها كل متجر جديد. يعدّل كل متجر نسخته؛ والمتاجر التي لديها صفحاتها تحتفظ بها.")} info={s.info} state={s.state} onSave={() => s.save()}>
      {LEGAL_PAGES.map((k) => {
        const page = s.value[k];
        const set = (v: Partial<typeof page>) => s.setValue({ ...s.value, [k]: { ...page, ...v } });
        return (
          <fieldset key={k} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <legend className="px-1 text-sm font-semibold">{t(LEGAL_NAMES[k][0], LEGAL_NAMES[k][1])}</legend>
            <BiInputs id={`legal-${k}`} value={page.title} onChange={(title) => set({ title })} max={LIMITS.legalTitle} labels={[t("Title (English)", "العنوان (إنجليزي)"), t("Title (Arabic)", "العنوان (عربي)")]} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor={`legal-${k}-ben`} className="mb-1 block text-xs text-muted">{t("Text (English)", "النص (إنجليزي)")}</label>
                <textarea id={`legal-${k}-ben`} dir="ltr" rows={8} className={`${field} h-auto py-2`} maxLength={LIMITS.legalBody} value={page.body.en} onChange={(x) => set({ body: { ...page.body, en: x.target.value } })} />
              </div>
              <div>
                <label htmlFor={`legal-${k}-bar`} className="mb-1 block text-xs text-muted">{t("Text (Arabic)", "النص (عربي)")}</label>
                <textarea id={`legal-${k}-bar`} dir="rtl" rows={8} className={`${field} h-auto py-2`} maxLength={LIMITS.legalBody} value={page.body.ar} onChange={(x) => set({ body: { ...page.body, ar: x.target.value } })} />
              </div>
            </div>
          </fieldset>
        );
      })}
    </Section>
  );
}

function TemplateCard({ info, onChange }: { info: Data["template"]; onChange: () => void }) {
  const t = useT();
  const f = useFmt();
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    const yes = await askConfirm({
      title: t("Back to the original design", "العودة إلى التصميم الأصلي"),
      body: t("New stores will start from Dukkan's original design again. Continue?", "ستبدأ المتاجر الجديدة من تصميم دكّان الأصلي مجددًا. متابعة؟"),
    });
    if (!yes) return;
    setBusy(true);
    await send("/api/diwan/settings/template", "DELETE");
    setBusy(false);
    onChange();
  };
  return (
    <section className={card}>
      <h2 className="text-base font-bold">{t("Starter template", "القالب الأساسي")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("The design every new store begins with. It opens in the store designer, with sample products.", "التصميم الذي يبدأ به كل متجر جديد. يُفتح في مصمم المتجر مع منتجات تجريبية.")}</p>
      <p className="mt-3 text-sm">
        {info ? t(`Saved ${f.dateTime(info.updatedAt)}${info.by ? ` by ${info.by}` : ""}.`, `حُفظ ${f.dateTime(info.updatedAt)}${info.by ? ` بواسطة ${info.by}` : ""}.`) : t("Not made yet: new stores start from the original design.", "لم يُعدّ بعد: تبدأ المتاجر الجديدة من التصميم الأصلي.")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/design?template=1" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-deep">
          {t("Edit the starter template", "تعديل القالب الأساسي")}
        </a>
        {info && <Btn kind="ghost" disabled={busy} onClick={reset}>{t("Back to the original design", "العودة إلى التصميم الأصلي")}</Btn>}
      </div>
    </section>
  );
}
