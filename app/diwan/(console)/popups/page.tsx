"use client";

import { useEffect, useState } from "react";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { PopupCard } from "@/components/MerchantPopup";
import { POPUP_IMAGE_MAX, POPUP_LIMITS, POPUP_NEXT, type PopupStatus, type PopupView } from "@/components/popupRules";
import { checkImage, uploadProblemFor } from "@/components/safe";

/* Pop-ups to merchants, in Diwan's marketing pages: a box in the middle of the merchant's home page (an offer, a new
   feature, a notice), with an optional picture and button. Made as a draft with a live preview, then released: each shop
   it is for sees it once, between its start and end. "Seen" and "pressed" count the shops. Every change is in the
   activity log. */

type Audience = { all: true } | { accounts: (number | string)[] } | { plans: string[] };
type Shown = "draft" | "scheduled" | "showing" | "expired" | "ended";
type Row = PopupView & {
  status: PopupStatus; shown: Shown; audience: Audience; priority: number;
  startsAt: string; endsAt: string | null; createdAt: string; updatedAt: string; by: string | null;
  reach: number; seen: number; clicked: number;
};
type Data = { popups: Row[]; plans: { key: string; nameEn: string; nameAr: string }[]; shops: Record<string, { name: string; email: string }> };
type Shop = { id: string; name: string; email: string };
type Form = {
  id: string | null; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; image: string;
  buttonEn: string; buttonAr: string; buttonLink: string;
  who: "all" | "accounts" | "plans"; shops: Shop[]; plans: string[]; startsAt: string; endsAt: string; priority: string;
};

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const blank = (): Form => ({
  id: null, titleEn: "", titleAr: "", bodyEn: "", bodyAr: "", image: "", buttonEn: "", buttonAr: "", buttonLink: "",
  who: "all", shops: [], plans: [], startsAt: toLocal(new Date().toISOString()), endsAt: "", priority: "0",
});
const SHOWN_TONE: Record<Shown, Tone> = { draft: "grey", scheduled: "blue", showing: "green", expired: "amber", ended: "grey" };

