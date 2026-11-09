import type { Perm } from "./perms";

/* Diwan's sidebar. Each page lives at app/diwan/(console)/<path>/page.tsx; a link shows only to staff whose role has
   its permission (the API routes check it again). Overview stands alone at the top; the rest is in sections that fold
   (components/diwan/Shell.tsx), so the menu stays short: only the section of the page you are on is open. */
export type NavGroup = "stores" | "support" | "merchants" | "themes" | "admin";
export type NavItem = { href: string; en: string; ar: string; perm: Perm; group: NavGroup | null };

export const DIWAN_NAV: NavItem[] = [
  { href: "/diwan", en: "Overview", ar: "نظرة عامة", perm: "shops.read", group: null },
  { href: "/diwan/shops", en: "Shops", ar: "المتاجر", perm: "shops.read", group: "stores" },
  { href: "/diwan/plans", en: "Plans and payments", ar: "الباقات والمدفوعات", perm: "billing", group: "stores" },
  { href: "/diwan/funnel", en: "Onboarding funnel", ar: "مراحل البدء", perm: "shops.read", group: "stores" },
  { href: "/diwan/tickets", en: "Tickets", ar: "التذاكر", perm: "tickets", group: "support" },
  { href: "/diwan/complaints", en: "Store reports", ar: "بلاغات المتاجر", perm: "complaints", group: "support" },
  { href: "/diwan/documents", en: "Documents", ar: "المستندات", perm: "documents", group: "support" },
  { href: "/diwan/domains", en: "Domains", ar: "النطاقات", perm: "domains", group: "support" },
  { href: "/diwan/feedback", en: "Bugs and ideas", ar: "الأخطاء والأفكار", perm: "tickets", group: "support" },
  /* what Dukkan's team sends to merchants' dashboards */
  { href: "/diwan/announcements", en: "Announcements", ar: "الإعلانات", perm: "announce", group: "merchants" },
  { href: "/diwan/popups", en: "Pop-ups", ar: "النوافذ المنبثقة", perm: "announce", group: "merchants" },
  { href: "/diwan/pages", en: "Pages", ar: "الصفحات", perm: "announce", group: "merchants" },
  /* the theme store: Dukkan's themes and the outside developers' work */
  { href: "/diwan/themes", en: "Themes", ar: "الثيمات", perm: "marketplace", group: "themes" },
  { href: "/diwan/marketplace", en: "Developers", ar: "المطورون", perm: "marketplace", group: "themes" },
  { href: "/diwan/staff", en: "Staff", ar: "الفريق", perm: "staff", group: "admin" },
  { href: "/diwan/settings", en: "Platform settings", ar: "إعدادات المنصة", perm: "settings", group: "admin" },
  { href: "/diwan/flags", en: "Feature flags", ar: "تفعيل الميزات", perm: "flags", group: "admin" },
  { href: "/diwan/activity", en: "Activity log", ar: "سجل النشاط", perm: "audit.read", group: "admin" },
];

export const NAV_GROUPS: Record<NavGroup, { en: string; ar: string }> = {
  stores: { en: "Stores", ar: "المتاجر" },
  support: { en: "Support", ar: "الدعم" },
  merchants: { en: "Merchant dashboard", ar: "لوحة التاجر" },
  themes: { en: "Theme store", ar: "متجر الثيمات" },
  admin: { en: "Admin", ar: "الإدارة" },
};

/** Pages for Dukkan's staff, not for a merchant: Diwan itself, the starter template designer (/design?template=1) and a
    Diwan theme's designer (/design?catalog=<id>). The
    merchant's boot work (the tour, his account's storage and sync, the founders' gift) stays off them. */
export function isStaffPage(path: string, search: string): boolean {
  const q = new URLSearchParams(search);
  return path === "/diwan" || path.startsWith("/diwan/") || (path === "/design" && (q.get("template") === "1" || !!q.get("catalog")));
}
