"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import {
  STATUS_KEYS,
  defaultInvoice,
  invoiceCopy,
  invoiceWords,
  ordersCopy,
  type InvoiceSettings,
  type Pos,
  type StatusKey,
} from "./ordersContent";
import { usePrefs } from "./Prefs";
import { pickPicture } from "./designer/image";
import { ImageCropper } from "./ImageCropper";
import { imageRules, uploadProblemText, type UploadProblem } from "./safe";
import { cleanInvoice, taxNumber } from "./records";
import { loadSetup } from "./setup";
import { LogoMark, onColor, resolveLogo } from "./storefront/parts";
import { loadConfig } from "./storefront/storage";
import type { LogoConfig } from "./storefront/config";

const KEY = "seen-invoice";
const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

function load(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    /* every saved setting is checked again: a broken one goes back to its default */
    return raw ? cleanInvoice(JSON.parse(raw)) : defaultInvoice;
  } catch {
    return defaultInvoice;
  }
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Radio({ checked, onChange, label, name }: { checked: boolean; onChange: () => void; label: string; name: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="grid h-5 w-5 place-items-center rounded-full border border-fg/30 transition peer-checked:border-primary peer-checked:[&>span]:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
        <span className="h-2.5 w-2.5 scale-0 rounded-full bg-primary transition" />
      </span>
      {label}
    </label>
  );
}

function Slider({ label, value, onChange, id }: { label: string; value: number; onChange: (v: number) => void; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-muted">{label}</label>
      <div dir="ltr" className="flex items-center gap-4">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          aria-label={label}
          className="h-10 w-16 rounded-lg border border-fg/15 bg-card text-center text-sm outline-none focus:border-primary"
        />
        <span className="text-xs font-bold">0</span>
        <input id={id} type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--primary))]" />
        <span className="text-xs font-bold">100</span>
      </div>
    </div>
  );
}

function PosPicker({ value, onChange, labels, name, vertical }: { value: Pos; onChange: (p: Pos) => void; labels: Record<Pos, string>; name: string; vertical: "top" | "bottom" }) {
  const align: Record<Pos, string> = { left: "justify-start", center: "justify-center", right: "justify-end" };
  return (
    <div className="flex flex-wrap gap-3">
      {(["right", "center", "left"] as Pos[]).map((p) => (
        <label key={p} className="cursor-pointer text-center text-xs">
          <input type="radio" name={name} checked={value === p} onChange={() => onChange(p)} className="peer sr-only" />
          <span dir="ltr" className={`flex h-16 w-16 rounded-lg border bg-white p-1.5 transition peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/30 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 border-fg/20 ${vertical === "top" ? "items-start" : "items-end"} ${align[p]}`}>
            <span className="h-3 w-3 rounded-sm bg-zinc-300" />
          </span>
          <span className={`mt-1 block ${value === p ? "font-bold text-primary" : "text-muted"}`}>{labels[p]}</span>
        </label>
      ))}
    </div>
  );
}

function ImagePick({ title, copy, url, onPick, choose }: { title: string; copy: { drop: string; dropHint: string; choose: string; remove: string }; url: string; onPick: (u: string) => void; choose?: string }) {
  const { lang } = usePrefs();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  /* the chosen picture, waiting to be cropped */
  const [pending, setPending] = useState("");
  const take = async (f?: File) => {
    if (!f) return;
    const picked = await pickPicture(f, imageRules.invoice, 1600, "image/png");
    setProblem("problem" in picked ? picked.problem : null);
    if ("url" in picked) setPending(picked.url);
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {pending && <ImageCropper lang={lang} src={pending} shapes={["original", "square", "wide"]} out={800} onCancel={() => setPending("")} onDone={(u) => { setPending(""); onPick(u); }} />}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${over ? "border-primary bg-primary/5" : "border-fg/20"}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-16 w-auto max-w-[10rem] rounded object-contain" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" />
          </svg>
        )}
        <p className="text-sm font-semibold">{copy.drop}</p>
        <p className="max-w-sm text-xs text-muted">{copy.dropHint}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{choose ?? copy.choose}</button>
          {url && (
            <button type="button" onClick={() => { URL.revokeObjectURL(url); onPick(""); }} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{copy.remove}</button>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {problem && <p role="alert" className="mt-2 text-xs text-rose-600">{uploadProblemText[problem][lang]}</p>}
    </div>
  );
}

