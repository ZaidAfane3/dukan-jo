import type { Perm } from "./perms";

/* Diwan's sidebar. Each page lives at app/diwan/(console)/<path>/page.tsx; a link shows only to staff whose role has
   its permission (the API routes check it again). */
export type NavItem = { href: string; en: string; ar: string; perm: Perm; group: "shops" | "support" | "platform" };

export const DIWAN_NAV: NavItem[] = [
  { href: "/diwan", en: "Overview", ar: "نظرة عامة", perm: "shops.read", group: "shops" },
  { href: "/diwan/shops", en: "Shops", ar: "المتاجر", perm: "shops.read", group: "shops" },
  { href: "/diwan/plans", en: "Plans and payments", ar: "الباقات والمدفوعات", perm: "billing", group: "shops" },
  { href: "/diwan/funnel", en: "Onboarding funnel", ar: "مراحل البدء", perm: "shops.read", group: "shops" },
  { href: "/diwan/tickets", en: "Tickets", ar: "التذاكر", perm: "tickets", group: "support" },
  { href: "/diwan/feedback", en: "Bugs and ideas", ar: "الأخطاء والأفكار", perm: "tickets", group: "support" },
  { href: "/diwan/domains", en: "Domains", ar: "النطاقات", perm: "domains", group: "support" },
  { href: "/diwan/documents", en: "Documents", ar: "المستندات", perm: "documents", group: "support" },
  { href: "/diwan/complaints", en: "Store reports", ar: "بلاغات المتاجر", perm: "complaints", group: "support" },
  { href: "/diwan/announcements", en: "Announcements", ar: "الإعلانات", perm: "announce", group: "support" },
  { href: "/diwan/flags", en: "Feature flags", ar: "تفعيل الميزات", perm: "flags", group: "platform" },
  { href: "/diwan/marketplace", en: "Marketplace", ar: "سوق الثيمات والتطبيقات", perm: "marketplace", group: "platform" },
  { href: "/diwan/settings", en: "Platform settings", ar: "إعدادات المنصة", perm: "settings", group: "platform" },
  { href: "/diwan/staff", en: "Staff", ar: "الفريق", perm: "staff", group: "platform" },
  { href: "/diwan/activity", en: "Activity log", ar: "سجل النشاط", perm: "audit.read", group: "platform" },
];

export const NAV_GROUPS = {
  shops: { en: "Shops", ar: "المتاجر" },
  support: { en: "Support", ar: "الدعم" },
  platform: { en: "Platform", ar: "المنصة" },
};

/** Pages for Dukkan's staff, not for a merchant: Diwan itself and the starter template designer (/design?template=1). The
    merchant's boot work (the tour, his account's storage and sync, the founders' gift) stays off them. */
export function isStaffPage(path: string, search: string): boolean {
  return path === "/diwan" || path.startsWith("/diwan/") || (path === "/design" && new URLSearchParams(search).get("template") === "1");
}
