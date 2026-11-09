"use client";

import { useEffect, useState } from "react";
import { AudiencePicker, audienceBody, audienceForm, blankAudience, useAudienceText, type Audience, type AudienceForm, type ShopNames } from "@/components/diwan/AudiencePicker";
import { HomeSketch, MockDashboard, PageSketch, PreviewPanel, type Look } from "@/components/diwan/MerchantPreview";
import { THEME_CATALOG } from "@/components/diwan/themeCatalog";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { content } from "@/components/content";
import { menuEntries } from "@/components/DashboardBar";
import { POPUP_IMAGE_MAX, POPUP_NEXT, type PopupStatus } from "@/components/popupRules";
import {
  biOf, isBiKind, POPUP_TEMPLATE_RULES, TEMPLATE_IDS, templateRule, valueOf,
  type BiList, type PopupPlacement, type SlotDef, type SlotValues, type TemplateId,
} from "@/components/popupTemplateRules";
import { PopupTemplate } from "@/components/popupTemplates";
import { checkImage, uploadProblemFor } from "@/components/safe";
import type { ListingRow } from "@/components/themeListing";
import { findTheme } from "@/components/themes";

/* Pop-ups to merchants, in Diwan's marketing pages: one of the coded templates (components/popupTemplateRules.ts) with
   its slots filled in, shown in the middle of the merchant's dashboard: on the home page or on any merchant page. Made
   as a draft with a live preview of the dashboard, then released: each store it is for sees it once, between its start
   and end. "Seen" and "pressed" count the stores. Every change is in the activity log. */

type Shown = "draft" | "scheduled" | "showing" | "expired" | "ended";
type Row = {
  id: string; template: TemplateId; slots: SlotValues; placement: PopupPlacement; titleEn: string; titleAr: string;
  status: PopupStatus; shown: Shown; audience: Audience; priority: number;
  startsAt: string; endsAt: string | null; createdAt: string; updatedAt: string; by: string | null;
  reach: number; seen: number; clicked: number;
};
type Data = { popups: Row[]; shops: ShopNames };
type Form = {
  id: string | null; template: TemplateId; slots: SlotValues; placement: PopupPlacement;
  audience: AudienceForm; startsAt: string; endsAt: string; priority: string;
};

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const blank = (): Form => ({
  id: null, template: "card", slots: { ...POPUP_TEMPLATE_RULES.card.start }, placement: "home",
  audience: blankAudience(), startsAt: toLocal(new Date().toISOString()), endsAt: "", priority: "0",
});
const SHOWN_TONE: Record<Shown, Tone> = { draft: "grey", scheduled: "blue", showing: "green", expired: "amber", ended: "grey" };

/** The picture a pop-up shows in the list: its own, else its theme's */
const pictureOf = (r: { slots: SlotValues }) => valueOf(r.slots, "image") || findTheme(valueOf(r.slots, "theme"))?.shot || "";

