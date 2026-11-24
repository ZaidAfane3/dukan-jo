import { SITE_HOST } from "@/components/siteAddress";
import { moneyText } from "@/components/moneyText";

/* Every email Dukkan sends, in one place so the words can be read and changed together. Each function gives one
   email's { subject, heading, text, button? } in one language. `text` is a paragraph per line. `button` is where the
   email asks the reader to go: server/email.ts shows it as one orange button (only an https address on SITE_HOST).

   Who reads them:
   - resetCodeEmail        server/sendCode.ts (a forgotten password's code; the code itself is shown large by email.ts)
   - the merchant notices  server/notify.ts, next to the bell's message of the same kind (the bell's own words are in
                           components/content.ts, notifications.server); stockAlertEmail groups the stock notices
                           of one change (notify.ts emailStockNotices)
   - staffChangeEmail      the Diwan staff routes (app/api/diwan/staff), to the other owners
   - staffSigninCodeEmail, staffEmailApproveEmail, staffEmailCodeEmail, staffEmailChangedEmail   a staff member's own codes (server/staffSignin.ts)
   - cartReminderEmail     server/storeCarts.ts, to a store's customer: the cart he left, when the merchant reminds him
   - campaignFoot          server/campaigns.ts, the line under a store's campaign email (the rest is the merchant's words)

   Notices go out in the language the reader uses Dukkan in (accounts.lang / staff.lang, server/lang.ts): wordsIn. Someone
   whose language isn't saved yet gets the site's default, Arabic: an email is never in both languages (owner decision
   2026-11-24). Order notices carry only the order's number and total, never the
   customer's name, phone or address. Nothing here holds a password or a secret. */

export type EmailLang = "ar" | "en";
type Button = { label: string; url: string };
export type EmailWords = { subject: string; heading: string; text: string; button?: Button; parts?: { lang: EmailLang; heading: string; text: string; button?: Button }[] };

const link = (path: string) => `https://${SITE_HOST}${path}`;
/* "3 طلبات جديدة", "11 طلبًا جديدًا" (Arabic counts take another form from 11 on) */
const arOrders = (n: number) => {
  if (n === 2) return "طلبان جديدان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} طلبات جديدة`;
  if (r >= 11) return `${n} طلبًا جديدًا`;
  /* 100, 101, 102, 200…: the singular */
  return `${n} طلب جديد`;
};
/* written as everywhere else (components/moneyText.ts): "22", "18.50", "14.475" */
const jod = (total: string | number, lang: EmailLang) => `${moneyText(Number(total))} ${lang === "ar" ? "د.أ" : "JOD"}`;
/* free text from elsewhere (a reason, a note, a ticket's subject) on one short line */
const line = (s: unknown, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  const cut = t.length > max ? `${t.slice(0, max - 1)}…` : t;
  /* kept apart from the sentence around it (Unicode isolate marks), so an English name in an Arabic line, or the other
     way round, keeps its own order and its brackets */
  return cut ? `⁨${cut}⁩` : cut;
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
    /* the email itself shows each language in its own block, right to left then left to right (email.ts) */
    parts: [
      { lang: "ar", heading: ar.heading, text: ar.text, ...(ar.button ? { button: ar.button } : {}) },
      { lang: "en", heading: en.heading, text: en.text, ...(en.button ? { button: en.button } : {}) },
    ],
  };
}

/** One email in one language only (owner decision 2026-11-24: never both): the reader's saved language (`lang` as read
    from the database, the language they use the site in), else `fallback` (the language of the page that caused it, when
    there is one), else Arabic, the site's default */
export function wordsIn(lang: unknown, words: (lang: EmailLang) => EmailWords, fallback?: unknown): { lang: EmailLang; words: EmailWords } {
  const l: EmailLang = lang === "ar" || lang === "en" ? lang : fallback === "en" || fallback === "ar" ? fallback : "ar";
  return { lang: l, words: words(l) };
}

/* ---------------- password reset (server/sendCode.ts) ---------------- */

