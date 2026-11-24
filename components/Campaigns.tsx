"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIENCE_DAYS, AUDIENCE_MIN_ORDERS, CAMPAIGN_MAX, CAMPAIGNS_PER_DAY, campaignLang, campaignProblems, cleanAudience, cleanContent, EVERYONE,
  mobileText, ordersFiltered, smsParts, storeHome, type CampaignAudience, type CampaignChannel, type CampaignContent, type CampaignField,
  type CampaignProblem, type CampaignWho,
} from "./campaignRules";
import { brandName, dateLocale, type Lang } from "./content";
import { DashboardBar } from "./DashboardBar";
import { demoActive, demoOff, demoOffText } from "./demoSandbox";
import { LengthCounter } from "./LengthCounter";
import { onServer } from "./merchantApi";
import { usePageTitle } from "./pageTitle";
import { usePrefs } from "./Prefs";
import { cleanLines } from "./safe";
import { accountHeader, leaveUnasked } from "./serverSync";
import { timeoutSignal } from "./timeoutSignal";

/* Marketing > Campaigns: the merchant writes one message and Dukkan sends it to his own store's customers
   (server/campaigns.ts; GET/POST /api/campaigns, /api/campaigns/<id>, .../send, /api/campaigns/test,
   /api/campaigns/audience). His numbers on top, every campaign in a list (newest first; one that is sending shows its
   progress, read again every few seconds), and one form for a new campaign or a draft: by email (subject, heading,
   message, an optional button to a page of his store) or by SMS / WhatsApp (written and saved only: no provider yet),
   the extra filters for who gets it, and how many customers that is now, counted by the server as he changes them.
   "Send now" saves the draft, asks once with the number, and starts it. In the tour (or signed out) the page shows
   sample campaigns and nothing can be saved or sent. */

