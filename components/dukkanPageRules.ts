/* The rules of Dukkan's pages for merchants (no React, so the server can use them): see dukkanPages.tsx */

export const PAGE_STATUSES = ["draft", "live", "hidden"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];
export const PAGE_SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;
export const PAGE_LIMITS = { title: 120, summary: 240, body: 20_000 };

/** Where a page can go from each step */
export const PAGE_NEXT: Record<PageStatus, PageStatus[]> = { draft: ["live"], live: ["hidden"], hidden: ["live", "draft"] };

/** A page for the merchant (the list leaves the text out) */
export type MerchantPage = {
  slug: string;
  titleEn: string; titleAr: string;
  summaryEn: string; summaryAr: string;
  bodyEn?: string; bodyAr?: string;
  inMenu: boolean;
  publishedAt: string | null;
  seen: boolean;
};
