import { cleanLine, cleanLines } from "./safe";
import { SITE_HOST } from "./siteAddress";

/* The rules of a marketing campaign (Marketing > Campaigns), shared by the page (components/Campaigns.tsx) and the server
   (server/campaigns.ts), so what the form accepts is exactly what the server keeps.

   A campaign is one message the merchant writes once and Dukkan sends to his own store's customers:
   - "email": a subject, an optional heading inside the email, the message, and an optional button to a page of his store;
   - "mobile": a short plain-text message (SMS or WhatsApp) with an optional link written at its end. There is no SMS or
     WhatsApp provider yet: such a campaign can be written, counted and saved as a draft, never sent (MOBILE_SENDING).
   Every text is plain: no HTML, no formatting. A text over its limit is refused, never cut. */

export type CampaignChannel = "email" | "mobile";
export const CAMPAIGN_CHANNELS: readonly CampaignChannel[] = ["email", "mobile"];
/** Whether campaigns by SMS / WhatsApp can be sent (no provider yet: false) */
export const MOBILE_SENDING = false;

export const CAMPAIGN_MAX = {
  subject: 150,
  heading: 150,
  body: 10_000,
  /* an SMS / WhatsApp message (a WhatsApp template's text is at most 1024 characters) */
  mobileBody: 1_000,
  buttonLabel: 40,
  buttonUrl: 500,
};

/** The most campaigns one store can start in a day (Jordan time) */
export const CAMPAIGNS_PER_DAY = 3;

/* ---------------- who gets it ----------------
   Everyone: the store's buyers (someone with an order that wasn't cancelled or refunded) and its newsletter
   subscribers (by email), each address once. A mobile campaign reaches
   buyers only (the newsletter keeps emails). The order filters keep only people who ordered: within the last `days`
   (0: any time) and at least `minOrders` orders (cancelled and refunded orders don't count). Anyone who unsubscribed
   from the store's campaigns is always left out, and anyone who paused them until his pause ends. */
export type CampaignWho = "all" | "subscribers" | "buyers";
export type CampaignAudience = { who: CampaignWho; days: number; minOrders: number };
export const AUDIENCE_DAYS = [0, 30, 90, 365] as const;
export const AUDIENCE_MIN_ORDERS = [1, 2, 3, 5] as const;
export const EVERYONE: CampaignAudience = { who: "all", days: 0, minOrders: 1 };

/** An audience as it is kept: anything unknown becomes its default */
export function cleanAudience(v: unknown, channel: CampaignChannel = "email"): CampaignAudience {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const who: CampaignWho = o.who === "subscribers" || o.who === "buyers" ? o.who : "all";
  const days = (AUDIENCE_DAYS as readonly number[]).includes(Number(o.days)) ? Number(o.days) : 0;
  const minOrders = (AUDIENCE_MIN_ORDERS as readonly number[]).includes(Number(o.minOrders)) ? Number(o.minOrders) : 1;
  /* the newsletter keeps emails only: by mobile, everyone is the buyers */
  return { who: channel === "mobile" ? "buyers" : who, days, minOrders };
}

/** True when the audience keeps only people who ordered (an order filter is set) */
export const ordersFiltered = (a: CampaignAudience) => a.days > 0 || a.minOrders > 1;

/* ---------------- the texts ---------------- */

/** The texts of a campaign as they are kept (cleaned, never cut: `campaignProblems` says what is too long) */
export type CampaignContent = { channel: CampaignChannel; subject: string; heading: string; body: string; buttonLabel: string; buttonUrl: string };

/* long enough to see that a text is over its limit, never kept that long */
const ROOM = 4;
export function cleanContent(v: Record<string, unknown>): CampaignContent {
  const channel: CampaignChannel = v.channel === "mobile" ? "mobile" : "email";
  const bodyMax = channel === "mobile" ? CAMPAIGN_MAX.mobileBody : CAMPAIGN_MAX.body;
  return {
    channel,
    subject: channel === "mobile" ? "" : cleanLine(v.subject, CAMPAIGN_MAX.subject * ROOM),
    heading: channel === "mobile" ? "" : cleanLine(v.heading, CAMPAIGN_MAX.heading * ROOM),
    body: cleanLines(v.body, bodyMax * ROOM),
    buttonLabel: channel === "mobile" ? "" : cleanLine(v.buttonLabel, CAMPAIGN_MAX.buttonLabel * ROOM),
    buttonUrl: typeof v.buttonUrl === "string" ? v.buttonUrl.trim().slice(0, CAMPAIGN_MAX.buttonUrl * ROOM) : "",
  };
}

/** The store's own address on Dukkan, where a campaign's button or link may go */
export const storeHome = (slug: string) => `https://${SITE_HOST}/${slug}`;

/** The button's address when it is one of the store's own pages on Dukkan (https, Dukkan's address, the store's link
    name first), else null. Only these: an email sent in Dukkan's name never sends its readers to another site. */
