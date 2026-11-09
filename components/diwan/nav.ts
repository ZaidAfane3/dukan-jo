import type { Perm } from "./perms";

/* Diwan's sidebar. Each page lives at app/diwan/(console)/<path>/page.tsx; a link shows only to staff whose role has
   its permission (the API routes check it again). */
export type NavItem = { href: string; en: string; ar: string; perm: Perm; group: "shops" | "support" | "portal" | "platform" };

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
  { href: "/diwan/flags", en: "Feature flags", ar: "تفعيل الميزات", perm: "flags", group: "platform" },
  /* the developer portal: what Dukkan's team sends out to merchants (themes to the theme store, pages and pop-ups in
     their dashboard, announcements) and the outside developers' work */
  { href: "/diwan/themes", en: "Themes", ar: "الثيمات", perm: "marketplace", group: "portal" },
  { href: "/diwan/pages", en: "Pages", ar: "الصفحات", perm: "announce", group: "portal" },
  { href: "/diwan/popups", en: "Pop-ups", ar: "النوافذ المنبثقة", perm: "announce", group: "portal" },
  { href: "/diwan/announcements", en: "Announcements", ar: "الإعلانات", perm: "announce", group: "portal" },
  { href: "/diwan/marketplace", en: "Developers", ar: "المطورون", perm: "marketplace", group: "portal" },
  { href: "/diwan/settings", en: "Platform settings", ar: "إعدادات المنصة", perm: "settings", group: "platform" },
  { href: "/diwan/staff", en: "Staff", ar: "الفريق", perm: "staff", group: "platform" },
  { href: "/diwan/activity", en: "Activity log", ar: "سجل النشاط", perm: "audit.read", group: "portal" },
];

export const NAV_GROUPS = {
  shops: { en: "Shops", ar: "المتاجر" },
  support: { en: "Support", ar: "الدعم" },
  portal: { en: "Developer portal", ar: "بوابة المطورين" },
  platform: { en: "Platform", ar: "المنصة" },
};

/** Pages for Dukkan's staff, not for a merchant: Diwan itself, the starter template designer (/design?template=1) and a
    Diwan theme's designer (/design?catalog=<id>). The
    merchant's boot work (the tour, his account's storage and sync, the founders' gift) stays off them. */
export function isStaffPage(path: string, search: string): boolean {
  const q = new URLSearchParams(search);
  return path === "/diwan" || path.startsWith("/diwan/") || (path === "/design" && (q.get("template") === "1" || !!q.get("catalog")));
}
