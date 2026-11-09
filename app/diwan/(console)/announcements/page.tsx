"use client";

import { useEffect, useState } from "react";
import { askConfirm } from "@/components/diwan/dialogs";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";

/* Announcements to merchants: written in English and Arabic, for everyone, chosen shops or plans, shown in the
   merchants' bell (and as a banner on their home page when asked) between a start and an optional end. "Read by" counts
   the shops that opened or dismissed it. Everything here is live from the database; every change is in the activity log. */

type Audience = { all: true } | { accounts: (number | string)[] } | { plans: string[] };
type Row = {
  id: string; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; audience: Audience; banner: boolean;
  startsAt: string; endsAt: string | null; createdAt: string; by: string | null; status: "scheduled" | "live" | "ended"; reads: number; reach: number;
};
type Data = { announcements: Row[]; plans: { key: string; nameEn: string; nameAr: string }[]; shops: Record<string, { name: string; email: string }> };
type Shop = { id: string; name: string; email: string };
type Form = {
  id: string | null; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string;
  who: "all" | "accounts" | "plans"; shops: Shop[]; plans: string[]; banner: boolean; startsAt: string; endsAt: string;
};

/** An ISO time as the value of a datetime-local field (in this computer's time) */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const blank = (): Form => ({ id: null, titleEn: "", titleAr: "", bodyEn: "", bodyAr: "", who: "all", shops: [], plans: [], banner: true, startsAt: toLocal(new Date().toISOString()), endsAt: "" });
const STATUS_TONE: Record<Row["status"], Tone> = { scheduled: "blue", live: "green", ended: "grey" };

