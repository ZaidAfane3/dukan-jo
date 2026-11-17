"use client";

import { useEffect, useState } from "react";
import { LEGAL_PAGES, LIMITS, okSupportEmail, okSupportNumber, PAY_METHODS, type Bi, type PayMethod, type PlatformSettings, type SettingKey, type SupportContact } from "@/components/diwan/platformSettings";
import { replyWithin, supportLinks } from "@/components/platformPublic";
import { latin } from "@/components/digits";
import { askConfirm, Dialog } from "@/components/diwan/dialogs";
import { PayLogo } from "@/components/diwan/shopBits";
import { Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT } from "@/components/diwan/ui";
import { SettingsSkeleton } from "@/components/diwan/skeletons";

/* Platform settings (owners): the ways to pay, how merchants reach Dukkan support, the legal pages new stores start with (locked: see LegalTemplates) and the
   starter template (edited in the store designer). Each setting has its own form and its own Save, checked again by the
   server, and every save is written to the activity log with what it was before. Dukkan Ship has its own page
   (/diwan/ship); the free themes and the search engine defaults are set in the code (components/platformDefaults.ts).
   The merchant pages and the stores read them (components/platformPublic.ts; the server re-checks prices and ways to pay),
   so a save here reaches them: open pages pick it up within a minute or when their tab comes back into view. */

type Entry<K extends SettingKey> = { value: PlatformSettings[K]; saved: boolean; updatedAt: string | null; by: string | null };
type Data = {
  settings: { [K in SettingKey]: Entry<K> };
  template: { updatedAt: string; by: string | null } | null;
  /* whether the signed-in staff member could unlock the legal pages: an owner, with a password of his own */
  legal: { owner: boolean; hasPassword: boolean };
};

