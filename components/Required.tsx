/* The one way a required field is marked: a red * after its label, and a note above the form that
   explains it. Screen readers get "required" from the input itself (aria-required), not from the star. */

export const RequiredMark = () => <span className="ms-1 text-rose-600" aria-hidden>*</span>;

export const requiredNote = { en: "Fields with * are required", ar: "الحقول التي عليها * مطلوبة" };

/** The note above a form. `text` holds one *, which is shown in red. */
export function RequiredNote({ text, className = "text-xs text-muted" }: { text: string; className?: string }) {
  const [before, after] = text.split("*");
  return <p className={className}>{before}<span className="text-rose-600">*</span>{after}</p>;
}
