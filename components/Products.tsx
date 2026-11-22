"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { FILTER_KEYS, kindWords, productsCopy, type FilterKey } from "./productsContent";
import { SizesEditor } from "./SizesEditor";
import { usePrefs } from "./Prefs";
import { readPhoto } from "./designer/image";
import { demoActive } from "./demoSandbox";
import { nextProductId } from "./productIds";
import { FocusPicker } from "./FocusPicker";
import { cutKeptAs, ImageCropper } from "./ImageCropper";
import { keepPicture, uploadImage } from "./media";
import { onServer } from "./merchantApi";
import { MAX_COUNT, PRODUCT_MAX, cleanCategory, cleanProduct, productCategories, money, parseList, productProblems, typedCount, typedMoney, type Product, type SendBy } from "./records";
import { cleanLine, cleanLines, imageRules } from "./safe";
import { hasErrors, RequiredMark, RequiredNote } from "./Required";
import { RudeNote } from "./RudeNote";
import { StockChoice, stockNeedsAnswer, stockOverMax } from "./StockChoice";
import { Blocked } from "./designer/controls";
import { CardPeek, type PeekField } from "./CardPeek";
import { noPhotoHue, ProductPhoto } from "./storefront/NoPhoto";
import { PRODUCT_KINDS, kindHasSizes, kindShips, sizeName, sizeTwice, type ProductKind } from "./safeOrder";
import type { Lang } from "./content";
import { dropUndos, listUndo, offerUndo } from "./undo";
import { usePageTitle } from "./pageTitle";
import { Skeleton } from "./Skeleton";
import { leaveUnasked } from "./serverSync";



type Draft = {
  kind: ProductKind;
  /* clothing and shoes: each size and how many of it (typed, so a string) */
  sizes: { name: string; quantity: string }[];
  /* clothing and shoes: a picture of the size chart ("" none) */
  sizeChart: string;
  name: string;
  price: string;
  sale: string;
  cost: string;
  categories: string[];
  brand: string;
  description: string;
  notes: string;
  badge: string;
  quantity: string;
  /* the stock has no limit: the quantity is not asked */
  unlimited: boolean;
  hidden: boolean;
  featured: boolean;
  shipping: boolean;
  lowAt: string;
  restockMin: string;
  restockPct: string;
  lowBy: SendBy;
  restockBy: SendBy;
};

const KEY = "seen-products";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";

const blank: Draft = {
  kind: "standard",
  sizes: [],
  sizeChart: "",
  name: "",
  price: "",
  sale: "",
  cost: "",
  categories: [],
  brand: "",
  description: "",
  notes: "",
  badge: "",
  /* empty until he types how many he has: no made-up "1" */
  quantity: "",
  unlimited: false,
  hidden: false,
  featured: false,
  shipping: true,
  lowAt: "5",
  restockMin: "15",
  restockPct: "100",
  lowBy: "both",
  restockBy: "both",
};

/* An amount typed in a field: null when empty, NaN when it is not an amount Dukkan accepts (more than a million too) */
const num = (v: string) => (v.trim() === "" ? null : money(v) ?? NaN);
/* An amount of money as he types it: one dot, at most two decimals (fils), no extra zeros in front ("007" becomes "7") */
const digits = (v: string) => typedMoney(v);
/* A whole number as he types it: digits only, no extra zeros in front, and never above `max` */
const whole = (v: string, max?: number) => typedCount(v, max);

/** The stock to save for a product he edited: what he changed in the editor (each size on its own), added to the stock
    the product has now. Pieces sold (or given back) since the editor was opened, on the store or in another tab, stay
    counted, so his save never puts sold pieces back on sale. A size that is new or renamed gets what he typed, and a
    product that had no limit, or now has none, gets what he typed too. */
function stockSince(typed: { quantity: number; sizes: { name: string; quantity: number }[] }, opened: Product | null, now: Product | undefined) {
  if (!opened || !now) return typed;
  const keep = (n: number) => Math.max(0, Math.min(MAX_COUNT, n));
  if (typed.sizes.length) {
    const was = opened.sizes ?? [];
    const has = now.sizes ?? [];
    const key = (n: string) => n.toLowerCase();
    const sizes = typed.sizes.map((z) => {
      const a = was.find((x) => key(x.name) === key(z.name));
      const b = has.find((x) => key(x.name) === key(z.name));
      return a && b ? { ...z, quantity: keep(b.quantity + z.quantity - a.quantity) } : z;
    });
    return { quantity: sizes.reduce((n, z) => n + z.quantity, 0), sizes };
  }
  if (opened.unlimited || now.unlimited || (opened.sizes ?? []).length || (now.sizes ?? []).length) return typed;
  return { ...typed, quantity: keep(now.quantity + typed.quantity - opened.quantity) };
}