/** The code for a forgotten password (the code is shown on its own by email.ts and is not in the text) */
export const resetCodeEmail = (lang: EmailLang): EmailWords =>
  lang === "ar"
    ? {
        subject: "رمز إعادة تعيين كلمة المرور في دكان",
        heading: "رمز إعادة تعيين كلمة المرور",
        text: "هذا رمزك لإعادة تعيين كلمة المرور في دكان. ينتهي خلال 10 دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.",
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
        subject: `ردّ دكان على تذكرتك رقم ${p.number}`,
        heading: "ردّ جديد على تذكرتك",
        text: `ردّ فريق دعم دكان على تذكرتك رقم ${p.number}${subject ? `: ${subject}` : ""}.\nافتح التذكرة لقراءة الرد.`,
        button,
      }
    : {
        subject: `Dukkan replied to your ticket #${p.number}`,
        heading: "New reply on your ticket",
        text: `Dukkan support replied to your ticket #${p.number}${subject ? `: ${subject}` : ""}.\nOpen the ticket to read the reply.`,
        button,
      };
};

/** A document the merchant sent was approved or not accepted (`note`: why it was not accepted, or the note staff
    added to an approval, when Dukkan wrote one) */
export const documentStatusEmail = (lang: EmailLang, p: { name: string; approved: boolean; note?: string }): EmailWords => {
  const name = line(p.name, 120);
  const note = line(p.note);
  const button = { label: lang === "ar" ? "افتح دكان" : "Open Dukkan", url: link("/dashboard") };
  if (lang === "ar")
    return p.approved
      ? {
          subject: "تمت الموافقة على مستندك",
          heading: "تمت الموافقة على المستند",
          text: `تمت الموافقة على مستندك «${name}».${note ? `\nملاحظة من دكان: ${note}` : ""}`,
          button,
        }
      : {
          subject: "لم يُقبل مستندك",
          heading: "لم يُقبل المستند",
          text: `لم يُقبل مستندك «${name}».${note ? `\nالسبب: ${note}` : ""}\nيمكنك إرسال مستند جديد من دكان.`,
          button,
        };
  return p.approved
    ? {
        subject: "Your document was approved",
        heading: "Document approved",
        text: `Your document “${name}” was approved.${note ? `\nNote from Dukkan: ${note}` : ""}`,
        button,
      }
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
  const button = { label: lang === "ar" ? "تواصل مع دعم دكان" : "Contact Dukkan support", url: link("/support") };
  return lang === "ar"
    ? {
        subject: "تم إيقاف متجرك على دكان",
        heading: "تم إيقاف متجرك",
        text: `أوقف دكان متجرك، فلا يمكن للزبائن الطلب منه الآن.${reason ? `\nالسبب: ${reason}` : ""}\nإذا كان لديك سؤال فتواصل مع دعم دكان.`,
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
  const button = { label: lang === "ar" ? "افتح دكان" : "Open Dukkan", url: link("/dashboard") };
  return lang === "ar"
    ? { subject: "عاد متجرك للعمل على دكان", heading: "عاد متجرك للعمل", text: "أعاد دكان فتح متجرك، ويمكن للزبائن الطلب منه من جديد.", button }
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
        text: `تعذّر على شحن دكان تسليم الطلب رقم ${p.number}.${note ? `\nالسبب: ${note}` : ""}`,
        button,
      }
    : {
        subject: `Order #${p.number} could not be delivered`,
        heading: "Delivery failed",
        text: `Dukkan Ship couldn't deliver order #${p.number}.${note ? `\nReason: ${note}` : ""}`,
        button,
      };
};

/** The merchant's 2-step sign-in was turned off: by Dukkan's team (they could no longer get its codes), or by the
    merchant in Settings (`self`). A safety notice, so a merchant who never asked for it knows at once */