type Status = "draft" | "sending" | "sent" | "failed" | "stopped";
type Row = {
  id: string;
  channel: CampaignChannel;
  status: Status;
  subject: string;
  preview: string;
  audience: CampaignAudience;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
type Full = Row & Omit<CampaignContent, "channel">;
type Stats = { total: number; drafts: number; sent: number; lastAt: string | null; unsubscribed: number };
type Info = { stats: Stats; today: { used: number; max: number }; emailOn: boolean; mobileOn: boolean; slug: string };

const arCustomers = (n: number) => (n === 1 ? "عميل واحد" : n === 2 ? "عميلان" : n % 100 >= 3 && n % 100 <= 10 ? `${n} عملاء` : n === 0 ? "0 عملاء" : `${n} عميلًا`);
const enCustomers = (n: number) => (n === 1 ? "1 customer" : `${n.toLocaleString("en")} customers`);

const copy = {
  en: {
    title: "Campaigns",
    sub: "Write one message and send it to your store's customers: everyone who ordered and everyone on your newsletter.",
    create: "Create a campaign",
    cards: { total: "Total campaigns", sent: "Messages sent", drafts: "Drafts" },
    today: (u: number, m: number) => `Sent today: ${u} of ${m}`,
    last: (d: string) => `Last sent ${d}`,
    never: "None sent yet",
    unsub: (n: number) => `${n === 1 ? "1 person" : `${n} people`} unsubscribed from your campaigns. They're always left out.`,
    noSender: "Email sending isn't set up on this server yet. You can write and save campaigns, but they can't be sent.",
    list: "All campaigns",
    empty: "No campaigns yet. Create one to tell your customers about new products, offers or news.",
    tour: "Sample campaigns: nothing is saved or sent in the tour.",
    status: { draft: "Draft", sending: "Sending", sent: "Sent", failed: "Failed", stopped: "Stopped" } as Record<Status, string>,
    stoppedDukkan: "Stopped by Dukkan",
    stoppedSuspended: "Stopped (store suspended)",
    channel: { email: "Email", mobile: "SMS / WhatsApp" } as Record<CampaignChannel, string>,
    noSubject: "(no subject)",
    recipients: (n: number) => `To ${enCustomers(n)}`,
    progress: (s: number, n: number) => `${s} of ${n} sent`,
    sentFailed: (s: number, f: number) => `${s} sent${f ? ` · ${f} failed` : ""}`,
    created: (d: string) => `Created ${d}`,
    started: (d: string) => `Started ${d}`,
    edit: "Edit",
    view: "View",
    del: "Delete",
    delAsk: "Delete this draft?",
    keep: "Keep",
    delFail: "It couldn't be deleted. Try again.",
    delStarted: "This campaign has already started, so it can't be deleted. Its numbers are shown above.",
    loading: "Loading campaigns…",
    loadFail: "The campaigns couldn't load. Check your connection and try again.",
    retry: "Try again",
    more: "Show more",
    form: {
      newTitle: "Create a new campaign",
      editTitle: "Edit draft",
      type: "Campaign type",
      soon: "Coming soon",
      mobileNote: "Sending by SMS or WhatsApp is coming soon. You can write the message and save it as a draft now.",
      subject: "Email subject",
      subjectPh: "Special offers this week!",
      heading: "Heading inside the email",
      optional: "(optional)",
      headingPh: "End of season offers!",
      body: "Message",
      bodyPh: "Write your message here…",
      mobileBodyPh: "Write a short message…",
      bodyHint: "Plain text: each line becomes a paragraph.",
      sms: (c: number, p: number) => `${c} characters · ${p === 1 ? "1 SMS" : `${p} SMS`}`,
      addButton: "Add a link button",
      addLink: "Add a link",
      buttonLabel: "Button text",
      buttonLabelPh: "Shop now",
      buttonUrl: "Link",
      urlHint: (home: string) => `A page of your store on Dukkan, starting with ${home}`,
      linkHint: "Written on its own line at the end of the message.",
      useHome: "Use my store's address",
      removeButton: "Remove",
      filters: "Extra filtering",
      who: "Who gets it",
      whoAll: "Everyone: buyers and newsletter subscribers",
      whoSubs: "Newsletter subscribers only",
      whoBuyers: "Buyers only",
      mobileWho: "Buyers who left a mobile number at checkout.",
      days: "Ordered in the last",
      anyTime: "Any time",
      dayN: (d: number) => (d === 365 ? "12 months" : `${d} days`),
      minOrders: "At least",
      orders: (n: number) => (n === 1 ? "1 order" : `${n} orders`),
      ordersNote: "Order filters keep only customers who ordered (cancelled and refunded orders don't count).",
      willEmail: (n: number) => `Will be sent to ~${enCustomers(n)} (who have an email)`,
      willMobile: (n: number) => `Will be sent to ~${enCustomers(n)} (who have a mobile number)`,
      counting: "Counting customers…",
      countFail: "The customers couldn't be counted right now.",
      unsubNote: "People who unsubscribed are left out. Every email has an unsubscribe link.",
      send: "Send now",
      save: "Save as draft",
      saving: "Saving…",
      cancel: "Cancel",
      test: "Send a test to me",
      testing: "Sending the test…",
      testDone: (to: string) => `A test was sent to ${to}.`,
      limit: (u: number, m: number) => `You can send ${m} campaigns a day. Sent today: ${u}.`,
      confirmTitle: "Send this campaign now?",
      confirmBody: (n: number) => `It goes to ${enCustomers(n)} by email, starting now. Once it starts it can't be changed or taken back.`,
      confirmSend: (n: number) => `Send to ${enCustomers(n)}`,
      starting: "Starting…",
      back: "Back",
      discard: "Discard your changes?",
      discardYes: "Discard",
      keepEditing: "Keep editing",
      started: "This campaign has already started, so it can't be changed any more. Your changes here weren't saved; close this to see it in the list.",
    },
    problems: {
      subject: { missing: "Write the email's subject.", long: `Up to ${CAMPAIGN_MAX.subject} characters.` },
      heading: { long: `Up to ${CAMPAIGN_MAX.heading} characters.` },
      body: { missing: "Write the message.", long: "The message is too long." },
      buttonLabel: { missing: "Write the button's text.", long: `Up to ${CAMPAIGN_MAX.buttonLabel} characters.` },
      buttonUrl: { missing: "Add the button's link.", link: "Use a link to a page of your store (see below)." },
      empty: "Write something first.",
    },
    why: {
      "daily-limit": `You've started ${CAMPAIGNS_PER_DAY} campaigns today, the most in a day. You can send this one tomorrow; it's saved as a draft.`,
      "no-recipients": "Nobody matches these filters right now (or they all unsubscribed). Change the filters and try again.",
      "no-sender": "Email isn't set up on this server yet, so nothing can be sent. Your draft is saved.",
      "mobile-soon": "Sending by SMS or WhatsApp is coming soon. Your draft is saved.",
      "not-draft": "This campaign has already started.",
      suspended: "Your store is suspended, so nothing can be sent.",
      "too-many-drafts": "You have too many drafts. Delete some first.",
      "slow-down": "Too many tries for now. Wait a little and try again.",
      "other-account": "This page was opened for another account. Reload the page.",
      failed: "The email couldn't be sent. Try again later.",
      none: "This campaign is no longer there.",
      offline: "Couldn't reach the server. Check your connection and try again.",
      error: "Something went wrong. Try again.",
    } as Record<string, string>,
    details: {
      title: "Campaign details",
      started: "Started",
      finished: "Finished",
      recipients: "Recipients",
      sent: "Sent",
      failed: "Failed",
      skipped: "Not sent",
      skippedHint: "Unsubscribed meanwhile, or not reached because it was stopped.",
      audience: "Audience",
      button: "Button",
      link: "Link",
      close: "Close",
      notes: {
        dukkan: "Dukkan stopped this campaign while it was sending. Customers it hadn't reached didn't get it. Contact support to know why.",
        suspended: "It stopped because your store was suspended.",
        "no-sender": "Email wasn't set up on the server, so it couldn't be sent.",
        "mobile-soon": "Sending by SMS or WhatsApp isn't available yet.",
        failed: "The emails couldn't be sent.",
      } as Record<string, string>,
    },
  },
  ar: {
    title: "حملات تسويقية",
    sub: "اكتب رسالة واحدة وأرسلها إلى عملاء متجرك: كل من طلب منك وكل المشتركين في نشرتك البريدية.",
    create: "إنشاء حملة",
    cards: { total: "إجمالي الحملات", sent: "الرسائل المرسلة", drafts: "المسودات" },
    today: (u: number, m: number) => `أُرسل اليوم: ${u} من ${m}`,
    last: (d: string) => `آخر إرسال ${d}`,
    never: "لم تُرسل أي حملة بعد",
    unsub: (n: number) => `ألغى ${arCustomers(n)} الاشتراك في حملاتك. يُستبعدون دائمًا من الإرسال.`,
    noSender: "إرسال البريد غير مفعّل على هذا الخادم بعد. يمكنك كتابة الحملات وحفظها، لكن لا يمكن إرسالها.",
    list: "جميع الحملات",
    empty: "لا توجد حملات بعد. أنشئ حملة لتخبر عملاءك بالمنتجات الجديدة أو العروض أو الأخبار.",
    tour: "حملات تجريبية: لا يُحفظ أو يُرسل شيء في الجولة.",
    status: { draft: "مسودة", sending: "جارٍ الإرسال", sent: "أُرسلت", failed: "فشلت", stopped: "أُوقفت" } as Record<Status, string>,
    stoppedDukkan: "أوقفها دكان",
    stoppedSuspended: "أُوقفت (المتجر موقوف)",
    channel: { email: "بريد إلكتروني", mobile: "رسالة نصية / واتساب" } as Record<CampaignChannel, string>,
    noSubject: "(بلا عنوان)",
    recipients: (n: number) => `إلى ${arCustomers(n)}`,
    progress: (s: number, n: number) => `أُرسل ${s} من ${n}`,
    sentFailed: (s: number, f: number) => `أُرسل ${s}${f ? ` · فشل ${f}` : ""}`,
    created: (d: string) => `أُنشئت ${d}`,
    started: (d: string) => `بدأت ${d}`,
    edit: "تعديل",
    view: "عرض",
    del: "حذف",
    delAsk: "حذف هذه المسودة؟",
    keep: "إبقاء",
    delFail: "تعذّر الحذف. حاول مرة أخرى.",
    delStarted: "بدأ إرسال هذه الحملة، فلا يمكن حذفها. أرقامها ظاهرة أعلاه.",
    loading: "جارٍ تحميل الحملات…",
    loadFail: "تعذّر تحميل الحملات. تحقّق من اتصالك وحاول مجددًا.",
    retry: "حاول مجددًا",
    more: "عرض المزيد",
    form: {
      newTitle: "إنشاء حملة جديدة",
      editTitle: "تعديل المسودة",
      type: "نوع الحملة",
      soon: "قريبًا",
      mobileNote: "الإرسال عبر الرسائل النصية أو واتساب قريبًا. يمكنك كتابة الرسالة وحفظها كمسودة الآن.",
      subject: "عنوان البريد",
      subjectPh: "عروض حصرية لهذا الأسبوع!",
      heading: "عنوان داخل الرسالة",
      optional: "(اختياري)",
      headingPh: "عروض نهاية الموسم!",
      body: "محتوى الرسالة",
      bodyPh: "اكتب رسالتك هنا…",
      mobileBodyPh: "اكتب رسالة قصيرة…",
      bodyHint: "نص عادي: كل سطر يصبح فقرة.",
      sms: (c: number, p: number) => `${c === 1 ? "حرف واحد" : c === 2 ? "حرفان" : c % 100 >= 3 && c % 100 <= 10 ? `${c} أحرف` : `${c} حرفًا`} ·${p === 1 ? "رسالة نصية واحدة" : p === 2 ? "رسالتان نصيتان" : `${p} رسائل نصية`}`,
      addButton: "إضافة زر رابط",
      addLink: "إضافة رابط",
      buttonLabel: "نص الزر",
      buttonLabelPh: "تسوّق الآن",
      buttonUrl: "الرابط",
      urlHint: (home: string) => `صفحة من متجرك على دكان، تبدأ بـ ${home}`,
      linkHint: "يُكتب في سطر مستقل في نهاية الرسالة.",
      useHome: "استخدم عنوان متجري",
      removeButton: "إزالة",
      filters: "تصفية إضافية",
      who: "من يستلمها",
      whoAll: "الجميع: المشترون والمشتركون في النشرة البريدية",
      whoSubs: "المشتركون في النشرة البريدية فقط",
      whoBuyers: "المشترون فقط",
      mobileWho: "المشترون الذين كتبوا رقم جوالهم عند الطلب.",
      days: "طلبوا خلال آخر",
      anyTime: "أي وقت",
      dayN: (d: number) => (d === 365 ? "12 شهرًا" : `${d} يومًا`),
      minOrders: "على الأقل",
      orders: (n: number) => (n === 1 ? "طلب واحد" : n === 2 ? "طلبان" : `${n} طلبات`),
      ordersNote: "تصفية الطلبات تُبقي فقط العملاء الذين طلبوا (الطلبات الملغاة والمستردة لا تُحسب).",
      willEmail: (n: number) => `سيتم الإرسال إلى ~${arCustomers(n)} (لديهم بريد إلكتروني)`,
      willMobile: (n: number) => `سيتم الإرسال إلى ~${arCustomers(n)} (لديهم رقم جوال)`,
      counting: "جارٍ عدّ العملاء…",
      countFail: "تعذّر عدّ العملاء الآن.",
      unsubNote: "يُستبعد من ألغى اشتراكه. في كل رسالة رابط لإلغاء الاشتراك.",
      send: "إرسال الآن",
      save: "حفظ كمسودة",
      saving: "جارٍ الحفظ…",
      cancel: "إلغاء",
      test: "أرسل نسخة تجريبية إليّ",
      testing: "جارٍ إرسال النسخة التجريبية…",
      testDone: (to: string) => `أُرسلت نسخة تجريبية إلى ${to}.`,
      limit: (u: number, m: number) => `يمكنك إرسال ${m} حملات في اليوم. أُرسل اليوم: ${u}.`,
      confirmTitle: "إرسال هذه الحملة الآن؟",
      confirmBody: (n: number) => `ستُرسل إلى ${arCustomers(n)} بالبريد الإلكتروني، بدءًا من الآن. بعد أن تبدأ لا يمكن تعديلها أو التراجع عنها.`,
      confirmSend: (n: number) => `أرسل إلى ${arCustomers(n)}`,
      starting: "جارٍ البدء…",
      back: "رجوع",
      discard: "تجاهل تعديلاتك؟",
      discardYes: "تجاهل",
      keepEditing: "متابعة التعديل",
      started: "بدأ إرسال هذه الحملة، فلا يمكن تعديلها بعد الآن. لم تُحفظ تعديلاتك هنا؛ أغلق هذه النافذة لتراها في القائمة.",
    },
    problems: {
      subject: { missing: "اكتب عنوان البريد.", long: `حتى ${CAMPAIGN_MAX.subject} حرفًا.` },
      heading: { long: `حتى ${CAMPAIGN_MAX.heading} حرفًا.` },
      body: { missing: "اكتب محتوى الرسالة.", long: "الرسالة أطول من المسموح." },
      buttonLabel: { missing: "اكتب نص الزر.", long: `حتى ${CAMPAIGN_MAX.buttonLabel} حرفًا.` },
      buttonUrl: { missing: "أضف رابط الزر.", link: "استخدم رابطًا لصفحة من متجرك (انظر أدناه)." },
      empty: "اكتب شيئًا أولًا.",
    },
    why: {
      "daily-limit": `بدأت ${CAMPAIGNS_PER_DAY} حملات اليوم، وهو الحد الأقصى في اليوم. يمكنك إرسال هذه الحملة غدًا، وهي محفوظة كمسودة.`,
      "no-recipients": "لا يوجد عملاء يطابقون هذه التصفية الآن (أو ألغوا جميعًا اشتراكهم). غيّر التصفية وحاول مجددًا.",
      "no-sender": "إرسال البريد غير مفعّل على هذا الخادم بعد، فلا يمكن إرسال شيء. مسودتك محفوظة.",
      "mobile-soon": "الإرسال عبر الرسائل النصية أو واتساب قريبًا. مسودتك محفوظة.",
      "not-draft": "بدأ إرسال هذه الحملة بالفعل.",
      suspended: "متجرك موقوف، فلا يمكن إرسال شيء.",
      "too-many-drafts": "لديك مسودات كثيرة. احذف بعضها أولًا.",
      "slow-down": "محاولات كثيرة الآن. انتظر قليلًا وحاول مجددًا.",
      "other-account": "فُتحت هذه الصفحة لحساب آخر. أعد تحميل الصفحة.",
      failed: "تعذّر إرسال البريد. حاول لاحقًا.",
      none: "لم تعد هذه الحملة موجودة.",
      offline: "تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مجددًا.",
      error: "حدث خطأ. حاول مجددًا.",
    } as Record<string, string>,
    details: {
      title: "تفاصيل الحملة",
      started: "بدأت",
      finished: "انتهت",
      recipients: "المستلمون",
      sent: "أُرسلت",
      failed: "فشلت",
      skipped: "لم تُرسل",
      skippedHint: "ألغوا الاشتراك أثناء الإرسال، أو لم تصلهم لأن الحملة أُوقفت.",
      audience: "الجمهور",
      button: "الزر",
      link: "الرابط",
      close: "إغلاق",
      notes: {
        dukkan: "أوقف دكان هذه الحملة أثناء إرسالها. لم تصل إلى العملاء الذين لم تصلهم بعد. تواصل مع الدعم لمعرفة السبب.",
        suspended: "توقفت لأن متجرك أُوقف.",
        "no-sender": "لم يكن إرسال البريد مفعّلًا على الخادم، فتعذّر إرسالها.",
        "mobile-soon": "الإرسال عبر الرسائل النصية أو واتساب غير متاح بعد.",
        failed: "تعذّر إرسال الرسائل.",
      } as Record<string, string>,
    },
  },
};
type Copy = (typeof copy)["en"];

const card = "rounded-2xl bg-card p-5 shadow-sm ring-1 ring-fg/10";
const field =
  "h-11 w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
const bad = "!border-rose-500 focus:!ring-rose-500/25";
const label = "mb-2 block text-sm font-semibold";
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const ico = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const icons = {
  megaphone: <svg {...ico} className="h-6 w-6"><path d="M4 10v4l12 5V5L4 10ZM8 15l1 5h3l-1-4M19 9v6" /></svg>,
  email: <svg {...ico} className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>,
  mobile: <svg {...ico} className="h-5 w-5"><path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 2.5Z" /><path d="M9 9h6M9 12h4" /></svg>,
  people: <svg {...ico} className="h-5 w-5"><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.2 3 5" /></svg>,
  chevron: <svg {...ico} className="h-4 w-4 transition-transform"><path d="m6 9 6 6 6-6" /></svg>,
  close: <svg {...ico} className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>,
};

const dateOf = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(dateLocale(lang), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Amman" }).format(new Date(iso));

/* one call to the campaigns' routes: its status and JSON, or null when the server could not be reached. Changes name the
   account the page is signed in as (server/auth.ts otherAccount), so a tab left on another account can't act here. */
async function call(path: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: unknown, signal?: AbortSignal): Promise<{ status: number; data: Record<string, any> } | null> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: timeoutSignal(20_000, signal),
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(method === "GET" ? {} : accountHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: ((await r.json().catch(() => ({}))) ?? {}) as Record<string, any> };
  } catch {
    return null;
  }
}
const whyOf = (c: Copy, r: { status: number; data: Record<string, any> } | null) => (r ? c.why[String(r.data.result)] ?? c.why.error : c.why.offline);