/* What is saved is checked again when it is read: storage can hold old, broken or hand-changed products */
function load(): Product[] {
  try {
    return parseList(localStorage.getItem(KEY), cleanProduct);
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
  /* a product with unlimited stock never sells out and never runs low */
  soldOut: (p) => !p.unlimited && p.quantity <= 0,
  forSale: (p) => !p.hidden && (p.unlimited || p.quantity > 0) && p.price !== null,
  uncategorized: (p) => p.categories.length === 0,
  shipping: (p) => p.shipping,
  nearSoldOut: (p) => !p.unlimited && p.quantity > 0 && p.quantity <= p.lowAt,
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


function Label({ id, children, hint, required = false, peek }: { id: string; children: React.ReactNode; hint?: string; required?: boolean; /* a "!" that shows where it lands on the store's product card */ peek?: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center">
        <label htmlFor={id} className="block text-sm font-semibold">
          {children}
          {required && <RequiredMark />}
        </label>
        {peek}
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* His own categories (بنطلون، جينز، تيشرت…): he makes them once and picks one or more for each product. Kept in this browser
   with the categories his products already have. */
const CATS = "seen-categories";

function loadCategories(products: Product[]): string[] {
  let saved: string[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(CATS) ?? "[]");
    if (Array.isArray(raw)) saved = raw.map(cleanCategory).filter(Boolean);
  } catch {
    /* none saved yet */
  }
  const used = products.filter((x) => !x.deletedAt).flatMap((x) => x.categories);
  return Array.from(new Set([...saved, ...used]));
}

/** The categories of a product: his categories as chips to pick (as many as he wants), a box to make a new one, and × only on
    the ones no product uses and that are not picked here, so a category in use can't be deleted */
function CategoryPicker({ value, onChange, onTyped, products, words }: { value: string[]; onChange: (v: string[]) => void; onTyped: (v: string) => void; products: Product[]; words: { catNewPh: string; catAdd: string; catNone: string; catRemove: string; catEmpty: string } }) {
  const [list, setList] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  useEffect(() => setList(loadCategories(products)), [products]);
  const keep = (next: string[]) => {
    setList(next);
    try {
      localStorage.setItem(CATS, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };
  const add = () => {
    const v = cleanCategory(typed);
    if (!v) return;
    if (!list.includes(v)) keep([...list, v]);
    /* a new category is picked for this product, with the ones already picked */
    if (!value.includes(v) && value.length < PRODUCT_MAX.categories) onChange([...value, v]);
    setTyped("");
    onTyped("");
  };
  const used = (c: string) => products.some((x) => !x.deletedAt && x.categories.includes(c));
  /* a category no product uses goes at once, with an Undo that puts it back where it was (if it isn't back already) */
  const drop = (c: string) => {
    const at = list.indexOf(c);
    keep(list.filter((x) => x !== c));
    offerUndo({
      scope: "products",
      label: (l) => productsCopy[l].undoCat(c),
      undo: () => {
        let saved: string[] = [];
        try {
          const raw = JSON.parse(localStorage.getItem(CATS) ?? "[]");
          if (Array.isArray(raw)) saved = raw.map(cleanCategory).filter(Boolean);
        } catch {
          /* none saved */
        }
        if (saved.includes(c)) return false;
        const back = [...saved.slice(0, at), c, ...saved.slice(at)];
        try {
          localStorage.setItem(CATS, JSON.stringify(back));
        } catch {
          return false;
        }
        setList((cur) => (cur.includes(c) ? cur : [...cur.slice(0, at), c, ...cur.slice(at)]));
        return true;
      },
    });
  };
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : value.length < PRODUCT_MAX.categories ? [...value, c] : value);
  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <p className="text-xs text-muted">{words.catNone}</p>
      ) : (
        <div role="group" className="flex flex-wrap gap-2">
          {/* the category is optional: "No category" (it clears the others) puts the product under "Other" in the store */}
          <span className={`inline-flex items-center rounded-full border border-dashed text-sm font-semibold transition ${value.length === 0 ? "border-ink bg-ink text-onink" : "border-fg/25 text-muted hover:bg-soft"}`}>
            <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className="px-4 py-1.5">{words.catEmpty}</button>
          </span>
          {list.map((c) => (
            <span key={c} className={`inline-flex items-center rounded-full border text-sm font-semibold transition ${value.includes(c) ? "border-ink bg-ink text-onink" : "border-fg/15 hover:bg-soft"}`}>
              <button type="button" aria-pressed={value.includes(c)} onClick={() => toggle(c)} className="inline-flex items-center gap-1.5 px-4 py-1.5">
                {value.includes(c) && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                {c}
              </button>
              {!used(c) && !value.includes(c) && (
                <button type="button" onClick={() => drop(c)} aria-label={`${words.catRemove}: ${c}`} title={words.catRemove} className="-ms-2 grid h-7 w-7 place-items-center rounded-full text-muted transition hover:text-rose-600">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          id="p-category"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); onTyped(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={words.catNewPh}
          maxLength={40}
          className={`${field} h-11 flex-1`}
        />
        <button type="button" onClick={add} disabled={!typed.trim()} className="h-11 shrink-0 rounded-xl border border-primary/60 px-5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-40">+ {words.catAdd}</button>
      </div>
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
  /* a big quantity (999 or more) he said is right */
  const [stockOk, setStockOk] = useState("");
  const [errors, setErrors] = useState<{ name?: string; price?: string; sale?: string; images?: string; quantity?: string; sizes?: string }>({});
  const [picked, setPicked] = useState<number[]>([]);
  /* only "Delete permanently" asks first: every other change shows an Undo at the bottom instead (UndoToast.tsx) */
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* the list as it is now, for an undo (it checks nothing changed since) and for changes made one after the other */
  const itemsNow = useRef<Product[]>([]);
  useEffect(() => {
    itemsNow.current = items;
  }, [items]);
  /* only this page can put its list back: its undos go when it closes */
  useEffect(() => () => dropUndos("products"), []);
  /** A change to the products: saved like any edit (the list is saved below), with an Undo that puts back exactly the
      products it changed, the same way, unless one of them changed again since. */
  const change = (next: Product[], label: (l: Lang) => string) => {
    const before = itemsNow.current;
    itemsNow.current = next;
    setItems(next);
    offerUndo({
      scope: "products",
      label,
      undo: listUndo({
        before,
        after: next,
        key: (x) => x.id,
        now: () => itemsNow.current,
        put: (list) => {
          const was = itemsNow.current;
          itemsNow.current = list;
          setItems(list);
          /* the editor does not stay open on a product the undo changed or took away */
          setEditing((e) => (typeof e === "number" && JSON.stringify(was.find((x) => x.id === e)) !== JSON.stringify(list.find((x) => x.id === e)) ? null : e));
        },
      }),
    });
  };
  const nameOf = (ids: number[], l: Lang) => itemsNow.current.find((x) => x.id === ids[0])?.name || productsCopy[l].untitled;
  /* the editor scrolls on its own on a wide screen; after saving (it closes) it goes back to its top */
  const editorBox = useRef<HTMLElement>(null);
  /* The product's photos: shrunk and saved with the product, so the store shows them */
  const [photos, setPhotos] = useState<string[]>([]);
  /* what went wrong with the last photos picked: a file refused ("bad"), or more than fit ("max") */
  const [photoBad, setPhotoBad] = useState<false | "bad" | "max">(false);
  /* photos still being read, and the ones that failed to show: neither counts as the product's photo */
  const [uploading, setUploading] = useState(0);
  /* which opening of the editor photos were picked in: a photo that finishes after another product (or a new one) was
     opened is dropped, not added to whichever product is open then */
  const photoRound = useRef(0);
  const [broken, setBroken] = useState<string[]>([]);
  /* a new category typed in the box but not added with its button yet */
  const typedCat = useRef("");
  /* the photo being cropped (the first photo has its own focus picker below) */
  const [cropAt, setCropAt] = useState<number | null>(null);
  /* the photo as it is being cropped, shown in its place right away (back to the old one on Cancel) */
  const [photoLive, setPhotoLive] = useState<string | null>(null);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const fileInput = useRef<HTMLInputElement>(null);
  /* the product as it was when the editor opened (null for a new one): its stock then, so a save keeps what sold since */
  const opened = useRef<Product | null>(null);
  /* The editor as it was when opened or last saved, to know if there are unsaved changes */
  const [clean, setClean] = useState("");
  const snapshot = (d: Draft, imgs: string[], f: { x: number; y: number }) => JSON.stringify([d, imgs, f]);
  const dirty = editing !== null && snapshot(draft, photos, focus) !== clean;

  usePageTitle(`${brandName(lang)} | ${p.title}`);

  /* the list as read from storage: not saved back (only a change he makes is), so opening the page on a device with an
     older copy never sends that copy over a newer one */
  const loadedList = useRef<Product[] | null>(null);
  useEffect(() => {
    const read = () => {
      const list = load();
      loadedList.current = list;
      setItems(list);
    };
    read();
    setReady(true);
    /* Another tab changed the products (or the store sold some): take its list, so this tab never writes back an old one */
    const onStorage = (e: StorageEvent) => e.key === KEY && read();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
    if (!ready || items === loadedList.current) return;
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
    const list = items.filter(test(filter)).filter((x) => !q || x.name.toLowerCase().includes(q) || x.categories.some((c) => c.toLowerCase().includes(q)) || x.brand.toLowerCase().includes(q));
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

  /* Unsaved changes are only thrown away after he says so, in the page's own box (never the browser's window): what he
     was about to do waits in `discardThen` until he answers */
  const [discardThen, setDiscardThen] = useState<(() => void) | null>(null);
  const leave = (then: () => void) => {
    if (!dirty) then();
    else setDiscardThen(() => then);
  };
  const keepRef = useRef<HTMLButtonElement>(null);
  /* "Keep editing" has the focus first, so Enter or a stray key never throws his changes away */
  useEffect(() => {
    if (discardThen) keepRef.current?.focus();
  }, [discardThen]);

  const openEdit = (x: Product) => {
    const d: Draft = {
      kind: x.kind ?? "standard",
      sizes: (x.sizes ?? []).map((z) => ({ name: z.name, quantity: String(z.quantity) })),
      sizeChart: x.sizeChart ?? "",
      name: x.name,
      price: x.price === null ? "" : String(x.price),
      sale: x.sale === null ? "" : String(x.sale),
      cost: x.cost === null ? "" : String(x.cost),
      categories: x.categories,
      brand: x.brand,
      description: x.description,
      notes: x.notes ?? "",
      badge: x.badge ?? "",
      quantity: String(x.quantity),
      unlimited: x.unlimited === true,
      hidden: x.hidden,
      featured: x.featured,
      shipping: x.shipping,
      lowAt: String(x.lowAt),
      lowBy: x.lowBy ?? "both",
      restockBy: x.restockBy ?? "both",
      restockMin: String(x.restockMin),
      restockPct: String(x.restockPct),
    };
    setEditing(x.id);
    opened.current = x;
    /* photos still on their way belong to the product they were picked for, never to this one */
    photoRound.current++;
    setUploading(0);
    setDraft(d);
    /* a quantity he saved before was already right */
    setStockOk(d.quantity);
    setErrors({});
    setConfirmDelete(false);
    setPhotos(x.images ?? []);
    setCropAt(null);
    setFocus(x.focus ?? { x: 50, y: 50 });
    setClean(snapshot(d, x.images ?? [], x.focus ?? { x: 50, y: 50 }));
    setPhotoBad(false);
    setBroken([]);
    typedCat.current = "";
  };

  const openNew = () => {
    setEditing("new");
    opened.current = null;
    photoRound.current++;
    setUploading(0);
    setDraft(blank);
    setStockOk("");
    setErrors({});
    setConfirmDelete(false);
    setPhotos([]);
    setCropAt(null);
    setFocus({ x: 50, y: 50 });
    setClean(snapshot(blank, [], { x: 50, y: 50 }));
    setPhotoBad(false);
    setBroken([]);
    typedCat.current = "";
  };

  const close = () => leave(() => setEditing(null));

  /* Escape closes the editor, asking first when there are unsaved changes */
  useEffect(() => {
    if (editing === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* with the "leave without saving?" box open, Escape answers "Keep editing" */
      if (discardThen) setDiscardThen(null);
      else if (!dirty) setEditing(null);
      else setDiscardThen(() => () => setEditing(null));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, dirty, discardThen]);

  /* The tab closing or reloading with unsaved changes: the browser asks first (a page can't show its own box then).
     Not when the page reloads itself on purpose or another tab signed out (serverSync.ts leaveUnasked). */
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaveUnasked()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* A signed-in store sends each photo to Dukkan's server (shrunk in the browser first, components/media.ts) and keeps its
     address. Signed out or in the tour, or when it can't be sent right now, it is shrunk to a small picture kept in this
     browser (so a few of them fit in its storage); the next save sends it. */
  const onePhoto = async (f: File): Promise<string | null> => {
    if (onServer()) {
      const up = await uploadImage(f, "product");
      if ("url" in up) return up.url;
      /* not a picture we take: no use trying again here */
      if (up.problem === "type" || up.problem === "size" || up.problem === "broken" || up.problem === "dimensions" || up.problem === "empty") return null;
    }
    return readPhoto(f, 900);
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    /* only as many as still fit (6, counting the ones on their way) are sent: picking 40 sends 6, not 40 */
    const room = Math.max(0, 6 - photos.length - uploading);
    const fits = Array.from(files).slice(0, room);
    const taken = fits.filter((f) => f.size <= imageRules.productPhoto.max);
    const round = photoRound.current;
    const n = taken.length;
    setUploading((u) => u + n);
    const made = await Promise.all(taken.map(onePhoto)).finally(() => {
      if (photoRound.current === round) setUploading((u) => Math.max(0, u - n));
    });
    /* another product was opened meanwhile: these photos are not its own */
    if (photoRound.current !== round) return;
    const ok = made.filter((u): u is string => !!u);
    if (ok.length) setErrors((x) => ({ ...x, images: undefined }));
    /* a file that is not a picture or is too big, and pictures past the 6 that fit, are reported, not dropped silently */
    setPhotoBad(ok.length < taken.length || taken.length < fits.length ? "bad" : fits.length < files.length ? "max" : false);
    setPhotos((cur) => [...cur, ...ok].slice(0, 6));
  };

  const kw = kindWords[lang];
  /* the "!" beside a field that shows on the product card: the card filled with what he typed */
  const peek = (f: PeekField) => <CardPeek lang={lang} field={f} values={{ name: draft.name, notes: draft.notes, badge: draft.badge, category: draft.categories[0] ?? typedCat.current, price: draft.price, sale: draft.sale, photo: photos[0], id: typeof editing === "number" ? editing : undefined }} />;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const price = num(draft.price);
    const sale = num(draft.sale);
    /* only the photos that are really there count: one still uploading or that failed to show does not */
    const shownPhotos = photos.filter((u) => !broken.includes(u));
    const quantity = draft.quantity.trim() === "" ? null : Number(draft.quantity);
    /* The name, the price, a photo and (unless it is unlimited) the quantity must be filled (the same rules the server
       will use). The category is optional: without one the store shows the product under "Other". */
    const sized = kindHasSizes(draft.kind);
    const sizes = draft.sizes.map((z) => ({ name: sizeName(z.name), quantity: Math.max(0, Math.floor(Number(z.quantity) || 0)) })).filter((z) => z.name);
    const bad = productProblems({ name: draft.name, price, sale, images: shownPhotos, quantity, unlimited: draft.unlimited, kind: draft.kind, sizes });
    if (bad.includes("name")) next.name = p.errName;
    if (bad.includes("images")) next.images = uploading > 0 ? p.imagesUploading : p.errImages;
    if (bad.includes("price")) next.price = p.errPrice;
    if (bad.includes("sale")) next.sale = p.errSale;
    if (bad.includes("sizes")) next.sizes = kw.errSizes;
    /* two sizes with the same name would leave one of them without its stock: each size needs its own name */
    else if (sized && sizeTwice(sizes)) next.sizes = kw.errSizesTwice(sizeTwice(sizes));
    /* above the limit the stock box says so itself (with "Make it unlimited"); the error only stops the save */
    if (!sized && stockOverMax(draft.unlimited, draft.quantity)) next.quantity = p.errQuantity;
    else if (bad.includes("quantity")) next.quantity = p.errQuantity;
    else if (!sized && stockNeedsAnswer(draft.unlimited, draft.quantity, stockOk)) next.quantity = p.errStockAsk;
    setErrors(next);
    /* the first field with a mistake comes into view with the cursor in it */
    const first = (["name", "images", "price", "sale", "sizes", "quantity"] as const).find((k) => next[k]);
    if (first) {
      const el = document.getElementById(first === "quantity" ? "p-qty" : `p-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }

    const base = {
      kind: draft.kind,
      /* only clothing and shoes keep sizes; their stock is all the sizes together and never "unlimited" */
      sizes: sized ? sizes : [],
      sizeChart: sized ? draft.sizeChart : "",
      name: cleanLine(draft.name, PRODUCT_MAX.name),
      price,
      sale,
      /* a cost that is not an amount is left out rather than saved wrong */
      cost: money(num(draft.cost)),
      /* a new category typed but not added with its button still counts; only spaces is no category */
      ...(() => {
        const categories = productCategories({ categories: [...draft.categories, typedCat.current] });
        return { categories, category: categories[0] ?? "" };
      })(),
      brand: cleanLine(draft.brand, PRODUCT_MAX.brand),
      description: cleanLines(draft.description, PRODUCT_MAX.description),
      notes: cleanLine(draft.notes, PRODUCT_MAX.notes),
      badge: cleanLine(draft.badge, PRODUCT_MAX.badge),
      quantity: sized ? sizes.reduce((n, z) => n + z.quantity, 0) : Math.max(0, Math.floor(Number(draft.quantity) || 0)),
      unlimited: sized ? false : draft.unlimited,
      hidden: draft.hidden,
      featured: draft.featured,
      shipping: kindShips(draft.kind) && draft.shipping,
      lowAt: Math.max(0, Math.floor(Number(draft.lowAt) || 0)),
      lowBy: draft.lowBy,
      restockBy: draft.restockBy,
      restockMin: Math.max(0, Math.floor(Number(draft.restockMin) || 0)),
      /* everyone who asked is told (the share was taken out of the form; kept in the record for the backend) */
      restockPct: 100,
      images: shownPhotos,
      focus,
    };

    const list = itemsNow.current;
    const name = base.name || p.untitled;
    if (editing === "new") {
      const id = nextProductId(list);
      change([{ id, created: Date.now(), ...base }, ...list], (l) => productsCopy[l].undoAdded(name));
    } else {
      /* the stock he typed, as a change from what the editor opened with: what sold meanwhile is not put back */
      const now = list.find((x) => x.id === editing);
      if (!base.unlimited) Object.assign(base, stockSince({ quantity: base.quantity, sizes: base.sizes }, opened.current, now));
      /* if the product was removed meanwhile (in another tab), his edits bring it back instead of being lost */
      change(
        now ? list.map((x) => (x.id === editing ? { ...x, ...base } : x)) : [{ id: editing as number, created: Date.now(), ...base }, ...list],
        (l) => productsCopy[l].undoEdited(name),
      );
    }
    /* saved: the editor closes and the first screen ("pick a product") comes back, with the note and its Undo below */
    setCropAt(null);
    setPhotoLive(null);
    setEditing(null);
    editorBox.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Deleting moves to "Deleted products" at once (nothing is lost, it can be restored from there), with an Undo */
  const trash = (ids: number[]) => {
    const list = itemsNow.current;
    const hit = ids.filter((id) => list.some((x) => x.id === id && !x.deletedAt));
    if (hit.length) {
      const at = Date.now();
      const name = nameOf(hit, lang);
      change(list.map((x) => (hit.includes(x.id) ? { ...x, deletedAt: at } : x)), (l) => productsCopy[l].undoBin(hit.length, name));
    }
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
    setConfirmDelete(false);
  };

  const restore = (ids: number[]) => {
    const list = itemsNow.current;
    const hit = ids.filter((id) => list.some((x) => x.id === id && x.deletedAt));
    if (hit.length) {
      const name = nameOf(hit, lang);
      change(list.map((x) => (hit.includes(x.id) ? { ...x, deletedAt: undefined } : x)), (l) => productsCopy[l].undoRestored(hit.length, name));
    }
    setPicked((cur) => cur.filter((id) => !ids.includes(id)));
    if (typeof editing === "number" && ids.includes(editing)) setEditing(null);
  };

  /* For good: it asks first (it can't be restored from "Deleted products"), then an Undo still puts it back for a moment */
  const remove = (ids: number[]) => {
    const list = itemsNow.current;
    const name = nameOf(ids, lang);
    change(list.filter((x) => !ids.includes(x.id)), (l) => productsCopy[l].undoForever(name));
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
          <button type="button" onClick={() => leave(openNew)} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {p.newProduct} </button>
        </div>

        {/* filters | list | editor; in Arabic the editor comes first, on the right, and the filters go to the left */}
        <div className={`grid items-start gap-5 ${lang === "ar" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)_16rem]" : "lg:grid-cols-[16rem_minmax(0,24rem)_minmax(0,1fr)]"}`}>
          {/* Filters */}
          <section className={`${card} overflow-hidden ${lang === "ar" ? "lg:order-3" : ""}`}>
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

            {/* still loading: rows of placeholders, not "No products yet" for a moment */}
            {!ready ? (
              <div className="space-y-3 px-5 py-5" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : shown.length === 0 ? (
              <div className="px-5 py-14 text-center">
                {/* "no match" only when something was searched: an empty filter (Deleted products) says what it holds */}
                <p className="font-bold">{items.length === 0 && filter !== "deleted" ? p.empty : query.trim() ? p.noMatch : filter === "deleted" ? p.binEmpty : p.noneHere}</p>
                {items.length === 0 && filter !== "deleted" && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{p.emptyHint}</p>}
                {items.length === 0 && filter !== "deleted" && (
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
                    <button type="button" onClick={() => x.id !== editing && leave(() => openEdit(x))} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                      {/* the store's own placeholder when there is no photo, so the product looks the same here as in the store */}
                      <ProductPhoto src={x.images?.[0]} hue={noPhotoHue(x.id)} className="h-12 w-12 shrink-0 rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span dir="auto" className="truncate text-sm font-semibold ltr:text-left rtl:text-right">{x.name}</span>
                          {x.hidden && <span className="shrink-0 rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-bold text-muted">{p.filters.hidden.split(" ").pop()}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {x.categories.join(lang === "ar" ? "، " : ", ") || p.otherCategory} · {x.unlimited ? p.unlimitedShort : x.quantity <= 0 ? p.soldOutShort : p.pieces(x.quantity)}
                        </span>
                        <span dir="ltr" className="mt-0.5 block text-start text-sm font-bold">
                          {x.price === null ? (
                            <span className="font-medium text-muted">{p.noPrice}</span>
                          ) : x.sale !== null ? (
                            <>
                              {fmt(x.sale)} <small className="font-semibold opacity-70">{p.currency}</small>{" "}
                              <s className="text-[13px] font-medium text-muted [text-decoration-thickness:1.5px]">{fmt(x.price)}</s>
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

          {/* Editor: on a wide screen it stays in view under the top bar and scrolls by itself, not the whole page */}
          <section ref={editorBox} className={`${card} p-5 sm:p-7 ${lang === "ar" ? "lg:order-first" : ""} lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain`}>
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

                {/* a thin line under every field, like the store designer */}
                <div className="space-y-5 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold">{p.basic}</h3>
                    <RequiredNote text={p.requiredNote} show={hasErrors(errors)} />
                  </div>
                  {/* what kind of product: it decides whether it has sizes and whether it is shipped */}
                  <div>
                    <Label id="p-kind" hint={kw.kindHint}>{kw.kind}</Label>
                    <div role="radiogroup" aria-label={kw.kind} className="grid gap-2 sm:grid-cols-2">
                      {PRODUCT_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={draft.kind === k}
                          onClick={() => setDraft((d) => ({ ...d, kind: k, shipping: !kindShips(k) ? false : !kindShips(d.kind) ? true : d.shipping, sizes: kindHasSizes(k) && kindHasSizes(d.kind) && k !== d.kind ? [] : d.sizes }))}
                          className={`rounded-xl border px-3.5 py-2.5 text-start transition ${draft.kind === k ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-fg/15 hover:bg-soft"}`}
                        >
                          <span className="block text-sm font-bold">{kw.names[k]}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{kw.about[k]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label id="p-name" required>{p.name}</Label>
                    <input id="p-name" required aria-invalid={!!errors.name} value={draft.name} onChange={(e) => { set("name", e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }} placeholder={p.namePh} maxLength={80} className={`${field} h-12 ${errors.name ? bad : ""}`} />
                    {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
                    <RudeNote lang={lang} text={draft.name} />
                  </div>

                  <div>
                    <p id="p-images-label" className="mb-2 text-sm font-semibold">{p.images}<RequiredMark /></p>
                    <div role="group" aria-labelledby="p-images-label" aria-describedby={errors.images ? "p-images-err" : undefined} className={`grid grid-cols-3 gap-3 rounded-xl sm:grid-cols-4 ${errors.images ? "ring-2 ring-rose-500 ring-offset-4 ring-offset-card" : ""}`}>
                      {photos.map((u, i) => (
                        <div key={u} className="group relative aspect-square overflow-hidden rounded-xl bg-soft ring-1 ring-fg/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={i === cropAt && photoLive ? photoLive : u} alt="" onError={() => setBroken((b) => (b.includes(u) ? b : [...b, u]))} onLoad={() => setBroken((b) => b.filter((x) => x !== u))} className="h-full w-full object-cover" />
                          {broken.includes(u) && <span className="absolute inset-0 grid place-items-center bg-rose-600/80 p-1 text-center text-[10px] font-bold leading-tight text-white">{p.imageBroken}</span>}
                          {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{p.primary}</span>}
                          {i > 0 && !demoActive() && (
                            <button type="button" onClick={() => setCropAt(i)} className="absolute bottom-1.5 start-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                              {lang === "ar" ? "قصّ" : "Crop"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setCropAt(null); setPhotos((cur) => cur.filter((x) => x !== u)); }}
                            aria-label={p.removeImage}
                            className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition focus:opacity-100 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                          </button>
                        </div>
                      ))}
                      {photos.length + uploading < 6 && (
                        <button
                          id="p-images"
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          aria-invalid={!!errors.images}
                          aria-describedby={errors.images ? "p-images-err" : undefined}
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
                    {cropAt !== null && photos[cropAt] && (
                      <div className="mt-3">
                        <ImageCropper lang={lang} src={photos[cropAt]} shapes={["square", "tall", "wide", "original"]} out={900} type="image/jpeg" onLive={setPhotoLive} onCancel={() => { setCropAt(null); setPhotoLive(null); }} onDone={(url) => { const at = cropAt; setPhotos((cur) => cur.map((x, j) => (j === at ? url : x))); setCropAt(null); setPhotoLive(null); void keepPicture(url, "product").then((kept) => { if (kept === url) return; cutKeptAs(url, kept); setPhotos((cur) => cur.map((x) => (x === url ? kept : x))); }); }} />
                      </div>
                    )}
                    <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
                    {errors.images && <p id="p-images-err" role="alert" className="mt-2 text-xs font-semibold text-rose-600">{errors.images}</p>}
                    <p className={`mt-2 text-xs ${photoBad ? "text-rose-600" : "text-muted"}`}>{photoBad === "max" ? p.imagesMax : photoBad ? p.imagesBad : uploading > 0 ? p.imagesUploading : p.imagesHint}</p>

                    {/* What stays visible: the store crops the picture to its shape, so he chooses the part that must always show */}
                    {photos.length > 0 && (
                      <div className="mt-4 rounded-xl bg-soft/70 p-4">
                        <p className="text-sm font-bold">{p.focusTitle}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{p.focusNote}</p>
                        <div className="mt-3">
                          <FocusPicker image={cropAt === 0 && photoLive ? photoLive : photos[0]} value={focus} onChange={setFocus} disabled={demoActive()} labels={{ tall: p.shapeTall, square: p.shapeSquare, wide: p.shapeWide, center: p.focusCenter, zoom: lang === "ar" ? "تكبير (قصّ أقرب)" : "Zoom (crop closer)" }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 [&>div]:border-b-2 [&>div]:border-fg/20 [&>div]:pb-5 [&>div]:flex [&>div]:flex-col">
                    <div>
                      <Label id="p-price" required>{p.price} ({p.currency})</Label>
                      <input id="p-price" required aria-invalid={!!errors.price} dir="ltr" inputMode="decimal" value={draft.price} onChange={(e) => { set("price", digits(e.target.value)); if (errors.price) setErrors((x) => ({ ...x, price: undefined })); }} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start ${errors.price ? bad : ""}`} />
                      {errors.price && <p className="mt-1.5 text-xs text-rose-600">{errors.price}</p>}
                      {/* Zero is allowed, but may be a slip */}
                      {!errors.price && draft.price !== "" && Number(draft.price) === 0 && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{p.priceZero}</p>}
                    </div>
                    <div>
                      <Label id="p-cost" hint={p.costHint}>{p.cost} ({p.currency})</Label>
                      <input id="p-cost" dir="ltr" inputMode="decimal" value={draft.cost} onChange={(e) => set("cost", digits(e.target.value))} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start`} />
                      {/* a soft warning, it still saves: the cost is more than he sells it for */}
                      {num(draft.cost) !== null && num(draft.price) !== null && (num(draft.cost) as number) > (num(draft.sale) ?? (num(draft.price) as number)) && <p role="status" className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">{p.costAbove}</p>}
                    </div>
                    <div>
                      <Label id="p-sale" hint={p.saleHint} peek={peek("sale")}>{p.sale} ({p.currency})</Label>
                      <input id="p-sale" aria-invalid={!!errors.sale} dir="ltr" inputMode="decimal" value={draft.sale} onChange={(e) => { set("sale", digits(e.target.value)); if (errors.sale) setErrors((x) => ({ ...x, sale: undefined })); }} placeholder="0.00" maxLength={10} className={`mt-auto ${field} h-12 text-start ${errors.sale ? bad : ""}`} />
                      {errors.sale && <p className="mt-1.5 text-xs text-rose-600">{errors.sale}</p>}
                      {/* zero is allowed (the product is given free, and the store says so), but may be a slip for "no sale" */}
                      {!errors.sale && draft.sale !== "" && Number(draft.sale) === 0 && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{p.saleZero}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <Label id="p-category" hint={p.catHint} peek={peek("category")}>{p.category}</Label>
                      <CategoryPicker value={draft.categories} products={items} words={p} onChange={(v) => set("categories", v)} onTyped={(v) => { typedCat.current = v; }} />
                      <RudeNote lang={lang} text={draft.categories.join(" ")} />
                    </div>
                    <div>
                      <Label id="p-brand">{p.brand}</Label>
                      <input id="p-brand" value={draft.brand} onChange={(e) => set("brand", e.target.value)} placeholder={p.brandPh} maxLength={40} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.brand} />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 [&>div]:border-b-2 [&>div]:border-fg/20 [&>div]:pb-5 [&>div]:flex [&>div]:flex-col">
                    <div>
                      <Label id="p-notes" hint={p.notesHint} peek={peek("notes")}>{p.notes}</Label>
                      <input id="p-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder={p.notesPh} maxLength={60} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.notes} />
                    </div>
                    <div>
                      <Label id="p-badge" hint={p.badgeHint} peek={peek("badge")}>{p.badge}</Label>
                      <input id="p-badge" value={draft.badge} onChange={(e) => set("badge", e.target.value)} placeholder={p.badgePh} maxLength={20} className={`mt-auto ${field} h-12`} />
                      <RudeNote lang={lang} text={draft.badge} />
                    </div>
                  </div>

                  <div>
                    <Label id="p-desc">{p.description}</Label>
                    <textarea id="p-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder={p.descriptionPh} rows={5} maxLength={2000} className={`${field} resize-y py-3`} />
                    <RudeNote lang={lang} text={draft.description} />
                  </div>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <h3 className="font-bold">{p.visibility}</h3>
                  <Toggle on={draft.hidden} onChange={(v) => set("hidden", v)} label={p.hidden} hint={p.hiddenHint} />
                  <Toggle on={draft.featured} onChange={(v) => set("featured", v)} label={p.featured} hint={p.featuredHint} />
                  <Blocked when={!kindShips(draft.kind)} why={kw.shipOff(kw.names[draft.kind])}>
                    <Toggle on={draft.shipping} onChange={(v) => set("shipping", v)} label={p.shipping} hint={p.shippingHint} />
                  </Blocked>
                </div>

                <div className="space-y-5 border-t border-fg/10 pt-6 [&>div:not(.grid):not(:last-child)]:border-b-2 [&>div:not(.grid):not(:last-child)]:border-fg/20 [&>div:not(.grid):not(:last-child)]:pb-5">
                  <h3 className="font-bold">{p.stock}</h3>
                  {/* clothing and shoes: each size with its own quantity; the other kinds one quantity. Only the one that applies shows (not the other greyed out) */}
                  {kindHasSizes(draft.kind) ? (
                  <div>
                    <SizesEditor lang={lang} kind={draft.kind} sizes={draft.sizes} chart={draft.sizeChart} onChart={(v) => set("sizeChart", v)} error={errors.sizes} inputClass={field} onChange={(sizes) => { set("sizes", sizes); if (errors.sizes) setErrors((x) => ({ ...x, sizes: undefined })); }} />
                  </div>
                  ) : (
                  <div>
                    <StockChoice
                      lang={lang}
                      unlimited={draft.unlimited}
                      quantity={draft.quantity}
                      okFor={stockOk}
                      onUnlimited={(v) => { set("unlimited", v); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      onQuantity={(v) => { set("quantity", whole(v)); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      onConfirm={(q) => { setStockOk(q); if (errors.quantity) setErrors((x) => ({ ...x, quantity: undefined })); }}
                      inputId="p-qty"
                      inputClass={`${field} ${errors.quantity ? bad : ""}`}
                      error={errors.quantity}
                      required
                      neutral={!kindShips(draft.kind)}
                    />
                  </div>
                  )}
                </div>

                {/* the notifications (low stock, back in stock) were taken out until they work; the saved values keep their defaults */}

                <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-6">
                  <button type="submit" className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep">{p.save}</button>
                  <button type="button" onClick={close} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{p.cancel}</button>

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
                    ) : (
                      /* to "Deleted products" at once, like "Delete selected": the note at the bottom has its Undo */
                      <button type="button" onClick={() => trash([editing])} className="ms-auto rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{p.delete}</button>
                    ))}
                </div>
              </form>
            )}
          </section>
        </div>
      </main>

      {/* leaving the product with changes not saved: asked in the page (the dashboard never uses the browser's own windows) */}
      {discardThen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setDiscardThen(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="discard-ask" className="dash my-8 w-full max-w-md rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <p id="discard-ask" className="text-base font-bold leading-relaxed">{p.discardAsk}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button ref={keepRef} type="button" onClick={() => setDiscardThen(null)} className="h-11 flex-1 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">{p.discardKeep}</button>
              <button
                type="button"
                onClick={() => {
                  const then = discardThen;
                  setDiscardThen(null);
                  then();
                }}
                className="h-11 flex-1 rounded-xl border border-rose-500/50 px-6 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10"
              >
                {p.discardYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
