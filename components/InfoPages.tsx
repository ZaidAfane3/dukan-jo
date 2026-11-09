"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import type { SectionConfig } from "./storefront/config";
import { sanitizePages } from "./safeDesign";
import { cleanLine, cleanLines, visibleLength } from "./safe";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { publicSettings, refreshPublicSettings } from "./platformPublic";

type Bi = { en: string; ar: string };
export type InfoPage = {
  id: number;
  type: 0 | 1 | 2; /* general, return policy, privacy and terms */
  published: boolean;
  footer: boolean;
  title: Bi;
  content: Bi;
  created: number;
  /* The elements of the page (text, products, banners...), built in the store designer like the home page */
  sections?: SectionConfig[];
};

const KEY = "seen-pages";
/* The list of pages in use: the store's own */
const scope = KEY;
export const pagesScope = () => scope;
/* The pages a ready theme brings (9101 and up) were once saved in the store's own list; they belong to their theme only */
const themePage = (id: number) => id >= 9100 && id < 9300;
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

/* The pages every store starts with: the return policy, the terms and the privacy policy Dukkan's staff write in Diwan
   (platform settings, store_legal_templates; the copy this browser has, or the original text). The text is a starting point
   he can edit: once his pages are saved they are his, and a later change in Diwan reaches only new stores. */
const defaults = (): Omit<InfoPage, "id" | "created">[] => {
  const t = publicSettings().store_legal_templates;
  return [
    { type: 1, published: true, footer: true, title: { ...t.returns.title }, content: { ...t.returns.body } },
    { type: 2, published: true, footer: true, title: { ...t.terms.title }, content: { ...t.terms.body } },
    { type: 2, published: true, footer: true, title: { ...t.privacy.title }, content: { ...t.privacy.body } },
  ];
};

const copy = {
  en: {
    title: "Info pages",
    newPage: "New page",
    searchPh: "Search for a page",
    sort: "Sort",
    sorts: ["Newest first", "Title"],
    types: ["General", "Return policy", "Terms and privacy"],
    published: "Published",
    draft: "Draft",
    visit: "View page",
    soon: "Your store isn't live yet",
    info: "Page information",
    pageTitle: "Page title",
    titlePh: "For example: About us",
    pageType: "Page type",
    content: "Page content",
    contentPh: "Write the page content here",
    footer: "Show the page link in the store footer",
    footerHint: "If you turn this off, the link is hidden from your store footer.",
    status: "Status",
    save: "Save",
    saved: "Page saved",
    delete: "Delete page",
    deleteAsk: "Delete this page? This cannot be undone.",
    deleteYes: "Yes, delete",
    cancel: "Cancel",
    errTitle: "Enter the page title",
    errContent: "Write some content for the page",
    emptyTitle: "No pages yet",
    emptyHint: "Add a page such as About us or Shipping information.",
    noMatch: "No pages match your search",
    pickOne: "Select a page to edit it, or add a new one",
    sample: "These pages start with sample text. Read them and change them to match how your store works.",
    untitled: "Untitled page",
  },
  ar: {
    title: "الصفحات التعريفية",
    newPage: "صفحة جديدة",
    searchPh: "ابحث عن صفحة",
    sort: "ترتيب",
    sorts: ["الأحدث أولًا", "العنوان"],
    types: ["عامة", "سياسة الاستبدال والاسترجاع", "الأحكام والخصوصية"],
    published: "منشور",
    draft: "مسودة",
    visit: "زيارة الصفحة",
    soon: "متجرك غير منشور بعد",
    info: "معلومات الصفحة",
    pageTitle: "عنوان الصفحة",
    titlePh: "مثال: من نحن",
    pageType: "نوع الصفحة",
    content: "محتوى الصفحة",
    contentPh: "اكتب محتوى الصفحة هنا",
    footer: "عرض رابط الصفحة في تذييل الموقع",
    footerHint: "عند إلغاء التفعيل، سيُخفى رابط الصفحة من تذييل موقع متجرك.",
    status: "الحالة",
    save: "حفظ",
    saved: "تم حفظ الصفحة",
    delete: "حذف الصفحة",
    deleteAsk: "هل تريد حذف هذه الصفحة؟ لا يمكن التراجع عن ذلك.",
    deleteYes: "نعم، احذف",
    cancel: "إلغاء",
    errTitle: "أدخل عنوان الصفحة",
    errContent: "اكتب محتوى للصفحة",
    emptyTitle: "لا توجد صفحات بعد",
    emptyHint: "أضف صفحة مثل من نحن أو معلومات الشحن.",
    noMatch: "لا توجد صفحات مطابقة لبحثك",
    pickOne: "اختر صفحة لتعديلها، أو أضف صفحة جديدة",
    sample: "تبدأ هذه الصفحات بنص تجريبي. اقرأها وعدّلها لتناسب طريقة عمل متجرك.",
    untitled: "صفحة بدون عنوان",
  },
};

