"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { askConfirm } from "@/components/diwan/dialogs";
import { area, Badge, Btn, card, field, Loaded, PageHead, send, useApi, useFmt, useT, type Tone } from "@/components/diwan/ui";
import { ThemePreview } from "@/components/ThemePreview";
import { defaultConfig } from "@/components/storefront/config";
import { designFrom } from "@/components/storefront/storage";
import { defaultTheme, designTheme, madaTheme, themes, withListing, type ThemeInfo } from "@/components/themes";
import { LISTING_LIMITS, NEXT_STATUS, THEME_ID, themeIdOk, type Bi, type ListingRow, type ThemeStatus } from "@/components/themeListing";

/* The theme store, run by Dukkan's staff. Every theme merchants can buy is listed here (components/themeListing.ts):
   - Dukkan's code themes (Misk, Lamma): their look is in the code; here staff show or hide them, set the price, the order,
     "featured" and their words.
   - Themes made here: a copy of a design, changed in the store designer (/design?catalog=<id>), then sent through
     Draft → In review → Live. Live puts it in the merchants' theme store at once; Hidden takes it out (merchants who
     bought it keep it). Every change is in the activity log.
   The two free designs every store has (Dukkan, Mada) are shown last, with their numbers; they are not sold. */

type Nums = { stores: number; bought: number; revenue: number };
type Data = { themes: ListingRow[]; nums: Record<string, Nums> };
type Entry = { row: ListingRow; theme: ThemeInfo };

const noNums: Nums = { stores: 0, bought: 0, revenue: 0 };
const statusTone: Record<ThemeStatus, Tone> = { draft: "grey", review: "amber", live: "green", hidden: "red" };
const FREE = [defaultTheme, madaTheme];

function useWords() {
  const t = useT();
  return {
    status: (s: ThemeStatus) => ({ draft: t("Draft", "مسودة"), review: t("In review", "قيد المراجعة"), live: t("Live", "منشور"), hidden: t("Hidden", "مخفي") })[s],
    move: (from: ThemeStatus, to: ThemeStatus) =>
      to === "review" ? t("Send to review", "إرسال للمراجعة")
      : to === "live" ? (from === "hidden" ? t("Put back in the store", "إعادته إلى المتجر") : t("Release to the store", "نشره في المتجر"))
      : to === "hidden" ? t("Hide from the store", "إخفاؤه من المتجر")
      : t("Back to draft", "إعادته إلى مسودة"),
    ask: (to: ThemeStatus) =>
      to === "live" ? t("Merchants will see it in the theme store and can buy it right away.", "سيظهر للتجار في متجر الثيمات ويمكنهم شراؤه فورًا.")
      : to === "hidden" ? t("Merchants can no longer find or buy it. Those who bought it keep it.", "لن يجده التجار ولن يستطيعوا شراءه. من اشتراه يبقى معه.")
      : "",
    missing: (m: string) =>
      m === "name" ? t("It needs a name in English and Arabic first.", "يحتاج اسمًا بالعربية والإنجليزية أولًا.")
      : m === "tagline" ? t("It needs a short line about it in English and Arabic first (Details).", "يحتاج سطرًا قصيرًا عنه بالعربية والإنجليزية أولًا (التفاصيل).")
      : t("It needs a design first: open it in the designer and save.", "يحتاج تصميمًا أولًا: افتحه في المصمّم واحفظ."),
  };
}

/** A listing as a theme the pages can show: a code theme with Diwan's words over it, or a theme made here */
function entryOf(row: ListingRow): Entry | null {
  if (row.source === "design") return { row, theme: designTheme(row) };
  const code = themes.find((x) => x.id === row.id);
  return code ? { row, theme: withListing(code, row) } : null;
}

type Filter = "all" | "live" | "work" | "hidden";