export default function PopupsPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/popups");
  const [form, setForm] = useState<Form | null>(null);

  const edit = (r: Row, d: Data) => {
    setForm({
      id: r.id, template: r.template in POPUP_TEMPLATE_RULES ? r.template : "card", slots: r.slots ?? {}, placement: r.placement,
      audience: audienceForm(r.audience, d.shops), startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt), priority: String(r.priority),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHead
        title={t("Pop-ups", "النوافذ المنبثقة")}
        sub={t("A box in the middle of the merchants' dashboard: an offer, a new feature, a gift. Each store sees it once.", "نافذة في وسط لوحة تحكم التجار: عرض، ميزة جديدة، هدية. يراها كل متجر مرة واحدة.")}
        actions={!form && <Btn onClick={() => setForm(blank())}>{t("New pop-up", "نافذة جديدة")}</Btn>}
      />
      <Loaded s={s}>
        {(d) => (
          <>
            {form && <Editor form={form} setForm={setForm} onSaved={() => { setForm(null); s.reload(); }} />}
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
  const later = !!r.startsAt && new Date(r.startsAt) > new Date();
  const where = r.placement === "any" ? t("on the first merchant page they open", "في أول صفحة يفتحونها في لوحة التحكم") : t("on their home page", "في صفحتهم الرئيسية");
  const askWord = (a: PopupStatus | "delete") =>
    a === "live" ? t(`Stores it is for will see it ${where}${later ? " from its start" : " right away"}. Stores that saw it already won't see it again.`, `ستراها المتاجر المعنية ${where}${later ? " من وقت بدايتها" : " فورًا"}. المتاجر التي رأتها لن تراها مجددًا.`)
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
  const pic = pictureOf(r);
  const rule = POPUP_TEMPLATE_RULES[r.template] as (typeof POPUP_TEMPLATE_RULES)[TemplateId] | undefined;
  const text = biOf(r.slots ?? {}, "body").en ? biOf(r.slots, "body") : biOf(r.slots ?? {}, "intro");
  return (
    <article className={`${card} !p-0 overflow-hidden`}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-soft sm:w-40">
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pic} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-primary/25 via-primary/10 to-amber-300/30 text-primary">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 10h10M7 14h6" /></svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SHOWN_TONE[r.shown]}>{shownWord[r.shown]}</Badge>
            {rule && <Badge tone="primary">{t(rule.name.en, rule.name.ar)}</Badge>}
            {r.priority > 0 && <Badge tone="amber">{t(`Priority ${r.priority}`, `الأولوية ${r.priority}`)}</Badge>}
            <span className="text-xs text-muted">
              {audienceText(r.audience, d.shops)} · {r.placement === "any" ? t("any merchant page", "أي صفحة للتاجر") : t("dashboard home", "الصفحة الرئيسية")}
            </span>
          </div>
          <h2 className="mt-2 break-words font-bold">{t(r.titleEn, r.titleAr)}</h2>
          {t(text.en, text.ar) && <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-muted">{t(text.en, text.ar)}</p>}
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

/** The themes a theme gift can give: the code's, and the theme store's live ones (with the store's prices) */
function useThemeChoices() {
  const [rows, setRows] = useState<ListingRow[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/themes/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && Array.isArray(j?.themes) && setRows(j.themes))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const code = THEME_CATALOG.map((th) => ({ id: th.id, name: byId.get(th.id)?.name ?? th.name, price: byId.get(th.id)?.price ?? th.price }));
  const made = rows.filter((r) => r.source === "design" && r.status === "live").map((r) => ({ id: r.id, name: r.name ?? { en: r.id, ar: r.id }, price: r.price }));
  return [...code, ...made];
}

function ThemeSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const t = useT();
  const themes = useThemeChoices();
  return (
    <select id={id} className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">{t("Choose a theme…", "اختر تصميمًا…")}</option>}
      {themes.map((th) => (
        <option key={th.id} value={th.id}>{t(th.name.en, th.name.ar)} · {th.price > 0 ? t(`${th.price} JOD`, `${th.price} د.أ`) : t("free", "مجاني")}</option>
      ))}
    </select>
  );
}

/** One slot of a template in the form: words in English and Arabic side by side, or one value */
function SlotField({ def, value, onChange, onLang }: { def: SlotDef; value: SlotValues[string] | undefined; onChange: (v: SlotValues[string]) => void; onLang: (l: "en" | "ar") => void }) {
  const t = useT();
  const [picErr, setPicErr] = useState("");
  const label = "mb-1 block text-sm font-semibold";
  const star = def.required ? " *" : "";
  const id = `slot-${def.key}`;
  const hint = def.hint && <p className="mt-1 text-xs text-muted">{t(def.hint.en, def.hint.ar)}</p>;

  if (isBiKind(def.kind)) {
    const list = def.kind === "list";
    const v = (value && typeof value === "object" ? value : { en: list ? [] : "", ar: list ? [] : "" }) as { en: string | string[]; ar: string | string[] };
    const shown = (l: "en" | "ar") => (Array.isArray(v[l]) ? (v[l] as string[]).join("\n") : String(v[l] ?? ""));
    const put = (l: "en" | "ar", s: string) => {
      const items = list ? s.split("\n").slice(0, def.maxItems ?? 10) : s;
      onChange({ ...v, [l]: items } as SlotValues[string]);
    };
    const box = (l: "en" | "ar") => {
      const props = { id: `${id}-${l}`, value: shown(l), onFocus: () => onLang(l), placeholder: def.placeholder?.[l] };
      return def.kind === "text" ? (
        <input {...props} className={field} maxLength={def.max} onChange={(e) => put(l, e.target.value)} />
      ) : (
        <textarea {...props} className={area} rows={list ? Math.min(def.maxItems ?? 4, 6) : 3} maxLength={list ? undefined : def.max} onChange={(e) => put(l, e.target.value)} />
      );
    };
    return (
      <div>
        <div className="grid gap-3 md:grid-cols-2">
          <div dir="ltr" lang="en">
            <label className={label} htmlFor={`${id}-en`}>{def.label.en} (English){star}</label>
            {box("en")}
          </div>
          <div dir="rtl" lang="ar">
            <label className={label} htmlFor={`${id}-ar`}>{def.label.ar} (بالعربية){star}</label>
            {box("ar")}
          </div>
        </div>
        {hint}
      </div>
    );
  }

  const one = typeof value === "string" ? value : "";
  if (def.kind === "theme") {
    return (
      <div>
        <label className={label} htmlFor={id}>{t(def.label.en, def.label.ar)}{star}</label>
        <ThemeSelect id={id} value={one} onChange={onChange} />
        {hint}
      </div>
    );
  }
  if (def.kind === "link") {
    return (
      <div>
        <label className={label} htmlFor={id}>{t(def.label.en, def.label.ar)}{star}</label>
        <input id={id} dir="ltr" className={field} maxLength={300} placeholder="/themes  ·  https://…" value={one} onChange={(e) => onChange(e.target.value)} />
        <p className="mt-1 text-xs text-muted">{t("A Dukkan page (like /themes) or an https address (opens in a new tab).", "صفحة في دكّان (مثل /themes) أو عنوان https (يفتح في تبويب جديد).")}</p>
      </div>
    );
  }
  /* a picture: a file (sent as picture data) or an address */
  const pick = async (file: File | undefined) => {
    setPicErr("");
    if (!file) return;
    const rule = { kinds: ["png", "jpeg", "webp"] as ("png" | "jpeg" | "webp")[], max: POPUP_IMAGE_MAX };
    const c = await checkImage(file, rule);
    if ("problem" in c) return setPicErr(uploadProblemFor(c.problem, rule, t("en", "ar") as "en" | "ar"));
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && onChange(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <span className={label}>{t(def.label.en, def.label.ar)}{star || t(" (optional)", " (اختيارية)")}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-fg/15 bg-card px-4 text-sm font-semibold hover:bg-soft">
          {one ? t("Change picture", "تغيير الصورة") : t("Choose a picture", "اختر صورة")}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <input dir="ltr" aria-label={t("Picture address", "عنوان الصورة")} className={`${field} min-w-0 flex-1`} placeholder={t("or an address: /… or https://…", "أو عنوان: /… أو https://…")} value={one.startsWith("data:") ? "" : one} onChange={(e) => onChange(e.target.value.trim())} />
        {one && <Btn type="button" kind="ghost" onClick={() => onChange("")}>{t("Remove", "إزالة")}</Btn>}
      </div>
      <p className="mt-1 text-xs text-muted">
        {one.startsWith("data:") ? t("A picture from this computer. ", "صورة من هذا الجهاز. ") : ""}
        {t("PNG, JPG or WebP, up to 400 KB.", "PNG أو JPG أو WebP حتى 400 ك.ب.")} {def.hint ? t(def.hint.en, def.hint.ar) : ""}
      </p>
      {picErr && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{picErr}</p>}
    </div>
  );
}

function Editor({ form, setForm, onSaved }: { form: Form; setForm: (f: Form | null) => void; onSaved: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [look, setLook] = useState<Look>({ lang: "ar", phone: false });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const rule = templateRule(form.template);

  /* another template keeps what was written in the slots both have, and starts the others from its own start values */
  const pickTemplate = (id: TemplateId) => {
    if (id === form.template) return;
    const next = templateRule(id);
    const slots: SlotValues = { ...next.start };
    for (const s of next.slots) if (form.slots[s.key] !== undefined && rule.slots.some((o) => o.key === s.key && o.kind === s.kind)) slots[s.key] = form.slots[s.key];
    setForm({ ...form, template: id, slots });
  };

  const messageFor = (key: string): string => {
    const fixed: Record<string, string> = {
      template: t("Choose a template.", "اختر قالبًا."),
      placement: t("Choose where it shows.", "اختر أين تظهر."),
      audience: t("Choose who it is for (at least one store).", "اختر لمن هي (متجر واحد على الأقل)."),
      startsAt: t("Check the start date.", "تحقق من تاريخ البداية."),
      endsAt: t("The end must be after the start.", "يجب أن تكون النهاية بعد البداية."),
      priority: t("Priority is a whole number from 0 to 100.", "الأولوية رقم صحيح من 0 إلى 100."),
    };
    if (fixed[key]) return fixed[key];
    const def = rule.slots.find((s) => s.key === key);
    if (!def) return t("It was not saved. Try again.", "لم يُحفظ. حاول مرة أخرى.");
    const name = t(`“${def.label.en}”`, `«${def.label.ar}»`);
    const group = rule.together?.find((g) => g[0] === key);
    if (group) {
      const names = group.map((k) => rule.slots.find((s) => s.key === k)!).map((s) => t(s.label.en, s.label.ar)).join(t(" and ", " و"));
      return t(`${names} go together: fill in all of them (words in English and Arabic) or leave them all empty.`, `${names} معًا: املأها كلها (الكلمات بالعربية والإنجليزية) أو اتركها كلها فارغة.`);
    }
    if (def.kind === "image") return t("The picture must be a PNG, JPG or WebP up to 400 KB, a picture on Dukkan (/...), or an https address.", "يجب أن تكون الصورة PNG أو JPG أو WebP حتى 400 ك.ب، أو صورة على دكّان (/...)، أو عنوان https.");
    if (def.kind === "link") return t(`${name} must be a Dukkan page (starting with /) or an https address.`, `${name} يجب أن يكون صفحة في دكّان (يبدأ بـ /) أو عنوان https.`);
    if (def.kind === "theme") return t("Choose a theme from the list.", "اختر تصميمًا من القائمة.");
    if (def.kind === "list") return t(`Write ${name} in English and Arabic, at most ${def.maxItems} lines each.`, `اكتب ${name} بالعربية والإنجليزية، ${def.maxItems} أسطر على الأكثر لكل لغة.`);
    return def.required
      ? t(`Write ${name} in English and Arabic.`, `اكتب ${name} بالعربية والإنجليزية.`)
      : t(`Write ${name} in both English and Arabic, or leave both empty.`, `اكتب ${name} بالعربية والإنجليزية معًا، أو اتركهما فارغين.`);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    /* only this template's slots go, with the empty lines of lists left out */
    const slots: SlotValues = {};
    for (const s of rule.slots) {
      const v = form.slots[s.key];
      if (v === undefined) continue;
      slots[s.key] = s.kind === "list" && typeof v === "object" ? { en: ((v as BiList).en ?? []).filter((x) => x.trim()), ar: ((v as BiList).ar ?? []).filter((x) => x.trim()) } : v;
    }
    const body = {
      template: form.template, slots, placement: form.placement, audience: audienceBody(form.audience),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      priority: Number(form.priority || 0),
    };
    setBusy(true);
    const r = form.id ? await send(`/api/diwan/popups/${form.id}`, "PATCH", body) : await send("/api/diwan/popups", "POST", body);
    setBusy(false);
    if (!r.ok) return setErr(r.data?.field ? messageFor(r.data.field) : t("It was not saved. Try again.", "لم يُحفظ. حاول مرة أخرى."));
    onSaved();
  };

  /* the preview shows a title even before one is written */
  const shownSlots: SlotValues = { ...form.slots };
  const titleKey = rule.title;
  const tv = biOf(form.slots, titleKey);
  shownSlots[titleKey] = { en: tv.en || "Your title", ar: tv.ar || "العنوان هنا" };
  const home = form.placement === "home";
  const label = "mb-1 block text-sm font-semibold";

  return (
    <form onSubmit={save} className={`${card} mb-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{form.id ? t("Edit pop-up", "تعديل النافذة") : t("New pop-up", "نافذة جديدة")}</h2>
        {!form.id && <p className="text-xs text-muted">{t("It is saved as a draft: nobody sees it until you release it.", "تُحفظ كمسودة: لا يراها أحد حتى تنشرها.")}</p>}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <fieldset>
            <legend className={label}>{t("Template", "القالب")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_IDS.map((id) => {
                const r = templateRule(id);
                return (
                  <label key={id} className={`flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm ring-1 ${form.template === id ? "bg-primary/10 ring-primary" : "ring-fg/15 hover:bg-soft/60"}`}>
                    <input type="radio" name="ptemplate" className="mt-1" checked={form.template === id} onChange={() => pickTemplate(id)} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{t(r.name.en, r.name.ar)}</span>
                      <span className="mt-0.5 block text-xs text-muted">{t(r.about.en, r.about.ar)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-4">
            {rule.slots.map((def) => (
              <SlotField key={`${form.template}-${def.key}`} def={def} value={form.slots[def.key]} onChange={(v) => set("slots", { ...form.slots, [def.key]: v })} onLang={(l) => setLook({ ...look, lang: l })} />
            ))}
          </div>

          <fieldset>
            <legend className={label}>{t("Where it shows", "أين تظهر")}</legend>
            <div className="flex flex-wrap gap-2">
              {([
                ["home", t("Dashboard home", "الصفحة الرئيسية للوحة التحكم"), t("When they open their home page", "عندما يفتحون صفحتهم الرئيسية")],
                ["any", t("Any merchant page", "أي صفحة للتاجر"), t("On the first page they open after signing in", "في أول صفحة يفتحونها بعد تسجيل الدخول")],
              ] as const).map(([v, l, sub]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${form.placement === v ? "bg-primary/10 ring-primary" : "ring-fg/15"}`}>
                  <input type="radio" name="pplace" className="mt-1" checked={form.placement === v} onChange={() => set("placement", v)} />
                  <span>
                    <span className="block">{l}</span>
                    <span className="block text-xs text-muted">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <AudiencePicker name="pwho" value={form.audience} onChange={(v) => set("audience", v)} />

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
          <p className="-mt-2 text-xs text-muted">{t("A store sees one pop-up at a time: the highest priority first, then the newest. The next one waits for its next page.", "يرى المتجر نافذة واحدة في كل مرة: الأعلى أولوية أولًا، ثم الأحدث. التالية تنتظر الصفحة التالية.")}</p>

          {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : form.id ? t("Save changes", "حفظ التعديلات") : t("Save as draft", "حفظ كمسودة")}</Btn>
            <Btn kind="ghost" type="button" onClick={() => setForm(null)}>{t("Cancel", "إلغاء")}</Btn>
          </div>
        </div>

        {/* where and how merchants will see it, in their dashboard */}
        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <PreviewPanel
            look={look}
            setLook={setLook}
            caption={home
              ? t("Over their home page, a moment after it opens. Each store sees it once.", "فوق صفحتهم الرئيسية، بعد لحظة من فتحها. يراها كل متجر مرة واحدة.")
              : t("Over the first merchant page they open (here: Orders), a moment after it opens. Each store sees it once.", "فوق أول صفحة يفتحونها في لوحة التحكم (هنا: الطلبات)، بعد لحظة من فتحها. يراها كل متجر مرة واحدة.")}
          >
            <div className={look.phone ? "mx-auto max-w-[17rem]" : ""}>
              <MockDashboard
                {...look}
                active={home ? "home" : "orders"}
                tab={home ? content[look.lang].home.summaryTab : menuEntries(look.lang)[1].label}
                bell={{ unread: 0, items: null }}
                overlay={<div className="flex w-full justify-center"><PopupTemplate template={form.template} slots={shownSlots} lang={look.lang} act={() => {}} /></div>}
              >
                {home ? <HomeSketch {...look} /> : <PageSketch {...look} title={menuEntries(look.lang)[1].label} />}
              </MockDashboard>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </form>
  );
}
