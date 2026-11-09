"use client";

import { useState } from "react";
import { Select } from "@/components/diwan/shopBits";
import { card, Loaded, PageHead, useApi, useFmt, useT } from "@/components/diwan/ui";

type Funnel = { period: string; signed_up: number; setup: number; product: number; published: number; ordered: number };

/* a step's card: the usual card with less room inside (a second padding class would lose to the card's own p-5) */
const step = card.replace("p-5", "p-3");

/* How far new shops get: of the shops that signed up in the period, how many reached each step. */
export default function FunnelPage() {
  const t = useT();
  const f = useFmt();
  const [period, setPeriod] = useState("30");
  const s = useApi<Funnel>(`/api/diwan/funnel?period=${period}`);
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 1000) / 10}%` : "—");

  return (
    <>
      <PageHead
        title={t("Onboarding funnel", "مراحل البدء")}
        sub={t("Of the stores that signed up in the period, how many reached each step.", "من المتاجر التي سجّلت في الفترة، كم منها وصل إلى كل مرحلة.")}
        actions={
          <Select
            label={t("Period", "الفترة")}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "7", label: t("Last 7 days", "آخر 7 أيام") },
              { value: "30", label: t("Last 30 days", "آخر 30 يومًا") },
              { value: "90", label: t("Last 90 days", "آخر 90 يومًا") },
              { value: "all", label: t("All time", "كل الوقت") },
            ]}
          />
        }
      />
      <Loaded s={s}>
        {(d) => {
          const steps = [
            { n: d.signed_up, label: t("Signed up", "سجّل") },
            { n: d.setup, label: t("Finished setup (6/6)", "أكمل الإعداد (6/6)") },
            { n: d.product, label: t("Added a product", "أضاف منتجًا") },
            { n: d.published, label: t("Published the store", "نشر المتجر") },
            { n: d.ordered, label: t("Got a first order", "حصل على أول طلب") },
          ];
          if (!d.signed_up) return <p className={`${card} text-sm text-muted`}>{t("No stores signed up in this period.", "لم يسجّل أي متجر في هذه الفترة.")}</p>;
          /* the steps side by side, in reading order (right to left in Arabic, by the page's direction): five small cards in
             one row on a wide screen, a row that scrolls sideways on a phone (1px of room so the cards' edges are not cut) */
          return (
            <ol className="flex snap-x gap-2 overflow-x-auto px-px pb-1 pt-px">
              {steps.map((st, i) => {
                const prev = i ? steps[i - 1].n : st.n;
                const width = d.signed_up ? Math.max(2, (st.n / d.signed_up) * 100) : 0;
                return (
                  <li key={i} className={`${step} min-w-[9.5rem] flex-1 snap-start`}>
                    <p className="flex items-start gap-1.5 text-xs font-semibold leading-snug">
                      <span className="text-muted tabular-nums">{f.num(i + 1)}.</span>
                      <span>{st.label}</span>
                    </p>
                    <p className="mt-2 flex items-baseline gap-1.5 tabular-nums">
                      <b className="text-xl font-extrabold leading-none">{f.num(st.n)}</b>
                      <span className="text-xs text-muted">{pct(st.n, d.signed_up)}</span>
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/10" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted">
                      {i === 0
                        ? t("of sign-ups", "من التسجيلات")
                        : prev
                          ? t(`${pct(Math.max(0, prev - st.n), prev)} dropped after the step before`, `${pct(Math.max(0, prev - st.n), prev)} توقفوا بعد المرحلة السابقة`)
                          : t("Nobody reached the step before", "لم يصل أحد إلى المرحلة السابقة")}
                    </p>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </Loaded>
      <p className="mt-3 text-xs text-muted">
        {t(
          "Each step counts the stores that reached it, in whatever order they did things, so a later step can be higher than an earlier one.",
          "كل مرحلة تعد المتاجر التي وصلتها بغض النظر عن الترتيب، لذا قد تكون مرحلة لاحقة أعلى من سابقتها.",
        )}
      </p>
    </>
  );
}