export default function SettingsPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/settings");
  return (
    <div>
      <PageHead title={t("Platform settings", "إعدادات المنصة")} sub={t("What every store on Dukkan starts with and can choose from.", "ما تبدأ به كل المتاجر في دكّان وما تستطيع الاختيار منه.")} />
      <Loaded s={s} skeleton={<SettingsSkeleton />}>
        {(d) => (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {/* the ways to pay take the whole width: three cards side by side, each with room for its two notes */}
            <div className="xl:col-span-2">
              <Payments e={d.settings.payment_methods} />
            </div>
            <TemplateCard info={d.template} onChange={s.reload} />
            {/* how merchants reach support and how soon it answers, one above the other */}
            <div className="grid items-start gap-6">
              <Support e={d.settings.support_contact} />
              <ReplyTime e={d.settings.support_reply_hours} />
            </div>
            <div className="xl:col-span-2">
              <LegalTemplates e={d.settings.store_legal_templates} legal={d.legal} />
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


/* ---------------- the settings ---------------- */

/* what a note could say, in each language */
const NOTE_EXAMPLES: Partial<Record<PayMethod, Bi>> = {
  cliq: { en: "e.g. CliQ alias: dukkan", ar: "مثال: اسم كليك: dukkan" },
  cod: { en: "e.g. Cash or card to the courier", ar: "مثال: نقدًا أو بالبطاقة للمندوب" },
};

const PAY_NAMES = { cod: ["Cash on delivery", "الدفع عند الاستلام"], cliq: ["CliQ", "كليك"], card: ["Card", "البطاقة"] } as const;

/* How each way to pay is shown: its logo (cash has none, so a drawn note), and where Dukkan offers it. A store's checkout
   (components/storefront/Cart.tsx) offers cash, CliQ and card; buying a theme (components/ThemeStore.tsx) offers card
   and CliQ. */
const PAY_LOOK: Record<PayMethod, { store: boolean; themes: boolean }> = {
  cod: { store: true, themes: false },
  cliq: { store: true, themes: true },
  card: { store: true, themes: true },
};

/* a number still loading: the console's pulsing bar, not "…" */
function NumBar() {
  const t = useT();
  return (
    <span role="status" className="inline-flex h-5 items-center">
      <span aria-hidden className="inline-block h-3.5 w-32 animate-pulse rounded-full bg-fg/10 motion-reduce:animate-none" />
      <span className="sr-only">{t("Loading…", "جارٍ التحميل…")}</span>
    </span>
  );
}

type PayUse = { orders: number; ordersTotal: number; ordersTest?: boolean; stores: number; themes: number; themesTotal: number; buyers: number };
const PERIODS = [["30", "Last 30 days", "آخر 30 يومًا"], ["90", "Last 90 days", "آخر 90 يومًا"], ["365", "Last year", "آخر سنة"], ["all", "All time", "كل الوقت"]] as const;

function Payments({ e }: { e: Entry<"payment_methods"> }) {
  const t = useT();
  const f = useFmt();
  const s = useSaver("payment_methods", e);
  /* how much each way to pay was used (app/api/diwan/payment-methods): orders in the stores and themes bought */
  const [days, setDays] = useState<(typeof PERIODS)[number][0]>("30");
  const stats = useApi<{ use: Record<PayMethod, PayUse> }>(`/api/diwan/payment-methods?days=${days}`);
  const jod = (n: number) => `${f.num(n)} ${t("JOD", "د.أ")}`;
  const set = (m: PayMethod, part: Partial<{ on: boolean; note: Bi }>) => s.setValue({ ...s.value, [m]: { ...s.value[m], ...part } });
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
      {stats.error && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400">
          {t("The numbers couldn't be loaded.", "تعذّر تحميل الأرقام.")}
          <button type="button" onClick={stats.reload} className="font-semibold underline">{t("Try again", "حاول مجددًا")}</button>
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PAY_METHODS.map((m) => {
          const on = s.value[m].on;
          /* the numbers only for the period shown: none while the new period loads */
          const u = stats.loading ? undefined : stats.data?.use[m];
          const look = PAY_LOOK[m];
          const name = t(PAY_NAMES[m][0], PAY_NAMES[m][1]);
          return (
            <div key={m} className={`rounded-2xl p-4 ring-1 transition ${on ? "bg-card ring-primary/40" : "bg-soft/60 ring-fg/10"}`}>
              <div className="flex items-center gap-3">
                <PayLogo method={m} className="h-11 w-16 rounded-xl" dim={!on} />
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
                      {/* card and CliQ checkouts are test orders while no payment is taken: their total is not money received */}
                      {stats.loading ? <NumBar /> : u ? <>{jod(u.ordersTotal)} {u.ordersTest && <span className="font-normal text-amber-700 dark:text-amber-300">{t("(test, nothing charged)", "(تجريبية، لم يُخصم أي مبلغ)")}</span>} <span className="font-normal text-muted">· {f.count(u.orders, ["order", "orders"], { one: "طلب واحد", two: "طلبان", few: "طلبات", many: "طلبًا" })} · {f.count(u.stores, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}</span></> : "—"}
                    </dd>
                  </div>
                )}
                {look.themes && (
                  <div>
                    <dt className="text-xs text-muted">{t("Themes bought", "ثيمات مشتراة")}</dt>
                    <dd className="font-bold tabular-nums">
                      {stats.loading ? <NumBar /> : u ? <>{jod(u.themesTotal)} <span className="font-normal text-muted">· {f.count(u.themes, ["purchase", "purchases"], { one: "عملية شراء واحدة", two: "عمليتا شراء", few: "عمليات شراء", many: "عملية شراء" })} · {f.count(u.buyers, ["store", "stores"], { one: "متجر واحد", two: "متجران", few: "متاجر", many: "متجرًا" })}</span></> : "—"}
                    </dd>
                  </div>
                )}
              </dl>
              {/* the note in both languages: a checkout in Arabic shows the Arabic one, and the other one when it is empty */}
              <p className="mt-3 text-xs font-semibold text-muted">{t("Note shown under it (optional)", "ملاحظة تظهر تحتها (اختيارية)")}</p>
              <div className="mt-1 grid gap-2">
                {(["en", "ar"] as const).map((l) => (
                  <div key={l}>
                    <label htmlFor={`pay-note-${m}-${l}`} className="mb-1 block text-xs text-muted">{l === "en" ? t("English", "بالإنجليزية") : t("Arabic", "بالعربية")}</label>
                    <input
                      id={`pay-note-${m}-${l}`}
                      dir={l === "en" ? "ltr" : "rtl"}
                      className={field}
                      maxLength={LIMITS.note}
                      disabled={!on}
                      placeholder={NOTE_EXAMPLES[m]?.[l] ?? ""}
                      value={s.value[m].note[l]}
                      onChange={(x) => set(m, { note: { ...s.value[m].note, [l]: x.target.value } })}
                    />
                  </div>
                ))}
              </div>
              {/* one box written and the other empty (a note saved before notes had two languages comes in this way):
                  customers of the other language read it as it is */}
              {!s.value[m].note.en.trim() !== !s.value[m].note.ar.trim() && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
                  {t("Only one language saved so far: customers of the other language see this text as it is.", "حُفظت لغة واحدة فقط حتى الآن: يرى عملاء اللغة الأخرى هذا النص كما هو.")}
                </p>
              )}
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

/* Dukkan support's phone, WhatsApp and email: the one copy the suspended-store page and the website's contact lines show
   (they read it from /api/platform/settings on each visit). An empty field hides that way everywhere; the preview below
   is what a suspended merchant sees with what is typed now. */
function Support({ e }: { e: Entry<"support_contact"> }) {
  const t = useT();
  const s = useSaver("support_contact", e);
  const set = (part: Partial<SupportContact>) => s.setValue({ ...s.value, ...part });
  const bad = { phone: !okSupportNumber(s.value.phone), whatsapp: !okSupportNumber(s.value.whatsapp), email: !okSupportEmail(s.value.email) };
  /* only what would pass the server's check is previewed */
  const v = s.value;
  const shown = supportLinks({ support_contact: { phone: bad.phone ? "" : v.phone, whatsapp: bad.whatsapp ? "" : v.whatsapp, email: bad.email ? "" : v.email.trim() } });
  const fields = [
    ["phone", t("Phone", "الهاتف"), "+962 6 500 0000", t("8 to 15 digits; spaces and + are fine.", "من 8 إلى 15 رقمًا؛ يمكن استخدام المسافات و+.")],
    ["whatsapp", t("WhatsApp", "واتساب"), "+962 79 000 0000", t("8 to 15 digits; spaces and + are fine.", "من 8 إلى 15 رقمًا؛ يمكن استخدام المسافات و+.")],
    ["email", t("Email", "البريد الإلكتروني"), "support@example.com", t("That is not an email address.", "هذا ليس عنوان بريد إلكتروني.")],
  ] as const;
  const chip = "inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold";
  return (
    <Section
      title={t("Support contact", "التواصل مع الدعم")}
      sub={t("How merchants reach Dukkan's team: on the suspended-store page and in the website's contact lines. Leave one empty to hide it.", "كيف يصل التجار إلى فريق دكّان: في صفحة المتجر الموقوف وفي بيانات التواصل على الموقع. اترك أيًّا منها فارغًا لإخفائه.")}
      info={s.info}
      state={s.state}
      onSave={() => s.save()}
    >
      {fields.map(([k, label, example, problem]) => (
        <div key={k}>
          <label htmlFor={`support-${k}`} className="mb-1 block text-xs font-semibold text-muted">{label}</label>
          <input
            id={`support-${k}`}
            dir="ltr"
            type={k === "email" ? "email" : "tel"}
            inputMode={k === "email" ? "email" : "tel"}
            className={field}
            maxLength={k === "email" ? LIMITS.supportEmail : LIMITS.supportNumber}
            placeholder={example}
            value={s.value[k]}
            aria-invalid={bad[k]}
            aria-describedby={bad[k] ? `support-${k}-bad` : undefined}
            onChange={(x) => set({ [k]: x.target.value })}
          />
          {bad[k] && <p id={`support-${k}-bad`} className="mt-1 text-xs text-red-600 dark:text-red-400">{problem}</p>}
        </div>
      ))}
      {/* what the suspended-store page shows with these values */}
      <div className="rounded-xl bg-soft/70 p-3">
        <p className="text-xs font-semibold text-muted">{t("A suspended merchant sees", "يرى التاجر الموقوف متجره")}</p>
        {shown.tel || shown.whatsapp || shown.mailto ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {shown.tel && <span className={`${chip} bg-ink text-onink`}>{t("Call", "اتصال")}&nbsp;<span dir="ltr">{shown.phone}</span></span>}
            {shown.whatsapp && <span className={`${chip} bg-emerald-600 text-white`}>{t("WhatsApp", "واتساب")}</span>}
            {shown.mailto && <span className={`${chip} ring-1 ring-fg/15`} dir="ltr">{shown.email}</span>}
          </div>
        ) : (
          <p className="mt-1 text-sm">{t("No way to reach support: only “To sort this out, contact Dukkan's support team.”", "لا توجد طريقة للتواصل مع الدعم: تظهر فقط عبارة «لحلّ الأمر تواصل مع فريق دعم دكّان.»")}</p>
        )}
      </div>
    </Section>
  );
}

/* How soon Dukkan's support usually answers a ticket, in hours: the merchant Support page says "We usually reply within N
   hours." (components/platformPublic.ts replyWithin, previewed here with the same words). The server refuses anything
   but a whole number from 1 to 168. */
function ReplyTime({ e }: { e: Entry<"support_reply_hours"> }) {
  const t = useT();
  const s = useSaver("support_reply_hours", e);
  /* the box keeps what is typed (even half written); the saved value changes only on Save */
  const [text, setText] = useState(String(e.value));
  useEffect(() => setText(String(s.value)), [s.value]);
  const typed = latin(text).trim();
  const n = /^\d{1,3}$/.test(typed) ? Number(typed) : NaN;
  const ok = Number.isInteger(n) && n >= LIMITS.replyHoursMin && n <= LIMITS.replyHoursMax;
  return (
    <Section
      title={t("Support reply time", "مدة الرد على الدعم")}
      sub={t("How soon Dukkan's team usually answers a ticket. Merchants see it at the top of their Support page.", "المدة التي يرد خلالها فريق دكّان عادةً على التذكرة. يراها التاجر أعلى صفحة الدعم.")}
      info={s.info}
      state={s.state}
      /* a value that fails the rules is still sent (NaN goes as null), so the server refuses it and the card says so */
      onSave={() => void s.save(ok ? n : NaN)}
    >
      <div>
        <label htmlFor="support-reply-hours" className="mb-1 block text-xs font-semibold text-muted">{t("Hours", "الساعات")}</label>
        <input
          id="support-reply-hours"
          dir="ltr"
          type="text"
          inputMode="numeric"
          maxLength={3}
          className={`${field} w-32`}
          value={text}
          aria-invalid={!ok}
          aria-describedby={ok ? undefined : "support-reply-hours-bad"}
          onChange={(x) => setText(x.target.value)}
        />
        {!ok && <p id="support-reply-hours-bad" className="mt-1 text-xs text-red-600 dark:text-red-400">{t("A whole number of hours from 1 to 168 (one week).", "عدد ساعات صحيح من 1 إلى 168 (أسبوع).")}</p>}
      </div>
      <div className="rounded-xl bg-soft/70 p-3">
        <p className="text-xs font-semibold text-muted">{t("Merchants see", "يرى التاجر")}</p>
        <p className="mt-1 text-sm" dir="ltr">{replyWithin(ok ? n : s.value, "en")}</p>
        <p className="mt-0.5 text-sm" dir="rtl">{replyWithin(ok ? n : s.value, "ar")}</p>
      </div>
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

/* only for a page whose saved title is empty: the same names the starting pages have (platformSettings.ts LEGAL_DEFAULTS),
   so a page is never called two different things */
const LEGAL_NAMES = { returns: ["Return and exchange policy", "سياسة الاستبدال والاسترجاع"], terms: ["Terms and conditions", "الأحكام والشروط"], privacy: ["Privacy policy", "سياسة الخصوصية"] } as const;

const LockIcon = ({ open = false }: { open?: boolean }) => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d={open ? "M8 10.5V7a4 4 0 0 1 7.6-1.7" : "M8 10.5V7a4 4 0 0 1 8 0v3.5"} />
  </svg>
);

/* What the server answered when unlocking or saving, in words */
type LockProblem = "wrong" | "no-password" | "slow-down" | "owner-only" | "no-session" | "locked" | "failed";
const SERVER_PROBLEMS = ["wrong", "no-password", "slow-down", "owner-only", "no-session"] as const;

/* The legal pages every new store starts with. Locked by default: changing them changes what every new store's pages
   say, so only an owner can unlock them, by typing his own password again (checked by the server, which remembers it
   on this sign-in for 10 minutes and refuses to save without it). Saving locks them again, and so does leaving the page. */
function LegalTemplates({ e, legal }: { e: Entry<"store_legal_templates">; legal: Data["legal"] }) {
  const t = useT();
  const f = useFmt();
  const s = useSaver("store_legal_templates", e);
  const [unlocked, setUnlocked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<LockProblem | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "bad">("idle");
  const [info, setInfo] = useState({ updatedAt: e.updatedAt, by: e.by });
  /* the saved pages, to go back to when locking without saving */
  const [kept, setKept] = useState(e.value);
  useEffect(() => setKept(e.value), [e.value]);

  /* leaving the page (or locking) forgets the unlock on the server too */
  useEffect(() => {
    if (!unlocked) return;
    const lock = () => void fetch("/api/diwan/settings/unlock", { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {});
    window.addEventListener("pagehide", lock);
    /* the server's unlock lasts 10 minutes: the page locks itself at the same time */
    const timer = setTimeout(() => {
      setUnlocked(false);
      setProblem("locked");
    }, 10 * 60_000);
    return () => {
      window.removeEventListener("pagehide", lock);
      clearTimeout(timer);
      lock();
    };
  }, [unlocked]);
  /* locked again without a save: the unsaved changes go */
  useEffect(() => {
    if (!unlocked) s.setValue(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const save = async () => {
    setState("busy");
    setProblem(null);
    const r = await send("/api/diwan/settings", "PUT", { key: "store_legal_templates", value: s.value });
    if (r.ok) {
      setKept(r.data.value);
      s.setValue(r.data.value);
      setInfo({ updatedAt: new Date().toISOString(), by: null });
      setUnlocked(false);
      setState("saved");
      setTimeout(() => setState((x) => (x === "saved" ? "idle" : x)), 3000);
      return;
    }
    setState(r.status === 403 ? "idle" : "bad");
    if (r.status === 403) {
      /* the unlock ran out, or this staff member may not change them: locked again, the changes are not kept */
      setUnlocked(false);
      setProblem(r.data?.result === "owner-only" ? "owner-only" : "locked");
    }
  };

  const problemText = (p: LockProblem) =>
    ({
      wrong: t("That password is not right.", "كلمة المرور غير صحيحة."),
      "no-password": t("This account has no password, so it can't unlock these pages. Sign in with an owner account that has a password.", "هذا الحساب بلا كلمة مرور، لذلك لا يستطيع فتح قفل هذه الصفحات. سجّل الدخول بحساب مالك له كلمة مرور."),
      "slow-down": t("Too many tries. Wait 15 minutes, then try again.", "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجددًا."),
      "owner-only": t("Only an owner can change these.", "يستطيع المالك فقط تغيير هذه الصفحات."),
      "no-session": t("Your sign-in can't hold the unlock. Sign out, sign in again and try once more.", "جلستك لا تحتفظ بفتح القفل. سجّل الخروج ثم الدخول وحاول مرة أخرى."),
      locked: t("Locked again: an unlock lasts 10 minutes. Your changes were not saved; unlock to change them again.", "أُعيد القفل: فتح القفل يدوم 10 دقائق. لم تُحفظ تغييراتك؛ افتح القفل لتغييرها مجددًا."),
      failed: t("Couldn't unlock. Try again.", "تعذّر فتح القفل. حاول مجددًا."),
    })[p];

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <span className={unlocked ? "text-amber-700 dark:text-amber-300" : "text-muted"}><LockIcon open={unlocked} /></span>
            {t("Store legal pages", "الصفحات القانونية للمتاجر")}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{t("The return, terms and privacy pages a new store starts with. Each store edits its own copy; stores that already have their pages keep them.", "صفحات الاسترجاع والأحكام والخصوصية التي يبدأ بها كل متجر جديد. يعدّل كل متجر نسخته؛ والمتاجر التي لديها صفحاتها تحتفظ بها.")}</p>
        </div>
        {!unlocked && legal.owner && (
          <Btn kind="ghost" onClick={() => { setProblem(null); setAsking(true); }}>
            <LockIcon open />
            {t("Unlock to edit", "فتح القفل للتعديل")}
          </Btn>
        )}
      </div>

      {unlocked ? (
        <p role="status" className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-200">
          {t("Unlocked for 10 minutes. Saving changes what every new store's legal pages say, and locks them again.", "مفتوحة لمدة 10 دقائق. الحفظ يغيّر ما تقوله الصفحات القانونية لكل متجر جديد، ويعيد قفلها.")}
        </p>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-soft px-3 py-2 text-sm ring-1 ring-fg/10">
          <span className="mt-0.5 shrink-0 text-muted"><LockIcon /></span>
          <span>
            {t("Locked: changing these changes what every new store's legal pages say.", "مقفلة: تغييرها يغيّر ما تقوله الصفحات القانونية لكل متجر جديد.")}
            {!legal.owner && <strong className="ms-1 font-semibold">{t("Only an owner can change these.", "يستطيع المالك فقط تغيير هذه الصفحات.")}</strong>}
          </span>
        </p>
      )}
      {problem && !asking && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{problemText(problem)}</p>}

      <div className="mt-4 space-y-3">
        {LEGAL_PAGES.map((k) => {
          const page = s.value[k];
          /* the page's name, from one source: its saved title in the staff's language (the saved one, so it stays put
             while the title is being edited), or the starting name when that title is empty */
          const savedTitle = kept[k]?.title ?? page.title;
          const name = t(savedTitle.en.trim() || LEGAL_NAMES[k][0], savedTitle.ar.trim() || LEGAL_NAMES[k][1]);
          const set = (v: Partial<typeof page>) => s.setValue({ ...s.value, [k]: { ...page, ...v } });
          if (!unlocked)
            return (
              <div key={k} className="rounded-xl border border-fg/10 p-3">
                {/* the page's name once, as its heading. The other language's title shows above its text only when it is
                    neither the heading nor already the text's first line (the starting texts begin with their title). */}
                <h3 className="text-sm font-semibold">{name}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {(["en", "ar"] as const).map((l) => (
                    <div key={l} dir={l === "ar" ? "rtl" : "ltr"} lang={l} className="min-w-0">
                      {(() => {
                        const own = page.title[l].trim();
                        const shown = own && own !== name && !page.body[l].trimStart().startsWith(own);
                        return shown ? <p className="text-xs font-medium text-muted">{own}</p> : null;
                      })()}
                      <p
                        tabIndex={0}
                        aria-label={`${name} (${l === "ar" ? t("Arabic", "عربي") : t("English", "إنجليزي")})`}
                        className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line rounded-lg bg-soft/60 p-2.5 text-[13px] leading-relaxed text-fg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {page.body[l]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          return (
            <fieldset key={k} className="space-y-3 rounded-xl border border-fg/10 p-3">
              <legend className="px-1 text-sm font-semibold">{name}</legend>
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
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {unlocked && (
          <>
            <Btn onClick={save} disabled={state === "busy"}>{state === "busy" ? t("Saving…", "جارٍ الحفظ…") : t("Save and lock", "حفظ وقفل")}</Btn>
            <Btn kind="ghost" onClick={() => setUnlocked(false)} disabled={state === "busy"}>{t("Lock without saving", "قفل دون حفظ")}</Btn>
          </>
        )}
        {state === "saved" && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t("Saved and locked", "حُفظت وقُفلت")}</span>}
        {state === "bad" && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{t("Not saved: check the values.", "لم يُحفظ: تحقق من القيم.")}</span>}
        <span className="ms-auto text-xs text-muted">
          {info.updatedAt ? t(`Changed ${f.dateTime(info.updatedAt)}${info.by ? ` by ${info.by}` : ""}`, `عُدّل ${f.dateTime(info.updatedAt)}${info.by ? ` بواسطة ${info.by}` : ""}`) : t("Never changed: the starting value", "لم يُعدّل: القيمة الأولى")}
        </span>
      </div>

      {asking && (
        <UnlockDialog
          hasPassword={legal.hasPassword}
          problemText={problemText}
          onClose={() => setAsking(false)}
          onUnlocked={() => {
            setAsking(false);
            setProblem(null);
            setState("idle");
            setUnlocked(true);
          }}
        />
      )}
    </section>
  );
}

/* Asks the signed-in owner for his own password; the server checks it (POST /api/diwan/settings/unlock) */
function UnlockDialog({ hasPassword, problemText, onClose, onUnlocked }: {
  hasPassword: boolean; problemText: (p: LockProblem) => string; onClose: () => void; onUnlocked: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<LockProblem | null>(null);
  const submit = async () => {
    if (!hasPassword || !password || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await send("/api/diwan/settings/unlock", "POST", { password }).catch(() => null);
    setBusy(false);
    setPassword("");
    if (r?.ok) return onUnlocked();
    const why = r?.data?.result;
    setProblem((SERVER_PROBLEMS as readonly string[]).includes(why) ? (why as LockProblem) : "failed");
  };
  return (
    <Dialog
      title={t("Unlock the store legal pages", "فتح قفل الصفحات القانونية للمتاجر")}
      body={
        hasPassword
          ? t("Type your own Diwan password. The pages stay unlocked for 10 minutes or until you save.", "اكتب كلمة مرورك في الديوان. تبقى الصفحات مفتوحة 10 دقائق أو حتى تحفظ.")
          : t("Unlocking needs your own Diwan password.", "فتح القفل يحتاج إلى كلمة مرورك في الديوان.")
      }
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      footer={
        hasPassword ? (
          <>
            <Btn type="button" kind="ghost" onClick={onClose} disabled={busy}>{t("Cancel", "إلغاء")}</Btn>
            <Btn type="submit" disabled={!password || busy}>{busy ? t("Checking…", "جارٍ التحقق…") : t("Unlock", "فتح القفل")}</Btn>
          </>
        ) : (
          <Btn type="button" onClick={onClose}>{t("Close", "إغلاق")}</Btn>
        )
      }
    >
      {hasPassword ? (
        <>
          <label htmlFor="legal-unlock-pw" className="mb-1 block text-sm font-medium">{t("Your password", "كلمة مرورك")}</label>
          <input
            id="legal-unlock-pw"
            data-autofocus
            type="password"
            autoComplete="current-password"
            maxLength={128}
            dir="ltr"
            className={field}
            value={password}
            onChange={(x) => setPassword(x.target.value)}
            aria-invalid={problem === "wrong"}
            aria-describedby={problem ? "legal-unlock-problem" : undefined}
          />
          {problem && <p id="legal-unlock-problem" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{problemText(problem)}</p>}
        </>
      ) : (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/25 dark:text-red-300">
          {problemText("no-password")}
        </p>
      )}
    </Dialog>
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