export default function AnnouncementsPage() {
  const t = useT();
  const f = useFmt();
  const s = useApi<Data>("/api/diwan/announcements");
  const [form, setForm] = useState<Form | null>(null);

  const edit = (r: Row, d: Data) => {
    const a = r.audience as Record<string, unknown>;
    setForm({
      id: r.id, titleEn: r.titleEn, titleAr: r.titleAr, bodyEn: r.bodyEn, bodyAr: r.bodyAr,
      who: Array.isArray(a.accounts) ? "accounts" : Array.isArray(a.plans) ? "plans" : "all",
      shops: Array.isArray(a.accounts) ? (a.accounts as unknown[]).map((id) => ({ id: String(id), name: d.shops[String(id)]?.name ?? `#${id}`, email: d.shops[String(id)]?.email ?? "" })) : [],
      plans: Array.isArray(a.plans) ? (a.plans as string[]) : [],
      banner: r.banner, startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const end = async (r: Row) => {
    const yes = await askConfirm({
      title: t("End this announcement", "إنهاء هذا الإعلان"),
      body: t(`End “${r.titleEn}” now? Merchants stop seeing it.`, `إنهاء «${r.titleAr}» الآن؟ لن يراه التجار بعد ذلك.`),
      confirm: t("End now", "إنهاء الآن"),
    });
    if (!yes) return;
    await send(`/api/diwan/announcements/${r.id}`, "PATCH", { end: true });
    s.reload();
  };
  const remove = async (r: Row) => {
    const yes = await askConfirm({
      title: t("Delete this announcement", "حذف هذا الإعلان"),
      body: t(`Delete “${r.titleEn}”? It disappears from every merchant's bell and its read count is lost.`, `حذف «${r.titleAr}»؟ سيختفي من إشعارات كل التجار ويُفقد عدد القراءات.`),
      confirm: t("Delete", "حذف"),
      danger: true,
    });
    if (!yes) return;
    await send(`/api/diwan/announcements/${r.id}`, "DELETE");
    s.reload();
  };

  const audienceText = (r: Row, d: Data) => {
    const a = r.audience as Record<string, unknown>;
    if (Array.isArray(a.accounts)) {
      const names = (a.accounts as unknown[]).map((id) => d.shops[String(id)]?.name ?? `#${id}`);
      return t(`Shops: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` +${names.length - 4}` : ""}`, `متاجر: ${names.slice(0, 4).join("، ")}${names.length > 4 ? ` +${names.length - 4}` : ""}`);
    }
    if (Array.isArray(a.plans)) {
      const names = (a.plans as string[]).map((k) => {
        const p = d.plans.find((x) => x.key === k);
        return p ? t(p.nameEn, p.nameAr) : k;
      });
      return t(`Plans: ${names.join(", ")}`, `الباقات: ${names.join("، ")}`);
    }
    return t("Every shop", "كل المتاجر");
  };

  return (
    <div>
      <PageHead
        title={t("Announcements", "الإعلانات")}
        sub={t("Messages to merchants, in their bell and, if you choose, as a banner on their home page.", "رسائل للتجار تظهر في الإشعارات، وكشريط في صفحتهم الرئيسية إن اخترت ذلك.")}
        actions={!form && <Btn onClick={() => setForm(blank())}>{t("New announcement", "إعلان جديد")}</Btn>}
      />

      <Loaded s={s}>
        {(d) => (
          <>
            {form && <Editor form={form} setForm={setForm} plans={d.plans} onSaved={() => { setForm(null); s.reload(); }} />}

            <div className="space-y-3">
              {d.announcements.length === 0 && <p className={`${card} text-center text-sm text-muted`}>{t("No announcements yet.", "لا توجد إعلانات بعد.")}</p>}
              {d.announcements.map((r) => (
                <article key={r.id} className={card}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[r.status]}>
                          {r.status === "scheduled" ? t("Scheduled", "مجدول") : r.status === "live" ? t("Live", "ظاهر الآن") : t("Ended", "انتهى")}
                        </Badge>
                        {r.banner && <Badge tone="primary">{t("Banner", "شريط")}</Badge>}
                        <span className="text-xs text-muted">{audienceText(r, d)}</span>
                      </div>
                      <h2 className="mt-2 break-words font-bold">{t(r.titleEn, r.titleAr)}</h2>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-muted">{t(r.bodyEn, r.bodyAr)}</p>
                      <p className="mt-2 text-xs text-muted">
                        {f.dateTime(r.startsAt)} → {r.endsAt ? f.dateTime(r.endsAt) : t("no end", "بلا نهاية")}
                        {r.by ? ` · ${t("by", "بواسطة")} ${r.by}` : ""}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-2xl font-bold tabular-nums">{f.num(r.reads)}<span className="text-sm font-medium text-muted"> / {f.num(r.reach)}</span></p>
                      <p className="text-xs text-muted">{t("shops read it", "متجر قرأه")}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-fg/10 pt-3">
                    <Btn kind="ghost" onClick={() => edit(r, d)}>{t("Edit", "تعديل")}</Btn>
                    {r.status !== "ended" && <Btn kind="ghost" onClick={() => void end(r)}>{t("End now", "إنهاء الآن")}</Btn>}
                    <Btn kind="danger" onClick={() => void remove(r)}>{t("Delete", "حذف")}</Btn>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

function Editor({ form, setForm, plans, onSaved }: { form: Form; setForm: (f: Form | null) => void; plans: Data["plans"]; onSaved: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Shop[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  /* shop search, a moment after typing stops */
  useEffect(() => {
    if (form.who !== "accounts" || q.trim().length < 2) return setFound([]);
    const id = window.setTimeout(async () => {
      const r = await fetch(`/api/diwan/announcements/shops?q=${encodeURIComponent(q.trim())}`, { credentials: "same-origin" });
      const j = await r.json().catch(() => null);
      setFound(Array.isArray(j?.shops) ? j.shops : []);
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, form.who]);

  const fields: Record<string, string> = {
    titleEn: t("Write the title in English.", "اكتب العنوان بالإنجليزية."),
    titleAr: t("Write the title in Arabic.", "اكتب العنوان بالعربية."),
    bodyEn: t("Write the text in English.", "اكتب النص بالإنجليزية."),
    bodyAr: t("Write the text in Arabic.", "اكتب النص بالعربية."),
    audience: t("Choose who it is for (at least one shop or plan).", "اختر لمن هو (متجر أو باقة واحدة على الأقل)."),
    startsAt: t("Check the start date.", "تحقق من تاريخ البداية."),
    endsAt: t("The end must be after the start.", "يجب أن تكون النهاية بعد البداية."),
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const audience = form.who === "all" ? { all: true } : form.who === "accounts" ? { accounts: form.shops.map((x) => x.id) } : { plans: form.plans };
    const body = {
      titleEn: form.titleEn, titleAr: form.titleAr, bodyEn: form.bodyEn, bodyAr: form.bodyAr, audience, banner: form.banner,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    setBusy(true);
    const r = form.id ? await send(`/api/diwan/announcements/${form.id}`, "PUT", body) : await send("/api/diwan/announcements", "POST", body);
    setBusy(false);
    if (!r.ok) return setErr(fields[r.data?.field] ?? t("It was not saved. Try again.", "لم يُحفظ. حاول مرة أخرى."));
    onSaved();
  };

  const label = "mb-1 block text-sm font-semibold";
  return (
    <form onSubmit={save} className={`${card} mb-6 space-y-4`}>
      <h2 className="text-lg font-bold">{form.id ? t("Edit announcement", "تعديل الإعلان") : t("New announcement", "إعلان جديد")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div dir="ltr">
          <label className={label} htmlFor="ten">Title (English) *</label>
          <input id="ten" className={field} maxLength={120} value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="ben">Text (English) *</label>
          <textarea id="ben" className={area} rows={4} maxLength={2000} value={form.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} />
        </div>
        <div dir="rtl">
          <label className={label} htmlFor="tar">العنوان (بالعربية) *</label>
          <input id="tar" className={field} maxLength={120} value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="bar">النص (بالعربية) *</label>
          <textarea id="bar" className={area} rows={4} maxLength={2000} value={form.bodyAr} onChange={(e) => set("bodyAr", e.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className={label}>{t("Who sees it", "لمن يظهر")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "accounts", "plans"] as const).map((w) => (
            <label key={w} className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${form.who === w ? "bg-primary/10 ring-primary" : "ring-fg/15"}`}>
              <input type="radio" name="who" checked={form.who === w} onChange={() => set("who", w)} />
              {w === "all" ? t("Every shop", "كل المتاجر") : w === "accounts" ? t("Chosen shops", "متاجر محددة") : t("Shops on plans", "متاجر بباقات معينة")}
            </label>
          ))}
        </div>
        {form.who === "accounts" && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {form.shops.map((x) => (
                <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-semibold">
                  {x.name}
                  <button type="button" onClick={() => set("shops", form.shops.filter((y) => y.id !== x.id))} aria-label={t("Remove", "إزالة")} className="text-muted hover:text-red-600">×</button>
                </span>
              ))}
            </div>
            <input className={`${field} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by store name or email…", "ابحث باسم المتجر أو البريد…")} />
            {!!found.length && (
              <ul className="max-w-md divide-y divide-fg/10 rounded-xl ring-1 ring-fg/10">
                {found.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      disabled={form.shops.some((y) => y.id === x.id)}
                      onClick={() => set("shops", [...form.shops, x])}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-soft disabled:opacity-50"
                    >
                      <span className="font-medium">{x.name}</span>
                      <span className="text-xs text-muted" dir="ltr">{x.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {form.who === "plans" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {plans.map((p) => (
              <label key={p.key} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-fg/15">
                <input type="checkbox" checked={form.plans.includes(p.key)} onChange={(e) => set("plans", e.target.checked ? [...form.plans, p.key] : form.plans.filter((k) => k !== p.key))} />
                {t(p.nameEn, p.nameAr)}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="sa">{t("Starts", "يبدأ")}</label>
          <input id="sa" type="datetime-local" className={field} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="ea">{t("Ends (optional)", "ينتهي (اختياري)")}</label>
          <input id="ea" type="datetime-local" className={field} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" checked={form.banner} onChange={(e) => set("banner", e.target.checked)} />
          {t("Also show as a banner on their home page", "أظهره أيضًا كشريط في صفحتهم الرئيسية")}
        </label>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : form.id ? t("Save changes", "حفظ التعديلات") : t("Publish", "نشر")}</Btn>
        <Btn kind="ghost" type="button" onClick={() => setForm(null)}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}
