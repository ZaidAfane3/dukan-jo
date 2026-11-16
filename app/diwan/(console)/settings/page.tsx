"use client";

import { useEffect, useState } from "react";
import { LEGAL_PAGES, LIMITS, PAY_METHODS, type Bi, type PayMethod, type PlatformSettings, type SettingKey } from "@/components/diwan/platformSettings";
import { askConfirm, Dialog } from "@/components/diwan/dialogs";
import { PayLogo } from "@/components/diwan/shopBits";
import { Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT } from "@/components/diwan/ui";

/* Platform settings (owners): the ways to pay, the legal pages new stores start with (locked: see LegalTemplates) and the
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
      <Loaded s={s}>
        {(d) => (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <TemplateCard info={d.template} onChange={s.reload} />
            <Payments e={d.settings.payment_methods} />
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

const PAY_NAMES = { cod: ["Cash on delivery", "الدفع عند الاستلام"], cliq: ["CliQ", "كليك"], card: ["Card", "البطاقة"] } as const;

/* How each way to pay is shown: its logo (cash has none, so a drawn note), and where Dukkan offers it. A store's checkout
   (components/storefront/Cart.tsx) offers cash, CliQ and card; buying a theme (components/ThemeStore.tsx) offers card
   and CliQ. */
const PAY_LOOK: Record<PayMethod, { store: boolean; themes: boolean }> = {
  cod: { store: true, themes: false },
  cliq: { store: true, themes: true },
  card: { store: true, themes: true },
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
      {stats.error && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400">
          {t("The numbers couldn't be loaded.", "تعذّر تحميل الأرقام.")}
          <button type="button" onClick={stats.reload} className="font-semibold underline">{t("Try again", "حاول مجددًا")}</button>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
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
                      {stats.loading ? "…" : u ? <>{jod(u.ordersTotal)} <span className="font-normal text-muted">· {t(`${f.num(u.orders)} orders · ${f.num(u.stores)} stores`, `${f.num(u.orders)} طلب · ${f.num(u.stores)} متجر`)}</span></> : "—"}
                    </dd>
                  </div>
                )}
                {look.themes && (
                  <div>
                    <dt className="text-xs text-muted">{t("Themes bought", "ثيمات مشتراة")}</dt>
                    <dd className="font-bold tabular-nums">
                      {stats.loading ? "…" : u ? <>{jod(u.themesTotal)} <span className="font-normal text-muted">· {t(`${f.num(u.themes)} bought · ${f.num(u.buyers)} stores`, `${f.num(u.themes)} عملية شراء · ${f.num(u.buyers)} متجر`)}</span></> : "—"}
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

const LEGAL_NAMES = { returns: ["Return policy", "سياسة الاسترجاع"], terms: ["Terms and conditions", "الأحكام والشروط"], privacy: ["Privacy policy", "سياسة الخصوصية"] } as const;

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
          const name = t(LEGAL_NAMES[k][0], LEGAL_NAMES[k][1]);
          const set = (v: Partial<typeof page>) => s.setValue({ ...s.value, [k]: { ...page, ...v } });
          if (!unlocked)
            return (
              <div key={k} className="rounded-xl border border-fg/10 p-3">
                <p className="text-xs font-medium text-muted">{name}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {(["en", "ar"] as const).map((l) => (
                    <div key={l} dir={l === "ar" ? "rtl" : "ltr"} lang={l} className="min-w-0">
                      <p className="text-sm font-semibold">{page.title[l]}</p>
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
