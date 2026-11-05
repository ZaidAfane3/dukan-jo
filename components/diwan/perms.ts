/* Diwan roles and what each may do. Shared by the server (server/staff.ts enforces it on every route) and the pages
   (which only hide what the server would refuse anyway). */

export type Role = "owner" | "support";

export type Perm =
  | "shops.read" | "shops.status" | "shops.impersonate" | "shops.export"
  | "billing" | "tickets" | "domains" | "documents" | "complaints"
  | "announce" | "settings" | "flags" | "marketplace" | "staff" | "audit.read" | "delete";

/* Owner: everything. Support: see shops and tickets, log in as merchant; no billing, plans, deleting or settings. */
const SUPPORT: Perm[] = ["shops.read", "shops.impersonate", "tickets", "domains", "documents", "complaints", "audit.read"];

export const can = (s: { role: Role }, p: Perm) => s.role === "owner" || SUPPORT.includes(p);