/* how many customers an audience reaches now. The server counts at most two at a time for one account and answers 429
   "slow-down" past that (filters changed quickly, the counts before still running): that is still counting, so it asks
   again a moment later, a few times, before saying it couldn't count. */
async function countOf(channel: CampaignChannel, a: CampaignAudience, signal?: AbortSignal) {
  const path = `/api/campaigns/audience?channel=${channel}&who=${a.who}&days=${a.days}&min=${a.minOrders}`;
  for (let i = 0; ; i++) {
    const r = await call(path, "GET", undefined, signal);
    if (r?.status !== 429 || i >= 5 || signal?.aborted) return r;
    await new Promise((ok) => setTimeout(ok, 700 + i * 400));
  }
}

/* ---------------- the tour's samples ---------------- */

function samples(lang: Lang): { rows: Row[]; info: Info } {
  const ar = lang === "ar";
  const at = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const base = { audience: EVERYONE, note: null, skipped: 0 };
  const rows: Row[] = [
    { ...base, id: "s1", channel: "email", status: "sending", subject: ar ? "عروض نهاية الموسم" : "End of season offers", preview: ar ? "خصومات تصل إلى 40% على منتجات مختارة…" : "Up to 40% off selected products…", recipients: 248, sent: 150, failed: 1, createdAt: at(0.2), updatedAt: at(0.01), startedAt: at(0.02), finishedAt: null },
    { ...base, id: "s2", channel: "email", status: "sent", subject: ar ? "وصلت تشكيلتنا الجديدة" : "Our new collection is here", preview: ar ? "اكتشف أحدث المنتجات في متجرنا…" : "Discover the newest products in our store…", recipients: 231, sent: 229, failed: 2, createdAt: at(8), updatedAt: at(8), startedAt: at(8), finishedAt: at(7.9) },
    { ...base, id: "s3", channel: "email", status: "draft", subject: ar ? "أفكار هدايا العيد" : "Eid gift ideas", preview: ar ? "هدايا مميزة لكل من تحب…" : "Special gifts for everyone you love…", recipients: 0, sent: 0, failed: 0, createdAt: at(1), updatedAt: at(1), startedAt: null, finishedAt: null },
  ];
  return { rows, info: { stats: { total: 3, drafts: 1, sent: 379, lastAt: at(0.02), unsubscribed: 4 }, today: { used: 1, max: CAMPAIGNS_PER_DAY }, emailOn: true, mobileOn: false, slug: "your-store" } };
}

