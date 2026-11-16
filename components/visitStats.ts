/* Visitors of a merchant's public store (app/[slug]), counted by Dukkan's server (server/storeVisits.ts) and shown on his
   dashboard home and the Visitors report. Plain types and the words for where visitors came from, so the server and the
   pages share them (the pages read them with components/storeVisits.ts). */

/** What a visitor opened: the store's home page, a product's page, one of the store's pages, or the cart */
export const VISIT_KINDS = ["home", "product", "page", "cart"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

/** Where a visit came from, worked out from the page the visitor came from (its site name only) or the link's utm_source */
export const VISIT_SOURCES = ["whatsapp", "instagram", "facebook", "tiktok", "google", "direct", "other"] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

/** visitors: different people (one browser on one network, on one day); visits: times they came (a new visit after 30
    minutes without opening anything); views: pages opened */
export type VisitCounts = { visitors: number; visits: number; views: number };

export type VisitStats = {
  lastHour: VisitCounts;
  today: VisitCounts;
  yesterday: VisitCounts;
  /* the last 7 and 30 days with today; their visitors are the days' visitors added up (see server/storeVisits.ts) */
  week: VisitCounts;
  days30: VisitCounts;
  /* since the 1st of this month (Jordan time), for the dashboard's month summary */
  month: VisitCounts;
  /* the last hour in 12 steps of 5 minutes, oldest first: different visitors in each */
  minutes: number[];
  /* the last 24 hours, oldest first: each hour's start (ms) with its visitors and views */
  hours: { at: number; visitors: number; views: number }[];
  /* the last 30 days (Jordan time), oldest first; day is YYYY-MM-DD */
  days: ({ day: string } & VisitCounts)[];
  /* visits in the last 30 days by where they came from, most first */
  sources: { source: VisitSource; visits: number }[];
  /* product pages opened most in the last 30 days (by product id) */
  products: { id: number; views: number }[];
};

export const sourceNames: Record<"en" | "ar", Record<VisitSource, string>> = {
  en: { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", google: "Google", direct: "Direct or unknown", other: "Other websites" },
  ar: { whatsapp: "واتساب", instagram: "إنستغرام", facebook: "فيسبوك", tiktok: "تيك توك", google: "جوجل", direct: "مباشر أو غير معروف", other: "مواقع أخرى" },
};
