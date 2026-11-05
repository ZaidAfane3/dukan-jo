/* Reports about a store ("Report this store" in a store's footer, and the ones Dukkan's team adds in Diwan). The
   rules and the words shared by the form (storefront/ReportStore.tsx), the server (app/api/store-reports) and Diwan.
   No React here, so the server can import it. */

export const REPORT_REASONS = ["scam", "fake", "banned", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** body: what happened, at least `min` visible characters; contact: an optional email or phone to reach the reporter */
export const REPORT_LIMITS = { min: 10, body: 1000, contact: 120 };

export const REASON_WORDS: Record<ReportReason, { en: string; ar: string }> = {
  scam: { en: "Scam or fraud", ar: "احتيال أو نصب" },
  fake: { en: "Fake or copied products", ar: "منتجات مقلّدة أو مزيّفة" },
  banned: { en: "Banned or illegal products", ar: "منتجات ممنوعة أو مخالفة للقانون" },
  other: { en: "Something else", ar: "سبب آخر" },
};
