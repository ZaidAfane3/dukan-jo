/* The one way a required field is marked: a red * after its label, and a note above the form that
   explains it. Screen readers get "required" from the input itself (aria-required), not from the star. */

export const RequiredMark = () => <span className="ms-1 text-rose-600" aria-hidden>*</span>;

export const requiredNote = { en: "Fields with * are required", ar: "الحقول التي عليها * مطلوبة" };

/** True when a form has a mistake to show (any error message set) */
export const hasErrors = (errors: object) => Object.values(errors).some(Boolean);

/** The note above a form. `text` holds one *, which is shown in red. It shows only after he pressed save with a required
    field left empty (`show`), so a fresh form is not cluttered with it. */
export function RequiredNote({ text, show, className = "text-xs text-muted" }: { text: string; show: boolean; className?: string }) {
  if (!show) return null;
  const [before, after] = text.split("*");
  return <p className={className}>{before}<span className="text-rose-600">*</span>{after}</p>;
}
