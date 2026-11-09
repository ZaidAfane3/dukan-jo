"use client";

import { useEffect, useState } from "react";
import { LIMITS, PAY_METHODS, type PlatformSettings, type SettingKey } from "@/components/diwan/platformSettings";
import { THEME_CATALOG } from "@/components/diwan/themeCatalog";
import { askConfirm } from "@/components/diwan/dialogs";
import { Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT } from "@/components/diwan/ui";

/* Platform settings (owners): each setting has its own form and its own Save, checked again by the server, and every save
   is written to the activity log with what it was before. The starter template is edited in the store designer. */

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
            <div className="xl:col-span-2">
              <Shipping e={d.settings.shipping_companies} />
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

function Payments({ e }: { e: Entry<"payment_methods"> }) {
  const t = useT();
  const s = useSaver("payment_methods", e);
  return (
    <Section title={t("Payment methods", "طرق الدفع")} sub={t("Which ways to pay stores can offer, with a note shown beside each.", "طرق الدفع التي تستطيع المتاجر تقديمها، مع ملاحظة بجانب كل منها.")} info={s.info} state={s.state} onSave={() => s.save()}>
      {PAY_METHODS.map((m) => (
        <div key={m} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={s.value[m].on} onChange={(x) => s.setValue({ ...s.value, [m]: { ...s.value[m], on: x.target.checked } })} />
            {t(PAY_NAMES[m][0], PAY_NAMES[m][1])}
          </label>
          <input aria-label={t("Note", "ملاحظة")} placeholder={t("Note (optional)", "ملاحظة (اختيارية)")} className={field} maxLength={LIMITS.note} value={s.value[m].note} onChange={(x) => s.setValue({ ...s.value, [m]: { ...s.value[m], note: x.target.value } })} />
        </div>
      ))}
    </Section>
  );
}

function DefaultThemes({ e }: { e: Entry<"default_themes"> }) {
  const t = useT();
  const s = useSaver("default_themes", e);
  const toggle = (id: string, on: boolean) => s.setValue(on ? [...s.value, id] : s.value.filter((x) => x !== id));
  return (
    <Section title={t("Default themes", "الثيمات الأساسية")} sub={t("Dukkan's own themes every new store gets.", "ثيمات دكّان التي يحصل عليها كل متجر جديد.")} info={s.info} state={s.state} onSave={() => s.save()}>
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
    <Section title={t("Domain prices", "أسعار النطاقات")} sub={t("Yearly price in JOD for each ending Dukkan sells.", "السعر السنوي بالدينار لكل نهاية يبيعها دكّان.")} info={s.info} state={s.state} onSave={save}>
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
