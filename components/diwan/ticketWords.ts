import type { Tone } from "./ui";

/* The words and colours Diwan uses for tickets, bug reports and ideas (the tickets, feedback and ticket pages). */

export type TStatus = "new" | "open" | "waiting_merchant" | "waiting_dukkan" | "resolved" | "closed";
export type TPriority = "low" | "normal" | "high" | "urgent";
export type TKind = "support" | "bug" | "idea";

export const STATUS: Record<TStatus, { en: string; ar: string; tone: Tone }> = {
  new: { en: "New", ar: "جديدة", tone: "blue" },
  open: { en: "Open", ar: "مفتوحة", tone: "primary" },
  waiting_dukkan: { en: "Waiting for us", ar: "بانتظارنا", tone: "amber" },
  waiting_merchant: { en: "Waiting for merchant", ar: "بانتظار التاجر", tone: "grey" },
  resolved: { en: "Solved", ar: "تم الحل", tone: "green" },
  closed: { en: "Closed", ar: "مغلقة", tone: "grey" },
};
export const STATUS_ORDER: TStatus[] = ["new", "open", "waiting_dukkan", "waiting_merchant", "resolved", "closed"];

export const PRIORITY: Record<TPriority, { en: string; ar: string; tone: Tone }> = {
  urgent: { en: "Urgent", ar: "عاجلة", tone: "red" },
  high: { en: "High", ar: "عالية", tone: "amber" },
  normal: { en: "Normal", ar: "عادية", tone: "grey" },
  low: { en: "Low", ar: "منخفضة", tone: "grey" },
};
export const PRIORITY_ORDER: TPriority[] = ["urgent", "high", "normal", "low"];

export const KIND: Record<TKind, { en: string; ar: string; tone: Tone }> = {
  support: { en: "Support", ar: "دعم", tone: "primary" },
  bug: { en: "Bug", ar: "خطأ", tone: "red" },
  idea: { en: "Idea", ar: "اقتراح", tone: "amber" },
};

/* the merchant's support categories (content.ts, support.categories) */
export const CATEGORY = [
  { en: "Orders", ar: "الطلبات" },
  { en: "Payments", ar: "المدفوعات" },
  { en: "Technical issue", ar: "مشكلة تقنية" },
  { en: "Store design", ar: "تصميم المتجر" },
  { en: "Suggestions", ar: "اقتراحات" },
  { en: "Other", ar: "أخرى" },
];

/** A system line in a conversation, from what the server wrote (status:..., priority:..., assignee:..., merchant:...) */
export function systemLine(body: string, t: (en: string, ar: string) => string): string {
  const i = body.indexOf(":");
  const what = i < 0 ? body : body.slice(0, i);
  const value = i < 0 ? "" : body.slice(i + 1);
  if (what === "merchant") return value === "closed" ? t("The merchant closed the ticket", "أغلق التاجر التذكرة") : t("The merchant reopened the ticket", "أعاد التاجر فتح التذكرة");
  if (what === "status") {
    const s = STATUS[value as TStatus];
    return t(`Status set to ${s?.en ?? value}`, `تغيّرت الحالة إلى ${s?.ar ?? value}`);
  }
  if (what === "priority") {
    const p = PRIORITY[value as TPriority];
    return t(`Priority set to ${p?.en ?? value}`, `تغيّرت الأولوية إلى ${p?.ar ?? value}`);
  }
  if (what === "assignee") return value ? t(`Assigned to ${value}`, `أُسندت إلى ${value}`) : t("No longer assigned", "أُلغي الإسناد");
  return body;
}
