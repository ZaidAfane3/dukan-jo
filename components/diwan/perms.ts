/* Diwan roles and what each may do. Shared by the server (server/staff.ts enforces it on every route) and the pages
   (which only hide what the server would refuse anyway). */

export type Role = "owner" | "support" | "developer";
export const ROLES: Role[] = ["owner", "support", "developer"];
export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);

export type Perm =
  | "shops.read" | "shops.status" | "shops.impersonate" | "shops.export"
  | "billing" | "tickets" | "domains" | "documents" | "complaints"
  | "announce" | "settings" | "flags" | "marketplace" | "staff" | "audit.read" | "delete";

/* Owner: everything. Support: see shops and tickets, log in as merchant; no billing, plans, deleting or settings.
   Developer: the developer portal only (what merchants see in their dashboard: themes, pages, pop-ups, announcements,
   the outside developers' work), the feature switches and the activity log; no shops, payments, tickets or staff. */
const SUPPORT: Perm[] = ["shops.read", "shops.impersonate", "tickets", "domains", "documents", "complaints", "audit.read"];
const DEVELOPER: Perm[] = ["announce", "marketplace", "flags", "audit.read"];

export const can = (s: { role: Role }, p: Perm) => s.role === "owner" || (s.role === "developer" ? DEVELOPER : SUPPORT).includes(p);

/** A role's name for the pages */
export const roleName = (r: Role) => ({ owner: { en: "Owner", ar: "المالك" }, support: { en: "Support", ar: "الدعم" }, developer: { en: "Developer", ar: "المطوّر" } })[r] ?? { en: r, ar: r };
