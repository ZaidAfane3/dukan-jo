"use client";

import { useState } from "react";
import { Select } from "@/components/diwan/shopBits";
import { card, Loaded, PageHead, useApi, useFmt, useT } from "@/components/diwan/ui";

type Funnel = { period: string; signed_up: number; setup: number; product: number; published: number; ordered: number };

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
        sub={t("Of the shops that signed up in the period, how many reached each step.", "من المتاجر التي سجّلت في الفترة، كم منها وصل إلى كل مرحلة.")}
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
          if (!d.signed_up) return <p className={`${card} text-sm text-muted`}>{t("No shops signed up in this period.", "لم يسجّل أي متجر في هذه الفترة.")}</p>;
          return (
            <ol className="space-y-3">
              {steps.map((st, i) => {
                const prev = i ? steps[i - 1].n : st.n;
                const width = d.signed_up ? Math.max(2, (st.n / d.signed_up) * 100) : 0;
                return (
                  <li key={i} className={card}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        {i + 1}. {st.label}
                      </p>
                      <p className="text-sm tabular-nums">
                        <b className="text-lg">{f.num(st.n)}</b> <span className="text-muted">· {pct(st.n, d.signed_up)} {t("of sign-ups", "من التسجيلات")}</span>
                      </p>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fg/10" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                    {i > 0 && (
                      <p className="mt-2 text-xs text-muted">
                        {prev
                          ? t(`${pct(Math.max(0, prev - st.n), prev)} dropped from the step before`, `${pct(Math.max(0, prev - st.n), prev)} توقفوا بعد المرحلة السابقة`)
                          : t("Nobody reached the step before", "لم يصل أحد إلى المرحلة السابقة")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          );
        }}
      </Loaded>
      <p className="mt-4 text-xs text-muted">
        {t(
          "Each step counts the shops that reached it, in whatever order they did things, so a later step can be higher than an earlier one.",
          "كل مرحلة تعد المتاجر التي وصلتها بغض النظر عن الترتيب، لذا قد تكون مرحلة لاحقة أعلى من سابقتها.",
        )}
      </p>
    </>
  );
}