export const twoStepOffEmail = (lang: EmailLang, self = false): EmailWords => {
  const button = { label: lang === "ar" ? "افتح الإعدادات" : "Open Settings", url: link("/settings#two-step") };
  if (self)
    return lang === "ar"
      ? {
          subject: "أُوقف التحقق بخطوتين في حسابك على دكان",
          heading: "أُوقف التحقق بخطوتين",
          text: "أُوقف التحقق بخطوتين في حسابك من الإعدادات، بكلمة المرور ورمز التحقق، فصار الدخول بكلمة المرور وحدها.\nيمكنك تشغيله من جديد من الإعدادات.\nإذا لم تكن أنت، فغيّر كلمة المرور الآن وتواصل مع دعم دكان.",
          button,
        }
      : {
          subject: "2-step sign-in was turned off on your Dukkan account",
          heading: "2-step sign-in is off",
          text: "2-step sign-in was turned off on your account in Settings, with your password and a verification code, so you now sign in with your password alone.\nYou can turn it on again in Settings.\nIf this wasn't you, change your password now and contact Dukkan support.",
          button,
        };
  return lang === "ar"
    ? {
        subject: "أوقف دكان التحقق بخطوتين في حسابك",
        heading: "أُوقف التحقق بخطوتين",
        text: "أوقف فريق دكان التحقق بخطوتين في حسابك، فصار الدخول بكلمة المرور وحدها.\nيمكنك تشغيله من جديد من الإعدادات.\nإذا لم تطلب هذا، فغيّر كلمة المرور الآن وتواصل مع دعم دكان.",
        button,
      }
    : {
        subject: "Dukkan turned off 2-step sign-in on your account",
        heading: "2-step sign-in is off",
        text: "Dukkan's team turned off 2-step sign-in on your account, so you now sign in with your password alone.\nYou can turn it on again in Settings.\nIf you did not ask for this, change your password now and contact Dukkan support.",
        button,
      };
};

/* ---------------- Diwan: a change to the staff, to the other owners ---------------- */

export type StaffChange = "added" | "deactivated" | "reactivated" | "passwordReset" | "twoStepReset" | "emailFixed";

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
      emailFixed: ["صُحّح بريد عضو في ديوان", `صُحّح بريد ${target} قبل أن يؤكّده. تصل رموز دخوله إلى هذا البريد من الآن.`],
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
    emailFixed: ["A Diwan member's email was corrected", `The email of ${target} was corrected before they confirmed it. Their sign-in codes go to this address from now on.`],
  };
  const [subject, change] = what[p.change];
  return {
    subject,
    heading: "Diwan staff change",
    text: `${change}\nBy: ${by}\nWhen: ${when} (Amman time)\nIf this wasn't expected, check Diwan's Activity page now.`,
    button,
  };
}

/* ---------------- Diwan: a staff member's own codes (server/staffSignin.ts) ---------------- */

/** The 6-digit code that finishes a staff sign-in (the code is shown on its own by email.ts). `minutes`: how long it works. */
export const staffSigninCodeEmail = (lang: EmailLang, minutes: number): EmailWords =>
  lang === "ar"
    ? {
        subject: "رمز الدخول إلى ديوان",
        heading: "رمز الدخول إلى ديوان",
        text: `هذا رمز دخولك إلى ديوان، لوحة فريق دكان.\nاكتبه في صفحة الدخول، وينتهي خلال ${minutes} دقائق.\nإذا لم تحاول الدخول، فهناك من يعرف كلمة مرورك: اطلب من مالك آخر في الفريق كلمة مرور جديدة لك الآن.`,
      }
    : {
        subject: "Your Diwan sign-in code",
        heading: "Diwan sign-in code",
        text: `Here is your code to sign in to Diwan, Dukkan's staff console.\nType it on the sign-in page. It expires in ${minutes} minutes.\nIf you didn't try to sign in, someone knows your password: ask another owner on the team for a new one now.`,
      };

/** The code that confirms a new email a staff member typed in Diwan */
export const staffEmailCodeEmail = (lang: EmailLang, minutes: number): EmailWords =>
  lang === "ar"
    ? {
        subject: "أكّد بريدك الجديد في ديوان",
        heading: "تأكيد البريد الجديد",
        text: `هذا رمز تأكيد بريدك الإلكتروني الجديد في ديوان.\nاكتبه في صفحة الفريق، وينتهي خلال ${minutes} دقائق.\nإذا لم تطلبه فتجاهل هذه الرسالة.`,
      }
    : {
        subject: "Confirm your new Diwan email",
        heading: "Confirm your new email",
        text: `Here is the code to confirm your new email address in Diwan.\nType it on the Staff page. It expires in ${minutes} minutes.\nIf you didn't ask for it, you can ignore this email.`,
      };

/** To a staff member's CURRENT address, to approve a change to a new one (`to`: the new address, partly hidden): the code
    approves that address only */
