"use client";

import { useEffect, useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { PAGE_LIMITS, PAGE_NEXT, PAGE_SLUG, PageBody, type PageStatus } from "@/components/dukkanPages";

/* Dukkan's pages for merchants (guides, news, rules), read in the merchant dashboard at /from-dukkan. Written here in
   English and Arabic, for every shop, chosen shops or plans; Draft → Live → Hidden. "In the menu" pins a page at the top
   of their list. Every change is in the activity log. */

type Audience = { all: true } | { accounts: (number | string)[] } | { plans: string[] };
type Row = {
  id: string; slug: string; titleEn: string; titleAr: string; summaryEn: string; summaryAr: string; bodyEn: string; bodyAr: string;
  status: PageStatus; inMenu: boolean; sort: number; audience: Audience; publishedAt: string | null; updatedAt: string; by: string | null;
  views: number; reach: number;
};
type Data = { pages: Row[]; plans: { key: string; nameEn: string; nameAr: string }[]; shops: Record<string, { name: string; email: string }> };
type Shop = { id: string; name: string; email: string };
type Form = {
  id: string | null; slug: string; slugTouched: boolean; titleEn: string; titleAr: string; summaryEn: string; summaryAr: string; bodyEn: string; bodyAr: string;
  inMenu: boolean; sort: string; who: "all" | "accounts" | "plans"; shops: Shop[]; plans: string[];
};

const blank = (): Form => ({ id: null, slug: "", slugTouched: false, titleEn: "", titleAr: "", summaryEn: "", summaryAr: "", bodyEn: "", bodyAr: "", inMenu: false, sort: "100", who: "all", shops: [], plans: [] });
const STATUS_TONE: Record<PageStatus, Tone> = { draft: "grey", live: "green", hidden: "red" };
const slugOf = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 61);

function useWords() {
  const t = useT();
  return {
    status: (s: PageStatus) => ({ draft: t("Draft", "مسودة"), live: t("Live", "منشورة"), hidden: t("Hidden", "مخفية") })[s],
    move: (from: PageStatus, to: PageStatus) =>
      to === "live" ? (from === "hidden" ? t("Show again", "إظهارها مجددًا") : t("Publish", "نشر")) : to === "hidden" ? t("Hide", "إخفاء") : t("Back to draft", "إعادتها مسودة"),
    ask: (to: PageStatus) =>
      to === "live" ? t("Merchants it is for will see it in their dashboard right away.", "سيراها التجار المعنيون في لوحة التحكم فورًا.")
      : to === "hidden" ? t("Merchants stop seeing it. You can show it again later.", "لن يراها التجار بعد الآن. يمكنك إظهارها لاحقًا.")
      : t("It goes back to being a draft only staff see.", "تعود مسودة يراها الفريق فقط."),
  };
}

