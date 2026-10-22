/* People type numbers with whatever keyboard they have. Arabic-Indic (٠١٢٣) and
   Persian (۰۱۲۳) digits become the Latin digits the site uses everywhere. */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

export function latin(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/٫/g, ".") /* Arabic decimal separator */
    .replace(/٬/g, ""); /* Arabic thousands separator */
}