export const staffEmailApproveEmail = (lang: EmailLang, minutes: number, to: string): EmailWords =>
  lang === "ar"
    ? {
        subject: "رمز الموافقة على تغيير بريدك في ديوان",
        heading: "الموافقة على تغيير البريد",
        text: `طُلب تغيير بريد حسابك في ديوان إلى ${line(to, 120)}. هذا رمز الموافقة على التغيير، وهو لهذا البريد وحده.\nاكتبه في صفحة الفريق، وينتهي خلال ${minutes} دقائق.\nإذا لم تطلبه فلا تكتبه لأحد، وأخبر مالكًا آخر في الفريق فورًا.`,
      }
    : {
        subject: "Approve the change of your Diwan email",
        heading: "Approve the email change",
        text: `Someone asked to change the email of your Diwan account to ${line(to, 120)}. Here is the code to approve it, for that address only.\nType it on the Staff page. It expires in ${minutes} minutes.\nIf it wasn't you, don't share this code, and tell another owner on the team right away.`,
      };

/** To a staff member's OLD address once their email changed (`to`: the new one, partly hidden) */
export const staffEmailChangedEmail = (lang: EmailLang, to: string): EmailWords =>
  lang === "ar"
    ? {
        subject: "تغيّر بريدك في ديوان",
        heading: "تغيّر بريد حسابك في ديوان",
        text: `تغيّر البريد الإلكتروني لحسابك في ديوان إلى ${line(to, 120)}.\nمن الآن تصل رموز الدخول إلى ديوان إلى البريد الجديد، لا إلى هذا البريد.\nإذا لم تكن أنت من غيّره، فأخبر مالكًا آخر في الفريق فورًا.`,
      }
    : {
        subject: "Your Diwan email was changed",
        heading: "Your Diwan email was changed",
        text: `The email of your Diwan account was changed to ${line(to, 120)}.\nFrom now on, Diwan's sign-in codes go to the new address, not to this one.\nIf it wasn't you, tell another owner on the team right away.`,
      };

/* ---------------- stock running low or out (server/notify.ts emailStockNotices) ---------------- */

/** Products an order took down: `out` ran out (none left), `low` reached the number the merchant set on them ("Warn me
    when the quantity reaches") with `left` still in stock. One product: about it, with a button to it; several: a
    line each, with a button to Products. Product names are the merchant's own words. */
export function stockAlertEmail(lang: EmailLang, p: { out: readonly { id: number; name: string }[]; low: readonly { id: number; name: string; left: number }[] }): EmailWords {
  const ar = lang === "ar";
  const one = p.out.length + p.low.length === 1 ? (p.out[0] ?? p.low[0]) : null;
  const name = (n: string) => line(n, 80);
  const button = one
    ? { label: ar ? "افتح المنتج" : "Open the product", url: link(`/products?open=${one.id}`) }
    : { label: ar ? "افتح المنتجات" : "Open your products", url: link("/products") };
  if (one && p.out.length)
    return ar
      ? {
          subject: `نفدت كمية «${name(one.name)}»`,
          heading: "نفدت كمية منتج",
          text: `نفدت كمية «${name(one.name)}» في متجرك، فلن يستطيع العملاء طلبه حتى تضيف كمية جديدة.`,
          button,
        }
      : {
          subject: `“${name(one.name)}” is out of stock`,
          heading: "A product ran out",
          text: `“${name(one.name)}” has run out in your store, so customers can't order it until you add more.`,
          button,
        };
  if (one)
    return ar
      ? {
          subject: `قاربت كمية «${name(one.name)}» على النفاد`,
          heading: "كمية منتج قاربت على النفاد",
          text: `بقي ${p.low[0].left} فقط من «${name(one.name)}» في متجرك.\nأضف كمية جديدة قبل أن تنفد.`,
          button,
        }
      : {
          subject: `“${name(one.name)}” is running low`,
          heading: "A product is almost out of stock",
          text: `Only ${p.low[0].left} of “${name(one.name)}” left in your store.\nAdd more before it runs out.`,
          button,
        };
  const lines = [
    ...p.out.map((x) => (ar ? `«${name(x.name)}»: نفدت الكمية` : `“${name(x.name)}”: out of stock`)),
    ...p.low.map((x) => (ar ? `«${name(x.name)}»: بقي ${x.left} فقط` : `“${name(x.name)}”: only ${x.left} left`)),
  ];
  return ar
    ? {
        subject: "منتجات في متجرك تحتاج إلى كمية جديدة",
        heading: "تنبيه الكميات",
        text: `بعد تأكيد طلب، صارت كمية هذه المنتجات في متجرك كما يلي:\n${lines.join("\n")}\nأضف كمية جديدة من صفحة المنتجات.`,
        button,
      }
    : {
        subject: "Products in your store need more stock",
        heading: "Stock alert",
        text: `An order was confirmed, and these products in your store are now low or out:\n${lines.join("\n")}\nAdd more stock on your Products page.`,
        button,
      };
}