export default function PopupsPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/popups");
  const [form, setForm] = useState<Form | null>(null);

  const edit = (r: Row, d: Data) => {
    const a = r.audience as Record<string, unknown>;
    setForm({
      id: r.id, titleEn: r.titleEn, titleAr: r.titleAr, bodyEn: r.bodyEn, bodyAr: r.bodyAr, image: r.image,
      buttonEn: r.buttonEn, buttonAr: r.buttonAr, buttonLink: r.buttonLink,
      who: Array.isArray(a.accounts) ? "accounts" : Array.isArray(a.plans) ? "plans" : "all",
      shops: Array.isArray(a.accounts) ? (a.accounts as unknown[]).map((id) => ({ id: String(id), name: d.shops[String(id)]?.name ?? `#${id}`, email: d.shops[String(id)]?.email ?? "" })) : [],
      plans: Array.isArray(a.plans) ? (a.plans as string[]) : [],
      startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt), priority: String(r.priority),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHead
        title={t("Pop-ups", "النوافذ المنبثقة")}
        sub={t("A box in the middle of the merchants' home page: an offer, a new feature, a notice. Each store sees it once.", "نافذة في وسط الصفحة الرئيسية للتجار: عرض، ميزة جديدة، تنبيه. يراها كل متجر مرة واحدة.")}
        actions={!form && <Btn onClick={() => setForm(blank())}>{t("New pop-up", "نافذة جديدة")}</Btn>}
      />
      <Loaded s={s}>
        {(d) => (
          <>
            {form && <Editor form={form} setForm={setForm} plans={d.plans} onSaved={() => { setForm(null); s.reload(); }} />}
            <div className="space-y-3">
              {d.popups.length === 0 && !form && (
                <div className={`${card} text-center`}>
                  <p className="font-semibold">{t("No pop-ups yet.", "لا توجد نوافذ بعد.")}</p>
                  <p className="mt-1 text-sm text-muted">{t("Make one to tell merchants about an offer or something new.", "أنشئ واحدة لتخبر التجار بعرض أو بشيء جديد.")}</p>
                </div>
              )}
              {d.popups.map((r) => <PopupRow key={r.id} r={r} d={d} onEdit={() => edit(r, d)} reload={s.reload} />)}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

function useAudienceText() {
  const t = useT();
  return (r: Row, d: Data) => {
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
  };
}

function PopupRow({ r, d, onEdit, reload }: { r: Row; d: Data; onEdit: () => void; reload: () => void }) {
  const t = useT();
  const f = useFmt();
  const audienceText = useAudienceText();
  const [asking, setAsking] = useState<PopupStatus | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shownWord: Record<Shown, string> = {
    draft: t("Draft", "مسودة"), scheduled: t("Released · starts later", "منشورة · تبدأ لاحقًا"), showing: t("Showing now", "تظهر الآن"),
    expired: t("Released · its end passed", "منشورة · انتهى وقتها"), ended: t("Ended", "منتهية"),
  };
  const moveWord = (to: PopupStatus) => (to === "live" ? (r.status === "ended" ? t("Show again", "إظهارها مجددًا") : t("Release", "نشر")) : to === "ended" ? t("End now", "إنهاء الآن") : t("Back to draft", "إلى مسودة"));
  const askWord = (a: PopupStatus | "delete") =>
    a === "live" ? t(`Stores it is for will see it on their home page${r.startsAt && new Date(r.startsAt) > new Date() ? " from its start" : " right away"}. Stores that saw it already won't see it again.`, `ستراها المتاجر المعنية في صفحتها الرئيسية${r.startsAt && new Date(r.startsAt) > new Date() ? " من وقت بدايتها" : " فورًا"}. المتاجر التي رأتها لن تراها مجددًا.`)
    : a === "ended" ? t("No store sees it from now. Its numbers stay.", "لن يراها أي متجر من الآن. تبقى أرقامها.")
    : t("Delete this draft for good?", "حذف هذه المسودة نهائيًا؟");

  const act = async (a: PopupStatus | "delete") => {
    setBusy(true);
    setErr("");
    const res = a === "delete" ? await send(`/api/diwan/popups/${r.id}`, "DELETE") : await send(`/api/diwan/popups/${r.id}`, "PATCH", { status: a });
    setBusy(false);
    setAsking(null);
    if (res.ok) return reload();
    setErr(res.data?.result === "over" ? t("Its end has passed: edit it and set a new end first.", "انتهى وقتها: عدّلها وحدد نهاية جديدة أولًا.") : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
  };

  const rate = r.seen ? Math.round((r.clicked / r.seen) * 100) : 0;
  return (
    <article className={`${card} !p-0 overflow-hidden`}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-soft sm:w-40">
          {r.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-primary/25 via-primary/10 to-amber-300/30 text-primary">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h10M7 14h6" /></svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SHOWN_TONE[r.shown]}>{shownWord[r.shown]}</Badge>
            {r.priority > 0 && <Badge tone="amber">{t(`Priority ${r.priority}`, `الأولوية ${r.priority}`)}</Badge>}
            <span className="text-xs text-muted">{audienceText(r, d)}</span>
          </div>
          <h2 className="mt-2 break-words font-bold">{t(r.titleEn, r.titleAr)}</h2>
          {t(r.bodyEn, r.bodyAr) && <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-muted">{t(r.bodyEn, r.bodyAr)}</p>}
          <p className="mt-2 text-xs text-muted">
            {f.dateTime(r.startsAt)} → {r.endsAt ? f.dateTime(r.endsAt) : t("no end", "بلا نهاية")}
            {r.by ? ` · ${t("by", "بواسطة")} ${r.by}` : ""}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-4 gap-2 text-center sm:w-72">
          {[
            [f.num(r.reach), t("for", "موجهة لـ")],
            [f.num(r.seen), t("saw it", "شاهدها")],
            [f.num(r.clicked), t("pressed", "ضغط الزر")],
            [r.seen ? `${f.num(rate)}%` : "—", t("press rate", "نسبة الضغط")],
          ].map(([v, l], i) => (
            <div key={i} className="rounded-xl bg-soft px-1 py-2">
              <p className="text-base font-bold tabular-nums">{v}</p>
              <p className="text-[11px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-fg/10 bg-soft/40 px-4 py-3">
        {asking ? (
          <>
            <p className="me-2 text-sm font-semibold">{askWord(asking)}</p>
            <Btn kind={asking === "delete" || asking === "ended" ? "danger" : "primary"} disabled={busy} onClick={() => act(asking)}>{t("Yes", "نعم")}</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => setAsking(null)}>{t("Cancel", "إلغاء")}</Btn>
          </>
        ) : (
          <>
            <Btn kind="ghost" onClick={onEdit}>{t("Edit", "تعديل")}</Btn>
            {POPUP_NEXT[r.status].map((to) => (
              <Btn key={to} kind={to === "live" ? "primary" : "ghost"} disabled={busy} onClick={() => setAsking(to)}>{moveWord(to)}</Btn>
            ))}
            {r.status === "draft" && <Btn kind="ghost" className="!text-red-600" onClick={() => setAsking("delete")}>{t("Delete", "حذف")}</Btn>}
          </>
        )}
        {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
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
  const [picErr, setPicErr] = useState("");
  const [look, setLook] = useState<"en" | "ar">("ar");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  useEffect(() => {
    if (form.who !== "accounts" || q.trim().length < 2) return setFound([]);
    const id = window.setTimeout(async () => {
      const r = await fetch(`/api/diwan/announcements/shops?q=${encodeURIComponent(q.trim())}`, { credentials: "same-origin" });
      const j = await r.json().catch(() => null);
      setFound(Array.isArray(j?.shops) ? j.shops : []);
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, form.who]);

  const pickPicture = async (file: File | undefined) => {
    setPicErr("");
    if (!file) return;
    const rule = { kinds: ["png", "jpeg", "webp"] as ("png" | "jpeg" | "webp")[], max: POPUP_IMAGE_MAX };
    const c = await checkImage(file, rule);
    if ("problem" in c) return setPicErr(uploadProblemFor(c.problem, rule, t("en", "ar") as "en" | "ar"));
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && set("image", reader.result);
    reader.readAsDataURL(file);
  };

  const fields: Record<string, string> = {
    titleEn: t("Write the title in English.", "اكتب العنوان بالإنجليزية."),
    titleAr: t("Write the title in Arabic.", "اكتب العنوان بالعربية."),
    image: t("The picture must be a PNG, JPG or WebP up to 400 KB, a picture on Dukkan (/...), or an https address.", "يجب أن تكون الصورة PNG أو JPG أو WebP حتى 400 ك.ب، أو صورة على دكّان (/...)، أو عنوان https."),
    buttonLink: t("The button link must be a Dukkan page (starting with /) or an https address.", "رابط الزر يجب أن يكون صفحة في دكّان (يبدأ بـ /) أو عنوان https."),
    button: t("A button needs its words in English and Arabic and a link (or leave all three empty).", "الزر يحتاج كلماته بالعربية والإنجليزية ورابطًا (أو اترك الثلاثة فارغة)."),
    audience: t("Choose who it is for (at least one store or plan).", "اختر لمن هي (متجر أو باقة واحدة على الأقل)."),
    startsAt: t("Check the start date.", "تحقق من تاريخ البداية."),
    endsAt: t("The end must be after the start.", "يجب أن تكون النهاية بعد البداية."),
    priority: t("Priority is a whole number from 0 to 100.", "الأولوية رقم صحيح من 0 إلى 100."),
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const audience = form.who === "all" ? { all: true } : form.who === "accounts" ? { accounts: form.shops.map((x) => x.id) } : { plans: form.plans };
    const body = {
      titleEn: form.titleEn, titleAr: form.titleAr, bodyEn: form.bodyEn, bodyAr: form.bodyAr, image: form.image,
      buttonEn: form.buttonEn, buttonAr: form.buttonAr, buttonLink: form.buttonLink.trim(), audience,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      priority: Number(form.priority || 0),
    };
    setBusy(true);
    const r = form.id ? await send(`/api/diwan/popups/${form.id}`, "PATCH", body) : await send("/api/diwan/popups", "POST", body);
    setBusy(false);
    if (!r.ok) return setErr(fields[r.data?.field] ?? t("It was not saved. Try again.", "لم يُحفظ. حاول مرة أخرى."));
    onSaved();
  };

  const label = "mb-1 block text-sm font-semibold";
  const preview: PopupView = {
    id: "preview",
    titleEn: form.titleEn || "Your title", titleAr: form.titleAr || "العنوان هنا",
    bodyEn: form.bodyEn, bodyAr: form.bodyAr, image: form.image,
    buttonEn: form.buttonEn, buttonAr: form.buttonAr, buttonLink: form.buttonLink || "#",
  };
  return (
    <form onSubmit={save} className={`${card} mb-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{form.id ? t("Edit pop-up", "تعديل النافذة") : t("New pop-up", "نافذة جديدة")}</h2>
        {!form.id && <p className="text-xs text-muted">{t("It is saved as a draft: nobody sees it until you release it.", "تُحفظ كمسودة: لا يراها أحد حتى تنشرها.")}</p>}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div dir="ltr">
              <label className={label} htmlFor="pten">Title (English) *</label>
              <input id="pten" className={field} maxLength={POPUP_LIMITS.title} value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} onFocus={() => setLook("en")} />
              <label className={`${label} mt-3`} htmlFor="pben">Text (English)</label>
              <textarea id="pben" className={area} rows={3} maxLength={POPUP_LIMITS.body} value={form.bodyEn} onChange={(e) => set("bodyEn", e.target.value)} onFocus={() => setLook("en")} />
              <label className={`${label} mt-3`} htmlFor="pbtnen">Button (English)</label>
              <input id="pbtnen" className={field} maxLength={POPUP_LIMITS.button} placeholder="e.g. See the offer" value={form.buttonEn} onChange={(e) => set("buttonEn", e.target.value)} onFocus={() => setLook("en")} />
            </div>
            <div dir="rtl">
              <label className={label} htmlFor="ptar">العنوان (بالعربية) *</label>
              <input id="ptar" className={field} maxLength={POPUP_LIMITS.title} value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} onFocus={() => setLook("ar")} />
              <label className={`${label} mt-3`} htmlFor="pbar">النص (بالعربية)</label>
              <textarea id="pbar" className={area} rows={3} maxLength={POPUP_LIMITS.body} value={form.bodyAr} onChange={(e) => set("bodyAr", e.target.value)} onFocus={() => setLook("ar")} />
              <label className={`${label} mt-3`} htmlFor="pbtnar">الزر (بالعربية)</label>
              <input id="pbtnar" className={field} maxLength={POPUP_LIMITS.button} placeholder="مثلًا: شاهد العرض" value={form.buttonAr} onChange={(e) => set("buttonAr", e.target.value)} onFocus={() => setLook("ar")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="plink">{t("Button link", "رابط الزر")}</label>
              <input id="plink" dir="ltr" className={field} maxLength={300} placeholder="/themes  ·  https://…" value={form.buttonLink} onChange={(e) => set("buttonLink", e.target.value)} />
              <p className="mt-1 text-xs text-muted">{t("A Dukkan page (like /themes) or an https address (opens in a new tab).", "صفحة في دكّان (مثل /themes) أو عنوان https (يفتح في تبويب جديد).")}</p>
            </div>
            <div>
              <span className={label}>{t("Picture (optional)", "صورة (اختيارية)")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-fg/15 bg-card px-4 text-sm font-semibold hover:bg-soft">
                  {form.image ? t("Change picture", "تغيير الصورة") : t("Choose a picture", "اختر صورة")}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pickPicture(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {form.image && <Btn type="button" kind="ghost" onClick={() => set("image", "")}>{t("Remove", "إزالة")}</Btn>}
              </div>
              <p className="mt-1 text-xs text-muted">{t("PNG, JPG or WebP, up to 400 KB. Wide pictures look best.", "PNG أو JPG أو WebP حتى 400 ك.ب. الصور العريضة أجمل.")}</p>
              {picErr && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{picErr}</p>}
            </div>
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
                <input className={`${field} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by store name or full email…", "ابحث باسم المتجر أو البريد كاملًا…")} />
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="psa">{t("Starts", "تبدأ")}</label>
              <input id="psa" type="datetime-local" className={field} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="pea">{t("Ends (optional)", "تنتهي (اختياري)")}</label>
              <input id="pea" type="datetime-local" className={field} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="ppr">{t("Priority (0–100)", "الأولوية (0–100)")}</label>
              <input id="ppr" inputMode="numeric" dir="ltr" className={field} value={form.priority} onChange={(e) => set("priority", e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">{t("A store sees one pop-up at a time: the highest priority first, then the newest.", "يرى المتجر نافذة واحدة في كل مرة: الأعلى أولوية أولًا، ثم الأحدث.")}</p>

          {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : form.id ? t("Save changes", "حفظ التعديلات") : t("Save as draft", "حفظ كمسودة")}</Btn>
            <Btn kind="ghost" type="button" onClick={() => setForm(null)}>{t("Cancel", "إلغاء")}</Btn>
          </div>
        </div>

        {/* what merchants will see, as they will see it */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{t("What merchants see", "ما يراه التجار")}</p>
            <div className="flex gap-1 rounded-lg bg-soft p-0.5" role="tablist" aria-label={t("Preview language", "لغة المعاينة")}>
              {(["ar", "en"] as const).map((l) => (
                <button key={l} type="button" role="tab" aria-selected={look === l} onClick={() => setLook(l)} className={`h-7 rounded-md px-3 text-xs font-semibold ${look === l ? "bg-card shadow-sm" : "text-muted"}`}>
                  {l === "ar" ? "العربية" : "English"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid min-h-[22rem] place-items-center rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(0,0,0,.03)_0_10px,transparent_10px_20px)] bg-black/40 p-5" aria-hidden>
            <div className="pointer-events-none w-full max-w-sm">
              <PopupCard popup={preview} lang={look} />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
