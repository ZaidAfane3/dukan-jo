/* Reports about a store ("Report this store" in a store's footer, and the ones Dukkan's team adds in Diwan). The
   rules and the words shared by the form (storefront/ReportStore.tsx), the server (app/api/store-reports) and Diwan.
   No React here, so the server can import it. */

import { savedMobile } from "./phone";
import { visitorEmail } from "./safeOrder";

export const REPORT_REASONS = ["scam", "fake", "banned", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** body: what happened, at least `min` visible characters; contact: an optional email or phone to reach the reporter */
export const REPORT_LIMITS = { min: 10, body: 1000, contact: 120 };

/** The reporter's contact as kept: "" when left empty, an email (as the checkout takes one) or a Jordan mobile (in its
    saved form, +9627XXXXXXXX); null for anything else, so Dukkan's team is never left with a way to reach him that
    cannot work. The form and the server check it the same way. */
export function reportContact(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t) return "";
  if (t.length > REPORT_LIMITS.contact) return null;
  return visitorEmail(t) || savedMobile(t) || null;
}

export const REASON_WORDS: Record<ReportReason, { en: string; ar: string }> = {
  scam: { en: "Scam or fraud", ar: "احتيال أو نصب" },
  fake: { en: "Fake or copied products", ar: "منتجات مقلّدة أو مزيّفة" },
  banned: { en: "Banned or illegal products", ar: "منتجات ممنوعة أو مخالفة للقانون" },
  other: { en: "Something else", ar: "سبب آخر" },
};