export function load(): InfoPage[] {
  try {
    const raw = localStorage.getItem(scope);
    if (raw) {
      /* Pages saved in this browser are checked before they are used (see safeDesign.ts) */
      const list = (sanitizePages(JSON.parse(raw)) ?? []) as InfoPage[];
      if (scope !== KEY || !list.some((x) => themePage(x.id))) return list;
      const own = list.filter((x) => !themePage(x.id));
      localStorage.setItem(KEY, JSON.stringify(own));
      return own;
    }
  } catch {
    /* fall through to the defaults */
  }
  const now = Date.now();
  return defaults().map((d, i) => ({ ...d, id: i + 1, created: now - i * 1000 }));
}

/** Saves the list of pages (the same list the Info pages dashboard shows) */
export function savePages(list: InfoPage[]): boolean {
  try {
    localStorage.setItem(scope, JSON.stringify(scope === KEY ? list.filter((x) => !themePage(x.id)) : list));
    return true;
  } catch {
    return false;
  }
}

/* Ready pages a merchant can start a new page from. The text is a starting point he can edit. */
export const pageTemplates: { id: string; name: Bi; title: Bi; content: Bi }[] = [
  {
    id: "about",
    name: { en: "About us", ar: "من نحن" },
    title: { en: "About us", ar: "من نحن" },
    content: {
      en: "About us\n\nWe are a small team that loves what we sell. Every piece in our store is picked with care, and we are always happy to hear from you.\n\nTell your story here: who you are, when you started, and what makes your store different.",
      ar: "من نحن\n\nنحن فريق صغير يحب ما يبيعه. كل قطعة في متجرنا مختارة بعناية، ويسعدنا دائمًا أن نسمع منك.\n\nاحكِ قصتك هنا: من أنتم، ومتى بدأتم، وما الذي يميّز متجركم.",
    },
  },
  {
    id: "shipping",
    name: { en: "Shipping information", ar: "معلومات الشحن" },
    title: { en: "Shipping information", ar: "معلومات الشحن" },
    content: {
      en: "Shipping information\n\nWe deliver to Irbid, Amman and Salt. Orders are prepared within 1 to 2 working days, and delivery usually takes 1 to 3 days after that.\n\nYou will get a message when your order is on its way. Write your delivery prices and any free-delivery offer here.",
      ar: "معلومات الشحن\n\nنوصّل إلى إربد وعمّان والسلط. نجهّز الطلبات خلال يوم إلى يومين عمل، ويستغرق التوصيل عادةً من يوم إلى 3 أيام بعد ذلك.\n\nستصلك رسالة عندما يكون طلبك في الطريق. اكتب هنا أسعار التوصيل وأي عرض توصيل مجاني.",
    },
  },
  {
    id: "sizes",
    name: { en: "Size guide", ar: "دليل المقاسات" },
    title: { en: "Size guide", ar: "دليل المقاسات" },
    content: {
      en: "Size guide\n\nChoose your size by your chest and waist measurements. If you are between two sizes, we suggest the bigger one for a relaxed fit.\n\nAdd your size table here.",
      ar: "دليل المقاسات\n\nاختر مقاسك حسب قياس الصدر والخصر. وإن كنت بين مقاسين ننصحك بالأكبر لقصّة مريحة.\n\nأضف جدول المقاسات هنا.",
    },
  },
  {
    id: "contact",
    name: { en: "Contact us", ar: "تواصل معنا" },
    title: { en: "Contact us", ar: "تواصل معنا" },
    content: {
      en: "Contact us\n\nQuestions about an order or a product? Message us and we will reply as soon as we can.\n\nAdd your phone number, WhatsApp, email and working hours here.",
      ar: "تواصل معنا\n\nعندك سؤال عن طلب أو منتج؟ راسلنا وسنرد عليك بأسرع وقت.\n\nأضف هنا رقم هاتفك وواتساب وبريدك الإلكتروني وأوقات العمل.",
    },
  },
  {
    id: "faq",
    name: { en: "Questions and answers", ar: "الأسئلة الشائعة" },
    title: { en: "Questions and answers", ar: "الأسئلة الشائعة" },
    content: {
      en: "Questions and answers\n\nHow long does delivery take?\nUsually 1 to 3 days after we prepare your order.\n\nCan I exchange an item?\nYes, within 7 days if it is unused.\n\nAdd your own questions and answers here.",
      ar: "الأسئلة الشائعة\n\nكم يستغرق التوصيل؟\nعادةً من يوم إلى 3 أيام بعد تجهيز طلبك.\n\nهل يمكنني استبدال منتج؟\nنعم، خلال 7 أيام إن كان غير مستخدم.\n\nأضف أسئلتك وأجوبتك هنا.",
    },
  },
  {
    id: "blank",
    name: { en: "Blank page", ar: "صفحة فارغة" },
    title: { en: "", ar: "" },
    content: { en: "", ar: "" },
  },
];

