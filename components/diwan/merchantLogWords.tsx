"use client";

import { content } from "@/components/content";

/* The merchant log's lines in words (app/api/diwan/merchant-log, server/merchantLog.ts), in the staff member's
   language. Only what the server sent: what happened and, for some lines, from what to what. */

export type MerchantLine = {
  id: string;
  at: string;
  action: string;
  meta: Record<string, unknown>;
  shop: { id: string; name: string } | null;
  themes?: Record<string, { en: string; ar: string }>;
};
type T = (en: string, ar: string) => string;

/** The name of a kind of line, for the filter */
export function merchantActionWords(t: T, action: string): string {
  const w: Record<string, [string, string]> = {
    signup: ["Signed up", "أنشأ حسابًا"],
    signin: ["Signed in", "سجّل الدخول"],
    signout: ["Signed out", "سجّل الخروج"],
    "password.change": ["Changed password", "غيّر كلمة المرور"],
    "password.reset": ["Reset forgotten password", "أعاد تعيين كلمة المرور المنسية"],
    "email.change-asked": ["Asked to change email", "طلب تغيير البريد"],
    "email.change": ["Changed email", "غيّر البريد"],
    "phone.change": ["Changed mobile number", "غيّر رقم الجوال"],
    "profile.change": ["Changed account details", "غيّر بيانات الحساب"],
    "twostep.on": ["Turned 2-step sign-in on", "فعّل التحقق بخطوتين"],
    "twostep.off": ["Turned 2-step sign-in off", "أوقف التحقق بخطوتين"],
    "twostep.recovery-used": ["Used a recovery code", "استخدم رمز استرداد"],
    "store.setup-step": ["Finished a setup step", "أنهى خطوة إعداد"],
    "store.setup-done": ["Finished setting up the store", "أنهى إعداد المتجر"],
    "store.live": ["Published the store", "نشر المتجر"],
    "store.offline": ["Took the store offline", "أوقف نشر المتجر"],
    "store.paused": ["Paused the store", "أوقف المتجر مؤقتًا"],
    "store.resumed": ["Reopened the store", "أعاد فتح المتجر"],
    "store.name": ["Renamed the store", "غيّر اسم المتجر"],
    "store.link": ["Changed the store link", "غيّر رابط المتجر"],
    "store.theme": ["Changed the theme", "غيّر الثيم"],
    "store.delivery": ["Changed the delivery way", "غيّر طريقة التوصيل"],
    "store.first-product": ["Added the first product", "أضاف أول منتج"],
    "store.first-order": ["Got the first order", "استلم أول طلب"],
    "theme.bought": ["Got a theme", "حصل على ثيم"],
    "ticket.opened": ["Opened a ticket", "فتح تذكرة"],
    "document.sent": ["Sent a document", "أرسل مستندًا"],
  };
  const x = w[action];
  return x ? t(x[0], x[1]) : t("Something else", "شيء آخر");
}

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** One line in full: what happened, and its details */
export function MerchantLineText({ row, t, lang }: { row: MerchantLine; t: T; lang: "en" | "ar" }) {
  const m = row.meta;
  const head = merchantActionWords(t, row.action);
  const theme = (id: unknown) => {
    const k = str(id);
    return k ? (row.themes?.[k]?.[lang] ?? k) : "";
  };
  const delivery = (v: unknown) => (v === "seen" ? t("Dukkan Ship", "شحن دكّان") : v === "own" ? t("own courier", "مندوب خاص") : str(v));
  const fromTo = (from: string, to: string) =>
    from ? t(`from “${from}” to “${to}”`, `من «${from}» إلى «${to}»`) : t(`to “${to}”`, `إلى «${to}»`);
  let detail = "";
  switch (row.action) {
    case "signin":
      detail = m.recovery ? t("with a recovery code", "برمز استرداد") : m.twoStep ? t("with password and emailed code", "بكلمة المرور ورمز البريد") : t("with password", "بكلمة المرور");
      break;
    case "email.change-asked":
      detail = t(`to ${str(m.to)}, waiting for its code`, `إلى ${str(m.to)}، بانتظار رمزه`) + (m.sent === false ? t(" (the code could not be sent)", " (تعذّر إرسال الرمز)") : "");
      break;
    case "email.change":
      detail = fromTo(str(m.from), str(m.to));
      break;
    case "profile.change": {
      const names: Record<string, [string, string]> = { name: ["name", "الاسم"], birthday: ["birthday", "تاريخ الميلاد"], gender: ["gender", "الجنس"], city: ["city", "المدينة"] };
      detail = str(m.fields)
        .split(",")
        .filter((f) => names[f])
        .map((f) => t(names[f][0], names[f][1]))
        .join(t(", ", "، "));
      break;
    }
    case "store.setup-step": {
      const steps = str(m.steps)
        .split(",")
        .map(Number)
        .filter((n) => n >= 1 && n <= content.en.onboarding.tasks.length)
        .map((n) => content[lang].onboarding.tasks[n - 1].title);
      detail = t(`${str(m.done)} of ${str(m.of)} done`, `${str(m.done)} من ${str(m.of)} منجزة`) + (steps.length ? `: ${steps.join(t(", ", "، "))}` : "");
      break;
    }
    case "store.name":
      detail = fromTo(str(m.from), str(m.to));
      break;
    case "store.link":
      detail = fromTo(str(m.from) ? `/${str(m.from)}` : "", `/${str(m.to)}`);
      break;
    case "store.theme":
      detail = fromTo(theme(m.from), theme(m.to));
      break;
    case "store.delivery":
      detail = fromTo(m.from ? delivery(m.from) : "", delivery(m.to));
      break;
    case "theme.bought":
      detail = theme(m.theme) + (Number(m.price) > 0 ? t(` for ${str(m.price)} JOD`, ` بسعر ${str(m.price)} د.أ`) : t(" (free)", " (مجاني)"));
      break;
    case "ticket.opened":
      detail = m.number ? `#${str(m.number)}` : "";
      break;
  }
  return (
    <>
      {head}
      {detail && <span className="font-normal text-muted"> · <bdi>{detail}</bdi></span>}
    </>
  );
}
