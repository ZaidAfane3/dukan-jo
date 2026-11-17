/* The activity log in plain words. Diwan's log keeps what staff changed and their sign-ins, never what they only looked
   at: the old "opened a page" lines (any "….view") and the half-way "password right, waiting for the code" stay in the database,
   which allows no deleting, but are left out of every list (HIDDEN_ACTIONS, read by the routes). */

export const HIDDEN_ACTIONS = ["staff.password_ok"];
/** SQL that leaves the hidden lines out (any "….view", and HIDDEN_ACTIONS), for a WHERE on audit_log as `l` or `a` */
export const SHOWN_SQL = (alias: string) => `(${alias}.action NOT LIKE '%.view' AND ${alias}.action NOT IN (${HIDDEN_ACTIONS.map((a) => `'${a}'`).join(", ")}))`;

const W: Record<string, [en: string, ar: string]> = {
  /* signing in */
  "staff.login": ["Signed in", "سجّل الدخول"],
  "staff.logout": ["Signed out", "سجّل الخروج"],
  "staff.login_failed": ["Sign-in failed", "فشل تسجيل الدخول"],
  "staff.code_failed": ["Wrong 2-step code", "رمز تحقق خاطئ"],
  "staff.2step_on": ["Turned on 2-step sign-in", "فعّل التحقق بخطوتين"],
  "staff.password_changed": ["Changed their password", "غيّر كلمة المرور"],
  "staff.setup": ["Created the first owner", "أنشأ المالك الأول"],
  "staff.setup_wrong_key": ["Wrong setup key", "مفتاح إعداد خاطئ"],
  /* the team */
  "staff.add": ["Added a team member", "أضاف عضوًا للفريق"],
  "staff.role": ["Changed a member's role", "غيّر دور عضو"],
  "staff.deactivate": ["Removed a member's access", "أوقف دخول عضو"],
  "staff.reactivate": ["Gave a member access again", "أعاد دخول عضو"],
  "staff.reset_2step": ["Reset a member's 2-step sign-in", "أعاد ضبط التحقق بخطوتين لعضو"],
  "staff.reset_password": ["Reset a member's password", "أعاد ضبط كلمة مرور عضو"],
  /* stores */
  "shop.suspend": ["Suspended a store", "أوقف متجرًا"],
  "shop.reactivate": ["Reopened a store", "أعاد تشغيل متجر"],
  "shop.payment": ["Marked a payment as received", "سجّل دفعة"],
  /* no longer written (Dukkan has no plans or free trial since 2026-11-16); kept so older log lines still read in words */
  "shop.plan": ["Changed a store's plan", "غيّر باقة متجر"],
  "shop.totp.off": ["Turned off a merchant's 2-step sign-in", "أوقف التحقق بخطوتين لتاجر"],
  /* no longer written ("Log in as merchant" was removed on 2026-11-16); kept so older log lines still read in words */
  "shop.impersonate.start": ["Opened a store as its merchant", "دخل متجرًا كتاجر"],
  "shop.impersonate.end": ["Left a store opened as its merchant", "خرج من متجر دخله كتاجر"],
  "shops.export": ["Exported the store list", "صدّر قائمة المتاجر"],
  "payments.export": ["Exported payments", "صدّر المدفوعات"],
  /* no longer written either (the subscriptions list is gone); kept for older log lines */
  "subscriptions.export": ["Exported subscriptions", "صدّر الاشتراكات"],
  /* support */
  "ticket.reply": ["Replied to a ticket", "ردّ على تذكرة"],
  "ticket.note": ["Added a team note to a ticket", "أضاف ملاحظة داخلية لتذكرة"],
  "ticket.update": ["Changed a ticket", "عدّل تذكرة"],
  "tickets.canned.save": ["Saved the ready replies", "حفظ الردود الجاهزة"],
  "complaint.add": ["Added a store report", "أضاف بلاغًا عن متجر"],
  "complaint.update": ["Changed a store report", "عدّل بلاغًا عن متجر"],
  "document.review": ["Reviewed a document", "راجع مستندًا"],
  /* marketing */
  "announcement.create": ["Created an announcement", "أنشأ إعلانًا"],
  "announcement.edit": ["Edited an announcement", "عدّل إعلانًا"],
  "announcement.end": ["Ended an announcement", "أنهى إعلانًا"],
  "announcement.delete": ["Deleted an announcement", "حذف إعلانًا"],
  "popup.create": ["Created a pop-up", "أنشأ نافذة منبثقة"],
  "popup.edit": ["Edited a pop-up", "عدّل نافذة منبثقة"],
  "popup.status": ["Changed a pop-up's status", "غيّر حالة نافذة منبثقة"],
  "popup.delete": ["Deleted a pop-up", "حذف نافذة منبثقة"],
  "page.create": ["Created a page", "أنشأ صفحة"],
  "page.edit": ["Edited a page", "عدّل صفحة"],
  "page.status": ["Changed a page's status", "غيّر حالة صفحة"],
  "page.delete": ["Deleted a page", "حذف صفحة"],
  /* Diwan's Website page was removed on 2026-11-16 (the website's copy now lives in code), so nothing writes these two
     any more. They stay so that the older lines in the activity log still read in plain words. */
  "website.change": ["Changed the website", "عدّل الموقع"],
  "website.reset": ["Reset part of the website", "أعاد جزءًا من الموقع لأصله"],
  /* theme store */
  "theme.create": ["Created a theme", "أنشأ ثيمًا"],
  "theme.edit": ["Edited a theme", "عدّل ثيمًا"],
  "theme.design": ["Changed a theme's design", "عدّل تصميم ثيم"],
  "theme.status": ["Changed a theme's status", "غيّر حالة ثيم"],
  "theme.delete": ["Deleted a theme", "حذف ثيمًا"],
  "marketplace.developer_add": ["Added a developer", "أضاف مطورًا"],
  "marketplace.developer_change": ["Changed a developer", "عدّل مطورًا"],
  "marketplace.item_add": ["Added a developer's item", "أضاف عملًا لمطور"],
  "marketplace.item_change": ["Changed a developer's item", "عدّل عملًا لمطور"],
  "marketplace.item_status": ["Changed a developer item's status", "غيّر حالة عمل لمطور"],
  /* platform */
  "settings.change": ["Changed platform settings", "عدّل إعدادات المنصة"],
  "settings.template": ["Changed the starter store", "عدّل المتجر المبدئي"],
  "settings.template_cleared": ["Cleared the starter store", "مسح المتجر المبدئي"],
  "settings.legal_unlock": ["Unlocked the store legal pages", "فتح قفل الصفحات القانونية للمتاجر"],
  "settings.legal_unlock_failed": ["Failed to unlock the store legal pages", "فشل في فتح قفل الصفحات القانونية للمتاجر"],
  "flag.add": ["Added a feature flag", "أضاف ميزة"],
  "flag.change": ["Changed a feature flag", "عدّل ميزة"],
  "flag.remove": ["Removed a feature flag", "أزال ميزة"],
  /* plans are gone (2026-11-16): these are no longer written, kept so older log lines still read in words */
  "plan.create": ["Created a plan", "أنشأ باقة"],
  "plan.update": ["Changed a plan", "عدّل باقة"],
  "plan.delete": ["Deleted a plan", "حذف باقة"],
};

/** What a log line says happened, in plain words (an action without words shows as written) */
export const actionWords = (t: (en: string, ar: string) => string, action: string) => {
  const w = W[action];
  return w ? t(w[0], w[1]) : action;
};

/* A document's kind, in the same words as the cards on Diwan's Documents page, so a log line and its card match */
const DOCUMENT_KIND: Record<string, [en: string, ar: string]> = {
  courier_proof: ["Proof of delivery", "إثبات التوصيل"],
  commercial_registration: ["Commercial registration", "السجل التجاري"],
  other: ["Other document", "مستند آخر"],
};

/** A document's kind in words (a kind without words reads as "Document") */
export const documentKindWords = (t: (en: string, ar: string) => string, kind: string) => {
  const w = DOCUMENT_KIND[kind];
  return w ? t(w[0], w[1]) : t("Document", "مستند");
};

/** A document's number among its store's documents of its kind, as the cards show it ("#002") */
export const documentNumber = (seq: number) => `#${String(seq).padStart(3, "0")}`;

/** Sign-in lines, for the "Sign-ins only" filter */
export const SIGN_IN_ACTIONS = ["staff.login", "staff.logout", "staff.login_failed", "staff.code_failed", "staff.setup_wrong_key"];
