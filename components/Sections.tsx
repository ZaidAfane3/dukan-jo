"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./Nav";
import { industries as industryCopy, usePrefs } from "./Prefs";
import { CountUp, Marquee, Reveal } from "./ui";

const cta = "rounded-xl bg-ink px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-deep";

/* ---------- Stats ---------- */
export function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 text-center">
      <Reveal>
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Built to scale with your business</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Thousands of merchants trust Seen, on infrastructure proven to handle millions of orders in a single day.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {[
          { to: 68000, suffix: "+", label: "Active stores" },
          { to: 15, suffix: "M", label: "Orders processed in one day" },
          { to: 120, prefix: "JOD ", suffix: "M+", label: "Merchant sales" },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1}>
            <p className="text-4xl font-extrabold text-primary sm:text-5xl">
              <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm text-muted">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Brands marquee (placeholder names) ---------- */
const brandRows = [
  ["Aurora", "Nomad Gear", "Palm & Co", "Lumen", "Oasis Home", "Tidal", "Kite Audio", "Verde"],
  ["Sahara Spice", "Mono", "Bloom Lab", "Atlas Tech", "Pearl", "Rivet", "Dune Wear", "Halo"],
];

export function Brands() {
  return (
    <section className="bg-soft/60 py-16">
      <Reveal>
        <h2 className="mb-10 text-center text-2xl font-extrabold">Our merchants</h2>
      </Reveal>
      <div className="space-y-5">
        {brandRows.map((row, i) => (
          <Marquee key={i} reverse={i === 1}>
            {row.map((b) => (
              <span key={b} className="grid h-16 w-44 shrink-0 place-items-center rounded-2xl bg-card text-base font-bold tracking-tight text-fg/70 shadow-sm">
                {b}
              </span>
            ))}
          </Marquee>
        ))}
      </div>
    </section>
  );
}

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

/* ---------- Feature rows ---------- */
const features = [
  {
    id: "solutions",
    tag: "Launch",
    title: "Start easy, even if you're busy",
    body: "No experience or full-time commitment needed to start selling.",
    points: ["Guided setup that gets you live fast", "1,000+ services from trusted providers", "A community of merchants to learn from"],
  },
  {
    id: "design",
    tag: "Design",
    title: "A store that stands out at first glance",
    body: "Give customers an experience they remember.",
    points: ["A library of ready-made, customizable themes", "Fine-tune the details with JS and CSS", "Build your own theme with our developer kit"],
  },
  {
    id: "payments",
    tag: "Payments",
    title: "Secure payments, lasting trust",
    body: "Manage store and customer payments with one integrated system.",
    points: ["Cards, wallets and local payment methods", "Activate payments within a day", "Payouts 24 hours after each order"],
  },
  {
    id: "shipping",
    tag: "Shipping",
    title: "A complete shipping fleet for your products",
    body: "Connect your store to carriers without contracts or friction.",
    points: ["100+ local and international carriers", "Coverage for every city and remote area", "Specialized logistics for any product type"],
  },
  {
    id: "marketing",
    tag: "Marketing",
    title: "Every marketing tool in one place",
    body: "Reach more customers with campaigns made for your store.",
    points: ["Discount coupons that close the sale", "Full control of offers and promotions", "Abandoned-cart recovery and ad management"],
  },
  {
    id: "expand",
    tag: "Expansion",
    title: "Commerce without borders",
    body: "Sell from Jordan to the whole world.",
    points: ["40+ languages supported", "Accept payments from 79+ countries", "Multiple branches and warehouses"],
  },
];

function MockCard({ index }: { index: number }) {
  const hues = ["from-indigo-400 to-violet-500", "from-sky-400 to-indigo-500", "from-emerald-400 to-teal-500", "from-amber-300 to-orange-400", "from-rose-400 to-pink-500", "from-violet-400 to-fuchsia-500"];
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md">
      <div className={`absolute inset-0 rotate-3 rounded-3xl bg-gradient-to-br ${hues[index % hues.length]} opacity-20`} />
      <div className="absolute inset-0 -rotate-2 rounded-3xl bg-card p-5 shadow-[0_25px_60px_-20px_rgba(55,48,163,0.35)] transition-transform duration-500 hover:rotate-0">
        <div className="mb-4 flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className={`h-24 rounded-xl bg-gradient-to-br ${hues[index % hues.length]}`} />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-3/4 rounded-full bg-soft" />
          <div className="h-3 w-1/2 rounded-full bg-soft" />
          <div className="h-3 w-2/3 rounded-full bg-soft" />
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="mx-auto max-w-6xl space-y-28 px-5 py-10">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
          Seen supports every step of your journey
        </h2>
      </Reveal>
      {features.map((f, i) => (
        <div key={f.id} id={f.id} className={`grid items-center gap-12 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
          <Reveal y={40}>
            <MockCard index={i} />
          </Reveal>
          <Reveal delay={0.1}>
            <span className="rounded-full bg-soft px-4 py-1.5 text-sm font-bold text-deep dark:text-indigo-200">{f.tag}</span>
            <h3 className="mt-5 text-3xl font-extrabold tracking-tight">{f.title}</h3>
            <p className="mt-3 text-muted">{f.body}</p>
            <ul className="mt-6 space-y-3">
              {f.points.map((p) => (
                <li key={p} className="flex items-start gap-3 font-medium">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] text-white">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <a href="#" className={`${cta} mt-8 inline-block`}>Start free</a>
          </Reveal>
        </div>
      ))}
    </section>
  );
}

/* ---------- Pricing ---------- */
const plans = [
  { name: "Starter", price: "Free", note: "Everything to get your first sale", items: ["1 store", "Free themes", "Basic analytics", "Community support"], featured: false },
  { name: "Growth", price: "JOD 19", note: "per month, for scaling stores", items: ["Unlimited products", "Premium themes", "Abandoned-cart recovery", "Priority support"], featured: true },
  { name: "Enterprise", price: "Custom", note: "for large merchants and brands", items: ["Multi-branch and warehouses", "ERP integrations", "Flexible payment fees", "Dedicated manager"], featured: false },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-soft/60 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-3 text-center text-muted">Start free. Upgrade when you grow.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1}>
              <div className={`h-full rounded-3xl p-8 transition-transform duration-300 hover:-translate-y-2 ${p.featured ? "bg-ink text-white shadow-2xl" : "bg-card shadow-sm"}`}>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-4 text-4xl font-extrabold">{p.price}</p>
                <p className={`mt-1 text-sm ${p.featured ? "text-white/70" : "text-muted"}`}>{p.note}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2"><span>✓</span>{it}</li>
                  ))}
                </ul>
                <a href="#" className={`mt-8 block rounded-xl py-3 text-center font-semibold transition ${p.featured ? "bg-white text-ink hover:bg-soft" : "bg-ink text-white hover:bg-deep"}`}>
                  {p.name === "Enterprise" ? "Talk to sales" : "Get started"}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials (placeholder quotes) ---------- */
const quotes = [
  { q: "Setup took an afternoon. Our first order came in that same night.", n: "Sample Merchant", s: "Fashion store" },
  { q: "Shipping and payments finally live in one dashboard. That alone saves me hours.", n: "Sample Merchant", s: "Home goods" },
  { q: "We went from a side project to a real brand without changing platform.", n: "Sample Merchant", s: "Beauty brand" },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <Reveal>
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Be the next success story</h2>
      </Reveal>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {quotes.map((t, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <figure className="h-full rounded-3xl border border-fg/10 p-7 transition-shadow duration-300 hover:shadow-xl">
              <blockquote className="text-lg font-medium leading-relaxed">&ldquo;{t.q}&rdquo;</blockquote>
              <figcaption className="mt-6 text-sm text-muted">
                <strong className="text-fg">{t.n}</strong> · {t.s}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Final CTA + Footer ---------- */
export function FinalCta() {
  return (
    <section className="px-5 pb-24">
      <Reveal>
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-ink px-6 py-20 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Own a professional store on Seen</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Create your store now with flexible tools and complete solutions to grow your sales.
          </p>
          <a href="#" className="mt-8 inline-block rounded-xl bg-white px-7 py-4 font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-soft">
            Create your store free
          </a>
        </div>
      </Reveal>
    </section>
  );
}

const footerCols = [
  { title: "Company", links: ["About Seen", "Careers", "Terms of use", "Privacy policy"] },
  { title: "Solutions", links: ["App store", "Payments", "Marketing tools", "Seen Special"] },
  { title: "Resources", links: ["Help center", "Academy", "Community", "Blog"] },
  { title: "Partners", links: ["Become a partner", "Partner programs", "Developer docs"] },
];

export function Footer() {
  return (
    <footer className="border-t border-fg/10 bg-soft/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-5">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-4 text-sm text-muted">Smart commerce for Jordan and beyond.</p>
        </div>
        {footerCols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-bold">{c.title}</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {c.links.map((l) => (
                <li key={l}><a href="#" className="transition-colors hover:text-fg">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-fg/10 py-6 text-center text-xs text-muted">
        © 2026 Seen. All rights reserved. Prototype, not a live service.
      </p>
    </footer>
  );
}
