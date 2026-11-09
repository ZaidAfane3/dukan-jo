"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Lang } from "@/components/content";
import { Badge, Btn, card, field, area, Loaded, PageHead, send, useApi, useFmt, useT } from "@/components/diwan/ui";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { usePrefs } from "@/components/Prefs";
import { Footer } from "@/components/Sections";
import {
  FEATURE_KINDS,
  INDUSTRY_ICONS,
  SITE_LIMITS as M,
  SOCIAL_KINDS,
  SOCIAL_NAMES,
  type Bi,
  type SiteContent,
  type SiteSection,
} from "@/components/siteContent";
import { SiteContentProvider } from "@/components/useSiteContent";

/* Website (Diwan > Marketing): the words, links and pictures of Dukkan's landing page, so the team changes them without a
   code change. Everything is one draft, saved together with one Save; each card can go back to the page's original texts
   on its own. The preview draws the draft with the landing page's own components, in either language. The server checks
   every field again (components/siteContent.ts) and names the ones it could not use. */

type Data = { content: SiteContent; defaults: SiteContent; saved: boolean; updatedAt: string | null; by: string | null };
type P = (string | number)[];

export default function WebsitePage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/website");
  return (
    <div>
      <PageHead
        eyebrow={t("Marketing", "التسويق")}
        title={t("Website", "الموقع")}
        sub={t(
          "The words, links and pictures of Dukkan's landing page. Changes show on the page as soon as they are saved.",
          "نصوص صفحة دكّان الرئيسية وروابطها وصورها. تظهر التغييرات على الصفحة فور حفظها.",
        )}
      />
      <Loaded s={s}>{(d) => <Editor data={d} />}</Loaded>
    </div>
  );
}

/* ---------------- reading and changing the draft by path ---------------- */

const getAt = (o: unknown, p: P): unknown => p.reduce<unknown>((x, k) => (x == null ? undefined : (x as Record<string | number, unknown>)[k]), o);