export default function ThemesPage() {
  const t = useT();
  const s = useApi<Data>("/api/diwan/themes");
  const [openId, setOpenId] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <div>
      <PageHead
        title={t("Themes", "الثيمات")}
        sub={t("The theme store merchants buy from: what is in it, its order and prices, and new themes made here.", "متجر الثيمات الذي يشتري منه التجار: ما فيه، وترتيبه وأسعاره، وثيمات جديدة تُصنع هنا.")}
        actions={<Btn onClick={() => setMaking(true)}>{t("New theme", "ثيم جديد")}</Btn>}
      />
      <Steps />
      <Loaded s={s}>
        {(d) => {
          const all = d.themes.map(entryOf).filter((x): x is Entry => !!x);
          const count = (f: Filter) => all.filter((e) => inFilter(e.row.status, f)).length;
          const shown = all.filter((e) => inFilter(e.row.status, filter));
          const open = openId ? all.find((e) => e.row.id === openId) : null;
          const openFree = openId ? FREE.find((x) => x.id === openId) : null;
          return (
            <div className="space-y-10">
              <section>
                <div className="mb-3 flex flex-wrap gap-2" role="tablist">
                  {(["all", "live", "work", "hidden"] as Filter[]).map((f) => (
                    <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`h-9 rounded-full px-4 text-sm font-semibold transition ${filter === f ? "bg-ink text-onink" : "bg-card ring-1 ring-fg/10 hover:bg-soft"}`}>
                      {{ all: t("All", "الكل"), live: t("In the store", "في المتجر"), work: t("Being made", "قيد الإعداد"), hidden: t("Hidden", "مخفية") }[f]} <span className="tabular-nums opacity-70">{count(f)}</span>
                    </button>
                  ))}
                </div>
                {shown.length === 0 ? (
                  <p className={`${card} text-sm text-muted`}>{filter === "work" ? t("No theme is being made. Start one with New theme.", "لا يوجد ثيم قيد الإعداد. ابدأ واحدًا من «ثيم جديد».") : t("Nothing here.", "لا شيء هنا.")}</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((e) => <ThemeCard key={e.row.id} theme={e.theme} row={e.row} nums={d.nums[e.row.id] ?? noNums} onOpen={() => setOpenId(e.row.id)} />)}
                  </div>
                )}
              </section>
              <section>
                <h2 className="mb-1 text-lg font-bold">{t("Free designs every store has", "التصاميم المجانية لكل متجر")}</h2>
                <p className="mb-3 text-sm text-muted">{t("Not sold: every store has them. Their look is in Dukkan's code.", "لا تُباع: كل متجر يملكها. شكلها في كود دكّان.")}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {FREE.map((th) => <ThemeCard key={th.id} theme={th} nums={d.nums[th.id] ?? noNums} onOpen={() => setOpenId(th.id)} />)}
                </div>
              </section>
              {open && <ThemePanel entry={open} nums={d.nums[open.row.id] ?? noNums} reload={s.reload} onClose={() => setOpenId(null)} />}
              {openFree && <FreePanel theme={openFree} nums={d.nums[openFree.id] ?? noNums} onClose={() => setOpenId(null)} />}
              {making && (
                <NewTheme
                  from={all.map((e) => e.theme)}
                  taken={new Set(d.themes.map((r) => r.id))}
                  onClose={() => setMaking(false)}
                  onMade={(id) => {
                    setMaking(false);
                    setFilter("all");
                    s.reload();
                    setOpenId(id);
                  }}
                />
              )}
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}

const inFilter = (s: ThemeStatus, f: Filter) => f === "all" || (f === "live" ? s === "live" : f === "hidden" ? s === "hidden" : s === "draft" || s === "review");

/* The way a theme goes, so staff know what each step means */
function Steps() {
  const t = useT();
  const w = useWords();
  const steps: [ThemeStatus, string][] = [
    ["draft", t("Being made. Only staff see it.", "قيد الصنع. يراه الفريق فقط.")],
    ["review", t("Ready: someone checks it.", "جاهز: يراجعه أحد الفريق.")],
    ["live", t("In the theme store: merchants can buy it.", "في متجر الثيمات: يستطيع التجار شراءه.")],
    ["hidden", t("Out of the store. Buyers keep it.", "خارج المتجر. يبقى مع من اشتراه.")],
  ];
  return (
    <ol className="mb-6 grid gap-x-6 gap-y-3 border-y border-fg/10 py-4 sm:grid-cols-4">
      {steps.map(([s, text], i) => (
        <li key={s} className="text-sm">
          <p className="flex items-center gap-2 font-bold">
            {w.status(s)}
            {i < steps.length - 1 && <span aria-hidden className="text-muted/60 rtl:-scale-x-100">→</span>}
          </p>
          <p className="mt-0.5 text-muted">{text}</p>
        </li>
      ))}
    </ol>
  );
}

function ThemeCard({ theme: th, row, nums: n, onOpen }: { theme: ThemeInfo; row?: ListingRow; nums: Nums; onOpen: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useWords();
  return (
    <button type="button" onClick={onOpen} className={`${card} !p-3 text-start transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
      <div className="pointer-events-none">
        <ThemePreview theme={th} height={200} sample />
      </div>
      <div className="px-2 pb-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-bold">{t(th.name.en, th.name.ar)}</p>
          <PriceBadge price={th.price} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {row ? <Badge tone={statusTone[row.status]}>{w.status(row.status)}</Badge> : <Badge tone="grey">{t("Free for every store", "مجاني لكل متجر")}</Badge>}
          {row?.featured && <Badge tone="amber">★ {t("Featured", "مميّز")}</Badge>}
          {row?.source === "design" && <Badge tone="blue">{t("Made in Diwan", "صُنع في الديوان")}</Badge>}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted">{t(th.tagline.en, th.tagline.ar) || "—"}</p>
        <p className="mt-2 text-xs text-muted">
          {t(`${f.num(n.stores)} stores use it`, `يستخدمه ${f.num(n.stores)} متجر`)}
          {row && ` · ${t(`${f.num(n.bought)} bought`, `اشتراه ${f.num(n.bought)}`)}`}
          {row && ` · ${t("place", "الترتيب")} ${f.num(row.sort)}`}
        </p>
      </div>
    </button>
  );
}

function PriceBadge({ price }: { price: number }) {
  const t = useT();
  const f = useFmt();
  return price > 0 ? <Badge tone="primary">{f.jod(price)}</Badge> : <Badge tone="green">{t("Free", "مجاني")}</Badge>;
}

/* ---------------- a window over the page ---------------- */

function Modal({ label, onClose, children, wide = true }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const t = useT();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = before;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className={`flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-fg/10 ${wide ? "max-w-6xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-fg/10 px-5 py-3">
          <h3 className="truncate text-lg font-bold">{label}</h3>
          <button type="button" onClick={onClose} aria-label={t("Close", "إغلاق")} className="rounded-lg p-2 hover:bg-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Num({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-soft px-2 py-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

/* ---------------- one theme of the store ---------------- */

function ThemePanel({ entry: { row, theme: th }, nums: n, reload, onClose }: { entry: Entry; nums: Nums; reload: () => void; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const w = useWords();
  const [tab, setTab] = useState<"release" | "details">("release");
  const [asking, setAsking] = useState<ThemeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const next = NEXT_STATUS[row.source][row.status];

  const move = async (to: ThemeStatus) => {
    setBusy(true);
    setMsg(null);
    const r = await send(`/api/diwan/themes/${row.id}`, "PATCH", { status: to });
    setBusy(false);
    setAsking(null);
    if (r.ok) {
      setMsg({ ok: true, text: t(`Now: ${w.status(to)}`, `الآن: ${w.status(to)}`) });
      reload();
    } else setMsg({ ok: false, text: r.data?.result === "not-ready" ? w.missing(r.data.missing) : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.") });
  };

  const remove = async () => {
    setBusy(true);
    const r = await send(`/api/diwan/themes/${row.id}`, "DELETE");
    setBusy(false);
    if (r.ok) {
      onClose();
      reload();
    } else setMsg({ ok: false, text: t("Only a draft nobody bought can be deleted. Hide it instead.", "يمكن حذف المسودة التي لم يشترها أحد فقط. أخفِه بدلًا من ذلك.") });
  };

  return (
    <Modal label={t(th.name.en, th.name.ar)} onClose={onClose}>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_24rem] lg:overflow-hidden">
        <div className="min-h-0 p-4 lg:overflow-y-auto">
          <ThemePreview theme={th} height="min(70vh, 640px)" scroll sample />
        </div>
        <div className="min-h-0 border-t border-fg/10 lg:overflow-y-auto lg:border-s lg:border-t-0">
          <div className="flex flex-wrap items-center gap-1.5 px-5 pt-4">
            <Badge tone={statusTone[row.status]}>{w.status(row.status)}</Badge>
            <PriceBadge price={row.price} />
            {row.featured && <Badge tone="amber">★ {t("Featured", "مميّز")}</Badge>}
            <Badge tone={row.source === "design" ? "blue" : "grey"}>{row.source === "design" ? t("Made in Diwan", "صُنع في الديوان") : t("In Dukkan's code", "في كود دكّان")}</Badge>
          </div>
          <div className="mx-5 mt-4 flex gap-1 rounded-xl bg-soft p-1" role="tablist">
            {(["release", "details"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-8 flex-1 rounded-lg text-sm font-semibold transition ${tab === k ? "bg-card shadow-sm" : "text-muted hover:text-fg"}`}>
                {k === "release" ? t("Release", "النشر") : t("Details", "التفاصيل")}
              </button>
            ))}
          </div>
          {tab === "release" ? (
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-2">
                <Num label={t("Stores using it", "متاجر تستخدمه")} value={f.num(n.stores)} />
                <Num label={t("Bought", "مرات الشراء")} value={f.num(n.bought)} />
                <Num label={t("Money in", "الدخل")} value={f.jod(n.revenue)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold">{t("Where it is", "أين هو الآن")}</p>
                <p className="text-sm text-muted">
                  {row.status === "live" ? t("In the theme store: merchants can see and buy it.", "في متجر الثيمات: يراه التجار ويستطيعون شراءه.")
                    : row.status === "hidden" ? t("Out of the theme store. Merchants who bought it keep it.", "خارج متجر الثيمات. يبقى مع التجار الذين اشتروه.")
                    : row.status === "review" ? t("Waiting to be checked. Merchants don't see it yet.", "بانتظار المراجعة. لا يراه التجار بعد.")
                    : t("Being made. Merchants don't see it yet.", "قيد الصنع. لا يراه التجار بعد.")}
                </p>
                {asking ? (
                  <div className="rounded-xl bg-amber-500/10 p-3 text-sm ring-1 ring-amber-500/30">
                    <p className="font-semibold">{w.move(row.status, asking)}?</p>
                    {w.ask(asking) && <p className="mt-1 text-muted">{w.ask(asking)}</p>}
                    <div className="mt-3 flex gap-2">
                      <Btn kind={asking === "hidden" ? "danger" : "primary"} disabled={busy} onClick={() => move(asking)}>{t("Yes", "نعم")}</Btn>
                      <Btn kind="ghost" disabled={busy} onClick={() => setAsking(null)}>{t("Cancel", "إلغاء")}</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {next.map((to) => (
                      <Btn key={to} kind={to === "hidden" ? "ghost" : to === "draft" ? "ghost" : "primary"} disabled={busy} onClick={() => (to === "live" || to === "hidden" ? setAsking(to) : move(to))}>
                        {w.move(row.status, to)}
                      </Btn>
                    ))}
                  </div>
                )}
                {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>{msg.text}</p>}
              </div>
              {row.source === "design" && (
                <div className="space-y-2">
                  <p className="text-sm font-bold">{t("Its design", "تصميمه")}</p>
                  <p className="text-sm text-muted">{t("Change its look in the store designer, with sample products. Save there, then come back.", "غيّر شكله في مصمّم المتجر مع منتجات تجريبية. احفظ هناك ثم ارجع.")}</p>
                  {row.status === "live" && <p className="text-xs text-amber-700 dark:text-amber-300">{t("It is live: a saved change reaches the theme store at once.", "إنه منشور: أي تعديل محفوظ يصل إلى متجر الثيمات فورًا.")}</p>}
                  <a href={`/design?catalog=${row.id}`} className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-onink hover:bg-deep">{t("Open in the designer", "فتحه في المصمّم")}</a>
                </div>
              )}
              <dl className="space-y-1 text-xs text-muted">
                <div className="flex justify-between gap-2"><dt>{t("Code name", "الاسم البرمجي")}</dt><dd dir="ltr"><code>{row.id}</code></dd></div>
                <div className="flex justify-between gap-2"><dt>{t("First released", "أول نشر")}</dt><dd>{f.date(row.releasedAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt>{t("Last changed", "آخر تعديل")}</dt><dd>{f.dateTime(row.updatedAt)}</dd></div>
              </dl>
              {(row.status === "live" || row.status === "hidden") && (
                <a href={`/store?theme=${row.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-fg/15 px-3 py-2 text-center text-sm font-semibold hover:bg-soft">
                  {t("Open the full sample store", "فتح المتجر التجريبي كاملًا")}
                </a>
              )}
              {row.source === "design" && (row.status === "draft" || row.status === "review") && n.bought === 0 && (
                <button type="button" disabled={busy} onClick={async () => (await askConfirm({ title: t("Delete this theme for good?", "حذف هذا الثيم نهائيًا؟"), confirm: t("Delete", "حذف"), danger: true })) && remove()} className="text-sm font-semibold text-red-600 hover:underline">
                  {t("Delete this draft", "حذف هذه المسودة")}
                </button>
              )}
            </div>
          ) : (
            <DetailsForm key={row.id} row={row} code={row.source === "code" ? themes.find((x) => x.id === row.id) ?? null : null} reload={reload} />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- its words, price and place ---------------- */

const biText = (v: Bi | null | undefined) => ({ en: v?.en ?? "", ar: v?.ar ?? "" });
const linesOf = (list: Bi[] | null | undefined) => ({ en: (list ?? []).map((x) => x.en).join("\n"), ar: (list ?? []).map((x) => x.ar).join("\n") });
function listOf(v: { en: string; ar: string }): Bi[] {
  const en = v.en.split("\n");
  const ar = v.ar.split("\n");
  return Array.from({ length: Math.max(en.length, ar.length) }, (_, i) => ({ en: (en[i] ?? "").trim(), ar: (ar[i] ?? "").trim() })).filter((x) => x.en || x.ar);
}

function DetailsForm({ row, code, reload }: { row: ListingRow; code: ThemeInfo | null; reload: () => void }) {
  const t = useT();
  const [name, setName] = useState(biText(row.name));
  const [tagline, setTagline] = useState(biText(row.tagline));
  const [about, setAbout] = useState(biText(row.about));
  const [features, setFeatures] = useState(linesOf(row.features));
  const [tags, setTags] = useState(linesOf(row.tags));
  const [price, setPrice] = useState(String(row.price));
  const [sort, setSort] = useState(String(row.sort));
  const [featured, setFeatured] = useState(row.featured);
  const [demo, setDemo] = useState({ name: biText(row.demo?.name), about: biText(row.demo?.about), color: row.demo?.color ?? "#1c1a17" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /* on a code theme an empty box keeps the code's own words: they show greyed in it */
  const ph = (v: Bi | undefined, lang: "en" | "ar") => (code ? v?.[lang] ?? "" : "");
  const phList = (v: Bi[] | undefined, lang: "en" | "ar") => (code ? (v ?? []).map((x) => x[lang]).join("\n") : "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await send(`/api/diwan/themes/${row.id}`, "PATCH", {
      name, tagline, about, features: listOf(features), tags: listOf(tags), price, sort: Number(sort), featured,
      demo: row.source === "design" ? demo : undefined,
    });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") });
      reload();
    } else {
      const fieldName = r.data?.field;
      setMsg({ ok: false, text: fieldName === "price" ? t(`The price must be 0 to ${LISTING_LIMITS.maxPrice} JOD.`, `يجب أن يكون السعر بين 0 و${LISTING_LIMITS.maxPrice} د.أ.`) : fieldName === "name" ? t("A theme made here needs a name.", "الثيم المصنوع هنا يحتاج اسمًا.") : fieldName === "sort" ? t("The place must be a whole number.", "يجب أن يكون الترتيب رقمًا صحيحًا.") : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا.") });
    }
  };

  const Pair = ({ label, v, set, max, ml = false, phv }: { label: string; v: { en: string; ar: string }; set: (x: { en: string; ar: string }) => void; max: number; ml?: boolean; phv?: { en: string; ar: string } }) => (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      {(["en", "ar"] as const).map((l) =>
        ml ? (
          <textarea key={l} dir={l === "ar" ? "rtl" : "ltr"} lang={l} rows={3} maxLength={max * (ml ? 12 : 1)} className={area} aria-label={`${label} (${l === "ar" ? "العربية" : "English"})`} placeholder={phv?.[l] || (l === "ar" ? "بالعربية" : "In English")} value={v[l]} onChange={(e) => set({ ...v, [l]: e.target.value })} />
        ) : (
          <input key={l} dir={l === "ar" ? "rtl" : "ltr"} lang={l} maxLength={max} className={field} aria-label={`${label} (${l === "ar" ? "العربية" : "English"})`} placeholder={phv?.[l] || (l === "ar" ? "بالعربية" : "In English")} value={v[l]} onChange={(e) => set({ ...v, [l]: e.target.value })} />
        ),
      )}
    </fieldset>
  );

  return (
    <form onSubmit={save} className="space-y-4 p-5">
      {code && <p className="rounded-xl bg-soft px-3 py-2 text-xs text-muted">{t("A theme in Dukkan's code: an empty box keeps the code's own words (shown grey).", "ثيم في كود دكّان: الخانة الفارغة تُبقي كلمات الكود (تظهر باهتة).")}</p>}
      {Pair({ label: t("Name", "الاسم"), v: name, set: setName, max: LISTING_LIMITS.name, phv: code ? { en: ph(code.name, "en"), ar: ph(code.name, "ar") } : undefined })}
      {Pair({ label: t("Short line", "سطر قصير"), v: tagline, set: setTagline, max: LISTING_LIMITS.tagline, phv: code ? { en: ph(code.tagline, "en"), ar: ph(code.tagline, "ar") } : undefined })}
      {Pair({ label: t("About it", "عنه"), v: about, set: setAbout, max: LISTING_LIMITS.about, ml: true, phv: code ? { en: ph(code.about, "en"), ar: ph(code.about, "ar") } : undefined })}
      {Pair({ label: t("What it has (one a line, English and Arabic lines in the same order)", "ما يحتويه (سطر لكل ميزة، بنفس الترتيب بالعربية والإنجليزية)"), v: features, set: setFeatures, max: LISTING_LIMITS.feature, ml: true, phv: code ? { en: phList(code.features, "en"), ar: phList(code.features, "ar") } : undefined })}
      {Pair({ label: t("Tags (one a line)", "الوسوم (سطر لكل وسم)"), v: tags, set: setTags, max: LISTING_LIMITS.tag, ml: true, phv: code ? { en: phList(code.tags, "en"), ar: phList(code.tags, "ar") } : undefined })}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm font-semibold">
          <span>{t("Price (JOD, 0 is free)", "السعر (د.أ، 0 مجاني)")}</span>
          <input inputMode="decimal" dir="ltr" className={field} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>{t("Place in the store", "الترتيب في المتجر")}</span>
          <input inputMode="numeric" dir="ltr" className={field} value={sort} onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-muted">{t("Smaller places come first; featured themes come before all others.", "الترتيب الأصغر يظهر أولًا، والثيمات المميزة قبل غيرها.")}</p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        {t("Featured: first in the store, with a mark", "مميّز: أولًا في المتجر مع علامة")}
      </label>
      {row.source === "design" && (
        <fieldset className="space-y-3 rounded-xl bg-soft p-3">
          <legend className="text-sm font-bold">{t("Its sample store", "متجره التجريبي")}</legend>
          {Pair({ label: t("Store name", "اسم المتجر"), v: demo.name, set: (x) => setDemo({ ...demo, name: x }), max: LISTING_LIMITS.name })}
          {Pair({ label: t("What it sells", "ماذا يبيع"), v: demo.about, set: (x) => setDemo({ ...demo, about: x }), max: LISTING_LIMITS.tagline })}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-fg/15 bg-card" value={demo.color} onChange={(e) => setDemo({ ...demo, color: e.target.value })} />
            {t("Its colour", "لونه")}
          </label>
          <p className="text-xs text-muted">{t("Its pictures and texts are in its design (the designer).", "صوره ونصوصه في تصميمه (المصمّم).")}</p>
        </fieldset>
      )}
      <div className="flex items-center gap-3">
        <Btn type="submit" disabled={busy}>{t("Save", "حفظ")}</Btn>
        {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

/* ---------------- the free designs (read-only) ---------------- */

function FreePanel({ theme: th, nums: n, onClose }: { theme: ThemeInfo; nums: Nums; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const about = t(th.about.en, th.about.ar) || t(th.tagline.en, th.tagline.ar);
  return (
    <Modal label={t(th.name.en, th.name.ar)} onClose={onClose}>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_20rem] lg:overflow-hidden">
        <div className="min-h-0 p-4 lg:overflow-y-auto">
          <ThemePreview theme={th} height="min(70vh, 640px)" scroll sample />
        </div>
        <div className="space-y-5 border-t border-fg/10 p-5 lg:overflow-y-auto lg:border-s lg:border-t-0">
          <Num label={t("Stores using it", "متاجر تستخدمه")} value={f.num(n.stores)} />
          {about && <p className="text-sm leading-relaxed">{about}</p>}
          <p className="text-xs text-muted">{t("Free for every store, so it is not in the theme store. Its look changes with Dukkan's code; the starter design new stores get is in Platform settings.", "مجاني لكل متجر، لذلك ليس في متجر الثيمات. شكله يتغير مع كود دكّان، والتصميم الذي تبدأ به المتاجر الجديدة في إعدادات المنصة.")}</p>
          <a href={th.id === "dukkan" ? "/store?original=1" : `/store?theme=${th.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-fg/15 px-3 py-2 text-center text-sm font-semibold hover:bg-soft">
            {t("Open the full sample store", "فتح المتجر التجريبي كاملًا")}
          </a>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- a new theme ---------------- */

const codeNameOf = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^a-z]+/, "").slice(0, 31);

function NewTheme({ from, taken, onClose, onMade }: { from: ThemeInfo[]; taken: Set<string>; onClose: () => void; onMade: (id: string) => void }) {
  const t = useT();
  const [name, setName] = useState({ en: "", ar: "" });
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [start, setStart] = useState("starter");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const code = idTouched ? id : codeNameOf(name.en);
  const close = useCallback(onClose, [onClose]);
  const choices = useMemo(() => [{ id: "starter", label: t("The starter design (Platform settings)", "التصميم الأساسي (إعدادات المنصة)") }, { id: "original", label: t("Dukkan's original design", "تصميم دكّان الأصلي") }, ...[madaTheme, ...from].map((x) => ({ id: `theme:${x.id}`, label: t(`A copy of ${x.name.en}`, `نسخة من ${x.name.ar}`) }))], [from, t]);

  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (name.en.trim().length < 2 || name.ar.trim().length < 2) return setErr(t("Give it a name in English and Arabic.", "أعطه اسمًا بالعربية والإنجليزية."));
    if (!themeIdOk(code)) return setErr(t("The code name: small English letters, digits and dashes, starting with a letter (not one of Dukkan's).", "الاسم البرمجي: أحرف إنجليزية صغيرة وأرقام وشَرطات، يبدأ بحرف (وليس أحد أسماء دكّان)."));
    if (taken.has(code)) return setErr(t("That code name is taken.", "هذا الاسم البرمجي مستخدم."));
    setBusy(true);
    let design: unknown = defaultConfig;
    if (start === "starter") {
      const j = await fetch("/api/platform/template", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      design = j?.template ? designFrom(j.template) : defaultConfig;
    } else if (start.startsWith("theme:")) {
      const src = [madaTheme, ...from].find((x) => x.id === start.slice(6));
      if (src) design = src.build("en", { samples: true });
    }
    const r = await send("/api/diwan/themes", "POST", { id: code, name, design });
    setBusy(false);
    if (r.ok) onMade(code);
    else setErr(r.data?.result === "taken" ? t("That code name is taken.", "هذا الاسم البرمجي مستخدم.") : t("That did not work. Try again.", "لم ينجح ذلك. حاول مجددًا."));
  };

  return (
    <Modal label={t("New theme", "ثيم جديد")} onClose={close} wide={false}>
      <form onSubmit={make} className="space-y-4 overflow-y-auto p-5">
        <p className="text-sm text-muted">{t("It starts as a draft: only staff see it. Then change its look in the designer, write its details, and release it.", "يبدأ كمسودة يراها الفريق فقط. بعدها غيّر شكله في المصمّم، واكتب تفاصيله، ثم انشره.")}</p>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-semibold">{t("Name", "الاسم")}</legend>
          <input dir="ltr" lang="en" maxLength={LISTING_LIMITS.name} className={field} placeholder="In English" aria-label={t("Name in English", "الاسم بالإنجليزية")} value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} autoFocus />
          <input dir="rtl" lang="ar" maxLength={LISTING_LIMITS.name} className={field} placeholder="بالعربية" aria-label={t("Name in Arabic", "الاسم بالعربية")} value={name.ar} onChange={(e) => setName({ ...name, ar: e.target.value })} />
        </fieldset>
        <label className="block space-y-1 text-sm font-semibold">
          <span>{t("Code name (never changes)", "الاسم البرمجي (لا يتغير)")}</span>
          <input dir="ltr" maxLength={31} className={field} pattern={THEME_ID.source} value={code} onChange={(e) => { setIdTouched(true); setId(e.target.value.toLowerCase()); }} />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>{t("Start from", "ابدأ من")}</span>
          <select className={field} value={start} onChange={(e) => setStart(e.target.value)}>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
        <div className="flex gap-2">
          <Btn type="submit" disabled={busy}>{busy ? t("Making…", "جارٍ الإنشاء…") : t("Make the draft", "إنشاء المسودة")}</Btn>
          <Btn type="button" kind="ghost" onClick={close}>{t("Cancel", "إلغاء")}</Btn>
        </div>
      </form>
    </Modal>
  );
}
