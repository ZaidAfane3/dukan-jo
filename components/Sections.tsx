"use client";

import { commercialRegistration, registrationWords } from "./legal";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./Nav";
import { FlagJO } from "./Flag";
import { LangSwitch, industries as industryCopy, usePrefs } from "./Prefs";
import { brandName, content } from "./content";
import { SeenShipMark } from "./SeenShip";
import { Reveal, Tilt, Typed } from "./ui";

const cta = "rounded-xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep";

/* ---------- Industries ---------- */
const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

/* Own simple line icons, same order as the copy in Prefs.tsx */
const industryIcons = [
  svg(<><path d="M9 3h6l1 5-4 2-4-2 1-5Z" /><path d="M8 8c-1 4-2 8-3 13h14c-1-5-2-9-3-13" /></>),
  svg(<><rect x="3" y="6" width="18" height="12" rx="4" /><path d="M8 10v4M6 12h4M16 11h.01M18 13h.01" /></>),
  svg(<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z" />),
  svg(<><rect x="3" y="5" width="18" height="11" rx="2" /><path d="M8 20h8M12 16v4" /></>),
  svg(<><path d="M6 4h12l3 5-9 11L3 9l3-5Z" /><path d="M3 9h18M9 4l3 16M15 4l-3 16" /></>),
  svg(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></>),
  svg(<><path d="M5 11h14a0 0 0 0 1 0 0 7 7 0 0 1-7 7 7 7 0 0 1-7-7Z" /><path d="M9 3c0 2 2 2 2 4M13 3c0 2 2 2 2 4M8 21h8" /></>),
  svg(<><path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" /><path d="M2 12a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v6H2v-6Z" /><path d="M5 18v2M19 18v2" /></>),
];

export function Industries() {
  const [active, setActive] = useState(0);
  const [canNext, setCanNext] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const { lang, t } = usePrefs();
  const items = industryCopy[lang];
  const rtl = lang === "ar";

  /* True while there are more cards beyond the visible edge. */
  const updateEdge = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const remaining = el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft);
    setCanNext(remaining > 8);
  }, []);

  useEffect(() => {
    updateEdge();
    window.addEventListener("resize", updateEdge);
    return () => window.removeEventListener("resize", updateEdge);
  }, [updateEdge, lang]);

  const next = () => {
    const el = scroller.current;
    if (!el) return;
    /* In RTL, scrollLeft is negative and "next" moves toward the left. */
    el.scrollBy({ left: (rtl ? -1 : 1) * 320, behavior: "smooth" });
  };

  return (
    <section id="industries" className="mx-auto max-w-6xl px-5 py-20">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{t.industriesTitle}</h2>
      </Reveal>
      <div className="relative mt-10">
        <div
          ref={scroller}
          onScroll={updateEdge}
          className={`flex gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            canNext ? "[mask-image:linear-gradient(to_right,#000_82%,transparent)] rtl:[mask-image:linear-gradient(to_left,#000_82%,transparent)]" : ""
          }`}
        >
          {items.map((ind, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              className={`flex w-44 shrink-0 flex-col items-center gap-4 rounded-3xl border px-4 py-7 text-base font-semibold transition-all duration-300 sm:w-52 ${
                active === i
                  ? "border-ink bg-ink text-white shadow-lg"
                  : "border-primary/25 bg-card hover:-translate-y-1 hover:border-primary"
              }`}
            >
              <span className={`scale-125 ${active === i ? "text-white" : "text-primary"}`}>{industryIcons[i]}</span>
              <span className="text-center leading-snug">{ind.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={next}
          aria-label={rtl ? "التالي" : "Next"}
          tabIndex={canNext ? 0 : -1}
          className={`absolute end-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-primary/20 text-primary shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-primary hover:text-white ${
            canNext ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
      <p key={`${active}-${lang}`} className="mt-8 animate-[fadeIn_0.5s_ease] text-center text-lg text-muted">
        {items[active].blurb}
      </p>
    </section>
  );
}

/* ---------- Buying experience: three cards in a horizontal row ---------- */
function Tile({ children }: { children: React.ReactNode }) {
  return (
    <Tilt max={20}>
      <div className="relative grid h-[21rem] place-items-center rounded-[2rem] bg-soft p-6" style={{ transformStyle: "preserve-3d" }}>
        {/* Soft shadow on the "floor" under the raised card */}
        <div className="absolute bottom-8 h-6 w-44 rounded-full bg-ink/20 blur-xl" style={{ transform: "translateZ(5px)" }} />
        <div
          className="w-full max-w-[19rem] rounded-2xl bg-card p-5 shadow-[0_30px_60px_-20px_rgba(0,73,86,0.45)]"
          style={{ transform: "translateZ(55px)" }}
        >
          {children}
        </div>
      </div>
    </Tilt>
  );
}

function LoginMock() {
  const { lang } = usePrefs();
  const m = content[lang].experience.login;
  return (
    <Tile>
      <p className="text-center text-lg font-bold tracking-wide">{m.brand}</p>
      <p className="mt-3 text-center text-sm font-semibold">{m.title}</p>
      <p className="mt-4 text-xs text-muted">{m.label}</p>
      <div dir="ltr" className="mt-1.5 flex items-center overflow-hidden rounded-md border border-fg/25 text-xs">
        <span dir="ltr" className="border-e border-fg/15 px-2.5 py-2.5 font-semibold">{m.code}</span>
        <span dir="ltr" className="flex-1 px-2.5 py-2.5 text-muted/70">{m.placeholder}</span>
      </div>
      <div className="mt-3 rounded-md bg-ink py-2.5 text-center text-xs font-semibold text-white">{m.button}</div>
      <p className="mt-3 text-center text-[11px] text-muted">{m.link}</p>
    </Tile>
  );
}

/**
 * A white badge with a payment logo from /public/logos. Until the logo file
 * is there it shows a plain text version, so nothing looks broken.
 */
function FileLogo({ src, fallback, imgClass = "max-h-[58%] max-w-[74%] object-contain", box = "h-8 w-14" }: { src: string; fallback: React.ReactNode; imgClass?: string; box?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setOk(true);
    probe.src = src;
  }, [src]);
  return (
    <span className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10`} dir="ltr">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={imgClass} />
      ) : (
        fallback
      )}
    </span>
  );
}

/** Dukkan's own pictogram for cash on delivery: a banknote handed to an open palm. */
function CashHandIcon() {
  return (
    <span className="grid h-8 w-14 shrink-0 place-items-center rounded-lg bg-white text-primary shadow-sm ring-1 ring-black/10">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <g transform="rotate(-14 14 7)">
          <rect x="8" y="2.5" width="12" height="7.5" rx="1.3" />
          <circle cx="14" cy="6.25" r="1.7" />
        </g>
        <path d="M3 14.5h3l3.4 1.8h4.9c1.2 0 1.8 1.4.8 2.1L13 19.6H9L3 18.2" />
      </svg>
    </span>
  );
}

function VisaLogo({ box, imgClass }: { box?: string; imgClass?: string }) {
  return (
    <FileLogo
      src="/logos/visa.png"
      box={box}
      imgClass={imgClass}
      fallback={<span className={`${box ? "text-base" : "text-xs"} font-black italic tracking-tight text-[#1a1f71]`}>VISA</span>}
    />
  );
}

function PayLogo({ index }: { index: number }) {
  if (index === 0) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <VisaLogo />
      </span>
    );
  }
  if (index === 1) {
    return (
      <FileLogo
        src="/logos/applepay.png"
        fallback={<span className="text-[10px] font-bold text-black">Apple Pay</span>}
      />
    );
  }
  if (index === 2) {
    return <FileLogo src="/logos/cliq.png" fallback={<span className="text-xs font-extrabold tracking-tight text-[#141923]">CliQ</span>} />;
  }
  return <CashHandIcon />;
}

