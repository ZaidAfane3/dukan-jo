"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { FILTER_KEYS, productsCopy, type FilterKey } from "./productsContent";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { readPhoto } from "./designer/image";
import { demoActive } from "./demoSandbox";
import { FocusPicker } from "./FocusPicker";

type Product = {
  id: number;
  /* Photos of the product (small pictures kept with it), the first one is the main one */
  images?: string[];
  /* The part of the main picture that stays visible when the store crops it (percent from the left and the top) */
  focus?: { x: number; y: number };
  name: string;
  price: number | null;
  sale: number | null;
  cost: number | null;
  category: string;
  brand: string;
  description: string;
  /* Shown on the store's product card: a short notes line, and a small label on the picture */
  notes?: string;
  badge?: string;
  quantity: number;
  hidden: boolean;
  featured: boolean;
  shipping: boolean;
  lowAt: number;
  restockMin: number;
  restockPct: number;
  created: number;
  deletedAt?: number;
};

type Draft = {
  name: string;
  price: string;
  sale: string;
  cost: string;
  category: string;
  brand: string;
  description: string;
  notes: string;
  badge: string;
  quantity: string;
  hidden: boolean;
  featured: boolean;
  shipping: boolean;
  lowAt: string;
  restockMin: string;
  restockPct: string;
};

const KEY = "seen-products";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

const blank: Draft = {
  name: "",
  price: "",
  sale: "",
  cost: "",
  category: "",
  brand: "",
  description: "",
  notes: "",
  badge: "",
  quantity: "0",
  hidden: false,
  featured: false,
  shipping: true,
  lowAt: "5",
  restockMin: "15",
  restockPct: "100",
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const digits = (v: string) => latin(v).replace(/[^\d.]/g, "");

function load(): Product[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}

const matches: Record<FilterKey, (p: Product) => boolean> = {
  all: () => true,
  deleted: (p) => !!p.deletedAt,
  unpriced: (p) => p.price === null,
  featured: (p) => p.featured,
  hidden: (p) => p.hidden,
  discounted: (p) => p.sale !== null,
  soldOut: (p) => p.quantity <= 0,
  forSale: (p) => !p.hidden && p.quantity > 0 && p.price !== null,
  uncategorized: (p) => !p.category.trim(),
  shipping: (p) => p.shipping,
  nearSoldOut: (p) => p.quantity > 0 && p.quantity <= p.lowAt,
  noDescription: (p) => !p.description.trim(),
};

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden dir="ltr" className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[22px]">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
      </span>
    </label>
  );
}

