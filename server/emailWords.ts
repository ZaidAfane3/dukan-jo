import { SITE_HOST } from "@/components/siteAddress";

/* Every email Dukkan sends, in one place so the words can be read and changed together. Each function gives one
   email's { subject, heading, text, button? } in one language. `text` is a paragraph per line. `button` is where the
   email asks the reader to go: server/email.ts shows it as one orange button (only an https address on SITE_HOST).

   Who reads them:
   - resetCodeEmail        server/sendCode.ts (a forgotten password's code; the code itself is shown large by email.ts)
   - the merchant notices  server/notify.ts, next to the bell's message of the same kind (the bell's own words are in
                           components/content.ts, notifications.server)
   - staffChangeEmail      the Diwan staff routes (app/api/diwan/staff), to the other owners

   Accounts and staff have no saved language, so notices go out in both: bothLangs puts the Arabic first and the English
   under it (one subject, one heading, one button). Order notices carry only the order's number and total, never the
   customer's name, phone or address. Nothing here holds a password or a secret. */

export type EmailLang = "ar" | "en";
export type EmailWords = { subject: string; heading: string; text: string; button?: { label: string; url: string } };

const link = (path: string) => `https://${SITE_HOST}${path}`;
/* "3 طلبات جديدة", "11 طلبًا جديدًا" (Arabic counts take another form from 11 on) */
const arOrders = (n: number) => (n === 2 ? "طلبان جديدان" : n <= 10 ? `${n} طلبات جديدة` : `${n} طلبًا جديدًا`);
const jod = (total: string | number, lang: EmailLang) => `${Number(total).toFixed(3)} ${lang === "ar" ? "د.أ" : "JOD"}`;
/* free text from elsewhere (a reason, a note, a ticket's subject) on one short line */
const line = (s: unknown, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** One email in both languages: the Arabic first, the English under it */
export function bothLangs(words: (lang: EmailLang) => EmailWords): EmailWords {
  const ar = words("ar");
  const en = words("en");
  return {
    subject: `${ar.subject} | ${en.subject}`,
    heading: `${ar.heading} · ${en.heading}`,
    text: `${ar.text}\n—\n${en.text}`,
    ...(ar.button && en.button ? { button: { label: `${ar.button.label} · ${en.button.label}`, url: en.button.url } } : {}),
  };
}

/* ---------------- password reset (server/sendCode.ts) ---------------- */

/** The code for a forgotten password (the code is shown on its own by email.ts and is not in the text) */
export const resetCodeEmail = (lang: EmailLang): EmailWords =>
  lang === "ar"
    ? {
        subject: "رمز إعادة تعيين كلمة المرور في دكّان",
        heading: "رمز إعادة تعيين كلمة المرور",
        text: "هذا رمزك لإعادة تعيين كلمة المرور في دكّان. ينتهي خلال 10 دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.",
      }
    : {
        subject: "Your Dukkan password reset code",
        heading: "Password reset code",
        text: "This is your Dukkan password reset code. It expires in 10 minutes.\nIf you didn't ask for it, ignore this message.",
      };

/* ---------------- the merchant's notices (server/notify.ts) ---------------- */

/** New orders on the store. `count` > 1: several came in within a few minutes, grouped into one email; `number` and
    `total` are then the newest one's. */
export function orderPlacedEmail(lang: EmailLang, p: { number: number | string; total: string | number; count: number }): EmailWords {
  const many = p.count > 1;
  const button = { label: lang === "ar" ? "افتح الطلب" : "Open the order", url: link(`/orders?open=${p.number}`) };
  if (lang === "ar")
    return many
      ? {
          subject: `${arOrders(p.count)} على متجرك`,
          heading: "طلبات جديدة",
          text: `وصل إلى متجرك ${arOrders(p.count)} في الدقائق الأخيرة.\nأحدثها الطلب رقم ${p.number} بمبلغ ${jod(p.total, lang)}، وهو طلب تجريبي غير مدفوع.`,
          button: { label: "افتح الطلبات", url: link("/orders") },
        }
      : {
          subject: `طلب جديد رقم ${p.number}`,
          heading: "طلب جديد",
          text: `وصل طلب جديد رقم ${p.number} على متجرك بمبلغ ${jod(p.total, lang)}.\nهذا طلب تجريبي غير مدفوع.`,
          button,
        };
  return many
    ? {
        subject: `${p.count} new orders on your store`,
        heading: "New orders",
        text: `${p.count} new orders came in on your store in the last few minutes.\nThe newest is order #${p.number}, ${jod(p.total, lang)}, a test order, not paid.`,
        button: { label: "Open your orders", url: link("/orders") },
      }
    : {
        subject: `New order #${p.number}`,
        heading: "New order",
        text: `A new order #${p.number} came in on your store: ${jod(p.total, lang)}.\nIt is a test order, not paid.`,
        button,
      };
}

/** Dukkan support replied to one of the merchant's tickets */
export const ticketRepliedEmail = (lang: EmailLang, p: { number: number | string; subject?: string }): EmailWords => {
  const subject = line(p.subject, 120);
  const button = { label: lang === "ar" ? "اعرض التذكرة" : "View the ticket", url: link(`/support?ticket=${p.number}`) };
  return lang === "ar"
    ? {
        subject: `ردّ دكّان على تذكرتك رقم ${p.number}`,
        heading: "ردّ جديد على تذكرتك",
        text: `ردّ فريق دعم دكّان على تذكرتك رقم ${p.number}${subject ? `: ${subject}` : ""}.\nافتح التذكرة لقراءة الرد.`,
        button,
      }
    : {
        subject: `Dukkan replied to your ticket #${p.number}`,
        heading: "New reply on your ticket",
        text: `Dukkan support replied to your ticket #${p.number}${subject ? `: ${subject}` : ""}.\nOpen the ticket to read the reply.`,
        button,
      };
};

/** A document the merchant sent was approved or not accepted (`note`: why, when Dukkan gave a reason) */
export const documentStatusEmail = (lang: EmailLang, p: { name: string; approved: boolean; note?: string }): EmailWords => {
  const name = line(p.name, 120);
  const note = line(p.note);
  const button = { label: lang === "ar" ? "افتح دكّان" : "Open Dukkan", url: link("/dashboard") };
  if (lang === "ar")
    return p.approved
      ? { subject: "تمت الموافقة على مستندك", heading: "تمت الموافقة على المستند", text: `تمت الموافقة على مستندك «${name}».`, button }
      : {
          subject: "لم يُقبل مستندك",
          heading: "لم يُقبل المستند",
          text: `لم يُقبل مستندك «${name}».${note ? `\nالسبب: ${note}` : ""}\nيمكنك إرسال مستند جديد من دكّان.`,
          button,
        };
  return p.approved
    ? { subject: "Your document was approved", heading: "Document approved", text: `Your document “${name}” was approved.`, button }
    : {
        subject: "Your document was not accepted",
        heading: "Document not accepted",
        text: `Your document “${name}” was not accepted.${note ? `\nReason: ${note}` : ""}\nYou can send a new one from Dukkan.`,
        button,
      };
};

/** Dukkan suspended the store (`reason`: what Dukkan wrote, when it did) */
export const shopSuspendedEmail = (lang: EmailLang, p: { reason?: string }): EmailWords => {
  const reason = line(p.reason);
  const button = { label: lang === "ar" ? "تواصل مع دعم دكّان" : "Contact Dukkan support", url: link("/support") };
  return lang === "ar"
    ? {
        subject: "تم إيقاف متجرك على دكّان",
        heading: "تم إيقاف متجرك",
        text: `أوقف دكّان متجرك، فلا يمكن للزبائن الطلب منه الآن.${reason ? `\nالسبب: ${reason}` : ""}\nإذا كان لديك سؤال فتواصل مع دعم دكّان.`,
        button,
      }
    : {
        subject: "Your Dukkan store was suspended",
        heading: "Your store was suspended",
        text: `Dukkan suspended your store, so customers can't order from it now.${reason ? `\nReason: ${reason}` : ""}\nIf you have a question, contact Dukkan support.`,
        button,
      };
};

/** The store is open again */
export const shopReactivatedEmail = (lang: EmailLang): EmailWords => {
  const button = { label: lang === "ar" ? "افتح دكّان" : "Open Dukkan", url: link("/dashboard") };
  return lang === "ar"
    ? { subject: "عاد متجرك للعمل على دكّان", heading: "عاد متجرك للعمل", text: "أعاد دكّان فتح متجرك، ويمكن للزبائن الطلب منه من جديد.", button }
    : { subject: "Your Dukkan store is open again", heading: "Your store is open again", text: "Dukkan reopened your store. Customers can order from it again.", button };
};

/** Dukkan Ship could not deliver one of the store's orders (`note`: why) */
export const shipFailedEmail = (lang: EmailLang, p: { number: number | string; note?: string }): EmailWords => {
  const note = line(p.note);
  const button = { label: lang === "ar" ? "افتح الطلب" : "Open the order", url: link(`/orders?open=${p.number}`) };
  return lang === "ar"
    ? {
        subject: `تعذّر تسليم الطلب رقم ${p.number}`,
        heading: "تعذّر التسليم",
        text: `تعذّر على شحن دكّان تسليم الطلب رقم ${p.number}.${note ? `\nالسبب: ${note}` : ""}`,
        button,
      }
    : {
        subject: `Order #${p.number} could not be delivered`,
        heading: "Delivery failed",
        text: `Dukkan Ship couldn't deliver order #${p.number}.${note ? `\nReason: ${note}` : ""}`,
        button,
      };
};

/* ---------------- Diwan: a change to the staff, to the other owners ---------------- */

export type StaffChange = "added" | "deactivated" | "reactivated" | "passwordReset" | "twoStepReset";

/* the time in Jordan, e.g. "20 Nov 2026, 14:05" (Latin digits in Arabic too, as Diwan shows them) */
const ammanTime = (at: Date, lang: EmailLang) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Amman", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(at);

/** What changed on Diwan's staff, who did it and when. `target`: the member it was done to; `by`: who did it. */
export function staffChangeEmail(lang: EmailLang, p: { change: StaffChange; target: string; by: string; at: Date }): EmailWords {
  const target = line(p.target, 120);
  const by = line(p.by, 120);
  const when = ammanTime(p.at, lang);
  const button = { label: lang === "ar" ? "افتح سجل النشاط في ديوان" : "Open Diwan Activity", url: link("/diwan/activity") };
  if (lang === "ar") {
    const what: Record<StaffChange, [string, string]> = {
      added: ["أُضيف عضو جديد إلى فريق ديوان", `أُضيف ${target} إلى فريق ديوان.`],
      deactivated: ["أُوقف وصول عضو في ديوان", `أُوقف وصول ${target} إلى ديوان.`],
      reactivated: ["أُعيد وصول عضو في ديوان", `أُعيد وصول ${target} إلى ديوان.`],
      passwordReset: ["أُعيد تعيين كلمة مرور عضو في ديوان", `أُعطي ${target} كلمة مرور مؤقتة جديدة، وخرج من كل أجهزته.`],
      twoStepReset: ["أُلغي التحقق بخطوتين لعضو في ديوان", `أُلغي التحقق بخطوتين لـ ${target}، وخرج من كل أجهزته. سيُعدّه من جديد عند الدخول القادم.`],
    };
    const [subject, change] = what[p.change];
    return {
      subject,
      heading: "تغيير في فريق ديوان",
      text: `${change}\nبواسطة: ${by}\nالوقت: ${when} (بتوقيت عمّان)\nإذا لم يكن هذا متوقعًا، افتح صفحة النشاط في ديوان الآن.`,
      button,
    };
  }
  const what: Record<StaffChange, [string, string]> = {
    added: ["A new member was added to Diwan", `${target} was added to Diwan's staff.`],
    deactivated: ["A Diwan member's access was turned off", `${target} can no longer sign in to Diwan.`],
    reactivated: ["A Diwan member's access was turned back on", `${target} can sign in to Diwan again.`],
    passwordReset: ["A Diwan member's password was reset", `${target} was given a new temporary password and signed out everywhere.`],
    twoStepReset: ["A Diwan member's 2-step was turned off", `2-step was turned off for ${target}, and they were signed out everywhere. They set up a new one at their next sign-in.`],
  };
  const [subject, change] = what[p.change];
  return {
    subject,
    heading: "Diwan staff change",
    text: `${change}\nBy: ${by}\nWhen: ${when} (Amman time)\nIf this wasn't expected, check Diwan's Activity page now.`,
    button,
  };
}