/* a copy of `o` with the value at `p` replaced; only the objects along the path are copied */
function setAt<T>(o: T, p: P, v: unknown): T {
  if (!p.length) return v as T;
  const [k, ...rest] = p;
  const copy = (Array.isArray(o) ? [...o] : { ...(o as object) }) as Record<string | number, unknown>;
  copy[k] = setAt(copy[k], rest, v);
  return copy as T;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pathKey = (p: P) => p.join(".");

type Ctx = { draft: SiteContent; set: (p: P, v: unknown) => void; bad: Set<string> };
const Ed = createContext<Ctx | null>(null);
const useEd = () => useContext(Ed) as Ctx;

/* ---------------- the editor ---------------- */

type CardDef = { id: string; keys: SiteSection[]; title: [string, string]; sub: [string, string]; body: () => React.ReactNode };

function Editor({ data }: { data: Data }) {
  const t = useT();
  const f = useFmt();
  const [saved, setSaved] = useState(data.content);
  const [draft, setDraft] = useState(data.content);
  const [info, setInfo] = useState({ updatedAt: data.updatedAt, by: data.by, saved: data.saved });
  const [state, setState] = useState<"idle" | "busy" | "saved" | "bad" | "error">("idle");
  const [bad, setBad] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["hero"]));
  const defaults = data.defaults;
  const dirty = !same(draft, saved);

  const set = useCallback((p: P, v: unknown) => setDraft((d) => setAt(d, p, v)), []);
  const badSet = useMemo(() => new Set(bad), [bad]);
  const ctx = useMemo(() => ({ draft, set, bad: badSet }), [draft, set, badSet]);

  /* leaving the page with changes not saved asks first */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setState("busy");
    const r = await send("/api/diwan/website", "PUT", { content: draft });
    if (r.ok) {
      setSaved(r.data.content);
      setDraft(r.data.content);
      setBad([]);
      setInfo({ updatedAt: new Date().toISOString(), by: null, saved: true });
      setState("saved");
      setTimeout(() => setState((x) => (x === "saved" ? "idle" : x)), 2500);
    } else if (r.status === 400 && Array.isArray(r.data?.fields)) {
      const fields = r.data.fields as string[];
      setBad(fields);
      /* open every card that has a field to fix */
      setOpen((o) => new Set([...Array.from(o), ...cards.filter((c) => c.keys.some((k) => fields.some((x) => x === k || x.startsWith(`${k}.`)))).map((c) => c.id)]));
      setState("bad");
    } else setState("error");
  };

  const resetAll = async () => {
    if (!window.confirm(t("Put every part of the landing page back to its original texts? This is saved at once.", "إرجاع كل أجزاء الصفحة الرئيسية إلى نصوصها الأصلية؟ يُحفظ هذا فورًا."))) return;
    setState("busy");
    const r = await send("/api/diwan/website", "DELETE");
    if (r.ok) {
      setSaved(r.data.content);
      setDraft(r.data.content);
      setBad([]);
      setInfo({ updatedAt: null, by: null, saved: false });
      setState("saved");
    } else setState("error");
  };

  const cards: CardDef[] = [
    { id: "hero", keys: ["hero", "nav"], title: ["Hero and top bar", "الواجهة والشريط العلوي"], sub: ["The headline, the buttons under it and the links at the top of the page.", "العنوان الرئيسي والأزرار تحته والروابط أعلى الصفحة."], body: () => <HeroCard /> },
    { id: "industries", keys: ["industries"], title: ["Industries", "القطاعات"], sub: ["The row of industries; one can open a card with pictures of a store like it.", "صف القطاعات؛ ويمكن لأي قطاع أن يفتح بطاقة فيها صور متجر مثله."], body: () => <IndustriesCard /> },
    { id: "experience", keys: ["experience"], title: ["Buying experience", "تجربة الشراء"], sub: ["The three small pictures of a customer logging in, paying and following an order.", "الصور الثلاث الصغيرة لعميل يسجّل دخوله ويدفع ويتابع طلبه."], body: () => <ExperienceCard /> },
    { id: "features", keys: ["features"], title: ["Features", "المزايا"], sub: ["The rows that say what Dukkan does, each with its own picture.", "الصفوف التي تشرح ما يقدّمه دكّان، ولكل صف صورته."], body: () => <FeaturesCard /> },
    { id: "testimonials", keys: ["testimonials"], title: ["Testimonials", "آراء التجّار"], sub: ["What merchants say, in cards that slide.", "ما يقوله التجّار، في بطاقات تنزلق."], body: () => <TestimonialsCard /> },
    { id: "finalCta", keys: ["finalCta"], title: ["Final call to action", "الدعوة الأخيرة"], sub: ["The dark banner at the end of the page.", "الشريط الداكن في آخر الصفحة."], body: () => <FinalCtaCard /> },
    { id: "footer", keys: ["footer"], title: ["Footer and links", "التذييل والروابط"], sub: ["The columns of links, the payment logos and the line at the very bottom.", "أعمدة الروابط وشعارات الدفع والسطر في أسفل الصفحة."], body: () => <FooterCard /> },
    { id: "contact", keys: ["contact", "legal"], title: ["Contact and legal", "التواصل والبيانات القانونية"], sub: ["How to reach Dukkan, and the commercial registration shown to build trust.", "طرق التواصل مع دكّان، والسجل التجاري المعروض لبناء الثقة."], body: () => <ContactCard /> },
    { id: "social", keys: ["social"], title: ["Social links", "روابط التواصل الاجتماعي"], sub: ["The icons at the top of the footer. An icon with no address is hidden.", "الأيقونات أعلى التذييل. الأيقونة بلا عنوان لا تظهر."], body: () => <SocialCard /> },
    { id: "seo", keys: ["seo"], title: ["Search engines", "محركات البحث"], sub: ["The landing page's title in the browser tab and its description in search results.", "عنوان الصفحة الرئيسية في تبويب المتصفح ووصفها في نتائج البحث."], body: () => <SeoCard /> },
  ];

  const pick = (from: SiteContent, keys: SiteSection[]) => Object.fromEntries(keys.map((k) => [k, from[k]])) as Partial<SiteContent>;
  const toggle = (id: string) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const knownBad = bad.filter((b) => cards.some((c) => c.keys.some((k) => b === k || b.startsWith(`${k}.`))));

  return (
    <Ed.Provider value={ctx}>
      {/* the save bar stays on screen while scrolling, so the state of the draft is always in view */}
      <div className={`${card} sticky top-16 z-20 mb-6 flex flex-wrap items-center gap-3 py-3`}>
        {dirty ? <Badge tone="amber">{t("Unsaved changes", "تغييرات غير محفوظة")}</Badge> : <Badge tone="green">{t("All changes saved", "كل التغييرات محفوظة")}</Badge>}
        <span className="text-xs text-muted">
          {info.saved && info.updatedAt
            ? t(`Changed ${f.dateTime(info.updatedAt)}${info.by ? ` by ${info.by}` : ""}`, `عُدّل ${f.dateTime(info.updatedAt)}${info.by ? ` بواسطة ${info.by}` : ""}`)
            : t("Never changed: the original texts", "لم يُعدّل: النصوص الأصلية")}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {state === "saved" && <span className="text-sm text-emerald-600 dark:text-emerald-400">{t("Saved", "تم الحفظ")}</span>}
          {state === "bad" && <span className="text-sm text-red-600">{t(`Not saved: ${bad.length} field(s) to fix, marked in red.`, `لم يُحفظ: ${bad.length} حقل بحاجة إلى تصحيح، معلَّمة بالأحمر.`)}</span>}
          {state === "error" && <span className="text-sm text-red-600">{t("Not saved: try again.", "لم يُحفظ: حاول مرة أخرى.")}</span>}
          <Btn kind="ghost" onClick={() => { setDraft(saved); setBad([]); setState("idle"); }} disabled={!dirty || state === "busy"}>{t("Undo changes", "تراجع عن التغييرات")}</Btn>
          <Btn onClick={save} disabled={!dirty || state === "busy"}>{state === "busy" ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</Btn>
        </div>
      </div>
      {state === "bad" && knownBad.length < bad.length && (
        <p className={`${card} mb-6 text-sm text-red-600`} dir="ltr">{bad.filter((b) => !knownBad.includes(b)).join(", ")}</p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="space-y-4">
          {cards.map((c) => {
            const isOpen = open.has(c.id);
            const changedHere = !same(pick(draft, c.keys), pick(saved, c.keys));
            const original = same(pick(draft, c.keys), pick(defaults, c.keys));
            const hasBad = bad.some((b) => c.keys.some((k) => b === k || b.startsWith(`${k}.`)));
            return (
              <section key={c.id} className={`${card} p-0`}>
                <button type="button" onClick={() => toggle(c.id)} aria-expanded={isOpen} aria-controls={`web-${c.id}`} className="flex w-full items-start gap-3 rounded-xl p-5 text-start transition-colors hover:bg-fg/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <svg viewBox="0 0 24 24" className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90 rtl:-rotate-90" : "rtl:rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold">{t(...c.title)}</span>
                    <span className="mt-0.5 block text-sm text-muted">{t(...c.sub)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {hasBad && <Badge tone="red">{t("To fix", "بحاجة إلى تصحيح")}</Badge>}
                    {changedHere && <Badge tone="amber">{t("Not saved", "غير محفوظ")}</Badge>}
                    {original ? <Badge>{t("Original", "الأصلي")}</Badge> : <Badge tone="primary">{t("Edited", "معدَّل")}</Badge>}
                  </span>
                </button>
                {isOpen && (
                  <div id={`web-${c.id}`} className="space-y-5 border-t border-fg/[0.08] p-5">
                    {c.body()}
                    <div className="flex justify-end border-t border-fg/[0.08] pt-4">
                      <button type="button" disabled={original} onClick={() => setDraft((d) => ({ ...d, ...pick(defaults, c.keys) }))} className="text-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
                        {t("Reset this section to the original", "إرجاع هذا القسم إلى الأصل")}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
          <div className="flex justify-end pt-2">
            <Btn kind="ghost" onClick={resetAll} disabled={state === "busy" || (!info.saved && !dirty)}>{t("Reset the whole page to the original", "إرجاع الصفحة كلها إلى الأصل")}</Btn>
          </div>
        </div>
        <div className="xl:sticky xl:top-36">
          <Preview draft={draft} />
        </div>
      </div>
    </Ed.Provider>
  );
}

/* ---------------- the preview ---------------- */

/* Draws a part of the landing page at a desktop width and shrinks it to fit, so it looks as it will on the page. It can't
   be clicked: it is only to look at. */
function Scaled({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const WIDTH = 1280;
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.35, h: 0 });
  useEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    i.setAttribute("inert", "");
    const fit = () => setSize({ scale: b.clientWidth / WIDTH, h: i.offsetHeight });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    /* the frame is always left to right so the shrunk page sits at its left corner; the page inside has its own direction */
    <div ref={box} dir="ltr" className="relative overflow-hidden rounded-lg bg-page ring-1 ring-fg/10" style={{ height: size.h * size.scale || 200 }}>
      <div ref={inner} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} aria-hidden className="pointer-events-none absolute left-0 top-0 select-none bg-page text-fg" style={{ width: WIDTH, transform: `scale(${size.scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

function Preview({ draft }: { draft: SiteContent }) {
  const t = useT();
  const { lang: uiLang } = usePrefs();
  const [lang, setLang] = useState<Lang>(uiLang);
  const [part, setPart] = useState<"hero" | "footer">("hero");
  const tab = (on: boolean) => `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-primary text-white dark:text-page" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`;
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-base font-bold">{t("Preview", "معاينة")}</h2>
        <div role="group" aria-label={t("Part of the page", "جزء الصفحة")} className="flex gap-1 rounded-lg bg-fg/[0.04] p-1">
          <button type="button" aria-pressed={part === "hero"} onClick={() => setPart("hero")} className={tab(part === "hero")}>{t("Hero", "الواجهة")}</button>
          <button type="button" aria-pressed={part === "footer"} onClick={() => setPart("footer")} className={tab(part === "footer")}>{t("Footer", "التذييل")}</button>
        </div>
        <div role="group" aria-label={t("Language", "اللغة")} className="flex gap-1 rounded-lg bg-fg/[0.04] p-1">
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} className={tab(lang === "en")}>English</button>
          <button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")} className={tab(lang === "ar")}>العربية</button>
        </div>
      </div>
      <SiteContentProvider content={draft} lang={lang}>
        {/* a new key per part and language, so the page's opening animations play again for what is shown */}
        <Scaled key={`${part}-${lang}`} lang={lang}>
          {part === "hero" ? (
            <>
              <Nav />
              <Hero />
            </>
          ) : (
            <Footer />
          )}
        </Scaled>
      </SiteContentProvider>
      <p className="mt-2 text-xs text-muted">{t("Shows what is typed now, before it is saved.", "يعرض ما كُتب الآن، قبل حفظه.")}</p>
    </section>
  );
}

/* ---------------- fields ---------------- */

const lbl = "mb-1 block text-sm font-medium";
const small = "mb-1 block text-xs text-muted";
const wrongCls = "border-red-500 ring-2 ring-red-500/25";

function Text({ path, label, max = M.line, dir, placeholder, multiline, rows = 3, sub }: { path: P; label: string; max?: number; dir?: "ltr" | "rtl"; placeholder?: string; multiline?: boolean; rows?: number; sub?: boolean }) {
  const t = useT();
  const { draft, set, bad } = useEd();
  const id = useId();
  const v = getAt(draft, path);
  const wrong = bad.has(pathKey(path));
  const common = { id, dir, maxLength: max, placeholder, value: typeof v === "string" ? v : "", "aria-invalid": wrong || undefined };
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={sub ? small : lbl}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={rows} className={`${area} ${wrong ? wrongCls : ""}`} onChange={(e) => set(path, e.target.value)} />
      ) : (
        <input {...common} className={`${field} ${wrong ? wrongCls : ""}`} onChange={(e) => set(path, e.target.value)} />
      )}
      {wrong && <p className="mt-1 text-xs text-red-600">{t("Check this field.", "تحقق من هذا الحقل.")}</p>}
    </div>
  );
}

/** One text in both languages, side by side: English | العربية */
function Two({ path, label, max = M.line, multiline, rows, hint }: { path: P; label: string; max?: number; multiline?: boolean; rows?: number; hint?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className={lbl}>{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Text sub path={[...path, "en"]} label="English" dir="ltr" max={max} multiline={multiline} rows={rows} />
        <Text sub path={[...path, "ar"]} label="العربية" dir="rtl" max={max} multiline={multiline} rows={rows} />
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}

function useHrefHint() {
  const t = useT();
  return t(
    "Empty hides it. A page of this site (/signup), a place on the page (#industries), a web address (https://…), mailto: or tel:.",
    "اتركه فارغًا لإخفائه. صفحة من الموقع (‎/signup‎)، أو مكان في الصفحة (‎#industries‎)، أو عنوان ويب (‎https://…‎)، أو mailto: أو tel:.",
  );
}

/** A link: its words in both languages and where it goes */
function LinkFields({ path, label }: { path: P; label: string }) {
  const t = useT();
  const hint = useHrefHint();
  return (
    <div className="space-y-2">
      <Two path={[...path, "label"]} label={label} />
      <Text path={[...path, "href"]} label={t("Goes to", "يذهب إلى")} dir="ltr" max={M.href} placeholder="/signup" sub />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function Select({ path, label, options }: { path: P; label: string; options: { value: string; en: string; ar: string }[] }) {
  const t = useT();
  const { draft, set, bad } = useEd();
  const id = useId();
  const wrong = bad.has(pathKey(path));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={lbl}>{label}</label>
      <select id={id} className={`${field} ${wrong ? wrongCls : ""}`} value={String(getAt(draft, path) ?? "")} onChange={(e) => set(path, e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{t(o.en, o.ar)}</option>)}
      </select>
    </div>
  );
}

function Num({ path, label, min, max }: { path: P; label: string; min: number; max: number }) {
  const { draft, set, bad } = useEd();
  const id = useId();
  const wrong = bad.has(pathKey(path));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={lbl}>{label}</label>
      <input id={id} type="number" min={min} max={max} step={1} className={`${field} max-w-[8rem] ${wrong ? wrongCls : ""}`} value={Number(getAt(draft, path) ?? 0)} onChange={(e) => set(path, Math.round(Number(e.target.value)))} />
    </div>
  );
}

function Check({ path, label }: { path: P; label: string }) {
  const { draft, set } = useEd();
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={getAt(draft, path) === true} onChange={(e) => set(path, e.target.checked)} />
      {label}
    </label>
  );
}

/** A picture's address, with a small look at it */
function Picture({ path, label }: { path: P; label: string }) {
  const t = useT();
  const { draft } = useEd();
  const v = getAt(draft, path);
  const src = typeof v === "string" && (/^\/(?![/\\])/.test(v) || v.startsWith("https://")) ? v : "";
  return (
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <Text path={path} label={label} dir="ltr" max={M.href} placeholder="/themes/lamma.jpg" />
      </div>
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-fg/[0.05] ring-1 ring-fg/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted">{t("none", "لا شيء")}</span>}
      </span>
    </div>
  );
}

/* a small square button (move up, move down, remove) */
function Mini({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`grid h-8 w-8 place-items-center rounded-lg text-sm ring-1 ring-fg/15 transition-colors hover:bg-fg/[0.05] disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "text-red-600" : ""}`}>
      {children}
    </button>
  );
}

const arrowUp = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 15 6-6 6 6" /></svg>;
const arrowDown = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>;
const cross = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** A list staff can add to, take from and put in order. Items of a few fields fold, so a long list stays short to read;
    `compact` items (one text each) stay open on one row. */
function List<T>({ path, max, blank, addLabel, title, compact, children }: { path: P; max: number; blank: () => T; addLabel: string; title?: (item: T, i: number) => string; compact?: boolean; children: (p: P, i: number) => React.ReactNode }) {
  const t = useT();
  const { lang } = usePrefs();
  const { draft, set, bad } = useEd();
  const items = (getAt(draft, path) as T[] | undefined) ?? [];
  const [open, setOpen] = useState<boolean[]>([]);
  const move = (i: number, d: number) => {
    const j = i + d;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    set(path, a);
    setOpen((o) => {
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const remove = (i: number) => {
    set(path, items.filter((_, k) => k !== i));
    setOpen((o) => o.filter((_, k) => k !== i));
  };
  const listBad = bad.has(pathKey(path));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const here = pathKey([...path, i]);
        const hasBad = Array.from(bad).some((b) => b === here || b.startsWith(`${here}.`));
        const isOpen = compact || open[i] || hasBad;
        const buttons = (
          <div className="flex shrink-0 gap-1">
            <Mini label={t("Move up", "تحريك للأعلى")} onClick={() => move(i, -1)} disabled={i === 0}>{arrowUp}</Mini>
            <Mini label={t("Move down", "تحريك للأسفل")} onClick={() => move(i, 1)} disabled={i === items.length - 1}>{arrowDown}</Mini>
            <Mini label={t("Remove", "حذف")} onClick={() => remove(i)} danger>{cross}</Mini>
          </div>
        );
        if (compact)
          return (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">{children([...path, i], i)}</div>
              {buttons}
            </div>
          );
        const name = title?.(it, i) || t("(no name yet)", "(بلا اسم بعد)");
        return (
          <div key={i} className={`rounded-xl ring-1 ${hasBad ? "ring-red-500/60" : "ring-fg/10"}`}>
            <div className="flex items-center gap-2 p-2 ps-3">
              <button type="button" aria-expanded={!!isOpen} onClick={() => setOpen((o) => { const n = [...o]; n[i] = !n[i]; return n; })} className="flex min-w-0 flex-1 items-center gap-2 text-start text-sm font-semibold">
                <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90 rtl:-rotate-90" : "rtl:rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                <span className="text-muted tabular-nums">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG-u-nu-latn" : "en")}.</span>
                <span className="truncate">{name}</span>
              </button>
              {buttons}
            </div>
            {isOpen && <div className="space-y-4 border-t border-fg/[0.08] p-4">{children([...path, i], i)}</div>}
          </div>
        );
      })}
      {items.length === 0 && <p className="text-sm text-muted">{t("Nothing here yet; this part of the page is hidden.", "لا شيء هنا بعد؛ هذا الجزء من الصفحة مخفي.")}</p>}
      {listBad && <p className="text-xs text-red-600">{t(`At most ${max}.`, `${max} كحد أقصى.`)}</p>}
      {items.length < max ? (
        <button
          type="button"
          onClick={() => {
            set(path, [...items, blank()]);
            setOpen((o) => { const n = [...o]; n[items.length] = true; return n; });
          }}
          className="text-sm font-semibold text-primary hover:underline"
        >
          + {addLabel}
        </button>
      ) : (
        <p className="text-xs text-muted">{t(`That is the most this list can hold (${max}).`, `هذا أقصى ما تتسع له القائمة (${max}).`)}</p>
      )}
    </div>
  );
}

const B = (): Bi => ({ en: "", ar: "" });
const L = () => ({ label: B(), href: "" });
/* the name of an item for its folded row, in the language Diwan is shown in */
function useName() {
  const { lang } = usePrefs();
  return (b: Bi | undefined) => (b ? b[lang] || b[lang === "ar" ? "en" : "ar"] : "");
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-muted [font-variant-caps:all-small-caps] tracking-[0.05em]">{title}</h3>
      {children}
    </div>
  );
}

/* ---------------- the cards ---------------- */

function HeroCard() {
  const t = useT();
  const name = useName();
  return (
    <>
      <Group title={t("Headline", "العنوان الرئيسي")}>
        <Two path={["hero", "before"]} label={t("Before the highlighted words", "ما قبل الكلمات المميزة")} />
        <Two path={["hero", "highlight"]} label={t("Highlighted words (in the brand color)", "الكلمات المميزة (بلون العلامة)")} />
        <Two path={["hero", "after"]} label={t("After the highlighted words", "ما بعد الكلمات المميزة")} />
        <Two path={["hero", "sub"]} label={t("Line under the headline", "السطر تحت العنوان")} max={M.text} multiline />
        <LinkFields path={["hero", "cta1"]} label={t("Main button", "الزر الرئيسي")} />
        <LinkFields path={["hero", "cta2"]} label={t("Second button", "الزر الثاني")} />
        <Two path={["hero", "note"]} label={t("Small line under the buttons (optional)", "سطر صغير تحت الأزرار (اختياري)")} />
      </Group>
      <Group title={t("Top bar", "الشريط العلوي")}>
        <List path={["nav", "links"]} max={M.navLinks} blank={L} addLabel={t("Add a link", "إضافة رابط")} title={(l) => name(l.label)}>
          {(p) => <LinkFields path={p} label={t("Link", "الرابط")} />}
        </List>
        <Two path={["nav", "resources"]} label={t("Name of the Resources menu", "اسم قائمة الموارد")} />
        <List path={["nav", "resourceLinks"]} max={M.resourceLinks} blank={L} addLabel={t("Add a link to the menu", "إضافة رابط إلى القائمة")} title={(l) => name(l.label)}>
          {(p) => <LinkFields path={p} label={t("Link in the menu", "رابط في القائمة")} />}
        </List>
        <LinkFields path={["nav", "login"]} label={t("Log in button", "زر تسجيل الدخول")} />
        <LinkFields path={["nav", "start"]} label={t("Start button (also under each feature and industry card)", "زر البدء (يظهر أيضًا تحت كل ميزة وبطاقة قطاع)")} />
      </Group>
    </>
  );
}

const ICON_NAMES: Record<(typeof INDUSTRY_ICONS)[number], [string, string]> = {
  fashion: ["Hoodie", "هودي"],
  perfume: ["Perfume bottle", "زجاجة عطر"],
  jewelry: ["Gem", "جوهرة"],
  digital: ["Game controller", "يد ألعاب"],
  electronics: ["Screen", "شاشة"],
  beauty: ["Sparkles", "لمعة"],
  home: ["Sofa", "كنبة"],
  store: ["Store front", "واجهة متجر"],
};

function IndustriesCard() {
  const t = useT();
  const name = useName();
  const { draft, set } = useEd();
  return (
    <>
      <Two path={["industries", "title"]} label={t("Title", "العنوان")} max={M.title} />
      <Two path={["industries", "finale"]} label={t("Line shown when all industries line up", "السطر الذي يظهر حين تصطف كل القطاعات")} max={M.title} />
      <List
        path={["industries", "items"]}
        max={M.industries}
        blank={() => ({ icon: "store" as const, name: B(), blurb: B(), detail: null })}
        addLabel={t("Add an industry", "إضافة قطاع")}
        title={(x: SiteContent["industries"]["items"][number]) => name(x.name)}
      >
        {(p) => {
          const detail = getAt(draft, [...p, "detail"]);
          return (
            <>
              <Select path={[...p, "icon"]} label={t("Icon", "الأيقونة")} options={INDUSTRY_ICONS.map((k) => ({ value: k, en: ICON_NAMES[k][0], ar: ICON_NAMES[k][1] }))} />
              <Two path={[...p, "name"]} label={t("Name", "الاسم")} max={40} />
              <Two path={[...p, "blurb"]} label={t("One line about it (shown when it has no card)", "سطر عنه (يظهر إن لم تكن له بطاقة)")} max={M.title} />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={!!detail}
                  onChange={(e) => set([...p, "detail"], e.target.checked ? { title: B(), body: B(), bullets: [], shots: [], stores: [] } : null)}
                />
                {t("Opens a card with pictures of a store like it", "يفتح بطاقة فيها صور متجر مثله")}
              </label>
              {!!detail && (
                <div className="space-y-4 rounded-xl bg-fg/[0.03] p-4">
                  <Two path={[...p, "detail", "title"]} label={t("Card title", "عنوان البطاقة")} max={M.title} />
                  <Two path={[...p, "detail", "body"]} label={t("Card text", "نص البطاقة")} max={M.text} multiline />
                  <List compact path={[...p, "detail", "bullets"]} max={M.bullets} blank={B} addLabel={t("Add a point", "إضافة نقطة")}>
                    {(q, j) => <Two path={q} label={t(`Point ${j + 1}`, `النقطة ${j + 1}`)} />}
                  </List>
                  <p className="text-sm font-medium">{t("Pictures of the store (a long picture of its page that scrolls by itself)", "صور المتجر (صورة طويلة لصفحته تتحرك وحدها)")}</p>
                  <List path={[...p, "detail", "shots"]} max={M.shots} blank={() => ({ src: "", y: 0 })} addLabel={t("Add a picture", "إضافة صورة")} title={(s: { src: string }) => s.src}>
                    {(q) => (
                      <>
                        <Picture path={[...q, "src"]} label={t("Picture", "الصورة")} />
                        <Num path={[...q, "y"]} label={t("Start how far down (percent)", "يبدأ من أي عمق (نسبة مئوية)")} min={0} max={100} />
                      </>
                    )}
                  </List>
                  <p className="text-sm font-medium">{t("Or several stores taking turns in one window (used in place of the pictures)", "أو عدة متاجر تتناوب في نافذة واحدة (بدل الصور)")}</p>
                  <List path={[...p, "detail", "stores"]} max={M.stores} blank={() => ({ src: "", address: "dukkan.store/your-store", view: "" })} addLabel={t("Add a store", "إضافة متجر")} title={(s: { src: string }) => s.src}>
                    {(q) => (
                      <>
                        <Picture path={[...q, "src"]} label={t("Picture of its page", "صورة صفحته")} />
                        <Text path={[...q, "address"]} label={t("Address shown in the window", "العنوان الظاهر في النافذة")} dir="ltr" max={60} />
                        <Text path={[...q, "view"]} label={t("Opens (the eye button)", "يفتح (زر العين)")} dir="ltr" max={M.href} placeholder="/store?theme=mada" />
                      </>
                    )}
                  </List>
                </div>
              )}
            </>
          );
        }}
      </List>
    </>
  );
}

function ExperienceCard() {
  const t = useT();
  const n = (i: number) => i + 1;
  return (
    <>
      <Two path={["experience", "title"]} label={t("Title", "العنوان")} max={M.title} />
      {[0, 1, 2].map((i) => <Two key={i} path={["experience", "captions", i]} label={t(`Caption under picture ${n(i)}`, `التعليق تحت الصورة ${n(i)}`)} />)}
      <Group title={t("Picture 1: logging in", "الصورة 1: تسجيل الدخول")}>
        <Two path={["experience", "login", "brand"]} label={t("Store name", "اسم المتجر")} max={40} />
        <Two path={["experience", "login", "title"]} label={t("Title", "العنوان")} max={40} />
        <Two path={["experience", "login", "label"]} label={t("Field name", "اسم الحقل")} max={40} />
        <Two path={["experience", "login", "button"]} label={t("Button", "الزر")} max={40} />
        <Two path={["experience", "login", "link"]} label={t("Link under the button", "الرابط تحت الزر")} max={60} />
      </Group>
      <Group title={t("Picture 2: paying", "الصورة 2: الدفع")}>
        <Two path={["experience", "pay", "title"]} label={t("Title", "العنوان")} max={60} />
        {[0, 1, 2, 3].map((i) => <Two key={i} path={["experience", "pay", "options", i]} label={t(`Payment method ${n(i)} (its logo stays)`, `طريقة الدفع ${n(i)} (يبقى شعارها)`)} />)}
        <Two path={["experience", "pay", "button"]} label={t("Button", "الزر")} max={40} />
      </Group>
      <Group title={t("Picture 3: following the order", "الصورة 3: متابعة الطلب")}>
        <Two path={["experience", "track", "title"]} label={t("Title", "العنوان")} max={60} />
        <Two path={["experience", "track", "order"]} label={t("Order number line", "سطر رقم الطلب")} max={40} />
        {[0, 1, 2, 3].map((i) => <Two key={i} path={["experience", "track", "steps", i]} label={t(`Step ${n(i)}`, `الخطوة ${n(i)}`)} />)}
      </Group>
    </>
  );
}

const KIND_NAMES: Record<(typeof FEATURE_KINDS)[number], [string, string]> = {
  solutions: ["Launch: a dashboard card", "الانطلاق: بطاقة لوحة تحكم"],
  design: ["Design: a store card", "التصميم: بطاقة متجر"],
  payments: ["Payments: the payments picture", "المدفوعات: صورة المدفوعات"],
  shipping: ["Shipping: the map of Jordan", "الشحن: خريطة الأردن"],
  marketing: ["Marketing: a campaign card", "التسويق: بطاقة حملة"],
};

function FeaturesCard() {
  const t = useT();
  const name = useName();
  return (
    <>
      <Two path={["features", "title"]} label={t("Title", "العنوان")} max={M.title} />
      <List
        path={["features", "items"]}
        max={M.features}
        blank={() => ({ kind: "solutions" as const, anchor: "", tag: B(), title: B(), body: B(), points: [] })}
        addLabel={t("Add a feature", "إضافة ميزة")}
        title={(x: SiteContent["features"]["items"][number]) => name(x.title)}
      >
        {(p) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select path={[...p, "kind"]} label={t("Picture and icons", "الصورة والأيقونات")} options={FEATURE_KINDS.map((k) => ({ value: k, en: KIND_NAMES[k][0], ar: KIND_NAMES[k][1] }))} />
              <div>
                <Text path={[...p, "anchor"]} label={t("Place name on the page (optional)", "اسم المكان في الصفحة (اختياري)")} dir="ltr" max={31} placeholder="design" />
                <p className="mt-1 text-xs text-muted">{t("Small letters and dashes. A link to #name leads here (the top bar's Themes link uses #design).", "حروف إنجليزية صغيرة وشرطات. الرابط ‎#name‎ يقود إلى هنا (رابط الثيمات في الشريط العلوي يستخدم ‎#design‎).")}</p>
              </div>
            </div>
            <Two path={[...p, "tag"]} label={t("Tag", "الوسم")} max={40} />
            <Two path={[...p, "title"]} label={t("Title", "العنوان")} max={M.title} />
            <Two path={[...p, "body"]} label={t("Text", "النص")} max={M.text} multiline />
            <List compact path={[...p, "points"]} max={M.points} blank={B} addLabel={t("Add a point", "إضافة نقطة")}>
              {(q, j) => <Two path={q} label={t(`Point ${j + 1}`, `النقطة ${j + 1}`)} />}
            </List>
          </>
        )}
      </List>
    </>
  );
}

function TestimonialsCard() {
  const t = useT();
  const name = useName();
  return (
    <>
      <Two path={["testimonials", "title"]} label={t("Title", "العنوان")} max={M.title} />
      <List
        path={["testimonials", "items"]}
        max={M.testimonials}
        blank={() => ({ quote: B(), name: B(), role: B(), avatar: "" })}
        addLabel={t("Add a testimonial", "إضافة رأي")}
        title={(x: SiteContent["testimonials"]["items"][number]) => name(x.name)}
      >
        {(p) => (
          <>
            <Two path={[...p, "quote"]} label={t("What they said", "ما قاله")} max={M.text} multiline />
            <Two path={[...p, "name"]} label={t("Name", "الاسم")} max={60} />
            <Two path={[...p, "role"]} label={t("Their store (optional)", "متجره (اختياري)")} max={60} />
            <Picture path={[...p, "avatar"]} label={t("Photo (optional; empty shows a store icon)", "الصورة (اختيارية؛ الفارغة تُظهر أيقونة متجر)")} />
          </>
        )}
      </List>
    </>
  );
}

function FinalCtaCard() {
  const t = useT();
  return (
    <>
      <Two path={["finalCta", "title"]} label={t("Title", "العنوان")} max={M.title} />
      <Two path={["finalCta", "body"]} label={t("Text (optional)", "النص (اختياري)")} max={M.text} multiline />
      <LinkFields path={["finalCta", "button"]} label={t("Button", "الزر")} />
    </>
  );
}

function FooterCard() {
  const t = useT();
  const name = useName();
  return (
    <>
      <Two path={["footer", "tagline"]} label={t("Line under the logo (optional)", "السطر تحت الشعار (اختياري)")} max={M.title} />
      <Group title={t("Columns of links", "أعمدة الروابط")}>
        <p className="text-sm text-muted">{t("A link with no address is hidden, and so is a column with no links left.", "الرابط بلا عنوان لا يظهر، وكذلك العمود الذي لم يبقَ فيه روابط.")}</p>
        <List
          path={["footer", "columns"]}
          max={M.columns}
          blank={() => ({ title: B(), links: [] })}
          addLabel={t("Add a column", "إضافة عمود")}
          title={(x: SiteContent["footer"]["columns"][number]) => name(x.title)}
        >
          {(p) => (
            <>
              <Two path={[...p, "title"]} label={t("Column title", "عنوان العمود")} max={60} />
              <List path={[...p, "links"]} max={M.columnLinks} blank={L} addLabel={t("Add a link", "إضافة رابط")} title={(l: { label: Bi }) => name(l.label)}>
                {(q) => <LinkFields path={q} label={t("Link", "الرابط")} />}
              </List>
            </>
          )}
        </List>
        <Two path={["footer", "industriesTitle"]} label={t("Title of the industries column (it lists the industries above)", "عنوان عمود القطاعات (يعرض القطاعات أعلاه)")} max={60} />
      </Group>
      <Group title={t("Payment logos", "شعارات الدفع")}>
        <List
          path={["footer", "payments"]}
          max={M.payments}
          blank={() => ({ name: "", src: "", height: 18, invertInDark: false })}
          addLabel={t("Add a logo", "إضافة شعار")}
          title={(x: { name: string }) => x.name}
        >
          {(p) => (
            <>
              <Text path={[...p, "name"]} label={t("Name (read aloud by screen readers)", "الاسم (تقرؤه قارئات الشاشة)")} dir="ltr" max={40} />
              <Picture path={[...p, "src"]} label={t("Logo picture", "صورة الشعار")} />
              <Num path={[...p, "height"]} label={t("Height (pixels)", "الارتفاع (بكسل)")} min={10} max={32} />
              <Check path={[...p, "invertInDark"]} label={t("Turn it white in dark mode (for a black logo)", "اجعله أبيض في الوضع الداكن (لشعار أسود)")} />
            </>
          )}
        </List>
      </Group>
      <Two path={["footer", "availableIn"]} label={t("“Available in” words", "عبارة «متاح في»")} max={60} />
      <Two path={["footer", "country"]} label={t("Country", "الدولة")} max={60} />
      <Two path={["footer", "legal"]} label={t("Bottom line (©)", "السطر الأخير (©)")} max={M.title} />
    </>
  );
}

function ContactCard() {
  const t = useT();
  const hint = useHrefHint();
  return (
    <>
      <Group title={t("Contact", "التواصل")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text path={["contact", "phone"]} label={t("Phone (empty hides it)", "الهاتف (الفارغ لا يظهر)")} dir="ltr" max={M.phone} placeholder="+962 6 000 0000" />
          <Text path={["contact", "email"]} label={t("Email (empty hides it)", "البريد الإلكتروني (الفارغ لا يظهر)")} dir="ltr" max={120} placeholder="hello@dukkan.store" />
          <Text path={["contact", "whatsapp"]} label={t("Support WhatsApp (empty hides it; shown to suspended stores)", "واتساب الدعم (الفارغ لا يظهر؛ يُعرض للمتاجر الموقوفة)")} dir="ltr" max={M.phone} placeholder="+962 7 9000 0000" />
        </div>
        <Two path={["contact", "place"]} label={t("City", "المدينة")} max={80} />
      </Group>
      <Group title={t("Commercial registration", "السجل التجاري")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text path={["legal", "number"]} label={t("Registration number", "رقم السجل")} dir="ltr" max={M.number} />
          <div>
            <Text path={["legal", "url"]} label={t("Where to check it", "رابط التحقق منه")} dir="ltr" max={M.href} placeholder="https://…" />
            <p className="mt-1 text-xs text-muted">{hint}</p>
          </div>
        </div>
        <Two path={["legal", "verified"]} label={t("Verified line", "سطر التوثيق")} max={80} />
        <Two path={["legal", "label"]} label={t("Name of the number", "اسم الرقم")} max={80} />
      </Group>
      <Group title={t("Reliability section", "قسم الموثوقية")}>
        <Two path={["legal", "tag"]} label={t("Tag", "الوسم")} max={40} />
        <Two path={["legal", "title"]} label={t("Title", "العنوان")} max={M.title} />
        <Two path={["legal", "sub"]} label={t("Text (optional)", "النص (اختياري)")} max={M.text} multiline />
        <Two path={["legal", "check"]} label={t("Button to check the registration", "زر التحقق من السجل")} max={60} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-xl bg-fg/[0.03] p-4">
            <Two path={["legal", "cards", i, "title"]} label={t(`Card ${i + 1}: title`, `البطاقة ${i + 1}: العنوان`)} max={80} />
            <Two path={["legal", "cards", i, "body"]} label={t(`Card ${i + 1}: text`, `البطاقة ${i + 1}: النص`)} max={M.text} multiline rows={2} />
            {i > 0 && <p className="text-xs text-muted">{i === 1 ? t("Shows the city under it.", "تظهر المدينة تحتها.") : t("Shows the phone and email under it.", "يظهر الهاتف والبريد تحتها.")}</p>}
          </div>
        ))}
      </Group>
    </>
  );
}