function Label({ id, children, hint }: { id: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <label htmlFor={id} className="block text-sm font-semibold">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Products() {
  const { lang } = usePrefs();
  const p = productsCopy[lang];

  const [items, setItems] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [errors, setErrors] = useState<{ name?: string; price?: string; sale?: string }>({});
  const [picked, setPicked] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState(false);
  /* The product's photos: shrunk and saved with the product, so the store shows them */
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBad, setPhotoBad] = useState(false);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${brandName(lang)} | ${p.title}`;
  }, [lang, p]);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  /* A search result links here with ?open=ID. */
  useEffect(() => {
    if (!ready) return;
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    const hit = id ? items.find((x) => x.id === id && !x.deletedAt) : undefined;
    if (hit) openEdit(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items, ready]);

  const test = (k: FilterKey) => (x: Product) => (k === "deleted" ? !!x.deletedAt : !x.deletedAt && matches[k](x));
  const counts = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, items.filter(test(k)).length])) as Record<FilterKey, number>, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(test(filter)).filter((x) => !q || x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q) || x.brand.toLowerCase().includes(q));
    const by = [
      (a: Product, b: Product) => b.created - a.created,
      (a: Product, b: Product) => a.name.localeCompare(b.name, lang),
      (a: Product, b: Product) => (a.price ?? Infinity) - (b.price ?? Infinity),
      (a: Product, b: Product) => (b.price ?? -1) - (a.price ?? -1),
    ][sort];
    return [...list].sort(by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, query, sort, lang]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const openEdit = (x: Product) => {
    setEditing(x.id);
    setDraft({
      name: x.name,
      price: x.price === null ? "" : String(x.price),
      sale: x.sale === null ? "" : String(x.sale),
      cost: x.cost === null ? "" : String(x.cost),
      category: x.category,
      brand: x.brand,
      description: x.description,
      notes: x.notes ?? "",
      badge: x.badge ?? "",
      quantity: String(x.quantity),
      hidden: x.hidden,
      featured: x.featured,
      shipping: x.shipping,
      lowAt: String(x.lowAt),
      restockMin: String(x.restockMin),
      restockPct: String(x.restockPct),
    });
    setErrors({});
    setConfirmDelete(false);
    setPhotos(x.images ?? []);
    setFocus(x.focus ?? { x: 50, y: 50 });
    setPhotoBad(false);
  };

  const openNew = () => {
    setEditing("new");
    setDraft(blank);
    setErrors({});
    setConfirmDelete(false);
    setPhotos([]);
    setFocus({ x: 50, y: 50 });
    setPhotoBad(false);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* Each photo is shrunk to a small picture, so a few of them fit in the browser's storage */
  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const made = await Promise.all(Array.from(files).filter((f) => f.size <= 8_000_000).map((f) => readPhoto(f, 900)));
    const ok = made.filter((u): u is string => !!u);
    setPhotoBad(ok.length < files.length);
    setPhotos((cur) => [...cur, ...ok].slice(0, 6));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const price = num(draft.price);
    const sale = num(draft.sale);
    if (draft.name.trim().length < 2) next.name = p.errName;
    if (price !== null && !(price >= 0)) next.price = p.errPrice;
    if (sale !== null && (price === null || !(sale < price))) next.sale = p.errSale;
    setErrors(next);
    if (Object.keys(next).length) return;

    const base = {
      name: draft.name.trim(),
      price,
      sale,
      cost: num(draft.cost),
      category: draft.category.trim(),
      brand: draft.brand.trim(),
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      badge: draft.badge.trim(),
      quantity: Math.max(0, Math.floor(Number(draft.quantity) || 0)),
      hidden: draft.hidden,
      featured: draft.featured,
      shipping: draft.shipping,
      lowAt: Math.max(0, Math.floor(Number(draft.lowAt) || 0)),
      restockMin: Math.max(0, Math.floor(Number(draft.restockMin) || 0)),
      restockPct: Math.min(100, Math.max(0, Math.floor(Number(draft.restockPct) || 0))),
      images: photos,
      focus,
    };

    if (editing === "new") {
      const id = items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
      setItems((list) => [{ id, created: Date.now(), ...base }, ...list]);
      setEditing(id);
    } else {
      setItems((list) => list.map((x) => (x.id === editing ? { ...x, ...base } : x)));
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const trash = (ids: number[]) => {
    setItems((list) => list.map((x) => (ids.includes(x.id) ? { ...x, deletedAt: Date.now() } : x)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setConfirmDelete(false);
  };

  const restore = (ids: number[]) => {
    setItems((list) => list.map((x) => (ids.includes(x.id) ? { ...x, deletedAt: undefined } : x)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const remove = (ids: number[]) => {
    setItems((list) => list.filter((x) => !ids.includes(x.id)));
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setConfirmDelete(false);
  };

  const allPicked = shown.length > 0 && shown.every((x) => picked.includes(x.id));
  const togglePick = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="products"
        subtabs={p.tabs}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={p.searchPh} aria-label={p.searchPh} className={`${field} h-12 ps-12`} />
        </div>
          <button type="button" onClick={openNew} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {p.newProduct} </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,24rem)_minmax(0,1fr)]">
          {/* Filters */}
          <section className={`${card} overflow-hidden`}>
            <ul className="max-lg:flex max-lg:overflow-x-auto">
              {FILTER_KEYS.map((k) => (
                <li key={k} className="max-lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors max-lg:whitespace-nowrap ${filter === k ? "bg-black/[0.07] font-bold dark:bg-white/[0.1]" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`}
                  >
                    <span className="flex-1 text-start">{p.filters[k]}</span>
                    <span dir="ltr" className="text-xs">{counts[k]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* List */}
          <section className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 border-b border-fg/10 px-4 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? [] : shown.map((x) => x.id))}
                  aria-label={p.selectAll}
                  className="h-4 w-4 accent-[rgb(var(--primary))]"
                />
                {p.selectAll}
              </label>
              <select value={sort} onChange={(e) => setSort(Number(e.target.value))} aria-label={p.sort} className="ms-auto h-9 rounded-lg border border-fg/15 bg-card px-2 text-xs font-semibold outline-none focus:border-primary">
                {p.sorts.map((s, i) => <option key={s} value={i}>{s}</option>)}
              </select>
              {picked.length > 0 && (
                filter === "deleted" ? (
                  <button type="button" onClick={() => restore(picked)} className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.restore} ({picked.length})
                  </button>
                ) : (
                  <button type="button" onClick={() => trash(picked)} className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10">
                    {p.deleteSelected} ({picked.length})
                  </button>
                )
              )}
            </div>

            {shown.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold">{items.length === 0 ? p.empty : p.noMatch}</p>
                {items.length === 0 && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{p.emptyHint}</p>}
                {items.length === 0 && (
                  <button type="button" onClick={openNew} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.newProduct}
                  </button>
                )}
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-fg/10 overflow-y-auto">
                {shown.map((x) => (
                  <li key={x.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${editing === x.id ? "bg-black/[0.07] dark:bg-white/[0.1]" : "hover:bg-fg/[0.05]"}`}>
                    <input type="checkbox" checked={picked.includes(x.id)} onChange={() => togglePick(x.id)} aria-label={x.name} className="h-4 w-4 shrink-0 accent-[rgb(var(--primary))]" />
                    <button type="button" onClick={() => openEdit(x)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-soft text-muted">
                        {x.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={x.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M9 3 3.5 6 5.5 10.5 8 9.5V20.5H16V9.5l2.5 1L20.5 6 15 3a3 3 0 0 1-6 0Z" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{x.name}</span>
                          {x.hidden && <span className="shrink-0 rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-bold text-muted">{p.filters.hidden.split(" ").pop()}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {x.category || "-"} · <span dir="ltr">{x.quantity}</span> {p.piece}
                        </span>
                        <span dir="ltr" className="mt-0.5 block text-start text-sm font-bold">
                          {x.price === null ? (
                            <span className="font-medium text-muted">{p.noPrice}</span>
                          ) : x.sale !== null ? (
                            <>
                              {fmt(x.sale)} <small className="font-semibold opacity-70">{p.currency}</small>{" "}
                              <s className="text-xs font-medium text-muted">{fmt(x.price)}</s>
                            </>
                          ) : (
                            <>
                              {fmt(x.price)} <small className="font-semibold opacity-70">{p.currency}</small>
                            </>
                          )}
                        </span>
                      </span>
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
                  <p className="text-sm text-muted">{p.pickOne}</p>
                  <button type="button" onClick={openNew} className="mt-4 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {p.newProduct}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={save} noValidate className="space-y-8">
                <h2 className="text-lg font-extrabold">{editing === "new" ? p.newProduct : p.edit}</h2>
                {typeof editing === "number" && items.find((x) => x.id === editing)?.deletedAt && <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{p.deletedNote}</p>}

                <div className="space-y-5">
                  <h3 className="font-bold">{p.basic}</h3>
                  <div>
                    <Label id="p-name">{p.name}</Label>
                    <input id="p-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder={p.namePh} maxLength={80} className={`${field} h-12`} />
                    {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold">{p.images}</p>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {photos.map((u, i) => (
                        <div key={u} className="group relative aspect-square overflow-hidden rounded-xl bg-soft ring-1 ring-fg/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" className="h-full w-full object-cover" />
                          {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{p.primary}</span>}
                          <button
                            type="button"
                            onClick={() => setPhotos((cur) => cur.filter((x) => x !== u))}
                            aria-label={p.removeImage}
                            className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                          </button>
                        </div>
                      ))}
                      {photos.length < 6 && (
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-fg/20 text-center text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                        >
                          <span>
                            <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" />
                            </svg>
                            {p.addImage}
                          </span>
                        </button>
                      )}
                    </div>
                    <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
                    <p className={`mt-2 text-xs ${photoBad ? "text-rose-600" : "text-muted"}`}>{photoBad ? p.imagesBad : p.imagesHint}</p>

                    {/* What stays visible: the store crops the picture to its shape, so he chooses the part that must always show */}
                    {photos.length > 0 && (
                      <div className="mt-4 rounded-xl bg-soft/70 p-4">
                        <p className="text-sm font-bold">{p.focusTitle}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{p.focusNote}</p>
                        <div className="mt-3">
                          <FocusPicker image={photos[0]} value={focus} onChange={setFocus} disabled={demoActive()} labels={{ tall: p.shapeTall, square: p.shapeSquare, wide: p.shapeWide, center: p.focusCenter }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label id="p-price">{p.price} ({p.currency})</Label>
                      <input id="p-price" dir="ltr" inputMode="decimal" value={draft.price} onChange={(e) => set("price", digits(e.target.value))} placeholder="0.00" maxLength={10} className={`${field} h-12 text-start`} />
                      {errors.price && <p className="mt-1.5 text-xs text-rose-600">{errors.price}</p>}
                    </div>
                    <div>
                      <Label id="p-cost" hint={p.costHint}>{p.cost} ({p.currency})</Label>
                      <input id="p-cost" dir="ltr" inputMode="decimal" value={draft.cost} onChange={(e) => set("cost", digits(e.target.value))} placeholder="0.00" maxLength={10} className={`${field} h-12 text-start`} />
                    </div>
                    <div>
                      <Label id="p-sale" hint={p.saleHint}>{p.sale} ({p.currency})</Label>
                      <input id="p-sale" dir="ltr" inputMode="decimal" value={draft.sale} onChange={(e) => set("sale", digits(e.target.value))} placeholder="0.00" maxLength={10} className={`${field} h-12 text-start`} />
                      {errors.sale && <p className="mt-1.5 text-xs text-rose-600">{errors.sale}</p>}
                    </div>
                    <div>
                      <Label id="p-category">{p.category}</Label>
                      <input id="p-category" value={draft.category} onChange={(e) => set("category", e.target.value)} placeholder={p.categoryPh} maxLength={40} className={`${field} h-12`} />
                    </div>
                    <div>
                      <Label id="p-brand">{p.brand}</Label>
                      <input id="p-brand" value={draft.brand} onChange={(e) => set("brand", e.target.value)} placeholder={p.brandPh} maxLength={40} className={`${field} h-12`} />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label id="p-notes" hint={p.notesHint}>{p.notes}</Label>
                      <input id="p-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder={p.notesPh} maxLength={60} className={`${field} h-12`} />
                    </div>
                    <div>
                      <Label id="p-badge" hint={p.badgeHint}>{p.badge}</Label>
                      <input id="p-badge" value={draft.badge} onChange={(e) => set("badge", e.target.value)} placeholder={p.badgePh} maxLength={20} className={`${field} h-12`} />
                    </div>
                  </div>

                  <div>
                    <Label id="p-desc">{p.description}</Label>
                    <textarea id="p-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder={p.descriptionPh} rows={5} maxLength={2000} className={`${field} resize-y py-3`} />
                  </div>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6">
                  <h3 className="font-bold">{p.visibility}</h3>
                  <Toggle on={draft.hidden} onChange={(v) => set("hidden", v)} label={p.hidden} hint={p.hiddenHint} />
                  <Toggle on={draft.featured} onChange={(v) => set("featured", v)} label={p.featured} hint={p.featuredHint} />
                  <Toggle on={draft.shipping} onChange={(v) => set("shipping", v)} label={p.shipping} hint={p.shippingHint} />
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6">
                  <h3 className="font-bold">{p.stock}</h3>
                  <div className="max-w-xs">
                    <Label id="p-qty" hint={p.quantityHint}>{p.quantity}</Label>
                    <input id="p-qty" dir="ltr" inputMode="numeric" value={draft.quantity} onChange={(e) => set("quantity", latin(e.target.value).replace(/\D/g, ""))} maxLength={7} className={`${field} h-12 text-start`} />
                  </div>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6">
                  <h3 className="font-bold">{p.alerts}</h3>
                  <div>
                    <Label id="p-low" hint={p.lowAtHint}>{p.lowAt}</Label>
                    <input id="p-low" dir="ltr" inputMode="numeric" value={draft.lowAt} onChange={(e) => set("lowAt", latin(e.target.value).replace(/\D/g, ""))} maxLength={5} className={`${field} h-12 text-start`} />
                  </div>
                  <div>
                    <Label id="p-min" hint={p.restockMinHint}>{p.restockMin}</Label>
                    <input id="p-min" dir="ltr" inputMode="numeric" value={draft.restockMin} onChange={(e) => set("restockMin", latin(e.target.value).replace(/\D/g, ""))} maxLength={5} className={`${field} h-12 text-start`} />
                  </div>
                  <div>
                    <Label id="p-pct" hint={p.restockPctHint}>{p.restockPct} (%)</Label>
                    <input id="p-pct" dir="ltr" inputMode="numeric" value={draft.restockPct} onChange={(e) => set("restockPct", latin(e.target.value).replace(/\D/g, ""))} maxLength={3} className={`${field} h-12 text-start`} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-6">
                  <button type="submit" className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{p.save}</button>
                  <button type="button" onClick={() => setEditing(null)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>
                  {flash && <p role="status" className="text-sm font-semibold text-primary">{p.saved}</p>}

                  {typeof editing === "number" &&
                    (items.find((x) => x.id === editing)?.deletedAt ? (
                      confirmDelete ? (
                        <span className="ms-auto flex flex-wrap items-center gap-3">
                          <span className="text-sm text-rose-600">{p.foreverAsk}</span>
                          <button type="button" onClick={() => remove([editing])} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{p.foreverYes}</button>
                          <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>
                        </span>
                      ) : (
                        <span className="ms-auto flex flex-wrap gap-3">
                          <button type="button" onClick={() => restore([editing])} className="rounded-lg border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{p.restore}</button>
                          <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{p.deleteForever}</button>
                        </span>
                      )
                    ) : confirmDelete ? (
                      <span className="ms-auto flex flex-wrap items-center gap-3">
                        <span className="text-sm text-rose-600">{p.deleteAsk}</span>
                        <button type="button" onClick={() => trash([editing])} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">{p.deleteYes}</button>
                        <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="ms-auto rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{p.delete}</button>
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
