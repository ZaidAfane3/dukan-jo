"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brandName } from "./content";
import { DashboardBar } from "./DashboardBar";
import { usePrefs } from "./Prefs";
import { PreviewEye, PreviewWindow } from "./ThemePopup";
import { ThemePreview } from "./ThemePreview";
import { themeWords } from "./themesContent";
import { useCatalog } from "./catalog";
import { buyTheme, isFeatured, isFreeTheme, loadThemeState, storeThemes, type ThemeInfo, type ThemeState } from "./themes";

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10 sm:p-7";

export const priceText = (n: number, lang: "en" | "ar", free: string) => (n === 0 ? free : `${n.toFixed(2)} ${lang === "ar" ? "د.أ" : "JOD"}`);

const methods = [
  { key: "card", logo: "/logos/visa.png", h: "h-5" },
  { key: "cliq", logo: "/logos/cliq-tight.png", h: "h-7" },
  { key: "paypal", logo: "/logos/paypal.png", h: "h-5" },
] as const;

/* A small eye beside a theme's name: it opens the theme in a new tab, as a whole store, to look at */
export function ThemeStore() {
  const { lang } = usePrefs();
  const w = themeWords[lang];
  const [state, setState] = useState<ThemeState>({ owned: [], custom: [], active: "" });
  const [buying, setBuying] = useState<ThemeInfo | null>(null);
  const [previewing, setPreviewing] = useState<ThemeInfo | null>(null);
  /* the list Dukkan's staff run from Diwan (what is in the store, its order and prices) */
  useCatalog();

  useEffect(() => {
    document.title = `${brandName(lang)} | ${w.store.title}`;
  }, [lang, w]);
  useEffect(() => setState(loadThemeState()), []);
  /* Opened from the designer on one theme (?theme=lamma): that theme is brought into view and marked for a moment */
  const [focus, setFocus] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("theme");
    if (!id) return;
    setFocus(id);
    const t1 = window.setTimeout(() => document.getElementById(`theme-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    const t2 = window.setTimeout(() => setFocus(""), 4000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="domain" subtabs={[w.store.title]} activeSub={0} />

      <main data-lang-fade className="mx-auto max-w-[1100px] space-y-6 px-5 py-8 md:px-10">
        <div>
          <h1 className="text-xl font-extrabold">{w.store.title}</h1>
          <p className="mt-1 text-sm text-muted">{w.store.sub}</p>
        </div>

        {/* only the themes in the store now (Diwan: live), in the store's order; one taken out (hidden) is not listed */}
        {storeThemes().map((t) => {
          /* a free design (Mada) is every merchant's already: no checkout, it waits in My themes */
          const free = isFreeTheme(t.id);
          const owned = free || state.owned.some((o) => o.id === t.id);
          return (
            <section key={t.id} id={`theme-${t.id}`} className={`${card} grid scroll-mt-24 items-start gap-7 transition-shadow duration-700 lg:grid-cols-[1.1fr_1fr] ${focus === t.id ? "!ring-2 !ring-primary shadow-xl" : ""}`}>
              {/* Pressing the picture opens the preview, like the Preview button */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${w.store.preview}: ${t.name[lang]}`}
                onClick={() => setPreviewing(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewing(t);
                  }
                }}
                className="group/prev relative block cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <ThemePreview theme={t} height={560} />
                <span className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center opacity-0 transition-opacity duration-300 group-hover/prev:opacity-100 group-focus-visible/prev:opacity-100">
                  <span className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-onink shadow-lg">{w.store.preview}</span>
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex flex-wrap gap-2">
                  {isFeatured(t.id) && <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">{w.store.featured}</span>}
                  {t.tags.map((x) => (
                    <span key={x.en} className="rounded-full bg-soft px-3 py-1 text-xs font-bold text-deep dark:text-primary">{x[lang]}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <h2 className="text-2xl font-extrabold">{t.name[lang]}</h2>
                  <PreviewEye onOpen={() => setPreviewing(t)} />
                </div>
                <p className="mt-1 font-semibold text-primary">{t.tagline[lang]}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t.about[lang]}</p>

                {t.features.length > 0 && <p className="mt-5 text-sm font-bold">{w.store.inside}</p>}
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  {t.features.map((f) => (
                    <li key={f.en} className="flex items-start gap-2">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4 10-10" /></svg>
                      {f[lang]}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">{w.store.photosNote}</p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {owned ? (
                    <>
                      <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">{free ? w.store.freeOwned : w.store.owned}</span>
                      <Link href="/themes/mine" className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold leading-[2.75rem] text-onink transition hover:bg-deep">{w.store.goMine}</Link>
                    </>
                  ) : (
                    <button type="button" onClick={() => setBuying(t)} className="h-11 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep">
                      {w.store.buy} · <span dir="ltr">{priceText(t.price, lang, w.store.free)}</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setPreviewing(t)} className="h-11 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{w.store.preview}</button>
                </div>
              </div>
            </section>
          );
        })}

        <p className="text-center text-sm text-muted">{w.store.more}</p>
      </main>

      {previewing && <PreviewWindow theme={previewing} onClose={() => setPreviewing(null)} />}

      {buying && (
        <Checkout
          theme={buying}
          onClose={() => setBuying(null)}
          onDone={() => {
            buyTheme(buying);
            setState(loadThemeState());
          }}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose, label, wide = false }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} className={`dash w-full rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10 ${wide ? "max-w-5xl" : "max-w-md"}`}>
        {children}
      </div>
    </div>
  );
}

