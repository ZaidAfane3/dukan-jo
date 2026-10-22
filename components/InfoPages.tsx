"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";

type Bi = { en: string; ar: string };
type Page = {
  id: number;
  type: 0 | 1 | 2; /* general, return policy, privacy and terms */
  published: boolean;
  footer: boolean;
  title: Bi;
  content: Bi;
  created: number;
};

const KEY = "seen-pages";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

/* The pages every store starts with. The text is a starting point he can edit. */
const defaults: Omit<Page, "id" | "created">[] = [
  {
    type: 1,
    published: true,
    footer: true,
    title: { en: "Return and exchange policy", ar: "سياسة الاستبدال والاسترجاع" },
    content: {
      en: "Return and exchange policy\n\nYou can return or exchange an item within 7 days of receiving it, as long as it is unused and in its original packaging.\n\nTo start a return, contact the store with your order number. Once we receive the item and check it, we refund the amount using the same payment method, or exchange it for another item.\n\nDelivery fees are not refunded unless the item arrived damaged or was not what you ordered.",
      ar: "سياسة الاستبدال والاسترجاع\n\nيمكنك إرجاع المنتج أو استبداله خلال 7 أيام من استلامه، بشرط أن يكون غير مستخدم وفي عبوته الأصلية.\n\nللبدء بطلب الإرجاع، تواصل مع المتجر ومعك رقم الطلب. بعد استلام المنتج وفحصه، نعيد المبلغ بنفس طريقة الدفع أو نستبدله بمنتج آخر.\n\nلا تُسترد رسوم التوصيل إلا إذا وصل المنتج تالفًا أو مختلفًا عمّا طلبته.",
    },
  },
  {
    type: 2,
    published: true,
    footer: true,
    title: { en: "Terms and conditions", ar: "الأحكام والشروط" },
    content: {
      en: "Terms and conditions\n\nBy using this store and placing an order you agree to these terms.\n\nPrices are shown in Jordanian dinars. We may cancel an order if a product is unavailable or a price was shown by mistake, and in that case you are refunded in full.\n\nAll content on this store, including text, images and logos, belongs to the store and may not be used without permission.\n\nThe store may update these terms from time to time. The version published here is the one that applies.",
      ar: "الأحكام والشروط\n\nباستخدامك هذا المتجر وإتمامك طلبًا فإنك توافق على هذه الأحكام.\n\nتُعرض الأسعار بالدينار الأردني. يحق للمتجر إلغاء الطلب إذا كان المنتج غير متوفر أو عُرض بسعر خاطئ، وفي هذه الحالة يُعاد إليك المبلغ كاملًا.\n\nجميع محتويات المتجر، بما في ذلك النصوص والصور والشعارات، ملك للمتجر ولا يجوز استخدامها دون إذن.\n\nقد يحدّث المتجر هذه الأحكام من وقت لآخر، والنسخة المنشورة هنا هي المعتمدة.",
    },
  },
  {
    type: 2,
    published: true,
    footer: true,
    title: { en: "Privacy policy", ar: "سياسة الخصوصية" },
    content: {
      en: "Privacy policy\n\nWe collect only what we need to process your order: your name, phone number, email and delivery address.\n\nWe use this information to prepare and deliver your order and to contact you about it. We do not sell your personal information.\n\nYou can ask us to see, correct or delete your information at any time by contacting the store.",
      ar: "سياسة الخصوصية\n\nنجمع فقط ما نحتاجه لإتمام طلبك: اسمك ورقم جوالك وبريدك الإلكتروني وعنوان التوصيل.\n\nنستخدم هذه المعلومات لتجهيز طلبك وتوصيله والتواصل معك بشأنه. ولا نبيع بياناتك الشخصية.\n\nيمكنك في أي وقت أن تطلب الاطلاع على بياناتك أو تصحيحها أو حذفها بالتواصل مع المتجر.",
    },
  },
];

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

function load(): Page[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Page[];
  } catch {
    /* fall through to the defaults */
  }
  const now = Date.now();
  return defaults.map((d, i) => ({ ...d, id: i + 1, created: now - i * 1000 }));
}

export function InfoPages() {
  const { lang } = usePrefs();
  const c = copy[lang];
  const other = lang === "ar" ? "en" : "ar";

  const [pages, setPages] = useState<Page[]>([]);
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
    setPages(load());
    setReady(true);
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

  const open = (p: Page) => {
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
    if (title.trim().length < 2) next.title = c.errTitle;
    if (content.trim().length < 5) next.content = c.errContent;
    setErrors(next);
    if (Object.keys(next).length) return;

    /* Editing in one language only changes that language's text. */
    if (editing === "new") {
      const id = pages.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      const bi = (v: string): Bi => ({ en: lang === "en" ? v.trim() : "", ar: lang === "ar" ? v.trim() : "" });
      setPages((l) => [{ id, type, published, footer, title: bi(title), content: bi(content), created: Date.now() }, ...l]);
      setEditing(id);
    } else {
      setPages((l) =>
        l.map((p) =>
          p.id === editing
            ? { ...p, type, published, footer, title: { ...p.title, [lang]: title.trim() }, content: { ...p.content, [lang]: content.trim() } }
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

                <div>
                  <label htmlFor="pg-title" className="mb-2 block text-sm font-semibold">{c.pageTitle}</label>
                  <input id="pg-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={c.titlePh} maxLength={80} className={`${field} h-12`} />
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
                  <label htmlFor="pg-content" className="mb-2 block text-sm font-semibold">{c.content}</label>
                  <textarea id="pg-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder={c.contentPh} rows={14} maxLength={10000} className={`${field} resize-y py-3 leading-7`} />
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
