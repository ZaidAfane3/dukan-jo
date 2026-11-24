"use client";

import { useEffect, useRef, useState } from "react";
import { askConfirm, tell } from "@/components/diwan/dialogs";
import { AnnouncementsSkeleton } from "@/components/diwan/skeletons";
import { area, Badge, Btn, card, field, Loaded, LoadMore, PageHead, refusedWords, send, useApi, useCreateOnce, useFmt, useMore, useT, type ArForms, type Tone } from "@/components/diwan/ui";
import {
  AUDIENCE_JOINED, AUDIENCE_LANGS, AUDIENCE_ORDERS, AUDIENCE_STORES, EVERY_MERCHANT, MERCHANT_CAMPAIGN_MAX,
  type MerchantAudience, type MerchantCampaignContent, type MerchantCampaignField, type MerchantCampaignProblem,
} from "@/components/merchantCampaignRules";
import { SITE_HOST } from "@/components/siteAddress";

/* Dukkan's own email campaigns to merchants (server/merchantCampaigns.ts): written once in English and Arabic (each
   merchant gets his language), for merchants picked by filters whose number is counted live, tried with a test to
   yourself, then sent in the background with its progress here and a stop while it is sending. Ended ones stay under
   "Sent", where one can be copied into a new draft. Numbers only: never a merchant's address. Every change is in the
   staff log. */

type Status = "draft" | "sending" | "sent" | "failed" | "stopped";
type Campaign = MerchantCampaignContent & {
  id: string; status: Status; audience: MerchantAudience; recipients: number; sent: number; failed: number; skipped: number;
  note: string | null; createdBy: string | null; startedBy: string | null; stoppedBy: string | null;
  createdAt: string; updatedAt: string; startedAt: string | null; finishedAt: string | null;
};
type Today = { used: number; max: number };
type NowData = { campaigns: Campaign[]; today: Today; emailOn: boolean };
type PastData = { rows: Campaign[]; page: number; pages: number; today: Today; emailOn: boolean };
type Form = MerchantCampaignContent & { id: string | null; audience: MerchantAudience };
type View = "now" | "past";

const blank = (): Form => ({
  id: null, subjectEn: "", subjectAr: "", headingEn: "", headingAr: "", bodyEn: "", bodyAr: "",
  buttonLabelEn: "", buttonLabelAr: "", buttonUrl: "", audience: { ...EVERY_MERCHANT },
});
const formOf = (c: Campaign): Form => ({
  id: c.id, subjectEn: c.subjectEn, subjectAr: c.subjectAr, headingEn: c.headingEn, headingAr: c.headingAr, bodyEn: c.bodyEn,
  bodyAr: c.bodyAr, buttonLabelEn: c.buttonLabelEn, buttonLabelAr: c.buttonLabelAr, buttonUrl: c.buttonUrl, audience: { ...c.audience },
});
const bodyOf = (f: Form) => {
  const { id: _id, ...rest } = f;
  return rest;
};

/* how many merchants an audience reaches now (a question, not a change: asked without send(), which tells the sidebar
   that something changed) */
async function countOf(audience: MerchantAudience): Promise<{ count: number; off: number } | null> {
  try {
    const r = await fetch("/api/diwan/merchant-campaigns/count", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience }),
    });
    const j = r.ok ? await r.json() : null;
    return j ? { count: Number(j.count) || 0, off: Number(j.off) || 0 } : null;
  } catch {
    return null;
  }
}

const STATUS: Record<Status, { en: string; ar: string; tone: Tone }> = {
  draft: { en: "Draft", ar: "مسودة", tone: "grey" },
  sending: { en: "Sending", ar: "جارٍ الإرسال", tone: "blue" },
  sent: { en: "Sent", ar: "أُرسلت", tone: "green" },
  failed: { en: "Failed", ar: "فشلت", tone: "red" },
  stopped: { en: "Stopped", ar: "أُوقفت", tone: "amber" },
};
const MERCHANTS: [readonly [string, string], ArForms] = [["merchant", "merchants"], { one: "تاجر واحد", two: "تاجران", few: "تجار", many: "تاجرًا" }];