function FontRow({ title, bold, color, onBold, onColor, copy, name }: { title: string; bold: boolean; color: string; onBold: (b: boolean) => void; onColor: (c: string) => void; copy: { bold: string; regular: string; colorLabel: string }; name: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Radio name={name} checked={bold} onChange={() => onBold(true)} label={copy.bold} />
        <Radio name={name} checked={!bold} onChange={() => onBold(false)} label={copy.regular} />
        <label className="flex items-center gap-3 rounded-xl border border-fg/15 px-3 py-2 text-sm">
          <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label={`${title}: ${copy.colorLabel}`} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
          <span dir="ltr" className="font-mono text-xs uppercase text-muted">{color}</span>
        </label>
      </div>
    </div>
  );
}

function StatusPicker({ value, onChange, copy, labels }: { value: StatusKey[]; onChange: (v: StatusKey[]) => void; copy: { pickStatuses: string; search: string }; labels: Record<StatusKey, string> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const list = STATUS_KEYS.filter((k) => labels[k].toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (k: StatusKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${field} flex h-12 items-center justify-between gap-2 text-start`}>
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {value.length === 0 ? (
            <span className="text-muted/70">{copy.pickStatuses}</span>
          ) : (
            value.map((k) => <span key={k} className="rounded-md bg-fg/10 px-2 py-0.5 text-xs font-semibold">{labels[k]}</span>)
          )}
        </span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-fg/15">
          <div className="p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.search} aria-label={copy.search} className={`${field} h-10`} />
          </div>
          <ul className="max-h-64 divide-y divide-fg/10 overflow-y-auto border-t border-fg/10">
            {list.map((k) => (
              <li key={k} className="px-4 py-3">
                <Check checked={value.includes(k)} onChange={() => toggle(k)} label={labels[k]} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- The sample invoice ---------------- */

function Barcode() {
  const bars = useMemo(() => Array.from({ length: 34 }, (_, i) => ((i * 7 + 3) % 5) + 1), []);
  return (
    <span dir="ltr" aria-hidden className="flex h-5 items-stretch gap-[1px]">
      {bars.map((w, i) => <span key={i} className="bg-black" style={{ width: w * 0.6 }} />)}
    </span>
  );
}

function Preview({ s, watermark, stamp, store }: { s: InvoiceSettings; watermark: string; stamp: string; store: string }) {
  const w = invoiceWords[s.invoiceLang];
  const rtl = s.invoiceLang === "ar";
  const title = s.titleMode === "custom" && s.customTitle.trim() ? s.customTitle.trim() : w.title;
  const shop = s.storeName.trim() || store;
  const main = { color: s.primaryColor, fontWeight: s.primaryBold ? 700 : 400 };
  const sub = { color: s.secondaryColor, fontWeight: s.secondaryBold ? 700 : 400 };
  const jc: Record<Pos, string> = { right: rtl ? "justify-start" : "justify-end", center: "justify-center", left: rtl ? "justify-end" : "justify-start" };
  const logo = 22 + s.logoSize * 0.5;
  /* The store's own logo: the one set in the store designer, or the picture uploaded in setup, or its first letter in the store color */
  const [mark, setMark] = useState<{ logo: LogoConfig; color: string } | null>(null);
  useEffect(() => {
    const setup = loadSetup();
    setMark({ logo: resolveLogo(loadConfig().identity.logo, setup?.logo ?? ""), color: setup?.color || "#004956" });
  }, []);
  const money = (n: number) => `${n.toFixed(2)} ${w.cur}`;
  /* The sample order: tax is 16% of the products, then shipping is added on top */
  const subtotal = 30;
  const shipping = 3;
  const tax = Math.round(subtotal * 0.16 * 100) / 100;
  const grand = subtotal + shipping + tax;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="store-preview relative overflow-hidden bg-white p-5 text-[11px] leading-5 text-black">
      {watermark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={watermark} alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-2/3 -translate-x-1/2 -translate-y-1/2 object-contain" style={{ opacity: s.watermarkOpacity / 100 * 0.5 }} />
      )}
      <div className="relative">
        <div className={`flex ${jc[s.logoPos]}`}>
          <div className="text-center">
            {mark ? (
              <span className="mx-auto block" style={{ width: logo, height: logo, fontSize: logo * 0.45, ["--sf-primary" as string]: mark.color, ["--sf-on" as string]: onColor(mark.color) }}>
                <LogoMark logo={mark.logo} name={shop} className="h-full w-full rounded-xl" />
              </span>
            ) : (
              <span className="mx-auto grid place-items-center rounded-full bg-primary font-extrabold text-white" style={{ width: logo, height: logo, fontSize: logo * 0.45 }}>{shop.charAt(0)}</span>
            )}
            <p className="mt-1 text-sm" style={{ ...main, color: "#9ca3af" }}>{title}</p>
          </div>
        </div>
        <hr className="my-3 border-black" />

        <div style={sub} className="space-y-0.5">
          <p>{w.no}: <span dir="ltr">#33</span></p>
          <p>{w.orderNo}: <span dir="ltr">42723324</span></p>
          <p>{w.date}: <span dir="ltr">2026-10-19</span></p>
        </div>
        <hr className="my-3 border-black" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-semibold underline" style={main}>{w.to}</p>
            <p style={sub}>{w.customer}</p>
            {s.address && <p style={sub}>{w.address}</p>}
            {s.receiver && <p style={sub}>{w.receiver}: {w.receiverName}</p>}
          </div>
          <div>
            <p className="font-semibold underline" style={main}>{w.from}</p>
            <p style={sub}>{shop}</p>
            {s.taxNumber && <p style={sub}>{w.taxNo}: <span dir="ltr">{s.taxNumber}</span></p>}
            {s.address && <p style={sub}>{w.storeAddress}: {w.address}</p>}
          </div>
        </div>
        <hr className="my-3 border-black/40" />

        <div className="grid grid-cols-2 gap-3" style={sub}>
          <div>
            <p className="font-semibold" style={{ ...main, color: "#9ca3af" }}>{w.shipping}</p>
            <p>{w.carrier}: {w.carrier1}</p>
            <p>{w.weight}: <span dir="ltr">0.4 {w.kg}</span></p>
            <p>{w.eta}: {w.etaVal}</p>
          </div>
          <div>
            <p className="font-semibold" style={{ ...main, color: "#9ca3af" }}>{w.payment}</p>
            <p>{w.amount}: <span dir="ltr">{money(grand)}</span></p>
            <p>{w.method}: {w.method1}</p>
          </div>
        </div>

        <div className="mt-3 flex bg-zinc-200 px-2 py-1 font-semibold" style={main}>
          <span className="flex-1">{w.product}</span>
          <span className="w-10 text-center">{w.qty}</span>
          <span className="w-16 text-center">{w.price}</span>
          <span className="w-16 text-end">{w.sum}</span>
        </div>
        <div className="flex items-start gap-2 px-2 py-2" style={sub}>
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {s.image && <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded bg-zinc-800 text-white">S</span>}
            <div className="min-w-0">
              <p style={main}>{w.product1}</p>
              {s.description && <p>{w.desc}</p>}
              {s.barcode && <Barcode />}
            </div>
          </div>
          <span className="w-10 text-center">1</span>
          <span className="w-16 text-center" dir="ltr">{money(subtotal)}</span>
          <span className="w-16 text-end" dir="ltr">{money(subtotal)}</span>
        </div>

        {s.summary && (
          <div className="mt-1 divide-y divide-black/20 border-y border-black/20">
            {[
              [w.sub, money(subtotal), true],
              [w.ship, `+ ${money(shipping)}`, false],
              [w.tax, `+ ${money(tax)}`, true],
              [w.grand, money(grand), false],
            ].map(([k, v, shade], i) => (
              <p key={i} className={`flex justify-between px-2 py-1.5 ${shade ? "bg-zinc-100" : ""}`} style={i === 3 ? main : sub}>
                <span>{k}</span>
                <span dir="ltr">{v}</span>
              </p>
            ))}
            {s.zeroTax && (
              <p className="flex justify-between px-2 py-1.5" style={sub}>
                <span>{w.tax.replace("16%", "0%")}</span>
                <span dir="ltr">{money(0)}</span>
              </p>
            )}
          </div>
        )}
        {s.orderBarcode && <div className="mt-3 flex justify-center"><Barcode /></div>}

        <div className="mt-4 grid grid-cols-2 gap-3" style={sub}>
          {s.contact && (
            <div>
              <p className="font-semibold" style={main}>{w.contact}</p>
              <p>{shop}</p>
              <p dir="ltr" className={rtl ? "text-end" : ""}>+962 7X XXX XXXX</p>
            </div>
          )}
          {s.notes && (
            <div>
              <p className="font-semibold" style={main}>{w.notes}</p>
              <p>{w.orderNote}</p>
            </div>
          )}
        </div>

        {s.policy && (
          <div className="mt-3" style={sub}>
            <p className="font-semibold" style={main}>{w.returns}</p>
            <p>{w.returnsText}</p>
          </div>
        )}

        {stamp && (
          <div className={`mt-4 flex ${jc[s.stampPos]}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stamp} alt="" className="h-16 w-auto max-w-[8rem] object-contain" style={{ opacity: s.stampOpacity / 100 }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export function Invoices() {
  const { lang } = usePrefs();
  const c = invoiceCopy[lang];
  const o = ordersCopy[lang];

  const [saved, setSaved] = useState<InvoiceSettings>(defaultInvoice);
  const [s, setS] = useState<InvoiceSettings>(defaultInvoice);
  const [store, setStore] = useState("");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  /* Images are only used in this preview. They are never stored or sent. */
  const [watermark, setWatermark] = useState("");
  const [stamp, setStamp] = useState("");

  useEffect(() => {
    document.title = `${brandName(lang)} | ${c.title}`;
  }, [lang, c]);

  useEffect(() => {
    const l = load();
    setSaved(l);
    setS(l);
    setStore(loadSetup()?.name ?? "");
    setReady(true);
  }, []);

  const dirty = ready && JSON.stringify(s) !== JSON.stringify(saved);
  const set = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  const save = () => {
    /* saved the way it is read back: cleaned, so what he sees is what was kept */
    const kept = cleanInvoice(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(kept));
    } catch {
      /* storage unavailable */
    }
    setS(kept);
    setSaved(kept);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const shopName = store || brandName(lang);
  const previewCopy = { ...c };
  void previewCopy;

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="orders" subtabs={o.tabs} subHrefs={["/orders", "/orders/invoices"]} activeSub={1} />

      <main data-lang-fade className="mx-auto max-w-[1720px] px-5 py-8 md:px-10">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="space-y-5">
            <section className={card}>
              <h2 className="font-bold">{c.issueTitle}</h2>

              <div className="mt-5 space-y-6">
                <div>
                  <p className="text-sm font-semibold">{c.invoiceTitle}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.invoiceTitleHint}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <Radio name="title-mode" checked={s.titleMode === "default"} onChange={() => set("titleMode", "default")} label={c.titleDefault} />
                    <Radio name="title-mode" checked={s.titleMode === "custom"} onChange={() => set("titleMode", "custom")} label={c.titleCustom} />
                  </div>
                  {s.titleMode === "custom" && (
                    <input value={s.customTitle} onChange={(e) => set("customTitle", e.target.value)} placeholder={c.customPh} maxLength={30} aria-label={c.invoiceTitle} className={`${field} mt-3 h-11`} />
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold">{c.language}</p>
                  <div className="flex gap-6">
                    <Radio name="inv-lang" checked={s.invoiceLang === "ar"} onChange={() => set("invoiceLang", "ar")} label={c.langs[0]} />
                    <Radio name="inv-lang" checked={s.invoiceLang === "en"} onChange={() => set("invoiceLang", "en")} label={c.langs[1]} />
                  </div>
                </div>

                <div>
                  <label htmlFor="inv-store" className="text-sm font-semibold">{c.storeName}</label>
                  <p className="mt-0.5 text-xs text-muted">{c.storeNameHint}</p>
                  <input id="inv-store" value={s.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder={shopName} maxLength={50} className={`${field} mt-3 h-11`} />
                </div>

                <div>
                  <label htmlFor="inv-tax" className="text-sm font-semibold">{c.taxNumber}</label>
                  <p className="mt-0.5 text-xs text-muted">{c.taxNumberHint}</p>
                  <input id="inv-tax" dir="ltr" inputMode="numeric" value={s.taxNumber} onChange={(e) => set("taxNumber", taxNumber(e.target.value))} maxLength={15} className={`${field} mt-3 h-11 text-start`} />
                </div>
              </div>
            </section>

            {c.groups.map((g, gi) => (
              <section key={g.title} className={card}>
                <h2 className="font-bold">{g.title}</h2>
                <div className="mt-5 space-y-4">
                  {g.rows.map((r) => (
                    <Check key={r.key} checked={s[r.key] as boolean} onChange={(v) => set(r.key, v as never)} label={r.label} hint={r.hint} />
                  ))}
                  {gi === 1 && (
                    <div className="pt-2">
                      <p className="text-sm font-semibold">{c.sendWhen}</p>
                      <p className="mb-3 mt-0.5 text-xs text-muted">{c.sendWhenHint}</p>
                      <StatusPicker value={s.sendStatuses} onChange={(v) => set("sendStatuses", v)} copy={c} labels={o.statuses} />
                    </div>
                  )}
                </div>
              </section>
            ))}

            <section className={card}>
              <h2 className="font-bold">{c.design}</h2>
              <div className="mt-5 space-y-6">
                <Slider id="logo-size" label={c.logoSize} value={s.logoSize} onChange={(v) => set("logoSize", v)} />
                <div>
                  <p className="mb-2 text-sm font-semibold">{c.logoPos}</p>
                  <PosPicker name="logo-pos" value={s.logoPos} onChange={(p) => set("logoPos", p)} labels={c.positions} vertical="top" />
                </div>
                <FontRow name="font-1" title={c.primaryFont} bold={s.primaryBold} color={s.primaryColor} onBold={(b) => set("primaryBold", b)} onColor={(x) => set("primaryColor", x)} copy={c} />
                <FontRow name="font-2" title={c.secondaryFont} bold={s.secondaryBold} color={s.secondaryColor} onBold={(b) => set("secondaryBold", b)} onColor={(x) => set("secondaryColor", x)} copy={c} />
                <ImagePick title={c.watermark} copy={c} url={watermark} onPick={setWatermark} choose={c.chooseWatermark} />
                <Slider id="wm-opacity" label={c.opacity} value={s.watermarkOpacity} onChange={(v) => set("watermarkOpacity", v)} />
                <ImagePick title={c.stamp} copy={c} url={stamp} onPick={setStamp} choose={c.chooseStamp} />
                <Slider id="stamp-opacity" label={c.opacity} value={s.stampOpacity} onChange={(v) => set("stampOpacity", v)} />
                <div>
                  <p className="mb-2 text-sm font-semibold">{c.stampPos}</p>
                  <PosPicker name="stamp-pos" value={s.stampPos} onChange={(p) => set("stampPos", p)} labels={c.positions} vertical="bottom" />
                </div>
              </div>
            </section>

            <section className={`${card} flex flex-wrap items-center gap-4`}>
              <button type="button" onClick={save} disabled={!dirty} className="h-11 rounded-xl bg-ink px-8 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40">{c.save}</button>
              {flash ? <p role="status" className="text-sm font-semibold text-primary">{c.saved}</p> : dirty ? <p className="text-sm text-muted">{c.unsaved}</p> : null}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-fg/10">
              <div className="mb-3 flex">
                <button
                  type="button"
                  onClick={() => { setS(defaultInvoice); if (watermark) URL.revokeObjectURL(watermark); if (stamp) URL.revokeObjectURL(stamp); setWatermark(""); setStamp(""); }}
                  className="rounded-lg border border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                >
                  {c.reset}
                </button>
              </div>
              <p className="mb-3 rounded-xl bg-soft px-4 py-3 text-xs">{c.sampleNote}</p>
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto rounded-lg">
                <Preview s={s} watermark={watermark} stamp={stamp} store={shopName} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
