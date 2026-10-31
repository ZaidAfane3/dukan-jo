"use client";

/* How much of a product there is: two choices, "Limited quantity" (then the number of pieces is asked) or "Unlimited".
   A very big number (999 or more) is usually a mistake or means "I never run out", so he is asked once whether it is right
   or should be unlimited. Used in the product form and in the setup's first product. */

type Lang = "en" | "ar";

/** From this many pieces he is asked whether the number is right */
export const BIG_STOCK = 999;

/** True while a big quantity has not been confirmed: the form should not save yet */
export const stockNeedsAnswer = (unlimited: boolean, quantity: string, okFor: string) => !unlimited && Number(quantity) >= BIG_STOCK && okFor !== quantity;

const words = {
  en: {
    limited: "Limited quantity",
    limitedHint: "You have a set number of pieces",
    unlimited: "Unlimited",
    unlimitedHint: "You can always make or order more",
    quantity: "How many pieces do you have?",
    big: (n: string) => `${Number(n).toLocaleString("en")} pieces is a lot. Is this number right, or do you never run out?`,
    keep: "Yes, the number is right",
    makeUnlimited: "Make it unlimited",
    confirmed: "Number confirmed",
  },
  ar: {
    limited: "كمية محدودة",
    limitedHint: "لديك عدد معيّن من القطع",
    unlimited: "غير محدودة",
    unlimitedHint: "تستطيع دائمًا صنع المزيد أو طلبه",
    quantity: "كم قطعة لديك؟",
    big: (n: string) => `${Number(n).toLocaleString("en")} قطعة كمية كبيرة. هل هذا الرقم صحيح، أم أن المنتج لا ينفد؟`,
    keep: "نعم، الرقم صحيح",
    makeUnlimited: "اجعلها غير محدودة",
    confirmed: "تم تأكيد الكمية",
  },
};

export function StockChoice({
  lang,
  unlimited,
  quantity,
  okFor,
  onUnlimited,
  onQuantity,
  onConfirm,
  inputId,
  inputClass,
  error,
  required = false,
}: {
  lang: Lang;
  unlimited: boolean;
  /* only digits */
  quantity: string;
  /* the big quantity he said is right */
  okFor: string;
  onUnlimited: (on: boolean) => void;
  onQuantity: (digits: string) => void;
  onConfirm: (quantity: string) => void;
  inputId: string;
  /* the look of the page's other fields */
  inputClass: string;
  error?: string;
  required?: boolean;
}) {
  const w = words[lang];
  const ask = stockNeedsAnswer(unlimited, quantity, okFor);
  const choice = (on: boolean, title: string, hint: string, mark: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onUnlimited(title === w.unlimited)}
      className={`flex flex-1 items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:border-primary/50"}`}
    >
      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-bold ${on ? "bg-white/20" : "bg-soft text-primary"}`}>{mark}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
  return (
    <div>
      <div role="radiogroup" className="flex flex-col gap-3 sm:flex-row">
        {choice(!unlimited, w.limited, w.limitedHint, "#")}
        {choice(unlimited, w.unlimited, w.unlimitedHint, "∞")}
      </div>
      {!unlimited && (
        <div className="mt-4 max-w-xs">
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold">
            {w.quantity}
            {required && <span className="ms-1 text-rose-600" aria-hidden>*</span>}
          </label>
          <input
            id={inputId}
            dir="ltr"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => onQuantity(e.target.value)}
            maxLength={7}
            aria-required={required}
            aria-invalid={!!error || ask}
            className={`${inputClass} h-12 text-start`}
          />
          {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
        </div>
      )}
      {ask && (
        <div role="alert" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{w.big(quantity)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onConfirm(quantity)} className="rounded-lg border border-fg/20 bg-card px-4 py-2 text-sm font-semibold transition hover:bg-soft">{w.keep}</button>
            <button type="button" onClick={() => onUnlimited(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">{w.makeUnlimited}</button>
          </div>
        </div>
      )}
      {!unlimited && okFor === quantity && Number(quantity) >= BIG_STOCK && <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">✓ {w.confirmed}</p>}
    </div>
  );
}