export default function PagesPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/pages");
  const [form, setForm] = useState<Form | null>(null);

  const edit = (r: Row, d: Data) => {
    const a = r.audience as Record<string, unknown>;
    setForm({
      id: r.id, slug: r.slug, slugTouched: true, titleEn: r.titleEn, titleAr: r.titleAr, summaryEn: r.summaryEn, summaryAr: r.summaryAr, bodyEn: r.bodyEn, bodyAr: r.bodyAr,
      inMenu: r.inMenu, sort: String(r.sort),
      who: Array.isArray(a.accounts) ? "accounts" : Array.isArray(a.plans) ? "plans" : "all",
      shops: Array.isArray(a.accounts) ? (a.accounts as unknown[]).map((id) => ({ id: String(id), name: d.shops[String(id)]?.name ?? `#${id}`, email: d.shops[String(id)]?.email ?? "" })) : [],
      plans: Array.isArray(a.plans) ? (a.plans as string[]) : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHead
        title={t("Pages", "الصفحات")}
        sub={t("Guides, news and rules merchants read inside their dashboard (From Dukkan).", "أدلة وأخبار وقواعد يقرؤها التجار داخل لوحة التحكم (من دكّان).")}
        actions={!form && <Btn onClick={() => setForm(blank())}>{t("New page", "صفحة جديدة")}</Btn>}
      />
      <Loaded s={s}>
        {(d) => (
          <>
            {form && <Editor form={form} setForm={setForm} plans={d.plans} onSaved={() => { setForm(null); s.reload(); }} />}
            <div className="space-y-3">
              {d.pages.length === 0 && !form && (
                <div className={`${card} text-center`}>
                  <p className="font-semibold">{t("No pages yet.", "لا توجد صفحات بعد.")}</p>
                  <p className="mt-1 text-sm text-muted">{t("Write a guide or a piece of news for merchants. It starts as a draft.", "اكتب دليلًا أو خبرًا للتجار. تبدأ الصفحة كمسودة.")}</p>
                </div>
              )}
              {d.pages.map((r) => <PageRow key={r.id} r={r} d={d} onEdit={() => edit(r, d)} reload={s.reload} />)}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

function audienceText(t: ReturnType<typeof useT>, r: Row, d: Data) {
  const a = r.audience as Record<string, unknown>;
  if (Array.isArray(a.accounts)) {
    const names = (a.accounts as unknown[]).map((id) => d.shops[String(id)]?.name ?? `#${id}`);
    return t(`Stores: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` +${names.length - 4}` : ""}`, `متاجر: ${names.slice(0, 4).join("، ")}${names.length > 4 ? ` +${names.length - 4}` : ""}`);
  }
  if (Array.isArray(a.plans)) {
    const names = (a.plans as string[]).map((k) => {
      const p = d.plans.find((x) => x.key === k);
      return p ? t(p.nameEn, p.nameAr) : k;
    });
    return t(`Plans: ${names.join(", ")}`, `الباقات: ${names.join("، ")}`);
  }
  return t("Every store", "كل المتاجر");
}

function PageRow({ r, d, onEdit, reload }: { r: Row; d: Data; onEdit: () => void; reload: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useWords();
  const [asking, setAsking] = useState<PageStatus | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const act = async () => {
    if (!asking) return;
    setBusy(true);
    setErr("");
    const res = asking === "delete" ? await send(`/api/diwan/pages/${r.id}`, "DELETE") : await send(`/api/diwan/pages/${r.id}`, "PATCH", { status: asking });
    setBusy(false);
    setAsking(null);
    if (res.ok) return reload();
    setErr(
      res.data?.result === "not-ready"
        ? t("Write its text in English and Arabic first (Edit).", "اكتب نصها بالإنجليزية والعربية أولًا (تعديل).")
        : res.data?.result === "not-allowed"
          ? t("Only a draft that was never published can be deleted. Hide it instead.", "يمكن حذف المسودة التي لم تُنشر فقط. أخفِها بدلًا من ذلك.")
          : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا."),
    );
  };

  return (
    <article className={card}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[r.status]}>{w.status(r.status)}</Badge>
            {r.inMenu && <Badge tone="primary">{t("Pinned", "مثبّتة")}</Badge>}
            <span className="text-xs text-muted">{audienceText(t, r, d)}</span>
          </div>
          <h2 className="mt-2 break-words font-bold">{t(r.titleEn, r.titleAr)}</h2>
          {t(r.summaryEn, r.summaryAr) && <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{t(r.summaryEn, r.summaryAr)}</p>}
          <p className="mt-2 text-xs text-muted">
            <code dir="ltr">/from-dukkan/{r.slug}</code>
            {" · "}
            {r.publishedAt ? t(`published ${f.date(r.publishedAt)}`, `نُشرت ${f.date(r.publishedAt)}`) : t("never published", "لم تُنشر بعد")}
            {" · "}
            {t(`changed ${f.ago(r.updatedAt)}`, `عُدّلت ${f.ago(r.updatedAt)}`)}
            {r.by ? ` ${t("by", "بواسطة")} ${r.by}` : ""}
          </p>
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold tabular-nums">{f.num(r.views)}<span className="text-sm font-medium text-muted"> / {f.num(r.reach)}</span></p>
          <p className="text-xs text-muted">{t("stores opened it", "متجر فتحها")}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-fg/10 pt-3">
        {asking ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm ring-1 ring-amber-500/30">
            <p className="min-w-0 flex-1">
              <span className="font-semibold">{asking === "delete" ? t("Delete this draft for good?", "حذف هذه المسودة نهائيًا؟") : `${w.move(r.status, asking)}?`}</span>{" "}
              <span className="text-muted">{asking === "delete" ? "" : w.ask(asking)}</span>
            </p>
            <Btn kind={asking === "delete" || asking === "hidden" ? "danger" : "primary"} disabled={busy} onClick={() => void act()}>{t("Yes", "نعم")}</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => setAsking(null)}>{t("Cancel", "إلغاء")}</Btn>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Btn kind="ghost" onClick={onEdit}>{t("Edit", "تعديل")}</Btn>
            {PAGE_NEXT[r.status].map((to) => (
              <Btn key={to} kind={to === "live" ? "primary" : "ghost"} onClick={() => setAsking(to)}>{w.move(r.status, to)}</Btn>
            ))}
            {r.status === "draft" && !r.publishedAt && <Btn kind="ghost" className="!text-red-600" onClick={() => setAsking("delete")}>{t("Delete", "حذف")}</Btn>}
          </div>
        )}
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
      </div>
    </article>
  );
}

function Editor({ form, setForm, plans, onSaved }: { form: Form; setForm: (f: Form | null) => void; plans: Data["plans"]; onSaved: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Shop[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [look, setLook] = useState<"en" | "ar">("ar");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const slug = form.slugTouched ? form.slug : slugOf(form.titleEn);

  /* shop search, a moment after typing stops (the same search as announcements) */
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
    slug: t("The address: small English letters, digits and dashes (at least 2).", "العنوان: أحرف إنجليزية صغيرة وأرقام وشَرطات (حرفان على الأقل)."),
    titleEn: t("Write the title in English.", "اكتب العنوان بالإنجليزية."),
    titleAr: t("Write the title in Arabic.", "اكتب العنوان بالعربية."),
    sort: t("The place must be a whole number.", "يجب أن يكون الترتيب رقمًا صحيحًا."),
    audience: t("Choose who it is for (at least one store or plan).", "اختر لمن هي (متجر أو باقة واحدة على الأقل)."),
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!PAGE_SLUG.test(slug)) return setErr(fields.slug);
    const audience = form.who === "all" ? { all: true } : form.who === "accounts" ? { accounts: form.shops.map((x) => x.id) } : { plans: form.plans };
    const body = {
      slug, titleEn: form.titleEn, titleAr: form.titleAr, summaryEn: form.summaryEn, summaryAr: form.summaryAr, bodyEn: form.bodyEn, bodyAr: form.bodyAr,
      inMenu: form.inMenu, sort: Number(form.sort || 100), audience,
    };
    setBusy(true);
    const r = form.id ? await send(`/api/diwan/pages/${form.id}`, "PATCH", body) : await send("/api/diwan/pages", "POST", body);
    setBusy(false);
    if (r.ok) return onSaved();
    if (r.data?.result === "taken") return setErr(t("Another page has this address.", "توجد صفحة أخرى بهذا العنوان."));
    setErr(fields[r.data?.field] ?? t("It was not saved. Try again.", "لم تُحفظ. حاول مرة أخرى."));
  };

  const label = "mb-1 block text-sm font-semibold";
  const hint = t(
    "Blank line: new paragraph · “## ” heading · “- ” list · [words](https://… or /path) link",
    "سطر فارغ: فقرة جديدة · «## » عنوان · «- » قائمة · [كلمات](https://… أو /path) رابط",
  );
  const pv = look === "en" ? { title: form.titleEn, summary: form.summaryEn, body: form.bodyEn } : { title: form.titleAr, summary: form.summaryAr, body: form.bodyAr };

  return (
    <form onSubmit={save} className={`${card} mb-6 space-y-5`}>
      <h2 className="text-lg font-bold">{form.id ? t("Edit page", "تعديل الصفحة") : t("New page", "صفحة جديدة")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div dir="ltr" lang="en">
          <label className={label} htmlFor="pten">Title (English) *</label>
          <input id="pten" className={field} maxLength={PAGE_LIMITS.title} value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="psen">Short line (English)</label>
          <input id="psen" className={field} maxLength={PAGE_LIMITS.summary} value={form.summaryEn} onChange={(e) => set("summaryEn", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="pben">Text (English)</label>
          <textarea id="pben" className={area} rows={10} maxLength={PAGE_LIMITS.body} value={form.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} />
        </div>
        <div dir="rtl" lang="ar">
          <label className={label} htmlFor="ptar">العنوان (بالعربية) *</label>
          <input id="ptar" className={field} maxLength={PAGE_LIMITS.title} value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="psar">سطر قصير (بالعربية)</label>
          <input id="psar" className={field} maxLength={PAGE_LIMITS.summary} value={form.summaryAr} onChange={(e) => set("summaryAr", e.target.value)} />
          <label className={`${label} mt-3`} htmlFor="pbar">النص (بالعربية)</label>
          <textarea id="pbar" className={area} rows={10} maxLength={PAGE_LIMITS.body} value={form.bodyAr} onChange={(e) => set("bodyAr", e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">{hint}</p>

      {/* how the merchant sees it */}
      <div className="rounded-2xl bg-soft p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold">{t("How merchants see it", "كيف يراها التجار")}</p>
          <div className="flex gap-1 rounded-lg bg-card p-1 text-xs font-semibold" role="tablist">
            {(["ar", "en"] as const).map((l) => (
              <button key={l} type="button" role="tab" aria-selected={look === l} onClick={() => setLook(l)} className={`rounded-md px-3 py-1 ${look === l ? "bg-ink text-onink" : "text-muted hover:text-fg"}`}>
                {l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>
        <article dir={look === "ar" ? "rtl" : "ltr"} lang={look} className="rounded-xl bg-card p-5 ring-1 ring-fg/10">
          <h1 className="text-xl font-extrabold">{pv.title || <span className="text-muted">{look === "ar" ? "العنوان" : "Title"}</span>}</h1>
          {pv.summary && <p className="mt-1 text-sm text-muted">{pv.summary}</p>}
          {pv.body ? <PageBody text={pv.body} className="mt-4" /> : <p className="mt-4 text-sm text-muted">{look === "ar" ? "لا يوجد نص بعد." : "No text yet."}</p>}
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="pslug">{t("Address", "العنوان في الرابط")}</label>
          <div className="flex items-center gap-1" dir="ltr">
            <span className="text-xs text-muted">/from-dukkan/</span>
            <input id="pslug" className={field} maxLength={61} value={slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase(), slugTouched: true })} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="psort">{t("Place in the list", "الترتيب في القائمة")}</label>
          <input id="psort" inputMode="numeric" dir="ltr" className={field} value={form.sort} onChange={(e) => set("sort", e.target.value.replace(/\D/g, ""))} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" checked={form.inMenu} onChange={(e) => set("inMenu", e.target.checked)} />
          {t("Pin it at the top of their list", "تثبيتها أعلى قائمتهم")}
        </label>
      </div>

      <fieldset>
        <legend className={label}>{t("Who sees it", "لمن تظهر")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "accounts", "plans"] as const).map((w) => (
            <label key={w} className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${form.who === w ? "bg-primary/10 ring-primary" : "ring-fg/15"}`}>
              <input type="radio" name="pwho" checked={form.who === w} onChange={() => set("who", w)} />
              {w === "all" ? t("Every store", "كل المتاجر") : w === "accounts" ? t("Chosen stores", "متاجر محددة") : t("Stores on plans", "متاجر بباقات معينة")}
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
                    <button type="button" disabled={form.shops.some((y) => y.id === x.id)} onClick={() => set("shops", [...form.shops, x])} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-soft disabled:opacity-50">
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

      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : form.id ? t("Save changes", "حفظ التعديلات") : t("Save as draft", "حفظ كمسودة")}</Btn>
        <Btn kind="ghost" type="button" onClick={() => setForm(null)}>{t("Cancel", "إلغاء")}</Btn>
      </div>
    </form>
  );
}