export function InfoPages() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const other = lang === "ar" ? "en" : "ar";

  const [pages, setPages] = useState<InfoPage[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(0);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<0 | 1 | 2>(0);
  const [content, setContent] = useState("");
  const [footer, setFooter] = useState(true);
  const [published, setPublished] = useState(true);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  /* Show the text in the current language, or the other one if this one is empty. */
  const t = (b: Bi) => b[lang] || b[other];

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    /* A store with no pages saved yet gets them now (they are saved below), so it first asks Dukkan for the templates its
       staff wrote in Diwan: a store opening this page for the first time starts from the latest ones. */
    let gone = false;
    let saved = true;
    try {
      saved = localStorage.getItem(pagesScope()) !== null;
    } catch {
      /* storage blocked: nothing is kept anyway */
    }
    void (saved ? Promise.resolve(true) : refreshPublicSettings()).then(() => {
      if (gone) return;
      setPages(load());
      setReady(true);
    });
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(pages));
    } catch {
      /* storage unavailable */
    }
  }, [pages, ready]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pages.filter((p) => !q || t(p.title).toLowerCase().includes(q));
    return [...list].sort(sort === 0 ? (a, b) => b.created - a.created : (a, b) => t(a.title).localeCompare(t(b.title), lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, query, sort, lang]);

  const open = (p: InfoPage) => {
    setEditing(p.id);
    setTitle(t(p.title));
    setType(p.type);
    setContent(t(p.content));
    setFooter(p.footer);
    setPublished(p.published);
    setErrors({});
    setConfirmDelete(false);
  };

  const openNew = () => {
    setEditing("new");
    setTitle("");
    setType(0);
    setContent("");
    setFooter(true);
    setPublished(true);
    setErrors({});
    setConfirmDelete(false);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (visibleLength(title) < 2) next.title = c.errTitle;
    if (visibleLength(content) < 5) next.content = c.errContent;
    setErrors(next);
    if (Object.keys(next).length) return;

    /* Editing in one language only changes that language's text. */
    if (editing === "new") {
      const id = pages.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      const bi = (v: string): Bi => ({ en: lang === "en" ? v : "", ar: lang === "ar" ? v : "" });
      setPages((l) => [{ id, type, published, footer, title: bi(cleanLine(title, 80)), content: bi(cleanLines(content, 10000)), created: Date.now() }, ...l]);
      setEditing(id);
    } else {
      setPages((l) =>
        l.map((p) =>
          p.id === editing
            ? { ...p, type, published, footer, title: { ...p.title, [lang]: cleanLine(title, 80) }, content: { ...p.content, [lang]: cleanLines(content, 10000) } }
            : p,
        ),
      );
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const remove = (id: number) => {
    setPages((l) => l.filter((p) => p.id !== id));
    setEditing(null);
    setConfirmDelete(false);
  };

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="pages"
        subtabs={[c.title]}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <p className="rounded-xl bg-soft px-4 py-3 text-xs text-muted">{c.sample}</p>

        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.searchPh} aria-label={c.searchPh} className={`${field} h-12 ps-12`} />
        </div>
          <button type="button" onClick={openNew} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {c.newPage} </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Pages list */}
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-end border-b border-fg/10 px-4 py-3">
              <select value={sort} onChange={(e) => setSort(Number(e.target.value))} aria-label={c.sort} className="h-9 rounded-lg border border-fg/15 bg-card px-2 text-xs font-semibold outline-none focus:border-primary">
                {c.sorts.map((s, i) => <option key={s} value={i}>{s}</option>)}
              </select>
            </div>
            {shown.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-bold">{pages.length === 0 ? c.emptyTitle : c.noMatch}</p>
                {pages.length === 0 && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{c.emptyHint}</p>}
              </div>
            ) : (
              <ul className="divide-y divide-fg/10">
                {shown.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => open(p)}
                      aria-current={editing === p.id}
                      className={`w-full px-5 py-4 text-start transition-colors ${editing === p.id ? "bg-black/[0.07] dark:bg-white/[0.1]" : "hover:bg-fg/[0.05]"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-bold">{t(p.title) || c.untitled}</span>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${p.published ? "bg-primary/15 text-deep dark:text-primary" : "bg-fg/10 text-muted"}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {p.published ? c.published : c.draft}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-xs text-muted">{c.types[p.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Editor */}
          <section className={`${card} p-5 sm:p-7`}>
            {editing === null ? (
              <div className="grid min-h-[16rem] place-items-center text-center">
                <div>
                  <p className="text-sm text-muted">{c.pickOne}</p>
                  <button type="button" onClick={openNew} className="mt-4 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {c.newPage}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={save} noValidate className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft/70 px-4 py-3">
                  <select value={published ? "1" : "0"} onChange={(e) => setPublished(e.target.value === "1")} aria-label={c.status} className="h-10 rounded-lg border border-fg/15 bg-card px-3 text-sm font-semibold outline-none focus:border-primary">
                    <option value="1">{c.published}</option>
                    <option value="0">{c.draft}</option>
                  </select>
                  <span title={c.soon} className="cursor-not-allowed rounded-lg border border-fg/15 px-4 py-2 text-sm font-semibold text-muted/70">{c.visit}</span>
                </div>

                <h2 className="text-lg font-extrabold">{c.info}</h2>
                <RequiredNote text={requiredNote[lang]} show={hasErrors(errors)} />

                <div>
                  <label htmlFor="pg-title" className="mb-2 block text-sm font-semibold">{c.pageTitle}<RequiredMark /></label>
                  <input id="pg-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={c.titlePh} maxLength={80} aria-required className={`${field} h-12`} />
                  {errors.title && <p className="mt-1.5 text-xs text-rose-600">{errors.title}</p>}
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">{c.pageType}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.types.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setType(i as 0 | 1 | 2)}
                        aria-pressed={type === i}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${type === i ? "border-primary bg-primary/10 text-primary" : "border-fg/20 hover:bg-soft"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pg-content" className="mb-2 block text-sm font-semibold">{c.content}<RequiredMark /></label>
                  <textarea id="pg-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={c.contentPh} rows={14} maxLength={10000} aria-required className={`${field} resize-y py-3 leading-7`} />
                  {errors.content && <p className="mt-1.5 text-xs text-rose-600">{errors.content}</p>}
                </div>

                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={footer} onChange={(e) => setFooter(e.target.checked)} className="peer sr-only" />
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{c.footer}</span>
                    <span className="mt-0.5 block text-xs text-muted">{c.footerHint}</span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-6">
                  <button type="submit" className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{c.save}</button>
                  <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
                  {flash && <p role="status" className="text-sm font-semibold text-primary">{c.saved}</p>}

                  {typeof editing === "number" &&
                    (confirmDelete ? (
                      <span className="ms-auto flex flex-wrap items-center gap-3">
                        <span className="text-sm text-rose-600">{c.deleteAsk}</span>
                        <button type="button" onClick={() => remove(editing)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{c.deleteYes}</button>
                        <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{c.cancel}</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="ms-auto rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{c.delete}</button>
                    ))}
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