/* ---------------- the page ---------------- */

export function Campaigns() {
  const { lang } = usePrefs();
  const c = copy[lang];
  usePageTitle(`${brandName(lang)} | ${c.title}`);
  /* null until known: false in the tour or signed out (samples, nothing sent) */
  const [live, setLive] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [delFailed, setDelFailed] = useState<{ id: string; text: string } | null>(null);
  /* the form: a new campaign (null id) or a draft; the details of one that started */
  const [form, setForm] = useState<{ draft: Full | null } | null>(null);
  const [viewing, setViewing] = useState<Full | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openFail, setOpenFail] = useState("");
  const reading = useRef(0);
  const shownRows = useRef(rows);
  shownRows.current = rows;

  useEffect(() => {
    setLive(!demoActive() && onServer());
  }, []);

  /* the tour's samples, in the page's language */
  useEffect(() => {
    if (live !== false) return;
    const s = samples(lang);
    setRows(s.rows);
    setInfo(s.info);
    setNext(null);
  }, [live, lang]);

  const read = useCallback(async () => {
    const n = ++reading.current;
    setLoading(true);
    setFailed(false);
    const r = await call("/api/campaigns", "GET");
    if (n !== reading.current) return;
    setLoading(false);
    if (r?.status === 200 && Array.isArray(r.data.campaigns)) {
      setRows(r.data.campaigns as Row[]);
      setNext(typeof r.data.next === "string" ? r.data.next : null);
      setInfo({ stats: r.data.stats, today: r.data.today, emailOn: !!r.data.emailOn, mobileOn: !!r.data.mobileOn, slug: String(r.data.slug ?? "") });
    } else setFailed(true);
  }, []);
  useEffect(() => {
    if (live) void read();
  }, [live, read]);

  /* one campaign read again and put in its place in the list (wherever it is: a row "Show more" added is not in the
     newest page refresh reads), or taken out when it is gone */
  const readRow = useCallback(async (id: string) => {
    const n = reading.current;
    const r = await call(`/api/campaigns/${encodeURIComponent(id)}`, "GET");
    if (n !== reading.current) return;
    if (r?.status === 404) return setRows((all) => all.filter((x) => x.id !== id));
    if (r?.status !== 200 || !r.data.campaign) return;
    const { heading: _h, body: _b, buttonLabel: _l, buttonUrl: _u, ...row } = r.data.campaign as Full;
    setRows((all) => all.map((x) => (x.id === id ? (row as Row) : x)));
  }, []);

  /* the newest page read again, keeping the older pages already shown: the numbers of a campaign sending move on. One
     sending further down (an older draft sent after "Show more") is read again on its own. */
  const refresh = useCallback(async () => {
    const n = reading.current;
    const r = await call("/api/campaigns", "GET");
    if (n !== reading.current || !(r?.status === 200 && Array.isArray(r.data.campaigns))) return;
    const fresh = r.data.campaigns as Row[];
    const inFresh = new Set(fresh.map((x) => x.id));
    for (const x of shownRows.current) if (x.status === "sending" && !inFresh.has(x.id)) void readRow(x.id);
    setRows((all) => {
      const seen = new Set(fresh.map((x) => x.id));
      const oldest = fresh.length ? Math.min(...fresh.map((x) => Number(x.id))) : Infinity;
      /* the rows after the first page stay; a row of the first page that is gone (deleted elsewhere) goes */
      return [...fresh, ...all.filter((x) => !seen.has(x.id) && Number(x.id) < oldest)];
    });
    setInfo({ stats: r.data.stats, today: r.data.today, emailOn: !!r.data.emailOn, mobileOn: !!r.data.mobileOn, slug: String(r.data.slug ?? "") });
  }, [readRow]);
  const sending = live && rows.some((x) => x.status === "sending");
  useEffect(() => {
    if (!sending) return;
    const t = setInterval(() => void refresh(), 4_000);
    return () => clearInterval(t);
  }, [sending, refresh]);

  const loadMore = async () => {
    if (!next || moreLoading) return;
    const n = reading.current;
    setMoreLoading(true);
    setMoreFailed(false);
    const r = await call(`/api/campaigns?before=${encodeURIComponent(next)}`, "GET");
    if (n !== reading.current) return;
    setMoreLoading(false);
    if (r?.status === 200 && Array.isArray(r.data.campaigns)) {
      setRows((all) => {
        const seen = new Set(all.map((x) => x.id));
        return [...all, ...(r.data.campaigns as Row[]).filter((x) => !seen.has(x.id))];
      });
      setNext(typeof r.data.next === "string" ? r.data.next : null);
    } else setMoreFailed(true);
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setDelFailed(null);
    const r = await call(`/api/campaigns/${encodeURIComponent(id)}`, "DELETE");
    setDeleting(null);
    setAsking(null);
    if (r?.status === 200 || r?.status === 404) {
      setRows((all) => all.filter((x) => x.id !== id));
      void refresh();
    } else if (r?.data.result === "not-draft") {
      /* it started meanwhile (another tab): its row shows it as it is now, with no Delete */
      setDelFailed({ id, text: c.delStarted });
      void readRow(id);
      void refresh();
    } else setDelFailed({ id, text: r && c.why[String(r.data.result)] ? c.why[String(r.data.result)] : r ? c.delFail : c.why.offline });
  };

  /* a campaign's texts, for the form (a draft) or its details */
  const open = async (x: Row) => {
    setOpenFail("");
    if (!live) {
      const full: Full = { ...x, heading: "", body: x.preview, buttonLabel: "", buttonUrl: "" };
      return x.status === "draft" ? setForm({ draft: full }) : setViewing(full);
    }
    setOpening(x.id);
    const r = await call(`/api/campaigns/${encodeURIComponent(x.id)}`, "GET");
    setOpening(null);
    if (r?.status !== 200 || !r.data.campaign) return setOpenFail(whyOf(c, r));
    const full = r.data.campaign as Full;
    if (full.status === "draft") setForm({ draft: full });
    else setViewing(full);
  };

  const stats = info?.stats;
  const shown = live === false || (live && !loading && !failed);

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar active="marketing" subtabs={[c.title]} activeSub={0} />
      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <section className={`${card} flex flex-wrap items-start justify-between gap-4`}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icons.megaphone}</span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold">{c.title}</h1>
              <p className="mt-1 text-sm text-muted">{c.sub}</p>
            </div>
          </div>
          <button type="button" onClick={() => setForm({ draft: null })} disabled={!info} className={`${btn} bg-primary text-white hover:bg-deep max-sm:w-full`}>
            <span aria-hidden className="text-lg leading-none">+</span>
            {c.create}
          </button>
        </section>

        {live === false && <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-deep dark:text-primary">{c.tour}</p>}
        {live && info && !info.emailOn && <p role="status" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">{c.noSender}</p>}

        <section className="grid gap-4 sm:grid-cols-3" aria-live="polite">
          {[
            { k: c.cards.total, v: stats?.total, hint: info ? c.today(info.today.used, info.today.max) : "" },
            { k: c.cards.sent, v: stats?.sent, hint: stats ? (stats.lastAt ? c.last(dateOf(stats.lastAt, lang)) : c.never) : "" },
            { k: c.cards.drafts, v: stats?.drafts, hint: "" },
          ].map((s) => (
            <div key={s.k} className={card}>
              <p className="text-sm text-muted">{s.k}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{shown && s.v !== undefined ? s.v.toLocaleString(lang === "ar" ? "ar-EG-u-nu-latn" : "en") : <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-fg/10 align-middle" />}</p>
              {s.hint && <p className="mt-1 text-xs text-muted">{s.hint}</p>}
            </div>
          ))}
        </section>
        {shown && !!stats?.unsubscribed && <p className="text-sm text-muted">{c.unsub(stats.unsubscribed)}</p>}

        <section className={card}>
          <h2 className="text-base font-bold">{c.list}</h2>
          {openFail && <p role="alert" className="mt-2 text-sm text-rose-600">{openFail}</p>}
          {live === null || (live && loading) ? (
            <div className="mt-4 space-y-3" role="status" aria-label={c.loading}>
              {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-fg/[0.06]" />)}
            </div>
          ) : live && failed ? (
            <div className="mt-5 py-6 text-center">
              <p role="alert" className="text-sm text-rose-600">{c.loadFail}</p>
              <button type="button" onClick={() => void read()} className={`${btn} mt-3 h-10 border border-fg/20 hover:bg-soft`}>{c.retry}</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-fg/20 px-4 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">{icons.megaphone}</span>
              <p className="mt-3 max-w-md text-sm text-muted">{c.empty}</p>
              <button type="button" onClick={() => setForm({ draft: null })} className={`${btn} mt-4 bg-primary text-white hover:bg-deep`}>{c.create}</button>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-fg/10 rounded-xl border border-fg/10">
                {rows.map((x) => (
                  <CampaignItem
                    key={x.id}
                    x={x}
                    c={c}
                    lang={lang}
                    busy={opening === x.id}
                    asking={asking === x.id}
                    deleting={deleting === x.id}
                    delFailed={delFailed?.id === x.id ? delFailed.text : ""}
                    tour={live === false}
                    onOpen={() => void open(x)}
                    onAsk={() => { setAsking(x.id); setDelFailed(null); }}
                    onKeep={() => setAsking(null)}
                    onDelete={() => void remove(x.id)}
                  />
                ))}
              </ul>
              {next && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button type="button" onClick={() => void loadMore()} disabled={moreLoading} className={`${btn} h-10 border border-fg/20 hover:bg-soft`}>
                    {moreLoading ? c.loading : c.more}
                  </button>
                  {moreFailed && <p role="alert" className="text-xs text-rose-600">{c.loadFail}</p>}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {form && info && (
        <CampaignForm
          c={c}
          lang={lang}
          info={info}
          draft={form.draft}
          tour={live === false}
          onClose={() => setForm(null)}
          onDone={(id) => {
            setForm(null);
            void refresh();
            if (id) void readRow(id);
          }}
          onSaved={(id) => {
            void refresh();
            void readRow(id);
          }}
        />
      )}
      {viewing && <CampaignDetails x={viewing} c={c} lang={lang} onClose={() => setViewing(null)} />}
    </div>
  );
}

/* ---------------- one campaign in the list ---------------- */

function statusOf(x: Row, c: Copy): { text: string; tone: string } {
  if (x.status === "stopped") return { text: x.note === "dukkan" ? c.stoppedDukkan : x.note === "suspended" ? c.stoppedSuspended : c.status.stopped, tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300" };
  const tone: Record<Status, string> = {
    draft: "bg-fg/[0.07] text-fg/80",
    sending: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failed: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    stopped: "",
  };
  return { text: c.status[x.status], tone: tone[x.status] };
}

function CampaignItem({ x, c, lang, busy, asking, deleting, delFailed, tour, onOpen, onAsk, onKeep, onDelete }: {
  x: Row; c: Copy; lang: Lang; busy: boolean; asking: boolean; deleting: boolean; delFailed: string; tour: boolean;
  onOpen: () => void; onAsk: () => void; onKeep: () => void; onDelete: () => void;
}) {
  const st = statusOf(x, c);
  const title = x.channel === "email" ? x.subject || c.noSubject : x.preview || c.noSubject;
  const done = x.sent + x.failed + x.skipped;
  const pct = x.recipients ? Math.min(100, Math.round((done / x.recipients) * 100)) : 0;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-primary" title={c.channel[x.channel]}>
        {icons[x.channel]}
        <span className="sr-only">{c.channel[x.channel]}</span>
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate font-semibold" dir="auto">{title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${st.tone}`}>{st.text}</span>
          <span>{x.startedAt ? c.started(dateOf(x.startedAt, lang)) : c.created(dateOf(x.createdAt, lang))}</span>
        </p>
      </div>
      {x.status !== "draft" && (
        <div className="w-full text-sm sm:w-56">
          <p className="font-medium">{c.recipients(x.recipients)}</p>
          {x.status === "sending" ? (
            <>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={c.progress(x.sent, x.recipients)}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{c.progress(x.sent, x.recipients)}</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted">{c.sentFailed(x.sent, x.failed)}</p>
          )}
        </div>
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-sm:w-full">
        {asking ? (
          <>
            <span className="text-xs font-semibold">{c.delAsk}</span>
            <button type="button" disabled={deleting} onClick={onDelete} className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">{c.del}</button>
            <button type="button" disabled={deleting} onClick={onKeep} className="h-9 rounded-lg border border-fg/20 px-3 text-xs font-semibold transition hover:bg-soft">{c.keep}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onOpen} disabled={busy} className="h-9 rounded-lg border border-fg/20 px-3 text-xs font-semibold transition hover:bg-soft disabled:opacity-60">
              {x.status === "draft" ? c.edit : c.view}
            </button>
            {x.status === "draft" && (
              <button type="button" onClick={onAsk} disabled={tour} title={tour ? demoOffText(lang) : undefined} aria-label={`${c.del}: ${x.subject || c.noSubject}`} className={`h-9 rounded-lg px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-600/10 ${demoOff}`}>
                {c.del}
              </button>
            )}
          </>
        )}
        {delFailed && <p role="alert" className="w-full text-end text-xs text-rose-600">{delFailed}</p>}
      </div>
    </li>
  );
}

/* ---------------- the frame of the form and of the details ---------------- */

function Modal({ title, onClose, children, footer, labelId, closeLabel }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; labelId: string; closeLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef(onClose);
  live.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && live.current();
    document.addEventListener("keydown", onKey);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = was;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={labelId} className="dash my-6 flex max-h-[calc(100dvh-3rem)] w-full max-w-xl flex-col rounded-3xl bg-card text-fg shadow-2xl ring-1 ring-fg/10">
        <div className="flex items-center justify-between gap-3 border-b border-fg/10 px-6 py-4">
          <h2 id={labelId} className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-soft hover:text-fg">{icons.close}</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-wrap items-center gap-2 border-t border-fg/10 px-6 py-4">{footer}</div>
      </div>
    </div>
  );
}

function Fold({ open, onToggle, children, label: text, id }: { open: boolean; onToggle: () => void; children: React.ReactNode; label: string; id: string }) {
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <span className={open ? "rotate-180" : ""}>{icons.chevron}</span>
        {text}
      </button>
      {open && <div id={id} className="mt-3 space-y-4 rounded-xl bg-soft/60 p-4">{children}</div>}
    </div>
  );
}

/* ---------------- the form ---------------- */

/* audience.who is the email choice, kept as it is while the type is SMS / WhatsApp (which reaches buyers only: the server
   keeps it as buyers, cleanAudience), so going back to email gives back what was chosen instead of quietly leaving the
   newsletter subscribers out. A mobile draft is kept as "buyers", which says nothing of an email choice: everyone. */
type FormState = { channel: CampaignChannel; subject: string; heading: string; body: string; buttonLabel: string; buttonUrl: string; audience: CampaignAudience };
const stateOf = (d: Full | null): FormState =>
  d
    ? { channel: d.channel, subject: d.subject, heading: d.heading, body: d.body, buttonLabel: d.buttonLabel, buttonUrl: d.buttonUrl, audience: d.channel === "mobile" ? { ...cleanAudience(d.audience), who: EVERYONE.who } : cleanAudience(d.audience) }
    : { channel: "email", subject: "", heading: "", body: "", buttonLabel: "", buttonUrl: "", audience: EVERYONE };
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

function CampaignForm({ c, lang, info, draft, tour, onClose, onDone, onSaved }: {
  c: Copy; lang: Lang; info: Info; draft: Full | null; tour: boolean; onClose: () => void; onDone: (id?: string) => void; onSaved: (id: string) => void;
}) {
  const f = c.form;
  const [s, setS] = useState<FormState>(() => stateOf(draft));
  const opened = useRef(JSON.stringify(stateOf(draft)));
  /* the draft this form saves into (null: not saved yet) and the key that makes its first save happen once */
  const [id, setId] = useState<string | null>(draft?.id ?? null);
  const key = useRef(newKey());
  const saved = useRef(opened.current);
  const [buttonOpen, setButtonOpen] = useState(!!(draft?.buttonLabel || draft?.buttonUrl));
  const [filtersOpen, setFiltersOpen] = useState(!!draft && JSON.stringify(cleanAudience(draft.audience, draft.channel)) !== JSON.stringify(cleanAudience(EVERYONE, draft.channel)));
  const [errors, setErrors] = useState<Partial<Record<CampaignField | "empty", string>>>({});
  const [busy, setBusy] = useState<null | "save" | "send" | "test" | "start">(null);
  const [message, setMessage] = useState<{ tone: "bad" | "good"; text: string } | null>(null);
  const [step, setStep] = useState<{ confirm: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [count, setCount] = useState<{ n: number | null; state: "counting" | "ok" | "failed" }>({ n: null, state: "counting" });
  const home = storeHome(info.slug || "your-store");
  const content = useMemo(() => cleanContent({ ...s }), [s]);
  const dirty = JSON.stringify(s) !== saved.current;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setMessage(null);
    if (k in errors || errors.empty) setErrors((e) => ({ ...e, [k]: undefined, empty: undefined }));
  };
  /* the "who" stays as chosen for email (see stateOf); the audience as it goes is this channel's */
  const setAudience = (a: Partial<CampaignAudience>) => set("audience", cleanAudience({ ...s.audience, ...a }));
  const aud = cleanAudience(s.audience, s.channel);

  /* the customers it would reach now, counted by the server a moment after the last change; a count still on its way
     when the filters change again is dropped */
  const audKey = `${s.channel}|${aud.who}|${aud.days}|${aud.minOrders}`;
  useEffect(() => {
    let gone = false;
    const stop = new AbortController();
    setCount((x) => ({ n: x.n, state: "counting" }));
    const t = setTimeout(async () => {
      if (tour) {
        const base = s.channel === "mobile" ? 186 : 248;
        const n = Math.round(base * (aud.who === "subscribers" ? 0.35 : aud.who === "buyers" ? 0.8 : 1) * (aud.days ? Math.min(1, aud.days / 400 + 0.2) : 1) / aud.minOrders);
        return !gone && setCount({ n, state: "ok" });
      }
      const r = await countOf(s.channel, aud, stop.signal);
      if (gone) return;
      if (r?.status === 200 && typeof r.data.count === "number") setCount({ n: r.data.count, state: "ok" });
      else setCount((x) => ({ n: x.n, state: "failed" }));
    }, 350);
    return () => {
      gone = true;
      clearTimeout(t);
      stop.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audKey, tour]);

  /* leaving with unsaved changes asks first (the page too) */
  const tryClose = () => (busy ? undefined : dirty && !tour ? setLeaving(true) : onClose());
  useEffect(() => {
    if (!dirty || tour) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaveUnasked()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty, tour]);

  const fieldIds: Record<CampaignField, string> = { subject: "cp-subject", heading: "cp-heading", body: "cp-body", buttonLabel: "cp-blabel", buttonUrl: "cp-burl" };
  /* the server's or the page's problems, under their fields; the first one comes into view */
  const show = (problems: CampaignProblem[]) => {
    const next: Partial<Record<CampaignField | "empty", string>> = {};
    for (const p of problems) {
      const words = c.problems[p.field] as Record<string, string>;
      if (!next[p.field]) next[p.field] = words[p.why] ?? c.why.error;
      if (p.field === "buttonLabel" || p.field === "buttonUrl") setButtonOpen(true);
    }
    setErrors(next);
    const first = (Object.keys(fieldIds) as CampaignField[]).find((k) => next[k]);
    if (first) {
      setTimeout(() => {
        const el = document.getElementById(fieldIds[first]);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
      }, 0);
    }
    return problems.length > 0;
  };

  /* saves the form as a draft (new, or the one it is); its id, or null when it was refused */
  const save = async (): Promise<string | null> => {
    const body = { ...s, key: key.current };
    const r = id ? await call(`/api/campaigns/${encodeURIComponent(id)}`, "PUT", body) : await call("/api/campaigns", "POST", body);
    if (r?.status === 200 && r.data.campaign?.id) {
      const nid = String(r.data.campaign.id);
      setId(nid);
      key.current = newKey();
      saved.current = JSON.stringify(s);
      onSaved(nid);
      return nid;
    }
    if (r?.status === 400 && Array.isArray(r.data.problems)) show(r.data.problems as CampaignProblem[]);
    else if (id && r?.data.result === "not-draft") {
      /* it started meanwhile (another tab): its row in the list is read again so it shows that */
      setMessage({ tone: "bad", text: f.started });
      onSaved(id);
    } else setMessage({ tone: "bad", text: whyOf(c, r) });
    return null;
  };

  const onSave = async () => {
    if (tour || busy) return;
    /* an empty draft is not kept */
    if (!content.subject && !content.body) return setErrors({ empty: c.problems.empty });
    if (show(campaignProblems(content, info.slug, false))) return;
    setBusy("save");
    const ok = await save();
    setBusy(null);
    if (ok) onDone(ok);
  };

  const onSend = async () => {
    if (tour || busy || s.channel !== "email") return;
    if (show(campaignProblems(content, info.slug, true))) return;
    setBusy("send");
    setMessage(null);
    const nid = await save();
    if (!nid) return setBusy(null);
    const r = await countOf(s.channel, aud);
    setBusy(null);
    if (r?.status !== 200 || typeof r.data.count !== "number") return setMessage({ tone: "bad", text: whyOf(c, r) });
    if (r.data.count === 0) return setMessage({ tone: "bad", text: c.why["no-recipients"] });
    setCount({ n: r.data.count, state: "ok" });
    setStep({ confirm: r.data.count });
  };

  const onStart = async () => {
    if (!id || busy) return;
    setBusy("start");
    const r = await call(`/api/campaigns/${encodeURIComponent(id)}/send`, "POST", {});
    setBusy(null);
    if (r?.status === 200) return onDone(id);
    setStep(null);
    /* it started already (a second tab, a lost answer): the list shows it */
    if (r?.data.result === "not-draft") return onDone(id);
    if (r?.status === 400 && Array.isArray(r.data.problems)) show(r.data.problems as CampaignProblem[]);
    else setMessage({ tone: "bad", text: whyOf(c, r) });
  };

  const onTest = async () => {
    if (tour || busy || s.channel !== "email") return;
    if (show(campaignProblems(content, info.slug, true))) return;
    setBusy("test");
    setMessage(null);
    const r = await call("/api/campaigns/test", "POST", s);
    setBusy(null);
    if (r?.status === 200) setMessage({ tone: "good", text: f.testDone(String(r.data.to ?? "")) });
    else if (r?.status === 400 && Array.isArray(r.data.problems)) show(r.data.problems as CampaignProblem[]);
    else setMessage({ tone: "bad", text: whyOf(c, r) });
  };

  const err = (k: CampaignField) => (errors[k] ? <p className="mt-1.5 text-xs text-rose-600">{errors[k]}</p> : null);
  const bodyMax = s.channel === "mobile" ? CAMPAIGN_MAX.mobileBody : CAMPAIGN_MAX.body;
  const bodyLen = cleanLines(s.body, 100_000).length;
  const sms = smsParts(mobileText({ body: cleanLines(s.body, 100_000), buttonUrl: s.buttonUrl.trim() }));
  const off = tour ? demoOffText(lang) : undefined;
  const labelId = "campaign-form-title";
  const dir = s.subject || s.body ? (campaignLang(content) === "ar" ? "rtl" : "ltr") : undefined;

  const footer = step ? (
    <>
      <button type="button" data-autofocus onClick={() => void onStart()} disabled={busy === "start"} className={`${btn} bg-primary text-white hover:bg-deep`}>
        {busy === "start" ? f.starting : f.confirmSend(step.confirm)}
      </button>
      <button type="button" onClick={() => setStep(null)} disabled={busy === "start"} className={`${btn} border border-fg/20 hover:bg-soft`}>{f.back}</button>
    </>
  ) : leaving ? (
    <>
      <span className="me-auto text-sm font-semibold">{f.discard}</span>
      <button type="button" data-autofocus onClick={() => setLeaving(false)} className={`${btn} border border-fg/20 hover:bg-soft`}>{f.keepEditing}</button>
      <button type="button" onClick={onClose} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>{f.discardYes}</button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => void onSend()} disabled={tour || !!busy || s.channel !== "email" || !info.emailOn} title={off} className={`${btn} bg-primary text-white hover:bg-deep ${demoOff}`}>
        {busy === "send" ? f.saving : f.send}
      </button>
      <button type="button" onClick={() => void onSave()} disabled={tour || !!busy} title={off} className={`${btn} border border-fg/20 hover:bg-soft ${demoOff}`}>
        {busy === "save" ? f.saving : f.save}
      </button>
      <button type="button" onClick={tryClose} disabled={!!busy} className={`${btn} border border-fg/20 hover:bg-soft`}>{f.cancel}</button>
      {s.channel === "email" && (
        <button type="button" onClick={() => void onTest()} disabled={tour || !!busy || !info.emailOn} title={off} className={`${btn} ms-auto px-2 text-primary hover:underline ${demoOff} max-sm:ms-0`}>
          {busy === "test" ? f.testing : f.test}
        </button>
      )}
    </>
  );

  return (
    <Modal title={draft ? f.editTitle : f.newTitle} onClose={step ? () => setStep(null) : tryClose} footer={footer} labelId={labelId} closeLabel={c.details.close}>
      {step ? (
        <div className="space-y-3" role="alert">
          <p className="text-base font-bold">{f.confirmTitle}</p>
          <p className="text-sm leading-relaxed text-muted">{f.confirmBody(step.confirm)}</p>
          <p className="rounded-xl bg-soft px-4 py-3 text-sm font-semibold" dir="auto">{s.subject}</p>
          <p className="text-xs text-muted">{f.limit(info.today.used, info.today.max)}</p>
        </div>
      ) : (
        <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <fieldset>
            <legend className={label}>{f.type}</legend>
            <div className="grid grid-cols-2 gap-3">
              {(["email", "mobile"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  aria-pressed={s.channel === ch}
                  data-autofocus={s.channel === ch ? true : undefined}
                  onClick={() => {
                    /* only the type changes: the email "who" is kept for coming back (stateOf) */
                    setS((x) => ({ ...x, channel: ch }));
                    setErrors({});
                    setMessage(null);
                  }}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-sm font-semibold transition ${s.channel === ch ? "border-primary bg-primary/[0.07] text-primary" : "border-fg/10 hover:border-fg/25"}`}
                >
                  {icons[ch]}
                  {c.channel[ch]}
                  {ch === "mobile" && !info.mobileOn && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">{f.soon}</span>}
                </button>
              ))}
            </div>
            {s.channel === "mobile" && !info.mobileOn && <p className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{f.mobileNote}</p>}
          </fieldset>

          {s.channel === "email" && (
            <>
              <div>
                <label className={label} htmlFor="cp-subject">{f.subject}</label>
                <input id="cp-subject" dir="auto" value={s.subject} onChange={(e) => set("subject", e.target.value)} placeholder={f.subjectPh} maxLength={CAMPAIGN_MAX.subject * 2} aria-invalid={!!errors.subject} className={`${field} ${errors.subject ? bad : ""}`} />
                {err("subject")}
                <LengthCounter value={s.subject} max={CAMPAIGN_MAX.subject} lang={lang} hideMessage />
              </div>
              <div>
                <label className={label} htmlFor="cp-heading">{f.heading} <span className="font-normal text-muted">{f.optional}</span></label>
                <input id="cp-heading" dir="auto" value={s.heading} onChange={(e) => set("heading", e.target.value)} placeholder={f.headingPh} maxLength={CAMPAIGN_MAX.heading * 2} aria-invalid={!!errors.heading} className={`${field} ${errors.heading ? bad : ""}`} />
                {err("heading")}
                <LengthCounter value={s.heading} max={CAMPAIGN_MAX.heading} lang={lang} hideMessage />
              </div>
            </>
          )}

          <div>
            <label className={label} htmlFor="cp-body">{f.body}</label>
            <textarea id="cp-body" dir={dir ?? "auto"} value={s.body} onChange={(e) => set("body", e.target.value)} placeholder={s.channel === "mobile" ? f.mobileBodyPh : f.bodyPh} rows={s.channel === "mobile" ? 4 : 7} maxLength={bodyMax * 2} aria-invalid={!!errors.body} aria-describedby="cp-body-count" className={`${field} h-auto resize-y py-3 leading-relaxed ${errors.body ? bad : ""}`} />
            {err("body")}
            <div id="cp-body-count" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{s.channel === "mobile" ? f.sms(sms.chars, sms.parts) : f.bodyHint}</span>
              <span dir="ltr" className={`tabular-nums ${bodyLen > bodyMax ? "font-semibold text-rose-600" : ""}`}>{bodyLen}/{bodyMax}</span>
            </div>
          </div>

          <Fold open={buttonOpen} onToggle={() => setButtonOpen((o) => !o)} label={s.channel === "mobile" ? f.addLink : f.addButton} id="cp-button">
            {s.channel === "email" && (
              <div>
                <label className={label} htmlFor="cp-blabel">{f.buttonLabel}</label>
                <input id="cp-blabel" dir="auto" value={s.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} placeholder={f.buttonLabelPh} maxLength={CAMPAIGN_MAX.buttonLabel * 2} aria-invalid={!!errors.buttonLabel} className={`${field} ${errors.buttonLabel ? bad : ""}`} />
                {err("buttonLabel")}
                <LengthCounter value={s.buttonLabel} max={CAMPAIGN_MAX.buttonLabel} lang={lang} hideMessage />
              </div>
            )}
            <div>
              <label className={label} htmlFor="cp-burl">{f.buttonUrl}</label>
              <input id="cp-burl" dir="ltr" inputMode="url" value={s.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} placeholder={home} maxLength={CAMPAIGN_MAX.buttonUrl} aria-invalid={!!errors.buttonUrl} className={`${field} text-start ${errors.buttonUrl ? bad : ""}`} />
              {err("buttonUrl")}
              <p className="mt-1.5 text-xs text-muted">{s.channel === "mobile" ? f.linkHint : f.urlHint(home)}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {s.buttonUrl !== home && (
                  <button type="button" onClick={() => set("buttonUrl", home)} className="text-xs font-semibold text-primary hover:underline">{f.useHome}</button>
                )}
                {(s.buttonUrl || s.buttonLabel) && (
                  <button type="button" onClick={() => { setS((x) => ({ ...x, buttonLabel: "", buttonUrl: "" })); setErrors((e) => ({ ...e, buttonLabel: undefined, buttonUrl: undefined })); }} className="text-xs font-semibold text-rose-600 hover:underline">{f.removeButton}</button>
                )}
              </div>
            </div>
          </Fold>

          <Fold open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} label={f.filters} id="cp-filters">
            {s.channel === "email" ? (
              <fieldset>
                <legend className={label}>{f.who}</legend>
                <div className="space-y-2">
                  {([["all", f.whoAll], ["subscribers", f.whoSubs], ["buyers", f.whoBuyers]] as [CampaignWho, string][]).map(([w, text]) => (
                    <label key={w} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input type="radio" name="cp-who" checked={s.audience.who === w} onChange={() => setAudience({ who: w })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                      {text}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-muted">{f.mobileWho}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="cp-days">{f.days}</label>
                <select id="cp-days" value={s.audience.days} onChange={(e) => setAudience({ days: Number(e.target.value) })} className={`${field} pe-8`}>
                  {AUDIENCE_DAYS.map((d) => <option key={d} value={d}>{d ? f.dayN(d) : f.anyTime}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="cp-min">{f.minOrders}</label>
                <select id="cp-min" value={s.audience.minOrders} onChange={(e) => setAudience({ minOrders: Number(e.target.value) })} className={`${field} pe-8`}>
                  {AUDIENCE_MIN_ORDERS.map((n) => <option key={n} value={n}>{f.orders(n)}</option>)}
                </select>
              </div>
            </div>
            {ordersFiltered(aud) && <p className="text-xs text-muted">{f.ordersNote}</p>}
          </Fold>

          <div className="flex items-start gap-3 rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200" aria-live="polite">
            <span className="mt-0.5 shrink-0">{icons.people}</span>
            <div>
              <p className="font-semibold">
                {count.state === "failed" ? f.countFail : count.state === "counting" && count.n === null ? f.counting : (s.channel === "mobile" ? f.willMobile : f.willEmail)(count.n ?? 0)}
              </p>
              <p className="mt-0.5 text-xs opacity-80">{f.unsubNote}</p>
            </div>
          </div>

          {errors.empty && <p role="alert" className="text-sm text-rose-600">{errors.empty}</p>}
          {s.channel === "email" && <p className="text-xs text-muted">{f.limit(info.today.used, info.today.max)}</p>}
          {message && (
            <p role={message.tone === "bad" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${message.tone === "bad" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

/* ---------------- a campaign that started: what it said and how it went ---------------- */

function CampaignDetails({ x, c, lang, onClose }: { x: Full; c: Copy; lang: Lang; onClose: () => void }) {
  const d = c.details;
  const f = c.form;
  const st = statusOf(x, c);
  const a = x.audience;
  const who = x.channel === "mobile" ? f.mobileWho : a.who === "subscribers" ? f.whoSubs : a.who === "buyers" ? f.whoBuyers : f.whoAll;
  const extra = [a.days ? `${f.days} ${f.dayN(a.days)}` : "", a.minOrders > 1 ? `${f.minOrders} ${f.orders(a.minOrders)}` : ""].filter(Boolean).join(" · ");
  const note = x.note ? d.notes[x.note] : x.status === "failed" ? d.notes.failed : "";
  const dir = campaignLang(x) === "ar" ? "rtl" : "ltr";
  return (
    <Modal
      title={d.title}
      onClose={onClose}
      labelId="campaign-details-title"
      closeLabel={d.close}
      footer={<button type="button" data-autofocus onClick={onClose} className={`${btn} border border-fg/20 hover:bg-soft`}>{d.close}</button>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${st.tone}`}>{st.text}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 font-semibold">{c.channel[x.channel]}</span>
        </div>
        {note && <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">{note}</p>}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [d.recipients, x.recipients],
            [d.sent, x.sent],
            [d.failed, x.failed],
            [d.skipped, x.skipped],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-soft/70 px-3 py-2.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {x.skipped > 0 && <p className="-mt-3 text-xs text-muted">{d.skippedHint}</p>}
        <dl className="space-y-1 text-sm">
          {x.startedAt && <div className="flex flex-wrap gap-2"><dt className="text-muted">{d.started}:</dt><dd>{dateOf(x.startedAt, lang)}</dd></div>}
          {x.finishedAt && <div className="flex flex-wrap gap-2"><dt className="text-muted">{d.finished}:</dt><dd>{dateOf(x.finishedAt, lang)}</dd></div>}
          <div className="flex flex-wrap gap-2"><dt className="text-muted">{d.audience}:</dt><dd>{who}{extra ? ` · ${extra}` : ""}</dd></div>
        </dl>
        <div dir={dir} className="space-y-3 rounded-2xl border border-fg/10 p-4">
          {x.subject && <p className="font-bold">{x.subject}</p>}
          {x.heading && <p className="text-lg font-bold">{x.heading}</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{x.body}</p>
          {x.buttonUrl && (
            <p className="text-sm">
              <span className="text-muted">{x.channel === "email" ? d.button : d.link}: </span>
              {x.buttonLabel && <span className="font-semibold">{x.buttonLabel} · </span>}
              <bdi dir="ltr" className="break-all">{x.buttonUrl}</bdi>
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