function PayMock() {
  const { lang } = usePrefs();
  const m = content[lang].experience.pay;
  return (
    <Tile>
      <p className="text-sm font-semibold">{m.title}</p>
      <ul className="mt-3 space-y-2">
        {m.options.map((o, i) => (
          <li key={o} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium ${i === 0 ? "border-primary bg-primary/10" : "border-fg/15"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full border ${i === 0 ? "border-primary" : "border-fg/30"}`}>
              {i === 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <PayLogo index={i} />
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-md bg-ink py-2.5 text-center text-xs font-semibold text-white">{m.button}</div>
    </Tile>
  );
}

function TrackMock() {
  const { lang } = usePrefs();
  const m = content[lang].experience.track;
  const done = 3;
  return (
    <Tile>
      <p className="text-sm font-semibold">{m.title}</p>
      <p className="mt-1 text-[11px] text-muted">{m.order}</p>
      <ol className="mt-4 space-y-3">
        {m.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-xs">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${i < done ? "bg-primary text-white" : "border border-fg/25 text-transparent"}`}>✓</span>
            <span className={i < done ? "font-semibold" : "text-muted"}>{step}</span>
          </li>
        ))}
      </ol>
    </Tile>
  );
}

export function Experience() {
  const { lang } = usePrefs();
  const c = content[lang].experience;
  const mocks = [<LoginMock key="l" />, <PayMock key="p" />, <TrackMock key="t" />];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{c.title}</h2>
      </Reveal>
      {/* A horizontal row: swipeable on phones, three across on larger screens. */}
      <div className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible">
        {mocks.map((mock, i) => (
          <Reveal key={i} delay={i * 0.12} className="w-[78%] shrink-0 snap-center sm:w-[55%] md:w-auto">
            <figure className="text-center">
              {mock}
              <figcaption className="mx-auto mt-12 max-w-[16rem] text-xl font-bold leading-snug">{c.captions[i]}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Feature rows ---------- */
function MockCard({ index }: { index: number }) {
  const hues = ["from-[#73e7cb] to-[#348d9c]", "from-[#96edd9] to-[#4a9e8a]", "from-[#348d9c] to-[#004956]", "from-[#f7f1ea] to-[#d9c9b5]", "from-[#c1fdf6] to-[#73e7cb]", "from-[#4a9e8a] to-[#004956]"];
  const hue = hues[index % hues.length];
  return (
    <Tilt max={20} className="mx-auto w-full max-w-md">
      <div className="relative aspect-[4/3] w-full" style={{ transformStyle: "preserve-3d" }}>
        {/* Back plate, pushed behind */}
        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${hue} opacity-30`} style={{ transform: "translateZ(-40px) translate(18px, 18px)" }} />
        {/* Main card */}
        <div
          className="absolute inset-0 rounded-3xl bg-card p-5 shadow-[0_35px_70px_-25px_rgba(0,73,86,0.45)]"
          style={{ transform: "translateZ(10px)", transformStyle: "preserve-3d" }}
        >
          <div className="mb-4 flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          {/* Raised image block */}
          <div className={`h-24 rounded-xl bg-gradient-to-br ${hue} shadow-lg`} style={{ transform: "translateZ(38px)" }} />
          <div className="mt-4 space-y-2" style={{ transform: "translateZ(18px)" }}>
            <div className="h-3 w-3/4 rounded-full bg-soft" />
            <div className="h-3 w-1/2 rounded-full bg-soft" />
            <div className="h-3 w-2/3 rounded-full bg-soft" />
          </div>
        </div>
        {/* Floating badge, closest to the viewer */}
        <div
          className={`absolute -top-4 end-6 grid h-12 w-12 place-items-center rounded-2xl text-lg font-bold shadow-xl ${index === 3 ? "" : "bg-primary text-white"}`}
          style={{ transform: "translateZ(85px)" }}
        >
          {index === 3 ? <SeenShipMark className="h-12 w-12" /> : "✓"}
        </div>
      </div>
    </Tilt>
  );
}

/* The payments feature gets its own picture: a store wallet card, a payments list,
   a small summary panel and the payment methods floating in front. */
const payText = {
  en: {
    panel: "Dukkan payments",
    paid: "Paid",
    cod: "Cash on delivery (COD)",
    methods: ["Visa", "Apple Pay", "CliQ", "Cash on delivery (COD)"],
  },
  ar: {
    panel: "مدفوعات دكان",
    paid: "مدفوعة",
    cod: "الدفع عند الاستلام",
    methods: ["فيزا", "ابل باي", "كليك", "الدفع عند الاستلام"],
  },
};

function PaymentsMock() {
  const { lang } = usePrefs();
  const t = payText[lang];
  const cur = lang === "ar" ? "د.أ" : "JOD";
  const rows = [
    { logo: <VisaLogo />, name: t.methods[0], date: "19/10/2026", amount: "1,250" },
    { logo: <PayLogo index={1} />, name: t.methods[1], date: "18/10/2026", amount: "350" },
    { logo: <PayLogo index={2} />, name: t.methods[2], date: "17/10/2026", amount: "620" },
    { logo: <PayLogo index={3} />, name: t.methods[3], date: "16/10/2026", amount: "180" },
  ];
  return (
    <Tilt max={20} className="mx-auto w-full max-w-lg">
      <div className="relative aspect-[5/3.8] w-full" style={{ transformStyle: "preserve-3d" }}>
        <div className="absolute inset-x-0 bottom-0 top-[25%] rounded-3xl bg-gradient-to-br from-[#73e7cb] to-[#348d9c] opacity-30" style={{ transform: "translateZ(-45px) translate(18px, 18px)" }} />

        {/* Payments list */}
        <div className="absolute inset-x-0 bottom-[8%] top-[25%] rounded-3xl bg-card p-4 pt-[17%] shadow-[0_35px_70px_-25px_rgba(0,73,86,0.45)]" style={{ transform: "translateZ(8px)", transformStyle: "preserve-3d" }}>
          <div className="mb-3 space-y-1.5">
            <div className="h-2 w-16 rounded-full bg-primary/50" />
            <div className="h-2 w-10 rounded-full bg-soft" />
          </div>
          <ul className="space-y-3" style={{ transform: "translateZ(14px)" }}>
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-3 text-[11px]">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] text-white">✓</span>
                {r.logo}
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span dir="ltr" className="hidden text-muted sm:block">{r.date}</span>
                <span dir="ltr" className="font-bold">{r.amount} <small className="font-semibold opacity-70">{cur}</small></span>
              </li>
            ))}
          </ul>
        </div>

        {/* Summary panel */}
        <div className="absolute end-[0%] top-[2%] w-[50%] rounded-2xl bg-card p-4 shadow-2xl" style={{ transform: "translateZ(78px)" }}>
          <p className="text-sm font-bold">{t.panel}</p>
          {[
            { k: t.paid, v: "2,000", icon: <path d="M4 8h16v11H4zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16" /> },
            { k: t.cod, v: "450", icon: <path d="M6 8h12l1 12H5L6 8ZM9 8a3 3 0 0 1 6 0" /> },
          ].map((r) => (
            <p key={r.k} className="mt-3 flex items-center gap-2.5 text-[11px]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-deep dark:text-primary">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{r.icon}</svg>
              </span>
              <span className="min-w-0 flex-1 font-medium">{r.k}</span>
              <span dir="ltr" className="font-bold">{r.v} <small className="font-semibold opacity-70">{cur}</small></span>
            </p>
          ))}
        </div>

        {/* Amount received with Apple Pay */}
        <div className="absolute start-[0%] top-[1%] flex w-[42%] items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-xl" style={{ transform: "translateZ(100px)" }}>
          <span dir="ltr" className="text-sm font-bold text-deep dark:text-primary">30,000 <small className="text-[10px] font-semibold opacity-70">{cur}</small></span>
          <PayLogo index={1} />
        </div>

        {/* Methods floating closest to the viewer */}
        <div className="absolute bottom-[0%] start-[6%] flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-xl" style={{ transform: "translateZ(96px)" }}>
          <FileLogo src="/logos/cliq.png" box="h-9 w-20" imgClass="max-h-[62%] max-w-[78%] object-contain" fallback={<span className="text-sm font-extrabold tracking-tight text-[#141923]">CliQ</span>} />
        </div>
        <div className="absolute end-[6%] top-[60%] flex items-center rounded-2xl bg-card px-3 py-2 shadow-xl" style={{ transform: "translateZ(120px)" }}>
          <FileLogo
            src="/logos/paypal.png"
            box="h-9 w-20" imgClass="max-h-[62%] max-w-[78%] object-contain"
            fallback={
              <span className="text-base font-black italic tracking-tight">
                <span className="text-[#253b80]">Pay</span>
                <span className="text-[#179bd7]">Pal</span>
              </span>
            }
          />
        </div>
        <div className="absolute bottom-[1%] end-[6%] flex items-center rounded-2xl bg-card px-3 py-2 shadow-xl" style={{ transform: "translateZ(100px)" }}>
          <VisaLogo box="h-9 w-20" imgClass="max-h-[62%] max-w-[78%] object-contain" />
        </div>
      </div>
    </Tilt>
  );
}

/* Shipping feature picture: the map of Jordan with Dukkan Ship showing up in its main
   cities. A random city lights up every moment, like orders being picked up. The
   map outline is a transparent PNG used as a mask, so it takes the brand colors. */
const MAP = { w: 374, h: 422, ox: 125, oy: 23 }; /* size and offset of the cropped map image */
const fleetCities = [
  { x: 205, y: 106, en: "Irbid", ar: "إربد" },
  { x: 207, y: 164, en: "Amman", ar: "عمّان" },
  { x: 187, y: 146, en: "Salt", ar: "السلط" },
];

function FleetMap() {
  const { lang } = usePrefs();
  const [active, setActive] = useState(1);
  const [delays] = useState(() => fleetCities.map(() => (Math.random() * 2.4).toFixed(2)));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setActive((a) => {
        let n = a;
        while (n === a) n = Math.floor(Math.random() * fleetCities.length);
        return n;
      });
    }, 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <Tilt max={20} className="mx-auto w-full max-w-md">
      <div className="relative aspect-[4/4.3] w-full" style={{ transformStyle: "preserve-3d" }}>
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#73e7cb] to-[#348d9c] opacity-30" style={{ transform: "translateZ(-45px) translate(18px, 18px)" }} />

        <div className="absolute inset-0 rounded-3xl bg-card shadow-[0_35px_70px_-25px_rgba(0,73,86,0.45)]" style={{ transform: "translateZ(8px)", transformStyle: "preserve-3d" }}>
          {/* The map */}
          <div className="absolute inset-y-[7%] start-1/2 aspect-[374/422] -translate-x-1/2 rtl:translate-x-1/2" style={{ transformStyle: "preserve-3d" }}>
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-[#d4d4d8] to-[#8b8b92]"
              style={{
                WebkitMaskImage: "url(/maps/jordan.png)",
                maskImage: "url(/maps/jordan.png)",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                transform: "translateZ(14px)",
              }}
            />

            {/* Dukkan Ship in each city */}
            {fleetCities.map((c, i) => {
              const left = ((c.x - MAP.ox) / MAP.w) * 100;
              const top = ((c.y - MAP.oy) / MAP.h) * 100;
              const on = i === active;
              return (
                <span
                  key={c.en}
                  className="absolute"
                  style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%, -50%) translateZ(${on ? 70 : 46}px)`, transition: "transform 0.5s" }}
                >
                  <span aria-hidden className="absolute inset-0 -m-1 animate-ping rounded-full bg-primary/50" style={{ animationDelay: `${delays[i]}s`, animationDuration: "2.4s" }} />
                  <span className={`relative grid place-items-center rounded-full bg-card shadow-lg ring-2 transition-all duration-500 ${on ? "h-8 w-8 ring-primary" : "h-5 w-5 ring-white/70"}`}>
                    <SeenShipMark className={on ? "h-6 w-6" : "h-[14px] w-[14px]"} />
                  </span>
                  <span
                    className={`pointer-events-none absolute right-full top-1/2 me-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-bold text-onink shadow-xl transition-all duration-500 ${on ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
                    style={{ marginRight: 8 }}
                  >
                    {lang === "ar" ? c.ar : c.en}
                  </span>
                </span>
              );
            })}
          </div>

        </div>

        {/* Brand tag floating in front */}
        <div className="absolute start-[4%] top-[3%] flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-xl" style={{ transform: "translateZ(96px)" }}>
          <SeenShipMark className="h-7 w-7" />
          <span className="text-xs font-extrabold">{lang === "ar" ? "شحن دكان" : "Dukkan Ship"}</span>
        </div>
      </div>
    </Tilt>
  );
}

/* Small icons in front of the payments bullet points. */
const payIcons = [
  <path key="c" d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 10h18M7 15h3" />,
  <path key="b" d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />,
  <g key="t"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.500 1.500M9 3h6" /></g>,
  <g key="s"><path d="M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></g>,
];

export function Features() {
  const { lang, t } = usePrefs();
  const c = content[lang];
  return (
    <section className="mx-auto max-w-6xl space-y-28 px-5 py-10">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{c.featuresTitle}</h2>
      </Reveal>
      {c.features.map((f, i) => (
        <div key={f.id} id={f.id} className={`grid items-center gap-12 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
          <Reveal y={40}>
            {f.id === "payments" ? <PaymentsMock /> : f.id === "shipping" ? <FleetMap /> : <MockCard index={i} />}
          </Reveal>
          <Reveal delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-full bg-soft px-4 py-1.5 text-sm font-bold text-deep dark:text-primary">
              {f.tag}
              {f.id === "payments" && (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{payIcons[0]}</svg>
              )}
            </span>
            <Typed as="h3" text={f.title} speed={50} className="mt-5 text-3xl font-extrabold tracking-tight" />
            <Typed as="p" text={f.body} speed={22} className="mt-3 text-muted" />
            <ul className="mt-6 space-y-3">
              {f.points.map((p, j) => (
                <li key={p} className="flex items-start gap-3 font-medium">
                  {f.id === "payments" ? (
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{payIcons[j % payIcons.length]}</svg>
                  ) : (
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] text-white">✓</span>
                  )}
                  {p}
                </li>
              ))}
            </ul>
            <a href="/signup" className={`${cta} mt-8 inline-block`}>{t.start}</a>
          </Reveal>
        </div>
      ))}
    </section>
  );
}