/** The words of each filter's choices, shared by the form and the lists */
function useAudienceWords() {
  const t = useT();
  return {
    stores: { all: t("All merchants", "كل التجار"), live: t("Live stores", "المتاجر المنشورة"), notLive: t("Not live yet", "غير منشورة بعد"), paused: t("Paused", "متوقفة مؤقتًا") },
    joined: { 0: t("Any time", "في أي وقت"), 7: t("Last 7 days", "آخر 7 أيام"), 30: t("Last 30 days", "آخر 30 يومًا"), 90: t("Last 90 days", "آخر 90 يومًا") } as Record<number, string>,
    orders: { any: t("Any", "الكل"), some: t("Has orders", "لديه طلبات"), none: t("No orders yet", "بلا طلبات بعد") },
    lang: { any: t("Any language", "أي لغة"), ar: t("Arabic", "العربية"), en: t("English", "الإنجليزية") },
  };
}

export default function MerchantCampaignsPage() {
  const t = useT();
  const f = useFmt();
  const [view, setView] = useState<View>("now");
  const s = useApi<NowData>("/api/diwan/merchant-campaigns?view=now");
  const past = useMore<PastData>(view === "past" ? "/api/diwan/merchant-campaigns?view=past" : null, (d, n) => (n < d.pages ? `page=${n + 1}` : null));
  const [form, setForm] = useState<Form | null>(null);
  const reloadBoth = () => {
    s.reload();
    past.reload();
  };

  /* a campaign sending moves on: its numbers are read again every few seconds while one is in the list */
  const sending = !!s.data?.campaigns.some((c) => c.status === "sending");
  useEffect(() => {
    if (!sending) return;
    const id = setInterval(() => s.reload(), 5_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending]);

  const edit = (c: Campaign) => {
    setForm(formOf(c));
    setView("now");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const copy = (c: Campaign) => {
    setForm({ ...formOf(c), id: null });
    setView("now");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (c: Campaign) => {
    const yes = await askConfirm({
      title: t("Delete this draft?", "حذف هذه المسودة؟"),
      body: t("It was never sent. This can't be undone.", "لم تُرسل أبدًا. لا يمكن التراجع عن ذلك."),
      confirm: t("Delete", "حذف"),
      danger: true,
    });
    if (!yes) return;
    const r = await send(`/api/diwan/merchant-campaigns/${c.id}`, "DELETE");
    if (!r.ok && r.status !== 404) await tell({ title: refusedWords(t, r) ?? t("It couldn't be deleted. Try again.", "تعذّر الحذف. حاول مجددًا.") });
    if (form?.id === c.id) setForm(null);
    reloadBoth();
  };
  const stop = async (c: Campaign) => {
    const left = Math.max(0, c.recipients - c.sent - c.failed - c.skipped);
    const yes = await askConfirm({
      title: t("Stop this campaign?", "إيقاف هذه الحملة؟"),
      body: t(
        `About ${f.count(left, ...MERCHANTS)} who haven't got it yet never will. A batch already handed to the email service still arrives. This can't be undone.`,
        `لن تصل إلى نحو ${f.count(left, ...MERCHANTS)} لم تصلهم بعد. الدفعة التي سُلّمت لخدمة البريد ستصل. لا يمكن التراجع عن ذلك.`,
      ),
      confirm: t("Stop sending", "إيقاف الإرسال"),
      danger: true,
    });
    if (!yes) return;
    const r = await send(`/api/diwan/merchant-campaigns/${c.id}/stop`, "POST", {});
    if (!r.ok)
      await tell({ title: refusedWords(t, r) ?? (r.data?.result === "not-sending" ? t("It isn't sending any more: it already finished or was stopped.", "لم تعد قيد الإرسال: انتهت أو أُوقفت بالفعل.") : t("It couldn't be stopped. Try again.", "تعذّر الإيقاف. حاول مجددًا.")) });
    reloadBoth();
  };

  const tabs: [View, string][] = [["now", t("Drafts and sending", "المسودات وقيد الإرسال")], ["past", t("Sent", "المُرسلة")]];
  const today = s.data?.today;
  return (
    <div>
      <PageHead
        title={t("Campaigns to merchants", "حملات للتجار")}
        sub={t(
          "Emails from Dukkan to store owners, each in the language they use Dukkan in. Choose who gets one by filters: you see how many, never who.",
          "رسائل بريد من دكان إلى أصحاب المتاجر، كلٌّ بلغته في دكان. اختر من تصلهم بالفلاتر: ترى عددهم فقط، دون معرفة من هم.",
        )}
        actions={!form && <Btn onClick={() => (setForm(blank()), setView("now"))}>{t("New campaign", "حملة جديدة")}</Btn>}
      />
      {today && (
        <p className="-mt-5 mb-5 text-sm text-muted">
          {t(`Started today: ${f.num(today.used)} of ${f.num(today.max)} a day.`, `بدأت اليوم: ${f.num(today.used)} من ${f.num(today.max)} في اليوم.`)}
          {s.data && !s.data.emailOn && <span className="ms-2 font-semibold text-red-600">{t("Email isn't set up on this server: campaigns can be saved, not sent.", "البريد غير مُعدّ على هذا الخادم: يمكن حفظ الحملات دون إرسالها.")}</span>}
        </p>
      )}

      <div role="tablist" aria-label={t("Which campaigns", "أي الحملات")} className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, word]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${view === k ? "bg-primary text-white" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}>
            {word}
          </button>
        ))}
      </div>

      {view === "now" ? (
        <Loaded s={s} skeleton={<AnnouncementsSkeleton />}>
          {(d) => (
            <>
              {form && <Editor form={form} setForm={setForm} onDone={() => (setForm(null), reloadBoth())} onSaved={() => s.reload()} />}
              <div className="space-y-3">
                {d.campaigns.length === 0 && !form && <p className={`${card} text-center text-sm text-muted`}>{t("No drafts. Sent campaigns are under Sent.", "لا توجد مسودات. الحملات المُرسلة في «المُرسلة».")}</p>}
                {d.campaigns.map((c) => (
                  <article key={c.id} className={card}>
                    <Summary c={c} />
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-fg/10 pt-3">
                      {c.status === "draft" ? (
                        <>
                          <Btn kind="ghost" onClick={() => edit(c)}>{t("Edit", "تعديل")}</Btn>
                          <Btn kind="danger" onClick={() => void remove(c)}>{t("Delete", "حذف")}</Btn>
                        </>
                      ) : (
                        <Btn kind="danger" onClick={() => void stop(c)}>{t("Stop sending", "إيقاف الإرسال")}</Btn>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Loaded>
      ) : (
        <Loaded s={past} skeleton={<AnnouncementsSkeleton />}>
          {(d) => (
            <>
              <div className="space-y-3">
                {d.rows.length === 0 && <p className={`${card} text-center text-sm text-muted`}>{t("No campaign was sent yet.", "لم تُرسل أي حملة بعد.")}</p>}
                {/* what went out is kept as it was: no editing, only copying it into a new draft */}
                {d.rows.map((c) => (
                  <article key={c.id} className={card}>
                    <Summary c={c} />
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-fg/10 pt-3">
                      <Btn kind="ghost" onClick={() => copy(c)}>{t("Copy into a new draft", "نسخها إلى مسودة جديدة")}</Btn>
                    </div>
                  </article>
                ))}
              </div>
              <LoadMore s={past} />
            </>
          )}
        </Loaded>
      )}
    </div>
  );
}

/** One campaign: its status, subject, who it was for, and its numbers (with a progress bar while it is sending) */
function Summary({ c }: { c: Campaign }) {
  const t = useT();
  const f = useFmt();
  const w = useAudienceWords();
  const done = c.sent + c.failed + c.skipped;
  const pct = c.recipients ? Math.min(100, Math.round((done / c.recipients) * 100)) : 0;
  const label =
    c.status === "stopped" && c.stoppedBy ? t(`Stopped by ${c.stoppedBy}`, `أوقفها ${c.stoppedBy}`) : c.status === "failed" && c.note === "no-sender" ? t("Failed: email not set up", "فشلت: البريد غير مُعدّ") : t(STATUS[c.status].en, STATUS[c.status].ar);
  const a = c.audience;
  const who = [w.stores[a.stores], a.joined ? t(`joined in the ${w.joined[a.joined].toLowerCase()}`, `انضموا خلال ${w.joined[a.joined]}`) : "", a.orders !== "any" ? w.orders[a.orders] : "", a.lang !== "any" ? w.lang[a.lang] : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS[c.status].tone}>{label}</Badge>
          <span className="text-xs text-muted">{who}</span>
        </div>
        <h2 dir="auto" className="mt-2 break-words font-bold ltr:text-left rtl:text-right">{t(c.subjectEn || c.subjectAr, c.subjectAr || c.subjectEn) || t("(no subject yet)", "(بلا عنوان بعد)")}</h2>
        <p dir="auto" className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-muted ltr:text-left rtl:text-right">{t(c.bodyEn || c.bodyAr, c.bodyAr || c.bodyEn)}</p>
        <p className="mt-2 text-xs text-muted">
          {c.startedAt
            ? `${t("Started", "بدأت")} ${f.dateTime(c.startedAt)}${c.startedBy ? ` · ${t("by", "بواسطة")} ${c.startedBy}` : ""}${c.finishedAt ? ` · ${t("finished", "انتهت")} ${f.dateTime(c.finishedAt)}` : ""}`
            : `${t("Saved", "حُفظت")} ${f.dateTime(c.updatedAt)}${c.createdBy ? ` · ${t("by", "بواسطة")} ${c.createdBy}` : ""}`}
        </p>
        {c.status === "sending" && (
          <div className="mt-3 max-w-md" aria-label={t("Progress", "التقدّم")}>
            <div className="h-2 overflow-hidden rounded-full bg-fg/10">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted tabular-nums">{t(`${f.num(done)} of ${f.num(c.recipients)} done`, `${f.num(done)} من ${f.num(c.recipients)}`)}</p>
          </div>
        )}
      </div>
      {c.status !== "draft" && (
        <dl className="grid shrink-0 grid-cols-4 gap-3 text-end">
          {[
            [t("Merchants", "التجار"), c.recipients],
            [t("Sent", "أُرسلت"), c.sent],
            [t("Failed", "فشلت"), c.failed],
            [t("Not sent", "لم تُرسل"), c.skipped],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dd className="text-lg font-bold tabular-nums">{f.num(v as number)}</dd>
              <dt className="whitespace-nowrap text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** The form: the texts in both languages, the button, who it is for (counted live), a preview, and its buttons */
function Editor({ form, setForm, onDone, onSaved }: { form: Form; setForm: (f: Form | null) => void; onDone: () => void; onSaved: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useAudienceWords();
  const once = useCreateOnce();
  const [busy, setBusy] = useState<"" | "save" | "test" | "send">("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [look, setLook] = useState<"ar" | "en">("ar");
  const [reach, setReach] = useState<{ count: number; off: number } | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const setAud = <K extends keyof MerchantAudience>(k: K, v: MerchantAudience[K]) => setForm({ ...form, audience: { ...form.audience, [k]: v } });
  /* a message about the form goes as soon as its words or filters change: it may be fixed now */
  const formKey = JSON.stringify(bodyOf(form));
  useEffect(() => (setErr(""), setNote("")), [formKey]);

  /* the live count, a moment after the filters change; an older answer never replaces a newer one */
  const asked = useRef(0);
  const audKey = JSON.stringify(form.audience);
  useEffect(() => {
    const n = ++asked.current;
    setReach(null);
    const id = window.setTimeout(async () => {
      const r = await countOf(form.audience);
      if (n === asked.current && r) setReach(r);
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audKey]);

  const NAMES: Record<MerchantCampaignField, string> = {
    subjectEn: t("The English subject", "العنوان بالإنجليزية"), subjectAr: t("The Arabic subject", "العنوان بالعربية"),
    headingEn: t("The English heading", "العنوان الداخلي بالإنجليزية"), headingAr: t("The Arabic heading", "العنوان الداخلي بالعربية"),
    bodyEn: t("The English message", "الرسالة بالإنجليزية"), bodyAr: t("The Arabic message", "الرسالة بالعربية"),
    buttonLabelEn: t("The English button words", "نص الزر بالإنجليزية"), buttonLabelAr: t("The Arabic button words", "نص الزر بالعربية"),
    buttonUrl: t("The button link", "رابط الزر"),
  };
  const problemWords = (list: MerchantCampaignProblem[]) =>
    list
      .map((p) =>
        p.why === "missing" ? t(`${NAMES[p.field]} is missing.`, `${NAMES[p.field]} ناقص.`)
        : p.why === "long" ? t(`${NAMES[p.field]} is too long.`, `${NAMES[p.field]} أطول من المسموح.`)
        : t(`The button link must be a page on ${SITE_HOST}, starting with https://`, `يجب أن يكون رابط الزر صفحة على ${SITE_HOST} ويبدأ بـ https://`),
      )
      .join(" ");
  const why = (r: { ok: boolean; status: number; data: any }, fallback: string) =>
    refusedWords(t, r) ??
    (r.data?.result === "invalid" && Array.isArray(r.data?.problems) ? problemWords(r.data.problems) : null) ??
    (r.data?.result === "not-draft" ? t("This campaign was already sent, so it can't change.", "أُرسلت هذه الحملة بالفعل، فلا يمكن تعديلها.") : null) ??
    (r.data?.result === "too-many-drafts" ? t("There are too many drafts. Delete some first.", "المسودات كثيرة. احذف بعضها أولًا.") : null) ??
    (r.data?.result === "daily-limit" ? t(`${r.data.max} campaigns were started today already. Try again tomorrow.`, `بدأت ${r.data.max} حملات اليوم بالفعل. حاول غدًا.`) : null) ??
    (r.data?.result === "no-recipients" ? t("No merchant matches these filters.", "لا يوجد تاجر يطابق هذه الفلاتر.") : null) ??
    (r.data?.result === "no-sender" ? t("Email isn't set up on this server.", "البريد غير مُعدّ على هذا الخادم.") : null) ??
    (r.data?.result === "slow-down" ? t("Too many tests for now. Try again later.", "تجارب كثيرة الآن. حاول لاحقًا.") : null) ??
    fallback;

  /* saves the draft (a new one is made once, useCreateOnce); its id, or null when it wasn't saved */
  const save = async (): Promise<string | null> => {
    const body = bodyOf(form);
    const r = form.id ? await send(`/api/diwan/merchant-campaigns/${form.id}`, "PUT", body) : await send("/api/diwan/merchant-campaigns", "POST", { ...body, requestKey: once.key(body) });
    if (!r.ok) {
      setErr(why(r, t("It was not saved. Try again.", "لم تُحفظ. حاول مرة أخرى.")));
      return null;
    }
    once.made();
    const id = String(r.data?.campaign?.id ?? form.id ?? "");
    if (!form.id && id) setForm({ ...form, id });
    onSaved();
    return id || null;
  };

  const run = async (what: "save" | "test" | "send", fn: () => Promise<void>) => {
    if (busy || !once.begin()) return;
    setBusy(what);
    setErr("");
    setNote("");
    try {
      await fn();
    } finally {
      once.end();
      setBusy("");
    }
  };

  const saveOnly = () => run("save", async () => {
    if (await save()) setNote(t("Draft saved.", "حُفظت المسودة."));
  });
  const test = () => run("test", async () => {
    const r = await send("/api/diwan/merchant-campaigns/test", "POST", bodyOf(form));
    if (r.ok) setNote(t(`A test in both languages went to ${r.data?.to}.`, `أُرسلت تجربة باللغتين إلى ${r.data?.to}.`));
    else setErr(why(r, t("The test couldn't be sent. Try again.", "تعذّر إرسال التجربة. حاول مجددًا.")));
  });
  const sendNow = () => run("send", async () => {
    const id = await save();
    if (!id) return;
    const c = await countOf(form.audience);
    if (!c) return setErr(t("The merchants couldn't be counted. Try again.", "تعذّر عدّ التجار. حاول مجددًا."));
    const n = c.count;
    if (!n) return setErr(t("No merchant matches these filters.", "لا يوجد تاجر يطابق هذه الفلاتر."));
    const yes = await askConfirm({
      title: t(`Send to ${f.count(n, ...MERCHANTS)}?`, `إرسالها إلى ${f.count(n, ...MERCHANTS)}؟`),
      body: t(
        "Each gets it in their own language. It goes out in the background, a batch at a time, and can't be changed once it starts. You can stop it while it is sending.",
        "يستلمها كلٌّ بلغته. تُرسل في الخلفية على دفعات، ولا يمكن تعديلها بعد أن تبدأ. يمكنك إيقافها أثناء الإرسال.",
      ),
      confirm: t("Send now", "أرسل الآن"),
    });
    if (!yes) return;
    const r = await send(`/api/diwan/merchant-campaigns/${id}/send`, "POST", {});
    if (r.ok) return onDone();
    setErr(why(r, t("It couldn't be sent. Try again.", "تعذّر الإرسال. حاول مجددًا.")));
  });

  const label = "mb-1 block text-sm font-semibold";
  const M = MERCHANT_CAMPAIGN_MAX;
  const chips = <T extends string | number>(name: string, list: readonly T[], value: T, words: Record<string, string>, on: (v: T) => void) => (
    <fieldset>
      <legend className={label}>{name}</legend>
      <div className="flex flex-wrap gap-2">
        {list.map((x) => (
          <button key={String(x)} type="button" aria-pressed={value === x} onClick={() => on(x)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${value === x ? "bg-primary text-white" : "bg-card ring-1 ring-fg/15 hover:bg-soft"}`}>
            {words[String(x)]}
          </button>
        ))}
      </div>
    </fieldset>
  );
  const side = (l: "en" | "ar") => {
    const ar = l === "ar";
    const k = (base: "subject" | "heading" | "body" | "buttonLabel") => `${base}${ar ? "Ar" : "En"}` as keyof MerchantCampaignContent;
    return (
      <div dir={ar ? "rtl" : "ltr"} lang={l} onFocus={() => setLook(l)}>
        <label className={label} htmlFor={`s${l}`}>{ar ? "عنوان الرسالة (بالعربية) *" : "Subject (English) *"}</label>
        <input id={`s${l}`} className={field} maxLength={M.subject} value={form[k("subject")]} onChange={(e) => set(k("subject"), e.target.value)} />
        <label className={`${label} mt-3`} htmlFor={`h${l}`}>{ar ? "عنوان داخل الرسالة (اختياري)" : "Heading inside the email (optional)"}</label>
        <input id={`h${l}`} className={field} maxLength={M.heading} value={form[k("heading")]} onChange={(e) => set(k("heading"), e.target.value)} />
        <label className={`${label} mt-3`} htmlFor={`b${l}`}>{ar ? "الرسالة (بالعربية) *" : "Message (English) *"}</label>
        <textarea id={`b${l}`} className={area} rows={7} maxLength={M.body} value={form[k("body")]} onChange={(e) => set(k("body"), e.target.value)} />
        <label className={`${label} mt-3`} htmlFor={`l${l}`}>{ar ? "نص الزر (اختياري)" : "Button words (optional)"}</label>
        <input id={`l${l}`} className={field} maxLength={M.buttonLabel} value={form[k("buttonLabel")]} onChange={(e) => set(k("buttonLabel"), e.target.value)} />
      </div>
    );
  };

  /* the preview: the email's card in one language, as Dukkan's emails look */
  const P = look === "ar";
  const pv = { subject: P ? form.subjectAr : form.subjectEn, heading: P ? form.headingAr : form.headingEn, body: P ? form.bodyAr : form.bodyEn, button: P ? form.buttonLabelAr : form.buttonLabelEn };
  return (
    <section className={`${card} mb-6`}>
      <h2 className="mb-4 text-lg font-bold">{form.id ? t("Edit draft", "تعديل المسودة") : t("New campaign", "حملة جديدة")}</h2>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {side("en")}
            {side("ar")}
          </div>
          <div dir="ltr">
            <label className={label} htmlFor="burl">{t("Button link (optional)", "رابط الزر (اختياري)")}</label>
            <input id="burl" className={field} maxLength={M.buttonUrl} placeholder={`https://${SITE_HOST}/…`} value={form.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t(`A page on Dukkan's own address (${SITE_HOST}). The button shows only with its words in both languages.`, `صفحة على عنوان دكان نفسه (${SITE_HOST}). يظهر الزر فقط مع نصه باللغتين.`)}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-fg/10 p-4">
            <p className="font-semibold">{t("Who gets it", "من تصله")}</p>
            {chips(t("Stores", "المتاجر"), AUDIENCE_STORES, form.audience.stores, w.stores, (v) => setAud("stores", v))}
            {chips(t("Signed up", "التسجيل"), AUDIENCE_JOINED, form.audience.joined, w.joined, (v) => setAud("joined", v))}
            {chips(t("Orders", "الطلبات"), AUDIENCE_ORDERS, form.audience.orders, w.orders, (v) => setAud("orders", v))}
            {chips(t("Language", "اللغة"), AUDIENCE_LANGS, form.audience.lang, w.lang, (v) => setAud("lang", v))}
            <p className="text-sm" aria-live="polite">
              {reach == null ? (
                <span className="text-muted">{t("Counting…", "جارٍ العدّ…")}</span>
              ) : (
                <>
                  <span className="font-bold">{t(`Reaches ${f.count(reach.count, ...MERCHANTS)} now.`, `تصل الآن إلى ${f.count(reach.count, ...MERCHANTS)}.`)}</span>{" "}
                  <span className="text-muted">
                    {t(
                      `Never included: suspended stores, and the ${f.count(reach.off, ...MERCHANTS)} who turned these emails off. Merchants who never chose a language get both and are only in "Any language".`,
                      `لا تصل أبدًا إلى المتاجر الموقوفة، ولا إلى ${f.count(reach.off, ...MERCHANTS)} أوقفوا هذه الرسائل. من لم يختر لغة تصله باللغتين ويُحسب فقط في «أي لغة».`,
                    )}
                  </span>
                </>
              )}
            </p>
          </div>

          {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
          {note && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{note}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn type="button" disabled={!!busy} onClick={() => void sendNow()}>{busy === "send" ? t("Sending…", "جارٍ الإرسال…") : t("Send…", "إرسال…")}</Btn>
            <Btn kind="ghost" type="button" disabled={!!busy} onClick={() => void saveOnly()}>{busy === "save" ? t("Saving…", "جارٍ الحفظ…") : t("Save draft", "حفظ المسودة")}</Btn>
            <Btn kind="ghost" type="button" disabled={!!busy} onClick={() => void test()}>{busy === "test" ? t("Sending the test…", "جارٍ إرسال التجربة…") : t("Send a test to me", "أرسل تجربة إليّ")}</Btn>
            <Btn kind="ghost" type="button" disabled={!!busy} onClick={() => setForm(null)}>{t("Close", "إغلاق")}</Btn>
          </div>
        </div>

        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("Preview", "معاينة")}</p>
            <div className="flex gap-1">
              {(["ar", "en"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={look === l} onClick={() => setLook(l)} className={`rounded-full px-3 py-1 text-xs font-semibold ${look === l ? "bg-primary text-white" : "ring-1 ring-fg/15"}`}>
                  {l === "ar" ? "العربية" : "English"}
                </button>
              ))}
            </div>
          </div>
          <div dir={P ? "rtl" : "ltr"} lang={look} className="rounded-2xl bg-[#f5f5f4] p-4 text-[#1c1917]">
            <p className="mb-1 truncate text-xs text-[#78716c]">{pv.subject || (P ? "عنوان الرسالة" : "Subject")}</p>
            <p className="mb-3 text-lg font-extrabold text-[#ea580c]">{P ? "دكان" : "Dukkan"}</p>
            <div className="rounded-xl border border-[#e7e5e4] bg-white p-4">
              {pv.heading && <p className="mb-3 text-base font-bold">{pv.heading}</p>}
              <p className="whitespace-pre-line break-words text-sm leading-relaxed">{pv.body || (P ? "نص الرسالة هنا" : "Your message here")}</p>
              {pv.button && form.buttonUrl && <span className="mt-3 inline-block rounded-lg bg-[#ea580c] px-4 py-2 text-sm font-bold text-white">{pv.button}</span>}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#78716c]">
              {P ? "وصلتك هذه الرسالة لأن لديك متجرًا على دكان. لا يُستقبل الرد عليها." : "You got this email because you have a store on Dukkan. Replies to it aren't read."}{" "}
              <u>{P ? "إيقاف رسائل دكان التسويقية" : "Stop Dukkan's marketing emails"}</u>
            </p>
          </div>
          <p className="mt-2 text-xs text-muted">{t("Merchants who never chose a language get both versions in one email, Arabic first.", "من لم يختر لغة تصله النسختان في رسالة واحدة، العربية أولًا.")}</p>
        </div>
      </div>
    </section>
  );
}
