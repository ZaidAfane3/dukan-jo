import { cleanLine, cleanLines } from "./safe";
import { SITE_HOST } from "./siteAddress";

/* The rules of a campaign Dukkan's team emails to merchants (Diwan > Marketing > Campaigns to merchants), shared by the
   page (app/diwan/(console)/merchant-campaigns) and the server (server/merchantCampaigns.ts), so what the form accepts
   is exactly what the server keeps.

   One campaign is written once in both languages: each merchant gets it in the language he uses Dukkan in
   (accounts.lang), and one who never chose gets both, Arabic first. Every text is plain: no HTML, no formatting. A text
   over its limit is refused, never cut. The optional button goes to a page on Dukkan's own address only.

   Who it goes to (the audience) is a set of filters on the merchants' accounts and stores; the server counts them live
   and never shows who they are. Merchants who turned Dukkan's marketing emails off (the link in each of these emails)
   and stores Dukkan suspended are always left out. */

export const MERCHANT_CAMPAIGN_MAX = {
  subject: 150,
  heading: 150,
  body: 5_000,
  buttonLabel: 40,
  buttonUrl: 500,
};

/** The most campaigns Dukkan's team can start in a day (Jordan time), all staff together */
export const MERCHANT_CAMPAIGNS_PER_DAY = 5;

/* ---------------- who it is for ---------------- */

/** stores: every merchant, live stores (published and open), not live yet (never published, or taken offline), or
    paused (published, closed for a while by the merchant). joined: signed up in the last 7, 30 or 90 days (0: any
    time). orders: any, has orders, no orders yet. lang: the language the merchant uses Dukkan in (any: everyone,
    including those who never chose one) */
export type MerchantAudience = {
  stores: "all" | "live" | "notLive" | "paused";
  joined: 0 | 7 | 30 | 90;
  orders: "any" | "some" | "none";
  lang: "any" | "ar" | "en";
};
export const AUDIENCE_STORES = ["all", "live", "notLive", "paused"] as const;
export const AUDIENCE_JOINED = [0, 7, 30, 90] as const;
export const AUDIENCE_ORDERS = ["any", "some", "none"] as const;
export const AUDIENCE_LANGS = ["any", "ar", "en"] as const;
export const EVERY_MERCHANT: MerchantAudience = { stores: "all", joined: 0, orders: "any", lang: "any" };

const pick = <T>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

/** An audience as it is kept: each filter one of its choices, anything else its "any" */
export function cleanMerchantAudience(v: unknown): MerchantAudience {
  const a = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    stores: pick(AUDIENCE_STORES, a.stores, "all"),
    joined: pick(AUDIENCE_JOINED, a.joined, 0),
    orders: pick(AUDIENCE_ORDERS, a.orders, "any"),
    lang: pick(AUDIENCE_LANGS, a.lang, "any"),
  };
}

/* ---------------- the texts ---------------- */

export type MerchantCampaignContent = {
  subjectEn: string; subjectAr: string;
  headingEn: string; headingAr: string;
  bodyEn: string; bodyAr: string;
  buttonLabelEn: string; buttonLabelAr: string;
  buttonUrl: string;
};
export const CONTENT_KEYS = ["subjectEn", "subjectAr", "headingEn", "headingAr", "bodyEn", "bodyAr", "buttonLabelEn", "buttonLabelAr", "buttonUrl"] as const;

/* long enough to see that a text is over its limit, never kept that long */
const ROOM = 4;
export function cleanMerchantContent(v: Record<string, unknown>): MerchantCampaignContent {
  const M = MERCHANT_CAMPAIGN_MAX;
  return {
    subjectEn: cleanLine(v.subjectEn, M.subject * ROOM),
    subjectAr: cleanLine(v.subjectAr, M.subject * ROOM),
    headingEn: cleanLine(v.headingEn, M.heading * ROOM),
    headingAr: cleanLine(v.headingAr, M.heading * ROOM),
    bodyEn: cleanLines(v.bodyEn, M.body * ROOM),
    bodyAr: cleanLines(v.bodyAr, M.body * ROOM),
    buttonLabelEn: cleanLine(v.buttonLabelEn, M.buttonLabel * ROOM),
    buttonLabelAr: cleanLine(v.buttonLabelAr, M.buttonLabel * ROOM),
    buttonUrl: typeof v.buttonUrl === "string" ? v.buttonUrl.trim().slice(0, M.buttonUrl * ROOM) : "",
  };
}

/** The button's address when it is a page on Dukkan's own address (https), else null: an email in Dukkan's name never
    sends merchants to another site */
export function dukkanLink(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.host !== SITE_HOST || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type MerchantCampaignField = (typeof CONTENT_KEYS)[number];
export type MerchantCampaignProblem = { field: MerchantCampaignField; why: "missing" | "long" | "link" };

/** What is wrong with the texts: for a draft only what is too long or a wrong link (and a draft with nothing in it),
    for sending (and a test) also what is missing: the subject and the message in both languages, and a button needs its
    address and its words in both languages */
export function merchantCampaignProblems(c: MerchantCampaignContent, sending: boolean): MerchantCampaignProblem[] {
  const out: MerchantCampaignProblem[] = [];
  const M = MERCHANT_CAMPAIGN_MAX;
  const max: Record<MerchantCampaignField, number> = {
    subjectEn: M.subject, subjectAr: M.subject, headingEn: M.heading, headingAr: M.heading, bodyEn: M.body, bodyAr: M.body,
    buttonLabelEn: M.buttonLabel, buttonLabelAr: M.buttonLabel, buttonUrl: M.buttonUrl,
  };
  for (const k of CONTENT_KEYS) if (c[k].length > max[k]) out.push({ field: k, why: "long" });
  if (c.buttonUrl && !dukkanLink(c.buttonUrl)) out.push({ field: "buttonUrl", why: "link" });
  if (sending) {
    for (const k of ["subjectEn", "subjectAr", "bodyEn", "bodyAr"] as const) if (!c[k]) out.push({ field: k, why: "missing" });
    if (c.buttonUrl || c.buttonLabelEn || c.buttonLabelAr) {
      if (!c.buttonUrl) out.push({ field: "buttonUrl", why: "missing" });
      if (!c.buttonLabelEn) out.push({ field: "buttonLabelEn", why: "missing" });
      if (!c.buttonLabelAr) out.push({ field: "buttonLabelAr", why: "missing" });
    }
  } else if (CONTENT_KEYS.every((k) => !c[k])) out.push({ field: "subjectEn", why: "missing" });
  return out;
}