/* ---------------- a store's customer (server/storeCarts.ts) ---------------- */

/* "منتج واحد", "منتجان", "3 منتجات", "11 منتجًا", "100 منتج" (as the subject of a sentence) */
const arPieces = (n: number) => {
  if (n === 1) return "منتج واحد";
  if (n === 2) return "منتجان";
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} منتجات`;
  if (r >= 11) return `${n} منتجًا`;
  return `${n} منتج`;
};

/** A reminder of the cart a customer left on a store, sent when the store's merchant asks (Marketing > Abandoned
    carts), in the language the customer shopped in. `count`: pieces in the cart; `products`: their names (the first
    three are named); `url`: the store's address that fills his basket again. The store's name and its products'
    names are the merchant's words, each kept apart on one short line (line). Nothing about the customer is in it. */
export function cartReminderEmail(lang: EmailLang, p: { store: string; count: number; products: string[]; url: string }): EmailWords {
  const store = line(p.store, 80);
  const shown = p.products.slice(0, 3).map((x) => line(x, 60)).filter(Boolean);
  const more = p.products.length > shown.length;
  const button = { label: lang === "ar" ? "العودة إلى سلتي" : "Back to my cart", url: p.url };
  if (lang === "ar") {
    const names = shown.length ? `: ${shown.join("، ")}${more ? "…" : ""}` : "";
    return {
      subject: `سلتك في ${store} بانتظارك`,
      heading: "سلتك بانتظارك",
      text:
        `ما زال في سلتك في متجر ${store} ${arPieces(p.count)}${names}.\n` +
        "اضغط الزر لتعود إلى سلتك وتكمل طلبك. قد تتغير الأسعار أو الكميات المتوفرة قبل أن تطلب.\n" +
        "وصلتك هذه الرسالة لأنك كتبت بريدك الإلكتروني عند الطلب في هذا المتجر ولم تكمله. لن تصلك أكثر من 3 رسائل عن هذه السلة، وتتوقف إذا أكملت طلبك أو أفرغت سلتك.",
      button,
    };
  }
  const names = shown.length ? `: ${shown.join(", ")}${more ? "…" : ""}` : "";
  return {
    subject: `Your cart at ${store} is waiting`,
    heading: "Your cart is waiting",
    text:
      `You still have ${p.count === 1 ? "1 item" : `${p.count} items`} in your cart at ${store}${names}.\n` +
      "Press the button to go back to your cart and finish your order. Prices and stock may change before you order.\n" +
      "You got this email because you typed it at checkout on this store and didn't finish your order. You'll get at most 3 emails about this cart, and they stop once you order or empty your cart.",
    button,
  };
}

/** The line under a store's campaign email (server/campaigns.ts), in the reader's language, with the words of its link
    that stops the store's campaigns. The rest of the email is the merchant's own words. */
export function campaignFoot(lang: EmailLang, store: string): { text: string; unsubscribe: string } {
  const s = line(store, 80);
  return lang === "ar"
    ? {
        text: `وصلتك هذه الرسالة من متجر ${s} لأنك طلبت منه أو اشتركت في نشرته البريدية. أُرسلت عبر دكان، ولا يُستقبل الرد عليها.`,
        unsubscribe: "إلغاء الاشتراك في رسائل هذا المتجر",
      }
    : {
        text: `You got this email from ${s} because you ordered from it or joined its newsletter. Sent with Dukkan; replies to it aren't read.`,
        unsubscribe: "Unsubscribe from this store's emails",
      };
}

/** A campaign's subject on the test the merchant sends himself */
export const campaignTestSubject = (lang: EmailLang, subject: string) => (lang === "ar" ? `[تجربة] ${subject}` : `[Test] ${subject}`);
