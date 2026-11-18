import { cleanLine } from "./safe";

/* A name that is too long is refused, never cut. While he types, the field shows how long it is once it is close to the
   limit, and says so in red once it is over. The length is counted the way cleanLine (safe.ts) keeps the text: spaces at
   the ends and invisible characters left out, runs of spaces counted as one. */

/** How long a one-line text is as cleanLine would keep it (before any cut). */
export const lineLength = (s: string) => cleanLine(s, 100_000).length;

/** What to say when a name is over its limit. */
export const nameTooLong = (max: number) => ({ en: `Names can be up to ${max} letters.`, ar: `يمكن أن يصل الاسم إلى ${max} حرفًا.` });

/** The counter shows from this many characters before the limit. */
const NEAR = 10;

/** The small "52/60" under a name field: nothing while it is short, red with a message once it is over.
    hideMessage: the field already shows the same mistake (after pressing save), so only the number is shown. */
export function LengthCounter({ value, max, lang, id, hideMessage = false }: { value: string; max: number; lang: "en" | "ar"; id?: string; hideMessage?: boolean }) {
  const n = lineLength(value);
  if (n < max - NEAR) return null;
  const over = n > max;
  return (
    <p id={id} className={`mt-1.5 flex items-start justify-between gap-3 text-xs ${over ? "text-rose-600" : "text-muted"}`}>
      <span aria-live="polite">{over && !hideMessage ? nameTooLong(max)[lang] : ""}</span>
      <span dir="ltr" className="shrink-0 tabular-nums">
        {n}/{max}
      </span>
    </p>
  );
}