/* ---------- Testimonials (placeholder quotes) ---------- */
/* Each quote card is a little 3D stack: a shadow slab behind, the card, then the
   quote mark and the store tag floating in front. Moving the mouse tilts it. */
const skins = [
  { card: "bg-card ring-1 ring-fg/10", text: "text-fg", muted: "text-muted", mark: "text-primary", slab: "bg-primary/15" },
  { card: "bg-ink", text: "text-onink", muted: "text-onink/70", mark: "text-primary", slab: "bg-ink/30" },
  { card: "bg-primary/10 ring-1 ring-primary/30", text: "text-fg", muted: "text-muted", mark: "text-deep dark:text-primary", slab: "bg-primary/20" },
];

const quoteMark = "M10 8C6 9.500 4 13 4 17v7h9v-9H8c0-3 1.500-5 4-6L10 8Zm14 0c-4 1.500-6 5-6 9v7h9v-9h-5c0-3 1.500-5 4-6L24 8Z";

export function Testimonials() {
  const { lang } = usePrefs();
  const c = content[lang];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{c.testimonialsTitle}</h2>
      </Reveal>
      <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
        {c.quotes.map((q, i) => {
          const k = skins[i % skins.length];
          return (
            <Reveal key={i} delay={i * 0.12} className={i === 1 ? "md:-translate-y-8" : i === 2 ? "md:translate-y-4" : ""}>
              <Tilt max={20} perspective={800} className="h-full">
                <figure
                  className={`relative h-full rounded-[2rem] p-8 pt-12 shadow-[0_30px_50px_-25px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.35)] ${k.card}`}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Slab behind the card */}
                  <span aria-hidden className={`absolute inset-0 rounded-[2rem] ${k.slab}`} style={{ transform: "translateZ(-45px) translate(14px, 16px)" }} />

                  {/* Quote mark floating in front */}
                  <svg aria-hidden viewBox="0 0 32 32" className={`absolute -top-6 start-7 h-14 w-14 fill-current drop-shadow-xl ${k.mark}`} style={{ transform: "translateZ(90px)" }}>
                    <path d={quoteMark} />
                  </svg>

                  <blockquote className={`text-lg font-medium leading-relaxed ${k.text}`} style={{ transform: "translateZ(36px)" }}>
                    <Typed as="span" text={q.q} speed={26} />
                  </blockquote>

                  <figcaption className={`mt-7 flex items-center gap-3 text-sm ${k.muted}`} style={{ transform: "translateZ(60px)" }}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white shadow-lg">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 9 5.500 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
                      </svg>
                    </span>
                    <span>
                      <strong className={`block ${k.text}`}>{q.n}</strong>
                      {q.s}
                    </span>
                  </figcaption>

                  <span aria-hidden dir="ltr" className={`pointer-events-none absolute bottom-3 end-6 text-6xl font-extrabold opacity-10 ${k.text}`} style={{ transform: "translateZ(8px)" }}>
                    0{i + 1}
                  </span>
                </figure>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Final CTA + Footer ---------- */
export function FinalCta() {
  const { lang, t } = usePrefs();
  const c = content[lang].finalCta;
  return (
    <section className="px-5 pb-24">
      <Reveal>
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-ink px-6 py-20 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{c.title}</h2>
          <Typed as="p" text={c.body} speed={24} className="mx-auto mt-4 max-w-xl text-white/70" />
          <a href="/signup" className="mt-8 inline-block rounded-xl bg-white px-7 py-4 font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-soft">
            {t.cta1}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

const socialIcons = [
  <path key="in" d="M5 9v10M5 5.2v.1M10 19V9m0 4c0-2.2 1.5-4 3.8-4S18 10.600 18 13v6" />,
  <path key="tt" d="M14 4v10.500a3.500 3.500 0 1 1-3.500-3.500M14 4c.4 2.500 2 4 4.500 4.200" />,
  <path key="x" d="M5 5l14 14M19 5 5 19" />,
  <g key="yt"><rect x="3" y="6" width="18" height="12" rx="3.500" /><path d="m10.500 9.500 4 2.500-4 2.500Z" /></g>,
  <g key="ig"><rect x="4" y="4" width="16" height="16" rx="4.500" /><circle cx="12" cy="12" r="3.500" /><path d="M16.800 7.200v.01" /></g>,
];

export function Footer() {
  const { lang } = usePrefs();
  const c = content[lang].footer;
  const reg = registrationWords[lang];
  const cols = [...c.cols, { title: c.industriesTitle, links: industryCopy[lang].map((i) => i.name) }];
  const pin = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.100 7-11.500A7 7 0 0 0 5 9.500C5 14.900 12 21 12 21Z" />
      <circle cx="12" cy="9.500" r="2.500" />
    </svg>
  );
  const phone = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z" />
    </svg>
  );
  const mail = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );

  return (
    <footer data-lang-fade className="border-t border-fg/10 bg-soft/50">
      <div className="mx-auto max-w-6xl px-5 pt-12">
        {/* Brand, where it is available, language, and social links */}
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex items-start gap-6">
            <div>
              <Logo />
              <p className="mt-3 max-w-xs text-sm text-muted">{c.tagline}</p>
            </div>
            <div className="ms-4 space-y-3">
              <p className="text-sm text-muted">{c.availableIn}</p>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FlagJO />
                {c.country}
              </p>
              <LangSwitch />
            </div>
          </div>

          <ul className="flex items-center gap-3">
            {c.social.map((name, i) => (
              <li key={name}>
                <a href="#" aria-label={name} title={name} className="grid h-10 w-10 place-items-center rounded-xl text-primary transition hover:-translate-y-0.5 hover:bg-fg/[0.07]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {socialIcons[i]}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 grid gap-10 border-t border-fg/10 py-12 sm:grid-cols-2 md:grid-cols-5">
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-muted">{col.title}</h4>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l}><a href="#" className="transition-colors hover:text-primary">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-fg/10 bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 text-sm text-muted">
          <p>{c.legal}</p>
          {/* Dukkan's own commercial registration: the number is a link to where it can be checked */}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>
              {reg.verified}
            </span>
            <span>
              {reg.label}:{" "}
              <a href={commercialRegistration.url} target="_blank" rel="noreferrer" dir="ltr" className="font-semibold text-fg underline underline-offset-2 transition-colors hover:text-primary">
                {commercialRegistration.number}
              </a>
            </span>
          </p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li className="flex items-center gap-2">{phone}<span dir="ltr">{c.contact.phone}</span></li>
            <li className="flex items-center gap-2">{pin}{c.contact.place}</li>
            <li className="flex items-center gap-2">{mail}<span dir="ltr">{c.contact.email}</span></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