export function campaignLink(url: string, slug: string): string | null {
  if (!url || !slug) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.host !== SITE_HOST || u.username || u.password) return null;
    const path = u.pathname.toLowerCase();
    if (path !== `/${slug}` && path !== `/${slug}/` && !path.startsWith(`/${slug}/`)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type CampaignField = "subject" | "heading" | "body" | "buttonLabel" | "buttonUrl";
export type CampaignProblem = { field: CampaignField; why: "missing" | "long" | "link" };

/** What is wrong with a campaign's texts: for a draft only what is too long (and an empty draft), for sending also what
    is missing. `slug`: the store's link name, which the button must point into. */
export function campaignProblems(c: CampaignContent, slug: string, sending: boolean): CampaignProblem[] {
  const out: CampaignProblem[] = [];
  const bodyMax = c.channel === "mobile" ? CAMPAIGN_MAX.mobileBody : CAMPAIGN_MAX.body;
  if (c.subject.length > CAMPAIGN_MAX.subject) out.push({ field: "subject", why: "long" });
  if (c.heading.length > CAMPAIGN_MAX.heading) out.push({ field: "heading", why: "long" });
  if (c.body.length > bodyMax) out.push({ field: "body", why: "long" });
  if (c.buttonLabel.length > CAMPAIGN_MAX.buttonLabel) out.push({ field: "buttonLabel", why: "long" });
  if (c.buttonUrl && !campaignLink(c.buttonUrl, slug)) out.push({ field: "buttonUrl", why: "link" });
  /* a button needs both its words and its address */
  if (c.channel === "email" && c.buttonLabel && !c.buttonUrl) out.push({ field: "buttonUrl", why: "missing" });
  if (c.channel === "email" && c.buttonUrl && !c.buttonLabel) out.push({ field: "buttonLabel", why: "missing" });
  if (sending) {
    if (c.channel === "email" && !c.subject) out.push({ field: "subject", why: "missing" });
    if (!c.body) out.push({ field: "body", why: "missing" });
  } else if (!c.subject && !c.body) out.push({ field: c.channel === "email" ? "subject" : "body", why: "missing" });
  return out;
}

/** The language a campaign is written in: Arabic when its words hold Arabic letters, else English. The email reads in
    that direction. */
export const campaignLang = (c: Pick<CampaignContent, "subject" | "heading" | "body">): "ar" | "en" =>
  /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(`${c.subject} ${c.heading} ${c.body}`) ? "ar" : "en";

/* ---------------- the unsubscribe page ----------------
   The page a campaign email's "Unsubscribe" opens (components/Unsubscribe.tsx): the reader types the address the email
   came to, then pauses the store's emails for PAUSE_DAYS or unsubscribes from them, optionally saying why. Only counts of
   the reasons reach the merchant. He can write his own short words for the page, one per language. */

/** How long "pause this store's emails" lasts */
export const PAUSE_DAYS = 30;
export const UNSUB_REASONS = ["too-many", "not-relevant", "never-signed-up", "other"] as const;
export type UnsubReason = (typeof UNSUB_REASONS)[number];
export const unsubReason = (v: unknown): UnsubReason | null => ((UNSUB_REASONS as readonly unknown[]).includes(v) ? (v as UnsubReason) : null);

/** The most characters of the merchant's words on his unsubscribe page, in each language */
export const UNSUB_MESSAGE_MAX = 300;
export type UnsubMessage = { ar: string; en: string };
/** The page's words where the merchant wrote none (also the placeholder of his box on Marketing > Campaigns) */
export const UNSUB_MESSAGE_DEFAULT: UnsubMessage = {
  ar: "يؤسفنا أن نراك تغادر. إن كانت رسائلنا تصلك كثيرًا، يمكنك إيقافها مؤقتًا بدلًا من إلغاء الاشتراك.",
  en: "We're sorry to see you go. If our emails come too often, you can pause them for a while instead of unsubscribing.",
};
/** His words as they are kept: plain text, cleaned like his other texts, never cut (`unsubMessageTooLong` says so) */
export const cleanUnsubMessage = (v: unknown): UnsubMessage => {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return { ar: cleanLines(o.ar, UNSUB_MESSAGE_MAX * ROOM), en: cleanLines(o.en, UNSUB_MESSAGE_MAX * ROOM) };
};
export const unsubMessageTooLong = (m: UnsubMessage): ("ar" | "en")[] => (["ar", "en"] as const).filter((l) => m[l].length > UNSUB_MESSAGE_MAX);

/** An SMS message's length: its characters and how many SMS it takes (160 Latin characters in one, 153 per part
    after; 70 in one and 67 per part when it holds Arabic or other characters an SMS can't write in its plain alphabet) */
export function smsParts(text: string): { chars: number; parts: number; unicode: boolean } {
  const chars = Array.from(text).length;
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\u0000-\u007f£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà€]/.test(text);
  const one = unicode ? 70 : 160;
  const each = unicode ? 67 : 153;
  return { chars, unicode, parts: chars === 0 ? 0 : chars <= one ? 1 : Math.ceil(chars / each) };
}

/** A mobile campaign's message as it would go: the text, then the link on its own line */
export const mobileText = (c: Pick<CampaignContent, "body" | "buttonUrl">) => (c.buttonUrl ? `${c.body}\n${c.buttonUrl}` : c.body);