/* The checkout. Prototype: it asks for nothing and takes nothing; it only adds the theme to My themes. */
function Checkout({ theme, onClose, onDone }: { theme: ThemeInfo; onClose: () => void; onDone: () => void }) {
  const { lang } = usePrefs();
  const w = themeWords[lang];
  const [method, setMethod] = useState<(typeof methods)[number]["key"]>("card");
  const [step, setStep] = useState<"pick" | "paying" | "done">("pick");

  const pay = () => {
    setStep("paying");
    setTimeout(() => {
      onDone();
      setStep("done");
    }, 1200);
  };

  return (
    <Modal onClose={step === "paying" ? () => {} : onClose} label={w.checkout.title}>
      {step === "done" ? (
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4 10-10" /></svg>
          </span>
          <h2 className="mt-4 text-lg font-bold">{w.checkout.doneTitle}</h2>
          <p className="mt-2 text-sm text-muted">{lang === "en" ? <><b className="text-fg">{theme.name.en}</b> </> : <><b className="text-fg">{theme.name.ar}</b>: </>}{w.checkout.doneBody}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <Link href="/themes/mine" className="h-11 flex-1 rounded-xl bg-ink px-4 text-center text-sm font-semibold leading-[2.75rem] text-onink transition hover:bg-deep">{w.store.goMine}</Link>
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft">{w.checkout.close}</button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold">{w.checkout.title}</h2>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-soft px-4 py-3">
            <span className="font-semibold">{theme.name[lang]}</span>
            <span dir="ltr" className="font-extrabold">{priceText(theme.price, lang, w.store.free)}</span>
          </div>

          <p className="mt-5 text-sm font-semibold">{w.checkout.method}</p>
          <div className="mt-2 space-y-2" role="radiogroup" aria-label={w.checkout.method}>
            {methods.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={method === m.key} disabled={step === "paying"} onClick={() => setMethod(m.key)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition ${method === m.key ? "border-primary bg-primary/10" : "border-fg/15 hover:bg-soft"}`}>
                <span className="text-sm font-semibold">{w.checkout.methods[m.key]}</span>
                <span className="grid h-9 w-20 place-items-center rounded-lg bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.logo} alt="" className={`${m.h} w-auto max-w-[70%] object-contain`} />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-fg/10 pt-4">
            <span className="text-sm text-muted">{w.checkout.total}</span>
            <span dir="ltr" className="text-lg font-extrabold">{priceText(theme.price, lang, w.store.free)}</span>
          </div>
          <p className="mt-3 text-xs text-muted">{w.checkout.note}</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" onClick={pay} disabled={step === "paying"} className="h-11 flex-1 rounded-xl bg-ink px-4 text-sm font-semibold text-onink transition hover:bg-deep disabled:cursor-wait disabled:opacity-60">
              {step === "paying" ? w.checkout.paying : <>{w.checkout.pay} · <span dir="ltr">{priceText(theme.price, lang, w.store.free)}</span></>}
            </button>
            <button type="button" onClick={onClose} disabled={step === "paying"} className="h-11 flex-1 rounded-xl border border-fg/20 px-4 text-sm font-semibold transition hover:bg-soft disabled:opacity-40">{w.mine.cancel}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