function SocialCard() {
  const t = useT();
  const { lang } = usePrefs();
  return (
    <List
      path={["social"]}
      max={M.social}
      blank={() => ({ kind: SOCIAL_KINDS[0], href: "" })}
      addLabel={t("Add a network", "إضافة شبكة")}
      title={(x: { kind: (typeof SOCIAL_KINDS)[number]; href: string }) => `${SOCIAL_NAMES[x.kind]?.[lang] ?? x.kind}${x.href ? "" : t(" (hidden: no address)", " (مخفية: بلا عنوان)")}`}
    >
      {(p) => (
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Select path={[...p, "kind"]} label={t("Network", "الشبكة")} options={SOCIAL_KINDS.map((k) => ({ value: k, en: SOCIAL_NAMES[k].en, ar: SOCIAL_NAMES[k].ar }))} />
          <Text path={[...p, "href"]} label={t("Address of Dukkan's page", "عنوان صفحة دكّان")} dir="ltr" max={M.href} placeholder="https://" />
        </div>
      )}
    </List>
  );
}

function SeoCard() {
  const t = useT();
  return (
    <>
      <Two path={["seo", "title"]} label={t("Title (browser tab and search results)", "العنوان (تبويب المتصفح ونتائج البحث)")} max={M.seoTitle} />
      <Two path={["seo", "description"]} label={t("Description (search results)", "الوصف (نتائج البحث)")} max={M.seoDescription} multiline />
    </>
  );
}
